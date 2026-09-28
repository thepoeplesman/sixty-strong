/* Sixty Strong — Health tab: longevity snapshot, protein, weigh-ins, lab trends, checkups, notes, targets.
   All data lives on this device (IndexedDB "health" store + meta "profile"/"targets").
   NOTHING personal is hard-coded here — this file is public; Darryl's own numbers arrive only
   through his private import/backup file. */
(function(){
"use strict";
const C = window.SSCore, S = window.SSStore;
let health = [], profile = null, targets = null;
let ctx = { getHistory: ()=>[], toast: ()=>{}, onChange: ()=>{} };

const $ = s=>document.querySelector(s);
const el = (t,c)=>{ const e = document.createElement(t); if (c) e.className = c; return e; };
const esc = s=>String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = ()=>C.isoLocal();
const d = s=>C.dateOf(s).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"});
const dShort = s=>C.dateOf(s).toLocaleDateString("en-CA",{month:"short",day:"numeric"});
const dMonth = s=>C.dateOf(s).toLocaleDateString("en-CA",{month:"short",year:"numeric"});
const id = kind=>kind+"-"+C.newId();
const fmt1 = n=>Number(n).toLocaleString("en-CA",{maximumFractionDigits:2});

async function load(){
  try { health = await S.allHealth(); } catch(e){ health = []; }
  profile = await S.getMeta("profile").catch(()=>null) || null;
  targets = await S.getMeta("targets").catch(()=>null) || null;
  return {health, profile, targets};
}
function setContext(c){ ctx = Object.assign(ctx, c); }
async function add(rec){
  const r = C.cleanHealth(rec); if (!r) { ctx.toast("Couldn't save that"); return null; }
  await S.putHealth([r]); health.push(r); return r;
}
async function remove(hid){ await S.deleteHealth(hid); health = health.filter(h=>h.id !== hid); }
async function update(rec){ const r = C.cleanHealth(rec); if (!r) return; await S.putHealth([r]); health = health.map(h=>h.id===r.id ? r : h); }

/* Import merges by id (never duplicates, never deletes). Profile/targets only fill in when missing,
   so a restore can't silently overwrite targets you've edited on the phone. */
async function importData(p){
  const r = C.mergeById(health, p.health || []);
  const added = r.merged.slice(health.length);
  if (added.length) await S.putHealth(added);
  health = r.merged;
  if (p.profile && !profile){ profile = p.profile; await S.setMeta("profile", profile); }
  if (p.targets && !targets){ targets = p.targets; await S.setMeta("targets", targets); }
  return {added: r.added, skipped: r.skipped};
}
function exportData(){ return {health: health.slice(), profile, targets}; }

/* ── bottom sheet form ─────────────────────────────── */
function sheet(title, fields, onSave, extraBtn){
  const ov = el("div","sheet-ov"); ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true"); ov.setAttribute("aria-label",title);
  const card = el("form","sheet");
  card.innerHTML = '<div class="sheet-grab"></div><h3>'+esc(title)+'</h3>'+fields.map(f=>{
    const common = 'name="'+f.key+'" id="sf-'+f.key+'"'+(f.required?' required':'');
    const input = f.type==="textarea"
      ? '<textarea '+common+' rows="3" placeholder="'+esc(f.placeholder||"")+'">'+esc(f.value||"")+'</textarea>'
      : f.type==="select"
      ? '<select '+common+'>'+f.options.map(o=>'<option'+(o===f.value?' selected':'')+'>'+esc(o)+'</option>').join("")+'</select>'
      : '<input '+common+' type="'+(f.type||"text")+'" value="'+esc(f.value==null?"":f.value)+'" placeholder="'+esc(f.placeholder||"")+'"'+
        (f.step?' step="'+f.step+'"':'')+(f.inputmode?' inputmode="'+f.inputmode+'"':'')+'>';
    return '<label class="sf'+(f.half?' half':'')+'"><span>'+esc(f.label)+'</span>'+input+(f.hint?'<em>'+esc(f.hint)+'</em>':'')+'</label>';
  }).join("")+'<div class="sheet-acts">'+(extraBtn?'<button type="button" class="btn danger" id="sf-extra">'+esc(extraBtn.label)+'</button>':'')+
    '<button type="button" class="btn ghost" id="sf-cancel">Cancel</button><button type="submit" class="btn">Save</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  const close = ()=>ov.remove();
  ov.addEventListener("click", e=>{ if (e.target === ov) close(); });
  card.querySelector("#sf-cancel").onclick = close;
  if (extraBtn) card.querySelector("#sf-extra").onclick = async ()=>{ if (await extraBtn.onClick()) close(); };
  card.onsubmit = async e=>{
    e.preventDefault();
    const v = {}; for (const f of fields) v[f.key] = card.querySelector("#sf-"+f.key).value.trim();
    if (await onSave(v) !== false) close();
  };
  setTimeout(()=>{ const first = card.querySelector("input,textarea,select"); if (first) first.focus({preventScroll:true}); }, 60);
}

/* ── charts (inline SVG, theme via CSS variables) ─── */
function lineChart(points, opts){
  opts = opts || {};
  const W = 320, H = opts.h || 150, L = 36, R = 14, T = 18, B = 26;
  if (!points.length) return "";
  const xs = points.map(p=>C.dateOf(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1){ x0 -= 86400000*30; x1 += 86400000*30; }
  const vals = points.map(p=>p.y).concat(opts.band ? opts.band.filter(v=>v!=null) : []);
  let y0 = Math.min(...vals), y1 = Math.max(...vals);
  if (opts.zero) y0 = Math.min(0, y0);
  const padY = (y1 - y0) * 0.18 || Math.max(1, y1*0.05); y0 -= opts.zero ? 0 : padY; y1 += padY;
  const X = t=>L + (t - x0) / (x1 - x0) * (W - L - R), Y = v=>T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  let svg = '<svg class="hchart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opts.label||"trend")+'">';
  if (opts.band){
    const lo = opts.band[0] == null ? y0 : opts.band[0], hi = opts.band[1] == null ? y1 : opts.band[1];
    svg += '<rect x="'+L+'" y="'+Y(hi).toFixed(1)+'" width="'+(W-L-R)+'" height="'+Math.max(0,Y(lo)-Y(hi)).toFixed(1)+'" fill="var(--up-soft)" rx="4"/>';
    if (opts.band[1] != null) svg += '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(hi).toFixed(1)+'" y2="'+Y(hi).toFixed(1)+'" stroke="var(--up)" stroke-dasharray="4 4" stroke-width="1" opacity=".7"/>'+
      '<text x="'+(W-R)+'" y="'+(Y(hi)-5).toFixed(1)+'" text-anchor="end" class="ht-lbl up">upper limit '+fmt1(hi)+'</text>';
  }
  if (!opts.band) [y0 + (y1-y0)*0.15, y0 + (y1-y0)*0.85].forEach(v=>{ svg += '<text x="'+(L-6)+'" y="'+(Y(v)+3).toFixed(1)+'" text-anchor="end" class="ht-lbl">'+fmt1(Math.round(v*10)/10)+'</text>'; });
  const pts = points.map((p,i)=>[X(xs[i]), Y(p.y)]);
  if (pts.length > 1){
    const dstr = pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join(" ");
    svg += '<path d="'+dstr+' L'+pts[pts.length-1][0].toFixed(1)+' '+(H-B)+' L'+pts[0][0].toFixed(1)+' '+(H-B)+' Z" fill="url(#hGrad)" opacity=".35"/>'+
      '<path d="'+dstr+'" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  pts.forEach((q,i)=>{
    const last = i === pts.length-1;
    svg += '<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="'+(last?5:3.5)+'" fill="'+(last?"var(--accent)":"var(--surface)")+'" stroke="var(--accent)" stroke-width="2"/>';
    if (points.length <= 8 || last) svg += '<text x="'+q[0].toFixed(1)+'" y="'+(q[1]-10).toFixed(1)+'" text-anchor="middle" class="ht-val">'+fmt1(points[i].y)+'</text>';
  });
  svg += '<text x="'+L+'" y="'+(H-6)+'" class="ht-lbl">'+esc(dMonth(points[0].date))+'</text>';
  if (points.length > 1) svg += '<text x="'+(W-R)+'" y="'+(H-6)+'" text-anchor="end" class="ht-lbl">'+esc(dMonth(points[points.length-1].date))+'</text>';
  svg += '</svg>';
  return svg;
}
function proteinBars(days, goal){
  const W = 320, H = 92, B = 18, mx = Math.max(goal||0, ...days.map(x=>x.grams), 1) * 1.1, bw = (W - 8) / days.length;
  let svg = '<svg class="hchart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Protein, last 7 days">';
  days.forEach((x,i)=>{
    const h = (x.grams / mx) * (H - B - 6), hit = goal && x.grams >= goal;
    svg += '<rect x="'+(4 + i*bw + 5).toFixed(1)+'" y="'+(H - B - h).toFixed(1)+'" width="'+(bw-10).toFixed(1)+'" height="'+Math.max(2,h).toFixed(1)+'" rx="4" fill="'+(hit?"var(--up)":i===days.length-1?"var(--accent)":"color-mix(in srgb,var(--accent) 45%,var(--surface-3))")+'"/>'+
      '<text x="'+(4 + i*bw + bw/2).toFixed(1)+'" y="'+(H-4)+'" text-anchor="middle" class="ht-lbl">'+C.dateOf(x.date).toLocaleDateString("en-CA",{weekday:"narrow"})+'</text>';
  });
  if (goal){ const y = (H - B - (goal/mx)*(H - B - 6)).toFixed(1); svg += '<line x1="4" x2="'+(W-4)+'" y1="'+y+'" y2="'+y+'" stroke="var(--up)" stroke-dasharray="4 4" opacity=".8"/>'; }
  return svg + '</svg>';
}

/* ── render ────────────────────────────────────────── */
function render(){
  const v = $("#v-health"); if (!v) return;
  v.innerHTML = "";
  const history = ctx.getHistory();
  const empty = !health.length && !profile && !targets;
  if (empty){
    const p = el("div","panel");
    p.innerHTML = '<div class="empty"><strong>Your health, in one place</strong>Labs, weigh-ins, protein, checkups and notes — kept on this phone only. '+
      'If you have a Sixty Strong import or backup file, restore it from Progress → Your data.</div>'+
      '<div class="hacts"><button class="btn sm" type="button" id="h-start">Set my targets</button><button class="btn ghost sm" type="button" id="h-weigh0">Log a weigh-in</button></div>';
    v.appendChild(p);
    p.querySelector("#h-start").onclick = editTargets;
    p.querySelector("#h-weigh0").onclick = addWeight;
    v.appendChild(footer()); return;
  }
  v.appendChild(heroCard(history));
  v.appendChild(proteinCard());
  v.appendChild(weightCard());
  for (const m of C.labMarkers(health)) v.appendChild(labCard(m));
  v.appendChild(labAddCard());
  v.appendChild(checkupCard());
  v.appendChild(notesCard());
  v.appendChild(targetsCard());
  v.appendChild(footer());
}

function heroCard(history){
  const a = C.ageInfo(profile), t = targets || {};
  const goal = t.proteinDailyG || 0, pToday = C.proteinForDay(health, today());
  const wt = C.weightTrend(health), s7 = C.sessionsInLastDays(history, 7);
  const next = health.filter(h=>h.type==="checkup").map(c=>({c, s:C.checkupStatus(c, health)})).filter(x=>x.s.due).sort((x,y)=>x.s.due < y.s.due ? -1 : 1)[0];
  const openNotes = health.filter(h=>h.type==="note" && h.status==="open").length;
  const card = el("div","hhero");
  const ageLine = a ? (a.birthdayThisMonth ? "Happy birthday month — "+a.age+" and strong" :
                      a.nextAge % 10 === 0 ? "Turning "+a.nextAge+(a.monthsToNext<=1?" next month":" in "+a.monthsToNext+" months") : "Next birthday in "+a.monthsToNext+" mo") : "Longevity snapshot";
  card.innerHTML =
    '<div class="hh-top"><div><span class="hero-k">'+(profile&&profile.name?esc(profile.name)+' · ':'')+'Longevity</span>'+
      '<div class="hh-age">'+(a ? '<b>'+a.age+'</b><span>years</span>' : '<b>—</b>')+'</div><div class="hh-sub">'+esc(ageLine)+'</div></div>'+
      '<div class="hh-rings">'+miniRing(Math.min(1, s7/3), s7+"/3", "Lifts · 7d")+miniRing(goal ? Math.min(1, pToday/goal) : 0, goal ? Math.round(pToday)+"g" : "—", "Protein")+'</div></div>'+
    '<div class="htiles">'+
      tile("Weight", wt ? fmt1(wt.latest.lb)+'<small> lb</small>' : '—', wt ? (wt.daysSince > 7 ? "weigh-in due" : (wt.change30!=null ? (wt.change30>0?"+":"")+wt.change30+" lb · 30d" : "since "+dShort(wt.latest.date))) : "log a weigh-in", wt && wt.daysSince > 7 ? "warn" : "")+
      tile("Next checkup", next ? esc(dMonth(next.s.due)) : '—', next ? esc(next.c.name) : "none set", next && next.s.state!=="ok" ? "warn" : "")+
      tile("Open notes", String(openNotes), openNotes ? "to follow up" : "all clear", openNotes ? "warn" : "ok")+
    '</div>';
  return card;
}
function miniRing(frac, big, small){
  const C0 = 2*Math.PI*26;
  return '<div class="mring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-3)" stroke-width="6"/>'+
    '<circle cx="32" cy="32" r="26" fill="none" stroke="'+(frac>=1?"var(--up)":"url(#ringGrad)")+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+C0.toFixed(1)+'" stroke-dashoffset="'+(C0*(1-frac)).toFixed(1)+'" transform="rotate(-90 32 32)"/></svg>'+
    '<div class="mr-t"><b>'+esc(big)+'</b><span>'+esc(small)+'</span></div></div>';
}
function tile(k, v, s, cls){ return '<div class="htile '+(cls||"")+'"><div class="k">'+esc(k)+'</div><div class="v">'+v+'</div><div class="s">'+s+'</div></div>'; }

function proteinCard(){
  const t = targets || {}, goal = t.proteinDailyG || 0, iso = today();
  const entries = health.filter(h=>h.type==="protein" && h.date===iso).sort((a,b)=>(a.at||"") < (b.at||"") ? -1 : 1);
  const total = entries.reduce((a,p)=>a+p.grams,0), pct = goal ? Math.min(100, total/goal*100) : 0;
  const p = el("div","panel");
  p.innerHTML = '<h2>Protein today</h2>'+
    '<div class="pbig"><b>'+Math.round(total)+'</b><span>'+(goal?'/ '+goal+' g':'g')+'</span>'+(goal && total>=goal?'<em class="hit">Target hit</em>':'')+'</div>'+
    (goal?'<div class="pbar"><i style="width:'+pct.toFixed(1)+'%"></i></div>':'')+
    '<div class="qchips">'+[20,30,40].map(g=>'<button class="qchip" type="button" data-g="'+g+'">+'+g+' g</button>').join("")+'<button class="qchip ghost" type="button" data-g="x">Other</button></div>'+
    (entries.length ? '<div class="plist">'+entries.map(e=>'<span class="pent">'+Math.round(e.grams)+' g'+(e.label?' · '+esc(e.label):'')+' <button type="button" aria-label="Remove '+Math.round(e.grams)+' grams" data-del="'+esc(e.id)+'">✕</button></span>').join("")+'</div>' : '')+
    '<p class="fine">'+(t.perMealProteinG ? 'Aim for at least '+t.perMealProteinG+'–40 g in one sitting. ' : '')+(t.proteinRangeG ? 'Daily range '+t.proteinRangeG[0]+'–'+t.proteinRangeG[1]+' g.' : '')+'</p>'+
    proteinBars(C.proteinDays(health, 7), goal);
  p.querySelectorAll(".qchip").forEach(b=>b.onclick = async ()=>{
    if (b.dataset.g === "x") return sheet("Add protein", [{key:"grams",label:"Grams",type:"number",inputmode:"decimal",required:true,placeholder:"e.g. 35"},{key:"label",label:"What was it? (optional)",placeholder:"e.g. 3 eggs + bacon"}],
      async v=>{ const g = Number(v.grams); if (!(g>0)) return false; await add({id:id("protein"), type:"protein", date:today(), grams:g, label:v.label, at:new Date().toISOString()}); render(); ctx.onChange(); });
    await add({id:id("protein"), type:"protein", date:iso, grams:Number(b.dataset.g), at:new Date().toISOString()});
    const nt = C.proteinForDay(health, iso);
    ctx.toast("+"+b.dataset.g+" g · "+Math.round(nt)+(goal?" / "+goal:"")+" g today");
    render(); ctx.onChange();
  });
  p.querySelectorAll("[data-del]").forEach(b=>b.onclick = async ()=>{ await remove(b.dataset.del); render(); ctx.onChange(); });
  return p;
}

function weightCard(){
  const s = C.weightSeries(health), wt = C.weightTrend(health);
  const p = el("div","panel");
  p.innerHTML = '<h2>Weigh-ins</h2>'+
    (wt ? '<div class="pbig"><b>'+fmt1(wt.latest.lb)+'</b><span>lb · '+esc(dShort(wt.latest.date))+'</span>'+
      (wt.total!=null?'<em class="'+(wt.total<=0?'hit':'')+'">'+(wt.total>0?'+':'')+wt.total+' lb since '+esc(dShort(wt.first.date))+'</em>':'')+'</div>'+
      lineChart(s.map(x=>({date:x.date, y:x.lb})), {label:"Weight trend"}) :
      '<p class="fine" style="margin-top:0">No weigh-ins yet. Your plan says: once a week, same morning, after the bathroom, before eating.</p>')+
    '<div class="hacts"><button class="btn sm" type="button" id="h-weigh">Log weigh-in</button>'+(s.length?'<button class="btn ghost sm" type="button" id="h-weigh-list">History</button>':'')+'</div>';
  p.querySelector("#h-weigh").onclick = addWeight;
  const hl = p.querySelector("#h-weigh-list");
  if (hl) hl.onclick = ()=>listSheet("Weigh-ins", s.slice().reverse().map(x=>({id:x.id, text:fmt1(x.lb)+" lb", sub:d(x.date)})));
  return p;
}
function addWeight(){
  const last = C.weightSeries(health).slice(-1)[0];
  sheet("Log weigh-in", [{key:"lb",label:"Weight (lb)",type:"number",inputmode:"decimal",step:"0.1",required:true,placeholder:last?String(last.lb):"e.g. 185"},{key:"date",label:"Date",type:"date",value:today()}],
    async v=>{ const lb = Number(v.lb); if (!(lb>50)) return false; await add({id:id("weight"), type:"weight", date:v.date||today(), lb}); ctx.toast("Weigh-in saved"); render(); ctx.onChange(); });
}

function labCard(marker){
  const s = C.labSeries(health, marker), t = C.labTrend(s), L = t.latest;
  const p = el("div","panel lab");
  const status = t.inRange === null ? '' : t.inRange ? '<span class="hpill ok">In range</span>' : '<span class="hpill warn">Outside range</span>';
  const range = (L.refLow!==undefined||L.refHigh!==undefined) ? 'Lab range '+(L.refLow!==undefined?fmt1(L.refLow):'')+'–'+(L.refHigh!==undefined?fmt1(L.refHigh):'')+' '+esc(L.unit) : '';
  p.innerHTML = '<h2>'+esc(marker)+' · lab trend</h2>'+
    '<div class="pbig"><b>'+fmt1(L.value)+'</b><span>'+esc(L.unit)+' · '+esc(d(L.date))+'</span>'+status+'</div>'+
    (t.prev ? '<div class="lab-delta"><span class="'+(t.change<=0?'down':'up')+'">'+(t.change>0?'▲ +':'▼ ')+fmt1(t.change)+' '+esc(L.unit)+(t.pct!=null?' ('+(t.pct>0?'+':'')+t.pct+'%)':'')+'</span> since '+esc(dMonth(t.prev.date))+' · '+t.months+' mo'+
      (t.perYear!=null?' · <span class="mono">'+(t.perYear>0?'+':'')+fmt1(t.perYear)+'/yr</span>':'')+'</div>' : '')+
    lineChart(s.map(x=>({date:x.date, y:x.value})), {band:[L.refLow, L.refHigh], zero:true, label:marker+" trend"})+
    '<p class="fine">'+range+(s.length?' · '+s.length+' result'+(s.length>1?'s':''):'')+(L.source?' · '+esc(L.source):'')+'. The trend over time matters more than one number — bring this chart to your doctor.</p>'+
    '<div class="hacts"><button class="btn ghost sm" type="button" data-add>Add '+esc(marker)+' result</button><button class="btn ghost sm" type="button" data-list>All results</button></div>';
  p.querySelector("[data-add]").onclick = ()=>addLab(marker);
  p.querySelector("[data-list]").onclick = ()=>listSheet(marker+" results", s.slice().reverse().map(x=>({id:x.id, text:fmt1(x.value)+" "+x.unit, sub:d(x.date)+(x.source?" · "+x.source:"")})));
  return p;
}
function labAddCard(){
  const p = el("div","panel slim");
  p.innerHTML = '<div class="slim-row"><div><b>Lab results</b><span>Add PSA, cholesterol, A1c, vitamin D, testosterone… each gets its own trend chart.</span></div><button class="btn sm" type="button">Add result</button></div>';
  p.querySelector("button").onclick = ()=>addLab("");
  return p;
}
function addLab(marker){
  const prev = marker ? C.labSeries(health, marker).slice(-1)[0] : null;
  sheet(marker ? "Add "+marker+" result" : "Add lab result", [
    {key:"marker",label:"Test",value:marker||"",required:true,placeholder:"e.g. PSA, LDL, A1c"},
    {key:"value",label:"Result",type:"number",inputmode:"decimal",step:"any",required:true,half:true},
    {key:"unit",label:"Unit",value:prev?prev.unit:"",placeholder:"e.g. ug/L",half:true},
    {key:"refLow",label:"Range low",type:"number",inputmode:"decimal",step:"any",value:prev&&prev.refLow!==undefined?prev.refLow:"",half:true},
    {key:"refHigh",label:"Range high",type:"number",inputmode:"decimal",step:"any",value:prev&&prev.refHigh!==undefined?prev.refHigh:"",half:true},
    {key:"date",label:"Date collected",type:"date",value:today()},
    {key:"source",label:"Lab (optional)",value:prev&&prev.source?prev.source:"",placeholder:"e.g. LifeLabs"}
  ], async v=>{
    const r = {id:id("lab"), type:"lab", date:v.date||today(), marker:v.marker, value:Number(v.value), unit:v.unit, source:v.source};
    if (v.refLow !== "") r.refLow = Number(v.refLow); if (v.refHigh !== "") r.refHigh = Number(v.refHigh);
    if (!(await add(r))) return false;
    ctx.toast(v.marker+" result saved"); render(); ctx.onChange();
  });
}

function checkupCard(){
  const list = health.filter(h=>h.type==="checkup").map(c=>({c, s:C.checkupStatus(c, health)}));
  const p = el("div","panel");
  p.innerHTML = '<h2>Checkups & retests</h2>'+(list.length ? list.map(x=>{
    const pill = x.s.state==="overdue" ? '<span class="hpill warn">Overdue</span>' : x.s.state==="soon" ? '<span class="hpill warn">Due soon</span>' : x.s.state==="ok" ? '<span class="hpill ok">On track</span>' : '<span class="hpill">Set date</span>';
    return '<div class="hrow" data-id="'+esc(x.c.id)+'"><div class="hr-m"><b>'+esc(x.c.name)+'</b><span>Every '+x.c.everyMonths+' mo'+(x.s.last?' · last '+esc(d(x.s.last)):'')+(x.s.due?' · next <b>'+esc(dMonth(x.s.due))+'</b>':'')+'</span>'+(x.c.note?'<em>'+esc(x.c.note)+'</em>':'')+'</div>'+pill+'</div>';
  }).join("") : '<p class="fine" style="margin-top:0">Nothing scheduled.</p>')+
    '<div class="hacts"><button class="btn ghost sm" type="button" id="h-ck">Add checkup</button></div>';
  p.querySelectorAll(".hrow").forEach(r=>r.onclick = ()=>{
    const c = health.find(h=>h.id===r.dataset.id);
    sheet(c.name, [{key:"lastDate",label:"Last done",type:"date",value:C.checkupStatus(c, health).last||""},{key:"everyMonths",label:"Repeat every (months)",type:"number",inputmode:"numeric",value:c.everyMonths}],
      async v=>{ await update(Object.assign({}, c, {lastDate:v.lastDate||undefined, everyMonths:Number(v.everyMonths)||c.everyMonths})); render(); ctx.onChange(); },
      {label:"Delete", onClick: async ()=>{ if (!confirm("Remove this checkup?")) return false; await remove(c.id); render(); ctx.onChange(); return true; }});
  });
  p.querySelector("#h-ck").onclick = ()=>sheet("Add checkup", [
    {key:"name",label:"What",required:true,placeholder:"e.g. Annual physical, Eye exam, Colonoscopy"},
    {key:"everyMonths",label:"Repeat every (months)",type:"number",inputmode:"numeric",value:12,half:true},
    {key:"lastDate",label:"Last done",type:"date",half:true},
    {key:"marker",label:"Linked lab test (optional)",placeholder:"e.g. PSA"}
  ], async v=>{ await add({id:id("checkup"), type:"checkup", name:v.name, everyMonths:Number(v.everyMonths)||12, lastDate:v.lastDate||undefined, marker:v.marker||undefined}); render(); ctx.onChange(); });
  return p;
}

function notesCard(){
  const notes = health.filter(h=>h.type==="note").sort((a,b)=>{
    const rank = s=>s==="open"?0:s==="info"?1:2; return rank(a.status)-rank(b.status) || (a.date < b.date ? 1 : -1); });
  const p = el("div","panel");
  p.innerHTML = '<h2>Health notes</h2>'+(notes.length ? notes.map(n=>
    '<div class="hrow note '+n.status+'" data-id="'+esc(n.id)+'"><div class="hr-m"><b>'+esc(n.title)+'</b><span>'+esc(d(n.date))+'</span>'+(n.body?'<em>'+esc(n.body)+'</em>':'')+'</div>'+
    (n.status==="open"?'<span class="hpill warn">Follow up</span>':n.status==="resolved"?'<span class="hpill ok">Done</span>':'<span class="hpill">Info</span>')+'</div>').join("") :
    '<p class="fine" style="margin-top:0">Symptoms, questions for the doctor, supplements you tried — tap the mic on the keyboard to dictate.</p>')+
    '<div class="hacts"><button class="btn ghost sm" type="button" id="h-note">Add note</button></div>';
  p.querySelectorAll(".hrow").forEach(r=>r.onclick = ()=>{
    const n = health.find(h=>h.id===r.dataset.id);
    sheet("Edit note", [{key:"title",label:"Title",value:n.title,required:true},{key:"body",label:"Details",type:"textarea",value:n.body||""},
      {key:"status",label:"Status",type:"select",options:["open","resolved","info"],value:n.status}],
      async v=>{ await update(Object.assign({}, n, v)); render(); ctx.onChange(); },
      {label:"Delete", onClick: async ()=>{ if (!confirm("Delete this note?")) return false; await remove(n.id); render(); ctx.onChange(); return true; }});
  });
  p.querySelector("#h-note").onclick = ()=>sheet("Add health note", [{key:"title",label:"What's going on?",required:true,placeholder:"e.g. Left knee sore after squats"},
    {key:"body",label:"Details",type:"textarea",placeholder:"When it started, what helps, what to ask the doctor"},{key:"status",label:"Status",type:"select",options:["open","info","resolved"],value:"open"}],
    async v=>{ await add({id:id("note"), type:"note", date:today(), title:v.title, body:v.body, status:v.status}); render(); ctx.onChange(); });
  return p;
}

function targetsCard(){
  const t = targets || {}, p = el("div","panel");
  const row = (k, v)=>v ? '<div class="rule"><span class="rk">'+esc(k)+'</span><span class="rv mono">'+esc(v)+'</span></div>' : '';
  p.innerHTML = '<h2>Daily targets</h2>'+
    (Object.keys(t).length ?
      row("Calories", t.caloriesKcal ? "~"+t.caloriesKcal.toLocaleString("en-CA")+" kcal" : "")+
      row("Protein", t.proteinRangeG ? t.proteinRangeG[0]+"–"+t.proteinRangeG[1]+" g (goal "+(t.proteinDailyG||"")+" g)" : t.proteinDailyG ? t.proteinDailyG+" g" : "")+
      row("Per meal", t.perMealProteinG ? "≥ "+t.perMealProteinG+" g protein" : "")+
      row("Fat", t.fatRangeG ? t.fatRangeG[0]+"–"+t.fatRangeG[1]+" g" : "")+
      row("Net carbs", t.netCarbsMaxG ? "< "+t.netCarbsMaxG+" g" : "")+
      row("Water", t.waterL ? t.waterL+"+ litres" : "")+
      row("Sleep", t.sleepH ? t.sleepH[0]+"–"+t.sleepH[1]+" hours" : "")+
      (t.rules && t.rules.length ? '<ul class="hrules">'+t.rules.map(r=>'<li>'+esc(r)+'</li>').join("")+'</ul>' : '')+
      (t.source ? '<p class="fine">From: '+esc(t.source)+'</p>' : '')
      : '<p class="fine" style="margin-top:0">No targets set yet.</p>')+
    (profile && profile.goals && profile.goals.length ? '<h2 style="margin-top:16px">Your goals</h2><ul class="hrules">'+profile.goals.map(g=>'<li>'+esc(g)+'</li>').join("")+'</ul>' : '')+
    '<div class="hacts"><button class="btn ghost sm" type="button" id="h-tgt">Edit targets</button></div>';
  p.querySelector("#h-tgt").onclick = editTargets;
  return p;
}
function editTargets(){
  const t = targets || {};
  sheet("Daily targets", [
    {key:"proteinDailyG",label:"Protein goal (g/day)",type:"number",inputmode:"numeric",value:t.proteinDailyG||"",half:true,placeholder:"e.g. 150"},
    {key:"perMealProteinG",label:"Per meal (g)",type:"number",inputmode:"numeric",value:t.perMealProteinG||"",half:true,placeholder:"e.g. 35"},
    {key:"caloriesKcal",label:"Calories (kcal/day)",type:"number",inputmode:"numeric",value:t.caloriesKcal||"",half:true},
    {key:"netCarbsMaxG",label:"Net carbs under (g)",type:"number",inputmode:"numeric",value:t.netCarbsMaxG||"",half:true},
    {key:"waterL",label:"Water (litres)",type:"number",inputmode:"decimal",step:"0.5",value:t.waterL||"",half:true},
    {key:"birthMonth",label:"Birth month",type:"month",value:profile&&profile.birthMonth||"",half:true,hint:"Used only for your age on this screen."}
  ], async v=>{
    const nt = C.cleanTargets(Object.assign({}, t, {proteinDailyG:v.proteinDailyG, perMealProteinG:v.perMealProteinG, caloriesKcal:v.caloriesKcal, netCarbsMaxG:v.netCarbsMaxG, waterL:v.waterL}));
    targets = nt; await S.setMeta("targets", targets);
    if (v.birthMonth){ profile = C.cleanProfile(Object.assign({}, profile||{}, {birthMonth:v.birthMonth})); await S.setMeta("profile", profile); }
    render(); ctx.onChange();
  });
}
function listSheet(title, rows){
  const ov = el("div","sheet-ov"); ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true");
  const card = el("div","sheet");
  card.innerHTML = '<div class="sheet-grab"></div><h3>'+esc(title)+'</h3>'+rows.map(r=>'<div class="hrow"><div class="hr-m"><b class="mono">'+esc(r.text)+'</b><span>'+esc(r.sub)+'</span></div><button type="button" class="btn danger" data-del="'+esc(r.id)+'">Delete</button></div>').join("")+
    '<div class="sheet-acts"><button type="button" class="btn" id="ls-close">Done</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  const close = ()=>ov.remove();
  ov.addEventListener("click", e=>{ if (e.target === ov) close(); });
  card.querySelector("#ls-close").onclick = close;
  card.querySelectorAll("[data-del]").forEach(b=>b.onclick = async ()=>{
    if (!confirm("Delete this entry?")) return;
    await remove(b.dataset.del); b.closest(".hrow").remove(); render(); ctx.onChange();
  });
}
function footer(){
  const f = el("p","fine hfoot");
  f.textContent = "Personal log, kept on this phone only. Not medical advice — share the trends with your doctor.";
  return f;
}

window.SSHealth = { load, render, setContext, importData, exportData, count: ()=>health.length };
})();
