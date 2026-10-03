# VIZ canonical trees — declaration + hash-drift probe (H5743)

_Created: 03-10-2026 · Last updated: 03-10-2026_

_Delivers [H5743](https://github.com/gasyoun/Uprava/blob/main/handoffs/H5743-OxAlpha_BookIndex_viz-tree-canonical-probe_03.10.26.md)
(viz-estate grill unit B3, [plan](https://github.com/gasyoun/Uprava/blob/main/VIZ_ESTATE_PLAN_AND_DECISIONS_03-10-2026.md) §1–§2).
Sibling doc: [VIZ_SHELL_EXCEPTIONS_H1605.md](https://github.com/gasyoun/BookIndex/blob/main/docs/VIZ_SHELL_EXCEPTIONS_H1605.md)._

## Declaration

| Role | Tree | What it is | Editing rule |
|---|---|---|---|
| **Canonical (source of truth)** | [`scripts/viz/`](https://github.com/gasyoun/BookIndex/tree/main/scripts/viz) | The standalone viz module tree — the only place the SPA lazily loads viz modules from (the module table in `v3_app.js`, see the shell contract in VIZ_SHELL_EXCEPTIONS_H1605). | Edit here. |
| **Canonical (source of truth)** | [`src/runtime/`](https://github.com/gasyoun/BookIndex/tree/main/src/runtime) | Runtime source; `v3_app.js` is its single build output (H4013: build output again, not hand-maintained). | Edit here; never `v3_app.js`. |
| **Build artifact** | [`v3_app.js`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js) | Generated bundle; carries the `__APP_BUILD_ID__` placeholder. | Regenerate (`npm run build`), never hand-edit; CI gates byte parity (`check:parity:runtime`). |
| **Vendored mirror (generated)** | 699 prerendered pages — `aaz-index.html`, [`scholar/viz/index.html`](https://github.com/gasyoun/BookIndex/blob/main/scholar/viz/index.html), `*/list/**/index.html` | Each page inline-embeds a byte-copy of the `v3_app.js` bundle (produced by [`scripts/prerender.mjs`](https://github.com/gasyoun/BookIndex/blob/main/scripts/prerender.mjs), build-id substituted). | Regenerate, never hand-edit. |

**The one-line rule:** there is exactly one viz module tree (`scripts/viz/`) and one
runtime source (`src/runtime/`); everything else that looks like viz code in this repo
is generated output of those two, and a hand-edit to any generated copy is drift.

## Correction of the H5743 premise

The minted handoff (and the grill plan §1 row for BookIndex) says «`scholar/viz/` — 20
modules … дублировано в `scripts/viz/`» and asks to declare `scholar/viz/` canonical.
Probed 03-10-2026 against origin/main (post PR #336, commit `be644724a`), local and
remote ([GitHub tree](https://github.com/gasyoun/BookIndex/tree/main/scholar/viz)):

- `scholar/viz/` contains exactly **one file**: a prerendered SEO landing page that
  redirects into the SPA route `#v4/scholar/viz`. It is **not** a module tree.
- `scripts/viz/` holds the real 21-file module tree (8 active + 7 inactive modules,
  `viz-shell.js`, `viz-state.js`, cache builders, css) — the canonical side.
- No second byte-copy of the modules exists anywhere in the repo; the actual mirrored
  payload is the **inline bundle copy inside the 699 prerendered pages** (see table).

So the declaration above names `scripts/viz/` + `src/runtime/` canonical and the
prerendered page set the vendored mirror — the substance of ruling 11 (name the canon,
guard the drift) executed against the real tree pair. The grill plan row should be read
with this correction.

## Motivating case (why the probe exists)

The PR [#336](https://github.com/gasyoun/BookIndex/pull/336) tooltip fix (H5623) had to
be reconciled by hand across the two code families: `scripts/viz/world-map.js` (its
`bindTooltip` now goes through `VizShell.escapeHtml`) and the bundle-side map
implementation (`src/runtime/legacy.js` → `v3_app.js` → 699 inline copies), which had
carried its own `escapeHtml` tooltip escaping since the C3 wave (H1607, PR #141). A
one-sided edit of either family is exactly the failure class this probe fails on.

## Hash-drift probe

[`scripts/check_viz_tree_drift.py`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_viz_tree_drift.py)
(stdlib-only): hashes the normalized `v3_app.js` and the inline bundle extracted from
every prerendered `index.html`; normalization rewrites the page's concrete
`build_id` back to the `__APP_BUILD_ID__` placeholder, so build-id substitution is not
drift. Exit 0 with a verdict table when in sync; exit 1 listing every drifted file.

```text
$ python scripts/check_viz_tree_drift.py            # 03-10-2026, worktree @ be644724a
VIZ tree drift probe — canonical v3_app.js vs prerendered inline bundles
canonical sha256[:16] = 8ff3c0fc986b322c  (build __APP_BUILD_ID__)

verdict  pages
-------- --------------------------------------------------
ok       699/699 inline mirrors byte-equal (normalized)
drift    0
info     3 pages carry no inline bundle (entries without the SPA)
  --     experimental/svelte-pilot/index.html
  --     index.html
  --     pipeline/index.html

PASS — every vendored mirror matches the canonical artifact.
probe exit: 0
```

Selftest (positive + negative controls, no repo writes):

```text
$ python scripts/check_viz_tree_drift.py --selftest
SELFTEST PASS — positive control (mirror) accepted, negative control (hand-edit) caught.
```

`npm run check:vizdrift` runs the same probe.

## Accepted exceptions

1. **Build-id substitution** — pages bake the concrete build id where the artifact
   carries `__APP_BUILD_ID__`. Normalized by the probe; not drift.
2. **`scripts/viz/world-map.js` vs the bundle's inline map** — two separate
   implementations of the same data-bearing-tooltip sink (the standalone one is an
   inactive module per VIZ_SHELL_EXCEPTIONS §5). Deliberately **not** hash-comparable;
   their parity is a review + e2e concern
   ([tests/e2e/dom-render-harden.spec.js](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/dom-render-harden.spec.js)).
   Recorded here so its absence from the hash probe is a decision, not a gap.

## Standing checks (who else guards what)

- `check:parity:runtime` — `v3_app.js` byte-equals the `src/runtime/` build (H4013).
- CI `git diff` gate over the regenerated prerendered tree (whole build output,
  commit `9a8e28fbc`).
- This probe — instant, build-independent, per-file listing of inline-mirror drift,
  runnable locally without `npm ci`.
