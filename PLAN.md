# Plan: One-tap store routing for /invite/<code> + assetlinks tightening
_Locked via grill — by Claude + dat1kidd916 · revised after Codex rounds 1–2_

> **Reverses a grill decision.** The grill chose "attempt the scheme, then auto-redirect to the store on a timeout." Two rounds of review established that no page-load-time technique can do this correctly on Android — see *The constraint* below. The redirect became a one-tap CTA instead. Read that section before signing off.

## The constraint

Chrome (and Chromium webviews) will not launch an external app from a navigation that lacks user activation. Two consequences, both load-bearing:

1. The **existing** `link.js:43` auto-`window.location = 'connectmerge://…'` is already a silent no-op in modern Chrome. It is harmless, but it is not doing the job the launch doc credits it with.
2. An **auto-fired** `intent://…;S.browser_fallback_url=…;end` is worse than harmless: Chrome skips the app launch and follows the fallback, so a user who *has* the app gets shipped to Play and loses the invite. That is precisely the bug the handoff spec was written to fix.

Nothing at page load can tell "installed" from "not installed." A user gesture can — `intent://` fired from a click gets an OS-authoritative answer. So the routing moves to the button.

## Goal

`REFERRAL-LAUNCH.md` documents four cases. Case 4 (app not installed) currently requires the visitor to ignore the primary CTA, notice the Play badge below it, and tap that instead — the badge is where the `referrer=code%3D<CODE>` lives. That two-target dance is the real gap. After this change, **on intent-capable Android browsers (Chrome, Firefox, Samsung Internet, Edge) the primary CTA is correct in both cases**: one tap opens the app if it is installed, or lands on Play carrying the install referrer if it is not.

Deliberately *not* claimed: inside a matched in-app webview with the app absent, the CTA still fails and the visitor still needs the decorated Play badge below it — same as today. Webviews are where `intent://` support is least reliable and where the app is most often already installed, so they keep the plain scheme. The badge is always rendered, so that path degrades rather than dead-ends.

Items #1 and #2 of the handoff spec already exist in-repo. `assetlinks.json` is hosted and correct in shape; `apple-app-site-association` is hosted but inert (`REPLACE_WITH_TEAM_ID`, and `com.kiddulu.…` contradicts the real `com.kidd.…`) and stays untouched — it cannot work until the app repo adds an Associated Domains entitlement.

## Approach

1. **Extract one pure router.** `route(pathname, userAgent, playBadgeHref, appPublished)` → `null` for unrecognised paths, else `{ kind: 'invite'|'duel', deepLink, ctaUrl, storeUrl }`. Every branch that changes `ctaUrl` — including the launch gate — is an argument, so all of it is reachable from the test. The DOM code becomes assignment statements.

2. **Intent-capable Android invite → `ctaUrl` is an intent URL:**
   `intent://invite/<CODE>#Intent;scheme=connectmerge;package=com.kidd.connect_merge;S.browser_fallback_url=<encoded storeUrl>;end`
   Everything else — iOS, desktop, in-app webviews, and **any Android browser not positively identified** — gets `ctaUrl = deepLink` (`connectmerge://invite/<CODE>`), exactly today's behavior.

3. **Allowlist, don't denylist.** `isIntentCapable = /Android/.test(ua) && /Chrome\/|Firefox\/|SamsungBrowser\/|EdgA\//.test(ua) && !/; wv\)|Version\/4\.0|FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp/i.test(ua)`. The `; wv)` and `Version/4.0` markers are the generic Android WebView signature — they catch embedded webviews that report `Chrome/` but were never named in the app-specific list. An unrecognised Android browser falls back to the plain scheme, which at worst does what the page does today; a denylist would have handed `intent://` to unknown browsers and risked a button that does nothing where the scheme would have worked. The trailing webview exclusion stays because those UAs contain `Chrome/`: `REFERRAL-LAUNCH.md:10-12` documents the Facebook/Instagram case as *app installed, App Links bypassed*, which is exactly where the plain scheme wins.

4. **Encode the fallback URL exactly once.** `storeUrl` already contains `referrer=code%3D<CODE>`; `encodeURIComponent` of the whole string yields `…referrer%3Dcode%253D<CODE>` inside the intent. Chrome decodes once on the way out, Play decodes `referrer` once more, and the app receives the literal `code=<CODE>`. Encoding twice or not at all breaks auto-linking silently — the exact root cause the handoff spec names. This is what the test pins.

5. **Badge `href` in `link.html:45` stays the source of truth.** Derive `storeUrl` with `new URL(playAnchor.href)` + `searchParams.set('referrer', 'code=' + code)` (which encodes `=` → `%3D` correctly), then write it back. If JS fails entirely the badge is still a working store link.

6. **Gate the intent CTA on `APP_PUBLISHED === true`.** During closed testing the Play listing reads "not available" to non-testers, so a fallback into Play is a dead end; until launch the CTA keeps the plain scheme and the page renders as today. One flag flip at launch, same flag that already controls CTA styling.

7. **Keep the page-load scheme attempt as-is.** It is a no-op in Chrome but still fires in some webviews, which is where it was ever useful. Not worth removing, not worth trusting. No auto-navigation to the store is added anywhere — which also means no `sessionStorage` guard and no back-button trap.

8. **Invite links only.** `/duel/...` keeps today's behavior; `parseCode()` has no duel key, so a redirected duel recipient would install into an empty app with the challenge lost. The duel branch also gets a `try`/`catch` around `decodeURIComponent(segments[4])` — a malformed percent-escape in a shared name currently throws and kills the entire script, taking the year stamp and badge decoration with it. Decode failure returns `null` (generic page) rather than propagating.

9. **Strip credential delegation from `assetlinks.json` — two edits, not one.** The file has two statements:
   - **Delete the entire first statement** (`"namespace": "web"`, `"site": "https://www.connectmerge.app"`). Its only relation is `get_login_creds`; removing just the relation would leave an empty, meaningless relation array. The statement delegates the site's credentials to itself and does nothing.
   - **In the Android statement, drop `"delegate_permission/common.get_login_creds"`** from the relation array, leaving `handle_all_urls` alone.

   Unrequested credential-delegation authority for a game with no Credential Manager integration. *Confirm at sign-off that the app has no password-autofill integration.*

10. **Update `REFERRAL-LAUNCH.md`:** case 4 is no longer a manual badge tap; `APP_PUBLISHED` now gates behavior, not just styling; and the verification block gets the reset step (below).

11. **Make the verification sequence stale-cache-proof.** The existing block at `REFERRAL-LAUNCH.md:47-49` re-verifies but never resets, so a cached pass can mask a broken file. Prepend `adb shell pm set-app-links --package com.kidd.connect_merge 0 all`, then `--re-verify`, then poll `pm get-app-links` until the async verifier settles.

12. **Confirm the App Signing fingerprint.** Play Console → Test and release → Setup → App integrity → App signing key certificate SHA-256 must be one of the two entries in `assetlinks.json`. `REFERRAL-LAUNCH.md:19` asserts the pair is App Signing + upload cert; nobody has checked it against the Console.

13. **One runnable check — `test/link.test.js`, run as `node test/link.test.js`.** It lives at the repo root, *not* under `public/`, because Vercel serves everything in `public/` and a test file there would be a publicly fetchable URL. Add `module.exports` behind `typeof module !== 'undefined'` (one line, inert in the browser) and guard the DOM block with `typeof document !== 'undefined'`, so a framework-free assert script can `require('../public/assets/js/link.js')` and drive `route()` directly: Chrome-on-Android invite → intent URL, the **decoded round-trip** of the double-encoded referrer, `appPublished: false` → plain scheme, webview UA → plain scheme, unknown Android browser → plain scheme, iOS/desktop → plain scheme, duel path → no store URL, malformed `%` in a duel name → `null` not a throw, invalid code → `null`.

## Key decisions & tradeoffs

- **One-tap CTA instead of an automatic redirect.** This is the grill decision that got reversed. Cost: a visitor who ignores the button never reaches the store, so the referrer flow needs one deliberate tap. Buy: it is correct in every case, where both auto-redirect designs were provably incorrect for installed users. The alternative — auto-navigating Android visitors to Play and accepting that installed-in-a-webview users lose their invite — is still available and is a one-line change from here if you want reach over correctness.
- **`intent://` on the button, not on load.** Fewer lines than the timer design, no `visibilitychange`, no timeout constant, no false-negative install detection, and the OS answers the question instead of a heuristic.
- **Allowlist of intent-capable browsers, not a denylist of webviews.** Both rot; only one rots safely. An unrecognised UA getting the plain scheme is today's behavior, whereas an unrecognised UA getting `intent://` risks a dead button.
- **Webviews keep the plain scheme.** Protects the one documented case where the app is installed but App Links are bypassed — at the cost that a webview visitor *without* the app must use the badge, which the plan accepts and states in the Goal.
- **Gated on the existing `APP_PUBLISHED`, not a new kill switch.** Codex argued for a separate flag. Rejected — a second flag is a second thing to forget on launch day. Accepted the real defect underneath it: the launch doc gets updated (step 10).
- **Kept both SHA-256 fingerprints.** Codex wanted the upload cert dropped as excess signing authority. Rejected: `REFERRAL-LAUNCH.md:19` records the pair as deliberate, upload-key-signed internal builds need App Links during testing, and the attack requires a keystore compromise *plus* a sideload. Removing `get_login_creds` is the part of that critique worth taking.
- **Pure `route()` + asserts, not the real script under DOM stubs.** Two `typeof` guards make the file Node-requirable without a fake `document`, and all the breakable logic is in the pure function.

## Risks / open questions

- **The double encoding in step 4 fails silently.** A wrong `referrer` looks like a working link right up until the friend never appears. The assert pins the decoded form; the end-to-end internal-testing install (`REFERRAL-LAUNCH.md:51-52`) is what actually proves it.
- **The webview UA regex will rot.** New in-app browsers appear; a miss degrades to "button does nothing, badge still works." Worth revisiting if invite conversion looks bad from a specific source.
- **`intent://` support outside Chrome/Firefox/Samsung Internet is unverified.** Same degradation path.
- **Conversion risk from requiring a tap.** If measured invite-install conversion disappoints, the fallback is the auto-navigate variant named above.
- **Does the app use Credential Manager / password autofill?** If yes, step 9 must be dropped. Assumed no.
- **The App Signing fingerprint is still unconfirmed.** If neither entry matches, App Links never verify and every `/invite/` link opens a browser — indistinguishable from a manifest bug.
- **AASA remains knowingly broken.** Accepted; blocked on the app repo.
- Crawler/preview UAs (Slack, WhatsApp unfurl) do not execute JS, so none of this fires for link previews — unverified but low stakes.

## Out of scope

- Any change to `apple-app-site-association` — blocked on a real Apple Team ID and confirmed iOS bundle ID.
- Any app-side (Flutter) change. `FriendsService.inviteHttpsLink()` already emits the code as a path segment and `parseCode()` already parses `code=`.
- The iOS Associated Domains entitlement — a separate, still-open change in the app repo.
- An iOS auto-redirect or `APP_STORE_URL` const — `REFERRAL-LAUNCH.md:31-33` already owns that launch step.
- Adding a duel referrer key (would require an app-side parser change).
- Flipping `APP_PUBLISHED` to true — a launch-day action.
- Analytics or click tracking on the CTA.
