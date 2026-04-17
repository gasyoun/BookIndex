#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function escapeForTemplateLiteral(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function makeElement() {
  return {
    innerHTML: '',
    style: {},
    className: '',
    dataset: {},
    value: '',
    width: 1200,
    height: 620,
    onclick: null,
    oninput: null,
    onkeydown: null,
    onchange: null,
    onwheel: null,
    onmousedown: null,
    onmousemove: null,
    onmouseup: null,
    onmouseleave: null,
    appendChild: () => {},
    focus: () => {},
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 50 }),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'left',
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 620 }),
    setAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function buildSandbox() {
  const nodeConsole = console;
  const elementCache = new Map();
  const getElementById = (id) => {
    if (!elementCache.has(id)) elementCache.set(id, makeElement());
    return elementCache.get(id);
  };

  const sandbox = {
    console: {
      log: (...args) => nodeConsole.log(...args),
      warn: (...args) => nodeConsole.warn(...args),
      error: (...args) => nodeConsole.error(...args),
      debug: () => {},
    },
    performance,
    window: {
      innerWidth: 1366,
      innerHeight: 768,
      location: { hash: '' },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    navigator: {},
    document: {
      readyState: 'loading',
      body: makeElement(),
      getElementById,
      querySelector: () => makeElement(),
      querySelectorAll: () => [],
      createElement: () => makeElement(),
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    L: undefined,
    d3: undefined,
    Worker: undefined,
    Blob: undefined,
    URL: {
      createObjectURL: () => 'blob://kwic-profile',
      revokeObjectURL: () => {},
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function pickStressQuery(items) {
  const freq = new Map();
  for (const item of items) {
    const head = String(item && item.head ? item.head : '').toLowerCase();
    const plain = head.replace(/[^a-zа-яё]/g, '');
    for (let i = 0; i <= plain.length - 2; i++) {
      const bg = plain.slice(i, i + 2);
      if (!bg || /\d/.test(bg)) continue;
      freq.set(bg, (freq.get(bg) || 0) + 1);
    }
  }
  let best = 'ра';
  let bestScore = -1;
  for (const [bg, score] of freq.entries()) {
    if (score > bestScore) {
      best = bg;
      bestScore = score;
    }
  }
  return best;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const dataPath = path.join(root, 'app_data.json');
  const appPath = path.join(root, 'v3_app.js');

  const appDataRaw = readUtf8(dataPath);
  const appJsRaw = readUtf8(appPath);
  const fullJs = appJsRaw.replace('__APP_DATA_STRING__', '`' + escapeForTemplateLiteral(appDataRaw) + '`');

  const sandbox = buildSandbox();
  vm.createContext(sandbox);
  vm.runInContext(fullJs, sandbox, { filename: 'v3_app.js' });
  vm.runInContext('parseAppData(); normalizeAppData(); initEntityTypes();', sandbox);

  const totalPages = vm.runInContext('getTotalBookPages()', sandbox);
  const lexTopHeads = vm.runInContext(`
    (APP_DATA.lexicon || [])
      .map((it) => {
        const contexts = it && it.contexts && typeof it.contexts === 'object' ? it.contexts : {};
        let count = 0;
        for (const key of Object.keys(contexts)) {
          const arr = Array.isArray(contexts[key]) ? contexts[key] : [];
          count += arr.length;
        }
        return { head: String(it.head || ''), count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  `, sandbox);
  const stress = pickStressQuery(lexTopHeads);
  const querySet = [...new Set([
    stress,
    ...lexTopHeads.map((x) => String(x.head || '').slice(0, 8)).filter((x) => x.length >= 2),
    'энклит',
    'санск',
    'закон',
  ])].slice(0, 8);

  const iterations = 30;
  const lexMetrics = [];
  const glossMetrics = [];
  const sortMetrics = [];

  for (const query of querySet) {
    const lexRuns = [];
    const glossRuns = [];
    const sortRuns = [];
    for (let i = 0; i < iterations; i++) {
      const t1 = performance.now();
      const lexRows = vm.runInContext(`collectLexiconKwicRows(${JSON.stringify(query)}, 1, ${totalPages})`, sandbox);
      const t2 = performance.now();
      const glossRows = vm.runInContext(`collectGlossaryKwicRows(${JSON.stringify(query)}, 1, ${totalPages})`, sandbox);
      const t3 = performance.now();
      sandbox.__rowsSort = Array.isArray(lexRows) ? lexRows.slice(0, 400) : [];
      vm.runInContext('sortKwicRows(__rowsSort, "left")', sandbox);
      delete sandbox.__rowsSort;
      const t4 = performance.now();

      lexRuns.push(t2 - t1);
      glossRuns.push(t3 - t2);
      sortRuns.push(t4 - t3);

      if (i === iterations - 1) {
        lexMetrics.push({
          query,
          rows: Array.isArray(lexRows) ? lexRows.length : 0,
          truncated: !!(lexRows && lexRows._truncated === true),
          avg_ms: mean(lexRuns),
          p95_ms: percentile(lexRuns, 95),
          max_ms: Math.max(...lexRuns),
        });
        glossMetrics.push({
          query,
          rows: Array.isArray(glossRows) ? glossRows.length : 0,
          truncated: !!(glossRows && glossRows._truncated === true),
          avg_ms: mean(glossRuns),
          p95_ms: percentile(glossRuns, 95),
          max_ms: Math.max(...glossRuns),
        });
        sortMetrics.push({
          query,
          avg_ms: mean(sortRuns),
          p95_ms: percentile(sortRuns, 95),
          max_ms: Math.max(...sortRuns),
        });
      }
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    iterations,
    total_pages: totalPages,
    query_set: querySet,
    lexicon: lexMetrics,
    glossary: glossMetrics,
    sort_left_400: sortMetrics,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
