# BookIndex / «Зализнякиада»

Автономный интерактивный веб-справочник к книге А. А. Зализняка  
«Из жизни слов и языков» (Альпина нон-фикшн, 2026, 404 с.).

## Актуальный статус

- Текущая версия: `v4.2.0` (релиз от `2026-04-18`).
- Базовый артефакт: `aaz-index.html` (single-file SPA).
- Формат данных: `app_data.json` (`schema_version = 2`).
- Детская инструкция: [KIDS_GUIDE_RU.md](KIDS_GUIDE_RU.md).

## Что заложено в функционал

### Навигация и поиск

- Домашняя панель с KPI и быстрыми переходами.
- Глобальный поиск по всем сущностям.
- Нечеткий поиск (Fuse.js) для запросов с опечатками.
- Глубокие ссылки (`#v4/...`) для карточек, вкладок и состояний.
- Совместимость с legacy-hash маршрутами.

### Каталоги и карточки

- Сущности: `names`, `toponyms`, `ethnonyms`, `languages`.
- Полнотекстовые карточки с перекрестными ссылками.
- Индексные разделы: `lexicon`, `lexicon_reverse`, `lexicon_tech`, `subject_index`.
- Фильтрация и сортировки в ключевых разделах.

### Материалы и аналитика

- KWIC-конкорданс (по `lexicon` и `glossary`) с:
  - фильтром диапазона страниц;
  - сортировкой левого/правого контекста;
  - ограничением выдачи и явной меткой `truncated`.
- Лекции, глоссарий, галерея, «Русский во времени», фонетические законы.
- Профессиональный аппарат:
  - хронология;
  - акцентные парадигмы;
  - сравнительные таблицы.

### Визуализации

- D3-граф персоналий (`vendor/d3.v7.min.js`): zoom/pan, фильтр веса ребра, tooltip, переход в карточку.
- Дерево языков и граф семейств.
- Карта с offline-fallback, если внешние тайлы недоступны.

### Доступность и UX

- Темная/светлая тема с сохранением выбора.
- Режимы плотности интерфейса (`compact`, `reader`, `research`).
- Поддержка `prefers-reduced-motion`:
  - снижение анимаций;
  - отключение плавного scroll к якорям при соответствующей системной настройке.

### Экспорт и PWA

- Экспорт BibTeX:
  - scholar bibliography;
  - further reading;
  - источники из карточек.
- PWA-база:
  - `manifest.webmanifest`;
  - `sw.js` (shell cache + offline fallback);
  - иконки приложения.

## Что нового в v4.2.0 (2026-04-18)

- `runtime_test.py` научился корректно искать `node` (`NODE_BINARY`, PATH, стандартные пути Windows) и выдавать понятную диагностику вместо traceback.
- Добавлен `scripts/content_report.py` (Markdown/JSON-отчеты по покрытию контента: pages/contexts/sources/duplicates).
- Добавлена поддержка reduced motion в CSS и якорной навигации.

## Быстрый старт

1. Откройте `aaz-index.html` в браузере.
2. Для локальной разработки используйте `v3_template.html` + `v3_app.js` + `app_data.json`.
3. Для быстрой пересборки итогового файла:

```bash
python scripts/build_aaz_index.py
```

## Локальные проверки перед релизом

Минимальный набор:

```bash
python scripts/check_encoding.py
python scripts/validate_content.py app_data.json
python scripts/content_report.py
python runtime_test.py
```

Полный smoke/e2e:

```bash
npx playwright test
```

Если `node` не в `PATH`, для `runtime_test.py` можно явно указать бинарник:

```powershell
$env:NODE_BINARY = 'C:\path\to\node.exe'
python runtime_test.py
```

Ожидается:

- `validate_content.py`: `0 errors` (допустимы известные warning по дублям данных).
- `runtime_test.py`: `21/21`.
- `playwright test`: `34 passed`.

## Контент-аудит (метрики)

Быстрый свод по покрытию данных:

```bash
python scripts/content_report.py
python scripts/content_report.py --format json
```

Отчет включает:

- количество элементов по сущностям;
- долю элементов с `page_list`, `contexts`, `sources`;
- количество дубликатов `head`;
- агрегированные totals.

## Структура проекта

- `aaz-index.html` — готовый standalone-артефакт.
- `v3_template.html` — HTML-шаблон (`__APP_SCRIPT__`).
- `v3_app.js` — основной runtime/UX.
- `app_data.json` — база контента.
- `runtime_test.py` — runtime smoke и статические guard'ы.
- `scripts/build_aaz_index.py` — сборка `aaz-index.html`.
- `scripts/validate_content.py` — структурная валидация данных.
- `scripts/content_report.py` — отчеты по покрытию контента.
- `scripts/check_encoding.py` — UTF-8/mojibake guard.
- `tests/e2e/smoke.spec.new.js` — e2e smoke.

## CI

GitHub Actions workflow `CI` запускается на `push` и `pull_request` в `main` и выполняет:

- синтаксическую проверку JS;
- `check_encoding.py`;
- `validate_content.py`;
- `runtime_test.py`;
- сборку `aaz-index.html`;
- Playwright smoke.
