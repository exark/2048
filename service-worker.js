/* Cyberpunk 2048 Service Worker */
const CACHE_NAME = 'cyberpunk-2048-v2';
const FONT_CACHE = 'cyberpunk-2048-fonts-v1';
const ASSETS = [
  '/',
  './',
  'index.html',
  'style.css',
  'game.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/maskable-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation requests: try network then fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('index.html'))
    );
    return;
  }

  // Same-origin assets
  if (url.origin === self.location.origin) {
    // Network-first for critical assets to avoid stale code
    const isCritical = request.destination === 'script' || request.destination === 'style' || request.destination === 'document';
    if (isCritical) {
      event.respondWith(
        fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => caches.match(request))
      );
      return;
    }

    // Cache-first for other same-origin assets with background refresh
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});
