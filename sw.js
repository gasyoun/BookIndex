const SW_URL = new URL(self.location.href);
const SW_BUILD_ID = SW_URL.searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'bookindex';
// Kept for runtime_test compatibility and legacy guard checks.
const CACHE_NAME = `bookindex-shell-${SW_BUILD_ID}`;
const SHELL_CACHE_NAME = `${CACHE_PREFIX}-shell-${SW_BUILD_ID}`;
const RUNTIME_CACHE_NAME = `${CACHE_PREFIX}-runtime-v1`;
const TILE_CACHE_NAME = `${CACHE_PREFIX}-tiles-v1`;
const MEDIA_CACHE_NAME = `${CACHE_PREFIX}-media-v1`;
const OFFLINE_URL = './aaz-index.html';

const MAX_RUNTIME_ENTRIES = 180;
const MAX_TILE_ENTRIES = 1000;
const MAX_MEDIA_ENTRIES = 400;

const EXTERNAL_ASSET_HOSTS = new Set([
  'unpkg.com',
  'cdn.jsdelivr.net',
]);

const TILE_HOSTS = new Set([
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'server.arcgisonline.com',
  'tile.opentopomap.org',
  'a.tile.opentopomap.org',
  'b.tile.opentopomap.org',
  'c.tile.opentopomap.org',
]);

const EXTERNAL_MEDIA_HOST_SUFFIXES = [
  'wikimedia.org',
  'wikimediausercontent.com',
  'gramoty.ru',
  'inslav.ru',
  'samskrtam.ru',
];

const SHELL_ASSETS = [
  './aaz-index.html',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
  './vendor/fuse.basic.min.js',
  './vendor/d3.v7.min.js',
  './vendor/alpinejs.cdn.min.js',
  './scripts/viz/build-viz-cache.js',
  './scripts/viz/build-viz-cache-worker.js',
  './scripts/viz/viz-state.js',
  './scripts/viz/cooccurrence-graph.js',
  './scripts/viz/discovery-timeline.js',
  './scripts/viz/heatmap-matrix.js',
  './scripts/viz/lang-chord.js',
  './scripts/viz/map-timeline.js',
  './scripts/viz/narrative-sankey.js',
  './scripts/viz/term-bump-chart.js',
];

function isCacheableResponse(response) {
  if (!response) return false;
  if (response.type === 'error') return false;
  if (response.type === 'opaque') return true;
  return response.status >= 200 && response.status < 300;
}

function isTileRequest(request, url) {
  if (!url || !request) return false;
  if (request.destination !== 'image') return false;
  if (TILE_HOSTS.has(url.hostname)) return true;
  if (/\/MapServer\/tile\//i.test(url.pathname)) return true;
  return false;
}

function isExternalAssetRequest(request, url) {
  if (!url || !request) return false;
  if (!EXTERNAL_ASSET_HOSTS.has(url.hostname)) return false;
  return request.destination === 'script'
    || request.destination === 'style'
    || request.destination === 'font';
}

function isExternalMediaRequest(request, url) {
  if (!url || !request) return false;
  if (isTileRequest(request, url)) return false;
  if (!(request.destination === 'image' || request.destination === 'audio' || request.destination === 'video')) {
    return false;
  }
  return EXTERNAL_MEDIA_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}

async function matchFromCaches(request, cacheNames) {
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  return null;
}

async function trimCacheEntries(cacheName, maxEntries) {
  if (!maxEntries || maxEntries <= 0) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function putInCache(cacheName, request, response, maxEntries = 0) {
  if (!isCacheableResponse(response)) return response;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (maxEntries > 0) {
      await trimCacheEntries(cacheName, maxEntries);
    }
  } catch (err) {
    // Ignore cache failures (quota, private mode); network response is still valid.
  }
  return response;
}

async function networkFirstNavigate(request) {
  try {
    const network = await fetch(request);
    await putInCache(SHELL_CACHE_NAME, request, network, 0);
    return network;
  } catch (err) {
    const fallback = await matchFromCaches(request, [SHELL_CACHE_NAME, RUNTIME_CACHE_NAME]);
    if (fallback) return fallback;
    const offline = (await caches.match(OFFLINE_URL))
      || await matchFromCaches(OFFLINE_URL, [SHELL_CACHE_NAME, RUNTIME_CACHE_NAME]);
    return offline || Response.error();
  }
}

async function cacheFirst(request, cacheName, maxEntries, fallbackCaches = []) {
  const cached = await matchFromCaches(request, [cacheName, ...fallbackCaches]);
  if (cached) return cached;
  const network = await fetch(request);
  await putInCache(cacheName, request, network, maxEntries);
  return network;
}

async function staleWhileRevalidate(request, cacheName, maxEntries, fallbackCaches = []) {
  const cached = await matchFromCaches(request, [cacheName, ...fallbackCaches]);
  const networkPromise = fetch(request)
    .then((response) => putInCache(cacheName, request, response, maxEntries))
    .catch(() => null);

  if (cached) return { response: cached, refresh: networkPromise };
  const network = await networkPromise;
  return { response: network || Response.error(), refresh: null };
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  const data = event && event.data ? event.data : null;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE_NAME, RUNTIME_CACHE_NAME, TILE_CACHE_NAME, MEDIA_CACHE_NAME]);
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !keep.has(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate' && sameOrigin) {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  if (sameOrigin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES, [SHELL_CACHE_NAME]).catch(() => Response.error()));
    return;
  }

  if (isExternalAssetRequest(request, url)) {
    event.respondWith((async () => {
      const result = await staleWhileRevalidate(request, RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES);
      if (result.refresh) event.waitUntil(result.refresh);
      return result.response;
    })());
    return;
  }

  if (isTileRequest(request, url)) {
    event.respondWith(cacheFirst(request, TILE_CACHE_NAME, MAX_TILE_ENTRIES).catch(() => Response.error()));
    return;
  }

  if (isExternalMediaRequest(request, url)) {
    event.respondWith((async () => {
      const result = await staleWhileRevalidate(request, MEDIA_CACHE_NAME, MAX_MEDIA_ENTRIES);
      if (result.refresh) event.waitUntil(result.refresh);
      return result.response;
    })());
  }
});
