/* Sixty Strong — core logic (no DOM, no storage). Tested by tests/test.html.
   Everything here is a plain function of its inputs so it can be checked in isolation. */
(function(){
"use strict";
const PG = window.SS_PROGRAM;

/* Local calendar date (YYYY-MM-DD). The original artifact used toISOString(),
   which is UTC — an evening workout in Kelowna was stamped with tomorrow's date. */
function isoLocal(d){
  d = d || new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function dateOf(s){ return new Date(s+"T12:00:00"); }

/* Every exercise definition, by name. The same lift can appear in two sessions
   (bench in A and B) — flags are identical there, so first one wins. */
const EX = {};
for (const d of PG.DAYS) for (const g of ["office","pf"]) for (const e of PG.P[d][g]) if (!EX[e.n]) EX[e.n] = e;
function exMeta(name){ return EX[name] || null; }
function isBodyweight(name){ const m = exMeta(name); return !!(m && m.bw); }
function isTimed(name){ const m = exMeta(name); return !!(m && m.time); }

function sorted(history){
  return history.slice().sort((a,b)=>{
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (a.loggedAt||"") < (b.loggedAt||"") ? 1 : -1;
  });
}
function lastFor(history, name){
  for (const w of sorted(history)){
    const f = (w.exercises||[]).find(x=>x.name===name);
    if (f && f.sets && f.sets.length) return {w, e:f};
  }
  return null;
}
function nextDay(history){
  const s = sorted(history);
  if (!s.length) return "A";
  const i = PG.DAYS.indexOf(s[0].day);
  return PG.DAYS[(i+1) % PG.DAYS.length];
}
/* Double progression: every prescribed set reached the top of the range last time. */
function earnedJump(ex, last){
  if (!last || ex.time) return false;
  const done = last.e.sets.filter(x=>x.reps>0);
  if (done.length < ex.s) return false;
  return done.every(x=>x.reps >= ex.hi);
}
function e1rm(w, r){ return r>0 && w>0 ? Math.round(w*(1+r/30)) : 0; }

/* Volume counts external load only. Bodyweight moves (pull-up, dip, chin-up) and
   timed holds are excluded — typing your bodyweight into the weight box on pull-ups was inflating it. */
function setLoad(name, s){
  if (isBodyweight(name) || isTimed(name)) return 0;
  return (s.weight||0) * (s.reps||0);
}
function sessionVolume(w){
  let v = 0;
  for (const e of (w.exercises||[])) for (const s of (e.sets||[])) v += setLoad(e.name, s);
  return Math.round(v);
}
/* What to chart per lift: estimated 1RM for loaded lifts, best reps for bodyweight,
   best seconds for holds. */
function liftScore(name, w){
  const f = (w.exercises||[]).find(x=>x.name===name);
  if (!f || !f.sets.length) return 0;
  if (isTimed(name) || isBodyweight(name)) return Math.max(0, ...f.sets.map(s=>s.reps||0));
  return Math.max(0, ...f.sets.map(s=>e1rm(s.weight, s.reps)));
}
function liftUnit(name){ return isTimed(name) ? "sec" : isBodyweight(name) ? "reps" : "lb e1RM"; }

/* Rest: 2–3 min on the first two lifts, 60–90 s after (The Plan → Rest). */
function restSeconds(exIndex){ return exIndex < 2 ? 150 : 75; }

/* Deload every 7th week, counted from the first logged session. */
function deloadInfo(history, today){
  const s = sorted(history);
  if (!s.length) return {week:0, isDeload:false};
  const first = dateOf(s[s.length-1].date);
  const now = dateOf(isoLocal(today || new Date()));
  const days = Math.round((now - first) / 86400000);
  const week = Math.floor(days/7) + 1;           // week 1 = the first 7 days
  return {week, isDeload: week % 7 === 0};
}

function weekCounts(history, now){
  now = now || new Date();
  const s = sorted(history), wk = [];
  for (let i=11; i>=0; i--){
    const end = dateOf(isoLocal(now)); end.setDate(end.getDate()-i*7);
    const start = new Date(end); start.setDate(start.getDate()-6);
    wk.push(s.filter(w=>{ const d = dateOf(w.date); return d>=start && d<=end; }).length);
  }
  return wk;
}

/* ── validation / backup / import ─────────────────────────── */
function cleanWorkout(o){
  if (!o || typeof o !== "object") return null;
  if (typeof o.id !== "string" || !o.id) return null;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
  if (!PG.DAYS.includes(o.day)) return null;
  if (!Array.isArray(o.exercises)) return null;
  const exercises = [];
  for (const e of o.exercises){
    if (!e || typeof e.name !== "string" || !Array.isArray(e.sets)) continue;
    const sets = e.sets
      .map((s,i)=>({set: Number(s.set)||i+1, weight: Number(s.weight)||0, reps: Number(s.reps)||0}))
      .filter(s=>s.reps>0);
    if (sets.length) exercises.push({name:e.name, sets});
  }
  const w = {
    id:o.id, date:o.date, gym: o.gym==="pf" ? "pf" : "office", day:o.day,
    dayName: typeof o.dayName==="string" ? o.dayName : PG.P[o.day].name,
    notes: typeof o.notes==="string" ? o.notes : "",
    loggedAt: typeof o.loggedAt==="string" ? o.loggedAt : o.date+"T12:00:00.000Z",
    exercises
  };
  w.volume = sessionVolume(w);
  return w;
}
/* Accepts: a Sixty Strong backup {app, workouts:[…], health:[…], profile, targets} (format 1 or 2),
   a bare array of workouts, or a single workout object (the per-document files exported from claude.ai).
   Format-1 backups simply have no health section. */
function parseBackup(text){
  let data;
  try { data = JSON.parse(text); } catch(e){ throw new Error("That file isn't valid JSON."); }
  let list = [], hlist = [];
  if (Array.isArray(data)) list = data;
  else if (data && (Array.isArray(data.workouts) || Array.isArray(data.health))){
    list = Array.isArray(data.workouts) ? data.workouts : [];
    hlist = Array.isArray(data.health) ? data.health : [];
  }
  else if (data && data.id && data.exercises) list = [data];
  else throw new Error("That file doesn't look like a Sixty Strong backup.");
  const good = [], health = []; let bad = 0;
  for (const o of list){ const w = cleanWorkout(o); if (w) good.push(w); else bad++; }
  for (const o of hlist){ const h = cleanHealth(o); if (h) health.push(h); else bad++; }
  const profile = data && !Array.isArray(data) && data.profile && typeof data.profile === "object" ? cleanProfile(data.profile) : null;
  const targets = data && !Array.isArray(data) && data.targets && typeof data.targets === "object" ? cleanTargets(data.targets) : null;
  return {workouts: good, health, profile, targets, rejected: bad};
}
function mergeById(existing, incoming){
  const have = new Set(existing.map(w=>w.id));
  const added = incoming.filter(w=>!have.has(w.id));
  return {merged: existing.concat(added), added: added.length, skipped: incoming.length - added.length};
}
function mergeWorkouts(existing, incoming){ return mergeById(existing, incoming); }
function toBackup(history, now, extra){
  extra = extra || {};
  const b = {
    app: "sixty-strong", format: 2,
    exportedAt: (now||new Date()).toISOString(),
    count: history.length,
    workouts: sorted(history).reverse(),
    health: (extra.health || []).slice().sort((a,b)=>(a.date||"") < (b.date||"") ? -1 : 1)
  };
  if (extra.profile) b.profile = extra.profile;
  if (extra.targets) b.targets = extra.targets;
  return b;
}

/* ── health & longevity ───────────────────────────────────
   One record shape per kind, all with a string id and (except checkups) an ISO date:
   lab     {marker, value, unit, refLow?, refHigh?, source?, note?}
   weight  {lb, note?}
   protein {grams, label?, at?}
   note    {title, body?, status: open|resolved|info}
   checkup {name, marker?, lastDate?, everyMonths, note?}                                   */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = v=>{ const n = Number(v); return isFinite(n) ? n : NaN; };
const str = (v, max)=>typeof v === "string" ? v.slice(0, max||2000) : "";
function cleanHealth(o){
  if (!o || typeof o !== "object" || typeof o.id !== "string" || !o.id) return null;
  const base = {id:o.id, type:o.type};
  if (o.type !== "checkup" && !(typeof o.date === "string" && ISO.test(o.date))) return null;
  if (o.date) base.date = o.date;
  if (o.type === "lab"){
    const v = num(o.value); if (isNaN(v) || !str(o.marker)) return null;
    const r = Object.assign(base, {marker:str(o.marker,40), value:v, unit:str(o.unit,20)});
    if (!isNaN(num(o.refLow)) && o.refLow !== null && o.refLow !== "") r.refLow = num(o.refLow);
    if (!isNaN(num(o.refHigh)) && o.refHigh !== null && o.refHigh !== "") r.refHigh = num(o.refHigh);
    if (o.source) r.source = str(o.source,80);
    if (o.note) r.note = str(o.note);
    return r;
  }
  if (o.type === "weight"){ const v = num(o.lb); if (!(v > 50 && v < 700)) return null; return Object.assign(base, {lb:v}, o.note ? {note:str(o.note)} : {}); }
  if (o.type === "protein"){ const g = num(o.grams); if (!(g > 0 && g < 500)) return null; return Object.assign(base, {grams:g}, o.label ? {label:str(o.label,60)} : {}, o.at ? {at:str(o.at,40)} : {}); }
  if (o.type === "note"){ if (!str(o.title)) return null; return Object.assign(base, {title:str(o.title,120), body:str(o.body), status:["open","resolved","info"].includes(o.status) ? o.status : "info"}); }
  if (o.type === "checkup"){
    const m = num(o.everyMonths); if (!str(o.name) || !(m > 0 && m <= 120)) return null;
    const r = Object.assign(base, {name:str(o.name,80), everyMonths:m});
    if (o.marker) r.marker = str(o.marker,40);
    if (typeof o.lastDate === "string" && ISO.test(o.lastDate)) r.lastDate = o.lastDate;
    if (o.note) r.note = str(o.note);
    return r;
  }
  return null;
}
function cleanProfile(p){
  const out = {};
  if (str(p.name)) out.name = str(p.name,40);
  if (typeof p.birthMonth === "string" && /^\d{4}-\d{2}$/.test(p.birthMonth)) out.birthMonth = p.birthMonth;
  if (Array.isArray(p.goals)) out.goals = p.goals.filter(g=>typeof g === "string").map(g=>g.slice(0,200)).slice(0,12);
  return out;
}
function cleanTargets(t){
  const out = {};
  for (const k of ["caloriesKcal","proteinDailyG","perMealProteinG","netCarbsMaxG","waterL"]) if (num(t[k]) > 0) out[k] = num(t[k]);
  for (const k of ["proteinRangeG","fatRangeG","sleepH"]) if (Array.isArray(t[k]) && t[k].length === 2 && t[k].every(x=>num(x) > 0)) out[k] = t[k].map(Number);
  if (str(t.source)) out.source = str(t.source,200);
  if (Array.isArray(t.rules)) out.rules = t.rules.filter(r=>typeof r === "string").map(r=>r.slice(0,300)).slice(0,12);
  return out;
}
function byType(health, type){ return health.filter(h=>h.type === type); }
function addMonths(iso, m){
  const d = dateOf(iso); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + m);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()));
  return isoLocal(d);
}
function daysBetween(a, b){ return Math.round((dateOf(b) - dateOf(a)) / 86400000); }
function labMarkers(health){ return [...new Set(byType(health,"lab").map(l=>l.marker))]; }
function labSeries(health, marker){ return byType(health,"lab").filter(l=>l.marker === marker).sort((a,b)=>a.date < b.date ? -1 : 1); }
/* Latest vs previous, % change, change per year, and whether it sits inside the lab's own range. */
function labTrend(series){
  if (!series.length) return null;
  const latest = series[series.length-1], prev = series.length > 1 ? series[series.length-2] : null;
  const t = {latest, prev, inRange: null, change: null, pct: null, perYear: null, months: null};
  if (latest.refHigh !== undefined || latest.refLow !== undefined)
    t.inRange = (latest.refLow === undefined || latest.value >= latest.refLow) && (latest.refHigh === undefined || latest.value <= latest.refHigh);
  if (prev){
    const days = daysBetween(prev.date, latest.date);
    t.change = +(latest.value - prev.value).toFixed(2);
    t.pct = prev.value ? Math.round((latest.value - prev.value) / prev.value * 100) : null;
    t.months = Math.round(days / 30.44);
    t.perYear = days > 0 ? +((latest.value - prev.value) / (days / 365.25)).toFixed(2) : null;
  }
  return t;
}
function proteinForDay(health, iso){ return byType(health,"protein").filter(p=>p.date === iso).reduce((a,p)=>a + p.grams, 0); }
function proteinDays(health, n, today){
  const out = [], end = dateOf(isoLocal(today || new Date()));
  for (let i=n-1; i>=0; i--){ const d = new Date(end); d.setDate(d.getDate()-i); const iso = isoLocal(d); out.push({date:iso, grams:proteinForDay(health, iso)}); }
  return out;
}
function weightSeries(health){ return byType(health,"weight").sort((a,b)=>a.date < b.date ? -1 : a.date > b.date ? 1 : 0); }
function weightTrend(health, today){
  const s = weightSeries(health); if (!s.length) return null;
  const latest = s[s.length-1];
  const cutoff = addMonths(isoLocal(today || new Date()), -1);
  const base = s.find(w=>w.date >= cutoff) || s[0];
  return {latest, first:s[0], change30: base === latest ? null : +(latest.lb - base.lb).toFixed(1), total: s.length > 1 ? +(latest.lb - s[0].lb).toFixed(1) : null,
          daysSince: daysBetween(latest.date, isoLocal(today || new Date()))};
}
/* A checkup's last date is its own lastDate or the newest lab result for its marker, whichever is later. */
function checkupStatus(c, health, today){
  const t = isoLocal(today || new Date());
  let last = c.lastDate || null;
  if (c.marker){ const s = labSeries(health, c.marker); if (s.length && (!last || s[s.length-1].date > last)) last = s[s.length-1].date; }
  if (!last) return {last:null, due:null, state:"unknown", days:null};
  const due = addMonths(last, c.everyMonths), days = daysBetween(t, due);
  return {last, due, days, state: days < 0 ? "overdue" : days <= 30 ? "soon" : "ok"};
}
function ageInfo(profile, today){
  if (!profile || !profile.birthMonth) return null;
  const [y, m] = profile.birthMonth.split("-").map(Number), d = today || new Date();
  let age = d.getFullYear() - y; if (d.getMonth()+1 < m) age--;
  const nextBirthdayYear = (d.getMonth()+1 < m) ? d.getFullYear() : (d.getMonth()+1 === m ? d.getFullYear() : d.getFullYear()+1);
  const monthsToNext = (nextBirthdayYear - d.getFullYear())*12 + (m - (d.getMonth()+1));
  return {age, nextAge: d.getMonth()+1 === m ? age : age+1, monthsToNext, birthdayThisMonth: d.getMonth()+1 === m};
}
function sessionsInLastDays(history, n, today){
  const t = isoLocal(today || new Date()), from = (()=>{ const d = dateOf(t); d.setDate(d.getDate()-(n-1)); return isoLocal(d); })();
  return history.filter(w=>w.date >= from && w.date <= t).length;
}

function csvCell(c){ const t = String(c); return /[",\n]/.test(t) ? '"'+t.replace(/"/g,'""')+'"' : t; }
function toCSV(history){
  const rows = [["Date","Gym","Session","Session name","Exercise","Set","Weight (lb)","Reps","Est 1RM","Notes"]];
  for (const w of sorted(history)) for (const e of (w.exercises||[])) for (const s of e.sets)
    rows.push([w.date, PG.GYMS[w.gym].k, w.day, w.dayName||"", e.name, s.set, s.weight, s.reps,
      (isBodyweight(e.name)||isTimed(e.name)) ? "" : e1rm(s.weight, s.reps), w.notes||""]);
  return rows.map(r=>r.map(csvCell).join(",")).join("\n");
}
function newId(d){ return isoLocal(d) + "-" + Math.random().toString(36).slice(2,7); }

window.SSCore = { isoLocal, dateOf, exMeta, isBodyweight, isTimed, sorted, lastFor, nextDay,
  earnedJump, e1rm, setLoad, sessionVolume, liftScore, liftUnit, restSeconds, deloadInfo,
  weekCounts, cleanWorkout, parseBackup, mergeById, mergeWorkouts, toBackup, toCSV, newId,
  cleanHealth, cleanProfile, cleanTargets, byType, addMonths, daysBetween, labMarkers, labSeries, labTrend,
  proteinForDay, proteinDays, weightSeries, weightTrend, checkupStatus, ageInfo, sessionsInLastDays };
})();
