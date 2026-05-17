const CACHE_NAME = 'zalizniak-cache-v10.1';
const ASSETS = [
  './index.html',
  './aaz-index.html',
  './manifest.webmanifest',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './robots.txt',
  './sitemap.xml',
  './zaliznyak_portrait.png',
  './vendor/fuse.basic.min.js',
  './vendor/d3.v7.min.js',
  './vendor/leaflet.css',
  './vendor/alpinejs.cdn.min.js',
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
  const request = event.request;
  if (!request || request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  event.respondWith(
    caches.match(request).then((response) => response || fetch(request))
  );
});
