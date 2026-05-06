# BookIndex v4.1 Sprint Board (2026-04-20 .. 2026-04-26)

## Цель спринта

Довести до формального DoD уже реализованные P0/P1 задачи `v4` и выпустить `KWIC MVP` для `#43` без регрессий по текущему функционалу.

## Факт на старте (аудит 2026-04-17)

### Issue status sync

| Issue | Статус в GitHub | Фактический статус | Подтверждение |
|---|---|---|---|
| [#41](https://github.com/gasyoun/BookIndex/issues/41) Нечёткий поиск (Fuse.js) | CLOSED | Реализовано | `v3_app.js`: `ensureGlobalSearchFuse`, `buildGlobalSearchFuseRecords`; `v3_template.html`: локальный `vendor/fuse.basic.min.js`; e2e: `global search fuzzy-matches typo query` (pass) |
| [#42](https://github.com/gasyoun/BookIndex/issues/42) Постоянные якорные ссылки | CLOSED | Реализовано | `v3_app.js`: `HASH_ROUTE_PREFIX = 'v4'`, `buildCanonicalHash`, `buildItemHash`, `buildScholarAnchorHash`; e2e: `canonical deep-link reload keeps card state...` (pass) |
| [#43](https://github.com/gasyoun/BookIndex/issues/43) KWIC-конкордансный просмотрщик | CLOSED | Реализовано (MVP) | `v3_app.js`: таб `kwic`, контексты `lexicon/glossary`, сортировка, фильтр страниц, переходы; e2e: `materials KWIC panel filters contexts...` (pass) |
| [#44](https://github.com/gasyoun/BookIndex/issues/44) Тёмная тема | OPEN | Локально выполнено, готово к закрытию в GitHub | `v3_template.html`: карточки/граф/карта переведены на theme vars + повышен контраст `chart-intro`; `v3_app.js`: `THEME_STORAGE_KEY`, `applyTheme`, `toggleTheme`; e2e: persistence + contrast smoke (pass) |

### QA baseline (2026-04-17)

- `python runtime_test.py` -> `20/20` (pass).
- `playwright --grep "dark theme keeps readable contrast|theme toggle persists after reload"` -> `2 passed`.
- `playwright test` -> `32 passed`.

## План по дням

### Day 1 (2026-04-20) - Issue hygiene + status alignment

- [x] Обновить `#41`: отметить выполненные чекбоксы, приложить ссылки на коммиты/тест.
- [x] Обновить `#42`: отметить выполненные чекбоксы, приложить ссылки на коммиты/тест.
- [x] По `#44` оставить открытым и оформить gap-list как подзадачи (contrast + smoke persistence).

### Day 2 (2026-04-21) - Dark theme DoD

- [x] Добавить smoke-кейс: переключение темы + проверка сохранения после reload.
- [x] Провести контрастный аудит ключевых панелей: list/card/table/graph/map-fallback.
- [x] Провести sync в GitHub: открыт PR [#48](https://github.com/gasyoun/BookIndex/pull/48) с `Closes #44`.

### Day 3 (2026-04-22) - KWIC data layer (`#43`)

- [x] Построить индекс контекстов для `lexicon` и `glossary`.
- [x] Добавить фильтр по диапазону страниц.
- [x] Добавить статические/рантайм guards для структуры данных KWIC.

### Day 4 (2026-04-23) - KWIC UI MVP (`#43`)

- [x] Отдельная панель/таб KWIC.
- [x] Подсветка ключа в контексте.
- [x] Сортировка по левому/правому контексту.

### Day 5 (2026-04-24) - Navigation + tests

- [x] Переходы из KWIC в карточку/страницу.
- [x] E2E smoke-кейс на базовую интерактивность KWIC.
- [x] Проверка совместимости с hash/deep-link.

### Day 6 (2026-04-25) - Perf pass + docs

- [x] Профиль рендера KWIC на типичном объёме данных.
- [x] Ограничение/виртуализация списка при больших выдачах (при необходимости).
- [x] Черновик release notes `v4.1.0`.

### Day 7 (2026-04-26) - Release gate

- [x] Полный прогон: `check_encoding`, `validate_content`, `runtime_test`, `playwright`.
- [ ] Финализация changelog и выпуск `v4.1.0`.
- [x] Подготовка `v4.2` scope (`#45`, `#46`, `#47`) + sync в GitHub: открыт PR [#48](https://github.com/gasyoun/BookIndex/pull/48) с `Closes #45/#46/#47`.

## Вне Плана v4.1 (Ранний Старт v4.2)

- [x] `#45` D3 graph: `names/graph` переведён на D3 (`vendor/d3.v7.min.js`) с zoom/pan, фильтром минимального веса ребра, tooltip/legend и переходом в карточку; добавлен smoke `names graph supports weight filter, tooltip and navigation to card` (pass).
- [x] `#46` PWA foundations: добавлены `manifest.webmanifest`, `sw.js`, иконки, регистрация service worker и smoke `PWA manifest and service worker are available` (pass).
- [x] `#47` BibTeX export: реализован экспорт `.bib` для scholar bibliography, further reading и отдельных источников карточки; добавлен e2e smoke `BibTeX export works...` (pass).
- [x] Синхронизировать статус `#45/#46/#47/#44` в GitHub: открыт PR [#48](https://github.com/gasyoun/BookIndex/pull/48), в issues добавлены комментарии со ссылкой на PR.

## Definition of Done (v4.1)

- Все задачи `#41` и `#42` закрыты в GitHub и подтверждены тестами.
- `#44` закрыт после smoke и контрастного pass.
- `#43` доведён до MVP и покрыт минимум одним e2e smoke.
- CI green на `main`.
