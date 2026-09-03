# CLAUDE.md

_Created: 09-05-2026 · Last updated: 03-09-2026_

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BookIndex / Zalizniakiada — single-page PWA reference for A. A. Zaliznyak's scholarly legacy. UI strings, issues, commit messages, and docs are written in **Russian**; code identifiers and tooling are English.

The shipped artifact is one self-contained file: `aaz-index.html`. It inlines `app_data.json` and `v3_app.js` through `v3_template.html`; there is no runtime fetch of the knowledge base.

## Build pipeline

The primary build command is `npm run build`, which generates the standalone `aaz-index.html`.

```sh
npm run build:runtime                # src/runtime/entry.js -> v3_app.js  (rolldown, then copy)
npm run build                        # v3_template.html + v3_app.js + app_data.json -> aaz-index.html
npm run build:all                    # both, in that order
npm run build:vite                   # Vite smoke build + deploy asset copy from public/
```

**Both `v3_app.js` and `aaz-index.html` are generated and committed.** Since H4013 the chain is `src/runtime/` → `v3_app.js` → `aaz-index.html`, and CI enforces each link with a `git diff --exit-code` after rebuilding it. A runtime change therefore needs `npm run build:all` and both generated files in the same commit; editing `v3_template.html`, `app_data.json` or copied public assets needs `npm run build` alone.

`npm run build:vite` uses `vite.config.mjs` to render the same standalone template and copy deploy assets (`manifest*`, service workers, icons, `robots.txt`, `sitemap.xml`, `vendor/`, portrait image). It is a smoke/deploy wrapper, not a replacement for the tested runtime contract.

## Source layout and bundler contract

The production runtime is `v3_app.js`. Modules under `src/` are a migration/parity workbench and use ESM `import`/`export`, but `scripts/bundle.js` is a **concatenator**, not a real bundler. It strips imports/exports via regex and wraps everything in one IIFE, in the order hardcoded in `FILES_ORDER`:

```
core/state -> core/data -> core/storage -> core/ai -> core/analytics
-> core/quiz -> core/achievements -> utils/dom -> utils/linguistics
-> utils/export -> core/search -> core/router -> renderers/{scholar,lists,cards,home,materials,multimedia,viz-panels}
-> entry.js
```

Implications:
- Do not run `node scripts/bundle.js` as a routine publish step. Use it only for an explicit source-migration/parity task and inspect the generated `v3_app.js` diff carefully.
- A new file is invisible to the concatenator until it is added to `FILES_ORDER` in `scripts/bundle.js`.
- Circular imports and re-exports are unsafe; only top-level `export const/let/function/class` and bare `export {}` lines are handled.
- Do not switch production to `src/entry.js` unless the full Playwright suite proves parity first.
- `scripts/viz/*.js` are loaded separately by the page, **not** through `bundle.js`. They have their own `npm run check:js` syntax check.
- Vendored libraries (`vendor/fuse.basic.min.js`, `vendor/d3.v7.min.js`, `vendor/alpinejs.cdn.min.js`, `vendor/leaflet.css`, `vendor/leaflet.js`) are loaded locally by `v3_template.html`, not from a CDN.

## The runtime source tree (`src/runtime/`) and its parity gate

Separately from `scripts/bundle.js` above, `vite.runtime.config.mjs` builds `v3_app.js` from `src/runtime/entry.js` (rolldown, `minify: false`, `treeshake: false`). **`src/runtime/` is the source of record and `v3_app.js` is its output.**

That took two passes to get back. Between H1821 and H3874 the tree was a **stale fork**: four shipped features and dozens of diverged statements existed only in the generated `v3_app.js`, so a rebuild silently deleted them while the size budget scored the loss as a win ([FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §3). H3874 reconciled the source; H4013 retired the hand-maintained artifact and shipped the build.

```sh
npm run check:parity:runtime    # fails unless committed v3_app.js == a fresh build, byte for byte
```

Rules that follow from this:

- Runtime behaviour changes belong in `src/runtime/`, then `npm run build:all`. **Never hand-edit `v3_app.js`** — five weeks of doing exactly that is what made four shipped features un-rebuildable, and the gate now catches it on the first byte.
- `scripts/dev/reconcile_runtime_source.mjs` is a spent one-shot repair tool that ran source ← artifact. It **refuses to run** now that the artifact is byte-identical to its build, because re-running it would write rolldown's own normalisations back into the source. Do not `--force` it unless the source tree has genuinely diverged again.
- Keep literal characters the mojibake guard hunts out of `src/runtime/` — compose them, as `REPLACEMENT_CHAR` in `legacy.js` does. `scripts/check_encoding.py`'s allowlist marker is per-line and rolldown drops trailing line comments, so a literal U+FFFD in source becomes an unexcusable one in `v3_app.js` and fails `--strict`.
- `treeshake` / `minify` / code-splitting are no longer forbidden, and H4012 priced all three — **do not re-measure them.** `treeshake` −3 B gzip (safe, pointless: no dead code); `minify: true` −35 394 B gzip but **declined by МГ 03-09-2026 as "not worth"** (it mangles names, so the parity gate cannot check it, and it ends the committed artifact's diff readability); code-splitting unavailable (the IIFE lib format forces `codeSplitting` off, and there are no dynamic `import()` boundaries). Re-open `minify` only if a new feature pushes the runtime back toward its 162 000 B ceiling. Numbers: [docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md).
- Whatever you do change here, run Playwright against the **rebuilt** runtime before believing it — a declaration census alone passed while the video route was fully broken ([FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §5).
- A state variable and its setter live in the **same** module and are exported. Across modules the bundler links only through a real `import`; a free identifier stays an unresolved global and forces a collision rename (`currentVideoId` → `currentVideoId$1`), silently splitting one variable into two.
- `treeshake: false` does **not** keep an unexported, unreferenced module-level binding. Declarations read only from `legacy.js` must live in `legacy.js`.
- `dist-runtime/` is build output and is not tracked.

## Data: `app_data.json` ↔ `data/modules/`

`app_data.json` (~6.4 MB) is the single source of truth at runtime, but it is **split into `data/modules/*.json`** for reviewable diffs. CI enforces that the split and reassembly are byte-identical to the committed monolith:

```sh
npm run data:split       # app_data.json  ->  data/modules/*.json
npm run data:assemble    # data/modules/*.json  ->  app_data.json
```

When editing `app_data.json` directly, run `npm run data:split` and commit both. When editing modules, run `npm run data:assemble` and commit both. `data/modules/manifest.json` defines key ownership and the canonical `key_order` for assembly — modify it deliberately, not as a side-effect.

New corpora come in through `scripts/import_source.py` (draft → validate → merge) with sources living under `data/imports/<book_id>/draft.json`. The active book is selected via `app_data.corpus.active_book_id`.

## Required checks before publish

Codex workflow (`docs/CODEX_WORKFLOW_RU.md`) requires these before a push to `main`:

```sh
npm run build:vite                       # Vite-only build smoke
npm run build                            # rebuild aaz-index.html
python runtime_test.py                    # infrastructure/artifact smoke
npm run check:security                    # dependency audit
npm run check:security:static             # CSP/vendor/SW guard
npm run check:perf                        # artifact size budgets
python scripts/check_encoding.py          # mojibake / encoding guard (docs/ENCODING_GUARD.md)
python scripts/check_encoding.py README.md CLAUDE.md docs/*.md   # same guard over docs
python -m unittest discover -s tests/unit -t .                   # Python unit tests
python scripts/validate_content.py app_data.json
npm run check                             # typecheck + JS/UI guards + full Playwright suite
```

The optional Gemini Flash workflow is documented in `docs/GEMINI_FLASH_WORKFLOW_RU.md`. Treat Gemini Flash as a fast analysis/drafting loop only: context pack in, findings/checks/risks out, with all file edits and publishing still going through Codex, local diffs, and the checks above.

`runtime_test.py` checks the current artifact and infrastructure contracts: package scripts, generated HTML, service workers, manifest, data shape, and Node syntax. `npm run check:ui` enforces the inline-style policy via `scripts/check_inline_styles.mjs`.

## E2E (Playwright)

```sh
npm run e2e                # full Playwright suite against aaz-index.html
npm run check:e2e:smoke    # fast local subset for focused smoke checks
npm run check:redesign     # Phase U4 route harness (10 routes x desktop/mobile)
npm run e2e:headed
npx playwright test tests/e2e/smoke.spec.js -g "<test name>"   # single test
```

The static server resolves `/` to `aaz-index.html` and sets `Cache-Control: no-store`, so a stale build will not be cached. `fullyParallel: false` — tests run sequentially.

## Version & status

- Python: 3.12 (CI). Ensure `sys.stdout.reconfigure(encoding='utf-8')` and `encoding='utf-8'` on subprocess calls per global rule.
- Node: 24 (CI).
- Current release is `v4.17.3` in [CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md), [CITATION.cff](https://github.com/gasyoun/BookIndex/blob/main/CITATION.cff), and [package.json](https://github.com/gasyoun/BookIndex/blob/main/package.json) (2026-09-03). Keep all four — `package-lock.json` included — in the same release sweep; they have drifted three times now (H1825, H3566, and again at v4.17.2, where `cut_release.py` synced CHANGELOG + CITATION but left `package.json`/`-lock` behind by hand-fix). Entries land as one file per change under `changelog_queue/`, consumed by `cut_release.py` at the cut; direct bullets under `## [Unreleased]` are hook-blocked.

## Issue conventions (Codex regulation)

- Issue titles, bodies, comments are **Russian only**.
- Every issue must carry all four label groups: `priority:*`, `area:*`, `type:*`, `phase:*`.
- Run `python scripts/issue_quality_guard.py --repo gasyoun/BookIndex --issues <N> --strict-template` before closing — it catches mojibake, missing labels, and template drift.
- Russian capitalization rule: capital letters only at sentence start and for proper nouns. This applies to UI strings, list headers, glossary entries.

## Things not to do

- Do not edit `aaz-index.html` or `v3_app.js` directly — both are generated. Edit `v3_template.html`, `src/runtime/`, or `app_data.json` and rebuild.
- Do not add ESM `import`/`export` syntax that the regex stripper in `bundle.js` cannot handle (default exports, `export *`, dynamic `import()` of local modules).
- Do not commit `v3_app.js` or `aaz-index.html` out of sync with their inputs — CI rebuilds and `git diff --exit-code`s both. `npm run build:all` regenerates the pair.
- Do not bypass the modules split: editing `app_data.json` without re-running `data:split` (or vice versa) will fail the "Ensure split modules are in sync" CI step.

_Dr. Mārcis Gasūns_
