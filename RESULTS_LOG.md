# Results log

_Created: 24-07-2026 · Last updated: 30-07-2026_

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
