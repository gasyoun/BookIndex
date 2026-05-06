# BookIndex

**BookIndex** - автономный интерактивный веб-справочник и корпусная лаборатория по книге А. А. Зализняка **«Из жизни слов и языков»** (Альпина нон-фикшн, 2026, 424 с.).

Проект уже вырос из single-book индекса в основу для корпуса: текущая книга остаётся доступной как самостоятельный артефакт, но данные, маршруты, поиск, карточки, KWIC, экспорт и визуализации подготовлены к подключению следующих книг, видеозаписей и сопоставимых филологических источников.

- Демо: [gasyoun.github.io/BookIndex/aaz-index.html](https://gasyoun.github.io/BookIndex/aaz-index.html)
- Стартовый маршрут: [`#v4/home/home`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home)
- Корпусные источники: [`#v4/corpus/sources`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/corpus/sources)
- Формат данных: [`app_data.json`](app_data.json), `schema_version = 2`
- Standalone-артефакт: [`aaz-index.html`](aaz-index.html)
- Лицензия: [Apache License 2.0](LICENSE)

## Текущий Статус

Версия интерфейса: **v4.4**, обновлено **2026-05-03**.

v4.4 считается стабильной платформой для следующего этапа: импорта второго источника. Фазы корпусной оболочки из [issue #85](https://github.com/gasyoun/BookIndex/issues/85) в основном реализованы:

- `APP_DATA.corpus` хранит registry источников и активную книгу.
- Текущая книга зарегистрирована как `mumintroll`.
- Старые deep links `#v4/...` работают без миграции.
- Поддержаны aliases вида `#v4/books/<book_id>/...`.
- Есть корпусный scope в поиске: `книга` / `корпус`.
- Результаты поиска, списки, карточки, KWIC, `scholar`, VIZ и exports показывают source/book context.
- Добавлен маршрут `#v4/corpus/sources` с runtime-срезом качества данных.
- Подготовлен source type `video_catalog` для будущего каталога примерно 200 видео с тайм-кодами и стенограммами.

Оставшийся хвост v4.4 не архитектурный, а редакторский: **23 suspicious heads** в `lexicon_reverse` и `lexicon_tech` уже помечены как reviewed/triaged и требуют ручной сверки по источнику.

## Что Уже Есть

### Навигация и поиск

- Глобальный поиск по сущностям с Fuse.js.
- Переключатель области поиска: текущая книга или корпус.
- Группировка corpus search results по источнику.
- Понятные empty states для книги и корпуса.
- Share links и стабильные hash routes.
- Legacy hash compatibility для старых ссылок.

### Индексы и карточки

- Сущности: `names`, `toponyms`, `ethnonyms`, `languages`.
- Индексы: `lexicon`, `lexicon_reverse`, `lexicon_tech`, `subject_index`.
- Полнотекстовые карточки с контекстами, страницами, ссылками и source chips.
- Двунаправленные связи персоналий.
- Autolinks в контекстах для сущностей и glossary.
- KWIC-переход из карточек лексики.
- Occurrence strip в карточках: источник, страницы, контексты, refs.

### Материалы и аналитика

- KWIC-конкорданс по `lexicon` и `glossary`.
- Режим «Читаю сейчас» с переходами к страницам.
- Глоссарий, галерея, лекции, цитаты, further reading.
- Scholar-раздел: хронология, библиография, акцентные парадигмы, реконструкции, page trends.
- Markdown и BibTeX exports с source context и `book_id`.

### Визуализации

- D3-граф персоналий.
- Карта с online/offline fallback.
- Дерево языков и граф семейств.
- VIZ-модули на `__vizCache`: heatmap, Sankey, chord, bump-chart и другие.
- Corpus-aware VIZ route alias:
  - `#v4/books/<book_id>/scholar/viz/module/<id>?param=value`
  - `#v4/corpus/viz/module/<id>?books=a,b&param=value`

### PWA и offline

- [`manifest.webmanifest`](manifest.webmanifest)
- [`sw.js`](sw.js)
- offline shell/runtime cache
- tile/media cache fallback
- standalone single-file build

## Снимок Данных

Текущий отчёт `python scripts/content_report.py app_data.json --format json`:

| Метрика | Значение |
|---|---:|
| Источников в корпусе | 3 |
| Страниц в первой книге | 424 |
| Сущностей всего | 3381 |
| Покрытие страницами | 100% |
| Покрытие контекстами | 17.8% |
| Effective context coverage | 23.7% |
| v4.7 progress estimate | ~53.7% |
| v4.7 queue workflow | 100% |
| Markdown exports | 5525 файлов |
| Markdown с source/book/corpus metadata | 100% |
| Duplicate-head groups | 1 |
| Cross-book duplicate candidates | 8 |
| Needs page verification | 6 |
| Sort inversions | 22 |
| Suspicious heads | 23 reviewed, 0 unreviewed |
| Manual audit terms | 11/11 найдены |

Главный вывод: структура и маршруты уже готовы к корпусу; следующий прирост ценности даст не новый chrome UI, а **импорт второго источника, нормализация сущностей и рост покрытия контекстами**.

Текущая редакторская очередь: 23 suspicious heads (23 помечены `needs_review`, 0 без triage), 22 sort inversions, 1 duplicate-head group, 8 cross-book duplicate candidates, 6 page-verification candidates. Из manual audit найдено 11 из 11 терминов; без точного `head` сейчас не остаётся терминов.

Оценка прогресса v4.7: примерно **53.7%**. Workflow очередей сделан на 100%; effective context coverage выросло до 23.7% за счёт правила наследования `lexicon_reverse` -> `lexicon`, прямое покрытие остаётся 17.8%.

## Дорожная Карта

### v4.4 Final: зафиксировать стабильную платформу

Цель: закрыть текущий цикл как устойчивую базу.

- Закрыть или переформулировать [issue #85](https://github.com/gasyoun/BookIndex/issues/85): фазы 1-5 реализованы как первый corpus layer.
- Вынести 23 suspicious heads в отдельную ручную редакторскую задачу.
- Зафиксировать контракт: `APP_DATA.corpus`, `book_id`, `source context`, hash aliases, exports.
- Не ломать `#v4/...` и standalone `aaz-index.html`.

### v4.5: импорт новых источников ✅ реализовано

Цель: подключать новые источники без переписывания интерфейса.

Статус: импортный слой и корпусная модель уже используются; в корпусе сейчас 3 книги.

Что сделано:

- Заведен промежуточный формат `data/imports/<book_id>/draft.json`.
- Добавлен importer `scripts/import_source.py`.
- Добавлены статусы источника: `draft`, `validated`, `published`.
- Новые источники входят в `APP_DATA.corpus.books`.
- Markdown export получает `source`, `book_id` и corpus metadata.

Критерий готовности:

- `books_total >= 2` — сейчас 3.
- Старый маршрут `aaz-index.html#v4/home/home` работает как раньше.
- Новые источники видны в `#v4/corpus/sources`.
- Поиск, карточки и exports сохраняют source context.

### v4.6: нормализация сущностей между книгами ◐ частично реализовано

Цель: один термин, персона или язык должны связывать несколько источников, а не распадаться на дубли.

Что уже есть:

- `canonical_id` есть почти у всех сущностей.
- `occurrences` есть почти у всех сущностей.
- Карточки, source display, BibTeX/export и метрики понимают occurrence-shaped data.

Что осталось:

- Хранить варианты написания в `aliases`.
- Отдельно валидировать `head`, `display_name`, `source_head`.
- Улучшить матрицу встречаемости: книга x страницы x контексты.
- Quality queue уже показывает 8 cross-book duplicate candidates.

Критерий готовности:

- Пользователь открывает термин и видит, где он встречается в разных книгах.
- Переходы по связанным сущностям сохраняют source context.
- KWIC может работать по текущей книге или по корпусу.

### v4.7: качество контекстов

Цель: поднять полезность данных для чтения и исследования.

Что сделать:

- Довести coverage контекстами с 17.8% до 35-40% как ближайший реалистичный рубеж.
- Приоритизировать `lexicon`, `subject_index`, `lexicon_reverse`.
- Первый слой редакторских очередей уже добавлен в `#v4/corpus/sources` и `tests/index-audit-queue.json`:
  - нет контекста;
  - нет source;
  - suspicious head;
  - cross-book duplicate candidate;
  - нужна сверка по странице;
  - возможный дубль.
- Использовать эти очереди как рабочий список для дальнейшей чистки данных.
- Отчёт и corpus sources panel показывают progress estimate для v4.7, чтобы было видно: workflow готов, а content cleanup/context growth ещё впереди.
- `lexicon_reverse` считается индексной проекцией `lexicon`: если у прямого `lexicon`-элемента есть контекст, reverse-row получает effective context без копирования текста в данные.
- `missing_context` отсортирован по priority score; первые ручные targets: `двойственное число`, `заимствование, заимствованные слова`, `иероглиф, иероглифический знак`, `калька, калькирование`, `разговорный язык, разговорная речь`.
- `tests/context-entry-pack.json` генерируется через `npm run content:audit` как первый 25-item manual context-entry pack из `context_priority_top`; он не правит content data.

Критерий готовности:

- `#v4/corpus/sources` показывает не только totals, но и actionable queue.
- Validation warnings можно разбирать без чтения CI logs.

### v4.8: видеокаталог Зализняка

Цель: подключить примерно 200 видео как равноправный корпусный источник.

Что сделать:

- Описать `video_catalog` schema:
  - `video_id`
  - `title`
  - `date`
  - `source_url`
  - `duration`
  - `timecodes`
  - `transcript`
  - `linked_entities`
  - `citation`
- Добавить импорт CSV/JSON для видео.
- Связать тайм-коды с сущностями.
- Показать видео-результаты в corpus search рядом с книгами.

Критерий готовности:

- Поиск по термину находит книгу/страницу и видео/timestamp.
- Карточка сущности показывает, где термин встречается в книгах и видео.

### v5: корпусные визуализации

Цель: перейти от визуализаций одной книги к сравнительным корпусным режимам.

Что сделать:

- Добавить book filter во все VIZ-модули.
- Начать с одного compare mode: `term frequency by source`.
- Сохранять выбранные книги в URL: `?books=a,b`.
- Показывать книгу/источник в legends, tooltips и exports.

Критерий готовности:

- Хотя бы один VIZ-модуль сравнивает две книги.
- Viewport smoke остаётся зелёным для `1366x900`, `900x900`, `390x844`.

## Ближайший Рабочий Спринт

1. Закрыть или переформулировать `#85`: первый corpus layer уже реализован.
2. Вынести 23 reviewed suspicious heads в отдельный ручной issue.
3. Разобрать 1 duplicate-head group и 22 sort inversions через новую quality queue.
4. Проверить 6 page-verification candidates и 8 cross-book duplicate candidates через quality queue.
5. Начать рост контекстного покрытия с `lexicon` и `subject_index`.
6. Уточнить правило для `lexicon_reverse`: наследовать контексты из `lexicon` или считать reverse-list отдельной индексной проекцией.

## Архитектура

| Файл / директория | Назначение |
|---|---|
| [`aaz-index.html`](aaz-index.html) | Готовый standalone SPA-артефакт |
| [`v3_app.js`](v3_app.js) | Основной runtime и UI |
| [`v3_template.html`](v3_template.html) | HTML-шаблон single-file сборки |
| [`app_data.json`](app_data.json) | Собранная база данных приложения |
| [`data/modules/`](data/modules/) | Модульные JSON-части `app_data.json` |
| [`src/content/`](src/content/) | Markdown export сущностей и разделов |
| [`scripts/build_aaz_index.mjs`](scripts/build_aaz_index.mjs) | Основная Node-сборка standalone HTML |
| [`scripts/build_aaz_index.py`](scripts/build_aaz_index.py) | Legacy Python-сборка |
| [`scripts/validate_content.py`](scripts/validate_content.py) | Структурная validation данных |
| [`scripts/content_report.py`](scripts/content_report.py) | Метрики качества контента |
| [`scripts/viz/`](scripts/viz/) | VIZ cache, state helpers и lazy VIZ-модули |
| [`schemas/app_data.schema.json`](schemas/app_data.schema.json) | JSON Schema для `app_data.json` |
| [`tests/e2e/`](tests/e2e/) | Playwright smoke |
| [`runtime_test.py`](runtime_test.py) | Runtime/static guards |

## Локальный Запуск

Установка:

```bash
npm ci
pip install -r requirements.txt
```

Основные команды:

```bash
npm run build
npm run check
npm run serve:static
```

Отдельные проверки:

```bash
python scripts/check_encoding.py
python scripts/validate_content.py app_data.json
python scripts/content_report.py app_data.json
python runtime_test.py
node --check v3_app.js
playwright test
```

Работа с данными:

```bash
npm run data:split
npm run data:assemble
npm run content:audit
```

## Правила Разработки

- Не ломать существующие `#v4/...` маршруты.
- Не удалять standalone-сборку `aaz-index.html`.
- Не мигрировать все данные ради одного источника.
- Не делать UI зависимым от backend.
- Любая новая книга или видео должны входить через import/validation pipeline.
- Все публичные строки поиска, карточек, KWIC, scholar, VIZ и exports должны показывать source context.
- После изменений runtime, шаблона, данных или VIZ нужно пересобирать `aaz-index.html`.
- Для задач и публикации использовать [`CODEX_WORKFLOW_RU.md`](CODEX_WORKFLOW_RU.md).

## Документы

- [`CODEX_WORKFLOW_RU.md`](CODEX_WORKFLOW_RU.md) - регламент issue, labels, проверок и публикации.
- [`CODEX_VISUALIZATIONS_RU.md`](CODEX_VISUALIZATIONS_RU.md) - регламент VIZ-модулей.
- [`CODEX_VIZ_INSTRUCTIONS_RU.md`](CODEX_VIZ_INSTRUCTIONS_RU.md) - инструкции по реализации визуализаций.
- [`KIDS_GUIDE_RU.md`](KIDS_GUIDE_RU.md) - пользовательская инструкция простым языком.
- [`ISSUE_PUBLISH_CHECKLIST_RU.md`](ISSUE_PUBLISH_CHECKLIST_RU.md) - чеклист публикации задач.
- [`deep-research-report.md`](deep-research-report.md) - исторический аудит проекта.

## Лицензия

Код и материалы репозитория распространяются по [Apache License 2.0](LICENSE), если для конкретных внешних источников не указаны дополнительные условия цитирования или переиспользования.
