# Referral deep-link — setup & launch checklist

How `https://www.connectmerge.app/invite/<code>` turns into an auto-added friend,
what's already in place, and what to flip at launch.

## How it works
1. A player shares `https://www.connectmerge.app/invite/<CODE>` (CODE is 8 chars, `[A-Z2-7]`).
2. **App installed (Android, App Links verified):** Android opens the app directly;
   the in-app `DeepLinkService` redeems the code. The website never loads.
3. **App installed but opened in an in-app browser** (Facebook/Instagram bypass App Links):
   `link.html` loads and `link.js` auto-attempts `connectmerge://invite/<CODE>` +
   shows an "Open in app" button.
4. **App NOT installed:** `link.js` appends the code to the Play badge as an install
   referrer → `…?id=com.kidd.connect_merge&referrer=code%3D<CODE>`. On first launch
   after Google sign-in, the app reads the Play Install Referrer and auto-links the friends.

## What's already in place (no action needed)
- `vercel.json` — rewrites `/invite/:code` and `/duel/*` → `/link.html`; CSP; well-known content-types.
- `public/.well-known/assetlinks.json` — real Play App Signing + upload cert SHA-256 fingerprints (Android App Links).
- `public/.well-known/apple-app-site-association` — iOS Associated Domains.
- `public/link.html` + `public/assets/js/link.js` — the landing page, custom-scheme auto-open, and (new) Play referrer forwarding for invites.

## The one referral change (already made)
`public/assets/js/link.js`, invite branch: validates `^[A-Z2-7]{8}$` and appends
`&referrer=code%3D<code>` to the Google Play badge so the code survives a fresh install.

## Launch checklist (do these when the app goes live on Play)
1. **Publish the Android app** on the Play Store (the Play badge link must resolve, not 404).
2. In `public/assets/js/link.js`, flip **`APP_PUBLISHED = true`** to restore the primary
   "Open in app" CTA styling.
3. **iOS (when a listing exists):** replace the "Coming soon" App Store badge in
   `public/link.html` with the real App Store URL, and confirm the App Store link also
   carries the invite (iOS has no install referrer — the code is entered manually in-app).
4. Redeploy to Vercel.

## Verify (after deploy)
```bash
# assetlinks: 200, no redirect, correct package/relation/fingerprints
curl -sS -D - -o al.json 'https://www.connectmerge.app/.well-known/assetlinks.json' | grep -i '^HTTP\|^location'
jq -e '.[] | select(.target.package_name=="com.kidd.connect_merge"
   and (.relation[]=="delegate_permission/common.handle_all_urls"))' al.json

# landing carries the referrer + custom scheme (open the URL in a mobile browser / devtools):
#   https://www.connectmerge.app/invite/ABCD2345
#   → the "Get it on Google Play" link should end with  referrer=code%3DABCD2345

# App Links verified on a real device with the RELEASE build installed:
adb shell pm verify-app-links --re-verify com.kidd.connect_merge
adb shell pm get-app-links com.kidd.connect_merge     # expect www.connectmerge.app: verified

# End-to-end: install from an /invite link via Play internal-testing track, sign in with
# Google, and confirm the inviter appears in Friends automatically.
```

## Notes
- `assetlinks.json` / AASA must serve from `www` with **no redirect**. The apex
  `connectmerge.app` 308-redirects to `www`, so always share and verify the `www` URL.
- The Flutter side (Play Install Referrer read + redeem coordinator) is committed in the
  `connect_merge` app repo (`feat(referral): deferred install auto-link…`).
