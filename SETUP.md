# Household Expense Tracker Setup

## The Hard Truth

You cannot honestly guarantee that any Google Drive API setup will work "forever." Google can change API terms, browser rules can change, and free services can be withdrawn. The durable target is: no paid runtime, no financial data stored unencrypted, no proprietary app-store dependency, and exportable local files.

## Recommended Setup

Use two origins:

- Desktop local origin: `http://localhost:4173`
- Mobile/desktop sync origin: a free HTTPS static site such as GitHub Pages

Google OAuth does not accept a raw LAN IP such as `http://192.168.1.20:4173` as a normal browser origin. For iPhone Drive sync, use an HTTPS origin.

## Google Cloud Setup

1. Go to Google Cloud Console.
2. Create a project named `Household Expense Tracker`.
3. Open **APIs & Services > Library**.
4. Search for **Google Drive API**.
5. Open it and click **Enable**.
6. Open **Google Auth Platform > Branding** or **OAuth consent screen**.
7. Choose **External** unless you are using a Google Workspace account and want internal-only access.
8. Fill in app name, user support email, and developer contact email.
9. Add your own Google account as a test user if the project is in testing mode.
10. Open **Google Auth Platform > Data Access** or scopes.
11. Add this scope:
    - `https://www.googleapis.com/auth/drive.file`
12. Open **Google Auth Platform > Clients**.
13. Click **Create Client**.
14. Choose **Web application**.
15. Name it `Expense Tracker Web`.
16. Add authorized JavaScript origins:
    - `http://localhost:4173`
    - your HTTPS mobile/static origin, for example `https://YOUR_USERNAME.github.io`
17. Click **Create**.
18. Copy the **Client ID**.

You do not need a client secret for this app. Browser JavaScript apps are public clients, so a secret would not be secret.

## Desktop Local Access

1. Open this folder:
   - `C:\Users\A__Mi\Documents\Expense tracker`
2. Start the local server:
   - `C:\Users\A__Mi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe dev-server.js`
3. Open:
   - `http://localhost:4173`
4. Go to **Sync**.
5. Paste the Google OAuth Client ID.
6. Enter an encryption password.
7. Save settings.
8. Click **Sync now**.

Use the same encryption password on every device. If you lose it, encrypted Drive files cannot be recovered.

## Mobile Access

For iPhone Drive sync, host the static files on a free HTTPS static host, then open that HTTPS URL in Safari.

The simplest free path is GitHub Pages:

1. Create a GitHub account if you do not have one.
2. Create a public or private repository named `expense-tracker`.
3. Upload these files and folders:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `manifest.webmanifest`
   - `sw.js`
   - `icons/`
4. Enable **Settings > Pages**.
5. Publish from the main branch root.
6. Wait for GitHub to provide the HTTPS URL.
7. Add that origin to your Google OAuth client authorized JavaScript origins.
8. Open the HTTPS URL in Safari on iPhone.
9. Use Safari's **Add to Home Screen**.
10. Open the app from the home screen.
11. Go to **Sync**, paste the same Client ID, enter the same encryption password, and click **Sync now**.

The app code may be hosted on GitHub, but the financial data remains local and encrypted before being stored in Drive.

## Automatic Sync

The app now runs automatic foreground sync:

- when the app opens;
- when the app comes back into focus;
- when the device reconnects to the internet;
- shortly after a transaction, budget, delete, or CSV import;
- every few minutes while the app is open.

To enable it:

1. Open the app.
2. Enter the tracker password on the unlock screen.
3. If the Google OAuth Client ID is not saved yet, paste it on the unlock screen or in **Sync**.
4. Leave **Automatic foreground sync** enabled.
5. Set the interval, for example `3` minutes.
6. If you want sync after reopening the app without typing the password again, enable **Remember password on this device**.
7. Click **Save settings** if you changed settings in **Sync**.
8. Click **Sync now** once manually to authorize Google.

Important limits:

- iPhone web apps cannot guarantee true closed-app background sync forever.
- Google can require consent again, revoke tokens, expire sessions, or block access if the OAuth project/test-user setup is wrong.
- Silent sync needs the encryption password. If you do not remember the password locally on the device, the app cannot decrypt or upload Drive files after reopening.
- Remembering the password stores it in that device's browser storage. Do this only on trusted devices protected by a lock screen.

After unlock, autosync starts immediately. On devices where the password is remembered, launch itself is enough to unlock and schedule sync.

## Updating The Installed App

The app uses a service worker for offline support. After uploading new files to GitHub Pages, installed mobile/desktop PWAs can temporarily show cached files.

If icons or UI changes do not appear:

1. Open the GitHub Pages URL in the browser.
2. Hard-refresh the page once.
3. On iPhone, if the home-screen app still looks old, remove it and add it to the home screen again.
4. Make sure the uploaded files include the latest `index.html`, `app.js`, `styles.css`, and `sw.js`.

Sync status is visible in the header, sidebar, and **Sync** page:

- Green means the last sync completed successfully and nothing local is waiting.
- Blue means sync is actively running.
- Amber means the app is offline, has never synced, is stale, or has pending local changes.
- Red means the last sync failed. Open **Sync** and read the error card.

## Importing Dummy Data

Use `sample-bank-statement.csv`.

1. Open the app on desktop.
2. Go to **Import**.
3. Choose `sample-bank-statement.csv`.
4. Confirm the column mapping:
   - Date: `Date`
   - Merchant: `Merchant`
   - Description: `Description`
   - Amount: `Amount`
5. Review suggested categories.
6. Click **Approve import**.
7. Go to **Dashboard** and **Analytics** to inspect charts.

## Features

- Manual transaction capture.
- Desktop CSV import.
- Reusable CSV mappings.
- Suggest-then-approve categorisation.
- Local rules that learn from corrections.
- Duplicate detection.
- Colour-coded household category groups.
- Dashboard metrics.
- Category donut chart.
- Stacked monthly spending chart.
- Merchant ranking.
- Recurring expense detection.
- Budget tracking.
- Cutback insights.
- Encrypted Drive sync.
- Automatic foreground sync.
- Offline local cache.
- Encrypted snapshot download/import.

## Maintenance

- Keep a copy of the source folder.
- Keep a copy of the OAuth Client ID.
- Keep the encryption password somewhere safe.
- Export encrypted snapshots periodically from **Sync**.
- Do not delete the `Expense Tracker` folder in Google Drive unless you intentionally want to remove the canonical encrypted store.
