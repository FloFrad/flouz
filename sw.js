// Service worker : l'app s'ouvre même hors ligne.
// Réseau d'abord (les mises à jour arrivent dès qu'on est en ligne), cache en secours.
// Changez VERSION à chaque mise en ligne pour nettoyer l'ancien cache.
const VERSION = "bf-v25";
const SHELL = ["./", "index.html", "styles.css", "app.js", "config.js", "example.js", "releve-pdf.js", "vendor/supabase.js",
  "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord, mais si le réseau traîne (supermarché, parking…), la version en cache s'affiche au bout de 3 s
// pendant que la nouvelle se télécharge pour la prochaine ouverture.
const WAIT = 3000;
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Supabase : jamais mis en cache
  const net = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  });
  const cached = () => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined));
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const give = r => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => cached().then(give), WAIT);
    net.then(give, () => { clearTimeout(t); cached().then(r => { give(r || Response.error()); }); });
  }));
});
