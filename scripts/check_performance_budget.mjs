import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const budgets = [
  {
    // Gzip ceiling raised 2026-07-30 (H1821): the VIZ-08 research-map styles cost
    // ~0.9 KiB gzip and the previous 180 KiB ceiling was already 99.7% full
    // (179,435 B on the preceding main), leaving no room for any new panel.
    // Raised again 2026-08-12 (H2127) 186_000 -> 192_000. Two facts forced it:
    // (a) main had ALREADY been over this ceiling since v4.11.5 landed on 10-08-2026
    //     (186,113 B against a 186,000 B limit — `validate-and-build` red on main for
    //     two days, unnoticed because the failure is a size assertion, not a test);
    // (b) the U1 home task tile adds a further ~562 B gzip.
    // The pattern to stop repeating: setting this ceiling ~0.3% above the current
    // artifact means the NEXT feature of any size turns the branch red for a reason
    // unrelated to that feature. 192_000 leaves ~5 KiB of real headroom.
    label: 'standalone HTML',
    path: 'aaz-index.html',
    maxBytes: 1_200_000,
    maxGzipBytes: 192_000,
  },
  {
    // Raised 2026-08-14 (H2711) 6_300_000 -> 7_000_000 raw and 600_000 -> 680_000
    // gzip for the `crosswalk` module: 377 evidence-bearing video-to-chapter edges,
    // a new data layer rather than incidental growth. Note where the bytes actually
    // go — the edges themselves are ~231 KB, but app_data is pretty-printed at
    // indent 2, so per-key indentation roughly doubles them. The reader does not pay
    // this: aaz-index.html grew by 196 B, because modules load lazily. Headroom is
    // deliberately ~5%, per this file's own lesson about ceilings set just above the
    // current artifact.
    label: 'source app data',
    path: 'app_data.json',
    maxBytes: 7_000_000,
    maxGzipBytes: 680_000,
  },
  {
    // Raised 2026-06-13 for corpus video links / KWIC; 2026-07-24 for H1604
    // video detail card (+ ~6 KiB raw); 2026-07-30 for H1824 command palette
    // (+27.8 KiB raw / +1.9 KiB gzip — nav/action registry, fuzzy scorer,
    // palette renderer). Intended size with modest headroom.
    // 2026-08-28 (H2586): a size-reduction pass took gzip 160,322 -> 158,559 B,
    // so headroom under this ceiling is 3,441 B rather than 1,678 B. Do not read
    // that as room to spend freely — the pass also established that the artifact
    // has NO dead code left (0 unreferenced functions out of 489), so the next
    // feature cannot be paid for by another trim.
    // 2026-09-03 (H3874 + H4012): `src/runtime/` was reconciled, so the claim that
    // used to sit here — "`treeshake`/`minify` are NOT available levers" — is no
    // longer true, and all three levers have now been priced against the REBUILT
    // runtime (197/197 Playwright each, not just a size read):
    //   treeshake        −3 B gzip      — safe and worthless; there is no dead code
    //   minify: true     −35 394 B gzip — safe, but mangles names (so the parity
    //                                     gate cannot check it) and ends the
    //                                     artifact's readability, which
    //                                     vite.runtime.config.mjs keeps on purpose
    //   code splitting   n/a            — the IIFE lib format forces codeSplitting
    //                                     off, and there are no dynamic import()
    //                                     boundaries to split at anyway
    // Shipping the plain build in place of the hand-maintained artifact is worth
    // 2 196 B gzip on its own. None was applied: each is a human trade, not a win.
    // RULING (МГ, 03-09-2026): `minify` DECLINED — "not worth". 35.4 KB gzip does not
    // pay for an unreadable committed artifact plus a parity gate rebuilt around a
    // mangled bundle. Do not re-open it on size grounds alone; only a new feature that
    // pushes this ceiling back toward full is a reason to revisit.
    // Moving the hard-coded scholarly tables into the data layer remains the other
    // route, and is a content-model decision.
    // Detail: docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md,
    // docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md
    label: 'runtime script',
    path: 'v3_app.js',
    maxBytes: 700_000,
    maxGzipBytes: 162_000,
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

const dataModuleBudget = {
  // Raw ceiling raised 2026-08-14 (H2711) 6_400_000 -> 6_800_000 alongside
  // app_data: 22-crosswalk.json is a new module in this directory. The gzip
  // ceiling is left alone — 626 KB against 650 KB still has real room.
  label: 'lazy app data modules',
  dir: 'data/modules',
  maxBytes: 6_800_000,
  maxGzipBytes: 650_000,
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

const dataModulePaths = readdirSync(path.join(root, dataModuleBudget.dir))
  .filter((name) => name.endsWith('.json'))
  .map((name) => path.join(dataModuleBudget.dir, name));
const dataModuleSize = dataModulePaths
  .map(bytesFor)
  .reduce((total, size) => ({
    raw: total.raw + size.raw,
    gzip: total.gzip + size.gzip,
  }), { raw: 0, gzip: 0 });

console.log(`[perf] ${dataModuleBudget.label}: ${formatBytes(dataModuleSize.raw)} raw, ${formatBytes(dataModuleSize.gzip)} gzip`);
if (dataModuleSize.raw > dataModuleBudget.maxBytes || dataModuleSize.gzip > dataModuleBudget.maxGzipBytes) {
  failed = true;
  console.error(
    `[perf] ${dataModuleBudget.label} exceeds budget: ` +
    `${formatBytes(dataModuleSize.raw)}/${formatBytes(dataModuleBudget.maxBytes)} raw, ` +
    `${formatBytes(dataModuleSize.gzip)}/${formatBytes(dataModuleBudget.maxGzipBytes)} gzip`
  );
}

if (failed) {
  process.exit(1);
}

console.log('[perf] Budgets passed.');
