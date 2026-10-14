#!/usr/bin/env python3
"""Hash-drift probe for the BookIndex viz trees (H5743, viz-estate grill unit B3).

Canonical vs vendored-mirror relationship, as declared in
docs/VIZ_CANONICAL_TREES_H5743.md:

  CANONICAL (edit here)
    scripts/viz/*.js      — standalone viz module tree, the only place the SPA
                            lazily loads viz modules from (v3_app.js module table).
    src/runtime/          — runtime source (entry.js + legacy.js).
    v3_app.js             — the single build artifact of src/runtime/ (H4013:
                            build output again, not hand-maintained).

  VENDORED MIRROR (generated, never hand-edit)
    699 prerendered pages (aaz-index.html, scholar/viz/index.html, */list/…)
    each inline-embed a byte-copy of the v3_app.js bundle
    (`var BookIndex = (function(exports) { …`), produced by
    scripts/prerender.mjs.

  Motivating case: the PR #336 (H5623) tooltip-escape fix had to be reconciled
  across the standalone tree and the bundle tree by hand. This probe makes any
  future one-sided edit fail loudly, listing the drifted files.

  What the probe compares
    sha256( normalize(v3_app.js) )  vs  sha256( normalize(inline script) )
    for every prerendered index.html. normalize() rewrites the concrete build id
    back to the __APP_BUILD_ID__ placeholder, so the only allowed difference
    between the artifact and its embedded mirrors is the build-id substitution.

  Accepted exceptions (recorded in docs/VIZ_CANONICAL_TREES_H5743.md)
    1. __APP_BUILD_ID__ substitution — normalized, not drift.
    2. scripts/viz/world-map.js vs the bundle's inline map implementation are
       separate implementations of the same data-bearing-tooltip sink; their
       parity is a review + e2e concern (tests/e2e/dom-render-harden.spec.js),
       deliberately NOT hashable, hence not probed here.

Usage:
  python scripts/check_viz_tree_drift.py            # probe, human table
  python scripts/check_viz_tree_drift.py --json     # machine-readable
  python scripts/check_viz_tree_drift.py --selftest # positive+negative controls

Exit 0 = all mirrors in sync (or --selftest controls pass).
Exit 1 = drift detected; every drifted file is listed.
Exit 2 = probe could not run (canonical artifact missing, etc.).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CANONICAL_NAME = "v3_app.js"
# The committed v3_app.js carries the __APP_BUILD_ID__ placeholder (H4013);
# prerender.mjs substitutes the concrete build id into every page's inline
# bundle and into the page manifest. The probe hashes the canonical as-is and
# normalizes each page by rewriting its own manifest build id back to the
# placeholder, so the only allowed difference between artifact and mirrors is
# that substitution.
PLACEHOLDER = "__APP_BUILD_ID__"
PAGE_BUILD_ID_RE = re.compile(r'"build_id":\s*"([0-9a-f]{8,16})"')
INLINE_BUNDLE_RE = re.compile(
    r"<script(?![^>]*\bsrc=)[^>]*>(\s*var BookIndex = \(function\(exports\).*?)</script>",
    re.S,
)


def normalize(source: str, build_id: str | None) -> str:
    if build_id:
        source = source.replace(build_id, PLACEHOLDER)
    return source.strip()


def canonical_digest(root: Path) -> tuple[str, str | None]:
    """Return (sha256, build_id) of the canonical artifact.

    build_id is None when the artifact carries the placeholder (the H4013
    state, the expected one); a concrete hex id is tolerated for robustness.
    """
    artifact = root / CANONICAL_NAME
    if not artifact.is_file():
        raise FileNotFoundError(f"canonical artifact missing: {artifact}")
    raw = artifact.read_text(encoding="utf-8", errors="replace")
    m = PAGE_BUILD_ID_RE.search(raw)
    build_id = m.group(1) if m else None
    return hashlib.sha256(normalize(raw, build_id).encode()).hexdigest(), build_id


def prerendered_pages(root: Path) -> list[Path]:
    return sorted(
        p
        for p in root.rglob("index.html")
        if "node_modules" not in p.parts and ".git" not in p.parts
    )


def run_probe(root: Path) -> dict:
    digest, build_id = canonical_digest(root)
    rows = []
    for page in prerendered_pages(root):
        html = page.read_text(encoding="utf-8", errors="replace")
        m = INLINE_BUNDLE_RE.search(html)
        if not m:
            rows.append({"file": str(page.relative_to(root)), "status": "no-embed"})
            continue
        pm = PAGE_BUILD_ID_RE.search(html)
        page_digest = hashlib.sha256(
            normalize(m.group(1), pm.group(1) if pm else build_id).encode()
        ).hexdigest()
        rows.append(
            {
                "file": str(page.relative_to(root)),
                "status": "ok" if page_digest == digest else "drift",
                "sha256": page_digest[:16],
            }
        )
    embeds = [r for r in rows if r["status"] in ("ok", "drift")]
    drifted = [r["file"] for r in rows if r["status"] == "drift"]
    return {
        "canonical": CANONICAL_NAME,
        "canonical_sha256": digest[:16],
        "build_id": build_id,
        "pages_scanned": len(rows),
        "embeds": len(embeds),
        "in_sync": len(embeds) - len(drifted),
        "drifted": drifted,
        "no_embed": [r["file"] for r in rows if r["status"] == "no-embed"],
        "ok": not drifted,
    }


def print_table(report: dict) -> None:
    build_label = report["build_id"] or PLACEHOLDER
    print("VIZ tree drift probe — canonical v3_app.js vs prerendered inline bundles")
    print(f"canonical sha256[:16] = {report['canonical_sha256']}  (build {build_label})")
    print()
    print(f"{'verdict':<8} pages")
    print(f"{'-' * 8} {'-' * 50}")
    print(f"{'ok':<8} {report['in_sync']}/{report['embeds']} inline mirrors byte-equal (normalized)")
    print(f"{'drift':<8} {len(report['drifted'])}")
    for f in report["drifted"]:
        print(f"  DRIFT  {f}")
    no_embed = report["no_embed"]
    if no_embed:
        print(f"{'info':<8} {len(no_embed)} pages carry no inline bundle (entries without the SPA)")
        for f in no_embed:
            print(f"  --     {f}")
    print()
    if report["ok"]:
        print("PASS — every vendored mirror matches the canonical artifact.")
    else:
        print("FAIL — drifted files listed above. Regenerate (npm run build) or re-apply")
        print("       the missing edit to the canonical side. Never hand-edit mirrors.")


def selftest() -> int:
    """Positive + negative controls: the detector must pass a true mirror and
    catch a one-sided edit. Runs against a temp fixture, no repo writes."""
    fixture_build_id = "deadbeefcafe1234"
    fixture_bundle = (
        "var BookIndex = (function(exports) {\n"
        f'\tvar APP_BUILD_ID$1 = "{PLACEHOLDER}";\n'
        "\treturn exports;\n"
        "})({});\n"
    )
    baked_bundle = fixture_bundle.replace(PLACEHOLDER, fixture_build_id)
    manifest = (
        '<script type="application/json">{"mode":"modules","build_id":"'
        + fixture_build_id
        + '"}</script>'
    )
    ok_page = manifest + "\n<script>" + baked_bundle + "</script>"
    drift_page = (
        manifest
        + "\n<script>"
        + baked_bundle.replace("return exports;", "return exports; /* hand-edit */")
        + "</script>"
    )
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / CANONICAL_NAME).write_text(fixture_bundle, encoding="utf-8")
        (tmp_path / "ok").mkdir()
        (tmp_path / "drift").mkdir()
        (tmp_path / "ok" / "index.html").write_text(ok_page, encoding="utf-8")
        (tmp_path / "drift" / "index.html").write_text(drift_page, encoding="utf-8")
        report = run_probe(tmp_path)
    problems = []
    if report["in_sync"] != 1:
        problems.append(
            f"positive control failed: expected 1 in-sync mirror, got {report['in_sync']}"
        )
    if report["drifted"] != ["drift/index.html"]:
        problems.append(
            f"negative control failed: expected drift/index.html flagged, got {report['drifted']}"
        )
    if problems:
        for p in problems:
            print(f"SELFTEST FAIL: {p}")
        return 1
    print("SELFTEST PASS — positive control (mirror) accepted, negative control (hand-edit) caught.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Hash-drift probe: canonical v3_app.js vs prerendered inline bundles (H5743)"
    )
    parser.add_argument("--json", action="store_true", help="machine-readable report")
    parser.add_argument(
        "--selftest", action="store_true", help="run positive+negative controls and exit"
    )
    args = parser.parse_args()
    if args.selftest:
        return selftest()
    try:
        report = run_probe(ROOT)
    except (FileNotFoundError, ValueError) as exc:
        print(f"PROBE ERROR: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print_table(report)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
