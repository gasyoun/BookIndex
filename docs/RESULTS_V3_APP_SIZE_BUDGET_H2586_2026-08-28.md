# `v3_app.js` size-budget pass — what moved, and why the ≤157 000 B target was not reached

_Created: 28-08-2026 · Last updated: 28-08-2026_

Result note for [H2586 (Opus 5, 🟡2 medium) — optimize the v3_app.js home panel to meet its gzip size budget](https://github.com/gasyoun/Uprava/blob/main/handoffs/H2586-Opus_BookIndex_optimize-home-panel-size-budget_11.08.26.md),
executed by Opus 5 (`claude-opus-5`).

## Where the budget stands

| | raw | gzip | ceiling | headroom |
|---|---|---|---|---|
| before | 677 875 B | 160 322 B (156.6 KiB) | 162 000 B | 1 678 B (98.96 % full) |
| after | 669 347 B | 158 559 B (154.8 KiB) | 162 000 B | **3 441 B** (97.88 % full) |

Headroom is **2.05×** what it was. The handoff's stop condition asked for
≥3 KiB back (gzip ≤157 000 B); this pass returned 1 763 B. The section
["What the remaining 1 559 B would cost"](#what-the-remaining-1559b-would-cost)
says exactly what the rest would take and why it was not spent here.

Measured with `npm run check:perf`
([scripts/check_performance_budget.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs)).
The standalone-HTML budget moved with it: 182.6 → 181.0 KiB gzip against its
192 000 B ceiling.

## What was removed

Every transform below is semantics-preserving, and the whole Playwright suite
(192 tests) passes after it.

| saved (gzip) | change |
|---:|---|
| 767 B | `window.X = Y;` aliases for **function** bindings that `Object.assign(window, *_exports)` at the end of the file already publishes. State bindings were left alone — `syncStateToGlobal()` re-publishes those on every change, and the `Object.assign` copies a value, not a live binding. |
| 653 B | seven `name$1` helpers whose bodies are token-identical to their unsuffixed sibling (`sameViewState$1`, `rememberBoundedCacheValue$1`, `routeVizAlias$1`, `routeValueAfter$1`, `parsePositiveRouteNumber$1`, `normalizeGlobalSearchScope$1`, `encodeHashPart$1`); call sites repointed at the survivor. Four further pairs (`applyViewState`, `captureViewState`, `parseHashRoute`, `buildCanonicalHash`) genuinely differ and were kept. |
| 233 B | `console.log` / `console.debug` / `console.info` scaffolding. `console.error` and `console.warn` are diagnostics and stay. |
| 110 B | `//#region` / `//#endregion` markers left by rolldown, describing a module layout this artifact no longer has (see the next section). |

**Human-authored comments were deliberately not touched.** Stripping every
`//` comment line is worth another 1 967 B, but the 47 real comment lines in
this file are the only documentation the artifact has — they explain the XSS
reasoning around `appendAccentSafeText`, the canonical-URL derivation, and why
the video backlink index must not memoize before `99-extra` loads.

## The finding that constrains everything else: `v3_app.js` can no longer be rebuilt

`vite.runtime.config.mjs` builds `v3_app.js` from `src/runtime/entry.js`.
Running that build today produces a file that is **112 KB smaller and missing
61 top-level functions**:

```
npx vite build -c vite.runtime.config.mjs
  dist-runtime/v3_app.js  565.56 kB │ gzip: 132.96 kB   (committed: 677 875 B / 160 322 B)
```

The 61 missing functions are four shipped features:

| feature | handoff | functions lost by a rebuild |
|---|---|---|
| Ctrl+K command palette | H1824 | `openCommandPalette`, `scoreCommandPaletteCandidate`, `wireCommandPalette`, … (18) |
| video gallery / detail / modal | H2123, H2124, H2125 | `renderVideoGalleryPanel`, `renderVideoDetailPanel`, `openVideoModal`, … (37) |
| home task tile | H2127 | `buildHomeIndexTaskEntries`, `wireHomeTasks` |
| KWIC lecture rows | — | `collectLecturesKwicRows`, `loadLecturesKwic` |

`src/runtime/legacy.js` was last written by `e30dc3f34` (H1821, 30-07-2026);
every feature after it was committed straight into the generated
`v3_app.js`. **The artifact is now the source of record and the `src/runtime/`
tree is stale.** Practical consequences:

1. Any bundler-level optimisation — enabling `treeshake`, enabling `minify`,
   rolldown code-splitting — would silently delete those four features. None
   of them is a safe lever until the source tree is reconciled.
2. `src/runtime/legacy.js` still carries 62 `legacy_*` functions (38 KB) that
   no longer reach the artifact at all. They are dead in the source tree only.
3. Hand-editing `v3_app.js`, as the last four features did, is currently the
   only way to change runtime behaviour.

Reconciling the two is its own job, and it should happen before anyone reaches
for a bundler flag here.

## There is no dead code left to trim

The handoff proposed "dead-code trim". Three independent scans say there is
nothing to trim:

- **489 top-level functions, 0 unreferenced.** Counting references outside the
  `__exportAll` maps and the `window.X = Y` alias blocks — i.e. asking "is this
  function *published* but never *called*?" — still returns zero.
- **72 collision-suffixed (`name$N`) helpers, 0 unreferenced**; each has 3+
  call sites. Only the seven byte-identical ones above were duplicates.
- **Largest embedded data literals total 45 KB raw**, spread over 25
  declarations; the biggest single one (`ACCENT_RECON_DATA`) is 7.9 KB raw.
  There is no large removable blob.

## What the remaining 1 559 B would cost

Three routes reach gzip ≤157 000 B. None of them is a trim:

1. **Move the hard-coded scholarly tables into the data layer** (≈3.9 KB gzip).
   `ACCENT_RECON_DATA` and `chronologyMap` belong under the `scholar` key
   ([data/modules/30-scholar.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/30-scholar.json));
   `yatRoots` and `simData` belong under `phonetic_laws` / `russian_evolution`
   ([data/modules/21-materials.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/21-materials.json)).
   Both modules have headroom (lazy modules sit at 627.7 KiB against a 650 000 B
   ceiling). This is the architecturally correct move — the repo already keeps
   every other content table in `app_data.json` — but it is a **content-model
   change** to the canonical store at `APP_DATA_SCHEMA_CURRENT = 2`, not an
   optimisation, so it wants a human's ruling before 6.3 MB of curated data
   gains four renderer-shaped keys.
2. **Lazy-split a renderer to a second fetched file** (`renderScholarPanel`
   alone is 14 275 B gzip). Architecturally consistent with the existing
   `./data/modules/` fetches, but it ends the "автономный файл" property that
   [index.html](https://github.com/gasyoun/BookIndex/blob/main/index.html)
   advertises for `aaz-index.html`, and it needs the source tree reconciled
   first.
3. **Strip formatting** (comments 1 967 B, indentation 5 125 B). Rejected: see
   above on comments, and `vite.runtime.config.mjs` keeps `minify: false`
   on purpose.

## Two pre-existing red gates found on `main` (not introduced here)

1. **`aaz-index.html` was stale against `data/modules/22-crosswalk.json`.**
   The committed HTML embedded `"bytes": 258355` for that module while the
   committed module is 261 728 B, so CI's *"Ensure committed aaz-index.html is
   in sync"* step (`git diff --exit-code -- aaz-index.html` after
   `npm run build`) could not pass. The rebuild in this pass corrects it.
2. **`tests/unit/test_video_catalog_public.py::test_committed_export_is_deterministic`
   fails on `main`, and the obvious fix would destroy curated data.** The test
   asserts that the committed
   [data/video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json)
   equals a fresh build. It does not — and running the builder **removes six
   `duplicate_of` fields** (accessions pointing at 008, 017, 023, 007, 088,
   119) rather than adding anything. Those six duplicate-provenance facts were
   written straight into the generated export by `199b0d058` (H3198) with no
   backing override in
   [data/video_catalog_editorial.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_editorial.json),
   which carries exactly one (`040 → 005`, with two evidence URLs). So the
   builder is behaving correctly and the committed export is carrying
   unsourced curator facts that the next rebuild erases.

   Regenerating to make CI green would silently delete them, so it was not
   done. The honest repair is to add six overrides to the editorial overlay
   with real evidence, or to retract them — either way a curatorial call, not
   a side effect of a size pass. **This gate fails `validate-and-build` before
   the build/e2e steps are reached, so it blocks every PR, including this
   one.** Recorded as [FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §4.

## How to reproduce

```
npm run check:perf          # byte counts against every ceiling
npm run check:js            # node --check v3_app.js
npm run typecheck
npm run build               # regenerates aaz-index.html + the prerendered pages
npm run check:e2e           # 192 Playwright tests
```

_Dr. Mārcis Gasūns_
