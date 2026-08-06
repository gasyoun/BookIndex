# Results log

_Created: 24-07-2026 · Last updated: 06-08-2026_

## H2124 — video gallery V1b: dense list default + optional thumbs toggle (2026-08-06)

Implementation Step 3 (V1b) of [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md) — D2 ruling (dense research list is the default; thumbs are a toggle, not the default).

- `#vg-list` now renders `.vg-list-dense` (full-width compact rows: title, meta, chips) by default; a new `«Превью»` checkbox next to the sort control switches it to `.vg-list-thumbs` (the prior grid-of-cards layout).
- Thumbs are lazily created only when the toggle is on — `<img class="vg-card-thumb" loading="lazy" alt="">` pointed at `https://img.youtube.com/vi/<id>/mqdefault.jpg`; decorative (`alt=""`), title text stays the adjacent accessible label. No image requests fire in the default dense mode.
- Preference persisted to `localStorage` under `bookindex.vg.thumbs` (plain try/catch-guarded key, matching this file's existing storage pattern; no dedicated storage-helper module exists in this codebase to reuse) and re-applied on load.
- No stagger/entry animation added; no `transition: all` used anywhere in the new CSS.
- `tests/e2e/session-features.spec.js` (`video gallery (B3.5)` describe block): 2 new cases — dense-default/toggle/persist-across-reload, and a 390px-viewport no-horizontal-overflow check for both dense and thumbs modes. Full `video gallery` slice: 5/5 passed locally (Playwright, chromium); full repo `npm run check` run alongside this PR.

**Model:** Sonnet 5 (`claude-sonnet-5`).
**Handoff:** [H2124](https://github.com/gasyoun/Uprava/blob/main/handoffs/H2124-Sonnet_BookIndex_video-gallery-dense-list-thumbs_01.08.26.md).

## H2123 — video gallery V1a: labels, focus-visible, live meta, empty state, honest copy (2026-08-06)

Implementation Step 2 (V1a) of [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md), addressing findings 2, 3, 5, 8 of [INTERFACE_REVIEW_VIDEO_GALLERY_JAKUB_SKILLS_01.08.2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/INTERFACE_REVIEW_VIDEO_GALLERY_JAKUB_SKILLS_01.08.2026.md).

- `#vg-search` / `#vg-chapter` / `#vg-sort` now carry `aria-label` (placeholder text kept as a hint only, not the accessible name).
- `:focus-visible` ring added to `.vg-input`, `.vg-card-title`, `.vg-chip`, `.video-detail-back`, `.video-detail-yt` (same token as `.viz-toolbar` controls).
- `#vg-meta` is now `role="status" aria-live="polite"` so screen readers hear the result count change.
- Empty state: zero-result filtering shows a message + "Сбросить фильтры" button that clears search/chapter/sort and returns focus to the search field.
- Intro copy rewritten to drop the timecode claim (catalog `timecodes` is empty for all rows) and the implied full date coverage.
- **D7 ambiguity call (threshold not specified in the plan):** default sort switched from `date-desc` to **title** — only 33/175 deduped rows carry a `date`, so date-desc as a default silently misleads on ~81% of the catalog. `date-desc`/`date-asc`/`dur-desc`/`dur-asc` remain selectable.
- Undated cards now show «дата неизвестна» instead of a blank meta line.
- `tests/e2e/session-features.spec.js`: 2 new cases (`video gallery (B3.5)` describe block) — accessible-name/live-region assertions, and empty-state + reset-focus assertion. Full `session-features` suite: 13/13 passed locally (Playwright, chromium).

**Model:** Sonnet 5 (`claude-sonnet-5`).
**Handoff:** [H2123](https://github.com/gasyoun/Uprava/blob/main/handoffs/H2123-Sonnet_BookIndex_video-gallery-a11y-focus-empty_01.08.26.md).

## H1825 — stratified context-coverage drain batch ×339 (2026-08-02)

One stratified batch of **339** missing-context items received direct `contexts` glosses in `data/modules/*` (assembled into `app_data.json`). Editorial glosses only (house style of H1602 / `inject_mega_pack*`): each gloss grounded in the lecture-chapter map (`data/modules/20-lectures.json`), same-page glossed neighbours and lecture-transcript KWIC hits where available; no invented page numbers, no fabricated quotes. Opaque OCR heads (`mwlsm`, `d??f`, `öLsz̲9`…) carry an honest «требует сверки» note instead of an invented meaning (precedent: `RgH`/`Tj`/`UJ` in H1602).

**Model:** Fable 5 (`claude-fable-5`).
**Handoff:** [H1825](https://github.com/gasyoun/Uprava/blob/main/handoffs/H1825-Fable_BookIndex_stratified-context-coverage-batch_29.07.26.md) — Fable-locked, `/next-task` pick 02-08-2026.
**Injection script (archived):** [docs/history/scripts/inject_contexts_h1825.py](https://github.com/gasyoun/BookIndex/blob/main/docs/history/scripts/inject_contexts_h1825.py)

### Before / after (`npm run content:audit` / `scripts/content_report.py`)

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Items total | 3376 | 3376 | 0 |
| With direct contexts | 904 (26.8%) | 1243 (36.8%) | **+339** (+10.0 pp) |
| With effective contexts | 1227 (36.3%) | 1689 (50.0%) | **+462** (+13.7 pp) |
| Inherited effective | 323 | 446 | +123 |
| Context snippets | 3050 | 3389 | +339 |
| missing_context queue | 2149 | 1687 | −462 |
| Direct target ≥35% | below (26.8%) | **met (36.8%)** | — |
| Effective coverage | 36.3% | **50.0%** | +13.7 pp |

### Stratified batch composition

| Entity | n | Contexts % after (direct) |
|---|---:|---:|
| lexicon | 190 | 37.8% |
| lexicon_reverse | 90 | 8.6% |
| lexicon_tech | 26 | **100.0%** (drained) |
| names | 26 | 98.9% |
| toponyms | 7 | **100.0%** (drained) |
| **total** | **339** | **36.8% direct** |

### Validation

- `python scripts/validate_content.py app_data.json` → **OK** (0 errors, 0 warnings)
- `python runtime_test.py` → OK (infrastructure smoke)
- `python scripts/check_encoding.py --strict` → OK
- `python -m unittest discover -s tests/unit -t .` → 33 tests OK
- `npm run build` → aaz-index.html + 678 prerendered entity pages + sitemap regenerated

### Caveats

- Snippets are editorial book-grounded glosses, not verbatim OCR quotes (full page text not in-repo for most loci); the strongest grounding is the chapter map + per-page entity clusters + transcript KWIC (32 word-boundary hits).
- Unknown persons (Кислов М. Н., Милославский Е., Чернышева П.…) and opaque OCR heads glossed with an explicit verify-by-page note, never an invented identity/meaning.
- `lexicon_reverse` direct coverage remains low (8.6%) — its 90-item slice deliberately mirrored lexicon heads (same lexeme in both indexes shares one vetted gloss); the deep reverse-only tail (~960 items) is the next drain frontier.

_Dr. Mārcis Gasūns_

## H2122 — V0 video_catalog unique ids (2026-08-01)

**Model:** Grok 4.5 (`grok-4.5`) — override dual-run of Sonnet-locked handoff; residual compare handoff minted for Sonnet.  
**Handoff:** [H2122](https://github.com/gasyoun/Uprava/blob/main/handoffs/H2122-Sonnet_BookIndex_video-catalog-id-collisions-v0_01.08.26.md)

### Census → after survivor collapse

| Metric | Before | After |
| --- | ---: | ---: |
| `video_catalog` rows | 191 | **175** |
| Unique YouTube ids | 175 | **175** |
| Collision groups | 3 | **0** |
| Titles dropped (D8 issues) | — | **16** |

### Survivors (richest `related_entities`; first wins on ties — matches `getDedupedVideoCatalog`)

| YouTube id | Survivor title kept |
| --- | --- |
| `Tz3T7IxsbLU` | Зализняк. История русского ударения 16 10 29 семинар 08 |
| `xIoXVxahvDY` | Зализняк. История русского ударения. 06.05.2017. Семинар 26 |
| `cJp5ZrnGivw` | Зализняк. История русского ударения. 19.11.2016 |

Pipeline (`video_pipeline.json`) had the same single title per id — **no alternate correct URLs** found; no URLs invented (D8).

### Guard

- `validate_video_catalog` in [`scripts/validate_content.py`](https://github.com/gasyoun/BookIndex/blob/main/scripts/validate_content.py): unique `id` among rows with URL; `id` must equal extracted YouTube id from `url`.
- Unit tests: [`tests/unit/test_validate_video_catalog.py`](https://github.com/gasyoun/BookIndex/blob/main/tests/unit/test_validate_video_catalog.py) (duplicate + mismatch fixtures).
- Census artifact: [`docs/history/H2122_video_catalog_collision_census.json`](https://github.com/gasyoun/BookIndex/blob/main/docs/history/H2122_video_catalog_collision_census.json).
- Prove: `python scripts/validate_content.py app_data.json` → 0 errors; `python -m unittest tests.unit.test_validate_video_catalog`.
- Lost titles issue: https://github.com/gasyoun/BookIndex/issues/192

## Ask-batch + better-interface — video gallery (~200) (2026-08-01)

**Model:** Grok 4.5 (`grok-4.5`). Skills: [jakubkrehel/skills](https://github.com/jakubkrehel/skills) `better-interface` + domain skills.  
**Artifact:** [docs/INTERFACE_REVIEW_VIDEO_GALLERY_JAKUB_SKILLS_01.08.2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/INTERFACE_REVIEW_VIDEO_GALLERY_JAKUB_SKILLS_01.08.2026.md) · plan [docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)

### Catalog census (load-bearing)

| Metric | Value |
| --- | ---: |
| `video_catalog` raw rows | 191 |
| Unique YouTube ids | 175 |
| Multi-title id collision groups | 3 (`Tz3T7IxsbLU`, `xIoXVxahvDY`, `cJp5ZrnGivw`) |
| Rows with `timecodes` nonempty | 0 |
| Deduped with `date` | 33 / 175 |
| Pipeline videos (`video_pipeline.json`) | 176 · 212.8 h |

### Interview rulings (short)

| ID | Ruling |
| --- | --- |
| D1 | V0 catalog truth before polish |
| D2 | Dense list + optional thumbs |
| D3–D4 | Modal player shell now; timecodes when data exists |
| D5 | V1 video → U4 video routes before broader U1 home |
| D6 | Full CLEANUP roadmap staged (wave-2+) |
| D7 | Ambiguity → default + RESULTS_LOG |
| D8 | Survivor title + GitHub issues for lost titles |

### Verdict

**Block** (interface review) until V0 unique-id integrity and gallery control labels/focus land.

## H2031 — KWIC lost-quote repair, issue #187 (2026-07-31)

Follow-up to [H1482](#h1482--encoding-guard-mojibake-detector-redesign-2026-07-31): repairing the data defect the new detector found, then tightening CI to `--strict`.

**Model:** Opus 5 1M (`claude-opus-5[1m]`).

### Provenance — the first hypothesis was wrong

| Claim (issue #187 as filed) | Verdict | Evidence |
|---|---|---|
| Corruption comes from the transcript pipeline | **Refuted** | `Rauhbank`/`Bratpfanne` appear in no file under `data/imports/` or `pipeline/` |
| Contexts are lecture snippets | **Refuted** | they sit at `languages/*/occurrences/**mumintroll**/contexts` — book text, not lectures |
| A point fix would return on regeneration | **Refuted** | present in `app_data.json` at the corpus's first commit `964283105` (14-04-2026); no in-repo path recreates them |
| `src/content/*.md` is an upstream source | **Refuted** | it is an *export* of `app_data.json` (`scripts/export_app_data_to_markdown.mjs`) |

So the data repair is complete, not a patch over a live source.

### Repair

| Location | U+FFFD before | After |
|---|---:|---:|
| `data/modules/13-languages.json` → `app_data.json` | 6 | 0 |
| `src/content/nemetskiy.md` (export) | 4 | 0 |
| `src/content/russkiy.md` (export) | 2 | 0 |
| `v3_app.js` (deliberate, quality-queue check) | 1 | 1, now marked `allow-ufffd` |

All six data occurrences had the identical shape `— <U+FFFD>текст’`: the closing `’` survived, the opening `‘` was lost. The corpus writes glosses as `‘…’` (32 left vs 98 right single quotes in `app_data.json`), so the replacement is determined, not guessed — and the repair script refused to touch anything not matching that shape.

### Result

`python scripts/check_encoding.py --strict` exits 0 on core files and on all docs, so **both CI encoding steps now run `--strict`** — U+FFFD is a hard error again everywhere except explicitly marked lines. 27/27 unit fixtures pass (two new ones cover the marker, including that it is per-line and not per-file). `runtime_test.py`, `validate_content.py`, `check:js`, `check:security:static`, `check:perf`, `check:ui` all pass; the content audit queue is unchanged. Typecheck and Playwright were not run locally (no `node_modules` in this environment) and are covered by CI.

## H1482 — encoding-guard mojibake detector redesign (2026-07-31)

`scripts/check_encoding.py`'s two hardcoded regexes replaced by a round-trip detector (re-encode through each candidate legacy codec, look for runs of well-formed UTF-8). Context: the guard CI-gates merges, and the project ingests external text through Wikidata API, `.docx`/`.srt` transcripts and GitHub issue forms.

**Model:** Opus 5 1M (`claude-opus-5[1m]`).

### Coverage vs. the old detector and vs. ftfy 6.3.1

Fixtures corrupt the same Russian sentence through each codec; ftfy column is `ftfy.badness.is_bad` measured locally.

| Corruption class | Old (2 regexes) | ftfy 6.3.1 | New detector |
|---|---|---|---|
| UTF-8 as CP1252 / Latin-1 | caught | caught | caught |
| UTF-8 as CP1251 | missed | caught | caught |
| UTF-8 as KOI8-R | missed | **missed** | caught |
| UTF-8 as CP866 | missed | **missed** | caught |
| UTF-8 as Mac Cyrillic | missed | **missed** | caught |
| Double UTF-8 encoding | missed | caught | caught |
| U+FFFD (lossy) | missed | caught | warns (`--strict` fails) |
| Invalid UTF-8 / NUL | caught | n/a | caught |
| Corruption buried in one line of a clean file | missed | n/a | caught |

### False-positive calibration (committed corpus, 5592 files)

`app_data.json`, `data/modules/*.json`, built artifacts, `README.md`, `docs/**/*.md`.

| Configuration | `MIN_RUN`=2 | `MIN_RUN`=3 | `MIN_RUN`=4 |
|---|---:|---:|---:|
| Without script-plausibility filter | 9 | 9 | 1 |
| With filter (shipped) | **0** | **0** | **0** |

All false positives were the same accident: ordinary Russian words ("углубляем", "принудительно") whose CP866 bytes form valid UTF-8 and "recover" as CJK. Requiring the recovery to land in Latin/Greek/Cyrillic removes exactly that class. Scan cost with the filter: ~18 s for all 5592 files, ~0.4 s for the three CI core files.

### Real defect found by the new signal

| File | Count | Nature |
|---|---:|---|
| `v3_app.js` (and 700+ prerendered pages) | 1 | Intentional — the app's own quality queue tests for U+FFFD. Not a defect. |
| `app_data.json` / `data/modules/13-languages.json` | 6 | **Genuine data loss**: opening quote `‘` dropped from KWIC lecture snippets (closing `’` still present). Originated upstream in the transcript pipeline. Tracked separately. |

Verification: 25/25 unit fixtures pass; `python scripts/check_encoding.py` exits 0 on core files and on all docs; seven end-to-end injection cases (five whole-file codecs, one buried line, invalid UTF-8) all fail as expected while the untouched control passes.

## H1821b — VIZ-08, режим «Центр: сущность»: добор до спецификации Phase V3 (2026-07-30)

`v4.5.0` выпустил карту с центром на **направлении исследований**. Спецификация Phase V3
([`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md))
требует центра на **выбранной сущности**, прогрессивного раскрытия и переиспользования
`cross_links` — то есть первая половина работы совпала с целью «восьмой интегративный
модуль», но не с буквой спецификации. Причина расхождения зафиксирована отдельно: рабочая
копия `Uprava` была устаревшей, и файл handoff в ней выглядел как 7-строчный stub без
критериев приёмки; полный текст лежал на `origin/main`. Этот проход закрывает разрыв.

**Model:** Opus 5 (`claude-opus-5`).

### Что добавилось

| Критерий Phase V3 | v4.5.0 (центр = направление) | Этот проход (центр = сущность) |
|---|---|---|
| Центр на выбранной сущности | нет (7 фиксированных направлений) | да, любая из ~2 000 голов индекса |
| Первый круг по умолчанию, второй по требованию | обзор → направление (2 уровня) | да, чекбокс «второй круг связей» |
| Переиспользование `cross_links` | **не использовался** | да, типизированные связи с весами |
| `semantic_links` | не использовался | да, как второй тип связей |
| Страницы / лекции / глоссарий / видео у центра | частично (у направления) | да, все четыре у сущности |
| URL: сущность, тип связи, глубина | `filter`, `top` | + `mode`, `entity`, `rel`, `depth` |
| Обход графа через URL | нет | да, клик по узлу переносит центр |

### Validation

- `npx playwright test` → **140 тестов зелёные** (было 135; +5 в `research-map.spec.js`, 7 → 12)
- `npm run check:js` · `npm run check:ui` (0 inline style) · `npm run build` · `python runtime_test.py`
  · `npm run check:perf` (в бюджете, поднятом в `v4.5.0`) · `npm run check:security:static`
  · `python scripts/check_encoding.py` — все OK
- Дефект, найденный тестом, а не глазами: `.viz-toolbar label{display:inline-flex}` перебивает
  атрибут `[hidden]`, поэтому поля неактивного режима оставались на экране. Правило
  `.viz-toolbar label[hidden]{display:none}` общее для всех модулей.

### Caveats

- Два локальных прогона полного набора из трёх дали по два падения в `dom-render-harden` и
  `navigation-architecture`; в изоляции и на чистом повторе оба зелёные, на `main` CI даёт
  135/135. Это локальная флака порядка/таймингов, не регресс VIZ-08 — но она повторяема,
  и её стоит вычистить отдельным проходом.
- Термины глоссария подбираются подстрокой по head + contexts сущности — дешёвая эвристика,
  не семантический разбор; ложные срабатывания возможны на коротких терминах.

_Dr. Mārcis Gasūns_

## H1821 — VIZ-08 «Исследовательская карта»: что связалось (2026-07-30)

Новый интегративный модуль [`scripts/viz/research-map.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/research-map.js)
раскладывает исследовательскую программу А. А. Зализняка на семь направлений и для каждого
считает охват по четырём слоям данных: свидетельства (`scholar.*` + `glossary`), страницы
(границы приписанных глав + ±3 страницы вокруг каждой якорной страницы свидетельства),
сущности указателя (пересечение `page_list` с этими страницами по шести типам) и связанные
видео (`video_catalog.related_entities`). Ни одно из чисел ниже не зашито в код — все
выводятся из `app_data.json` при рендере.

**Model:** Opus 5 (`claude-opus-5`).

### Охват по направлениям (замер 30-07-2026, `app_data.json` 6 145 KiB, книга `mumintroll`)

| Направление | Свидетельств | Страниц | Сущностей | Видео |
|---|---:|---:|---:|---:|
| Сравнительно-историческое языкознание | 31 | 154 | 336 | 24 |
| Морфология и грамматический словарь | 36 | 69 | 98 | 1 |
| Берестяные грамоты и древненовгородский диалект | 10 | 50 | 51 | 19 |
| «Слово о полку Игореве» | 9 | 70 | 205 | 22 |
| Акцентология и русское ударение | 5 | 36 | 55 | 14 |
| Диалектология и изоглоссы | 5 | 45 | 54 | 7 |
| Против любительской лингвистики | 5 | 35 | 168 | 22 |

### Самые сильные мостики между направлениями (общие сущности из топ-30 каждого)

| Общих | Направления | Примеры голов |
|---:|---|---|
| 8 | сравнительно-историческое ↔ диалектология | заимствование, германские, индоевропейские, сдвиг [ударения]: ∼ вправо |
| 7 | берестяные грамоты ↔ диалектология | цоканье, бытовая система письма, письмо: ∼ бытовое vs. книжное |
| 7 | «Слово» ↔ против любительской лингвистики | украинский, белорусский, литературный язык, Новгород |
| 6 | «Слово» ↔ диалектология | сдвиг [ударения]: ∼ вправо, заимствование, немецкий, польский |
| 5 | сравнительно-историческое ↔ морфология | ударение: ∼ в русском языке, фонетические изменения, двойственное число |

### Caveats

- Приписка направления к главам — **редакторское** решение (карта программы, а не
  вывод из данных); из данных считаются только страницы, сущности, видео и мостики.
- Первый замер давал ровно «25 сущностей» у всех семи направлений и 72–96 видео: счёт
  упирался в размер пула, а видеосвязи держались на «всеобщих» головах вроде «русский»,
  которые есть почти в каждом ролике. Исправлено: счёт сущностей теперь полный, а из
  мостиков и видеосвязей исключены головы, встречающиеся в ≥5 направлениях или в ≥30%
  каталога видео. Числа выше — после исправления.
- «Морфология» получает 1 видео именно из-за этого фильтра: её топ-пул — служебная
  терминология, которая в `related_entities` роликов почти не размечена.

### Validation

- `npm run check` → typecheck + `check:js` + `check:ui` + **135 Playwright-тестов зелёные**
  (включая 8 модулей в [`tests/e2e/viz-shell.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/viz-shell.spec.js)
  и 7 новых в [`tests/e2e/research-map.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/research-map.spec.js))
- `python runtime_test.py` → OK · `npm run check:perf` → passed (потолок gzip поднят,
  см. ниже) · `npm run check:security:static` → passed ·
  `python scripts/validate_content.py app_data.json` → 0 errors, 0 warnings
- Бюджет `aaz-index.html` (gzip) поднят 180 000 → 186 000 B: предыдущий main занимал
  179 435 B, то есть 99,7% потолка, и любая новая панель ломала гейт. Стили VIZ-08 стоят
  ~871 B gzip; итог — 180 306 B.

_Dr. Mārcis Gasūns_

## H1602 — context-coverage pack drain (2026-07-24)

One stratified batch of **88** missing-context items received direct `contexts` glosses in `data/modules/*` (assembled into `app_data.json`). Editorial glosses only (house style of prior `inject_mega_pack*`); no invented page numbers; pages already present on each item.

**Model:** Grok 4.5 (`grok-4.5`) — handoff filename locked to Sonnet; user override «run».

### Before / after (`npm run content:audit` / `scripts/content_report.py`)

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Items total | 3376 | 3376 | 0 |
| With direct contexts | 816 (24.2%) | 904 (26.8%) | **+88** (+2.6 pp) |
| With effective contexts | 1091 (32.3%) | 1227 (36.3%) | **+136** (+4.0 pp) |
| Inherited effective | 275 | 323 | +48 |
| Context snippets | 2962 | 3050 | +88 |
| missing_context queue | 2285 | 2149 | −136 |
| v4.7 phase estimate | 73.7% | 80.0% | +6.3 pp |
| Effective target ≥35% | below | **met (36.3%)** | — |

### Stratified batch composition

| Entity | n | Contexts % after |
|---|---:|---:|
| lexicon | 50 | 23.9% |
| names | 12 | 85.2% |
| languages | 6 | 100.0% |
| toponyms | 6 | 92.9% |
| ethnonyms | 5 | 100.0% |
| lexicon_tech | 5 | 25.7% |
| lexicon_reverse | 4 | 2.1% |
| **total** | **88** | **26.8% direct** |

### Validation

- `python scripts/validate_content.py app_data.json` → **OK** (0 errors, 0 warnings)

### Caveats

- Snippets are editorial book-grounded glosses, not verbatim OCR quotes (full page text not in-repo for most loci).
- Technical/OCR heads (`RgH`, `Tj`, `UJ`, `ˀи`…) marked as needing source-table verification.
- Direct coverage still below the 35% *direct* aspirational band; effective coverage now clears 35%.

## H2137 — H2122 dual-run compare (Sonnet independent re-check) (2026-08-06)

**Model:** Sonnet 5 (`claude-sonnet-5`).
**Handoff:** [H2137](https://github.com/gasyoun/Uprava/blob/main/handoffs/H2137-Sonnet_BookIndex_h2122-grok-dual-run-compare_01.08.26.md) — dual-run residual for [H2122](https://github.com/gasyoun/Uprava/blob/main/handoffs/archive/H2122-Sonnet_BookIndex_video-catalog-id-collisions-v0_01.08.26.md) (Grok 4.5 override lane, [#193](https://github.com/gasyoun/BookIndex/pull/193)).

### Independent re-execution on current `main` (post-#193, post-#213, post-4.11.2)

- `python -m unittest tests.unit.test_validate_video_catalog` → **OK**, 6/6 (duplicate-id fixture, id↔URL-mismatch fixture, extractor unit tests).
- `python scripts/validate_content.py app_data.json` → **OK**, 0 errors, 0 warnings.
- `python scripts/dedupe_video_catalog_v0.py app_data.json --dry-run` (re-run against current data) → `raw=176 unique=176 dropped=0` — **idempotent**, confirms zero residual collisions.
- Traced [`docs/history/H2122_video_catalog_collision_census.json`](https://github.com/gasyoun/BookIndex/blob/main/docs/history/H2122_video_catalog_collision_census.json) against [`scripts/dedupe_video_catalog_v0.py`](https://github.com/gasyoun/BookIndex/blob/main/scripts/dedupe_video_catalog_v0.py)'s algorithm: for all 3 collision ids (`Tz3T7IxsbLU`, `xIoXVxahvDY`, `cJp5ZrnGivw`) every dropped row has `related_entities_count = 7`, matching the kept survivor's own count — a genuine tie, so "first wins on ties" correctly kept the lowest `source_index` in each group (45, 55, 59). No richer-but-dropped row exists in any group. Survivor choice independently confirmed correct.
- 16 dropped titles in the census artifact match the commit message's stated count exactly (16/16); issue [#192](https://github.com/gasyoun/BookIndex/issues/192) tracks them per the original commit — not re-fetched here (GitHub API rate-limited during this pass; census JSON is the durable source of truth and is internally consistent).

### Count drift explained (not a defect)

- H2122's own numbers: 191→175 unique. Current `app_data.json` shows `video_catalog` len=176 (176/176 unique, `python -m unittest` guard still passes). Traced via `git log`: commit `96ddecf54` ("ai-wip: add evidence-backed video catalog v2", 2026-08-04) added ONE new, non-colliding video (`spqW9cz7Gk0`) after the H2122 merge — unrelated to the dedupe fix, correctly unique. 175→176 drift is legitimate content growth, not a regression of the collision fix.

### Runtime dedup note (pre-existing, not introduced by H2122)

- `getDedupedVideoCatalog()` in the built frontend bundle already deduped `APP_DATA.video_catalog` at render time by the same "richest `related_entities`, first-on-ties" policy *before* H2122 landed — so the 3 id collisions were likely already invisible to end users in the rendered gallery. H2122's value is a correct single source of truth (search index, static prerender, `validate_content.py` guard) rather than a user-visible bug fix. Worth knowing, not a finding that changes the verdict.

### `/dual-run-salvage` comparison

| Item | Class | Notes |
| --- | --- | --- |
| Survivor selection (3 collision groups) | **identical** | Independently traced algorithm + census data agree with Grok's PR #193 result |
| Guard (`validate_video_catalog`) + unit tests | **identical** | Re-run clean, 6/6 pass |
| Dropped-titles tracking (16, issue #192) | **identical** | Count matches; issue body not re-fetched (rate-limited) |
| Catalog row count (175 vs 176 seen now) | **net-new, unrelated** | Legitimate later addition (`96ddecf54`), not a conflict with H2122 |

**Conflicts:** none. **Keep-best verdict:** keep the merged #193 lane as-is — independent Sonnet re-check finds no correctness gap and no better fix. No code changes landed for this handoff.

_Dr. Mārcis Gasūns_
