/* Sixty Strong — the phone app UI.
   Ported from the claude.ai artifact (source/artifact-original.html). Same program, same screens;
   storage moved to the phone (IndexedDB) and a few gaps closed: drafts survive a reload, sessions
   can be deleted, rest timer, backup/restore, deload + backup reminders, offline via service worker. */
(function(){
"use strict";
const PG = window.SS_PROGRAM, C = window.SSCore, S = window.SSStore, H = window.SSHealth;
const APP_VERSION = "1.2.4";
const SEED_URL = "../backups/sixty-strong-import.json";   // only exists on the Mac copy, never online

let history = [], gym = "office", day = "A";
let drafts = {};            // { "office|A": { sets:{ "Barbell Back Squat":[{weight,reps,done}] }, notes:"" } }
let meta = {};              // lastBackupAt, installHintDismissed, …
let rest = null, restTimer = null, audio = null, swReg = null, updateReady = false;
let openLog = null;         // id of the expanded session-log row

const $ = s=>document.querySelector(s);
const el = (t,c)=>{ const e = document.createElement(t); if (c) e.className = c; return e; };
const esc = s=>String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n=>Number(n).toLocaleString("en-CA");
const shortDate = s=>C.dateOf(s).toLocaleDateString("en-CA",{month:"short",day:"numeric"});
const idOf = k=>k.replace(/[^a-z0-9]/gi,"");

/* ═══ DRAFT (the session you're in the middle of) ═══════════ */
function draftKey(){ return gym+"|"+day; }
function curDraft(){ const k = draftKey(); drafts[k] = drafts[k] || {sets:{}, notes:""}; return drafts[k]; }
let saveT = null;
function saveDraftSoon(){
  clearTimeout(saveT);
  saveT = setTimeout(()=>{ S.setMeta("draft", {gym, day, drafts}).catch(()=>{}); }, 250);
}
function curList(){ return PG.P[day][gym]; }

/* ═══ SESSION VIEW ═══════════════════════════════════════════ */
function renderControls(){
  const g = $("#seg-gym"); g.innerHTML = "";
  for (const k of ["office","pf"]){
    const b = el("button"); b.type = "button"; b.setAttribute("aria-pressed", String(gym===k));
    b.innerHTML = '<span class="k">'+PG.GYMS[k].k+'</span><span class="s">'+PG.GYMS[k].s+'</span>';
    b.onclick = ()=>{ gym = k; saveDraftSoon(); render(); };
    g.appendChild(b);
  }
  const d = $("#seg-day"); d.innerHTML = "";
  for (const k of PG.DAYS){
    const b = el("button"); b.type = "button"; b.setAttribute("aria-pressed", String(day===k));
    b.innerHTML = '<span class="k">'+k+'</span><span class="s">'+esc(PG.P[k].name.replace("Full Body · ","FB · "))+'</span>';
    b.onclick = ()=>{ day = k; saveDraftSoon(); render(); };
    d.appendChild(b);
  }
  const nd = C.nextDay(history), dl = C.deloadInfo(history);
  $("#next-pill").innerHTML = (history.length ? 'Up next &middot; <b>Session '+nd+'</b>' : 'Start here &middot; <b>Session A</b>')
    + (dl.isDeload ? ' &middot; <b>Deload week</b>' : '');
  $("#block-tag").textContent = dl.week ? "Block "+Math.ceil(dl.week/7)+" · Week "+(((dl.week-1)%7)+1) : "3-day rotation";
  $("#notes").value = curDraft().notes || "";
  renderHero();
}

/* Hero card: session letter, what it trains, and a ring that fills as sets are ticked. */
function totalSets(){ return curList().reduce((a,e)=>a+e.s, 0); }
function doneSets(){
  const d = curDraft(); let n = 0;
  for (const ex of curList()) for (const v of (d.sets[ex.n]||[]).slice(0, ex.s)) if (v && v.done) n++;
  return n;
}
function estMinutes(){
  let sec = 0;
  curList().forEach((ex,i)=>{ sec += ex.s * ((ex.time ? ex.hi : 40) + C.restSeconds(i)); });
  return Math.round((sec + 5*60) / 5 / 60) * 5;       // + warm-up, rounded to 5 min
}
function renderHero(){
  const S0 = PG.P[day], dl = C.deloadInfo(history);
  $("#hero-letter").textContent = day;
  $("#hero-name").textContent = S0.name;
  $("#hero-focus").textContent = S0.focus + " · " + PG.GYMS[gym].k;
  const chips = [curList().length+" lifts", totalSets()+" sets", "~"+estMinutes()+" min"];
  $("#hero-chips").innerHTML = chips.map(c=>'<span class="chip">'+esc(c)+'</span>').join("") +
    (dl.isDeload ? '<span class="chip hot">Deload · 60% × 2 sets</span>' : '') +
    (day === C.nextDay(history) && history.length ? '' : (history.length ? '<span class="chip hot">Out of order</span>' : ''));
  updateRing();
}
function updateRing(){
  const tot = totalSets(), dn = doneSets(), C0 = 213.6;
  $("#ring-val").setAttribute("stroke-dashoffset", String(C0 - C0 * (tot ? dn/tot : 0)));
  $("#ring-n").textContent = dn;
  $("#ring-of").textContent = "of "+tot+" sets";
  $("#ring").classList.toggle("full", tot > 0 && dn >= tot);
  $("#ring").setAttribute("aria-label", dn+" of "+tot+" sets completed");
  const bar = $("#dock-bar"); bar.style.width = (tot ? Math.min(100, dn/tot*100) : 0)+"%"; bar.classList.toggle("full", tot > 0 && dn >= tot);
}
function markActive(){
  const cards = [...document.querySelectorAll("#ex-list .ex")];
  cards.forEach(c=>c.classList.remove("active"));
  const next = cards.find(c=>!c.classList.contains("done"));
  if (next) next.classList.add("active");
}

function lastValsText(ex, last){
  return last.e.sets.map(s=>{
    if (ex.time) return s.reps+"s";
    if (ex.bw) return s.reps+(s.weight && s.weight < 100 ? " (+"+s.weight+")" : "");
    return s.weight ? s.weight+"×"+s.reps : "—";
  }).join("  ");
}

function renderExercises(){
  const list = $("#ex-list"); list.innerHTML = "";
  const dr = curDraft();
  curList().forEach((ex, i)=>{
    const k = ex.n, last = C.lastFor(history, k), jump = C.earnedJump(ex, last);
    const card = el("div","ex"); card.dataset.k = k;

    const head = el("div","ex-head");
    head.innerHTML = '<span class="ex-num">'+String(i+1).padStart(2,"0")+'</span>'+
      '<span class="ex-name"><span class="n">'+esc(ex.n)+'</span><span class="cue">'+esc(ex.cue)+'</span></span>'+
      '<span class="ex-target">'+ex.s+' &times; '+(ex.time?(ex.lo+'-'+ex.hi+'s'):(ex.lo===ex.hi?ex.lo:ex.lo+'-'+ex.hi))+'</span>';
    card.appendChild(head);

    const lastBar = el("div","ex-last");
    if (last){
      lastBar.innerHTML = '<span class="lbl">Last · '+shortDate(last.w.date)+'</span><span class="vals">'+esc(lastValsText(ex,last))+'</span>'+
        (jump ? '<span class="cue-up">↑ '+(ex.bw ? 'Add reps or +'+ex.inc+' lb' : 'Add '+ex.inc+' lb')+'</span>' : '');
    } else {
      lastBar.innerHTML = '<span class="lbl">First time</span><span class="vals">'+
        (ex.time ? 'Hold as long as form stays clean, then log it'
        : ex.bw ? 'Bodyweight — log reps. Weight box is for ADDED load only'
        : 'Start with a weight you could do '+(ex.hi+2)+' reps with')+'</span>';
    }
    card.appendChild(lastBar);

    const f = PG.FORM[ex.n];
    if (f){
      const hid = "how-"+idOf(k);
      const hb = el("button","howbtn"); hb.type = "button"; hb.setAttribute("aria-expanded","false"); hb.setAttribute("aria-controls",hid);
      hb.innerHTML = 'How to do it <svg class="cv" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      const hp = el("div","how"); hp.id = hid; hp.hidden = true;
      hp.innerHTML = '<p><b>Set up</b>'+esc(f.s)+'</p><p><b>The rep</b>'+esc(f.d)+'</p>'+
        '<p class="miss"><b>What goes wrong</b>'+esc(f.m)+'</p>'+
        '<a href="'+PG.watchUrl(ex.n)+'" target="_blank" rel="noopener">Watch it &#8599;</a>';
      hb.onclick = ()=>{ const on = hb.getAttribute("aria-expanded")==="true"; hb.setAttribute("aria-expanded", String(!on)); hp.hidden = on; };
      card.appendChild(hb); card.appendChild(hp);
    }

    const rows = dr.sets[k] || [];
    const sets = el("div","sets");
    for (let s=0; s<ex.s; s++){
      const row = el("div","setrow"), id = idOf(k)+"-"+s, dv = rows[s];
      let prevW = "", prevR = "";
      if (last && last.e.sets[s]){ prevW = last.e.sets[s].weight || ""; prevR = last.e.sets[s].reps || ""; }
      const sug = ex.bw ? "" : (jump && prevW ? Number(prevW)+ex.inc : prevW);
      const wPh = ex.bw ? "BW" : (sug!=="" ? sug : "—");
      row.innerHTML = '<span class="sn">'+(s+1)+'</span>'+
        (ex.time
          ? '<div class="fld" style="grid-column:2 / span 2"><input id="'+id+'-r" type="number" inputmode="numeric" step="5" placeholder="'+(prevR||ex.lo)+'" value="'+(dv&&dv.reps||"")+'" aria-label="Set '+(s+1)+' seconds"><span class="u">sec</span></div>'
          : '<div class="fld"><input id="'+id+'-w" type="number" inputmode="decimal" step="2.5" placeholder="'+wPh+'" value="'+(dv&&dv.weight||"")+'" aria-label="Set '+(s+1)+(ex.bw?' added weight':' weight')+'"><span class="u">'+(ex.bw?'+lb':'lb')+'</span></div>'+
            '<div class="fld"><input id="'+id+'-r" type="number" inputmode="numeric" placeholder="'+(prevR||ex.lo)+'" value="'+(dv&&dv.reps||"")+'" aria-label="Set '+(s+1)+' reps"><span class="u">rep</span></div>')+
        '<button class="tick" type="button" id="'+id+'-t" aria-label="Mark set '+(s+1)+' complete" aria-pressed="'+(dv&&dv.done?"true":"false")+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>';
      sets.appendChild(row);
    }
    card.appendChild(sets);
    list.appendChild(card);

    const refreshDone = ()=>{ card.classList.toggle("done", card.querySelectorAll('.tick[aria-pressed="true"]').length === ex.s); markActive(); };
    for (let s=0; s<ex.s; s++){
      const id = idOf(k)+"-"+s;
      const wi = document.getElementById(id+"-w"), ri = document.getElementById(id+"-r"), tb = document.getElementById(id+"-t");
      const push = ()=>{
        const d = curDraft(); d.sets[k] = d.sets[k] || [];
        d.sets[k][s] = {weight: wi ? parseFloat(wi.value)||0 : 0, reps: parseFloat(ri.value)||0, done: tb.getAttribute("aria-pressed")==="true"};
        saveDraftSoon(); updateDock();
      };
      if (wi) wi.addEventListener("input", push);
      ri.addEventListener("input", push);
      tb.addEventListener("click", ()=>{
        const on = tb.getAttribute("aria-pressed")==="true";
        tb.setAttribute("aria-pressed", String(!on));
        if (!on){
          if (wi && !wi.value && wi.placeholder && !isNaN(parseFloat(wi.placeholder))) wi.value = parseFloat(wi.placeholder);
          if (!ri.value && ri.placeholder && !isNaN(parseFloat(ri.placeholder))) ri.value = parseFloat(ri.placeholder);
          startRest(C.restSeconds(i));
        }
        push(); refreshDone();
      });
    }
    refreshDone();
  });
  updateDock();
}

function collect(){
  const d = curDraft(), out = [];
  for (const ex of curList()){
    const rows = d.sets[ex.n] || [], sets = [];
    for (let s=0; s<ex.s; s++){
      const v = rows[s];
      if (v && v.reps > 0) sets.push({set:s+1, weight:v.weight||0, reps:v.reps});
    }
    if (sets.length) out.push({name:ex.n, sets});
  }
  return out;
}
function updateDock(){
  const ex = collect(); let sets = 0;
  for (const e of ex) sets += e.sets.length;
  const vol = C.sessionVolume({exercises:ex});
  $("#dock-vol").textContent = fmt(vol)+" lb";
  $("#btn-finish").disabled = sets === 0;
  updateRing();
}

/* ═══ REST TIMER ═════════════════════════════════════════════ */
function startRest(sec){
  unlockAudio();
  rest = {end: Date.now()+sec*1000, total: sec, beeped:false};
  clearInterval(restTimer); restTimer = setInterval(tickRest, 250); tickRest();
}
function stopRest(){ rest = null; clearInterval(restTimer); const r = $("#rest"); r.classList.remove("on","over"); }
function tickRest(){
  if (!rest) return;
  const r = $("#rest"), left = Math.round((rest.end - Date.now())/1000);
  const m = Math.floor(Math.abs(left)/60), s = String(Math.abs(left)%60).padStart(2,"0");
  r.classList.add("on"); r.classList.toggle("over", left < 0);
  $("#rest-v").textContent = (left < 0 ? "+" : "") + m + ":" + s;
  $("#rest-l").textContent = left < 0 ? "Go" : "Rest";
  $("#rest-f").style.width = Math.max(0, Math.min(100, left / rest.total * 100)) + "%";
  if (left <= 0 && !rest.beeped){ rest.beeped = true; beep(); }
  if (left < -300) stopRest();
}
function unlockAudio(){
  try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch(e){}
}
function beep(){
  try {
    if (!audio) return;
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.35);
  } catch(e){}
  try { navigator.vibrate && navigator.vibrate(300); } catch(e){}
}

/* ═══ SAVE A SESSION ═════════════════════════════════════════ */
async function finish(){
  const exercises = collect();
  if (!exercises.length) return;
  const now = new Date();
  const rec = C.cleanWorkout({
    id: C.newId(now), date: C.isoLocal(now), gym, day, dayName: PG.P[day].name,
    notes: $("#notes").value.trim(), exercises, loggedAt: now.toISOString()
  });
  try { await S.putWorkouts([rec]); }
  catch(e){ toast("Couldn't save — storage full?"); return; }
  const prs = personalBests(rec, history);
  history.push(rec);
  delete drafts[draftKey()];
  stopRest();
  day = C.nextDay(history);
  await S.setMeta("draft", {gym, day, drafts}).catch(()=>{});
  render(); renderBanners();
  window.scrollTo({top:0, behavior:"smooth"});
  celebrate(rec, prs);
}

/* New bests vs everything logged before this session (first-ever attempts don't count). */
function personalBests(rec, before){
  const out = [];
  for (const e of rec.exercises){
    const now = C.liftScore(e.name, rec);
    const prev = Math.max(0, ...before.map(w=>C.liftScore(e.name, w)));
    if (prev > 0 && now > prev) out.push({name:e.name, from:prev, to:now, unit:C.liftUnit(e.name)});
  }
  return out;
}
function celebrate(rec, prs){
  const sets = rec.exercises.reduce((a,e)=>a+e.sets.length, 0);
  const ov = el("div","celebrate"); ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true"); ov.setAttribute("aria-label","Session logged");
  const burst = Array.from({length:18}, (_,i)=>{
    const a = (i/18)*Math.PI*2, d = 70 + (i%3)*26;
    const col = i%3===0 ? "var(--gold)" : i%3===1 ? "var(--accent)" : "var(--accent-2)";
    return '<i style="--x:'+Math.round(Math.cos(a)*d)+'px;--y:'+Math.round(Math.sin(a)*d)+'px;--r:'+(i*47)+'deg;background:'+col+';animation-delay:'+(0.15+(i%4)*0.03)+'s"></i>';
  }).join("");
  ov.innerHTML = '<div class="card"><div class="spark-burst">'+burst+'</div>'+
    '<div class="badge"><svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>'+
    '<h2>Session '+esc(rec.day)+' done</h2>'+
    '<div class="sub">'+esc(rec.dayName)+' · '+esc(PG.GYMS[rec.gym].k)+'</div>'+
    '<div class="stats"><div><b>'+(rec.volume>=1000?(rec.volume/1000).toFixed(1)+"k":fmt(rec.volume))+'</b><span>lb moved</span></div>'+
      '<div><b>'+sets+'</b><span>sets</span></div><div><b>'+prs.length+'</b><span>new bests</span></div></div>'+
    (prs.length ? '<div class="prs">'+prs.map(p=>'<div><span class="pr">PR</span>'+esc(p.name)+' <span class="mono">'+p.from+' → '+p.to+'</span> '+esc(p.unit)+'</div>').join("")+'</div>' : '')+
    '<button class="btn" type="button">Up next · Session '+C.nextDay(history)+'</button></div>';
  const close = ()=>{ ov.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e=>{ if (e.key === "Escape") close(); };
  ov.querySelector(".btn").onclick = close;
  ov.addEventListener("click", e=>{ if (e.target === ov) close(); });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(ov);
  ov.querySelector(".btn").focus({preventScroll:true});
  beep();
}
function toast(msg){
  document.querySelectorAll(".toast").forEach(x=>x.remove());   // one at a time — rapid taps replace, not stack
  const t = el("div","toast"); t.setAttribute("role","status"); t.textContent = msg; document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2400);
}

/* ═══ PROGRESS ═══════════════════════════════════════════════ */
function spark(vals, w, h){
  if (vals.length < 2) return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" aria-hidden="true">'+
    '<line x1="3" y1="'+(h/2)+'" x2="'+(w-6)+'" y2="'+(h/2)+'" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="3 5"/>'+
    '<circle cx="'+(w-6)+'" cy="'+(h/2)+'" r="3" fill="var(--accent)"/></svg>';
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx-mn)||1, p = 3;
  const pts = vals.map((v,i)=>[p+i*(w-2*p)/(vals.length-1), h-p-((v-mn)/rg)*(h-2*p)]);
  const dstr = pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join(" ");
  const area = dstr+" L"+pts[pts.length-1][0].toFixed(1)+" "+(h-p)+" L"+pts[0][0].toFixed(1)+" "+(h-p)+" Z";
  const last = pts[pts.length-1];
  return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" aria-hidden="true">'+
    '<path d="'+area+'" fill="var(--steel-soft)" stroke="none"/>'+
    '<path d="'+dstr+'" fill="none" stroke="var(--steel)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'+
    '<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="2.6" fill="var(--accent)"/></svg>';
}
function renderProgress(){
  const v = $("#v-prog"); v.innerHTML = "";
  const s = C.sorted(history);
  if (!s.length){
    const p = el("div","panel");
    p.innerHTML = '<div class="empty"><strong>Nothing logged yet</strong>Log Session A and this fills in — consistency, volume, and a trend line on every lift you repeat.</div>';
    v.appendChild(p); v.appendChild(dataPanel()); return;
  }
  const wk = C.weekCounts(history);
  let streak = 0; for (let i=wk.length-1; i>=0; i--){ if (wk[i]>0) streak++; else break; }
  const last8 = s.slice(0,8).map(C.sessionVolume).reverse();
  const totalVol = s.reduce((a,w)=>a+C.sessionVolume(w), 0);
  const k = el("div","kpis");
  k.innerHTML =
    '<div class="kpi"><div class="k">Sessions</div><div class="v">'+s.length+'</div><div class="s">since '+shortDate(s[s.length-1].date)+'</div></div>'+
    '<div class="kpi"><div class="k">Week streak</div><div class="v">'+streak+'</div><div class="s">'+(streak>=2?"holding":"build it")+'</div></div>'+
    '<div class="kpi"><div class="k">Total lifted</div><div class="v">'+(totalVol>=1000?(totalVol/1000).toFixed(1)+"k":totalVol)+'</div><div class="s">pounds moved</div></div>';
  v.appendChild(k);

  const cp = el("div","panel"), mx = Math.max(3, ...wk);
  cp.innerHTML = '<h2>Sessions per week · last 12</h2><div class="weeks">'+
    wk.map(n=>'<div class="'+(n>=3?"h3":n===2?"h2":n===1?"h1":"")+'" style="height:'+Math.max(6,(n/mx)*100)+'%" title="'+n+' sessions"></div>').join("")+
    '</div><div class="weeks-ax"><span>12 weeks ago</span><span>This week</span></div>';
  v.appendChild(cp);

  if (last8.length >= 2){
    const vp = el("div","panel"), mxv = Math.max(1, ...last8);
    vp.innerHTML = '<h2>Session volume · last '+last8.length+'</h2><div class="weeks" style="height:64px">'+
      last8.map((n,i)=>'<div class="'+(i===last8.length-1?"h3":"h2")+'" style="height:'+Math.max(6,(n/mxv)*100)+'%" title="'+fmt(n)+' lb"></div>').join("")+
      '</div><div class="weeks-ax"><span class="mono">'+fmt(last8[0])+' lb</span><span class="mono">'+fmt(last8[last8.length-1])+' lb</span></div>';
    v.appendChild(vp);
  }

  const names = [...new Set(s.flatMap(w=>(w.exercises||[]).map(e=>e.name)))];
  const rows = names.map(n=>{
    const pts = s.slice().reverse().map(w=>C.liftScore(n,w)).filter(x=>x>0);
    const loaded = !C.isBodyweight(n) && !C.isTimed(n);
    const heavy = loaded ? s.map(w=>{ const f = (w.exercises||[]).find(e=>e.name===n); return f ? Math.max(...f.sets.map(x=>x.weight)) : 0; }).filter(x=>x>0) : [];
    const latest = pts[pts.length-1], priorBest = pts.length>1 ? Math.max(...pts.slice(0,-1)) : Infinity;
    return {n, pts, top: heavy[0]||0, loaded, pr: latest > priorBest, delta: pts.length>1 ? pts[pts.length-1]-pts[0] : 0};
  }).filter(r=>r.pts.length).sort((a,b)=>b.pts.length-a.pts.length);
  if (rows.length){
    const lp = el("div","panel");
    lp.innerHTML = '<h2>Lift by lift · best effort</h2>'+rows.map(r=>
      '<div class="lift"><span class="nm">'+esc(r.n)+(r.pr?'<span class="pr">PR</span>':'')+'</span>'+spark(r.pts,220,32)+
      '<span class="num">'+r.pts[r.pts.length-1]+'<small>'+(r.loaded ? r.top+' lb top set' : C.liftUnit(r.n)+' best')+'</small></span>'+
      '<span class="delta '+(r.delta>0?"pos":"flat")+'">'+(r.delta>0?"+"+r.delta:r.delta<0?r.delta:"—")+'</span></div>').join("");
    v.appendChild(lp);
  }

  const lg = el("div","panel");
  lg.innerHTML = '<h2>Session log · tap one for details</h2>';
  for (const w of s.slice(0,30)){
    const r = el("div","log-row"); r.tabIndex = 0; r.setAttribute("role","button"); r.setAttribute("aria-expanded", String(openLog===w.id));
    r.innerHTML = '<span class="d">'+shortDate(w.date)+'</span>'+
      '<span class="b"><b>'+esc(w.day)+' · '+esc(w.dayName||PG.P[w.day].name)+'</b><br><span>'+esc(PG.GYMS[w.gym].k)+(w.notes?' · '+esc(w.notes):'')+'</span></span>'+
      '<span class="v">'+fmt(C.sessionVolume(w))+' lb</span>';
    const toggle = ()=>{ openLog = openLog===w.id ? null : w.id; renderProgress(); };
    r.onclick = toggle; r.onkeydown = e=>{ if (e.key==="Enter"||e.key===" "){ e.preventDefault(); toggle(); } };
    lg.appendChild(r);
    if (openLog === w.id){
      const d = el("div","log-detail");
      d.innerHTML = (w.exercises||[]).map(e=>'<div><b>'+esc(e.name)+'</b> <span class="mono">'+
        esc(e.sets.map(x=>C.isTimed(e.name)?x.reps+"s":C.isBodyweight(e.name)?x.reps+" reps":x.weight+"×"+x.reps).join("  "))+'</span></div>').join("")+
        '<div class="acts"><button class="btn danger" type="button">Delete this session</button></div>';
      d.querySelector(".danger").onclick = ()=>removeSession(w);
      lg.appendChild(d);
    }
  }
  v.appendChild(lg);
  v.appendChild(dataPanel());
}
async function removeSession(w){
  if (!confirm("Delete the "+shortDate(w.date)+" Session "+w.day+" log? This can't be undone (unless it's in a backup).")) return;
  await S.deleteWorkout(w.id);
  history = history.filter(x=>x.id!==w.id);
  openLog = null; day = C.nextDay(history);
  renderProgress(); render(); toast("Session deleted");
}

/* ═══ YOUR DATA: backup / restore / CSV ══════════════════════ */
function dataPanel(){
  const p = el("div","panel");
  const lb = meta.lastBackupAt ? new Date(meta.lastBackupAt).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"}) : "never";
  p.innerHTML = '<h2>Your data</h2>'+
    '<div class="data-actions">'+
      '<button class="btn sm" type="button" id="b-backup">Back up</button>'+
      '<button class="btn ghost sm" type="button" id="b-restore">Restore</button>'+
      '<button class="btn ghost sm" type="button" id="b-csv">Export CSV</button>'+
      '<button class="btn ghost sm" type="button" id="b-where">Where is it?</button>'+
    '</div>'+
    '<p class="fine">Your workouts and health data live on this phone only ('+history.length+' sessions · '+H.count()+' health entries). Last backup: <b>'+esc(lb)+'</b>. Back up saves one file with everything — put it in iCloud Drive. Restore adds from a backup file (it never duplicates or deletes). '+
    (S.storageMode()==="local" ? 'Storage: basic (private browsing?).' : 'Storage: on-device database'+(meta.persisted?' · protected from clean-up.':'.'))+
    ' <span class="mono">v'+APP_VERSION+'</span></p>'+
    '<input type="file" id="f-restore" class="hidden-input" accept=".json,application/json" aria-label="Choose a Sixty Strong backup file">';
  p.querySelector("#b-backup").onclick = backup;
  p.querySelector("#b-restore").onclick = ()=>p.querySelector("#f-restore").click();
  p.querySelector("#f-restore").onchange = e=>{ const f = e.target.files[0]; e.target.value = ""; if (f) restoreFile(f); };
  p.querySelector("#b-csv").onclick = exportCsv;
  p.querySelector("#b-where").onclick = ()=>alert("Your workouts and health data are stored inside this app on this phone — not in the cloud, and never on the website.\n\nTo keep them safe: tap Back up, then choose \"Save to Files\" → iCloud Drive. To move to a new phone, install the app there and tap Restore with that file.");
  return p;
}
async function saveFile(name, text, mime){
  const blob = new Blob([text], {type:mime});
  const file = new File([blob], name, {type:mime});
  if (navigator.canShare && navigator.canShare({files:[file]})){
    try { await navigator.share({files:[file], title:name}); return true; }
    catch(e){ if (e && e.name === "AbortError") return false; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return true;
}
async function backup(){
  if (!history.length && !H.count()){ toast("Nothing to back up yet"); return; }
  const ok = await saveFile("sixty-strong-backup-"+C.isoLocal()+".json", JSON.stringify(C.toBackup(history, undefined, H.exportData()), null, 1), "application/json");
  if (ok){ meta.lastBackupAt = new Date().toISOString(); await S.setMeta("lastBackupAt", meta.lastBackupAt); renderBanners(); if (!$("#v-prog").hidden) renderProgress(); toast("Backup ready"); }
}
async function exportCsv(){
  if (!history.length){ toast("Nothing to export yet"); return; }
  await saveFile("sixty-strong-log-"+C.isoLocal()+".csv", C.toCSV(history), "text/csv");
}
async function importWorkouts(list, label){
  const r = C.mergeWorkouts(history, list);
  const added = r.merged.slice(history.length);
  if (added.length) await S.putWorkouts(added);
  history = r.merged; day = C.nextDay(history);
  render(); renderBanners(); if (!$("#v-prog").hidden) renderProgress();
  return r;
}
async function restoreFile(file){
  try {
    const parsed = C.parseBackup(await file.text());
    const nh = parsed.health.length + (parsed.profile?1:0) + (parsed.targets?1:0);
    if (!parsed.workouts.length && !nh){ alert("Nothing to restore in that file."); return; }
    if (!confirm("Restore from "+file.name+"?\n\n"+parsed.workouts.length+" workout session(s) and "+parsed.health.length+" health entries. Anything you already have is skipped — nothing is deleted.")) return;
    const r = await importWorkouts(parsed.workouts);
    const hr = await H.importData(parsed);
    toast("Added "+r.added+" sessions · "+hr.added+" health entries"+(r.skipped+hr.skipped?" · "+(r.skipped+hr.skipped)+" already here":"")+(parsed.rejected?" · "+parsed.rejected+" unreadable":""));
    if (!$("#v-health").hidden) H.render();
  } catch(e){ alert(e.message || "Couldn't read that file."); }
}

/* ═══ BANNERS ════════════════════════════════════════════════ */
function isIOS(){ return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1); }
function isStandalone(){ return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
function banner(cls, title, text, btnLabel, onClick, dismissKey){
  const b = el("div","banner"+(cls?" "+cls:""));
  b.innerHTML = '<div class="bt"><b>'+esc(title)+'</b>'+esc(text)+'</div>';
  if (btnLabel){ const x = el("button","btn sm"); x.type = "button"; x.textContent = btnLabel; x.onclick = onClick; b.appendChild(x); }
  if (dismissKey){ const x = el("button","btn ghost sm"); x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label","Dismiss");
    x.onclick = async ()=>{ meta[dismissKey] = new Date().toISOString(); await S.setMeta(dismissKey, meta[dismissKey]); renderBanners(); }; b.appendChild(x); }
  return b;
}
function renderBanners(){
  const box = $("#banners"); box.innerHTML = "";
  if (updateReady) box.appendChild(banner("warn","Update ready","A newer version of the app is downloaded.","Reload",()=>{
    if (swReg && swReg.waiting) swReg.waiting.postMessage("SKIP_WAITING"); else location.reload(); }));
  if (!history.length && !H.count()){
    box.appendChild(banner("","Bring over your log and health data","Tap Restore and pick sixty-strong-import.json (Files → iCloud Drive → Desktop → PEOPLES AI TWIN → Personal → Sixty Strong App → backups).","Restore",()=>{
      switchTab("tab-prog"); setTimeout(()=>{ const f = $("#f-restore"); if (f) f.click(); }, 50); }));
  }
  if (isIOS() && !isStandalone() && !meta.installHintDismissed)
    box.appendChild(banner("","Put it on your Home Screen","In Safari tap Share (the square with the arrow) → Add to Home Screen. It then opens full-screen and works with no signal.",null,null,"installHintDismissed"));
  const dl = C.deloadInfo(history);
  if (history.length && dl.isDeload)
    box.appendChild(banner("","Deload week (week "+dl.week+")","Same sessions at about 60% weight, two sets each. It's what lets the next block go up."));
  if (history.length || H.count()){
    const lb = meta.lastBackupAt ? new Date(meta.lastBackupAt) : null;
    const newer = history.some(w=>!lb || new Date(w.loggedAt) > lb) || (meta.lastChangeAt && (!lb || new Date(meta.lastChangeAt) > lb));
    const stale = !lb || (Date.now() - lb) > 7*86400000;
    const snoozed = meta.backupSnoozedAt && (Date.now() - new Date(meta.backupSnoozedAt)) < 3*86400000;
    if (newer && stale && !snoozed)
      box.appendChild(banner("warn", lb ? "Time for a backup" : "Back up your log", "Your workouts and health data live only on this phone. One tap saves a copy to iCloud Drive.", "Back up", backup, "backupSnoozedAt"));
  }
}

/* ═══ PLAN (unchanged content from the artifact) ═════════════ */
function renderPlan(){
  const v = $("#v-plan"); if (v.dataset.done) return; v.dataset.done = "1";
  const rp = el("div","panel");
  rp.innerHTML = '<h2>How this works</h2>'+PG.PRINCIPLES.map(p=>'<div class="rule"><span class="rk">'+esc(p[0])+'</span><span class="rv">'+esc(p[1])+'</span></div>').join("");
  v.appendChild(rp);
  for (const g of ["office","pf"]){
    const p = el("div","panel"); let h = '<h2>'+esc(PG.GYMS[g].k)+'</h2>';
    for (const d of PG.DAYS){
      h += '<div class="planday"><div class="ph"><span class="a">'+d+'</span><span class="b">'+esc(PG.P[d].name)+'</span></div>'+
        PG.P[d][g].map(e=>'<div class="planrow"><span class="x">'+esc(e.n)+'</span><span class="y">'+e.s+' × '+(e.time?e.lo+'-'+e.hi+'s':(e.lo===e.hi?e.lo:e.lo+'-'+e.hi))+'</span></div>').join("")+'</div>';
    }
    p.innerHTML = h; v.appendChild(p);
  }
  const note = el("div","panel");
  note.innerHTML = '<h2>Two rooms, one program</h2><div class="rule"><span class="rv">The shop gym is the better muscle-building room — a barbell and adjustable dumbbells let you add small, steady load, which is the whole game. Treat Planet Fitness as the equal-weight alternate when you can\'t get to the office, and as the better option for the single-joint work where machines are genuinely kinder to a 60-year-old shoulder or knee. The movement patterns match across both, so a lift\'s trend line keeps building whichever room you were in.</span></div>'+
  '<div class="rule"><span class="rk">The squat</span><span class="rv">Session A is anchored by a barbell back squat because the shop rack has safeties. Set the pins one notch below your bottom position every single time — that is what lets you push a squat hard alone in an empty office gym. High-bar, bar across the traps, knees tracking over the toes. If the bar position bothers a shoulder, switch to a front squat rather than dropping the weight.</span></div>'+
  '<div class="rule"><span class="rk">Bailing</span><span class="rv">If a rep stalls, keep the bar on your back, sit it down onto the pins, and step out forward. Practise it once with an empty bar before the first heavy session so the movement is automatic.</span></div>';
  v.appendChild(note);
  const lib = el("div","panel");
  lib.innerHTML = '<h2>If you want to see it done</h2>'+
    '<div class="rule"><span class="rv">Every exercise in the Session tab has a <b>How to do it</b> button — setup, the rep itself, and the mistake that actually shows up. Each one also has a <b>Watch it</b> link that pulls up video demonstrations of that specific lift.</span></div>'+
    '<div class="rule"><span class="rk">ExRx</span><span class="rv"><a href="https://exrx.net/Lists/Directory" target="_blank" rel="noopener">exrx.net/Lists/Directory</a> — the reference librarians of this world. Plain animations and precise written instructions, organized by muscle group. No selling, no fads. Best single source if you want to look something up properly.</span></div>'+
    '<div class="rule"><span class="rk">Precision Nutrition</span><span class="rv"><a href="https://www.precisionnutrition.com/video-exercise-library" target="_blank" rel="noopener">precisionnutrition.com/video-exercise-library</a> — 400+ free short demo videos, clean and unhyped.</span></div>'+
    '<div class="rule"><span class="rk">Worth paying for</span><span class="rv">One session with a decent coach at a Kelowna gym, purely to watch you squat, bench, row and deadlift. An hour of someone watching your actual body beats any number of videos, and it front-loads the corrections before you have three years of a bad pattern built in.</span></div>';
  v.appendChild(lib);
}

/* ═══ TABS / BOOT ════════════════════════════════════════════ */
function render(){ renderControls(); renderExercises(); }
function switchTab(id){
  for (const t of [["tab-today","v-today"],["tab-prog","v-prog"],["tab-health","v-health"],["tab-plan","v-plan"]]){
    const on = t[0]===id;
    document.getElementById(t[0]).setAttribute("aria-selected", String(on));
    document.getElementById(t[1]).hidden = !on;
  }
  $(".tabs").style.setProperty("--i", ["tab-today","tab-prog","tab-health","tab-plan"].indexOf(id));
  $("#dock").style.display = id==="tab-today" ? "" : "none";
  if (id==="tab-prog") renderProgress();
  if (id==="tab-health") H.render();
  if (id==="tab-plan") renderPlan();
  window.scrollTo(0,0);
}

/* On the Mac copy only: pick up the private import file (never present on the website). */
async function firstRunImport(){
  const needW = !history.length && !(await S.getMeta("seedChecked"));
  const needH = !H.count() && !(await S.getMeta("healthSeedChecked"));
  if (!needW && !needH) return;
  if (needW) await S.setMeta("seedChecked", new Date().toISOString());
  if (needH) await S.setMeta("healthSeedChecked", new Date().toISOString());
  let list = [], parsed = null;
  const legacy = needW ? S.legacyLocal() : [];
  if (Array.isArray(legacy) && legacy.length) list = list.concat(C.parseBackup(JSON.stringify(legacy)).workouts);
  const local = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);   // the import file only exists on the Mac copy
  if (local) try {
    const r = await fetch(SEED_URL, {cache:"no-store"});
    if (r.ok){ parsed = C.parseBackup(await r.text()); if (needW) list = list.concat(parsed.workouts); }
  } catch(e){}
  let msg = [];
  if (list.length){ const res = await importWorkouts(list); if (res.added) msg.push(res.added+" session(s)"); }
  if (needH && parsed){ const hr = await H.importData(parsed); if (hr.added) msg.push(hr.added+" health entries"); }
  if (msg.length){ toast("Brought over "+msg.join(" and ")); renderBanners(); }
}

function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").then(reg=>{
    swReg = reg;
    const watch = w=>w && w.addEventListener("statechange", ()=>{
      if (w.state === "installed" && navigator.serviceWorker.controller){ updateReady = true; renderBanners(); }
    });
    if (reg.waiting && navigator.serviceWorker.controller){ updateReady = true; renderBanners(); }
    reg.addEventListener("updatefound", ()=>watch(reg.installing));
    setInterval(()=>reg.update().catch(()=>{}), 60*60*1000);
  }).catch(()=>{});
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{ if (!reloading){ reloading = true; location.reload(); } });
}

async function boot(){
  $("#tab-today").onclick = ()=>switchTab("tab-today");
  $("#tab-prog").onclick = ()=>switchTab("tab-prog");
  $("#tab-health").onclick = ()=>switchTab("tab-health");
  $("#tab-plan").onclick = ()=>switchTab("tab-plan");
  $("#btn-finish").onclick = finish;
  $("#rest").onclick = stopRest;
  $("#notes").addEventListener("input", e=>{ curDraft().notes = e.target.value; saveDraftSoon(); });
  $("#today-date").textContent = new Date().toLocaleDateString("en-CA",{weekday:"long",month:"long",day:"numeric"});

  await S.open();
  try { history = await S.allWorkouts(); } catch(e){ history = []; }
  for (const k of ["lastBackupAt","installHintDismissed","backupSnoozedAt","lastChangeAt"]) meta[k] = await S.getMeta(k).catch(()=>null);
  await H.load();
  H.setContext({ getHistory: ()=>history, toast, onChange: ()=>{
    meta.lastChangeAt = new Date().toISOString(); S.setMeta("lastChangeAt", meta.lastChangeAt).catch(()=>{}); renderBanners(); } });
  const saved = await S.getMeta("draft").catch(()=>null);
  day = C.nextDay(history);
  if (saved && saved.drafts){
    drafts = saved.drafts; gym = saved.gym || gym;
    // Reopen the session you were part-way through; otherwise go to the one that's up next.
    const d = saved.day && drafts[gym+"|"+saved.day];
    const inProgress = d && (Object.values(d.sets||{}).some(rows=>(rows||[]).some(v=>v && v.reps>0)) || (d.notes||"").trim());
    if (inProgress) day = saved.day;
  }
  render(); renderBanners();
  await firstRunImport();
  meta.persisted = await S.persist();
  registerSW();
  window.__ss = {version:APP_VERSION, count:()=>history.length, healthCount:()=>H.count()};   // for checks in tests/verify
}
boot();
})();
