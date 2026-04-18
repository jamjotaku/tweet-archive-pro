const CACHE_NAME = 'tweet-archive-v1.2';
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/modules/api.js',
  '/static/js/modules/state.js',
  '/static/js/modules/ui.js',
  '/static/js/modules/components.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  'https://cdn.tailwindcss.com?plugins=typography',
  'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// 1. Install - Prefetch static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 2. Activate - Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

// 3. Fetch - Advanced Strategies
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Strategy: Network-First for main page and login to ensure auth state is fresh
  if (url.pathname === '/' || url.pathname === '/login' || url.pathname === '/profile') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
           const copy = response.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
           return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategy: Cache-First for static assets and images (including external twimg.com)
  const isImage = event.request.destination === 'image' || url.hostname.includes('twimg.com') || url.hostname.includes('googleusercontent.com');
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse && !isImage) {
          // Stale-while-revalidate for local JS/CSS
          fetch(event.request).then(response => {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
          });
          return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (isImage || STATIC_ASSETS.includes(url.pathname))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);
    })
  );
});
