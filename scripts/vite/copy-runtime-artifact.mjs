/**
 * @file copy-runtime-artifact.mjs
 * @description Copy the freshly built runtime bundle over the committed `v3_app.js`.
 *
 * `v3_app.js` is build output again as of H4013 — it stopped being one somewhere after
 * H1821, was hand-maintained for five weeks (which cost four shipped features from any
 * rebuild, FINDINGS.md §3), and was reconciled by H3874. This is the second half of
 * `npm run build:runtime`: vite writes to `dist-runtime/`, this puts it where
 * `v3_template.html` inlines it from.
 *
 * `npm run build` still has to run afterwards to regenerate `aaz-index.html` and the
 * prerendered pages; `npm run build:all` does both in order.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(ROOT, 'dist-runtime', 'v3_app.js');
const TARGET = path.join(ROOT, 'v3_app.js');

if (!fs.existsSync(SOURCE)) {
  console.error(`[build:runtime] ${path.relative(ROOT, SOURCE)} not found — did the vite build run?`);
  process.exit(1);
}

const built = fs.readFileSync(SOURCE);
const previous = fs.existsSync(TARGET) ? fs.readFileSync(TARGET) : null;

if (previous && previous.equals(built)) {
  console.log(`[build:runtime] v3_app.js already current (${built.length} B) — nothing to copy.`);
  process.exit(0);
}

fs.writeFileSync(TARGET, built);
const delta = previous ? built.length - previous.length : null;
console.log(
  `[build:runtime] wrote v3_app.js (${built.length} B` +
    (delta === null ? '' : `, ${delta >= 0 ? '+' : ''}${delta} B`) +
    '). Run `npm run build` to refresh aaz-index.html.'
);
