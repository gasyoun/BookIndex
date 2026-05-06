importScripts('../vendor/fuse.basic.min.js');

let fuse = null;

self.onmessage = function(e) {
  const { type, data, query, options } = e.data;

  if (type === 'init') {
    fuse = new Fuse(data, {
      includeScore: true,
      shouldSort: true,
      threshold: 0.36,
      ignoreLocation: true,
      distance: 140,
      minMatchCharLength: 2,
      keys: [
        { name: 'searchHead', weight: 0.78 },
        { name: 'searchSecondary', weight: 0.22 },
      ],
    });
    self.postMessage({ type: 'ready' });
  }

  if (type === 'search') {
    if (!fuse) return;
    const results = fuse.search(query, options);
    self.postMessage({ type: 'results', results, query });
  }
};
