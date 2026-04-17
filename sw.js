const CACHE_NAME = 'bookindex-shell-v1';
const OFFLINE_URL = './aaz-index.html';
const SHELL_ASSETS = [
  './aaz-index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './vendor/fuse.basic.min.js',
];

async function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(event.request);
        await putInCache(event.request, network);
        return network;
      } catch (err) {
        const fallback = await caches.match(OFFLINE_URL);
        return fallback || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const network = await fetch(event.request);
      await putInCache(event.request, network);
      return network;
    } catch (err) {
      return Response.error();
    }
  })());
});
