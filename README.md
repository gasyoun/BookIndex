# BookIndex / «Зализнякиада»

Автономный интерактивный веб-справочник к книге А. А. Зализняка  
«Из жизни слов и языков» (Альпина нон-фикшн, 2026, 404 с.).

## Быстрый старт

1. Откройте `aaz-index.html` в браузере.
2. Базовый интерфейс и данные работают офлайн.
3. Интернет нужен для тайлов карты (Leaflet) и внешних изображений.

## Файлы проекта

- `aaz-index.html` — готовый автономный артефакт.
- `v3_template.html` — HTML-шаблон с `__APP_SCRIPT__`.
- `v3_app.js` — JS-логика приложения.
- `app_data.json` — данные справочника.
- `runtime_test.py` — smoke-проверка выполнения (`20/20`).
- `scripts/validate_content.py` — структурная валидация данных.
- `scripts/build_aaz_index.py` — сборка итогового `aaz-index.html`.
- `scripts/migrate_app_data.py` — миграция `app_data.json` к актуальной схеме.
- `playwright.config.js` + `tests/e2e/` — smoke E2E-проверки интерфейса.
- `.github/workflows/ci.yml` — CI-пайплайн GitHub Actions.

## Локальная проверка перед выкладкой

```bash
node --check v3_app.js
python scripts/validate_content.py app_data.json
python runtime_test.py
python scripts/build_aaz_index.py
npx playwright test
```

Ожидается:
- валидация данных без ошибок;
- `runtime_test.py` -> `20/20`.

## CI (GitHub Actions)

Workflow `CI` запускается на `push` и `pull_request` в `main` и выполняет:
- синтаксическую проверку `v3_app.js`;
- `scripts/validate_content.py`;
- `runtime_test.py`;
- smoke-сборку `aaz-index.html`.
- Playwright E2E smoke (`tests/e2e/smoke.spec.js`).

## Схема данных и миграции

- Текущая версия схемы: `schema_version = 2` (см. начало `app_data.json`).
- Миграция файла к текущей схеме:

```bash
python scripts/migrate_app_data.py app_data.json
```

- Миграция в новый файл (без перезаписи исходника):

```bash
python scripts/migrate_app_data.py app_data.json app_data.migrated.json
```

## Пересборка `aaz-index.html`

Быстрый способ:

```bash
python scripts/build_aaz_index.py
```

Эквивалент вручную:

```python
import pathlib

data = pathlib.Path("app_data.json").read_text(encoding="utf-8")
js = pathlib.Path("v3_app.js").read_text(encoding="utf-8")
tpl = pathlib.Path("v3_template.html").read_text(encoding="utf-8")

escaped = data.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
html = tpl.replace("__APP_SCRIPT__", js.replace("__APP_DATA_STRING__", "`" + escaped + "`"))

pathlib.Path("aaz-index.html").write_text(html, encoding="utf-8-sig")
```

## Технологии

- Vanilla JS / HTML / CSS
- Leaflet
- Python (runtime/data checks)
