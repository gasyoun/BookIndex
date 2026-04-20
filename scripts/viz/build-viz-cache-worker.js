self.importScripts('./build-viz-cache.js');

self.onmessage = function onmessage(event) {
  const payload = event && event.data ? event.data : {};
  if (payload.type !== 'build') return;
  const started = Date.now();
  try {
    const cache = self.buildVizCache(payload.appData || {});
    self.postMessage({
      ok: true,
      cache: cache,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'unknown worker error';
    self.postMessage({
      ok: false,
      error: message,
      elapsedMs: Date.now() - started,
    });
  }
};
