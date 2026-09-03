/**
 * @file runtime_bundle.mjs
 * @description Shared helpers for reading the runtime IIFE bundle (`v3_app.js` and any
 * fresh `vite build -c vite.runtime.config.mjs` output) as a list of real top-level
 * statements. Used by check_runtime_parity.mjs and dev/regenerate_runtime_legacy.mjs.
 *
 * The bundle is `var BookIndex = (function(exports) { ... })({})`; every declaration the
 * app publishes lives directly in that function body, so "top level" means the body of
 * that one IIFE — not the file's own top level.
 */

import fs from 'node:fs';
import { parse } from 'acorn';

/** Statement kinds that declare a binding we care about. */
function declaredName(node) {
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    return node.id ? node.id.name : null;
  }
  if (node.type === 'VariableDeclaration') {
    const ids = node.declarations
      .map((d) => (d.id && d.id.type === 'Identifier' ? d.id.name : null))
      .filter(Boolean);
    return ids.length ? ids.join(',') : null;
  }
  return null;
}

/**
 * Parse a runtime bundle and return `{ src, statements }`, where each statement carries
 * its declared name (or null), its ESTree type and its exact source range.
 */
export function readBundle(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'script', ranges: true });

  let iife = null;
  for (const st of ast.body) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations) {
      const init = d.init;
      if (init && init.type === 'CallExpression' && init.callee && init.callee.type === 'FunctionExpression') {
        iife = init.callee;
      }
    }
  }
  if (!iife) throw new Error(`no \`var BookIndex = (function(exports){...})({})\` wrapper found in ${file}`);

  const statements = iife.body.body.map((node) => ({
    name: declaredName(node),
    type: node.type,
    start: node.start,
    end: node.end,
    text: src.slice(node.start, node.end),
  }));
  return { src, statements };
}

/** Map of declared name -> statement, for the named statements only. */
export function declarationMap(bundle) {
  const out = new Map();
  for (const st of bundle.statements) if (st.name) out.set(st.name, st);
  return out;
}

/**
 * Line ranges of every template literal in a bundle, so callers can re-indent code
 * without touching string contents. Returns a Set of 1-based line numbers that sit
 * *inside* a template literal (the opening line is not included — its indentation is
 * real code).
 */
export function templateInteriorLines(src) {
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'script', ranges: true });
  const lineOf = lineIndexer(src);
  const inside = new Set();
  walk(ast, (node) => {
    if (node.type !== 'TemplateLiteral') return;
    const from = lineOf(node.start);
    const to = lineOf(node.end);
    for (let l = from + 1; l <= to; l++) inside.add(l);
  });
  return inside;
}

function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walk(child, visit);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
}

/** Build an offset -> 1-based line number lookup. */
export function lineIndexer(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * Read rolldown's `//#region <module id>` markers out of a fresh build and return
 * `[{ id, from, to }]` in 1-based line numbers. The committed artifact has none — H2586
 * stripped them — which is exactly why attribution is derived from a fresh build.
 */
export function regionsOf(src) {
  const lines = src.split('\n');
  const regions = [];
  let open = null;
  lines.forEach((line, i) => {
    const m = /^\s*\/\/#region\s+(.+)$/.exec(line);
    if (m) {
      open = { id: m[1].trim(), from: i + 1 };
      return;
    }
    if (/^\s*\/\/#endregion/.test(line) && open) {
      open.to = i + 1;
      regions.push(open);
      open = null;
    }
  });
  return regions;
}
