# BookIndex / «Зализнякиада»

Автономный интерактивный веб-справочник к книге А. А. Зализняка «Из жизни слов и языков» (Альпина нон-фикшн, 2026, 404 с.).

## Быстрый старт

1. Откройте `aaz-index.html` в браузере.
2. Интерфейс и данные работают офлайн.
3. Интернет нужен только для тайлов карты (Leaflet) и внешних изображений.

## Состав файлов

- `aaz-index.html` — готовый автономный артефакт для просмотра.
- `v3_template.html` — HTML-шаблон с `__APP_SCRIPT__`.
- `v3_app.js` — логика приложения.
- `app_data.json` — данные справочника.
- `runtime_test.py` — контрольный прогон (синтаксис + runtime smoke).
- `RELEASE_NOTES_2026-04-14.md` — текущий релизный срез.

## Стандарт перед выкладкой

Обязательно:

```bash
python runtime_test.py
```

Ожидаемый результат: `20/20`.

## Пересборка `aaz-index.html`

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

- Vanilla JS, HTML, CSS
- Leaflet (карта)
- Python runtime smoke-тест

## Примечание

Основная ветка ведётся через issues в GitHub. На дату релиза 2026-04-14 backlog задач #1–#15 закрыт.
