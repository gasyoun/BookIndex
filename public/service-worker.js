const CACHE_NAME = 'zalizniak-cache-v10.1';
const ASSETS = [
  './v3_template.html',
  './v3_app.js',
  './app_data.json',
  './manifest.webmanifest',
  './icon-192.svg',
  './vendor/fuse.basic.min.js',
  './vendor/d3.v7.min.js',
  './vendor/alpinejs.cdn.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  './vendor/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
