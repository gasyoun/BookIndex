# `src/runtime/` ↔ `v3_app.js` reconciled — a rebuild no longer deletes four shipped features

_Created: 03-09-2026 · Last updated: 03-09-2026_

Result note for [H3874 (Opus 5, 🔴3 hard) — reconcile src/runtime with v3_app.js before bundler work](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3874-Opus_BookIndex_v3-runtime-source-parity-reconcile_02.09.26.md),
executed by Opus 5 (`claude-opus-5`).

## What was wrong

[FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §3, measured in H2586
on 28-08-2026: `src/runtime/legacy.js` had not been written since `e30dc3f34` (H1821,
30-07-2026), and every feature shipped after it went straight into the generated
`v3_app.js`. Rebuilding therefore produced a smaller, quietly poorer file, and the only CI
gate watching — the size budget — scored the loss as a **success**.

## Where parity stands

| | committed `v3_app.js` | fresh `vite build -c vite.runtime.config.mjs` | gap |
|---|---:|---:|---:|
| before | 669 347 B | 565 605 B | **−103 742 B** |
| after | 669 347 B | 668 239 B | **−1 108 B** |
| top-level declarations before | 664 | 584 | **−87** |
| top-level declarations after | 664 | 663 | **−1** |

`v3_app.js` and `aaz-index.html` are **byte-identical to `origin/main`** — this pass changed
only `src/`, the checks and the CI wiring. The remaining 1 108 B is described under
[Residual](#residual) and costs no behaviour.

## What was actually missing

The handoff quoted "61 functions". Measured against a fresh build the loss was **87
top-level declarations, 64 of them functions**, plus **17 statements that had diverged in
place** — `renderScholarPanel` alone by 19 659 B. The four features:

| feature | handoff | what a rebuild deleted |
|---|---|---|
| Ctrl+K command palette | H1824 | `openCommandPalette`, `scoreCommandPaletteCandidate`, `wireCommandPalette`, … (18) |
| video gallery / detail / modal | H2123–H2125 | `renderVideoGalleryPanel`, `renderVideoDetailPanel`, `openVideoModal`, … (37) |
| home task tile | H2127 | `buildHomeIndexTaskEntries`, `wireHomeTasks` |
| KWIC lecture rows | — | `collectLecturesKwicRows`, `loadLecturesKwic`, and `normalizeKwicSource`'s `"lectures"` branch |

Two further pieces of drift were invisible to a function-name census and would have broken
the video route on their own: `TAB_LABELS` had lost the `video: "Видеогалерея"` tab label,
and `applyHash` had lost 588 B of video-route handling.

## How the reconcile was done, and why in that direction

Artifact → source. `v3_app.js` is where those features exist, so it is the source of record
and `src/runtime/` was the stale fork; hand-porting ~140 statements would have been a guess.
[scripts/dev/reconcile_runtime_source.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/dev/reconcile_runtime_source.mjs)
lifts them instead, in two layers:

1. **`legacy.js` regenerated wholesale.** The bundle lays modules out in import order —
   rolldown runtime, `core/state`, `core/utils`, `core/data`, `core/router`, `legacy`,
   `entry` — and the legacy statements form one contiguous run of 449, unnamed
   `window.X = X` publication blocks included. Boundaries come from rolldown's `//#region`
   markers in a *fresh* build, never from the artifact: H2586 stripped the markers there.
2. **`core/*.js` ported statement by statement** — 9 replacements and 2 additions.

**Why the lift needs no identifier rewriting.** Where core and legacy declare the same name
the bundler suffixes the *core* copy (`applyHash$1` is router's; plain `applyHash` is
legacy's). Legacy-region code was checked and provably never names a `$N` binding, so its
text is copied verbatim; only the one level of indentation the IIFE added is removed, and
lines inside template literals are left alone because the bundler never re-indents string
contents.

**What the comparison deliberately ignores.** Three differences are noise, and porting them
back would have been a regression: collision suffixes, comments (including rolldown's
`/* @__PURE__ */`), and `console.log`/`.debug`/`.info` calls. On that last class the
*source* is ahead — H2586 stripped those from the artifact to buy gzip — so porting the
artifact's `perfDebug` back would have left a no-op function with a dead local.

## Evidence

```
node scripts/check_runtime_parity.mjs     # PASS — 0 declarations lost
npm run check:js                          # node --check v3_app.js + 15 viz scripts
npm run typecheck                         # tsc, clean
npm run check:ui                          # 20 files, 0 inline styles
npm run check:perf                        # all budgets passed (181.0 KiB gzip standalone)
npm run check:security:static             # passed
python runtime_test.py                    # infrastructure smoke passed
python -m unittest discover -s tests/unit -t .   # 64 tests OK
python scripts/validate_content.py app_data.json # 0 errors, 0 warnings
python scripts/check_encoding.py          # passed
npm run build                             # aaz-index.html unchanged (CI's diff gate is green)
```

**The proof that matters: the suite was run against the *rebuilt* runtime**, not against the
committed artifact. Building `aaz-index.html` from `dist-runtime/v3_app.js` and running
Playwright gives **197/197 passed** — the same suite the committed artifact passes. Without
this pass the same experiment fails, because the four features are simply absent.

That experiment also caught a real defect mid-work. `setCurrentVideoId` was first placed
beside its caller in `core/router.js`, where `currentVideoId = …` became a write to an
unresolved global; the bundler then renamed `core/state.js`'s binding to `currentVideoId$1`
to keep the two apart, and the setter and every reader silently stopped sharing a variable.
Five video-detail tests failed. The variable and its setter now live together in
`core/state.js`, exported and imported the way every other state binding there already is —
recorded as `CROSS_MODULE_BINDINGS` in the reconciler. A declaration census alone would
never have found it: every name was present.

## The regression gate

[scripts/check_runtime_parity.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_runtime_parity.mjs),
wired as `npm run check:parity:runtime`, into `npm run check`, and as its own CI step. It
builds the runtime and fails if any base name declared in the committed artifact appears
fewer times in the build. Comparison is by *base* name with multiplicity: which of two
same-named declarations wins the plain name depends on module order, so an exact-name diff
reports a rename as a deletion, while a count drop is a genuine loss.

## Residual

Four declarations are still dropped by a build, each read in the artifact and shown to be
unreachable — the hand-written artifact has no dead-code elimination and a build does. They
are listed with their reasons in `KNOWN_ELIDED_IN_BUILD` and printed on every run:
`legacy.js`'s never-called `parseHashRoute` and `applyViewState`, the `MAX_HASH_PARTS` only
those two read, and `initLegacy`, empty since H2586 and inlined at its call site.

In the other direction the build carries three declarations the artifact does not — the
`$1` duplicates H2586 proved token-identical and hand-removed. Extra declarations cannot
delete a feature, so they are reported, not failed.

Those, plus the `console.log` scaffolding the source keeps, are the whole of the remaining
1 108 B. **The artifact was deliberately not replaced with the rebuild**: the mission was to
make the source able to reproduce it, and swapping the shipped file would re-add console
noise and the three duplicates for no user-visible gain. Doing so is now a safe, separate
decision rather than a silent feature deletion.

## What this unblocks

`treeshake`, `minify` and code-splitting were all off-limits while the source tree was a
stale fork — each would have deleted four features while `npm run check:perf` reported a
smaller file. With parity restored and gated they become ordinary options, and
[docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md)'s
route 2 (lazy-splitting a renderer) no longer has "needs the source tree reconciled first"
in front of it.

_Dr. Mārcis Gasūns_
