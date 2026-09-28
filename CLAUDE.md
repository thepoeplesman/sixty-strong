# Sixty Strong — project rules for Claude

Darryl's personal health, strength and longevity PWA. The Training tabs hold workouts; the Health tab holds lab trends, weigh-ins, protein, checkups, notes and targets. All of it is personal health data: keep it in this folder and never copy it into business workspaces (e.g. `Business/` in PEOPLES AI TWIN, including Executive OS). Darryl isn't highly technical, dictates by voice, and wants complete, working changes explained in plain language.

## Data safety rule (most important)
- Workout and health data live **only on Darryl's phone** (IndexedDB `sixty-strong` v2: stores `workouts`, `health`, `meta`). This folder never holds his live log, only `backups/` files he chooses to put here.
- **Never change the shape of saved records in a way old records can't read.** New fields must be optional, and `SSCore.cleanWorkout` must keep accepting the old format. If a migration is truly needed, write it in `store.js` as an additive upgrade (bump `DB_VER`, never drop stores) and test it with `backups/sixty-strong-import.json`.
- **Never publish personal data.** `backups/` and `source/data-export/` stay git-ignored. Never hard-code lab values, weights, ages/birthdates, doctor names, health-card numbers or symptoms into `app/`, `tests/` or docs. Tests use synthetic values. The repo may be public (GitHub Pages).
- **The site address is part of the data.** Moving the app to a new URL strands the phone's data. Warn Darryl and have him back up first.
- The original claude.ai artifact (S5S4u8qkMjN4ESyvLWHDH1) and its database are **read-only** to us. Never write to them.

- Private, machine-only notes (where the health source files are, what to exclude) are in `CLAUDE.local.md` (git-ignored). Read it before touching health data.

## Where things are
- The program (exercises, ranges, form notes) is in `app/program.js`, copied verbatim from the artifact. Change the program there.
- Logic is in `app/core.js` (pure, tested); storage in `app/store.js`; UI in `app/app.js` and `app/health.js`; styles in `app/styles.css` (the "Iron & Ember" design tokens are at the top).
- Tests: `tests/test.html`, 30 checks. Add a test for any logic change.

## Every change
1. Bump `CACHE` in `app/sw.js` and `APP_VERSION` in `app/app.js`. Otherwise phones keep the old cached version.
2. Serve locally: `python3 -m http.server 8766 --bind 127.0.0.1 --directory "$HOME/Desktop/PEOPLES AI TWIN/Personal/Sixty Strong App"` (or `.claude/launch.json` "sixty-strong"). Open `http://127.0.0.1:8766/tests/test.html`; the title must read PASS. Then check `/app/` at 375 px width in both light and dark mode.
3. Deploy: commit and push to the GitHub Pages repo (see README "Publish"). Only when Darryl asks. The first push needs his repo, and there must be no credentials in chat.

## Tooling on this Mac
python3 (stdlib only, no PIL) and git. There is no node/npm/brew/gh and no full Xcode. Keep the app build-free: plain HTML/CSS/JS, no frameworks, no CDNs except Google Fonts (cached offline by the service worker).
