# ROADMAP — BookIndex UI cleanup + video gallery (2026Q3)

_Created: 01-08-2026 · Last updated: 12-08-2026_

Parent plan: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)  
Extends: [CLEANUP_AND_UI_ROADMAP.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) (U1–U4 still valid; this roadmap sequences video-first).

---

## Wave V0 — Catalog truth (blocks UI polish)

| ID | Deliverable | Unblocks |
| --- | --- | --- |
| V0.1 | ~~Census + fix/document 3 multi-title YouTube ids; survivor = richest `related_entities` (status quo keep) with **issue per dropped title**~~ **Done H2122** (175 unique rows; 16 titles in data-error issue) | Honest gallery counts |
| V0.2 | ~~CI guard: unique `video_catalog[].id`; `id` matches YouTube `v=` / youtu.be path~~ **Done H2122** (`validate_video_catalog`) | Regressions never return |
| V0.3 | Reconcile product copy: raw vs deduped vs pipeline 176 | Trust |

## Wave V1 — Video gallery (~200 page)

| ID | Deliverable | Unblocks |
| --- | --- | --- |
| V1.1 | Labels, `:focus-visible`, `aria-live` on `#vg-meta`, empty state + reset | Keyboard + AT path |
| V1.2 | Honest intro; default sort not date-desc while dates sparse; undated badge | Sort trust |
| V1.3 | Dense list default + «Превью» toggle (lazy thumbs) | Scan vs browse modes |
| V1.4 | Facets: year (from title/date), pipeline theme when joinable, series keyword | Non-linear browse |
| V1.5 | ~~Modal player shell + timecode list (empty OK); external YT fallback~~ **Done H2125** (PR [#250](https://github.com/gasyoun/BookIndex/pull/250), release [v4.11.5](https://github.com/gasyoun/BookIndex/releases/tag/v4.11.5)) | D3 ruling |
| V1.6 | U4 harness: `#v4/materials/video` + one detail id | Redesign safety net |

## Wave V2 — CLEANUP U1–U3 (app-wide)

| ID | Deliverable | Notes |
| --- | --- | --- |
| U1 | ~~Home as task dashboard (not feature showcase)~~ **Done H2127** — 4th task tile «Смотрю указатель целиком», showcase («Книга в цифрах» + facts + quote) demoted below routes/recents, `#home-tasks-grid` added to the U4 home gate | Reuse home video search (already in-app since H2125) |
| U2 | Shared tokens: focus ring, input height, chip, 6–8px radius | Video already on 6–8px |
| U3 | Header/list/card/toolbar anatomy consistency | No palette flip |
| IA | Materials tabs: «Лекции книги (11)» vs «Видеоархив (N)» | Clarity |

## Wave V3 — Content depth (pipeline)

| ID | Deliverable | Notes |
| --- | --- | --- |
| C1 | Resume transcript ingest (27/176 `links.text` baseline in `.ai_state.md`) | Separate from UI |
| C2 | Populate `timecodes` where pipeline has chapter marks | Feeds modal |
| C3 | Gallery footer → pipeline dashboard | Volunteer loop |

## Non-goals

- Framework rewrite; production switch to `src/entry.js` without full Playwright parity.
- Inventing YouTube URLs or synthetic timecodes.
- Coupling H1603 sustainable-landing `@DECIDE` into these waves.
- Autoplay embeds; forced thumbnail-only layout.

---

_Dr. Mārcis Gasūns_
