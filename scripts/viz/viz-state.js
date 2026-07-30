(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  // 'mode' / 'entity' / 'depth' / 'rel' added 30-07-2026 (H1821) for the VIZ-08
  // research map: entity-centred traversal needs the centre, the disclosure depth
  // and the active relation type to survive a reload and be shareable.
  const ALLOWED_KEYS = new Set([
    'century', 'top', 'min', 'lecture', 'filter', 'autoplay',
    'mode', 'entity', 'depth', 'rel',
  ]);

  function splitHash() {
    const raw = root.location && root.location.hash ? String(root.location.hash) : '';
    const idx = raw.indexOf('?');
    if (idx < 0) return { base: raw || '#', query: '' };
    return { base: raw.slice(0, idx) || '#', query: raw.slice(idx + 1) };
  }

  function sanitizeParams(params) {
    const next = new URLSearchParams();
    params.forEach((value, key) => {
      if (!ALLOWED_KEYS.has(String(key))) return;
      const safeValue = String(value || '').slice(0, 80);
      if (safeValue) next.set(String(key), safeValue);
    });
    return next;
  }

  function readVizParams() {
    return sanitizeParams(new URLSearchParams(splitHash().query));
  }

  function writeVizParams(patch) {
    const parts = splitHash();
    const params = readVizParams();
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (!ALLOWED_KEYS.has(String(key))) return;
      if (value === null || value === undefined || value === '') params.delete(String(key));
      else params.set(String(key), String(value).slice(0, 80));
    });
    const query = params.toString();
    if (typeof root.setVizQueryString === 'function') root.setVizQueryString(query);
    if (root.history && typeof root.history.replaceState === 'function') {
      root.history.replaceState(null, '', query ? `${parts.base}?${query}` : parts.base);
    } else if (root.location) {
      root.location.hash = query ? `${parts.base}?${query}` : parts.base;
    }
    return params;
  }

  root.readVizParams = readVizParams;
  root.writeVizParams = writeVizParams;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
