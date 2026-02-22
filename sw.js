const CACHE = "tuinlog-cache-v5";
const OFFLINE_FALLBACK_URL = "./index.html";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
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

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);

    const networkPromise = fetch(e.request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(e.request, response.clone());
        }
        return response;
      });

    if (cached) {
      e.waitUntil(networkPromise.catch(() => null));
      return cached;
    }

    try {
      return await networkPromise;
    } catch {
      const fallback = await cache.match(OFFLINE_FALLBACK_URL);
      if (fallback) return fallback;
      return new Response("Offline", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
