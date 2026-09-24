# ROADMAP — BookIndex UI cleanup + video gallery (2026Q3)

_Created: 01-08-2026 · Last updated: 24-09-2026_

> **Truth-pass 24-09-2026 (H5395, OxAlpha `opencode/z-ai/glm-5.3-flash`) — verdict: REFRESH.** Из 16 work items 11 shipped (V0.1–V0.3, V1.1–V1.3, V1.5–V1.6, U1–U3 — зачёркнуты ниже с цитатами закрытых H###/PR), 5 остались (V1.4, IA, C1–C3) и переписаны в [What is left](#what-is-left-truth-pass-24-09-2026) как gated-чекбоксы; человеческие ворота (C1, C2) заведены в [Uprava GTD](https://github.com/gasyoun/Uprava/blob/main/GTD_NEXT_ACTIONS.md) как @WAITING от 24-09-2026. Unminted prose work существует, поэтому roadmap не архивируется (рулинг 2, [GRILL_ROADMAP_CLOSEOUT_OXALPHA_MASS_MINT_21-09-2026](https://github.com/gasyoun/Uprava/blob/main/docs/GRILL_ROADMAP_CLOSEOUT_OXALPHA_MASS_MINT_21-09-2026.md)).

Parent plan: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)  
Extends: [CLEANUP_AND_UI_ROADMAP.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) (U1–U4 still valid; this roadmap sequences video-first).

---

## Wave V0 — Catalog truth (blocks UI polish)

| ID | Deliverable | Unblocks |
| --- | --- | --- |
| V0.1 | ~~Census + fix/document 3 multi-title YouTube ids; survivor = richest `related_entities` (status quo keep) with **issue per dropped title**~~ **Done H2122** (175 unique rows; 16 titles in data-error issue) | Honest gallery counts |
| V0.2 | ~~CI guard: unique `video_catalog[].id`; `id` matches YouTube `v=` / youtu.be path~~ **Done H2122** (`validate_video_catalog`) | Regressions never return |
| V0.3 | ~~Reconcile product copy: raw vs deduped vs pipeline 176~~ **Done H2123** ([PR #213](https://github.com/gasyoun/BookIndex/pull/213), v4.11.2) — intro галереи показывает счёт дедуплицированного каталога (`getDedupedVideoCatalog()`, 176 = `videos_in_catalog` в `data/video_pipeline.json`); пайплайн-сводка живёт на `pipeline/index.html` (`scripts/build_pipeline_dashboard.py`) | Trust |

## Wave V1 — Video gallery (~200 page)

| ID | Deliverable | Unblocks |
| --- | --- | --- |
| V1.1 | ~~Labels, `:focus-visible`, `aria-live` on `#vg-meta`, empty state + reset~~ **Done H2123** ([PR #213](https://github.com/gasyoun/BookIndex/pull/213), release [v4.11.2](https://github.com/gasyoun/BookIndex/releases/tag/v4.11.2)) — aria-labels, focus-visible, `#vg-meta role="status" aria-live="polite"`, пустое состояние + «Сбросить фильтры» | Keyboard + AT path |
| V1.2 | ~~Honest intro; default sort not date-desc while dates sparse; undated badge~~ **Done H2123** ([PR #213](https://github.com/gasyoun/BookIndex/pull/213)) — честный интро-текст, сортировка по умолчанию «по названию», недатированные карточки помечены «дата неизвестна» | Sort trust |
| V1.3 | ~~Dense list default + «Превью» toggle (lazy thumbs)~~ **Done H2124** ([PR #215](https://github.com/gasyoun/BookIndex/pull/215), release [v4.11.3](https://github.com/gasyoun/BookIndex/releases/tag/v4.11.3)) — `vg-list-dense` по умолчанию, «Превью» с `loading="lazy"`, persisted | Scan vs browse modes |
| V1.4 | Facets: year (from title/date), pipeline theme when joinable, series keyword → **остался в [What is left](#what-is-left-truth-pass-24-09-2026)** | Non-linear browse |
| V1.5 | ~~Modal player shell + timecode list (empty OK); external YT fallback~~ **Done H2125** (PR [#250](https://github.com/gasyoun/BookIndex/pull/250), release [v4.11.5](https://github.com/gasyoun/BookIndex/releases/tag/v4.11.5)) | D3 ruling |
| V1.6 | ~~U4 harness: `#v4/materials/video` + one detail id~~ **Done** — маршруты `materials-video` + `materials-video-detail` (`#v4/materials/video/tv87ggs0yq4`) в `tests/e2e/redesign-baseline.spec.js` | Redesign safety net |

## Wave V2 — CLEANUP U1–U3 (app-wide)

| ID | Deliverable | Notes |
| --- | --- | --- |
| U1 | ~~Home as task dashboard (not feature showcase)~~ **Done H2127** — 4th task tile «Смотрю указатель целиком», showcase («Книга в цифрах» + facts + quote) demoted below routes/recents, `#home-tasks-grid` added to the U4 home gate | Reuse home video search (already in-app since H2125) |
| U2 | ~~Shared tokens: focus ring, input height, chip, 6–8px radius~~ **Done H2128** ([PR #256](https://github.com/gasyoun/BookIndex/pull/256)) — общий `:focus-visible`-токен + input/chip/button sizing в v3_template | Video already on 6–8px |
| U3 | ~~Header/list/card/toolbar anatomy consistency~~ **Done H2128** ([PR #256](https://github.com/gasyoun/BookIndex/pull/256)) — списки/карточки/тулбары приведены к одной анатомии; палитра не тронута | No palette flip |
| IA | Materials tabs: «Лекции книги (11)» vs «Видеоархив (N)» → **остался в [What is left](#what-is-left-truth-pass-24-09-2026)** | Clarity |

## Wave V3 — Content depth (pipeline)

| ID | Deliverable | Notes |
| --- | --- | --- |
| C1 | Resume transcript ingest (27/176 `links.text` baseline in `.ai_state.md`) → **остался в [What is left](#what-is-left-truth-pass-24-09-2026)** (сейчас 98/177 transcribed, 54 queued) | Separate from UI |
| C2 | Populate `timecodes` where pipeline has chapter marks → **остался в [What is left](#what-is-left-truth-pass-24-09-2026)** (сейчас 0/176) | Feeds modal |
| C3 | Gallery footer → pipeline dashboard → **остался в [What is left](#what-is-left-truth-pass-24-09-2026)** (дашборд уже есть: `pipeline/index.html`) | Volunteer loop |

## What is left (truth-pass 24-09-2026)

Gated checkboxes; человеческие ворота указывают на свои строки в [Uprava GTD_NEXT_ACTIONS.md](https://github.com/gasyoun/Uprava/blob/main/GTD_NEXT_ACTIONS.md) (рулинг 10, H5395).

- [ ] **V1.4 — Facets: год (из названия/даты), тема пайплайна (когда joinable), ключевое слово серии** — unminted prose work (живых handoff нет на 24-09-2026); agent-doable UI-задача, точка входа `renderVideoGalleryPanel` (`src/runtime/legacy.js`).
- [ ] **IA — подписи вкладок материалов «Лекции книги (N)» vs «Видеоархив (N)»** — unminted (H2128 пометил «if cheap in same PR», в [PR #256](https://github.com/gasyoun/BookIndex/pull/256) не вошло); agent-doable.
- [ ] **C3 — ссылка из подвала видеогалереи на дашборд пайплайна** — unminted, крошечный остаток: страница уже генерируется `scripts/build_pipeline_dashboard.py` → `pipeline/index.html`, в футере галереи ссылки нет.
- [ ] **C1 — Resume transcript ingest** — HUMAN/pipeline gate → [Uprava GTD @WAITING 24-09-2026](https://github.com/gasyoun/Uprava/blob/main/GTD_NEXT_ACTIONS.md): 98/177 transcribed, 54 queued (`data/video_pipeline.json`); волонтёрская транскрипция, не агентская работа.
- [ ] **C2 — Populate `timecodes` where pipeline has chapter marks** — gated on C1 → [Uprava GTD @WAITING 24-09-2026](https://github.com/gasyoun/Uprava/blob/main/GTD_NEXT_ACTIONS.md): 0/176 с таймкодами; `scripts/build_transcript_timecodes.py` готов, ждёт транскрипты.

## Non-goals

- Framework rewrite; production switch to `src/entry.js` without full Playwright parity.
- Inventing YouTube URLs or synthetic timecodes.
- Coupling H1603 sustainable-landing `@DECIDE` into these waves.
- Autoplay embeds; forced thumbnail-only layout.

---

_Dr. Mārcis Gasūns_
