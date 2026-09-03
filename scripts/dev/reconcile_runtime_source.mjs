/**
 * @file reconcile_runtime_source.mjs
 * @description Bring `src/runtime/` back into parity with the committed `v3_app.js` (H3874).
 *
 * Direction, and why it runs artifact -> source. `v3_app.js` stopped being build output
 * somewhere after H1821 (30-07-2026): the Ctrl+K command palette (H1824), the video
 * gallery/detail/modal trio (H2123-H2125), the home task tile (H2127) and the KWIC lecture
 * rows were hand-written straight into the generated file, and further statements diverged
 * there too (`renderScholarPanel` alone by ~19 KB). The artifact is the only place that
 * behaviour exists, so it is the source of record and `src/runtime/` is the stale fork.
 * Hand-porting ~140 statements would be a guess; lifting them is a verifiable copy.
 *
 * What it does, in two layers:
 *
 *  1. **legacy.js** is regenerated wholesale from the artifact's legacy run. The bundle
 *     lays modules out in import order — rolldown runtime, core/state, core/utils,
 *     core/data, core/router, legacy, entry — and the legacy statements form one
 *     contiguous block, so the whole run (unnamed `window.X = X` publication blocks
 *     included) is lifted verbatim.
 *  2. **core/*.js** gets the declarations and statement bodies that the artifact grew and
 *     the source never did — the `currentVideoId` state binding and the routing/state-sync
 *     wiring around it.
 *
 * Identifier handling. Where core and legacy declare the same name the bundler suffixes
 * the *core* copy (`applyHash$1` is router's; plain `applyHash` is legacy's). Legacy-region
 * code provably never names a `$N` binding, so the legacy lift needs no rewriting at all.
 * Core statements do name them, and every such name is written bare in core source, so a
 * ported core statement simply has `$N` stripped from every identifier. Where H2586
 * repointed a core call site at a legacy sibling it had proven token-identical
 * (`routeVizAlias`, `parsePositiveRouteNumber`, ...), the bare name resolves to the core
 * module's own copy — the same function.
 *
 * Module boundaries come from rolldown's `//#region` markers in a *fresh* build, never
 * from the artifact: H2586 stripped the markers there.
 *
 * Usage:
 *   node scripts/dev/reconcile_runtime_source.mjs [--dry-run]
 *
 * This is a repair tool, not part of the build. `v3_app.js` is never written; verify with
 * `node scripts/check_runtime_parity.mjs` afterwards.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { readBundle, regionsOf, lineIndexer, templateInteriorLines } from '../runtime_bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT = path.join(ROOT, 'v3_app.js');
const BUILT = path.join(ROOT, 'dist-runtime', 'v3_app.js');
const RUNTIME = path.join(ROOT, 'src', 'runtime');

/** Names `entry.js` imports from `./legacy.js`, which the generated module must export. */
const LEGACY_EXPORTS = ['initLegacy', 'buildCitationWidgetHtml', 'wireCitationWidget'];

/**
 * Bundler-synthesised statements. `__exportAll` maps are generated per module from the
 * `export` keywords in source; they are never edited by hand and never ported.
 */
const SYNTHETIC = /^(?:__defProp|__exportAll|[a-z]+_exports)$/;

/**
 * Hand-added declarations whose readers live in another module, pinned to a home and wired
 * with a real `import`.
 *
 * The bundler links two modules only through an import. A free identifier stays an
 * unresolved global — and, worse, forces the bundler to rename the module binding it would
 * otherwise collide with. That is how the first draft of this reconcile broke the
 * video-detail route: `setCurrentVideoId` was placed next to its caller in router.js, its
 * `currentVideoId = ...` assignment became a global write, the bundler renamed state.js's
 * binding to `currentVideoId$1` to keep them apart, and the setter and every reader
 * (`buildHashFromState`, `captureViewState`, `applyHash`) silently stopped sharing a
 * variable. Five Playwright tests caught it. The state variable and its setter belong
 * together in state.js, exported the way every other state binding there already is.
 */
const CROSS_MODULE_BINDINGS = new Map([
  ['currentVideoId', { home: 'core/state.js', importers: ['core/router.js'] }],
  ['setCurrentVideoId', { home: 'core/state.js', importers: ['core/router.js'] }],
]);

const dryRun = process.argv.includes('--dry-run');

// --------------------------------------------------------------------------------------
// source-module parsing
// --------------------------------------------------------------------------------------

/** Top-level statements of an ES module, with ranges and whether they carry `export`. */
function readModule(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  const statements = [];
  for (const st of ast.body) {
    const node = st.type === 'ExportNamedDeclaration' && st.declaration ? st.declaration : st;
    let name = null;
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      name = node.id ? node.id.name : null;
    } else if (node.type === 'VariableDeclaration') {
      const ids = node.declarations
        .map((d) => (d.id && d.id.type === 'Identifier' ? d.id.name : null))
        .filter(Boolean);
      name = ids.length ? ids.join(',') : null;
    }
    statements.push({
      name,
      exported: st.type === 'ExportNamedDeclaration',
      start: st.start,
      end: st.end,
      text: src.slice(st.start, st.end),
    });
  }
  return { file, src, statements };
}

// --------------------------------------------------------------------------------------
// re-indentation: one bundle level off, tabs to the repo's two spaces, strings untouched
// --------------------------------------------------------------------------------------

function reindenter(bundleSrc) {
  const inside = templateInteriorLines(bundleSrc);
  const lineOf = lineIndexer(bundleSrc);
  return (stmt, dropLevels = 1) => {
    const startLine = lineOf(stmt.start);
    return stmt.text
      .split('\n')
      .map((line, offset) => {
        if (inside.has(startLine + offset)) return line;
        let tabs = 0;
        while (tabs < line.length && line[tabs] === '\t') tabs += 1;
        const kept = Math.max(0, tabs - dropLevels);
        return '  '.repeat(kept) + line.slice(tabs);
      })
      .join('\n');
  };
}

/** Strip bundler collision suffixes from every identifier. Core source writes names bare. */
function stripSuffixes(text) {
  return text.replace(/(?<![\w$.])([A-Za-z_$][\w$]*)\$\d+(?![\w$])/g, '$1');
}

// --------------------------------------------------------------------------------------
// attribution
// --------------------------------------------------------------------------------------

console.log('Building a fresh runtime bundle to read its //#region markers...');
execFileSync(
  process.execPath,
  [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '-c', 'vite.runtime.config.mjs'],
  { cwd: ROOT, stdio: 'inherit' }
);

const built = readBundle(BUILT);
const regions = regionsOf(built.src);
const lineOfBuilt = lineIndexer(built.src);
const regionAt = (line) => {
  for (const r of regions) if (line >= r.from && line <= r.to) return r.id;
  return null;
};

const CORE_FILES = ['core/state.js', 'core/utils.js', 'core/data.js', 'core/router.js'];
const modules = new Map(CORE_FILES.map((rel) => [rel, readModule(path.join(RUNTIME, rel))]));

// When legacy.js has no exported-and-imported surface of its own, rolldown emits no marker
// for it and concatenates it into the router region. Router's own statements come first
// there (one per top-level declaration in router.js, plus the synthesised `router_exports`);
// everything after them is legacy. Once legacy.js has been regenerated it does get its own
// marker, so the split is only applied when the marker is absent.
const hasLegacyRegion = regions.some((r) => /legacy\.js$/.test(r.id));
const routerDecls = hasLegacyRegion ? Infinity : modules.get('core/router.js').statements.filter((s) => s.name).length;
/** bundle name -> owning source module, for the core half only. */
const coreOwner = new Map();
let routerTaken = 0;
for (const st of built.statements) {
  if (!st.name) continue;
  const id = regionAt(lineOfBuilt(st.start));
  if (!id) continue;
  if (/router\.js$/.test(id)) {
    if (routerTaken <= routerDecls) {
      coreOwner.set(st.name, 'core/router.js');
      routerTaken += 1;
    }
  } else if (/state\.js$/.test(id)) coreOwner.set(st.name, 'core/state.js');
  else if (/utils\.js$/.test(id)) coreOwner.set(st.name, 'core/utils.js');
  else if (/data\.js$/.test(id)) coreOwner.set(st.name, 'core/data.js');
  else if (/entry\.js$/.test(id)) coreOwner.set(st.name, 'entry.js');
  else if (/runtime\.js$/.test(id)) coreOwner.set(st.name, '(bundler)');
}
console.log(`Core-owned bundle names: ${coreOwner.size}`);

// --------------------------------------------------------------------------------------
// locate the legacy run in the committed artifact
// --------------------------------------------------------------------------------------

const committed = readBundle(ARTIFACT);
const stmts = committed.statements.map((st, index) => ({ ...st, index }));
const reindent = reindenter(committed.src);

const entryFirst = stmts.find((st) => st.name && coreOwner.get(st.name) === 'entry.js');
if (!entryFirst) throw new Error('cannot find the entry.js statements in the artifact');

const lastCoreBefore = Math.max(
  ...stmts.filter((st) => st.name && coreOwner.has(st.name) && st.index < entryFirst.index).map((st) => st.index)
);
// The statement right after the last core declaration is that module's `window.X = X`
// publication block; the legacy run starts after it.
let legacyFrom = lastCoreBefore + 1;
if (!stmts[legacyFrom].name) legacyFrom += 1;
const legacyTo = entryFirst.index - 1;
const legacyRun = stmts.slice(legacyFrom, legacyTo + 1);

const strandedCore = legacyRun.filter((st) => st.name && coreOwner.has(st.name));
if (strandedCore.length) {
  throw new Error(
    `the legacy run is not contiguous — ${strandedCore.length} core statement(s) inside it: ` +
      strandedCore.map((st) => st.name).join(', ')
  );
}
console.log(`Legacy run: artifact statements ${legacyFrom}..${legacyTo} (${legacyRun.length} statements)`);

// --------------------------------------------------------------------------------------
// layer 1 — regenerate legacy.js
// --------------------------------------------------------------------------------------

const legacyBody = legacyRun.map((st) => {
  const text = reindent(st);
  return st.name && LEGACY_EXPORTS.includes(st.name) ? `export ${text}` : text;
});
const foundExports = legacyRun.filter((st) => st.name && LEGACY_EXPORTS.includes(st.name)).map((st) => st.name);
const missingExports = LEGACY_EXPORTS.filter((n) => !foundExports.includes(n));
if (missingExports.length) throw new Error(`expected export(s) absent from the legacy run: ${missingExports.join(', ')}`);

const legacyHeader = `// GENERATED FROM v3_app.js by scripts/dev/reconcile_runtime_source.mjs (H3874).
//
// The legacy UI / render layer of the runtime bundle. Between H1821 and H3874 this file was
// a stale fork of the committed v3_app.js: four shipped features and dozens of diverged
// statements lived only in the generated artifact, so rebuilding deleted them
// (FINDINGS.md §3). It was regenerated from the artifact to end that split.
//
// Edit this file and rebuild the artifact; \`npm run check:parity:runtime\` fails if the two
// drift apart again. Do not hand-edit v3_app.js.
//
// Like the pre-H3874 file, this module deliberately has no imports: it reads the core
// bindings (state/utils/data/router) as free identifiers, which the bundler resolves in the
// flattened IIFE scope.
`;

// --------------------------------------------------------------------------------------
// layer 2 — reconcile the core modules
// --------------------------------------------------------------------------------------

const builtByName = new Map(built.statements.filter((s) => s.name).map((s) => [s.name, s]));

/**
 * Normalise a statement down to the behaviour it describes, so the plan ports real drift
 * and nothing else. Three differences between the artifact and a fresh build are noise:
 *
 *  - collision suffixes (`applyHash$1` vs `applyHash`), which depend on bundle layout;
 *  - comments, including the `/* @__PURE__ *​/` annotations rolldown injects;
 *  - `console.log` / `.debug` / `.info` calls, which H2586 hand-stripped from the artifact
 *    to buy gzip. There the *source* is ahead, so porting the artifact back would delete a
 *    working diagnostic (`perfDebug` would become a no-op with a dead local). Those
 *    statements must stay as they are.
 */
function canon(text) {
  return dropConsoleCalls(
    stripSuffixes(text)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Remove `console.log|debug|info(...)` calls, counting parens so nested calls are cut whole. */
function dropConsoleCalls(text) {
  const re = /console\s*\.\s*(?:log|debug|info)\s*\(/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < text.length && depth > 0; i++) {
      const c = text[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      else if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        i += 1;
        while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
      }
    }
    if (text[i] === ';') i += 1;
    out += text.slice(last, m.index);
    last = i;
    re.lastIndex = i;
  }
  return out + text.slice(last);
}

const corePlan = new Map(CORE_FILES.map((rel) => [rel, { replace: [], append: [], imports: [] }]));
const pendingAppends = [];

for (const st of stmts) {
  if (!st.name || st.index >= legacyFrom) continue;
  if (SYNTHETIC.test(st.name)) continue;

  const owner = coreOwner.get(st.name);
  if (owner === 'entry.js' || owner === '(bundler)') continue;

  if (owner) {
    // present in both — port it only if the bodies actually differ
    const b = builtByName.get(st.name);
    if (b && canon(st.text) !== canon(b.text)) corePlan.get(owner).replace.push(st);
    continue;
  }

  // Declared in the artifact but in no source module — placed below, by readership.
  pendingAppends.push(st);
}

// Where a hand-added declaration goes is decided by who reads it, not by which region of
// the artifact it happened to be typed into. The bundler keeps a module-level binding only
// when something links to it — exported, or read by exported code — and `treeshake: false`
// does not save an unexported, unreferenced one (this is why the pre-H3874 legacy.js lost
// its 62 `legacy_*` functions). A binding read only from legacy.js, where the reader names
// it as a free identifier, would be eliminated again if it sat in a core module.
const legacyExtras = [];
/** What each core module will contain once its ports are applied. */
const moduleFinalText = new Map(
  [...corePlan].map(([rel, plan]) => [
    rel,
    modules.get(rel).src + '\n' + plan.replace.map((r) => stripSuffixes(r.text)).join('\n'),
  ])
);

for (const st of pendingAppends) {
  const bare = stripSuffixes(st.name);
  const pinned = CROSS_MODULE_BINDINGS.get(bare);
  if (pinned) {
    corePlan.get(pinned.home).append.push({ ...st, exportIt: true });
    for (const importer of pinned.importers) corePlan.get(importer).imports.push(bare);
    continue;
  }
  const reads = (text) => (text.match(new RegExp(`(?<![\\w$.])${bare}(?:\\$\\d+)?(?![\\w$])`, 'g')) || []).length;
  const home = [...corePlan.keys()].find((rel) => reads(moduleFinalText.get(rel)) > 0);
  if (home) corePlan.get(home).append.push(st);
  else legacyExtras.push(st);
}

console.log('\nCore reconciliation plan:');
for (const [rel, plan] of corePlan) {
  console.log(`  ${rel.padEnd(16)} replace ${String(plan.replace.length).padStart(2)}  add ${String(plan.append.length).padStart(2)}`);
  for (const st of plan.replace) console.log(`      ~ ${st.name}`);
  for (const st of plan.append) console.log(`      + ${st.name}`);
}

/** Apply a module's plan and return the new file text. */
function applyPlan(rel, plan) {
  const mod = modules.get(rel);
  const byName = new Map(mod.statements.filter((s) => s.name).map((s) => [s.name, s]));
  const edits = [];
  for (const st of plan.replace) {
    const target = byName.get(stripSuffixes(st.name));
    if (!target) {
      console.log(`      (skipped ~ ${st.name}: no such statement in ${rel})`);
      continue;
    }
    const ported = stripSuffixes(reindent(st, 1));
    edits.push({ start: target.start, end: target.end, text: target.exported ? `export ${ported}` : ported });
  }
  let out = mod.src;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  if (plan.append.length) {
    const added = plan.append
      .map((st) => {
        const text = stripSuffixes(reindent(st, 1));
        return st.exportIt ? `export ${text}` : text;
      })
      .join('\n');
    out = `${out.replace(/\s*$/, '')}\n\n// Restored from v3_app.js by H3874 — declarations the artifact grew and this module\n// never did (the video route's current-id binding and its setter).\n${added}\n`;
  }

  // Widen an existing `import { ... } from './state.js'` so the readers in this module bind
  // to the real declaration instead of an unresolved global.
  for (const name of plan.imports) {
    if (new RegExp(`(?<![\\w$.])${name}(?![\\w$])`).test(out.split('\n').filter((l) => /^\s*\w+,?$/.test(l)).join('\n'))) continue;
    const m = /import\s*\{([\s\S]*?)\}\s*from\s*'\.\/state\.js';/.exec(out);
    if (!m) {
      console.log(`      (could not widen the state.js import in ${rel} for ${name})`);
      continue;
    }
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (names.includes(name)) continue;
    names.push(name);
    out = out.slice(0, m.index) + `import {\n  ${names.join(',\n  ')}\n} from './state.js';` + out.slice(m.index + m[0].length);
  }
  return out;
}

// --------------------------------------------------------------------------------------
// write
// --------------------------------------------------------------------------------------

if (legacyExtras.length) {
  console.log(`\nMoved into legacy.js (read only from there): ${legacyExtras.map((s) => s.name).join(', ')}`);
  legacyBody.push(
    '',
    '// Restored from v3_app.js by H3874 — hand-added declarations that were typed into a',
    '// core region of the artifact but are read only from here, so this is where the',
    '// bundler can still see a link to them.',
    ...legacyExtras.map((st) => stripSuffixes(reindent(st)))
  );
}

// The lifted legacy code still spells these bindings with the collision suffix they carried
// while they lived in a core region (`currentSimStep$1`). Now that the declaration sits in
// this module under its bare name, the readers have to agree with it, or the bundler sees a
// free identifier, finds nothing linking to the declaration, and drops it again.
let legacyOut = `${legacyHeader}\n${legacyBody.join('\n')}\n`;
for (const st of legacyExtras) {
  const bare = stripSuffixes(st.name);
  legacyOut = legacyOut.replace(new RegExp(`(?<![\\w$.])${bare}\\$\\d+(?![\\w$])`, 'g'), bare);
}

const writes = [[path.join(RUNTIME, 'legacy.js'), legacyOut]];
for (const [rel, plan] of corePlan) {
  if (!plan.replace.length && !plan.append.length) continue;
  writes.push([path.join(RUNTIME, rel), applyPlan(rel, plan)]);
}

console.log('');
for (const [file, text] of writes) {
  const rel = path.relative(ROOT, file);
  if (dryRun) {
    console.log(`--dry-run: would write ${Buffer.byteLength(text, 'utf8')} B to ${rel}`);
  } else {
    fs.writeFileSync(file, text, 'utf8');
    console.log(`wrote ${Buffer.byteLength(text, 'utf8')} B to ${rel}`);
  }
}
console.log('\nNow run: node scripts/check_runtime_parity.mjs');
