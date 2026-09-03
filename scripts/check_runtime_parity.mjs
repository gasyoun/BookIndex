/**
 * @file check_runtime_parity.mjs
 * @description Gate for FINDINGS.md §3: prove that the committed `v3_app.js` is exactly
 * what `src/runtime/` builds.
 *
 * History, because the check changed shape twice. Between H1821 (30-07-2026) and H3874
 * (03-09-2026) `src/runtime/` was a stale fork: four shipped features — the Ctrl+K command
 * palette, the video gallery/detail/modal trio, the home task tile and the KWIC lecture
 * rows — lived only in the generated `v3_app.js`, so a rebuild silently dropped 87
 * top-level declarations. H3874 reconciled the source and this gate compared *declaration
 * names*, because the hand-maintained artifact and the build were never going to be
 * byte-equal. H4013 retired the hand-maintained artifact: `v3_app.js` is build output
 * again, so the gate now asserts the much stronger property.
 *
 * The assertion: `v3_app.js` == `vite build -c vite.runtime.config.mjs`, byte for byte.
 * A declaration-level diff is still printed when that fails, because "files differ" does
 * not tell you whether you lost a feature or gained a comment.
 *
 * Usage:
 *   node scripts/check_runtime_parity.mjs            # build, then compare
 *   node scripts/check_runtime_parity.mjs --no-build # compare against an existing dist-runtime/
 *   node scripts/check_runtime_parity.mjs --json     # machine-readable report on stdout
 *
 * Exit 0 = the artifact is its own build output. Exit 1 = they have drifted apart.
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

const committedBuf = fs.readFileSync(ARTIFACT);
const builtBuf = fs.readFileSync(BUILT);
const identical = committedBuf.equals(builtBuf);

/** Collision suffixes depend on bundle layout, so a rename is not a deletion. */
const baseName = (name) => name.replace(/\$\d+$/, '');

function countByBase(names) {
  const out = new Map();
  for (const name of names) {
    const base = baseName(name);
    out.set(base, (out.get(base) || 0) + 1);
  }
  return out;
}

/** Only parsed when the byte check fails — it exists to explain the failure. */
function declarationDiff() {
  const committedCounts = countByBase(declarationMap(readBundle(ARTIFACT)).keys());
  const builtCounts = countByBase(declarationMap(readBundle(BUILT)).keys());
  const missing = [];
  const extra = [];
  for (const [base, want] of committedCounts) {
    const have = builtCounts.get(base) || 0;
    if (have < want) missing.push(want - have > 1 ? `${base} (${want - have} of ${want})` : base);
  }
  for (const [base, have] of builtCounts) {
    const want = committedCounts.get(base) || 0;
    if (have > want) extra.push(have - want > 1 ? `${base} (+${have - want})` : base);
  }
  return { missing, extra, committedDeclarations: committedCounts.size, builtDeclarations: builtCounts.size };
}

const diff = identical ? { missing: [], extra: [], committedDeclarations: null, builtDeclarations: null } : declarationDiff();

const report = {
  committedBytes: committedBuf.length,
  builtBytes: builtBuf.length,
  identical,
  onlyInArtifact: diff.missing,
  onlyInBuild: diff.extra,
  pass: identical,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (identical) {
  log('');
  log(`PASS: v3_app.js is byte-identical to its build (${committedBuf.length} B).`);
} else {
  console.error('');
  console.error('FAIL: v3_app.js is NOT what src/runtime/ builds.');
  console.error(`  committed : ${committedBuf.length} B`);
  console.error(`  fresh build: ${builtBuf.length} B`);
  console.error('');
  console.error('v3_app.js is generated. Edit src/runtime/, then regenerate:');
  console.error('  npm run build:runtime && npm run build');
  console.error('If you hand-edited v3_app.js, move the change into src/runtime/ instead —');
  console.error('that divergence is what cost four shipped features between H1821 and H3874.');
  if (diff.missing.length) {
    console.error(`\nDeclared in the committed file, absent from the build (${diff.missing.length}):`);
    for (const n of diff.missing) console.error(`  - ${n}`);
  }
  if (diff.extra.length) {
    console.error(`\nDeclared in the build, absent from the committed file (${diff.extra.length}):`);
    for (const n of diff.extra) console.error(`  + ${n}`);
  }
  if (!diff.missing.length && !diff.extra.length) {
    console.error('\nNo declaration changed — the difference is in statement bodies, formatting or comments.');
    console.error('Run: npm run build:runtime && git diff -- v3_app.js');
  }
}

process.exit(report.pass ? 0 : 1);
