/* Sixty Strong — on-device storage.
   IndexedDB database "sixty-strong": store "workouts" (one record per logged session, key = id),
   store "health" (labs, weigh-ins, protein, notes, checkups; key = id — added in DB version 2)
   and store "meta" (draft session, last backup time, profile, targets, one-time flags).
   Upgrades are additive only: never delete or reshape an existing store.
   Falls back to localStorage if IndexedDB is unavailable (e.g. some private-browsing modes). */
(function(){
"use strict";
const DB_NAME = "sixty-strong", DB_VER = 2, LS_FALLBACK = "sixtystrong.fallback.v1", LS_LEGACY = "sixtystrong.v1";
let dbp = null, mode = "idb";

function open(){
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject)=>{
    if (!("indexedDB" in window)) return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if (!db.objectStoreNames.contains("workouts")) db.createObjectStore("workouts", {keyPath:"id"});
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("health")) db.createObjectStore("health", {keyPath:"id"});   // v2
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
    req.onblocked = ()=>reject(new Error("database blocked by another tab"));
  }).catch(e=>{ mode = "local"; return null; });
  return dbp;
}
function tx(db, store, rw){ return db.transaction(store, rw ? "readwrite" : "readonly").objectStore(store); }
function wrap(req){ return new Promise((res, rej)=>{ req.onsuccess = ()=>res(req.result); req.onerror = ()=>rej(req.error); }); }
function done(t){ return new Promise((res, rej)=>{ t.oncomplete = ()=>res(); t.onerror = ()=>rej(t.error); t.onabort = ()=>rej(t.error); }); }

/* localStorage fallback */
function lsRead(){
  let o; try { o = JSON.parse(localStorage.getItem(LS_FALLBACK)); } catch(e){}
  o = o || {}; o.workouts = o.workouts || {}; o.meta = o.meta || {}; o.health = o.health || {};
  return o;
}
function lsWrite(o){ try { localStorage.setItem(LS_FALLBACK, JSON.stringify(o)); return true; } catch(e){ return false; } }

async function allWorkouts(){
  const db = await open();
  if (!db){ return Object.values(lsRead().workouts); }
  return wrap(tx(db, "workouts").getAll());
}
async function putWorkouts(list){
  const db = await open();
  if (!db){ const o = lsRead(); for (const w of list) o.workouts[w.id] = w; if (!lsWrite(o)) throw new Error("Storage full"); return; }
  const t = db.transaction("workouts", "readwrite"); const s = t.objectStore("workouts");
  for (const w of list) s.put(w);
  return done(t);
}
async function deleteWorkout(id){
  const db = await open();
  if (!db){ const o = lsRead(); delete o.workouts[id]; lsWrite(o); return; }
  const t = db.transaction("workouts", "readwrite"); t.objectStore("workouts").delete(id);
  return done(t);
}
async function allHealth(){
  const db = await open();
  if (!db) return Object.values(lsRead().health);
  return wrap(tx(db, "health").getAll());
}
async function putHealth(list){
  const db = await open();
  if (!db){ const o = lsRead(); for (const h of list) o.health[h.id] = h; if (!lsWrite(o)) throw new Error("Storage full"); return; }
  const t = db.transaction("health", "readwrite"); const s = t.objectStore("health");
  for (const h of list) s.put(h);
  return done(t);
}
async function deleteHealth(id){
  const db = await open();
  if (!db){ const o = lsRead(); delete o.health[id]; lsWrite(o); return; }
  const t = db.transaction("health", "readwrite"); t.objectStore("health").delete(id);
  return done(t);
}
async function getMeta(k){
  const db = await open();
  if (!db) return lsRead().meta[k];
  return wrap(tx(db, "meta").get(k));
}
async function setMeta(k, v){
  const db = await open();
  if (!db){ const o = lsRead(); o.meta[k] = v; lsWrite(o); return; }
  const t = db.transaction("meta", "readwrite"); t.objectStore("meta").put(v, k);
  return done(t);
}
/* The original artifact kept a copy under localStorage "sixtystrong.v1". Only meaningful if the
   app is ever served from the same origin as that copy — harmless otherwise. */
function legacyLocal(){ try { const r = localStorage.getItem(LS_LEGACY); return r ? JSON.parse(r) : []; } catch(e){ return []; } }

async function persist(){
  try {
    if (navigator.storage && navigator.storage.persist){
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      return already || await navigator.storage.persist();
    }
  } catch(e){}
  return false;
}
function storageMode(){ return mode; }

window.SSStore = { open, allWorkouts, putWorkouts, deleteWorkout, allHealth, putHealth, deleteHealth, getMeta, setMeta, legacyLocal, persist, storageMode };
})();
