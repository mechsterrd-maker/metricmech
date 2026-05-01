// MetricMech service worker — minimal, install-only
const CACHE = 'mm-v1';
const CORE = ['/', '/index.html', '/styles.css', '/site.js', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Network-first with cache fallback (so we never serve stale calculator pages)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache same-origin successful responses for offline use
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
