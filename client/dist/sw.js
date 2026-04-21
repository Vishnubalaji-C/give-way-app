const CACHE_NAME = 'giveway-ates-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: Cache core infrastructure
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

// Activate: Purge obsolete registries
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for UI, Cache-First for static assets
self.addEventListener('fetch', (event) => {
  const url = new RegExp(self.location.origin);
  
  // Skip cross-origin or non-GET requests
  if (event.request.method !== 'GET' || !url.test(event.request.url)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          // Cache successful responses for future offline use
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Return cached immediately if available, else wait for network
      return cached || networked;
    })
  );
});
