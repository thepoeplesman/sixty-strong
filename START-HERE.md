# Sixty Strong: start here

This is your personal health and training app: your Sixty Strong workouts plus a **Health** tab, all in one place on your phone. It has the same program, the same three tabs and the same lifts, plus:

- **Works with no signal** at the shop gym or Planet Fitness.
- **Nothing is lost** if the app closes mid-workout. Your sets and notes are saved as you go.
- **Rest timer** starts when you tick a set: 2½ min on the first two lifts, 1¼ min after. Tap it to dismiss.
- **Ring and progress bar** fill as you tick sets.
- **Celebration screen** when you log a session, including any **new personal bests**.
- **Delete a session** you logged by mistake: Progress tab → tap the session → Delete.
- **Deload week** is flagged automatically every 7th week.
- **Backup reminder** once a week.

## The Health tab
- **Longevity snapshot:** your age, workouts this week, protein today, your latest weight, your next checkup, and any notes that need follow-up.
- **Protein:** tap +20, +30 or +40 g after each meal. The bar fills toward your daily goal. The 7-day chart shows how the week went.
- **Weigh-ins:** once a week, same morning, before eating. It draws your trend.
- **Lab trends:** each test gets its own chart with the lab's normal range shaded, the change since last time, and whether it's in range. Your past results come in with the import file. Add new results as they arrive; any test works (PSA, cholesterol, A1c, vitamin D…).
- **Checkups:** yearly tests and appointments, with the next due date worked out for you. The app warns you when one is coming up.
- **Health notes:** things to follow up, like symptoms or questions for the doctor, plus useful info. Tap a note to mark it Done. Add new ones by dictating.
- **Daily targets:** calories, protein, carbs, water and sleep. Tap Edit to change them.

None of this is medical advice. It's your own record, to bring to your doctor.

## Where your workouts are kept
**On your phone, inside the app.** That covers your workouts and your health data. None of it is in your Claude account or on the website; the website only holds the empty app.

The trade-off: if you lose the phone and never backed up, the log is gone. So:
- Tap **Back up** when the app reminds you (weekly).
- Choose **Save to Files → iCloud Drive**.
- To move to a new phone, install the app there, go to **Progress → Restore**, and pick the backup file.

## Your two sessions from the Claude version
Both sessions you logged on 28 Sep came across. One is a single set of squats saved 25 minutes before your full workout, which looks like an accidental early save. If you don't want it, delete it: Progress tab → tap it → Delete.

Your volume numbers now leave out bodyweight moves (pull-ups, dips) and planks. Before, typing your bodyweight on pull-ups inflated the total. On those moves, the weight box is now for **added** weight only (a belt or a dumbbell).

## Installing it on your iPhone (once it's online)
1. Open **https://thepoeplesman.github.io/sixty-strong/app/** in **Safari**. It works once you've published it; see README → Publish, about 5 minutes with GitHub Desktop.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Open it from the new orange **60** icon. It runs full-screen like a normal app.
4. Go to **Progress → Restore** and pick `sixty-strong-import.json`. It's in the Files app → iCloud Drive → Desktop → PEOPLES AI TWIN → Personal → Sixty Strong App → backups. This one file brings in your workouts **and** your health data.

## Changing the program
Open this folder in Claude Code and say what you want, for example "swap dips for close-grip bench". The program lives in `app/program.js`.
