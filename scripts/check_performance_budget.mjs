import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const budgets = [
  {
    label: 'standalone HTML',
    path: 'aaz-index.html',
    maxBytes: 7_000_000,
    maxGzipBytes: 760_000,
  },
  {
    label: 'embedded app data',
    path: 'app_data.json',
    maxBytes: 6_300_000,
    maxGzipBytes: 600_000,
  },
  {
    label: 'runtime script',
    path: 'v3_app.js',
    maxBytes: 560_000,
    maxGzipBytes: 140_000,
  },
];

const vendorBudget = {
  label: 'vendor assets',
  paths: [
    'vendor/alpinejs.cdn.min.js',
    'vendor/d3.v7.min.js',
    'vendor/fuse.basic.min.js',
    'vendor/leaflet.css',
    'vendor/leaflet.js',
  ],
  maxBytes: 520_000,
  maxGzipBytes: 170_000,
};

function bytesFor(filePath) {
  const abs = path.join(root, filePath);
  const raw = readFileSync(abs);
  return {
    raw: statSync(abs).size,
    gzip: gzipSync(raw).length,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

let failed = false;

for (const item of budgets) {
  const size = bytesFor(item.path);
  console.log(`[perf] ${item.label}: ${formatBytes(size.raw)} raw, ${formatBytes(size.gzip)} gzip`);
  if (size.raw > item.maxBytes || size.gzip > item.maxGzipBytes) {
    failed = true;
    console.error(
      `[perf] ${item.label} exceeds budget: ` +
      `${formatBytes(size.raw)}/${formatBytes(item.maxBytes)} raw, ` +
      `${formatBytes(size.gzip)}/${formatBytes(item.maxGzipBytes)} gzip`
    );
  }
}

const vendorSize = vendorBudget.paths
  .map(bytesFor)
  .reduce((total, size) => ({
    raw: total.raw + size.raw,
    gzip: total.gzip + size.gzip,
  }), { raw: 0, gzip: 0 });

console.log(`[perf] ${vendorBudget.label}: ${formatBytes(vendorSize.raw)} raw, ${formatBytes(vendorSize.gzip)} gzip`);
if (vendorSize.raw > vendorBudget.maxBytes || vendorSize.gzip > vendorBudget.maxGzipBytes) {
  failed = true;
  console.error(
    `[perf] ${vendorBudget.label} exceeds budget: ` +
    `${formatBytes(vendorSize.raw)}/${formatBytes(vendorBudget.maxBytes)} raw, ` +
    `${formatBytes(vendorSize.gzip)}/${formatBytes(vendorBudget.maxGzipBytes)} gzip`
  );
}

if (failed) {
  process.exit(1);
}

console.log('[perf] Budgets passed.');
