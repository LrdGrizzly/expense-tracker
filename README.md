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

## Important Limits

- CSV import is desktop-focused.
- PDF/OCR, receipt photos, per-person settlement, and local AI summaries are not included in v1.
- Drive is the canonical encrypted storage location, so this is local-first and private-by-encryption, not strictly local-only.
