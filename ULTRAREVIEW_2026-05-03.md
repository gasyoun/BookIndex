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

### 3.2 Несоответствие метрик: content_report vs corpus dashboard

Офлайн-отчёт `content_report.py` показывает:
- **15.1% context coverage** — 494 из 3269 сущностей
- **3 duplicate head groups**
- **0% sources coverage** (в данных нет `sources`)

Но live corpus dashboard (`#v4/corpus/sources`) показывал:
- **0% CONTEXT COVERAGE**
- **1 476 DUPLICATE HEAD GROUPS**

**Диагноз:** Это «growing pains» — корпусный dashboard вычисляет метрики иначе, чем `content_report.py`. Возможные причины:
1. Dashboard считает дубли по другому алгоритму (возможно включая markdown-экспорт файлы `src/content/` с дубликатами `-2`, `-3`, `-4`)
2. Context coverage в dashboard может считаться иначе (доля снипетов от теоретического максимума, а не доля сущностей с хотя бы одним контекстом)

**Рекомендация:** Унифицировать алгоритм — использовать `content_report.py` как единственный источник правды; corpus dashboard должен вызывать ту же логику.

### 3.3 Дублирующиеся markdown-файлы в `src/content/`

Директория `src/content/` содержит тысячи markdown-файлов экспорта. Многие имеют суффиксы `-2`, `-3`, `-4` (например, `zabit-2.md`, `zabit.md`). Это либо:
- Дубли разных сущностей с одинаковым slug-ом
- Артефакты экспорта, которые создают ложные duplicate head groups

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

- [ ] Унифицировать метрики corpus dashboard с `content_report.py`
- [ ] Разобрать дублирующиеся markdown-файлы в `src/content/`
- [ ] Консолидировать `smoke.spec.js` и `smoke.spec.new.js`
- [ ] Закрыть [issue #85](https://github.com/gasyoun/BookIndex/issues/85) итоговым комментарием
- [ ] Вынести 23 suspicious heads в отдельную ручную задачу
- [ ] Убедиться: README-метрики = live dashboard = `content_report.py`

### Фаза 2: v4.5 — Импорт второго источника

> Второй источник будет предоставлен владельцем.

Подготовительные шаги (можно начать уже сейчас):

- [ ] Формализовать `data/imports/<book_id>/draft.json` schema
- [ ] Создать шаблон importer: `scripts/import_source.py`
- [ ] Добавить статусы источника: `draft` → `validated` → `published`
- [ ] Добавить validation/report для нового источника без публикации в UI
- [ ] После валидации — добавить второй источник в `APP_DATA.corpus.books`

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
