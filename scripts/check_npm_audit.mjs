// npm audit gate with dated upstream-unpatched exceptions (H6376).
//
// Replaces the bare `npm audit --audit-level=moderate` behind check:security.
// Every vulnerability still fails CI unless it carries an explicit, unexpired
// exception entry below. Two forcing functions keep exceptions honest:
//   - reviewBy in the past            -> gate fails (exception must be re-ruled)
//   - exception matches no live vuln  -> gate fails (upstream fixed it; drop
//     the exception and bump the lockfile)
// so a bypass can never go silent or permanent.
import { execFileSync } from 'node:child_process';

const AUDIT_LEVEL = 'moderate';

// advisory id -> { reason, devOnly, reviewBy }
// devOnly asserts the vulnerable chain never ships inside a built artifact.
// GHSA-vfj7-8cjw-p6xm (braces) exception dropped 27-10-2026 (H7317): upstream
// fix landed (braces no longer in a vulnerable range in package-lock.json),
// and an exception matching no live vuln fails this gate by design.
const EXCEPTIONS = {};

function canon(id) {
  // Canonical GHSA form: uppercase prefix, lowercase base32 groups.
  return id.slice(0, 5).toUpperCase() + id.slice(5).toLowerCase();
}

function auditJson() {
  // npm audit exits non-zero when vulnerabilities exist; capture stdout either way.
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json', `--audit-level=${AUDIT_LEVEL}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        /* fall through to the error path */
      }
    }
    console.error(`[audit] failed to run npm audit: ${err.message}`);
    process.exitCode = 1;
    return null;
  }
}

function rootAdvisories(vulns, name, seen = new Set()) {
  // GHSA ids of direct advisories reachable from `name`, following package-ref
  // `via` entries transitively so a package flagged only through a parent
  // inherits the parent's advisories.
  const entry = vulns[name];
  if (!entry) return [];
  const ids = [];
  for (const via of entry.via) {
    if (typeof via === 'string') {
      if (!seen.has(via)) {
        seen.add(via);
        ids.push(...rootAdvisories(vulns, via, seen));
      }
    } else {
      const match = (via.url || '').match(/GHSA(?:-[a-z0-9]{4}){3}/i);
      ids.push(match ? canon(match[0]) : `${via.name}@${via.range}`);
    }
  }
  return ids;
}

const report = auditJson();
if (!report) process.exit(process.exitCode || 1);

const vulns = report.vulnerabilities || {};
const exceptions = Object.fromEntries(
  Object.entries(EXCEPTIONS).map(([id, exc]) => [canon(id), exc])
);
const today = new Date().toISOString().slice(0, 10);
const used = new Set();
let excepted = 0;

for (const [name, entry] of Object.entries(vulns)) {
  const ids = rootAdvisories(vulns, name);
  const active = ids.filter((id) => {
    const exc = exceptions[id];
    return exc && exc.reviewBy >= today;
  });
  if (ids.length > 0 && active.length === ids.length) {
    ids.forEach((id) => used.add(id));
    excepted += 1;
    console.log(
      `[audit] excepted ${entry.severity} ${name} (${ids.join(', ')}) — documented, review by ${
        exceptions[ids[0]].reviewBy
      }`
    );
  } else {
    const stale = ids.filter((id) => exceptions[id] && exceptions[id].reviewBy < today);
    if (stale.length) {
      console.error(
        `[audit] FAIL ${name}: exception${stale.length > 1 ? 's' : ''} ${stale.join(', ')} expired (reviewBy passed) — re-rule or fix`
      );
    } else {
      console.error(
        `[audit] FAIL ${entry.severity} ${name} (${ids.join(', ') || 'no advisory id parsed'}) — no exception, fix the dependency`
      );
    }
    process.exitCode = 1;
  }
}

for (const id of Object.keys(exceptions)) {
  if (!used.has(id)) {
    console.error(
      `[audit] FAIL exception ${id} matches no live vulnerability — upstream fix landed? Drop the exception and bump package-lock.json`
    );
    process.exitCode = 1;
  }
}

const totals = (report.metadata && report.metadata.vulnerabilities) || {};
if (!process.exitCode) {
  console.log(
    `[audit] PASS — ${excepted} vulnerable package(s) under dated exception(s), everything else clean (${JSON.stringify(totals)})`
  );
}
