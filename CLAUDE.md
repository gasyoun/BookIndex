# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BookIndex / Zalizniakiada — single-page PWA reference for A. A. Zaliznyak's scholarly legacy. UI strings, issues, commit messages, and docs are written in **Russian**; code identifiers and tooling are English.

The shipped artifact is one self-contained file: `aaz-index.html`. It inlines `app_data.json` and `v3_app.js` through `v3_template.html`; there is no runtime fetch of the knowledge base.

## Build pipeline

The primary build command is `npm run build`, which generates the standalone `aaz-index.html`.

```sh
npm run build                        # v3_template.html + v3_app.js + app_data.json -> aaz-index.html
npm run build:vite                   # Vite smoke build + deploy asset copy from public/
```

`v3_app.js` and `aaz-index.html` are committed to git. CI runs `git diff --exit-code -- aaz-index.html` after rebuilding, so changes to `v3_template.html`, `v3_app.js`, `app_data.json`, or copied public assets require `npm run build` and the generated artifact in the same commit.

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
npm run build:vite                       # Vite-only build smoke
npm run build                            # rebuild aaz-index.html
python runtime_test.py                    # infrastructure/artifact smoke
npm run check:security                    # dependency audit
npm run check:security:static             # CSP/vendor/SW guard
npm run check:perf                        # artifact size budgets
python scripts/check_encoding.py          # mojibake / encoding guard
python scripts/validate_content.py app_data.json
npm run check                             # typecheck + JS/UI guards + full Playwright suite
```

The optional Gemini Flash workflow is documented in `docs/GEMINI_FLASH_WORKFLOW_RU.md`. Treat Gemini Flash as a fast analysis/drafting loop only: context pack in, findings/checks/risks out, with all file edits and publishing still going through Codex, local diffs, and the checks above.

`runtime_test.py` checks the current artifact and infrastructure contracts: package scripts, generated HTML, service workers, manifest, data shape, and Node syntax. `npm run check:ui` enforces the inline-style policy via `scripts/check_inline_styles.mjs`.

## E2E (Playwright)

```sh
npm run e2e                # full Playwright suite against aaz-index.html
npm run check:e2e:smoke    # fast local subset for focused smoke checks
npm run e2e:headed
npx playwright test tests/e2e/smoke.spec.js -g "<test name>"   # single test
```

The static server resolves `/` to `aaz-index.html` and sets `Cache-Control: no-store`, so a stale build will not be cached. `fullyParallel: false` — tests run sequentially.

## Version & status

- Python: 3.12 (CI). Ensure `sys.stdout.reconfigure(encoding='utf-8')` and `encoding='utf-8'` on subprocess calls per global rule.
- Node: 24 (CI).
- The platform version reflected in README/changelog is `v2.2.0` for the SEO/security/CI hardening branch.

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
