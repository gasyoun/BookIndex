# Gemini Flash handoff: architecture and implementation plan

Date: 2026-05-16

Use this document as the context pack for Gemini Flash when asking for analysis, draft plans, UI critique, or implementation proposals for the BookIndex cleanup and redesign work. Gemini Flash should not publish, push, close issues, or apply final changes. Its output must become a reviewable artifact for Codex to implement and verify locally.

## 1. Handoff goal

BookIndex needs a staged cleanup and redesign effort. The current system works, but there is drift between runtime code, modular source files, generated artifacts, and documentation.

Gemini Flash should help with:

1. Turning broad cleanup findings into precise implementation tasks.
2. Reviewing architecture proposals for risk and sequencing.
3. Drafting Russian UI microcopy and maintainer documentation.
4. Proposing focused Playwright smoke checks for routes and visualisations.
5. Auditing individual code or data slices when Codex supplies a narrow context pack.

Gemini Flash should not:

1. Treat `src/` as the current full source of truth.
2. Recommend running `scripts/bundle.js` as a normal build step until module parity is restored.
3. Propose a whole-app framework rewrite as the first cleanup step.
4. Modify generated artifacts directly.
5. Make final linguistic/content judgments without a source.

## 2. Current repository facts

Observed state from the 2026-05-16 analysis:

| Area | Fact | Consequence |
|---|---|---|
| Runtime artifact | `aaz-index.html` is the shipped standalone app. | It is generated and committed for GitHub Pages/offline use. |
| Runtime source | `v3_app.js` plus `v3_template.html` are the practical live source today. | Code changes should target these files unless a module extraction task says otherwise. |
| Data source | `app_data.json` is embedded into the app at build time. | Data edits must keep `data/modules/*.json` synchronized. |
| Module tree | `src/core`, `src/renderers`, `src/utils` are far smaller than `v3_app.js`. | Treat them as stale/partial until parity is proven. |
| Old bundler | `scripts/bundle.js` concatenates `src/` into `v3_app.js`. | This is unsafe as a routine step while `src/` is incomplete. |
| Build command | `npm run build` runs `scripts/build_aaz_index.mjs`. | Current build reads existing `v3_app.js`, `v3_template.html`, and `app_data.json`. |
| Visualisations | `scripts/viz/*.js` are lazy-loaded modules. | Keep this architecture; improve the shell and tests before major chart rewrites. |
| Docs | Current and historical docs disagree on build flow/version/source ownership. | First cleanup wave should establish a current-docs hierarchy. |
| Encoding | Two archived docs are invalid UTF-8. | Archive hygiene is a real task, not terminal display noise. |

## 3. New target architecture

### 3.1 Working architecture for the next cleanup wave

This is the architecture to use immediately, before module parity work is complete:

```text
data/modules/*.json
        |
        v
app_data.json
        |
        +-----------------------------+
                                      |
v3_template.html + v3_app.js + app_data.json
                                      |
                                      v
                         scripts/build_aaz_index.mjs
                                      |
                                      v
                              aaz-index.html
```

Rules:

1. `aaz-index.html` is generated. Do not edit it manually.
2. `v3_app.js` is the current runtime source until the module extraction project proves parity.
3. `v3_template.html` owns the current CSS and page shell.
4. `scripts/viz/*.js` remain separate lazy-loaded runtime modules.
5. `data/modules/*.json` and `app_data.json` must stay synchronized.
6. `src/` is not authoritative for runtime behaviour until a dedicated parity milestone says it is.

### 3.2 Target architecture after module parity

The desired long-term shape:

```text
src/runtime/
  core/
  router/
  navigation/
  search/
  cards/
  materials/
  scholar/
  viz-shell/
  export/
  persistence/

scripts/viz/
  shared/
  modules/

data/modules/
schemas/
tests/
docs/
```

Target rules:

1. Runtime code builds from `src/runtime/**` through a real bundler or Vite entry.
2. `v3_app.js` becomes generated or is retired after parity.
3. Visualisation modules stay lazy-loaded unless measured performance says otherwise.
4. Shared VIZ helpers move to `scripts/viz/shared/` or `src/runtime/viz-shell/`.
5. Tests prove route parity after each extraction slice.

## 4. Implementation plan

### Phase 0 - Documentation truth pass

Goal: stop future work from starting with the wrong build model.

Scope:

1. `README.md`
2. `CLAUDE.md`
3. `docs/CODEX_WORKFLOW_RU.md`
4. `docs/GEMINI_FLASH_WORKFLOW_RU.md`
5. `docs/CLEANUP_AND_UI_ROADMAP.md`

Tasks:

1. Make `npm run build` the primary documented build command.
2. Mark `scripts/bundle.js` as blocked/stale until module parity is restored.
3. Add a source/artifact ownership table.
4. Say explicitly that `src/` is partial, not current runtime truth.
5. Add route-level validation examples for UI work.

Acceptance checks:

```bash
python scripts/check_encoding.py README.md docs/CODEX_WORKFLOW_RU.md docs/GEMINI_FLASH_WORKFLOW_RU.md docs/CLEANUP_AND_UI_ROADMAP.md
git diff --check
```

Gemini Flash output expected:

1. A proposed replacement section for README.
2. A concise patch plan for current docs.
3. Risks if current docs continue to mention `scripts/bundle.js`.

### Phase 1 - Archive and encoding hygiene

Goal: keep useful history without letting stale or invalid files pollute current work.

Scope:

1. `docs/history/`
2. `docs/history/aaz-index.html`
3. `docs/history/SPRINT_v4.1_2026-04-20.md`
4. Any archive README/banner created for historical docs.

Tasks:

1. Add `docs/history/README.md` explaining that the folder is archival.
2. Convert invalid UTF-8 files if their content is valuable.
3. Otherwise move invalid files to an explicit binary/archive location or remove them in a dedicated PR.
4. Avoid changing current runtime or generated app files in the same PR.

Acceptance checks:

```bash
python scripts/check_encoding.py README.md docs/CODEX_WORKFLOW_RU.md docs/GEMINI_FLASH_WORKFLOW_RU.md docs/CLEANUP_AND_UI_ROADMAP.md
git diff --check
```

Optional new check:

```bash
python scripts/check_docs_encoding.py
```

Gemini Flash output expected:

1. Inventory of archive files by action: keep, convert, quarantine, delete.
2. Proposed archive README text.
3. A safe check design that avoids false positives for intentional examples like `???`.

### Phase 2 - Build safety guard

Goal: prevent accidental replacement of the live `v3_app.js` with stale `src/` output.

Scope:

1. `package.json`
2. `scripts/bundle.js`
3. A new guard script or test under `scripts/` or `tests/`
4. Documentation updates

Tasks:

1. Decide whether to remove `scripts/bundle.js` from active guidance or make it fail unless an explicit flag is passed.
2. Add a guard that compares expected runtime signatures before accepting a regenerated `v3_app.js`.
3. Keep `npm run build` stable.

Potential guard signatures:

1. `const NAV_SECTIONS = Object.freeze([`
2. `const VIZ_SCRIPT_BY_MODULE = Object.freeze({`
3. `function renderVizPanel(container)`
4. `function buildDefaultCorpusRegistry()`
5. `const KWIC_MAX_ROWS = 1200`

Acceptance checks:

```bash
npm run check:js
python runtime_test.py
```

Gemini Flash output expected:

1. Guard strategy with false-positive risk analysis.
2. Proposed command names.
3. Migration path from guard to real module build.

### Phase 3 - Runtime module parity project

Goal: make `src/` trustworthy again without a risky rewrite.

Approach:

1. Extract one slice at a time from `v3_app.js`.
2. Prove route parity before moving to the next slice.
3. Keep the standalone build behaviour unchanged.

Recommended slice order:

| Slice | Why first/next | Key checks |
|---|---|---|
| Data parsing and schema migration | Small, foundational, easy to test. | `python runtime_test.py`, data smoke. |
| Hash router and URL helpers | Needed by every feature and VIZ state. | Deep-link Playwright tests. |
| Navigation shell | Current UI contract is already tested. | `tests/e2e/navigation-architecture.spec.js`. |
| Global search | High user value, moderate risk. | Search dropdown tests. |
| Cards and lists | Main interaction surface. | Card/list route tests. |
| Materials and corpus panels | Data-heavy but route-contained. | `#v4/materials/sources`. |
| Scholar and VIZ shell | Enables visualisation redesign. | VIZ route smoke. |
| Persistence/export | Cross-cutting; do after surfaces stabilize. | Export/download tests. |

Acceptance checks per slice:

```bash
npm run typecheck
npm run check:js
python runtime_test.py
npm run check:e2e
```

Gemini Flash output expected:

1. Slice-specific dependency map.
2. Functions/constants to move.
3. Regression routes and expected visible behaviour.
4. Risk notes for globals and import/export boundaries.

### Phase 4 - Visualisation shell redesign

Goal: make all VIZ modules feel like one coherent research tool.

Scope:

1. `v3_app.js` VIZ shell functions
2. `v3_template.html` VIZ CSS
3. `scripts/viz/*.js`
4. `tests/e2e/*`

Routes:

1. `#v4/scholar/viz/module/viz03`
2. `#v4/scholar/viz/module/viz04`
3. `#v4/scholar/viz/module/viz02`
4. `#v4/scholar/viz/module/viz07`
5. `#v4/scholar/viz/module/viz06`
6. `#v4/scholar/viz/module/viz01`
7. `#v4/scholar/viz/module/viz05`

Tasks:

1. Standardise VIZ header layout: title, data source chip, reset, copy link, export where available.
2. Standardise loading, empty, and error states.
3. Use one toolbar pattern across modules.
4. Preserve lazy-loading and URL state.
5. Add visual smoke tests for desktop and mobile.

Acceptance checks:

```bash
npm run check:js
npm run check:ui
npx playwright test tests/e2e/navigation-architecture.spec.js
```

Additional route checks:

1. No horizontal overflow at 390px, 900px, and 1366px.
2. No unexpected console errors.
3. Each selected module survives reload.
4. Each chart renders non-empty content when data exists.

Gemini Flash output expected:

1. VIZ shell component inventory.
2. Proposed common control labels in Russian.
3. Per-module UX gaps.
4. Playwright smoke-test draft.

### Phase 5 - Working app UI redesign

Goal: improve the main research workflow without turning the app into a marketing page.

Information architecture remains:

```text
Главная / Указатели / Материалы / Аппарат / Инструменты / Практикум
```

Redesign priorities:

1. Home becomes a task dashboard, not a feature showcase.
2. Index pages become a stable list + filter + card-preview workspace.
3. Materials prioritize reading flow and source confidence.
4. Apparatus separates scholarly tables from exploratory visualisations.
5. Tools gather KWIC, glossary, maps, and export utilities.
6. Practice keeps quiz/progress compact.

Design constraints:

1. Keep the interface dense, quiet, and research-oriented.
2. Avoid oversized hero treatment inside `aaz-index.html`.
3. Use archival warm base colours, but add one restrained analytical accent.
4. Keep cards and controls at 6-8px radius.
5. Avoid duplicate navigation rows and breadcrumbs.
6. No incoherent text overlap at mobile or desktop widths.

Acceptance routes:

1. `#v4/home/home`
2. `#v4/all/list`
3. `#v4/names/list`
4. `#v4/materials/lectures`
5. `#v4/materials/sources`
6. `#v4/scholar/scholar`
7. `#v4/scholar/viz/module/viz03`
8. `#v4/materials/tasks`

Gemini Flash output expected:

1. Screen-by-screen redesign proposal.
2. Component inventory and naming.
3. Russian UI microcopy.
4. Before/after risks.
5. Visual regression checklist.

## 5. Gemini Flash task packet template

Use this template when sending a focused task to Gemini Flash:

```md
# Gemini Flash task packet

## Goal
...

## Allowed scope
- Files:
  - `...`
- Routes:
  - `aaz-index.html#v4/...`

## Do not touch
- `aaz-index.html` directly.
- `app_data.json` unless this task is explicitly about data.
- `scripts/bundle.js` output path unless this task is explicitly about build safety.

## Current architecture facts
- `v3_app.js` is the practical runtime source today.
- `v3_template.html` owns the current CSS and shell.
- `scripts/viz/*.js` are lazy-loaded runtime modules.
- `src/` is partial/stale until parity is proven.

## Expected output
- Findings
- Proposed implementation steps
- Files/functions likely affected
- Route checks
- Risks and unknowns

## Validation commands to consider
- `npm run check:js`
- `npm run check:ui`
- `python runtime_test.py`
- `npm run check:e2e`
- `python scripts/check_encoding.py ...`
```

## 6. Flash output review rubric

Codex should reject or rewrite Gemini Flash output if it:

1. Assumes the current `src/` tree can rebuild the full app.
2. Suggests hand-editing `aaz-index.html`.
3. Mixes unrelated data normalization with UI redesign.
4. Adds large dependencies for small UI improvements.
5. Uses English for user-facing Russian UI without a reason.
6. Lacks route-level checks.
7. Lacks a rollback or residual-risk note for architecture changes.

Codex can accept Gemini Flash output if it:

1. Names exact files and functions.
2. Separates source files from generated artifacts.
3. Gives a small implementation sequence.
4. Includes verification commands and routes.
5. Flags uncertainty instead of presenting guesses as facts.

## 7. First Gemini Flash assignment

Recommended first assignment:

```md
Goal: prepare the documentation truth pass for BookIndex.

Context:
- Read `docs/CLEANUP_AND_UI_ROADMAP.md`.
- Read `README.md` architecture/build sections.
- Read `CLAUDE.md` build pipeline section.
- Read `docs/CODEX_WORKFLOW_RU.md` section 5.

Task:
- Identify every current-doc statement that treats `scripts/bundle.js` or `src/` as the normal live source path.
- Propose replacement text that makes `npm run build`, `v3_app.js`, `v3_template.html`, `app_data.json`, and `data/modules/*.json` ownership clear.
- Keep output as a patch plan and replacement snippets, not a direct patch.

Expected output:
- Findings table.
- Replacement snippets in Russian for current docs.
- Validation commands.
- Residual risks.
```

This assignment is intentionally documentation-first. It reduces future confusion before any code or UI redesign begins.
