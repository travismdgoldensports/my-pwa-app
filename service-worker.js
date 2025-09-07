// service-worker.js
const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const HTML_CACHE = `html-${VERSION}`;
const OFFLINE_FALLBACK_PAGE = 'index.html'; // simple SPA fallback

// Files to precache (add your critical assets here)
const PRECACHE_ASSETS = [
  'index.html',
  'styles.css',
  'app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon-180.png',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, HTML_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  // HTML: network-first with offline fallback
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(HTML_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match(OFFLINE_FALLBACK_PAGE);
        })
    );
    return;
  }

  // Static assets: cache-first
  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|ico|json|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
  }
});
