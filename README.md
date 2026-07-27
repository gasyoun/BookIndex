# BookIndex (Zalizniakiada)

_Created: 14-04-2026 · Last updated: 27-07-2026_

**BookIndex** — автономный интерактивный веб-справочник, корпусная лаборатория и интеллектуальная база знаний по научному наследию **А. А. Зализняка**.

Проект эволюционировал из простого индекса в полноценную исследовательскую платформу для цифровых гуманитарных наук: единый автономный HTML-артефакт, корпусная навигация, KWIC-конкорданс, карты, графы и научный аппарат.

- **Демо**: [gasyoun.github.io/BookIndex/index.html](https://gasyoun.github.io/BookIndex/index.html)
- **Текущая версия**: 4.3.0 (см. [CITATION.cff](https://github.com/gasyoun/BookIndex/blob/main/CITATION.cff) и [package.json](https://github.com/gasyoun/BookIndex/blob/main/package.json)) — первый тегированный релиз GitHub с `v4.2.0`, закрывающий треки A/B/C (авторитетные ID, каноничные URI, KWIC по лекциям, TEI-экспорт, дашборд конвейера) и цитируемую инфраструктуру (CITATION.cff/.zenodo.json). Подробности — [CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md).
- **Руководство для детей**: [KIDS_GUIDE_RU.md](https://github.com/gasyoun/BookIndex/blob/main/KIDS_GUIDE_RU.md)
- **Лицензии**: код — [Apache License 2.0](https://github.com/gasyoun/BookIndex/blob/main/LICENSE); данные указателя — CC BY 4.0; цитаты из книг — с разрешения правообладателей ([LICENSE-DATA.md](https://github.com/gasyoun/BookIndex/blob/main/LICENSE-DATA.md))
- **Как цитировать**: см. [CITATION.cff](https://github.com/gasyoun/BookIndex/blob/main/CITATION.cff) (кнопка «Cite this repository» на GitHub) и раздел [«Как цитировать»](#как-цитировать) ниже

---

## Ключевые возможности

### Архитектура и автономность
*   **Single-file artifact**: `aaz-index.html` содержит данные и runtime, поэтому сайт работает без backend.
*   **PWA support**: manifest, service worker, offline shell cache and local vendor assets.
*   **Vite smoke build**: Vite проверяет standalone-сборку и копирует deploy assets, но production contract остается `v3_template.html` + `v3_app.js`.
*   **Persistent state**: настройки интерфейса, фильтры и выбранные режимы сохраняются локально.

### Поиск и анализ
*   **Intellectual Search**: Поиск с учетом морфологии и семантических связей.
*   **Network Analysis**: Визуализация сетевых связей между именами, языками и семьями (D3.js + Web Workers).
*   **Geospatial Tools**: Интерактивная карта топонимов и этнонимов (Leaflet).

### Инструментарий Digital Humanities
*   **Topic Clustering**: Группирование сущностей для «Дальнего чтения».
*   **Semantic Web**: Поддержка JSON-LD для интеграции в научный контекст.
*   **KWIC (Key Word in Context)**: Конкорданс по книге (лексика, глоссарий) **и по корпусу расшифровок 27 видеолекций** — каждое совпадение ведет на минуту в видео. Индекс лекций строится `npm run kwic:build` (ленивая подгрузка `data/lectures_kwic.json`).

### 🧪 Интерактивный научный аппарат (Linguistic Simulation)
*   **Sound Law Simulator**: Интерактивный симулятор исторических звуковых законов (первая палатализация, метатеза плавных, падение редуцированных), показывающий пошаговую эволюцию праславянских корней (например, `*gordъ` или `*melko`) в современные русский, польский и чешский языки.
*   **Accent Reconstructor**: Динамический симулятор древнерусских акцентологических парадигм (A — баритонеза, B — окситонеза, C — подвижная). Позволяет проследить перемещение ударения по падежам, числам (включая двойственное) и историческим стадиям развития.
*   **Orthography Hydrator**: Реально-временной гидратор древнерусской графики. Принимает современные поисковые слова и восстанавливает их средневековую орфографию с использованием ятя (`ѣ`), еров (`ъ`/`ь`), юсов (`ѫ`/`Ѧ`) и омеги (`ѡ`), объясняя примененные лингвистические законы.
*   **Linked Open Data (LOD) Integration**: Полная совместимость с мировыми лингвистическими базами данных. Языки привязаны к международным кодам **Glottolog** и **WALS**, а лексемы — к этимологической базе **Starling** (словарь Фасмера) и **Национальному корпусу русского языка (НКРЯ)**.

---

## Сценарии использования (Use Cases)

### 👨‍🎓 Для студента-лингвиста
*   **Изучение родства языков**: Используйте «Дерево языков» и «Сетевой граф семей», чтобы проследить связи между санскритом, латынью и славянскими языками.
*   **Подготовка к семинару по исторической фонетике**: Введите праславянскую реконструкцию в **Симулятор звуковых законов** и разберите по шагам переход в русский («полногласие»), польский («raised vowels») и чешский (спирантизация `g` -> `h`).
*   **Освоение древнерусского склонения**: Выберите лексему в **Акцентологическом реконструкторе** и проследите, как вела себя Paradigm C (например, `*gord-`), смещая ударение на предлоги (`на́ городъ`) и сохраняя формы двойственного числа.
*   **Поиск по KWIC-конкордансу**: Быстрый поиск всех упоминаний термина (например, «аблаут») через KWIC-конкорданс для сбора примеров из лекций.

### 👩‍🔬 Для профессионального исследователя
*   **Сравнительное этимологическое исследование**: Нажмите на ссылки **Linked Open Data** в карточке лексемы, чтобы мгновенно открыть научную статью Фасмера в **Starling** или запустить контекстный поиск примеров употребления в **НКРЯ**.
*   **Поиск по древним рукописям**: Используйте **Орфографический гидратор**, чтобы преобразовать современное слово в историческое написание (например, `хлеб` -> `хлѣбъ`, `рука` -> `рѫка`), что облегчает составление запросов к базам данных берестяных грамот и древнерусских корпусов.
*   **Анализ частотности**: Используйте гистограммы и тепловые карты («Heatmap»), чтобы увидеть, в каких главах Зализняк чаще всего обсуждает конкретные лингвистические проблемы.
*   **Ведение полевых заметок**: Сохраняйте наблюдения в «Дневник исследователя» прямо в интерфейсе; заметки сохранятся даже после перезагрузки страницы.

### 📽️ Для широкого круга читателей
*   **Навигатор по лекциям**: Если вы смотрите лекцию на YouTube, найдите ее в разделе «Материалы», чтобы увидеть список упомянутых имен и терминов с привязкой к страницам книги.
*   **Интерактивное погружение в лингвистику**: Сыграйте с пресетами гидратора орфографии, чтобы узнать, почему в русском языке пишут «мясо», а в древнерусском писали через малый юс («мѧсо»).

---

## Архитектура и Разработка

Приложение построено на базе современных веб-стандартов без тяжелых фреймворков, что обеспечивает мгновенную загрузку и работу в offline-режиме.

### Структура проекта
| Файл / Папка | Роль |
| :--- | :--- |
| [`index.html`](https://github.com/gasyoun/BookIndex/blob/main/index.html) | Публичная landing-страница и SEO-вход. |
| [`v3_template.html`](https://github.com/gasyoun/BookIndex/blob/main/v3_template.html) | HTML-шаблон standalone-приложения. |
| [`v3_app.js`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js) | Основной runtime приложения. |
| [`app_data.json`](https://github.com/gasyoun/BookIndex/blob/main/app_data.json) | База знаний в формате JSON (6 MB+). |
| [`data/modules/`](https://github.com/gasyoun/BookIndex/tree/main/data/modules) | Lazy-loaded JSON chunks used by the standalone app and pre-cached for offline mode. |
| [`src/`](https://github.com/gasyoun/BookIndex/tree/main/src) | Модульные исходники для контролируемой пересборки `v3_app.js`. |
| [`public/`](https://github.com/gasyoun/BookIndex/tree/main/public) | Ассеты, копируемые Vite в `dist-vite/`. |
| [`vendor/`](https://github.com/gasyoun/BookIndex/tree/main/vendor) | Локально закрепленные runtime-библиотеки. |
| [`scripts/`](https://github.com/gasyoun/BookIndex/tree/main/scripts) | Сборка, проверки, импорт данных и CI-guards. |
| [`data/video_pipeline.json`](https://github.com/gasyoun/BookIndex/blob/main/data/video_pipeline.json) | Статус расшифровки и вычитки видео (источник правды; мигрирован из `video-archive.xlsx`). |
| [`pipeline/index.html`](https://github.com/gasyoun/BookIndex/blob/main/pipeline/index.html) | Генерируемый дашборд конвейера видео для волонтеров (`npm run pipeline:dashboard`). |

### Команды разработки
*   **Сборка приложения**: `npm run build` (генерирует `aaz-index.html` в корне)
*   **Заморозка слагов**: `npm run slug:freeze` (обновляет `data/slug_registry.json` при добавлении/переименовании сущностей; слаги канонических URI стабильны и не меняются между релизами). Проверка: `npm run slug:check`.
*   **Авторитетные ID**: `python scripts/align_authorities.py --report` (поиск Wikidata/VIAF/GND/GeoNames), `--write` (запись высокоуверенных + review-файл `data/authority_candidates.json` на ручную проверку).
*   **Vite smoke/deploy copy**: `npm run build:vite`
*   **Проверка типов**: `npm run typecheck`
*   **Полная E2E-проверка**: `npm run check`
*   **Security guard**: `npm run check:security && npm run check:security:static`
*   **CSP hardening**: inline scripts and style blocks use SHA-256 CSP hashes generated at build time; inline style attributes are denied, and the static/post-deploy checks fail if CSP regresses to `unsafe-inline`.
*   **Performance budget**: `npm run check:perf`
*   **Контент-аудит**: `npm run content:audit` (пишет `tests/index-audit-queue.json` и очередь ручной вычитки контекстов)
*   **Статистика проекта**: `npm run stats` (регенерирует [`stats.md`](https://github.com/gasyoun/BookIndex/blob/main/stats.md) из `app_data.json`)
*   **Post-deploy gates**: `npm run check:postdeploy` проверяет live GitHub Pages, Lighthouse и axe accessibility (`0` critical / `0` serious).

## Конвейер видео (производство II тома)

Статус расшифровки и многостадийной вычитки лекций (≈213 ч) ведется в репозитории:

*   **Источник правды**: [`data/video_pipeline.json`](https://github.com/gasyoun/BookIndex/blob/main/data/video_pipeline.json) — по видео: стадия вычитки, качество автотранскрибации, исполнители, даты, ссылки. Заменил `video-archive.xlsx` (выведена из обращения). На текущий момент расшифровано и вычитано 27 из ~191 видео; остальные еще в работе.
*   **Дашборд**: [`pipeline/index.html`](https://github.com/gasyoun/BookIndex/blob/main/pipeline/index.html) — самодостаточная страница (данные встроены, работает офлайн); фильтры по стадии/теме, подсветка висящих заданий и проблем транскрибации. Регенерация: `npm run pipeline:dashboard`.
*   **Стадии**: `в очереди → автотранскрибация → сверка → 1/2/3-я читка → предверстка → верстка → готово`.

## Audit Summary

Сводка контроля качества указателя (источник: [`tests/index-audit-queue.json`](https://github.com/gasyoun/BookIndex/blob/main/tests/index-audit-queue.json), проверяется `scripts/validate_content.py`):

- 0 suspicious heads
- 0 без triage
- 0 sort inversions
- 0 duplicate-head groups
- найдено 11 из 11 терминов

---

## Как цитировать

BookIndex — цитируемый ресурс цифровых гуманитарных наук. Машиночитаемые
метаданные — в [CITATION.cff](https://github.com/gasyoun/BookIndex/blob/main/CITATION.cff) (GitHub показывает кнопку «Cite
this repository»).

Предварительная форма цитирования (DOI добавится после депонирования на
Zenodo):

> Gasūns, M. (2026). *BookIndex (Zalizniakiada): an interactive reference and
> corpus laboratory for the scholarly legacy of A. A. Zaliznyak* (version 4.3.0)
> [Software]. https://github.com/gasyoun/BookIndex

Для цитирования **конкретной справочной статьи или лекции** используйте виджет
цитирования в самом приложении (стили APA / MLA / Chicago / ГОСТ) — он
оформляет ссылку на А. А. Зализняка как автора содержания.

> После релиза на Zenodo README и метаданные получат бейдж и DOI вида
> `10.5281/zenodo.XXXXXXX`. Порядок депонирования и присвоения DOI —
> [docs/ZENODO_RU.md](https://github.com/gasyoun/BookIndex/blob/main/docs/ZENODO_RU.md).

## Лицензии

| Слой | Лицензия |
|---|---|
| Код (рантайм, скрипты, шаблоны, тесты) | [Apache-2.0](https://github.com/gasyoun/BookIndex/blob/main/LICENSE) |
| Данные указателя (структура, id, связи, LOD, таймкоды) | CC BY 4.0 |
| Цитаты и расшифровки из книг/лекций | © правообладатели, с разрешения |

Подробнее — [LICENSE-DATA.md](https://github.com/gasyoun/BookIndex/blob/main/LICENSE-DATA.md).

## История версий (Major Milestones)
*   **v4.3.0**: Citability/Zenodo release cut (H1601) — first tagged GitHub release since `v4.2.0`; ships Tracks A/B/C (authority IDs, canonical URIs, TEI export, lecture KWIC/timecodes, video gallery/detail card, home task dashboard, chapter ribbon), VIZ shell unification, security hardening and CITATION.cff/.zenodo.json packaging.
*   **v2.2.0**: SEO, PWA, security, CI, full E2E and performance hardening.
*   **v2.1.0**: Navigation architecture, corpus routing and visualization smoke coverage.
*   **v1.x - v2.x**: Expansion from book index to corpus laboratory and Digital Humanities workspace.

---
👉 **Полная история изменений**: [CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md)

_Dr. Mārcis Gasūns_
