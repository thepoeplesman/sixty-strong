/* Sixty Strong — program data.
   Copied verbatim from the original claude.ai artifact (source/artifact-original.html,
   lines 246-370, version 1789409874-a42b). Edit the program HERE; the app reads it at load.
   Exposed as window.SS_PROGRAM so plain <script> tags work without a build step. */
/* ═══ PROGRAM ════════════════════════════════════════════════
   Three sessions in rotation. Each exists in two versions —
   the shop gym (free weights) and Planet Fitness (machines).
   Movement patterns are matched across both so progress on a
   lift carries whichever room you end up in.
   inc = how much to add when you clear the top of the range.  */
const P = {
  A: { name:"Full Body · Press", focus:"Squat, bench, vertical pull",
    office:[
      {n:"Barbell Back Squat", s:3,lo:8, hi:10,inc:10,cue:"Safeties one notch below your bottom. Two ramp sets, then work"},
      {n:"Barbell Bench Press",s:4,lo:6, hi:8, inc:5, cue:"Two ramp sets first. Elbows ~45°, full lockout"},
      {n:"Pull-Up",            s:3,lo:5, hi:8, inc:5, cue:"Band or slow negatives until 8 clean reps", bw:true},
      {n:"DB Romanian Deadlift",s:3,lo:10,hi:12,inc:5,cue:"Push the hips back, bar path close to the legs"},
      {n:"DB Lateral Raise",   s:3,lo:12,hi:15,inc:2.5,cue:"Light. Lead with the elbow, stop at shoulder height"},
      {n:"Dip",                s:2,lo:8, hi:12,inc:5, cue:"Bench dips if the full dip is rough on the shoulder", bw:true},
      {n:"Plank",              s:3,lo:30,hi:45,inc:0, cue:"Ribs down, glutes on", time:true}
    ],
    pf:[
      {n:"Leg Press",          s:3,lo:10,hi:12,inc:10,cue:"Feet mid-platform, stop just short of the back rounding"},
      {n:"Chest Press Machine",s:4,lo:6, hi:8, inc:5, cue:"Seat so the handles sit at mid-chest"},
      {n:"Lat Pulldown",       s:3,lo:8, hi:10,inc:5, cue:"Chest up, pull to the collarbone, no body swing"},
      {n:"Seated Leg Curl",    s:3,lo:10,hi:12,inc:5, cue:"Slow on the way back — that's where hamstrings grow"},
      {n:"Cable Lateral Raise",s:3,lo:12,hi:15,inc:2.5,cue:"One arm at a time, cable behind the body"},
      {n:"Triceps Pushdown",   s:2,lo:10,hi:12,inc:5, cue:"Elbows pinned to the ribs"},
      {n:"Ab Machine",         s:3,lo:12,hi:15,inc:5, cue:"Crunch through the ribs, not the hip flexors"}
    ]},
  B: { name:"Upper Body", focus:"Press, row, arms",
    office:[
      {n:"Barbell Bench Press",s:4,lo:6, hi:8, inc:5, cue:"Same bar as Session A — this is the lift to chase"},
      {n:"Barbell Bent-Over Row",s:4,lo:8,hi:10,inc:5,cue:"Torso ~45°, pull to the belly button, no jerking"},
      {n:"Standing DB Overhead Press",s:3,lo:8,hi:10,inc:5,cue:"Squeeze the glutes, don't lean back"},
      {n:"Chin-Up",            s:3,lo:5, hi:8, inc:5, cue:"Underhand, band assist as needed", bw:true},
      {n:"DB Incline Curl",    s:3,lo:10,hi:12,inc:2.5,cue:"Bench at 45°, full stretch at the bottom"},
      {n:"DB Overhead Triceps Extension",s:3,lo:10,hi:12,inc:5,cue:"One DB, both hands, elbows tight"},
      {n:"DB Rear-Delt Fly",   s:3,lo:12,hi:15,inc:2.5,cue:"Chest on the incline bench, light and strict"}
    ],
    pf:[
      {n:"Smith Incline Press",s:4,lo:6, hi:8, inc:5, cue:"Bench at 30°, bar to the upper chest"},
      {n:"Seated Cable Row",   s:4,lo:8, hi:10,inc:5, cue:"Neutral grip, shoulder blades back and down"},
      {n:"Shoulder Press Machine",s:3,lo:8,hi:10,inc:5,cue:"Handles at ear height at the bottom"},
      {n:"Close-Grip Lat Pulldown",s:3,lo:8,hi:10,inc:5,cue:"V-handle, lean back only slightly"},
      {n:"Cable Curl",         s:3,lo:10,hi:12,inc:5, cue:"Straight bar, elbows still"},
      {n:"Rope Pushdown",      s:3,lo:10,hi:12,inc:5, cue:"Spread the rope at the bottom"},
      {n:"Face Pull",          s:3,lo:12,hi:15,inc:5, cue:"Rope at eye height — this one keeps shoulders healthy"}
    ]},
  C: { name:"Full Body · Pull", focus:"Hinge, single leg, back",
    office:[
      {n:"Barbell Romanian Deadlift",s:4,lo:6,hi:8,inc:10,cue:"Hips back, flat back, stop at mid-shin"},
      {n:"DB Split Squat",     s:3,lo:8, hi:10,inc:5, cue:"Per leg. Back foot on the bench if balance allows"},
      {n:"Incline DB Press",   s:3,lo:8, hi:10,inc:5, cue:"Bench at 30°, DBs stacked over the elbows"},
      {n:"One-Arm DB Row",     s:3,lo:10,hi:12,inc:5, cue:"Per side. Hand on the bench, drive the elbow back"},
      {n:"DB Hammer Curl",     s:3,lo:10,hi:12,inc:2.5,cue:"Neutral grip — easier on the elbows"},
      {n:"Standing Calf Raise",s:3,lo:15,hi:20,inc:10,cue:"Full stretch at the bottom, pause at the top"},
      {n:"Side Plank",         s:3,lo:25,hi:40,inc:0, cue:"Per side", time:true}
    ],
    pf:[
      {n:"Smith Romanian Deadlift",s:4,lo:8,hi:10,inc:10,cue:"Bar close to the legs the whole way down"},
      {n:"Leg Press (feet high)",s:3,lo:10,hi:12,inc:10,cue:"High foot placement loads glutes and hamstrings"},
      {n:"Chest-Supported Row",s:4,lo:10,hi:12,inc:5, cue:"Pad takes the low back out of it entirely"},
      {n:"Pec Deck",           s:3,lo:12,hi:15,inc:5, cue:"Stop when the hands reach the chest line"},
      {n:"Leg Extension",      s:3,lo:12,hi:15,inc:5, cue:"Squeeze one second at the top"},
      {n:"Seated Calf Raise",  s:3,lo:15,hi:20,inc:10,cue:"Slow down, full range"},
      {n:"Cable Woodchop",     s:3,lo:12,hi:12,inc:5, cue:"Per side. High to low, rotate through the ribs"}
    ]}
};
const DAYS=["A","B","C"];
const GYMS={office:{k:"Shop Gym",s:"Barbell · DBs · bar"},pf:{k:"Planet Fitness",s:"Machines · cables"}};

/* ═══ FORM NOTES ═════════════════════════════════════════════
   s = how to set up · d = how to do it · m = what goes wrong  */
const FORM={
"Barbell Back Squat":{s:"Bar across the upper traps, hands just outside the shoulders. Feet shoulder-width, toes turned out maybe 20°. Safeties one notch below your bottom position.",d:"Big breath, brace the midsection. Break at the hips and knees together, down until the thighs are at or just below parallel, drive back up through the middle of the foot.",m:"Knees caving inward, or the heels lifting. Both usually mean the stance is too narrow — widen it before you blame ankle mobility."},
"Barbell Bench Press":{s:"Eyes under the bar. Pinch the shoulder blades back and down into the bench and keep them there. Feet flat, slight natural arch in the low back.",d:"Lower to the lower chest with the elbows about 45° from the torso, touch lightly, press back up over the shoulders.",m:"Flaring the elbows out to 90°. That is the single most common way people wreck a shoulder on this lift."},
"Pull-Up":{s:"Overhand grip just outside shoulder width. Hang with the shoulders pulled down away from the ears before you pull.",d:"Lead with the chest, drive the elbows down toward the ribs, chin over the bar, lower under control.",m:"Shrugging up into the ears. Set the shoulder blades down first — the arms finish the job, they don't start it."},
"Chin-Up":{s:"Underhand grip, about shoulder width.",d:"Pull the chest toward the bar, elbows driving down and back. Full hang at the bottom of every rep.",m:"Half reps. A short chin-up is a worse exercise than an assisted full one."},
"DB Romanian Deadlift":{s:"Dumbbells in front of the thighs, knees softly bent — and they stay at that same bend the whole set. Chest up.",d:"Push the hips straight back, dumbbells sliding down the legs, until you feel a real stretch in the hamstrings — usually mid-shin. Drive the hips forward to stand.",m:"Bending the knees more to reach lower, or rounding the low back. Your hamstring flexibility sets the depth, not the floor."},
"Barbell Romanian Deadlift":{s:"Take the bar out of the rack at hip height rather than lifting it off the floor. Shoulder-width grip, knees soft.",d:"Hips back, bar dragging against the thighs the whole way, stop at mid-shin, drive the hips forward.",m:"Letting the bar drift away from the legs. Every inch forward multiplies the load on your low back."},
"DB Lateral Raise":{s:"Dumbbells at the sides, slight forward lean, small fixed bend in the elbows.",d:"Raise out to the sides to shoulder height, leading with the elbow, then lower slowly.",m:"Going too heavy and swinging. For almost everyone this is a 10–25 lb exercise. If you're heaving it, it isn't working."},
"Dip":{s:"Hands on the bars, arms locked out, chest leaned slightly forward.",d:"Lower until the upper arms are roughly parallel to the floor, then press back up.",m:"Dropping too deep. Depth past parallel puts a lot of stress on the front of the shoulder for no extra benefit."},
"Plank":{s:"Forearms directly under the shoulders, feet hip-width.",d:"Squeeze the glutes, tuck the ribs down toward the hips, hold a straight line from ear to ankle. Breathe normally.",m:"Hips sagging toward the floor, or piked up in the air. If either starts, the set is over — add time next session instead."},
"Side Plank":{s:"Forearm under the shoulder, feet stacked or staggered.",d:"Drive the hips up, straight line head to heels, ribs tucked.",m:"Hips drifting forward or sagging down. Both let you hold it longer without training anything."},
"Barbell Bent-Over Row":{s:"Hinge to about 45°, flat back, bar hanging at arm's length, grip just outside the knees.",d:"Pull the bar to the belly button, elbows back past the ribs, brief pause, lower under control.",m:"Standing up as the set gets hard. If the torso angle changes, the set's done — the low back is now doing the work."},
"Standing DB Overhead Press":{s:"Dumbbells at shoulder height, palms forward. Glutes and abs tight before the first rep.",d:"Press overhead until the arms lock, upper arms finishing near the ears. Lower under control to shoulder height.",m:"Leaning back to get the weight up. That turns it into a standing incline press and loads the low back."},
"DB Incline Curl":{s:"Bench at 45°, sit back, let the arms hang straight down behind the line of the body.",d:"Curl without moving the elbows, squeeze at the top, lower slowly to a full stretch.",m:"Letting the elbows drift forward. The stretched starting position is the entire reason for this variation."},
"DB Overhead Triceps Extension":{s:"One dumbbell held with both hands, arms locked overhead, elbows close to the head.",d:"Lower behind the head with the elbows staying put, then extend back up.",m:"Elbows flaring out wide, which hands the work to the shoulders."},
"DB Rear-Delt Fly":{s:"Chest on an incline bench set to 30–45°, dumbbells hanging straight down.",d:"Raise out to the sides with a slight elbow bend, light squeeze of the shoulder blades at the top.",m:"Shrugging and using the traps. Keep it light — this one is about position, not load."},
"DB Split Squat":{s:"One foot forward, the other 2–3 feet back, or up on a bench. Dumbbells at the sides.",d:"Drop straight down until the back knee is just off the floor, then drive up through the front heel.",m:"Leaning forward and pushing off the back foot. The back leg is for balance, the front leg does the work."},
"Incline DB Press":{s:"Bench at 30°. Dumbbells at the outside of the shoulders, wrists stacked over the elbows.",d:"Press up and slightly inward, lower under control to a stretch at chest level.",m:"Setting the bench too steep. Past 45° it becomes a shoulder press and the upper chest stops working."},
"One-Arm DB Row":{s:"Opposite hand and knee on the bench, back flat and roughly parallel to the floor.",d:"Pull the dumbbell to the hip with the elbow tight to the body, lower to a full stretch.",m:"Twisting the torso to get the last reps. Drop the weight and keep the shoulders square."},
"DB Hammer Curl":{s:"Dumbbells at the sides, palms facing each other.",d:"Curl without rotating the wrists, elbows pinned to the ribs.",m:"Swinging the body. If the hips are moving, it's too heavy."},
"Standing Calf Raise":{s:"Balls of the feet on a step or a plate, heels hanging free.",d:"Drop the heels for a full stretch, pause a beat, rise all the way up, pause again.",m:"Bouncing. The pause at both ends is the exercise — without it you're just using the Achilles like a spring."},
"Leg Press":{s:"Back and hips flat against the pad. Feet mid-platform, shoulder-width.",d:"Lower until the knees are around 90°, press back up without slamming the knees into lockout.",m:"Going so deep the tailbone rolls off the pad. That is how people hurt their low back on a machine."},
"Leg Press (feet high)":{s:"Same setup, feet placed high on the platform. Back and hips flat.",d:"Lower to about 90° at the knee, drive through the heels. The high placement shifts the work to glutes and hamstrings.",m:"Same tailbone lift. Stop the descent the instant the hips want to curl under."},
"Chest Press Machine":{s:"Set the seat so the handles sit at mid-chest height. Shoulder blades back against the pad.",d:"Press out, stop just short of locking the elbows, return to a light stretch.",m:"Seat set too low, which raises the handles and turns it into a shoulder press."},
"Lat Pulldown":{s:"Thigh pad snug so you don't lift off. Grip slightly wider than the shoulders.",d:"Chest up, pull the bar to the collarbone with the elbows driving down, control it back to a full stretch.",m:"Leaning way back and heaving. A slight lean is fine; a rowing motion means the weight is too heavy."},
"Close-Grip Lat Pulldown":{s:"V-handle, sit tall, thigh pad snug.",d:"Pull to the upper chest, elbows down and back, full stretch at the top.",m:"Same as the wide pulldown — no heaving with the torso."},
"Seated Leg Curl":{s:"Line your knee joint up with the machine's pivot point. Pad across the lower shins.",d:"Curl as far as the machine goes, then take two to three seconds to return.",m:"Rushing the return. The lowering half is where hamstrings actually grow."},
"Cable Lateral Raise":{s:"Cable at the lowest setting. Stand side-on to the stack, handle in the far hand, cable crossing in front of the body.",d:"Raise out and up to shoulder height, lower slowly against the cable's pull.",m:"Shrugging the shoulder up. Keep the neck long and the trap quiet."},
"Triceps Pushdown":{s:"Elbows pinned to the ribs, slight forward lean, feet staggered.",d:"Extend down to lockout, squeeze, return only to about 90° at the elbow.",m:"Elbows travelling forward and back, which brings the shoulders and chest into it."},
"Rope Pushdown":{s:"Rope at the high pulley, elbows tight to the sides.",d:"Push down and spread the two ends of the rope apart at the bottom.",m:"Leaning over the stack and using bodyweight to drive it down."},
"Ab Machine":{s:"Adjust so the pads sit comfortably on the chest or shoulders.",d:"Crunch by shortening the distance between the ribs and the hips, then return slowly.",m:"Pulling with the arms instead of the abs."},
"Smith Incline Press":{s:"Bench at 30°, positioned so the fixed bar path lines up over your upper chest.",d:"Unrack, lower to the upper chest, press back to just short of lockout.",m:"Bench placed wrong so the bar tracks toward the throat or the belly. Move the bench, don't twist your body to fit it."},
"Smith Romanian Deadlift":{s:"Bar at hip height, feet directly under the bar, knees soft.",d:"Hips back, bar tracking close against the legs, stop at mid-shin, drive the hips forward.",m:"Feet set too far forward. The bar path is fixed, so if your feet are wrong the low back pays for it every rep."},
"Seated Cable Row":{s:"Feet on the platform, knees slightly bent, sit tall.",d:"Pull the handle to the belly, shoulder blades back and down, return to a full stretch without letting the low back round.",m:"Rocking the torso back and forth. Keep the chest still and let the arms and back move."},
"Chest-Supported Row":{s:"Chest on the pad, adjust the seat so you can reach the handles at full stretch.",d:"Row to the ribs, squeeze, let the arms extend fully at the bottom.",m:"Pulling the chest off the pad. The pad taking the low back out of it is the whole reason to use this machine."},
"Shoulder Press Machine":{s:"Set the seat so the handles start at roughly ear height.",d:"Press overhead, stop just short of lockout, lower under control.",m:"Starting too low, which grinds the shoulder joint at the bottom of every rep."},
"Cable Curl":{s:"Straight bar on the low pulley, elbows at the sides, stand a step back for constant tension.",d:"Curl up, squeeze, lower slowly.",m:"Elbows drifting forward, which lets the front delts take over."},
"Face Pull":{s:"Rope at eye height. Step back until there's tension at arm's length. Thumbs pointing back.",d:"Pull toward the face with the hands separating and the elbows staying high.",m:"Pulling to the chest instead of the face. This exercise exists for shoulder health — do it right or skip it."},
"Pec Deck":{s:"Seat so the handles sit at chest height, slight fixed bend in the elbows.",d:"Bring the hands together, squeeze, open slowly to a stretch.",m:"Letting the arms travel too far back at the stretch. Stop where the chest is loaded, not where the shoulder complains."},
"Leg Extension":{s:"Knee at the machine's pivot, pad across the lower shins.",d:"Extend to straight, pause one second at the top, lower slowly.",m:"Kicking up with momentum and letting the stack slam down."},
"Seated Calf Raise":{s:"Balls of the feet on the platform, pad across the lower thighs.",d:"Full stretch down, full rise up, pause at both ends.",m:"Bouncing through the range."},
"Cable Woodchop":{s:"Cable set high. Stand side-on, feet planted shoulder-width.",d:"Pull down and across the body, rotating through the ribs while the hips stay relatively still.",m:"Turning the feet and hips, which makes it an arm exercise instead of a core one."}
};
function watchUrl(n){return"https://www.youtube.com/results?search_query="+encodeURIComponent(n.replace(/\s*\(.*\)/,"")+" proper form technique")}

const PRINCIPLES=[
  ["Warm up","5 minutes easy cardio, then two ramp sets on the first lift only — about 50% and 75% of your working weight. Cold joints at 60 is where injuries come from, not heavy weight."],
  ["How hard","Stop every working set with 1–2 reps still in the tank. You should finish each session feeling like you could have done one more set, not wrecked. Grinding to failure buys very little muscle and costs a lot of recovery."],
  ["Progression","Double progression. Stay at the same weight until you hit the TOP of the rep range on every set. Then add the increment and drop back to the bottom of the range. The app flags it when you've earned the jump."],
  ["Rest","2–3 minutes on the first two lifts. 60–90 seconds on everything after. Don't rush the big ones — the rest is what lets you add weight."],
  ["Spacing","One full day off between sessions. Mon / Wed / Fri or Tue / Thu / Sat. Three quality sessions beat five rushed ones."],
  ["Deload","Every 7th week, run the same sessions at about 60% weight and two sets each. Not optional — it's what lets the next block go up."],
  ["Protein","Roughly 1 gram per pound of bodyweight per day, and at least 35–40 g in one sitting. Muscle at 60 is harder to signal than it was at 40 — the dose per meal matters more than the daily total."],
  ["What to track","Weight and reps, every set. That's it. The progress tab does the rest. If a number doesn't move for three sessions, change the exercise before you change the program."]
];

window.SS_PROGRAM={P:P,DAYS:DAYS,GYMS:GYMS,FORM:FORM,PRINCIPLES:PRINCIPLES,watchUrl:watchUrl};
