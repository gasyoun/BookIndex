# Interface review: BookIndex general + video gallery (~200)

_Created: 01-08-2026 · Last updated: 01-08-2026_

**Mode:** full (jakubkrehel `better-interface` orchestrating accessibility · layout · writing · typography · colors · ui)  
**Scope:** production runtime `v3_template.html` + `v3_app.js` → `aaz-index.html`, with special depth on `#v4/materials/video` (видеогалерея, ~175 unique / 191 raw `video_catalog` rows) and its detail route `#v4/materials/video/<id>`.  
**Stack:** vanilla SPA, warm archival CSS tokens in `v3_template.html`, no component library, Fuse/D3/Leaflet vendored.  
**Boundary:** VIZ modules and landing `index.html` were not redesigned; only noted where they share chrome (header, density, command palette).  
**Model:** Grok 4.5 (`grok-4.5`) · skills: better-interface + six domain skills from [jakubkrehel/skills](https://github.com/jakubkrehel/skills).

---

## Scope and coverage

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `v3_app.js` `renderVideoGalleryPanel` / `renderVideoDetailPanel`; `v3_template.html` `.vg-*` / `.video-*` CSS; focus patterns elsewhere (viz, density-select) | 4 findings |
| Layout | Gallery grid + controls; U4 harness route set omits video; detail max-width 760px | 3 findings |
| Writing | Gallery intro, meta line, chapter-filter honesty, empty states | 2 findings |
| Typography | Title hierarchy, chip size 11px, play glyph via `::before` | 1 finding |
| Colors | Archival brown/cream; title link `#8c3a15`; play marker `#c0392b` | 1 finding |
| UI polish | Card surfaces, missing thumbs, press/focus feedback, stale `src/renderers/multimedia.js` | 2 findings |

---

## Findings

| # | Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **HIGH** | Layout / data | `app_data.json` `video_catalog` + `getDedupedVideoCatalog()` in [`v3_app.js:7186–7198`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js) | 191 rows, **175 unique ids**; three YouTube ids (`Tz3T7IxsbLU`, `xIoXVxahvDY`, `cJp5ZrnGivw`) each carry **many different seminar titles** (6–8 titles per id). Dedup keeps the richest `related_entities` and **drops the other lectures** from the gallery. | Repair source mapping: one stable id per real recording; never reuse a YouTube id for a different seminar. Add a CI guard (`id` unique + `id` matches URL `v=`). Surface pipeline count (176) honestly next to catalog. | Collapsing distinct seminars under one id is a **task-blocking catalog error**: users cannot open the right lecture; filters undercount; backlinks attach to the wrong talk. UI polish on a wrong catalog is wasted. |
| 2 | **HIGH** | Accessibility | [`v3_app.js:10770`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js), controls in gallery | Search is `<input id="vg-search" … placeholder="…">` with **no visible `<label>` / `aria-label`**. Chapter and sort `<select>`s have only placeholder-like first options, no associated labels. | Visible labels (“Поиск”, “Глава книги”, “Сортировка”) or `aria-label` on each control; keep placeholders as hints only. | Placeholder-as-label fails when the field is filled and for many AT users; gallery is a primary research surface with ~175 items. |
| 3 | **HIGH** | Accessibility | [`v3_template.html`](https://github.com/gasyoun/BookIndex/blob/main/v3_template.html) `.vg-input` / `.vg-card-title` / `.vg-chip` | Gallery controls and chips have **no `:focus-visible` ring** (unlike `.viz-toolbar …:focus-visible` and `.density-select:focus`). | Shared focus token: `outline: 2px solid …; outline-offset: 2px` on `.vg-input:focus-visible`, `.vg-card-title:focus-visible`, `.vg-chip:focus-visible`, `.video-detail-back:focus-visible`, `.video-detail-yt:focus-visible`. | Keyboard path exists via `bindActionWithKeyboard`, but without a visible ring the gallery fails “keyboard-first” craft. |
| 4 | **MEDIUM** | Layout | [`v3_app.js:10758–10859`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js) + CSS grid `minmax(280px, 1fr)` | Flat **text-only card wall** for ~175 items: no virtualization, no theme/year facets, no sticky result count, no empty-state UI when search yields 0. Chapter filter is the only topical axis (book chapters ≠ video series). | (a) Sticky meta + clear empty state (“Ничего не найдено… сбросить фильтры”). (b) Facets from pipeline themes / year / series when data allows. (c) Optional virtualized list if paint cost shows up on mobile. (d) Prefer **list density** for research scan, with optional “карточки с превью” mode. | A 200-item unfaceted grid forces linear scanning; chapter filter alone does not match how people remember talks (year, series «История ударения», ЛЛШ). |
| 5 | **MEDIUM** | Writing | Intro [`v3_app.js:10768`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js) | “Ссылка ведёт на YouTube; таймкоды на минуту — на карточках сущностей и в KWIC…” while **catalog `timecodes` is empty for all 191 rows** and only 33/175 deduped rows have `date`. Sort “сначала новые/старые” is mostly noise. | Honest copy: dates sparse; in-card timecodes not yet in gallery; deep-link minutes live on entity/KWIC when present. Default sort by **title** or **duration** until dates are backfilled. Badge undated items. | Copy overclaims product capability; date-desc sort misleads when 142/175 have no date. |
| 6 | **MEDIUM** | Layout | U4 harness [`tests/e2e/redesign-baseline.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/redesign-baseline.spec.js) | Eight redesign routes **omit** `#v4/materials/video` (only lectures + sources under Materials). | Add video gallery + one detail id to U4 ROUTES with controls `#vg-search`, `#vg-chapter`, `#vg-sort`, `#vg-list`. | Roadmap’s “Materials: prioritise reading flow and source confidence” cannot regress-protect the largest materials surface if it is outside the harness. |
| 7 | **MEDIUM** | UI | Gallery cards vs stale [`src/renderers/multimedia.js`](https://github.com/gasyoun/BookIndex/blob/main/src/renderers/multimedia.js) | Production cards are title + meta + chips; experimental `multimedia.js` paints YouTube thumbs + modal player (not in production `bundle` path). Detail page has **no embed**, only external YouTube link. | Decide once: (A) keep external-only (CSP/privacy-friendly) and add static thumb `img` with empty alt or decorative alt + title text; or (B) optional lazy embed on detail with pause control and reduced-motion respect. Delete or clearly mark `multimedia.js` as non-runtime so agents stop “fixing” the wrong file. | Dual implementations invite wrong-file edits; missing visual scannability hurts the 200-item browse task. |
| 8 | **MEDIUM** | Accessibility | Result count `#vg-meta` [`v3_app.js:10804`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js) | Meta text updates on filter with no live region. | `role="status"` / `aria-live="polite"` on `#vg-meta` (stable node, update textContent). | Screen-reader users do not hear that the list shrank after search. |
| 9 | **LOW** | Typography | `.vg-chip` 11px, title 14px | Dense chips are hard at 200% zoom / older eyes. | Chips ≥12px; ensure card text uses rem or scales with root; reflow at 320px already mostly OK via wrap. | Zoom/reflow survival. |
| 10 | **LOW** | Colors | Play marker `::before` `#c0392b` | Color-only play cue next to title. | Keep color but ensure accessible name is the full title link text (already is); optional `aria-hidden` on pure decoration if ever split. | Color alone is OK here only because the link text carries the name. |
| 11 | **LOW** | UI | `.vg-card` | No hover elevation / active scale; fine for density, slightly dead. | Optional 1px border strengthen + `transition: border-color, box-shadow` (not `all`); no stagger on list paint. | Polish only; do not animate 175 cards on load. |
| 12 | **MEDIUM** | Writing / product | Global IA | Materials tabs mix book lectures (11) and video gallery (~175) without a clear “what is this corpus?” moment on first visit. Home has inline video search; gallery intro is thin. | One-line corpus status: N public videos · hours · pipeline stage mix (from `video_pipeline.json` stats) · link to pipeline dashboard. | Users cannot tell completeness of the ~200 corpus vs volunteer pipeline (176 tracked). |

---

## Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Whole app | Rewrite SPA in React/Svelte | Explicit non-goal in [`CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md); Playwright suite is contract around `v3_app.js`. |
| Palette | Drop archival brown for “modern SaaS” | Subject fit is intentional (U2 roadmap); jakub skills say preserve project tokens. |
| Gallery | Stagger enter animations per card | better-ui: no motion on high-frequency / large lists; 175 staggers would hurt. |
| Gallery | Virtualize immediately | No measured jank yet; fix catalog integrity + facets first; re-measure. |
| Detail | Autoplay YouTube embed | better-accessibility: autoplay needs visible pause; default external link is safer. |

---

## Verification

| Check | Result |
| --- | --- |
| Data census on `app_data.json` `video_catalog` | raw 191 · unique ids 175 · 3 multi-title id collisions · timecodes 0 · dates 33/175 deduped · related_entities 183 nonempty |
| Pipeline stats `data/video_pipeline.json` | 176 videos · 212.8 h · stages transcribed 98 / queued 53 / … |
| Code path production vs `src/renderers/multimedia.js` | Production = `renderVideoGalleryPanel` in `v3_app.js`; multimedia.js is legacy/non-bundled |
| E2E `session-features` video tests | Present in repo; local run **Not verified** (`@playwright/test` not installed in this environment) |
| Live Pages visual pass | Hash route fetch returns shell only (client-rendered); full visual **Not verified** without headed browser |
| Lighthouse/axe postdeploy | Existing `npm run check:postdeploy` contract; not re-run this pass |

---

## Verdict

**Block** — residual **HIGH** findings: catalog id collisions (data integrity) and unlabeled / unfocused gallery controls.

Do not ship a “pretty 200-video page” until finding #1 is fixed; ship accessibility labels + focus with the first UI PR.

---

## Improvement backlog (input to /ask-batch plan)

### Wave V0 — Catalog truth (blocks everything)

1. Inventory collisions; recover correct YouTube URLs from pipeline / original sheets.
2. Enforce unique `id` + id↔url match in `validate_content.py` or a dedicated guard.
3. Reconcile 191 catalog vs 176 pipeline vs “~200” product language.
4. Backfill dates where known; stop defaulting sort to date-desc until coverage ≥ threshold.

### Wave V1 — Gallery UX (jakub-aligned)

1. Labels + focus-visible + live result count.
2. Empty state + reset filters.
3. Facets: year, pipeline theme, series (accent seminar series).
4. Optional thumb mode (lazy `img.youtube.com`, decorative).
5. Detail: optional transcript status badge from pipeline; keep external watch as primary CTA.
6. Extend U4 redesign harness with video routes.
7. Deprecate or quarantine stale `multimedia.js` path in docs.

### Wave V2 — App-wide chrome (general, after V1)

1. Phase U1–U3 from existing cleanup roadmap (home task dashboard, list density, card anatomy) **without** fighting archival palette.
2. Shared control CSS: one focus ring, one input height, one chip component used by gallery + lectures + home video search.
3. Materials IA: label “Лекции книги” vs “Видеоархив (~N)” so 11 vs 175 is obvious.

### Wave V3 — Content depth (pipeline)

1. Resume transcript ingest (still 27/176 with `links.text` per `.ai_state.md`).
2. Surface pipeline volunteer dashboard from gallery footer.
3. KWIC↔gallery deep links already exist; do not rebuild.

---

## Prior art (do not rebuild)

- Video gallery + detail + chapter overlap: **shipped** (`renderVideoGalleryPanel`, tests in `session-features.spec.js`).
- Dedup helper + backlinks: **shipped** (`getDedupedVideoCatalog`, `getVideoBacklinkIndex`).
- Pipeline dashboard: `pipeline/index.html` + `npm run pipeline:dashboard`.
- U4 harness pattern: extend, don’t replace.
- Landing promotion `@DECIDE` (H1603 / sustainable mockup): separate track; do not couple to gallery.

---

_Dr. Mārcis Gasūns_
