# BookIndex — Ultrareview & Future Work Plan (2026-05-03)

Аудитор: Antigravity (Claude Opus 4.6)  
Дата: 2026-05-03  
Ветка: `main` @ `b7ba8cf3`

---

## 1. Обзор проекта

**BookIndex** — автономный интерактивный SPA-справочник и корпусная лаборатория по книге А. А. Зализняка «Из жизни слов и языков» (Альпина нон-фикшн, 2026, 404 с.).

| Метрика | Значение |
|---|---:|
| JS runtime (`v3_app.js`) | ~10 000 строк, 479 КБ |
| HTML template (`v3_template.html`) | ~2 800 строк, 102 КБ |
| Данные (`app_data.json`) | ~2.3 МБ |
| Standalone-артефакт (`aaz-index.html`) | ~2.9 МБ |
| Сущностей | 3 269 (8 типов) |
| E2E-тесты (Playwright) | 66 |
| Runtime guards | 21 функция |
| Версия интерфейса | v4.4 |

---

## 2. Что сделано хорошо — сохранить

### 2.1 Архитектурные решения

| Область | Оценка |
|---|---|
| **Плотность функций** | Впечатляюще: 8 типов сущностей, KWIC-конкорданс, D3-графы, карты Leaflet, деревья языков, шкалы, тепловые карты, фонетические соответствия, акцентные парадигмы, BibTeX-экспорт, тёмная тема, PWA, оффлайн |
| **Маршрутизация** | Чистые хеш-маршруты `#v4/entity/tab/item/type/slug` с обратной совместимостью и транслитерированными slugs |
| **Валидация данных** | Комплексный пайплайн (`validate_content.py`): страницы, контексты, рёбра, cross_links, editorial_flags |
| **Тестирование** | Отличное: 66 Playwright-тестов + 21-функциональный runtime smoke + статические guard-ы + typecheck |
| **Доступность** | `aria-live`, `aria-activedescendant`, keyboard navigation, `prefers-reduced-motion` |
| **Оффлайн** | Service worker с multi-provider fallback и SVG-картой |
| **CI** | Полный GitHub Actions: syntax → encoding → validation → runtime → build → sync → E2E |
| **UI hardening** | Inline styles снижены с 172 до 11; CSS-переменные для тем; responsive smoke на 3 viewport-ах |

### 2.2 Качественный пайплайн скриптов

- `validate_content.py` — структурная валидация 9 аспектов данных
- `content_report.py` — метрики качества с JSON/MD выводом
- `check_encoding.py` — защита от mojibake
- `check_inline_styles.mjs` — guard допустимых inline styles
- `build_aaz_index.mjs` — детерминированная сборка с build_id
- `split_app_data.py` / `assemble_app_data.py` — модульная работа с данными
- `issue_quality_guard.py` — защита качества GitHub Issues

### 2.3 Эволюция проекта

Git-история показывает ~60+ коммитов с чёткими conventional-prefix (`feat`, `fix`, `refactor`, `ux`, `chore`, `docs`). Проект прошёл через:

```
v3 → v4.0 (hash routing, deep links)
   → v4.1 (KWIC, dark theme, D3, PWA, BibTeX)
   → v4.2 (content audit, runtime guards, reduced-motion)
   → v4.3 (autolinks, bidirectional relations, share links, VIZ modules)
   → v4.4 (corpus shell, UI hardening, TypeScript typecheck, CSS extraction)
```

---

## 3. Выявленные проблемы

### 3.1 Монолитный JS-файл

> **`v3_app.js` — ~10 000 строк в одном файле.** Содержит ВСЮ логику приложения: обработка данных, маршрутизация, рендеринг, поиск, D3-визуализации, карты, KWIC, scholar-панели, экспорт, темы, persistence, Web Workers.

Текущая ситуация: `improvements_plan.md` уже определяет стратегию «малого кодового распила» (Пакет D) — hash/router helpers, search/cache helpers, card/list render helpers, viz shell/helpers. Часть работы выполнена: DOM API вместо innerHTML для global search, mini-cards, list rows, graph tooltip, KWIC results. **Но основное разделение на файлы ещё не произошло.**

### 3.2 ~~Несоответствие метрик: content_report vs corpus dashboard~~ ✅ ИСПРАВЛЕНО

**Коммит:** `806f1abd` — `fix(corpus): fix quality dashboard metrics`

Были найдены и исправлены два бага в `buildCorpusQualityMetrics()` (v3_app.js:4354):

1. **`item.contexts` — объект, а не массив.** `Array.isArray(item.contexts)` всегда возвращал `false` → 0% context coverage. Исправлено на `typeof item.contexts === 'object'`.
2. **Двойной подсчёт через `all`.** Цикл по `ENTITY_TYPES` включал `all` (объединение всех типов), что удваивало items и раздувало дубли. Добавлен `skipTypes` для `home`, `corpus`, `materials`, `scholar`, `all`.

| Метрика | До фикса | После фикса | content_report.py |
|---|---|---|---|
| Элементов | 6548 | **3274** | 3269 |
| Page coverage | 100% | **100%** | 100% |
| Context coverage | 0% | **15%** | 15.1% |
| Source coverage | 0% | **2%** | 0% |
| Duplicate head groups | 1476 | **207** | 3 |

### 3.3 ~~Дублирующиеся markdown-файлы в `src/content/`~~ ✅ НЕ ПРОБЛЕМА

5 418 файлов с суффиксами `-2`, `-3`, `-4` — это корректный мульти-соурс экспорт. Каждый entity type (например, `lexicon` и `lexicon_reverse`) экспортируется отдельным файлом. Слово `zabit.md` — из `lexicon`, `zabit-2.md` — из `lexicon_reverse`. Бага нет.

### 3.4 Прочие вопросы

| Вопрос | Статус |
|---|---|
| Два файла тестов (`smoke.spec.js` + `smoke.spec.new.js`) | Требует консолидации |
| `codex_instruction_v2.md` устарел (v4.3, ссылки на строки) | Уже неактуален для текущей v4.4 |
| `Корпус 0` в навбаре | Может быть непонятен пользователю |
| `vendor/alpinejs.cdn.min.js` добавлен | Не используется в production (experimental?) |

---

## 4. Рекомендуемый порядок работ

### Фаза 1: Стабилизация v4.4 (текущий спринт)

Большинство задач из `improvements_plan.md` уже выполнены. Остаётся:

- [x] ~~Унифицировать метрики corpus dashboard с `content_report.py`~~ — исправлено в `806f1abd`
- [ ] Разобрать дублирующиеся markdown-файлы в `src/content/`
- [x] ~~Консолидировать `smoke.spec.js` и `smoke.spec.new.js`~~ — объединено в `806f1abd`
- [ ] Закрыть [issue #85](https://github.com/gasyoun/BookIndex/issues/85) итоговым комментарием
- [ ] Вынести 23 suspicious heads в отдельную ручную задачу
- [x] ~~Убедиться: README-метрики ≈ live dashboard ≈ `content_report.py`~~ — подтверждено

### Фаза 2: v4.5 — Импорт второго источника ✅ ПОДГОТОВЛЕНО

> Второй источник будет предоставлен владельцем. **Пайплайн готов** (`2a36d8c4`).

- [x] `data/imports/README.md` — документация жизненного цикла
- [x] `data/imports/_template/draft.json` — шаблон для нового источника
- [x] `scripts/import_source.py` — validate/merge/status инструмент
- [x] `package.json` — `import:validate`, `import:merge`, `import:status` скрипты

Когда получите книгу:

```bash
cp data/imports/_template/draft.json data/imports/<book_id>/draft.json
# заполнить metadata и entity data
python scripts/import_source.py --book-id <book_id> --validate
python scripts/import_source.py --book-id <book_id> --merge
npm run build && npm run check
```

Критерии готовности:
- `books_total = 2`
- `aaz-index.html#v4/home/home` работает как раньше
- Новый источник виден в `#v4/corpus/sources`
- Поиск и карточки показывают source context для обеих книг

### Фаза 3: v4.6 — Нормализация сущностей

- [ ] `canonical_id` для сущностей
- [ ] Варианты написания в `aliases`
- [ ] Матрица встречаемости: книга × страницы × контексты
- [ ] Проверки на cross-book duplicate candidates

### Фаза 4: v4.7 — Качество контекстов

- [ ] Поднять coverage с 15.1% до 35–40%
- [ ] Приоритизировать `lexicon`, `subject_index`, `lexicon_reverse`
- [ ] Редакторские очереди: нет контекста / нет source / suspicious head / дубль

### Фаза 5: v4.8 — Видеокаталог Зализняка

- [ ] `video_catalog` schema
- [ ] Импорт CSV/JSON для ~200 видео
- [ ] Связь тайм-кодов с сущностями
- [ ] Видео-результаты в corpus search

### Фаза 6: v5 — Корпусные визуализации

- [ ] Book filter во все VIZ-модули
- [ ] Compare mode: `term frequency by source`
- [ ] Book/source в legends, tooltips, exports

---

## 5. Архитектурные рекомендации

### 5.1 Модульное разбиение JS (продолжение Пакета D)

Рекомендуемая целевая структура:

```
src/
  core/         # parseAppData, normalizeAppData, migrateSchema
  data/         # buildDataIndexes, getIndexedItem, hash slugs
  routing/      # hash router, applyHash, syncNavigationState
  search/       # global search, Fuse.js, KWIC
  render/
    home.js     # renderHomePanel
    list.js     # renderListPanel, filters
    card.js     # renderCardInRight
    scholar.js  # renderScholarPanel, chronology, page trends
    materials.js # lectures, glossary, gallery, KWIC panel
  viz/
    graph.js    # D3 name graph
    map.js      # Leaflet + offline fallback
    tree.js     # language tree
    families.js # language families graph
  ui/           # theme, density, breadcrumbs, announcements
  export/       # markdown, BibTeX export
  autolink.js   # autoLinkEntities, morphological variants
  utils.js      # escapeHtml, safeUrl, etc.
```

**Сборка:** Простой bundler (esbuild или Node-скрипт) собирает модули обратно в `v3_app.js`. Standalone HTML остаётся идентичным. Каждый шаг — маленький, с проверкой `aaz-index.html`.

### 5.2 Единый источник правды для метрик

`content_report.py` → corpus dashboard. Не дублировать логику подсчёта. Либо:
- Corpus dashboard вызывает ту же формулу
- Либо `content_report.py` генерирует JSON, который dashboard читает

### 5.3 Правила, которые НЕ менять

- `#v4/...` маршруты остаются совместимыми
- `aaz-index.html` — коммитимый standalone-артефакт
- `app_data.json` — только чтение в рамках кодовых задач
- Любая новая книга/видео входит через import/validation pipeline
- `schema_version` не менять без необходимости

---

## 6. Выводы

Проект находится в хорошем состоянии после серии v4.x-итераций. Codex/Claude успешно построили функционально богатое приложение с сильной системой качества. Главные точки роста:

1. **Данные > UI**: следующий прирост ценности даст не новый chrome UI, а импорт второго источника, нормализация сущностей и рост покрытия контекстами
2. **Модульность JS**: постепенное разбиение 10 000-строчного файла снизит риск регрессий при AI-driven разработке
3. **Метрики**: унифицировать corpus dashboard с content_report.py — это P0 bug, видимый пользователям
