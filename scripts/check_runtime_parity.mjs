/**
 * @file check_runtime_parity.mjs
 * @description Regression gate for FINDINGS.md §3: prove that rebuilding the runtime from
 * `src/runtime/` still produces every top-level declaration the committed `v3_app.js`
 * publishes.
 *
 * Why this gate exists. Between H1821 (30-07-2026) and H3874 (03-09-2026) `src/runtime/`
 * was a stale fork: four shipped features — the Ctrl+K command palette, the video
 * gallery/detail/modal trio, the home task tile and the KWIC lecture rows — lived only in
 * the generated `v3_app.js`, so `vite build -c vite.runtime.config.mjs` silently dropped
 * 87 top-level declarations (64 of them functions). Every bundler-level size lever
 * (`treeshake`, `minify`, code-splitting) therefore read as a win while deleting features,
 * because the size budget was the only gate watching and it scored the loss as a success.
 *
 * Usage:
 *   node scripts/check_runtime_parity.mjs            # build, then compare
 *   node scripts/check_runtime_parity.mjs --no-build # compare against an existing dist-runtime/
 *   node scripts/check_runtime_parity.mjs --json     # machine-readable report on stdout
 *
 * Exit 0 = parity holds. Exit 1 = the source tree can no longer rebuild the artifact.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readBundle, declarationMap } from './runtime_bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'v3_app.js');
const BUILT = path.join(ROOT, 'dist-runtime', 'v3_app.js');

/**
 * Declarations the fresh build legitimately has and the committed artifact does not.
 * H2586 hand-removed these seven from the artifact after proving each was token-identical
 * to its unsuffixed sibling and repointing the call sites. They are still declared by
 * `src/runtime/core/`, so a rebuild re-emits them. Extra declarations cannot delete a
 * feature, so they are reported but do not fail the gate.
 */
const KNOWN_EXTRA_IN_BUILD = new Set([
  'rememberBoundedCacheValue$1',
  'encodeHashPart$1',
  'routeVizAlias$1',
  'routeValueAfter$1',
  'parsePositiveRouteNumber$1',
  'normalizeGlobalSearchScope$1',
  'sameViewState$1',
]);

/**
 * Declarations the committed artifact carries that a build legitimately drops. Each was
 * read in the artifact and shown to be unreachable, so losing it cannot cost behaviour —
 * the hand-written artifact simply has no dead-code elimination and a build does.
 *
 * Anything not listed here is treated as a real loss. Do not add a name without first
 * proving, in `v3_app.js` itself, that nothing calls it.
 */
const KNOWN_ELIDED_IN_BUILD = new Map([
  ['parseHashRoute', "legacy.js's copy: declared, never called (router's `parseHashRoute$1` is the live one)"],
  ['applyViewState', "legacy.js's copy: declared, never called (router's `applyViewState$1` is the live one)"],
  ['MAX_HASH_PARTS', "legacy.js's copy: read only by legacy.js's own dead `parseHashRoute`"],
  ['initLegacy', 'empty function since H2586 stripped its console.log; the bundler inlines the call'],
]);

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const skipBuild = args.has('--no-build');

function log(...parts) {
  if (!asJson) console.log(...parts);
}

if (!fs.existsSync(ARTIFACT)) {
  console.error(`FAIL: ${ARTIFACT} not found.`);
  process.exit(1);
}

if (!skipBuild) {
  log('Building the runtime bundle (vite.runtime.config.mjs)...');
  try {
    execFileSync(process.execPath, [
      path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
      'build',
      '-c',
      'vite.runtime.config.mjs',
    ], { cwd: ROOT, stdio: asJson ? 'ignore' : 'inherit' });
  } catch (err) {
    console.error(`FAIL: the runtime build itself failed: ${err.message}`);
    process.exit(1);
  }
}

if (!fs.existsSync(BUILT)) {
  console.error(`FAIL: ${BUILT} not found — run without --no-build.`);
  process.exit(1);
}

const committed = readBundle(ARTIFACT);
const built = readBundle(BUILT);
const committedDecls = declarationMap(committed);
const builtDecls = declarationMap(built);

/**
 * Compare *base* names — `applyHash` and `applyHash$1` are the same declaration under two
 * bundle layouts. The bundler appends `$N` only to break a collision, and which of two
 * same-named declarations wins the plain name depends on module order, so an exact-name
 * diff reports a rename as a deletion. What must not change is how many declarations carry
 * each base name: lose one and a feature goes with it.
 */
const baseName = (name) => name.replace(/\$\d+$/, '');

function countByBase(names) {
  const out = new Map();
  for (const name of names) {
    const base = baseName(name);
    out.set(base, (out.get(base) || 0) + 1);
  }
  return out;
}

const committedCounts = countByBase(committedDecls.keys());
const builtCounts = countByBase(builtDecls.keys());

const missing = [];
const elided = [];
for (const [base, want] of committedCounts) {
  const have = builtCounts.get(base) || 0;
  if (have >= want) continue;
  const label = want - have > 1 ? `${base} (${want - have} of ${want} lost)` : base;
  if (KNOWN_ELIDED_IN_BUILD.has(base)) elided.push(`${label} — ${KNOWN_ELIDED_IN_BUILD.get(base)}`);
  else missing.push(label);
}
const extra = [];
for (const [base, have] of builtCounts) {
  const want = committedCounts.get(base) || 0;
  if (have > want) extra.push(have - want > 1 ? `${base} (+${have - want})` : base);
}
const knownExtraBases = new Set([...KNOWN_EXTRA_IN_BUILD].map(baseName));
const unexpectedExtra = extra.filter((name) => !knownExtraBases.has(baseName(name.split(' ')[0])));

const report = {
  committedBytes: Buffer.byteLength(committed.src, 'utf8'),
  builtBytes: Buffer.byteLength(built.src, 'utf8'),
  committedDeclarations: committedDecls.size,
  committedBaseNames: committedCounts.size,
  builtDeclarations: builtDecls.size,
  builtBaseNames: builtCounts.size,
  missingFromBuild: missing,
  knownElidedInBuild: elided,
  extraInBuild: extra,
  unexpectedExtraInBuild: unexpectedExtra,
  pass: missing.length === 0,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  log('');
  log('Runtime source ↔ artifact parity');
  log(`  committed v3_app.js : ${report.committedBytes} B, ${report.committedDeclarations} top-level declarations`);
  log(`  fresh build         : ${report.builtBytes} B, ${report.builtDeclarations} top-level declarations`);
  log('');
  if (missing.length) {
    console.error(`FAIL: ${missing.length} declaration(s) exist in the committed artifact but NOT in a fresh build.`);
    console.error('A rebuild would delete them. Reconcile src/runtime/ before touching any bundler flag.');
    for (const name of missing) console.error(`  - ${name}`);
  } else {
    log('PASS: every declaration in the committed artifact survives a fresh build.');
  }
  if (elided.length) {
    log('');
    log(`Known dead-code eliminations (${elided.length}) — verified unreachable in the artifact:`);
    for (const line of elided) log(`  · ${line}`);
  }
  if (extra.length) {
    log('');
    log(`Note: ${extra.length} declaration(s) exist in the build and not in the committed artifact`);
    log(`(${extra.length - unexpectedExtra.length} of them are the known H2586 hand-removals).`);
    for (const name of extra) {
      log(`  + ${name}${knownExtraBases.has(baseName(name.split(" ")[0])) ? "  (known)" : ""}`);
    }
  }
}

process.exit(report.pass ? 0 : 1);
