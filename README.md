# Sixty Strong

A personal health, strength and longevity app for iPhone. It has two parts:
- **Training:** a 3-day A/B/C rotation with shop-gym and Planet Fitness versions, double-progression cues, form notes and progress charts.
- **Health:** lab trends, weigh-ins, a daily protein counter, checkup reminders, health notes and nutrition targets.

It also does backup and restore. It's an installable web app (PWA): plain HTML/CSS/JS, no build step and no server-side code. It works offline, and **all workout data stays on the device.**

It was ported from the claude.ai artifact https://claude.ai/artifact/S5S4u8qkMjN4ESyvLWHDH1. See `source/INVENTORY.md` for what the original did and what changed.

## Layout
| Path | What |
|---|---|
| `app/` | **The app.** This is what gets published. |
| `app/program.js` | The program: sessions, exercises, rep ranges, form notes and principles. Edit here. |
| `app/core.js` | Pure logic: progression, volume, PRs, deload, backup/CSV/merge. |
| `app/store.js` | On-device storage (IndexedDB, with a localStorage fallback). |
| `app/app.js` | UI for training, progress, plan, backup/restore. |
| `app/health.js` | Health tab UI (no personal data in this file; values arrive from the private import/backup). |
| `app/sw.js` | Offline service worker. **Bump `CACHE` on every change.** |
| `index.html` | Redirects the site root to `app/`. |
| `tests/test.html` | 30 logic tests (training + health), with synthetic data only. Open in a browser and the title shows PASS/FAIL. |
| `tools/make_icons.py` | Regenerates the home-screen icons (stdlib Python only). |
| `source/` | Original artifact HTML, the read-only data export and the inventory. |
| `backups/` | `sixty-strong-import.json`: Darryl's workouts and health data. **Git-ignored, never published.** |

## Run it on the Mac
```bash
python3 -m http.server 8766 --bind 127.0.0.1 --directory "$HOME/Desktop/PEOPLES AI TWIN/Personal/Sixty Strong App"
```
Then open http://127.0.0.1:8766/app/ (the tests are at http://127.0.0.1:8766/tests/test.html). On first run on the Mac, the app imports `backups/sixty-strong-import.json` automatically. On the published site that file doesn't exist; use Progress → Restore instead.

## Publish (GitHub Pages)
**Published 2026-09-28** at **https://thepoeplesman.github.io/sixty-strong/app/**
- Repo: https://github.com/thepoeplesman/sixty-strong (public; contains no workout or health data).
- Pages: deploys from `main`, `/ (root)`. The site root redirects to `app/`.
- On the iPhone: open the address in **Safari** → Share → **Add to Home Screen** → then Progress → Restore with `backups/sixty-strong-import.json`.

**Updating later:**
1. Change the files. Bump `CACHE` in `app/sw.js` and `APP_VERSION` in `app/app.js`.
2. Commit locally.
3. Get the change onto GitHub. There's no command-line GitHub login on this Mac, so either:
   - Claude uploads the changed files through the GitHub website in Darryl's signed-in Chrome, then runs `git fetch` and `git reset --soft origin/main` so the local copy matches again; or
   - GitHub Desktop pushes it.
4. Phones show an "Update ready" banner; tapping Reload switches to the new version. Their data is kept.

## Backup and data safety
- **Health data is never in the code or the repo.** It exists in two places only: the private `backups/` import file on the Mac/iCloud, and the phone's own storage.
- The data lives in IndexedDB database `sixty-strong` (stores `workouts`, `health`, `meta`; version 2) in Safari's storage for the site. A home-screen web app keeps its storage; the app also requests persistent storage.
- **Back up** writes `sixty-strong-backup-YYYY-MM-DD.json` through the iOS share sheet. Choose Save to Files → iCloud Drive.
- **Restore** merges by session id. It never duplicates and never deletes.
- **Changing the site address loses access to the data.** Data belongs to the web address (origin), so back up first and restore on the new address.
- Export CSV gives one row per set, for a spreadsheet.

## Verified (2026-09-28, local, 375 px phone viewport)
- 30/30 logic tests pass (18 training + 12 health).
- Upgrading the database from version 1 to 2 kept both workouts and added health storage. The private file imported 6 health entries. Restore with health data works; restoring twice adds nothing.
- The Health tab works offline and at 375 px, in light and dark mode.
- First-run import brought over both claude.ai sessions and correctly offers Session B as up next.
- An unfinished workout (ticks, weights, reps, notes) survives a reload.
- The app loads and works with the server stopped (offline via the service worker).
- Logging, deleting and restoring a session work. Restoring the same backup twice adds nothing. A corrupt file gives a clear error.
- No horizontal scrolling at 375 px. Checked in both light and dark mode. No console errors.
- **Not yet tested on a real iPhone.** Share-sheet saving and the home-screen install can only be checked on the device.
