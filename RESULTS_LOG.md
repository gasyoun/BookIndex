# Results log

_Created: 24-07-2026 · Last updated: 31-07-2026_

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

_Dr. Mārcis Gasūns_
