const VERSION = "v2.6.1";
const STATIC_CACHE = `heads-up-static-${VERSION}`;
const HTML_CACHE = `heads-up-html-${VERSION}`;
const OFFLINE_PAGE = "index.html";
const ASSETS = [
  "index.html",
  "game-logic.js",
  "app.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon-180.png",
  "icons/favicon.svg",
  "icons/icons-192.png",
  "icons/icons-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, HTML_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(HTML_CACHE).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match(OFFLINE_PAGE);
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (req.method === "GET" && res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
