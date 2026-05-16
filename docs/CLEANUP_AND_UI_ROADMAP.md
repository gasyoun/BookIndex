# BookIndex cleanup and UI roadmap

Date: 2026-05-16

Purpose: capture the current repository analysis and convert it into a practical cleanup plan, followed by a visualisation and UI redesign roadmap. This document is intentionally scoped to planning. It does not rename files, delete artifacts, or change runtime behaviour.

## Current shape

BookIndex is a static single-page PWA. The shipped app is `aaz-index.html`, built by inlining `app_data.json`, `v3_app.js`, and `v3_template.html`.

Observed repository profile:

| Area | Current state | Cleanup implication |
|---|---:|---|
| Tracked files | 5,708 | Most churn is generated content and per-entry Markdown exports. |
| Tracked size | 32.89 MB | Large, but still manageable if generated artifacts are documented clearly. |
| `src/content/*.md` | 5,546 tracked files under `src/` | Treat as generated corpus exports unless there is an explicit editorial workflow. |
| `app_data.json` | 5.83 MB | Runtime data source; keep split modules in sync. |
| `aaz-index.html` | 6.40 MB | Generated public artifact; do not hand-edit. |
| `v3_app.js` | 11,006 lines / 0.49 MB | Current production runtime source in practice. |
| `src/core`, `src/renderers`, `src/utils` | 1,633 lines total | Looks like an older partial extraction, not a faithful source for the current runtime. |
| `v3_template.html` | 4,486 lines | Holds all CSS and shell HTML; currently zero inline `style` attributes in the template. |
| Visualisation modules | 7 active lazy-loaded VIZ modules | Good foundation, but needs a unified UX shell and route-level checks. |

## Key findings

### 1. Source-of-truth drift is the highest-risk cleanup issue

`package.json` builds with `scripts/build_aaz_index.mjs`, which reads the existing `v3_app.js` directly. It does not run `scripts/bundle.js`.

At the same time, `README.md`, `CLAUDE.md`, and `docs/CODEX_WORKFLOW_RU.md` still describe `scripts/bundle.js` as part of the normal source workflow. That is risky because `scripts/bundle.js` concatenates the small `src/` tree. The current `src/` tree is much smaller than `v3_app.js` and contains incomplete or stale references such as missing state constants and placeholder migration comments.

Recommendation:

1. Freeze `scripts/bundle.js` and `src/core|renderers|utils` as historical/experimental until reconciled.
2. Update maintainer docs to say the current runtime source of truth is `v3_app.js` plus `v3_template.html`.
3. Create a separate refactor project to re-extract `v3_app.js` into modules, with tests proving parity after each slice.
4. Do not run `node scripts/bundle.js` as a routine cleanup step until that parity project is complete.

### 2. Documentation has useful content, but the status hierarchy is noisy

The repo has current docs, agent workflow docs, historical sprint docs, archived reports, and runbooks. Some are valuable, but several documents disagree on build flow, version language, and what is source vs artifact.

Specific drift:

1. `README.md` says the project is fully modular and recommends `node scripts/bundle.js`.
2. `stats.md` says v11.2 while `README.md` and `CLAUDE.md` say v17.6.
3. `docs/history/aaz-index.html` and `docs/history/SPRINT_v4.1_2026-04-20.md` are not valid UTF-8.
4. Historical docs contain old build guidance that can look current during search.

Recommendation:

1. Add a short "Current build contract" section to `README.md`.
2. Add a "Historical docs are archival" note to `docs/history/README.md` or create one.
3. Convert invalid UTF-8 history files, or move them to an explicitly binary/archive folder and exclude them from text-oriented checks.
4. Merge `stats.md` into README or regenerate it from `content_report.py`.
5. Keep only one current workflow source: preferably `docs/CODEX_WORKFLOW_RU.md`, with `CLAUDE.md` pointing at it instead of duplicating volatile details.

### 3. Generated artifacts need clearer ownership

The repo intentionally commits generated artifacts for GitHub Pages and standalone use. That is fine, but the ownership contract needs to be stricter.

Recommendation:

| Artifact | Proposed ownership |
|---|---|
| `aaz-index.html` | Generated, committed for Pages and offline use. Never hand-edit. |
| `app_data.json` | Runtime data source, generated/reassembled from `data/modules`. |
| `data/modules/*.json` | Reviewable data source slices. Must stay byte-synced with `app_data.json`. |
| `src/content/*.md` | Generated Markdown export unless an editorial owner is documented. |
| `v3_app.js` | Current runtime source until module parity is restored. |
| `v3_template.html` | Current CSS and shell source. |
| `scripts/viz/*.js` | Runtime lazy-loaded visualisation modules. |
| `docs/history/*` | Archive only. Not a source for current commands. |

### 4. Validation is strong, but not all risks are covered

Current CI already covers build, typecheck, JS syntax, inline-style guard, encoding for core files, content validation, data split/assemble sync, runtime smoke, Vite build, and Playwright.

Gaps worth closing:

1. Encoding guard currently defaults to core runtime files, not all docs.
2. No explicit check prevents `scripts/bundle.js` from being used accidentally while stale.
3. The visualisation modules are checked for syntax, but not all modules have focused visual smoke tests.
4. The UI redesign should have screenshot/geometry checks for the key routes, not only functional assertions.

## Code cleanup proposal

### Phase C1 - Stabilise the build contract

Goal: make every maintainer understand which files are live.

Tasks:

1. Update README build instructions to prefer `npm run build`.
2. Mark `scripts/bundle.js` as unsafe/stale in docs until parity is restored.
3. Add a small guard test that fails if someone runs `scripts/bundle.js` and shrinks `v3_app.js` unexpectedly.
4. Decide whether `v13_app_test.js` is still useful. If not, move it to `docs/history/` or delete it in a dedicated cleanup PR.

Acceptance checks:

1. `npm run build`
2. `npm run check:js`
3. `git diff --exit-code -- aaz-index.html` after a clean rebuild

### Phase C2 - Reconcile runtime modules

Goal: turn `src/` back into a trustworthy source tree.

Tasks:

1. Slice `v3_app.js` into modules by stable functional areas: data, router, navigation, search, cards, materials, scholar, visualisation shell, exports, persistence.
2. Replace regex stripping with a real build step or Vite library entry.
3. Keep `scripts/viz/*.js` lazy-loaded unless there is a measured reason to bundle them.
4. Add parity tests that compare route rendering before and after each extracted slice.

Acceptance checks:

1. `npm run typecheck`
2. `python runtime_test.py`
3. `npm run check:e2e`
4. Route smoke for `#v4/home/home`, `#v4/all/list`, `#v4/materials/sources`, `#v4/scholar/viz/module/viz03`

### Phase C3 - Reduce risky HTML string rendering

Goal: keep rich templates where they are harmless, but remove data-bearing `innerHTML` from high-risk paths.

Priority targets:

1. Global search result rows.
2. Entity list rows.
3. KWIC result rows.
4. Card source/context rows.
5. Visualisation tooltips and legends.

Pattern:

1. Keep shell markup as static templates.
2. Render untrusted data through DOM APIs and `textContent`.
3. Preserve `escapeHtml` as a defensive layer for remaining template joins.
4. Add route-level regression tests where rendering changes.

### Phase C4 - Data and script hygiene

Goal: make generated data workflows easy to review.

Tasks:

1. Document the canonical data edit path: modules first or monolith first, but not both casually.
2. Add a script/report that explains why `lexicon` and `lexicon_reverse` counts differ.
3. Fold repeated content-report logic into smaller helpers only after tests exist.
4. Add a JSON schema strictness plan, but keep `additionalProperties: true` until unknown legacy fields are inventoried.

## Documentation cleanup proposal

### Phase D1 - Current docs only

Create a clear current-docs set:

1. `README.md`: public overview, commands, source/artifact map.
2. `docs/CODEX_WORKFLOW_RU.md`: maintainer workflow and checks.
3. `docs/NAVIGATION_RETHINK_RU.md`: current navigation contract.
4. `docs/CLEANUP_AND_UI_ROADMAP.md`: this cleanup and redesign roadmap.
5. `KIDS_GUIDE_RU.md`: public friendly guide.

Everything in `docs/history/` should be labeled archival.

### Phase D2 - Encoding and stale-command cleanup

Tasks:

1. Convert or quarantine invalid UTF-8 files:
   - `docs/history/aaz-index.html`
   - `docs/history/SPRINT_v4.1_2026-04-20.md`
2. Remove current-looking build commands from archived docs, or add an archive banner.
3. Replace stale `node scripts/bundle.js` instructions in current docs.
4. Add a docs encoding check that can scan Markdown without false positives for intentional examples.

### Phase D3 - Generated stats

Tasks:

1. Regenerate `stats.md` from `app_data.json` or remove it.
2. Keep the version/date in one place.
3. Add a short command such as `npm run content:audit` to README's maintainer section.

## Visualisation roadmap

The existing VIZ system is a good base: modules are lazy-loaded, use `APP_DATA`, and write lightweight URL state through `scripts/viz/viz-state.js`.

### Phase V1 - Make the VIZ shell feel like one product

Routes:

1. `#v4/scholar/viz/module/viz03`
2. `#v4/scholar/viz/module/viz04`
3. `#v4/scholar/viz/module/viz02`
4. `#v4/scholar/viz/module/viz07`
5. `#v4/scholar/viz/module/viz06`
6. `#v4/scholar/viz/module/viz01`
7. `#v4/scholar/viz/module/viz05`

Tasks:

1. Standardise module headers: title, short data source chip, reset/copy-link/export actions.
2. Use one toolbar grammar: filters on the left, view/export controls on the right.
3. Give every module a consistent empty state, loading state, and error state.
4. Keep chart-specific legends inside the chart area, not in global navigation.
5. Add keyboard focus order and visible focus states for each interactive control.

Acceptance checks:

1. Each VIZ route renders without console errors.
2. Each VIZ route has no page-level horizontal overflow at 390px, 900px, and 1366px widths.
3. Each VIZ route keeps the selected module in the URL after reload.

### Phase V2 - Improve individual modules

| Module | Cleanup target | UX outcome |
|---|---|---|
| VIZ-01 map timeline | Make autoplay/reset state explicit and resilient to reduced motion. | The map can be explored as a time story without surprise motion. |
| VIZ-02 cooccurrence graph | Keep only meaningful filters; avoid thresholds that produce empty graphs. | Users see real relationships first, then refine. |
| VIZ-03 discovery timeline | Use responsive grid or compact lanes instead of a single tall column. | Desktop space is used for comparison, mobile remains readable. |
| VIZ-04 heatmap matrix | Add sticky labels, readable tooltips, and export affordance. | Dense data becomes scannable instead of decorative. |
| VIZ-05 narrative Sankey | Clarify fallback when sankey support/data is partial. | No module looks broken when optional data is missing. |
| VIZ-06 language chord | Add top-N and family filters with stable colours. | Users can reduce visual clutter without losing context. |
| VIZ-07 bump chart | Protect labels from collision and expose slider state in URL. | Rank changes are readable and shareable. |

### Phase V3 - Add one integrative visualisation

Add a "Research map" module after the shell is stable.

Concept:

1. Center on a selected entity.
2. Show linked book pages, lectures, glossary terms, names, languages, and video links.
3. Use progressive disclosure: first-degree links by default, expand on demand.
4. Share URL state: selected entity, active relation type, depth.

Why this first:

1. It reuses existing indices and `cross_links`.
2. It supports both reader and researcher workflows.
3. It gives the UI redesign a strong destination screen, not just prettier chrome.

## UI redesign roadmap

### Phase U1 - Information architecture tune-up

Keep the current first-level navigation contract:

```text
Главная / Указатели / Материалы / Аппарат / Инструменты / Практикум
```

But redesign the surfaces under it:

1. Home: move from feature showcase to task dashboard.
2. Indexes: make filtering, sorting, and selected-card preview feel like one workspace.
3. Materials: prioritise reading flow and source confidence.
4. Apparatus: separate scholarly tables from exploratory visuals.
5. Tools: collect KWIC, glossary, maps, and export utilities.
6. Practice: keep quiz/progress compact and focused.

### Phase U2 - Visual system

Current palette is warm archival brown/cream. It suits the subject, but it can become visually flat.

Direction:

1. Keep the archival base as the content background.
2. Add a restrained secondary colour for analytical controls.
3. Use semantic colour only for data categories, status, and warnings.
4. Use 6-8px radius for cards and controls.
5. Avoid oversized landing-page treatment inside the working app.
6. Prefer dense, quiet, scan-friendly panels for repeated research use.

### Phase U3 - Layout and component cleanup

Targets:

1. Header: keep title, search, and global controls compact on desktop; collapse predictably on mobile.
2. Lists: stable row height, clear hit area, no layout jump when metadata appears.
3. Cards: consistent title, source, context, actions, and cross-link sections.
4. Toolbars: standard button/input/select sizing across materials, scholar, and VIZ.
5. Mobile: bottom sheet for cards, no hidden horizontal overflow, no double navigation rows.

### Phase U4 - Verification harness for redesign

Add route-level visual checks before large redesigns:

1. `#v4/home/home`
2. `#v4/all/list`
3. `#v4/names/list`
4. `#v4/materials/lectures`
5. `#v4/materials/sources`
6. `#v4/scholar/scholar`
7. `#v4/scholar/viz/module/viz03`
8. `#v4/materials/tasks`

For each route:

1. Desktop screenshot.
2. Mobile screenshot.
3. Horizontal overflow check.
4. Main controls visible and non-overlapping.
5. No empty chart canvas when data exists.
6. Console-error budget: zero unexpected errors.

## Recommended first three PRs

1. Documentation truth pass:
   - Update `README.md`, `CLAUDE.md`, and `docs/CODEX_WORKFLOW_RU.md`.
   - Make `npm run build` the primary command.
   - Mark `scripts/bundle.js` as blocked until module parity is restored.

2. Archive hygiene pass:
   - Add `docs/history/README.md`.
   - Convert or quarantine invalid UTF-8 history files.
   - Move or delete stale generated archive artifacts in a dedicated commit.

3. VIZ shell polish:
   - Standardise the VIZ header and module controls.
   - Add Playwright checks for VIZ routes at desktop/mobile widths.
   - Keep individual chart redesigns out of this PR unless needed for consistency.

## Non-goals for the next cleanup wave

1. Do not rewrite the whole app into a framework in one pass.
2. Do not delete committed artifacts before GitHub Pages and offline needs are re-confirmed.
3. Do not rebuild `v3_app.js` from the current `src/` tree until parity is proven.
4. Do not mix data-normalisation, visual redesign, and module extraction in one PR.
