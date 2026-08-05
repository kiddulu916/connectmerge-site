# Referral deep-link — setup & launch checklist

How `https://www.connectmerge.app/invite/<code>` turns into an auto-added friend,
what's already in place, and what to flip at launch.

## How it works
1. A player shares `https://www.connectmerge.app/invite/<CODE>` (CODE is 8 chars, `[A-Z2-7]`).
2. **App installed (Android, App Links verified):** Android opens the app directly;
   the in-app `DeepLinkService` redeems the code. The website never loads.
3. **App installed but opened in an in-app browser** (Facebook/Instagram bypass App Links):
   `link.html` loads and `link.js` auto-attempts `connectmerge://invite/<CODE>` +
   shows an "Open in app" button using the same plain scheme.
4. **App NOT installed, intent-capable Android browser:** after launch, one tap on the
   primary CTA opens the app when installed or falls back to Play with
   `referrer=code%3D<CODE>`. On first launch after Google sign-in, the app reads the Play
   Install Referrer and auto-links the friends. Unsupported webviews keep the plain scheme;
   their decorated Play badge remains the manual fallback.

## What's already in place (no action needed)
- `vercel.json` — rewrites `/invite/:code` and `/duel/*` → `/link.html`; CSP; well-known content-types.
- `public/.well-known/assetlinks.json` — Android App Links relation with two SHA-256
  fingerprints; confirm the Play App Signing match in the launch check below.
- `public/.well-known/apple-app-site-association` — hosted for iOS, but still blocked by its placeholder Team ID and the app's missing Associated Domains entitlement.
- `public/link.html` + `public/assets/js/link.js` — the landing page, custom-scheme auto-open,
  one-tap Android intent routing, and Play referrer forwarding for invites.

## Referral routing now in place
`public/assets/js/link.js` validates `^[A-Z2-7]{8}$`, decorates the existing Google Play
badge URL with `referrer=code%3D<CODE>`, and uses that full URL as the encoded fallback in
the user-activated Android intent CTA. Unknown browsers and webviews retain the plain scheme.

## Launch checklist (do these when the app goes live on Play)
1. **Publish the Android app** on the Play Store (the Play badge link must resolve, not 404).
2. In Play Console → Test and release → Setup → App integrity, confirm the App signing key
   certificate SHA-256 matches one of the two fingerprints in `assetlinks.json`.
3. In `public/assets/js/link.js`, flip **`APP_PUBLISHED = true`** to enable the one-tap
   Android intent fallback and restore the primary "Open in app" CTA styling.
4. **iOS (when a listing exists):** replace the "Coming soon" App Store badge in
   `public/link.html` with the real App Store URL, and confirm the App Store link also
   carries the invite (iOS has no install referrer — the code is entered manually in-app).
5. Redeploy to Vercel.

## Verify (after deploy)
```bash
# assetlinks: 200, no redirect, correct package/relation/fingerprints
curl -sS -D - -o al.json 'https://www.connectmerge.app/.well-known/assetlinks.json' | grep -i '^HTTP\|^location'
jq -e '.[] | select(.target.package_name=="com.kidd.connect_merge"
   and (.relation[]=="delegate_permission/common.handle_all_urls"))' al.json

# With APP_PUBLISHED=true, open this URL in an intent-capable Android browser:
#   https://www.connectmerge.app/invite/ABCD2345
#   → one primary-CTA tap opens the installed app or reaches Play with
#     referrer=code%3DABCD2345

# App Links verified on a real device with the RELEASE build installed:
adb shell pm set-app-links --package com.kidd.connect_merge 0 all
adb shell pm verify-app-links --re-verify com.kidd.connect_merge
# the verifier is async; poll, but give up rather than hang if it never settles
for i in $(seq 30); do
  adb shell pm get-app-links com.kidd.connect_merge | grep -q 'www.connectmerge.app: verified' && break
  sleep 2
done
adb shell pm get-app-links com.kidd.connect_merge     # expect www.connectmerge.app: verified

# End-to-end: with the app absent, tap the primary CTA from an /invite link, install from
# the Play internal-testing track, sign in with Google, and confirm the inviter appears
# in Friends automatically. Repeat with the app installed and confirm the tap opens it.
```

## Notes
- `assetlinks.json` / AASA must serve from `www` with **no redirect**. The apex
  `connectmerge.app` 308-redirects to `www`, so always share and verify the `www` URL.
- The Flutter side (Play Install Referrer read + redeem coordinator) is committed in the
  `connect_merge` app repo (`feat(referral): deferred install auto-link…`).
- `assetlinks.json` delegates URL handling only. The `delegate_permission/common.get_login_creds`
  relation (and a self-referential `web` statement carrying only that relation) was removed as
  unused authority — **this assumes the app has no Credential Manager / password-autofill
  integration.** If it does, restore the relation on the `android_app` statement.
