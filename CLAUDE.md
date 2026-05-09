# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BookIndex / Zalizniakiada — single-page PWA reference for A. A. Zaliznyak's scholarly legacy. UI strings, issues, commit messages, and docs are written in **Russian**; code identifiers and tooling are English.

The shipped artifact is one self-contained file: `aaz-index.html`. It inlines `app_data.json` (the entire knowledge base) and `v3_app.js` (the bundled application). There is no runtime fetch of data; everything is embedded at build time.

## Build pipeline

The build runs in two stages — **bundle source modules**, then **inline into HTML**:

```sh
node scripts/bundle.js              # src/**/*.js  ->  v3_app.js
node scripts/build_aaz_index.mjs    # v3_app.js + app_data.json + v3_template.html  ->  aaz-index.html
# or via npm
npm run build                        # runs build_aaz_index.mjs only — bundle.js is NOT in the npm scripts
```

`v3_app.js` and `aaz-index.html` are **both committed to git**. CI runs `git diff --exit-code -- aaz-index.html` after rebuilding, so any change to `src/`, `app_data.json`, or `v3_template.html` requires re-bundling and re-building both files in the same commit. The Vite path (`npm run build:vite`) produces a parallel single-file artifact in `dist-vite/` and the postbuild script copies it back over `aaz-index.html` — same invariant.

`build_aaz_index.mjs` writes the HTML with a leading `﻿` BOM and a SHA1 build id derived from `(data, js, template)`; the build id replaces `__APP_BUILD_ID__` placeholders. Never strip the BOM or hand-edit the build id.

## Source layout and bundler contract

Modules under `src/` use ESM `import`/`export`, but `scripts/bundle.js` is a **concatenator**, not a real bundler. It strips imports/exports via regex and wraps everything in one IIFE, in the order hardcoded in `FILES_ORDER`:

```
core/state -> core/data -> core/storage -> core/ai -> core/analytics
-> core/quiz -> core/achievements -> utils/dom -> utils/linguistics
-> utils/export -> core/search -> core/router -> renderers/{scholar,lists,cards,home,materials,multimedia,viz-panels}
-> entry.js
```

Implications:
- A new file is invisible to the build until it is added to `FILES_ORDER` in `scripts/bundle.js`.
- Circular imports and re-exports are unsafe — only top-level `export const/let/function/class` and bare `export {}` lines are handled.
- Several runtime functions (`parseAppData`, `syncNavigationState`, `initScholarWorkspace`, `initCardNotes`, `initPremiumIntro`, `injectSemanticStyles`) are still defined in legacy code embedded in `v3_app.js` / `v3_template.html` and referenced as globals from `entry.js`. Don't assume `src/` is the only home for runtime code.
- `scripts/viz/*.js` are loaded separately by the page, **not** through `bundle.js`. They have their own `npm run check:js` syntax check.
- Vendored libraries (`vendor/fuse.basic.min.js`, `vendor/d3.v7.min.js`, `vendor/alpinejs.cdn.min.js`) and Leaflet from unpkg are loaded via `<script>` tags in `v3_template.html`, not imported.

## Data: `app_data.json` ↔ `data/modules/`

`app_data.json` (~6 MB) is the single source of truth at runtime, but it is **split into `data/modules/*.json`** for reviewable diffs. CI enforces that the split and reassembly are byte-identical to the committed monolith:

```sh
npm run data:split       # app_data.json  ->  data/modules/*.json
npm run data:assemble    # data/modules/*.json  ->  app_data.json
```

When editing `app_data.json` directly, run `npm run data:split` and commit both. When editing modules, run `npm run data:assemble` and commit both. `data/modules/manifest.json` defines key ownership and the canonical `key_order` for assembly — modify it deliberately, not as a side-effect.

New corpora come in through `scripts/import_source.py` (draft → validate → merge) with sources living under `data/imports/<book_id>/draft.json`. The active book is selected via `app_data.corpus.active_book_id`.

## Required checks before publish

Codex workflow (`docs/CODEX_WORKFLOW_RU.md`) requires these before a push to `main`:

```sh
node scripts/bundle.js                    # rebuild v3_app.js
python scripts/check_encoding.py          # mojibake / encoding guard
python scripts/validate_content.py app_data.json
python scripts/build_aaz_index.py         # legacy build path; mjs path also valid
python runtime_test.py                    # 21/21 runtime smoke
npm run check                             # typecheck + check:js + check:ui + check:e2e
```

The optional Gemini Flash workflow is documented in `docs/GEMINI_FLASH_WORKFLOW_RU.md`. Treat Gemini Flash as a fast analysis/drafting loop only: context pack in, findings/checks/risks out, with all file edits and publishing still going through Codex, local diffs, and the checks above.

`runtime_test.py` runs JS in Node with a DOM stub and exercises 21 critical functions including all card types, all visualizations, and the materials tabs. A failure prints the offending function name. `npm run check:ui` enforces the inline-style policy via `scripts/check_inline_styles.mjs`.

## E2E (Playwright)

```sh
npm run e2e                # serves aaz-index.html on 127.0.0.1:4173 via scripts/dev/static-server.mjs
npm run e2e:headed
npx playwright test tests/e2e/smoke.spec.js -g "<test name>"   # single test
```

The static server resolves `/` to `aaz-index.html` and sets `Cache-Control: no-store`, so a stale build will not be cached. `fullyParallel: false` — tests run sequentially.

## Version & status

- Python: 3.12 (CI). Ensure `sys.stdout.reconfigure(encoding='utf-8')` and `encoding='utf-8'` on subprocess calls per global rule.
- Node: 24 (CI).
- The platform version reflected in README/stats is `v17.6 «Secret Expedition»`. `entry.js` still self-identifies as `v13.0` for legacy log strings — leave it unless explicitly versioning.

## Issue conventions (Codex regulation)

- Issue titles, bodies, comments are **Russian only**.
- Every issue must carry all four label groups: `priority:*`, `area:*`, `type:*`, `phase:*`.
- Run `python scripts/issue_quality_guard.py --repo gasyoun/BookIndex --issues <N> --strict-template` before closing — it catches mojibake, missing labels, and template drift.
- Russian capitalization rule: capital letters only at sentence start and for proper nouns. This applies to UI strings, list headers, glossary entries.

## Things not to do

- Do not edit `aaz-index.html` directly — it is generated. Edit `v3_template.html`, `src/`, or `app_data.json` and rebuild.
- Do not add ESM `import`/`export` syntax that the regex stripper in `bundle.js` cannot handle (default exports, `export *`, dynamic `import()` of local modules).
- Do not commit `v3_app.js` or `aaz-index.html` out of sync with their inputs — CI will reject.
- Do not bypass the modules split: editing `app_data.json` without re-running `data:split` (or vice versa) will fail the "Ensure split modules are in sync" CI step.
