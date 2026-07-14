# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

Static marketing + deep-link site for the Connect Merge mobile game (Flutter app, package `com.kiddulu.connect_merge`). Plain HTML/CSS/vanilla JS served from `public/` on Vercel. No build step, no package.json, no tests, no framework.

## Commands

- Local preview: `vercel dev` (or any static server rooted at `public/` — but rewrites only work through Vercel)
- Deploy: push to `main` (Vercel auto-deploys), or `vercel --prod`

## Architecture

Three pages plus a deep-link handler, all sharing one stylesheet (`public/assets/css/site.css`):

- `public/index.html` — landing page with waitlist forms
- `public/link.html` — universal-link landing page. `vercel.json` rewrites `/invite/:code` and `/duel/:path*` to it; inline JS parses `location.pathname` to build a `connectmerge://` deep link and attempt to open the app. Expected duel URL shape: `/duel/<id>/<difficulty>/<score>/<name>` (5 segments).
- `public/privacy-policy.html`, `public/delete-my-data.html` — legal pages

Things that must stay in sync when touching deep links:
1. Rewrite sources in `vercel.json`
2. Path parsing in `link.html`'s inline script
3. `paths` in `public/.well-known/apple-app-site-association` and the Android intent filters covered by `public/.well-known/assetlinks.json`

## Current state / known placeholders

- `APP_PUBLISHED = false` in `link.html` — flip to true at launch to make store chips real links and restore the primary "Open in app" CTA
- `apple-app-site-association` still has `REPLACE_WITH_TEAM_ID` — iOS universal links won't work until the real Apple Team ID is set
- Waitlist forms have no backend; submissions are client-side only (show success message, data goes nowhere)

## Conventions

- `.well-known` files are served with explicit `Content-Type: application/json` headers via `vercel.json` — keep those header rules if editing it
- `link.html` uses `noindex`; the landing page does not
- `.env.local` is gitignored — never commit env files
