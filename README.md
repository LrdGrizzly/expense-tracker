# Household Expense Tracker

Local-first household expense tracker with encrypted Google Drive sync.

## What Is Implemented

- Mobile/desktop PWA shell.
- IndexedDB local cache.
- Encrypted append-only sync changes and snapshots.
- Google Drive OAuth/REST sync wiring.
- Automatic foreground sync on open, focus, reconnect, interval, and after local changes.
- Desktop CSV import with reusable mappings and suggest-then-approve categorisation.
- Local categorisation rules that learn from corrections.
- Colour-coded category groups and subcategories.
- Dashboard, analytics charts, budgets, transactions, insights, and mobile quick-add flow.

## Running Locally

Because this is a PWA and Google OAuth requires a web origin, serve the folder over HTTP/HTTPS rather than opening `index.html` directly.

With any static server available, serve this directory and open the local URL in Edge/Chrome/Safari.

## Google Drive Setup

1. Create a Google Cloud project.
2. Enable Google Drive API.
3. Create an OAuth client for a web application.
4. Add your local app URL as an authorized JavaScript origin.
5. Paste the OAuth client ID into `Sync > Google Drive client ID`.

The app uses the `drive.file` scope and encrypts ledger/sync files before upload. The encryption password is never sent to Google.

## Automatic Sync Limit

The app can sync automatically while open or resumed. A browser PWA on iOS cannot guarantee perpetual silent background sync while fully closed, and Google OAuth can still require re-consent. For silent sync after reopening, enable **Remember password on this device** in the Sync page on trusted devices only.

The app now starts with an unlock screen. The password entered there is the same password used to decrypt Drive data and perform sync. After unlock, autosync starts immediately. If **Remember password on this device** is enabled, trusted devices unlock and start syncing automatically on launch.

The sync indicator appears in the page header, sidebar, and Sync page:

- Green: latest sync completed and there are no local pending changes.
- Blue: sync is currently running.
- Amber: offline, never synced, stale, or local changes are waiting to upload.
- Red: the last sync attempt failed. Open **Sync** to read the error and run **Sync now** after fixing it.

If icons or UI updates do not appear after deployment, hard-refresh once or remove/re-add the home-screen app. The service worker cache version is bumped, and assets use versioned URLs, but old installed PWAs can show cached files until the next update cycle.

## Important Limits

- CSV import is desktop-focused.
- PDF/OCR, receipt photos, per-person settlement, and local AI summaries are not included in v1.
- Drive is the canonical encrypted storage location, so this is local-first and private-by-encryption, not strictly local-only.
