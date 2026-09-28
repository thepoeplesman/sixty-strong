/* Sixty Strong — service worker: makes the app open and work with no signal.
   Bump CACHE whenever any app file changes so phones pick up the new version
   (the app shows an "Update ready" banner). */
const CACHE = "sixty-strong-v1.2.4";
const SHELL = ["./", "index.html", "styles.css", "program.js", "core.js", "store.js", "health.js", "app.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const FONTS = "sixty-strong-fonts";

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k !== CACHE && k !== FONTS).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener("message", e=>{ if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e=>{
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: serve cached copy, refresh in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(caches.open(FONTS).then(async c=>{
      const hit = await c.match(req);
      const net = fetch(req).then(r=>{ if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(()=>hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;           // YouTube / exrx links etc. go straight to network
  if (url.pathname.includes("/backups/")) return;        // local-only import file; never cached

  // App files: cache first (works offline), fall back to network, then to the app page.
  e.respondWith(caches.match(req, {ignoreSearch:true}).then(hit=>hit || fetch(req).catch(()=>
    req.mode === "navigate" ? caches.match("index.html") : Response.error()
  )));
});
