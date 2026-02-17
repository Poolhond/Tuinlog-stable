const CACHE = "tuinlog-cache-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/state.js",
  "./src/compute.js",
  "./src/actions.js",
  "./src/nav.js",
  "./src/render.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
