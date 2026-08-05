# Plan Review Log: Smart store redirect for /invite/<code> + assetlinks fingerprint verification

Act 1 (grill) complete — plan locked with the user. MAX_ROUNDS=5.

Decisions settled during the grill:
- Scope narrowed to spec item #3 + fingerprint verification (items #1 and #2 already exist in-repo).
- Redirect gated on the existing `APP_PUBLISHED` flag (app is in closed testing).
- Scheme attempt first, then a ~1500ms timeout to the store, cancelled on `visibilitychange`.
- Android redirects; iOS behind a null `APP_STORE_URL` const; desktop never redirects.
- Invite links only — duel links keep current behavior.
- Fingerprint verified by the user via Play Console + `adb shell pm get-app-links`.

## Round 1 — Codex (gpt-5.6-sol, reasoning high)

- **Critical — false install detection:** The 1.5-second timer assumes a blocked custom-scheme launch means "app not installed," but in-app browsers commonly block automatic scheme launches; installed users would be sent to Play and lose the invite. Fix: start the scheme attempt and store fallback only from an explicit user click, or use a user-activated Android intent with a Play fallback. (PLAN.md:16)

- **Critical — destructive navigation:** `location.replace()` removes the invite URL even when Play is unavailable, installation is cancelled, or the device is incompatible, leaving no route back to the code. Fix: preserve the landing page with normal navigation and suppress repeat redirects using per-page/session state. (PLAN.md:24)

- **High — unreliable lifecycle race:** `visibilitychange` cannot distinguish an app launch from tab switching, screen locking, or opening another app, while some webviews may not emit it during scheme handling. Fix: eliminate automatic detection; make fallback a user-driven action and retain the invite page. (PLAN.md:35)

- **High — unsafe future iOS switch:** Setting `APP_STORE_URL` would redirect users to an App Store URL that cannot preserve the invite code, contradicting the referral goal. Fix: omit `APP_STORE_URL` until iOS has deferred-link support, or keep the page visible with a copyable code. (PLAN.md:14)

- **High — unnecessary credential delegation:** Keeping `delegate_permission/common.get_login_creds` grants unrelated credential-sharing authority solely to avoid "deploy churn." Fix: remove both `common.get_login_creds` relations unless credential sharing is an explicit, tested requirement. (assetlinks.json:3)

- **High — excess signing authority:** Retaining the upload certificate lets upload-key-signed sideloaded builds claim the domain even though Play installs use the App Signing certificate. Fix: retain only the Play App Signing fingerprint unless upload-signed distribution intentionally requires App Links. (assetlinks.json:17)

- **Medium — stale verification can pass:** `pm get-app-links` alone can report cached state, so it does not prove the current deployed association. Fix: reset/re-run verification with `pm verify-app-links --re-verify`, wait for completion, then inspect `pm get-app-links` and test an actual invite URL. (PLAN.md:30)

- **Medium — test misses the failure-prone code:** An assertion over URL encoding does not exercise platform gating, timer cancellation, invalid paths, or the actual DOM-coupled script. Fix: run the real `link.js` under Node with minimal location/DOM/timer stubs and cover Android invite, installed-app cancellation, duel, invalid code, and non-Android cases. (link.js:6)

- **Medium — JavaScript becomes an unnecessary dependency:** Hoisting the badge URL out of HTML risks leaving no functional store link when JavaScript fails. Fix: keep the valid HTML `href` as the source of truth and derive the referrer URL with `new URL(playAnchor.href)` plus `searchParams.set()`. (link.html:45)

- **Medium — rollout and documentation conflict:** `APP_PUBLISHED` currently means CTA styling in the launch checklist; silently making it also enable navigation couples release state to a risky feature and leaves the checklist wrong. Fix: add a separate redirect kill switch and update the launch document with the new behavior and device test matrix. (REFERRAL-LAUNCH.md:27)

VERDICT: REVISE

### Claude's response

Codex surfaced `REFERRAL-LAUNCH.md`, a launch checklist I had not read. It contradicted the plan in three places and reframed several findings. Changes made:

**Accepted — mechanism replaced entirely (findings 1, 2, 3).** Codex is right that a blocked scheme launch does not imply "not installed," and `REFERRAL-LAUNCH.md:10-12` confirms it by documenting the installed-in-a-webview case as intentional behavior my timer would have trampled. But its proposed fix (user-driven only) is the option the user explicitly rejected during the grill. Took the better third path Codex gestured at: Android `intent://…#Intent;scheme=connectmerge;package=…;S.browser_fallback_url=<Play URL>;end`. The OS decides installed-vs-not, so the timeout, the `visibilitychange` listener, and the false negative all disappear — and it is less code. Added a `sessionStorage` one-shot guard and dropped `location.replace()` per finding 2.

**Accepted — `APP_STORE_URL` deleted (finding 4).** `REFERRAL-LAUNCH.md:31-33` already owns the iOS launch step and already records that iOS has no install-referrer equivalent. The const was duplicating an existing documented step in a worse place. YAGNI.

**Accepted — `get_login_creds` removed (finding 5).** I had flagged it myself and defended it with "deploy churn," which Codex correctly called a weak reason. Added a sign-off confirmation that the app has no password-autofill integration.

**Rejected — dropping the upload certificate (finding 6).** `REFERRAL-LAUNCH.md:19` records the two fingerprints as a deliberate pair (Play App Signing + upload cert). Upload-key-signed internal builds need App Links to verify during testing, and the attack it prevents requires a keystore compromise *plus* a sideload. Not worth breaking the test loop.

**Accepted, by deletion (finding 7).** `REFERRAL-LAUNCH.md:47-49` already prescribes `pm verify-app-links --re-verify` before `pm get-app-links`. My plan step was a worse restatement of an existing checklist. Removed it and pointed at the real one.

**Partially accepted (finding 8).** Broadened the test to cover the invalid-code, duel, and non-Android branches, plus the decoded round-trip of the double-encoded referrer. Rejected running the real `link.js` under DOM stubs — the DOM-coupled parts are three `textContent` assignments; extracting two pure functions pins the money path without a fake `document`.

**Accepted (finding 9).** Badge `href` in `link.html` stays the source of truth; the referrer URL is derived with `new URL()` + `searchParams.set()`, so the store link survives a JS failure.

**Half accepted (finding 10).** Rejected the second kill switch — a second flag is a second thing to forget on launch day, and the user chose one flip deliberately. Accepted the real defect underneath it: `REFERRAL-LAUNCH.md` now gets updated as part of this change, since both its "How it works" case 4 and its `APP_PUBLISHED` description go stale the moment this ships.

## Round 2 — Codex

Resolved from the prior review: `location.replace()` is gone, iOS auto-redirect was removed, the HTML badge remains the source of truth, credential delegation will be removed, documentation will be updated, and retaining the upload fingerprint now has a stated testing requirement.

Remaining problems:

- **Critical — auto-fired intents still repeat the original bug:** Chrome does not launch an external app from an intent initiated without user activation; it follows `browser_fallback_url`, so an installed user can still be sent to Play. Fix: fire the intent only from the user-activated CTA; automatic installed-vs-uninstalled detection is not reliable here. (Chrome documentation: developer.chrome.com/docs/android/intents; PLAN.md:14)

- **High — "graceful degradation" can break the existing button:** Replacing the working `connectmerge://` button with browser-dependent `intent://` means unsupported webviews may ignore the only app-opening action. Fix: retain the custom-scheme button as fallback or verify every claimed target browser before replacing it. (PLAN.md:26)

- **Medium — the proposed test cannot test what it claims:** The two URL-builder functions receive neither pathname nor user agent, so they cannot cover duel routing or non-Android behavior; importing the current DOM-coupled file in Node also fails immediately. Fix: extract one pure route-selection function and place browser execution behind a Node-safe guard. (PLAN.md:36, link.js:1)

- **Medium — the verification sequence is not stale-cache-proof:** Android's documented manual flow resets link state, re-verifies, waits for the asynchronous verifier, then reads results; the existing checklist omits reset and wait. Fix: add `pm set-app-links --package com.kidd.connect_merge 0 all`, then re-verify, wait/retry, and inspect. (Android documentation: developer.android.com/training/app-links/verify-applinks; REFERRAL-LAUNCH.md:47)

- **Medium — the session guard is underspecified:** A global key suppresses later invite codes in the same tab, while a storage exception could abort navigation. Fix: key the guard by invite code and fail open on storage errors—or delete it when auto-fire is removed. (PLAN.md:28)

VERDICT: REVISE

### Claude's response

Finding 1 is correct and decisive, and it invalidates the grill's chosen mechanism rather than merely refining it. Chrome requires user activation to launch an external app from a navigation. Two things follow: an auto-fired `intent://` makes Chrome skip the app and follow `browser_fallback_url`, shipping installed users to Play and losing the invite — the exact bug the handoff spec exists to fix; and the *existing* page-load `connectmerge://` attempt at `link.js:43` has been a silent no-op in modern Chrome all along, which means the protection the round-1 design claimed to be preserving was already illusory.

**Accepted — routing moved to the user-activated CTA.** No page-load technique can distinguish installed from not-installed on Android, because the one API that can is gesture-gated. The primary button now carries the intent URL on Android, so one tap opens the app or lands on Play with the referrer. No auto-navigation to the store exists anywhere in the plan.

This reverses the grill's answer on redirect timing, so it is called out in a banner at the top of PLAN.md and goes to the user at sign-off rather than being absorbed silently. The auto-navigate variant (accept losing installed-in-a-webview users, gain reach) is documented as a one-line alternative so the user can overrule.

**Accepted (finding 2).** Known in-app webviews (`FBAN|FBAV|Instagram|Line/|Twitter|WhatsApp`) keep the plain `connectmerge://` scheme on the button. That is the one documented case where the app is installed but App Links are bypassed, and it is where `intent://` support is least certain. A regex miss degrades to "button does nothing, decorated badge below still works" — today's behavior.

**Accepted (finding 3).** Collapsed the two builders into a single pure `route(pathname, userAgent, playBadgeHref)`, and made the file Node-requirable with two `typeof` guards (`module`, `document`) rather than a DOM stub harness. The test now genuinely covers duel routing, invalid codes, webview and non-Android UAs, and the decoded round-trip of the double-encoded referrer.

**Accepted (finding 4).** Added `pm set-app-links --package com.kidd.connect_merge 0 all` as a reset before `--re-verify`, plus polling for the async verifier, to `REFERRAL-LAUNCH.md`.

**Accepted by deletion (finding 5).** With no auto-navigation there is no back-button trap, so the `sessionStorage` guard is gone entirely.

## Round 3 — Codex

Most prior findings are addressed: auto-navigation and session storage are gone; the CTA is user-activated; routing is testable; verification resets and polls; documentation and asset links are covered.

Remaining problems:

- **High — the CTA is not correct for every Android case:** A matched Facebook/Instagram webview with the app absent receives only `connectmerge://`, so the primary button fails and the user still needs the Play badge. Fix: explicitly retain two labeled actions for unsupported webviews, or narrow the goal to browsers supporting intent fallbacks. (PLAN.md:17)

- **Medium — unknown Android browsers regress:** They default to `intent://`; if unsupported, the button does nothing even where today's custom scheme might open the installed app. Fix: allowlist verified intent-capable browsers and default unknown/webview UAs to the existing scheme. (PLAN.md:25)

- **Medium — the pure router omits required state:** `APP_PUBLISHED` changes `ctaUrl`, but it is absent from `route(pathname, userAgent, playBadgeHref)`, contradicting "all branching logic lives here." Fix: add `appPublished` as a router argument and test both states. (PLAN.md:23)

- **Medium — assetlinks removal is not a one-line edit:** Removing the relation from the first statement would leave a meaningless empty relation; the entire web-target statement must be deleted, plus the relation in the Android statement. Fix: specify those two exact JSON changes. (assetlinks.json:2)

- **Low — malformed duel names can still crash routing:** `decodeURIComponent()` currently throws on malformed percent encoding, and the new centralized router should not preserve that failure. Fix: catch decode failure and return `null`, with one assertion. (link.js:13)

VERDICT: REVISE

### Claude's response

All five accepted. Finding 4 was a straight factual correction of mine: `public/.well-known/assetlinks.json` contains **two** statements, not one. Verified on disk — a `web`-namespace statement whose sole relation is `get_login_creds` (delegating the site's credentials to itself, i.e. inert), plus the Android statement. Step 9 is now two explicit edits: delete the web statement outright, and drop `get_login_creds` from the Android statement's relation array. Stripping only the relation string would have left `"relation": []`.

**Finding 1 — accepted as a scope correction.** The Goal claimed the CTA is "correct in every case on Android"; it is not. A matched webview with the app absent still needs the badge. Rather than add a second labeled action, the Goal now names the guarantee precisely (intent-capable browsers) and states the webview-without-app case as an accepted, badge-backed degradation. The badge is always rendered, so it degrades rather than dead-ends.

**Finding 2 — accepted, default inverted.** Switched from denylisting webviews to allowlisting intent-capable browsers (`Chrome/|Firefox/|SamsungBrowser/|EdgA/`, still excluding webview tokens because those UAs contain `Chrome/`). Both lists rot; only this direction rots safely. An unrecognised Android browser now gets today's behavior instead of a possibly-dead `intent://`.

**Finding 3 — accepted.** `route()` takes `appPublished` as a fourth argument, and the test covers both states.

**Finding 5 — accepted, and it is a pre-existing bug rather than a new one.** `decodeURIComponent(segments[4])` at `link.js:13` throws on a malformed percent-escape, which kills the whole script — taking the year stamp and the badge referrer decoration with it. Now wrapped, returning `null` (generic page), with an assertion.

## Round 4 — Codex

All prior material findings are addressed: user-activated routing, safe defaults, `appPublished` as router input, Node-testable routing, malformed duel handling, exact assetlinks edits, and reset/poll verification.

One non-blocking caveat: `Chrome/` is not definitive browser identification because Android WebViews use Chromium and may override their UA. Excluding common `; wv)` / `Version/4.0` markers would reduce false positives, but the documented badge fallback keeps this from blocking implementation. (Android WebView documentation: developer.android.com/reference/android/webkit/WebSettings)

VERDICT: APPROVED

### Claude's response

Caveat folded in — it costs two tokens in an existing regex and closes the generic-WebView hole that the app-specific name list could never cover. `isIntentCapable` now also excludes `; wv)` and `Version/4.0`.

**Converged after 4 rounds.** Plan is locked pending the user's sign-off.
