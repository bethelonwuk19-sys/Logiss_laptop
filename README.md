# LOGISS Field — offline laptop registration app

## What this is

The phone app half of the offline system. Talks to the `api.php`
backend already deployed on logiss.org. Covers everything you asked
for:

- Sign in once (needs internet), then works 100% offline
- **Register Laptop** — search a cached student, fill the form, take up
  to 5 photos with the camera, save locally
- **Movement** — check-in / check-out / return, works even on a laptop
  registered earlier in the same offline session
- **Reports** — file a report against a student
- **CBT Codes** — queue a code-generation request (actual codes are
  generated server-side at sync time, since they must be unique)
- One **Sync** button on the home screen that pushes everything queued,
  in the right order, and shows what's still pending or failed
- **Download existing photos** — a deliberately slow, resumable
  background downloader for the photos already on the server

## Running it

You need [Node.js](https://nodejs.org) and the Expo Go app on your
phone (or an Android/iOS emulator).

```bash
cd logiss-app
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Before you run it

Open `src/api/client.js` and check `API_BASE` points at your real
server:

```js
export const API_BASE = 'https://logiss.org/laptops/api.php';
```

That's the only thing that needs changing to point at your live site —
everything else talks to it automatically.

## How the offline part actually works

- `src/db/db.js` — the local SQLite schema. Every offline action lands
  in a `pending_*` table with a `client_uuid`. Nothing is deleted after
  syncing, rows just flip to `synced`, so the phone keeps a full local
  history too.
- `src/api/sync.js` — the sync engine. Walks each pending table in
  order (entries → movements → reports → observations → CBT) and pushes
  rows one at a time. If a push fails, that row is marked `error` with
  the server's message and retried on the next sync.
- Photos taken during registration are copied into permanent app
  storage (`FileSystem.documentDirectory`) immediately, so an app crash
  or phone restart before syncing never loses them.

## Getting an APK via GitHub (no local Metro/QR code needed)

If `npx expo start` keeps hanging on your machine, skip it entirely —
this repo is set up to build the installable APK on Expo's own cloud
servers, triggered by pushing to GitHub. You never need Metro to work
locally for this path.

**One-time setup (about 10 minutes):**

1. Create a free account at **expo.dev** if you don't have one.
2. On your computer, in this project folder, log in once:
   ```
   npx eas login
   ```
   (This just talks to Expo's servers — it doesn't start Metro, so it
   should work even though `expo start` was hanging.)
3. Link this project to your Expo account:
   ```
   npx eas init
   ```
   This writes a `projectId` into `app.json`. Commit that change.
4. Get a token: go to **expo.dev → your account → Access Tokens** →
   create one → copy it.
5. On GitHub: open this repo → **Settings → Secrets and variables →
   Actions** → **New repository secret** → name it exactly
   `EXPO_TOKEN` → paste the token → save.
6. Push this whole project to a new GitHub repo (create the repo on
   GitHub first, then from this folder):
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

**Every time after that:**

- Just `git push` your changes. GitHub automatically starts the build.
- Go to your repo's **Actions** tab — you'll see "Build Android APK"
  running. It takes roughly 10-20 minutes (Expo's servers, not yours).
- When it finishes (green checkmark), click into that run → scroll to
  **Artifacts** → download **logiss-field-apk** → unzip it → you have
  a real `.apk` file. Transfer it to an Android phone and tap it to
  install (you'll need to allow "install from unknown sources" once).
- You can also trigger a build anytime without pushing new code: go to
  **Actions → Build Android APK → Run workflow**.



- **Movement/Report/CBT history browsing offline** — right now these
  flows create new records; a "past history" list view for each would
  reuse the same `submissions_cache` / pending tables pattern.
  Search Systems parity (browsing by class/brand/status like the web's
  search_registered.php) is a straightforward addition on top of the
  already-cached `submissions_cache` table.
- **Image compression before upload** — you mentioned wanting to build
  this yourself. The hook point is `src/api/sync.js`'s `syncEntries()`,
  right before `apiPostWithPhotos` is called — compress each URI in
  `photos` there before it goes into the FormData.
- **Auto-sync when connectivity returns** — right now sync is manual
  (the button), matching what you described. Adding a background
  listener (`expo-network`'s `addNetworkStateListener`) to trigger sync
  automatically is a small addition if you want it later.
- App icons, splash screen, and a production build (`eas build`) for
  installing outside Expo Go — not set up yet, only needed once you're
  ready to distribute it to staff phones directly.
