const CACHE_NAME = 'rf4-recipes-v13';
const ASSETS = [
  './',
  'index.html',
  'ui.html',
  'css/style.css',
  'js/app.js',
  'js/components/recipe-viewer.js',
  'js/components/loadout-builder.js',
  'js/models/custom-item.js',
  'data/data.json',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(networkResponse => {
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
