# BookIndex / «Зализнякиада»

Автономный интерактивный веб-справочник к книге А. А. Зализняка  
«Из жизни слов и языков» (Альпина нон-фикшн, 2026, 404 с.).

## Актуальный статус

- Текущая версия: `v4.4` (обновлено `2026-04-28`).
- Базовый артефакт: [aaz-index.html](aaz-index.html) (single-file SPA).
- Демо (GitHub Pages): [aaz-index.html](https://gasyoun.github.io/BookIndex/aaz-index.html)
- Формат данных: [app_data.json](app_data.json) (`schema_version = 2`).
- Детская инструкция: [KIDS_GUIDE_RU.md](KIDS_GUIDE_RU.md).
- Регламент оформления и публикации: [CODEX_WORKFLOW_RU.md](CODEX_WORKFLOW_RU.md).
- Инструкция для Codex: [codex_instruction_v2.md](codex_instruction_v2.md).
- Регламент визуализаций: [CODEX_VISUALIZATIONS_RU.md](CODEX_VISUALIZATIONS_RU.md).
- Инструкция реализации VIZ-модулей: [CODEX_VIZ_INSTRUCTIONS_RU.md](CODEX_VIZ_INSTRUCTIONS_RU.md).
- Чеклист публикации issues: [ISSUE_PUBLISH_CHECKLIST_RU.md](ISSUE_PUBLISH_CHECKLIST_RU.md).

## Функционал

### Навигация и поиск

- [Домашняя панель](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) с KPI и быстрыми переходами.
- [Глобальный поиск](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) по всем сущностям.
- [Нечёткий поиск (Fuse.js)](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) для запросов с опечатками.
- [Глубокие ссылки (`#v4/...`)](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/phonetic_laws) для карточек, вкладок и состояний.
- [Совместимость с legacy-hash маршрутами](https://gasyoun.github.io/BookIndex/aaz-index.html#names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.).
- [Share-кнопка](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list/item/names/%D0%97%D0%B0%D0%BB%D0%B8%D0%B7%D0%BD%D1%8F%D0%BA%20%D0%90.%20%D0%90.) — копирование deep link карточки в буфер обмена (`#copy-card-link`, clipboard API + fallback).

### Каталоги и карточки

- Сущности: [`names`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list), [`toponyms`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/toponyms/list), [`ethnonyms`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/ethnonyms/list), [`languages`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/languages/list).
- [Полнотекстовые карточки](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.) с перекрёстными ссылками.
- Индексные разделы: [`lexicon`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon/list), [`lexicon_reverse`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon_reverse/list), [`lexicon_tech`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon_tech/list), [`subject_index`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/subject/list).
- [`lexicon_reverse`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon_reverse/list): сортировка по правому краю слова, полноширинный layout, до 6 колонок на широких экранах.
- В list-view: кнопка `наиболее частотные сверху` — сортировка без диапазона `от/до`.
- [Фильтрация и сортировки](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic) в ключевых разделах.

### Перелинковка

- **Автолинки в контекстах** — автоматическая расстановка ссылок на сущности типов `names`, `toponyms`, `ethnonyms`, `languages`, `glossary` в текстах контекстов (`autoLinkEntities()`).
- **KWIC-jump из карточки lexicon** — кнопка перехода прямо в KWIC-конкорданс с подстановкой термина (`renderKwicPanel()`, флаг `window._pendingKwicTerm`).
- **Двунаправленные рёбра в карточке персоналий** — карточка `names` показывает как прямые, так и обратные связи (`getReverseEdgesIndex()`, `collectNameRelationLinks()`, `.relation-chip`).
- **Обратные ссылки lexicon → subject_index** — в карточке `lexicon` блок «В предметном указателе» со ссылками на соответствующие рубрики (`getSubjectByLexiconIndex()`, `.subject-crosslinks`).

### Материалы и аналитика

- [KWIC-конкорданс](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic) (по `lexicon` и `glossary`) с:
  - фильтром диапазона страниц;
  - сортировкой левого/правого контекста;
  - ограничением выдачи и явной меткой `truncated`.
- [Режим «Читаю сейчас»](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lectures): ввод страницы, шаг назад/вперёд, быстрый переход к динамике страницы.
- [Лекции](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lectures), [глоссарий](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/glossary), [галерея](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/gallery), [«Русский во времени»](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/russian_evolution), [фонетические законы](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/phonetic_laws).
- [Профессиональный аппарат](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar):
  - [хронология](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/chronology);
  - [акцентные парадигмы](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-accents);
  - [сравнительные таблицы](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-correspondences);
  - [реконструкции](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-reconstructions) в 4 колонки на десктопе.

### Визуализации

- [D3-граф персоналий](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/graph) ([vendor/d3.v7.min.js](vendor/d3.v7.min.js)): zoom/pan, фильтр веса ребра, tooltip, переход в карточку.
- [Дерево языков](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/languages/tree) и [граф семейств](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/languages/families).
- [Карта](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/toponyms/map) с offline-fallback, если внешние тайлы недоступны.

### Доступность и UX

- [Тёмная/светлая тема](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) с сохранением выбора.
- [Режимы плотности интерфейса](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) (`compact`, `reader`, `research`).
- Поддержка `prefers-reduced-motion`: снижение анимаций, отключение плавного scroll к якорям.

### Экспорт и PWA

- Экспорт всего сайта в Markdown с [домашней панели](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home): обзор, маршруты, лекции, `further_reading`, глоссарий, `scholar` и все индексные карточки.
- Экспорт BibTeX: [scholar bibliography](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-biblio), [further reading](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/further_reading), [источники из карточек](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.).
- PWA-база: [`manifest.webmanifest`](https://gasyoun.github.io/BookIndex/manifest.webmanifest), [`sw.js`](https://gasyoun.github.io/BookIndex/sw.js) (shell cache + runtime cache + tile/media cache + offline fallback), [иконки](https://gasyoun.github.io/BookIndex/icon-512.svg).

---

## Что нового

### v4.4 (2026-04-28)

- **Стабилизирован локальный DX-слой**: добавлены единые npm-команды `check`, `check:js`, `check:e2e`, `build`, `build:legacy`; lockfile синхронизирован с Vite/TypeScript-зависимостями из `package.json`.
- **Python-окружение зафиксировано** в [requirements.txt](requirements.txt): для полной JSON Schema-проверки нужен `jsonschema`.
- **Экспериментальный `home/home_decl` скрыт из основной навигации**; классический `home/home` остаётся публичным стартовым экраном.
- **VIZ hardening**: добавлен helper [scripts/viz/viz-state.js](scripts/viz/viz-state.js) для query-state в hash, VIZ-01 получил `Play/Pause`, VIZ-03 переведён в компактную сетку, VIZ-07 защищает подписи справа от наложений.
- **Документация очищена**: восстановлен битый раздел 1 в [CODEX_WORKFLOW_RU.md](CODEX_WORKFLOW_RU.md), убраны служебные `[cite:*]` из [CODEX_VISUALIZATIONS_RU.md](CODEX_VISUALIZATIONS_RU.md).
- **LICENSE не выбран автоматически**: это отдельное governance-решение владельца проекта.

### v4.3 (2026-04-20)

- **Автолинки `glossary` в контекстах** — термины глоссария теперь автоматически становятся ссылками в текстах контекстов всех сущностей (`.ctx-link[data-type="glossary"]`); клик открывает соответствующую статью глоссария.
- **Обратные ссылки `lexicon → subject_index`** — в карточке каждого термина `lexicon` появился блок «В предметном указателе» со ссылками на соответствующие рубрики `subject_index` (`.subject-crosslinks`, `getSubjectByLexiconIndex()`).
- **Новый таб визуализаций `scholar/viz`** — добавлен роутинг по модулям (`#v4/scholar/viz/module/<id>`) и короткий алиас `#viz`.
- **Экспериментальный таб `home/home_decl`** — добавлен декларативный рендер главной панели на Alpine.js с fallback на классический `home/home`; подключён локальный `vendor/alpinejs.cdn.min.js` и кеширование ассета в `sw.js`.
- **Общий препроцессор `__vizCache`** — вынесен в [scripts/viz/build-viz-cache.js](scripts/viz/build-viz-cache.js), с прогревом через [scripts/viz/build-viz-cache-worker.js](scripts/viz/build-viz-cache-worker.js) при открытии вкладки визуализаций.
- **Реализованы модули VIZ-01…VIZ-07** в [scripts/viz/](scripts/viz/): timeline, heatmap, cooccurrence graph, bump chart, chord, map timeline, narrative sankey.
- **`chapters.century` добавлен в [app_data.json](app_data.json)** для поддержки сценариев визуализаций по векам.
- **[codex_instruction_v2.md](codex_instruction_v2.md) синхронизирован с `main`** — статусы всех задач спринта v4.3 обновлены, line-based ссылки заменены именами функций, DoD приведён к актуальному состоянию (closes #70, #71).

### v4.2.1 (2026-04-19)

- `home/home`: экспорт Markdown охватывает весь BookIndex: обзор, маршруты, лекции, further reading, глоссарий, scholar и все карточки индексных разделов.
- `scholar/scholar`: восстановлена битая кириллица в блоках о «Слове о полку Игореве», further reading и таблице фонетических соответствий; диапазоны страниц нормализованы к виду `317–320`.
- `scholar/scholar#sch-reconstructions`: раздел «Реконструкции» перестроен в 4-колоночную сетку на широких экранах.
- `lexicon_reverse/list`: полноширинный layout, сортировка по правому краю слова, до 6 колонок на широких экранах.
- `list-view`: числовой фильтр частотности заменён на toggle `наиболее частотные сверху`.
- Рефакторинг KWIC: вынесена общая нормализация диапазонов страниц, оптимизирован сбор контекстов.
- Усилен [scripts/issue_quality_guard.py](scripts/issue_quality_guard.py): детект mojibake (UTF-8/CP1251 и UTF-8/Latin-1).
- Добавлен регламент работы: [CODEX_WORKFLOW_RU.md](CODEX_WORKFLOW_RU.md).
- Нормализована система labels по шаблону #42: `priority + area + type + phase`.

### v4.2 и ранее

- KWIC-jump из карточки `lexicon`/`lexicon_tech` (`renderKwicPanel()`, `.kwic-jump-btn`).
- Двунаправленные рёбра в карточке персоналий (`getReverseEdgesIndex()`, `.relation-chip`).
- Share deep link — копирование ссылки на карточку (`copyCurrentUrl()`, `#copy-card-link`).
- D3-граф персоналий, дерево и граф семейств языков, карта топонимов.
- PWA: manifest, service worker, иконки.
- BibTeX-экспорт из нескольких точек интерфейса.
- Режим «Читаю сейчас» в разделе «Лекции».

---

## Быстрый старт

1. Откройте [aaz-index.html](aaz-index.html) в браузере.
2. Для локальной разработки используйте [v3_template.html](v3_template.html) + [v3_app.js](v3_app.js) + [app_data.json](app_data.json).
3. Пересборка итогового файла:

```bash
npm run build
```

Сборка из модульных данных (`data/modules/*.json`) вместо монолита:

```bash
python scripts/build_aaz_index.py --modules-dir data/modules
```

Python-сборщик оставлен как legacy-вариант; основной npm build использует Node-эквивалент [scripts/build_aaz_index.mjs](scripts/build_aaz_index.mjs), чтобы standalone-артефакт можно было пересобрать после `npm ci` без отдельного Python runtime.

Альтернативная сборка через Vite single-file (экспериментальный pipeline):

```bash
npm ci
npm run build:vite
```

Основная сборка legacy-артефакта через npm-обёртку:

```bash
npm run build:legacy
```

Разделение/склейка `app_data.json`:

```bash
python scripts/split_app_data.py app_data.json --out-dir data/modules
python scripts/assemble_app_data.py --modules-dir data/modules --out app_data.json
```

Одноразовый экспорт монолитного `app_data.json` в плоский каталог Markdown-файлов `src/content/`:

```bash
node scripts/export_app_data_to_markdown.mjs --input app_data.json --out src/content --clean
```

## Локальные проверки перед релизом

Минимальный набор:

```bash
npm ci
npm run typecheck
python scripts/check_encoding.py
python scripts/validate_content.py app_data.json
python scripts/content_report.py
python runtime_test.py
```

Единая JS/e2e-проверка:

```bash
npm run check
```

Полный smoke/e2e:

```bash
npm run e2e
```

Если `node` не в `PATH`, для [runtime_test.py](runtime_test.py) можно явно указать бинарник:

```powershell
$env:NODE_BINARY = 'C:\path\to\node.exe'
python runtime_test.py
```

Опционально для JSON Schema-проверки в [scripts/validate_content.py](scripts/validate_content.py):

```bash
python -m pip install -r requirements.txt
```

Ожидается:

- [scripts/validate_content.py](scripts/validate_content.py): `0 errors` (допустимы известные warning по дублям данных).
- [runtime_test.py](runtime_test.py): `21/21`.
- `playwright test`: все тесты pass.

## Контент-аудит (метрики)

```bash
python scripts/content_report.py
python scripts/content_report.py --format json
```

Отчёт включает: количество элементов по сущностям, долю элементов с `page_list`/`contexts`/`sources`, количество дубликатов `head`, агрегированные totals.

## Структура проекта

| Файл / директория | Назначение |
|---|---|
| [aaz-index.html](aaz-index.html) | Готовый standalone-артефакт (сборка) |
| [v3_template.html](v3_template.html) | HTML-шаблон (`__APP_SCRIPT__`) |
| [v3_app.js](v3_app.js) | Основной runtime/UX |
| [app_data.json](app_data.json) | База контента (только чтение) |
| [data/modules/](data/modules/) | Логически разделённые модули данных (`manifest.json` + тематические JSON) |
| [runtime_test.py](runtime_test.py) | Runtime smoke и статические guard'ы |
| [scripts/build_aaz_index.mjs](scripts/build_aaz_index.mjs) / [scripts/build_aaz_index.py](scripts/build_aaz_index.py) | Основная Node-сборка и legacy Python-сборка `aaz-index.html` |
| [scripts/split_app_data.py](scripts/split_app_data.py) | Разбиение `app_data.json` на модульные JSON |
| [scripts/assemble_app_data.py](scripts/assemble_app_data.py) | Склейка модульных JSON обратно в `app_data.json` |
| [scripts/export_app_data_to_markdown.mjs](scripts/export_app_data_to_markdown.mjs) | Одноразовый экспорт `app_data.json` в Markdown (`src/content/*.md`, плоская структура) |
| [scripts/app_data_modules.py](scripts/app_data_modules.py) | Общая логика split/assemble модульных данных |
| [src/content/](src/content/) | Сгенерированный плоский каталог Markdown-контента (без подпапок) |
| [types/app-data.d.ts](types/app-data.d.ts) | Централизованные TS-типы структуры `APP_DATA` |
| [tsconfig.typecheck.json](tsconfig.typecheck.json) | Конфигурация type-check для JS/JSDoc (`tsc --checkJs`) |
| [experimental/svelte-pilot/](experimental/svelte-pilot/) | Изолированный пилот декларативного UI на Svelte |
| [vite.config.mjs](vite.config.mjs) | Vite-конфигурация альтернативной single-file сборки |
| [scripts/vite/postbuild-copy.mjs](scripts/vite/postbuild-copy.mjs) | Копирование `dist-vite/index.html` в `aaz-index.html` |
| [scripts/viz/](scripts/viz/) | VIZ-модули, query-state helper и препроцессор кэша (`viz-state.js`, `build-viz-cache.js`, `build-viz-cache-worker.js`) |
| [scripts/validate_content.py](scripts/validate_content.py) | Структурная валидация данных |
| [schemas/app_data.schema.json](schemas/app_data.schema.json) | JSON Schema для структуры `app_data.json` |
| [scripts/content_report.py](scripts/content_report.py) | Отчёты по покрытию контента |
| [scripts/check_encoding.py](scripts/check_encoding.py) | UTF-8/mojibake guard |
| [requirements.txt](requirements.txt) | Python-зависимости для локальных проверок |
| [tests/e2e/smoke.spec.new.js](tests/e2e/smoke.spec.new.js) | E2E smoke (Playwright) |
| [codex_instruction_v2.md](codex_instruction_v2.md) | Инструкция для Codex (актуальна для `main`) |
| [CODEX_WORKFLOW_RU.md](CODEX_WORKFLOW_RU.md) | Регламент оформления и публикации |
| [KIDS_GUIDE_RU.md](KIDS_GUIDE_RU.md) | Детская инструкция по использованию |
| [deep-research-report.md](deep-research-report.md) | Аудит-отчёт репозитория |
| [CODEX_VISUALIZATIONS_RU.md](CODEX_VISUALIZATIONS_RU.md) | Спецификация модулей визуализаций (VIZ-01…VIZ-07) |
| [CODEX_VIZ_INSTRUCTIONS_RU.md](CODEX_VIZ_INSTRUCTIONS_RU.md) | Инструкция по реализации визуализаций для Codex |
| [ISSUE_PUBLISH_CHECKLIST_RU.md](ISSUE_PUBLISH_CHECKLIST_RU.md) | Чеклист оформления и публикации issue |
| [LINKING_AUDIT_2026-04-19.md](LINKING_AUDIT_2026-04-19.md) | Аудит перелинковки от 2026-04-19 |
| [SPRINT_v4.1_2026-04-20.md](SPRINT_v4.1_2026-04-20.md) | План спринта v4.1 (2026-04-20) |
| [RELEASE_NOTES_2026-04-14.md](RELEASE_NOTES_2026-04-14.md) | Релиз-заметки 2026-04-14 |
| [RELEASE_NOTES_2026-04-15.md](RELEASE_NOTES_2026-04-15.md) | Релиз-заметки 2026-04-15 |
| [RELEASE_NOTES_2026-04-17.md](RELEASE_NOTES_2026-04-17.md) | Релиз-заметки 2026-04-17 |
| [RELEASE_NOTES_2026-04-18.md](RELEASE_NOTES_2026-04-18.md) | Релиз-заметки 2026-04-18 |
| [icon-192.svg](icon-192.svg) | PWA-иконка 192×192 |
| [vendor/](vendor/) | Локальные копии библиотек (d3 и др.) |

## CI

GitHub Actions workflow `CI` запускается на `push` и `pull_request` в `main` и выполняет:

- синтаксическую проверку JS;
- [scripts/check_encoding.py](scripts/check_encoding.py);
- [scripts/validate_content.py](scripts/validate_content.py);
- [runtime_test.py](runtime_test.py);
- сборку [aaz-index.html](aaz-index.html);
- проверку синхронизации [aaz-index.html](aaz-index.html) с исходниками (`git diff --exit-code -- aaz-index.html`);
- Playwright smoke.

Локально тот же JS/e2e-слой можно запустить командой `npm run check`; Python-проверки требуют установленного Python и зависимостей из [requirements.txt](requirements.txt).
