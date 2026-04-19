# BookIndex / «Зализнякиада»

Автономный интерактивный веб-справочник к книге А. А. Зализняка  
«Из жизни слов и языков» (Альпина нон-фикшн, 2026, 404 с.).

## Актуальный статус

- Текущая версия: `v4.2.1` (обновлено `2026-04-19`).
- Базовый артефакт: `aaz-index.html` (single-file SPA).
- Демо (GitHub Pages): https://gasyoun.github.io/BookIndex/aaz-index.html
- Формат данных: `app_data.json` (`schema_version = 2`).
- Детская инструкция: [KIDS_GUIDE_RU.md](KIDS_GUIDE_RU.md).
- Регламент оформления и публикации: [CODEX_WORKFLOW_RU.md](CODEX_WORKFLOW_RU.md).

## Что заложено в функционал

### Навигация и поиск

- [Домашняя панель](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) с KPI и быстрыми переходами.
- [Глобальный поиск](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) по всем сущностям.
- [Нечеткий поиск (Fuse.js)](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) для запросов с опечатками.
- [Глубокие ссылки (`#v4/...`)](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/phonetic_laws) для карточек, вкладок и состояний.
- [Совместимость с legacy-hash маршрутами](https://gasyoun.github.io/BookIndex/aaz-index.html#names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.).

### Каталоги и карточки

- Сущности: [`names`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list), [`toponyms`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/toponyms/list), [`ethnonyms`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/ethnonyms/list), [`languages`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/languages/list).
- [Полнотекстовые карточки](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.) с перекрестными ссылками.
- Индексные разделы: [`lexicon`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon/list), [`lexicon_reverse`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon_reverse/list), [`lexicon_tech`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/lexicon_tech/list), [`subject_index`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/subject/list).
- [Фильтрация и сортировки](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic) в ключевых разделах.

### Материалы и аналитика

- [KWIC-конкорданс](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic) (по `lexicon` и `glossary`) с:
  - [фильтром диапазона страниц](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic);
  - [сортировкой левого/правого контекста](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic);
  - [ограничением выдачи и явной меткой `truncated`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/kwic).
- [Режим «Читаю сейчас»](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lectures) в разделе «Лекции»: ввод страницы, шаг назад/вперед, быстрый переход к динамике страницы.
- [Лекции](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lectures), [глоссарий](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/glossary), [галерея](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/gallery), [«Русский во времени»](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/russian_evolution), [фонетические законы](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/phonetic_laws).
- [Профессиональный аппарат](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar):
  - [хронология](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/chronology);
  - [акцентные парадигмы](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-accents);
  - [сравнительные таблицы](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-correspondences).

### Визуализации

- [D3-граф персоналий](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/graph) (`vendor/d3.v7.min.js`): zoom/pan, фильтр веса ребра, tooltip, переход в карточку.
- [Дерево языков](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/languages/tree) и [граф семейств](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/languages/families).
- [Карта](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/toponyms/map) с offline-fallback, если внешние тайлы недоступны.

### Доступность и UX

- [Темная/светлая тема](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) с сохранением выбора.
- [Режимы плотности интерфейса](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home) (`compact`, `reader`, `research`).
- [Поддержка `prefers-reduced-motion`](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home):
  - [снижение анимаций](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home);
  - [отключение плавного scroll к якорям](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-accents) при соответствующей системной настройке.

### Экспорт и PWA

- Экспорт BibTeX:
  - [scholar bibliography](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/scholar/scholar/anchor/sch-biblio);
  - [further reading](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/further_reading);
  - [источники из карточек](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.).
- PWA-база:
  - [`manifest.webmanifest`](https://gasyoun.github.io/BookIndex/manifest.webmanifest);
  - [`sw.js`](https://gasyoun.github.io/BookIndex/sw.js) (shell cache + offline fallback);
  - [иконки приложения](https://gasyoun.github.io/BookIndex/icon-512.svg).

## Что нового в v4.2.1 (2026-04-19)

- Выполнен рефакторинг KWIC: вынесена общая нормализация диапазонов страниц, оптимизирован сбор контекстов, снижена вероятность деградации производительности на широких запросах.
- Исправлена разметка правой панели гистограммы (устранен лишний закрывающий контейнер).
- Усилен `scripts/issue_quality_guard.py`: добавлен детект mojibake (UTF-8/CP1251 и UTF-8/Latin-1), добавлены тесты и исключены ложные срабатывания на демонстрационные примеры в inline-коде.
- Добавлен единый регламент работы: `CODEX_WORKFLOW_RU.md` (формат issue, labels, DoD, публикация demo, обязательные проверки).
- Нормализована система labels в issues по шаблону #42: `priority + area + type + phase`.

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
- `playwright test`: `41 passed`.

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
- проверку, что закоммиченный `aaz-index.html` синхронизирован с исходниками (`git diff --exit-code -- aaz-index.html`);
- Playwright smoke.
