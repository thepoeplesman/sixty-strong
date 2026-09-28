# Sixty Strong: inventory of the original artifact

Captured 2026-09-28. The capture was read-only: nothing on claude.ai was changed.

| Item | Value |
|---|---|
| Artifact | https://claude.ai/artifact/S5S4u8qkMjN4ESyvLWHDH1 (owner: Darryl, private, pinned) |
| Version captured | 1789409874-a42b (last published 2026-09-14) |
| Saved copy | `source/artifact-original.html` (56,852 bytes; sha256 `95bb0804…1572016`) |
| Published supporting files | None (single page) |
| Declared capabilities | `db` (shared database), `downloads` (CSV save) |
| Claude AI features used | **None.** There is no `sample` capability and no Claude calls, so nothing AI-dependent is lost by moving off claude.ai. |
| External resources | Google Fonts (Barlow, Barlow Condensed, IBM Plex Mono); YouTube search links; exrx.net and precisionnutrition.com links |
| Related chat-side context | A claude.ai Project holds `claude/training-program.md`, a reference copy of the same program and its inputs (schedule, equipment). The Cowork task "Full body weight lifting program" (2026-09-14) is where the artifact was built. Neither was re-read in detail, because the artifact and the doc already hold the program. |

## Features and screens
1. **Session tab**
   - Pick where you're training: Shop Gym (barbell/DBs) or Planet Fitness (machines).
   - Pick a session: A, B or C. "Up next" follows the rotation A → B → C.
   - Each exercise card shows:
     - the cue and the target (sets × rep range)
     - your last result
     - an "↑ Add N lb" flag when every set hit the top of the range last time (double progression)
     - a "How to do it" panel (setup / the rep / what goes wrong) and a "Watch it" YouTube search link
     - a weight + reps input per set, and a tick button that fills in last time's numbers
   - Timed holds (planks) take seconds instead of reps.
   - A notes box, and a dock showing live session volume with a **Log session** button.
2. **Progress tab**
   - Tiles: sessions, week streak, total lifted.
   - Sessions per week over the last 12 weeks.
   - Volume for the last 8 sessions.
   - A per-lift estimated 1RM trend (Epley formula: w × (1 + r/30)) with a sparkline and the change since the start.
   - A log of the last 14 sessions.
3. **The Plan tab**
   - 8 principles: warm-up, effort, progression, rest, spacing, deload, protein, tracking.
   - Both gym versions of A/B/C.
   - Notes on the two rooms, squat safeties and bailing, and video references.
4. **CSV export** (only works where claude.ai grants `downloads`).

## Program data (hard-coded in the page)
- `P[A|B|C][office|pf]`: 7 exercises each. Each exercise has name, sets, rep range (lo/hi), increment in lb, cue, and optional `bw` (bodyweight) and `time` (timed hold) flags.
- `FORM`: setup / rep / mistake text for 39 exercises.
- `PRINCIPLES`: 8 rules.

## Data model: collection `workouts`, one document per logged session
```json
{ "id": "YYYY-MM-DD-xxxxx", "date": "YYYY-MM-DD", "gym": "office|pf", "day": "A|B|C",
  "dayName": "…", "notes": "…", "loggedAt": "ISO timestamp", "volume": 0,
  "exercises": [ { "name": "Barbell Back Squat", "sets": [ { "set": 1, "weight": 0, "reps": 0 } ] } ] }
```
- The page also keeps a copy in the browser's `localStorage` under the key `sixtystrong.v1`.
- On load it merges the cloud copy with the local copy by `id`.

## Exported data
The live `workouts` collection was exported read-only to `source/data-export/` (2 sessions). The details are in `source/data-export/NOTES.md`. **That folder is git-ignored and never published.**

## Depends on claude.ai, and what breaks outside it
| Feature | Dependency | Outside claude.ai |
|---|---|---|
| Cloud sync "on any device" | `window.claude.use("db")`: the artifact database, signed in to Darryl's Claude account | **Breaks.** Replaced with on-phone storage plus backup/restore files. |
| CSV export | `window.claude.use("downloads")` | Breaks. Replaced with the phone's own share/save sheet. |
| Local save | `localStorage` | Works, but iOS can clear it. Replaced with IndexedDB, with persistent storage requested. |
| Fonts | Google Fonts CDN | Works online. Bundled system-font fallback offline. |
| Everything else (program, logic, progress charts) | Plain JavaScript | Works. |

## Known quirks in the original (fixed or handled in the new app)
- You can't delete or edit a logged session.
- Bodyweight moves count bodyweight × reps as "volume" if you type your weight.
- There's no rest timer, deload-week reminder or backup reminder.
- An unsaved session is lost if the page reloads (the draft lives only in memory).
- Sessions are dated in UTC (`toISOString`), so a workout after about 5 pm in Kelowna gets tomorrow's date. The new app uses the local date.
- "How to do it" relied on the claude.ai frame's `[hidden]` style. Outside the frame, every panel would have opened at once. Fixed in the new app's stylesheet.
