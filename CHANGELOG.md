# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- **Video modal player shell + empty-capable timecode list (H2125, Sonnet 5 (`claude-sonnet-5`)):** «Смотреть» on the video detail page opens an in-app `#video-player-modal` (YouTube iframe embed) instead of only linking out to YouTube; the external "Смотреть на YouTube" link remains as a fallback everywhere. Modal never autoplays, traps focus, restores focus on close, closes on Escape/backdrop/close button, and sets `aria-hidden` on the app chrome while open. Timecode list renders each `video.timecodes[]` entry as a seekable link and shows an honest "Разметка глав пока не загружена" empty state when a video has none — no invented chapter markers (D4). U4 harness routes (`materials-video`, `materials-video-detail`) already covered. `check:security:static` and `check:perf` (standalone HTML gzip budget) both pass.

## [4.11.3] - 2026-08-06
### Added
- **Video gallery dense list default + thumbs toggle (H2124, Sonnet 5 (`claude-sonnet-5`)):** `#vg-list` defaults to `.vg-list-dense` (compact full-width rows); a new `«Превью»` checkbox switches to `.vg-list-thumbs` (grid of cards with a lazy, decorative `mqdefault.jpg` thumbnail per card, `alt=""`). Preference persisted in `localStorage` (`bookindex.vg.thumbs`). No thumb requests fire in the default dense mode. 2 new `tests/e2e/session-features.spec.js` cases (dense-default/toggle/persist, 390px no-overflow). Details: `RESULTS_LOG.md` § H2124.

## [4.11.2] - 2026-08-06
### Added
- **Video gallery a11y + honest copy (H2123, Sonnet 5 (`claude-sonnet-5`)):** `#vg-search`/`#vg-chapter`/`#vg-sort` carry `aria-label`; `:focus-visible` ring on `.vg-input`/`.vg-card-title`/`.vg-chip`/`.video-detail-back`/`.video-detail-yt`; `#vg-meta` is now `role="status" aria-live="polite"`; empty-filter state with a reset-and-refocus button; default sort switched `date-desc` → `title` (only 33/175 rows carry a `date`); undated cards show «дата неизвестна»; intro copy no longer claims in-card timecodes. 2 new `tests/e2e/session-features.spec.js` cases. Details: `RESULTS_LOG.md` § H2123.

## [4.11.0] - 2026-08-02
### Added
- **+339 стратифицированных прямых контекстов (H1825, Fable 5 (`claude-fable-5`)):** дренаж очереди missing_context батчем lexicon 190 / lexicon_reverse 90 / lexicon_tech 26 (снята полностью) / names 26 / toponyms 7 (снята полностью). Прямое покрытие 26.8%→36.8% (порог 35% по прямым контекстам взят), эффективное 36.3%→50.0%, очередь 2149→1687. Глоссы редакторские, привязаны к карте лекций, страничным кластерам и KWIC-совпадениям расшифровок; нечитаемые OCR-заголовки помечены «требует сверки» — без выдуманных значений и страниц. Скрипт-инъектор архивирован: `docs/history/scripts/inject_contexts_h1825.py`; итоги: `RESULTS_LOG.md` § H1825.

## [4.10.2] - 2026-08-01
### Fixed
- **V0 video_catalog id collisions (H2122, Grok 4.5 (`grok-4.5`)):** three YouTube ids (`Tz3T7IxsbLU`, `xIoXVxahvDY`, `cJp5ZrnGivw`) held 6–8 distinct seminar titles each (191 raw → 175 unique). Catalog collapsed to one survivor per id (richest `related_entities`, first-on-ties — same as `getDedupedVideoCatalog`); 16 dropped titles tracked in a data-error GitHub issue. No invented URLs.

### Added
- **CI guard for video ids (H2122):** `validate_video_catalog` in `scripts/validate_content.py` fails on duplicate `video_catalog[].id` or id≠YouTube-url extract; unit tests in `tests/unit/test_validate_video_catalog.py`. One-shot census: `scripts/dedupe_video_catalog_v0.py` + `docs/history/H2122_video_catalog_collision_census.json`.

## [4.10.1] - 2026-07-31

### Fixed
- **Восстановлены утерянные открывающие кавычки в цитатах книги (Opus 5 1M (`claude-opus-5[1m]`), 31-07-2026, H2031, issue [#187](https://github.com/gasyoun/BookIndex/issues/187)):**
  шесть символов U+FFFD в `occurrences.mumintroll.contexts` (языки 72 и 98) заменены на `‘`
  — во всех шести случаях глосс имел вид `— <U+FFFD>текст’`, то есть потеряна ровно
  открывающая кавычка при сохранившейся парной закрывающей. Кавычка восстановлена по
  конвенции самого корпуса (`‘…’`). Поправлены и экспортные копии
  `src/content/nemetskiy.md`, `src/content/russkiy.md`.
  **Первоначальная гипотеза о конвейере расшифровок опровергнута:** порча присутствует в
  `app_data.json` с первого коммита корпуса (`964283105`, 14-04-2026), а `Rauhbank`/`Bratpfanne`
  не встречаются ни в `data/imports/`, ни в `pipeline/` — пути, который мог бы пересоздать
  порчу, нет, поэтому правка данных окончательная.

### Changed
- **Проверка кодировки переведена в CI на `--strict` (H2031):** U+FFFD снова жёсткая ошибка.
  Единственное легальное вхождение (проверка очереди качества в
  [`v3_app.js`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js)) помечено новым
  построчным маркером `// encoding-guard: allow-ufffd`; маркер действует на строку, а не на
  файл, поэтому непомеченное вхождение в том же файле по-прежнему отчитывается.

## [4.10.0] - 2026-07-31

### Added
- **Переработан детектор моджибейка (Opus 5 1M (`claude-opus-5[1m]`), 31-07-2026, H1482):**
  [`scripts/check_encoding.py`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_encoding.py)
  больше не ищет две захардкоженные сигнатуры (одна цепочка порчи). Теперь текст
  перекодируется обратно каждым кандидатом-кодеком, и в потоке ищутся серии корректных
  многобайтовых UTF-8-последовательностей: покрыты UTF-8 как CP1252/Latin-1, CP1251,
  KOI8-R, CP866, Mac Cyrillic и двойное UTF-8-кодирование, в отчёт попадает
  восстановленный исходный текст. Ловится порча, спрятанная в одной строке чистого
  файла, — старые сигнатуры её пропускали. U+FFFD понижен до предупреждения (легальный
  код цитирует символ намеренно), `--strict` возвращает жёсткое падение, `--warn-only`
  даёт неблокирующий прогон. Markdown сканируется с вырезанными код-спанами, поэтому
  документация может приводить битый текст как пример — закрыт пункт 4 фазы D2 дорожной
  карты. Калибровка: ноль ложных срабатываний на 5592 закоммиченных файлах. `ftfy`
  рассмотрена и отклонена по замеру (пропускает KOI8-R, CP866, Mac Cyrillic).
  Метод и пороги — [`docs/ENCODING_GUARD.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/ENCODING_GUARD.md),
  таблицы — [`RESULTS_LOG.md`](https://github.com/gasyoun/BookIndex/blob/main/RESULTS_LOG.md).
- [`tests/unit/test_check_encoding.py`](https://github.com/gasyoun/BookIndex/blob/main/tests/unit/test_check_encoding.py) —
  25 фикстур на каждый класс порчи плюс негативные примеры из реального текста проекта.
  Добавлены `tests/__init__.py` и `tests/unit/__init__.py`: без них питоновские
  юнит-тесты не запускались вовсе. Два новых шага CI — проверка кодировки документации и
  `python -m unittest discover`.

## [4.9.0] - 2026-07-31

### Changed
- **Phase V2 — точечные UX-доработки семи модулей VIZ (Fable 5 (`claude-fable-5`), 31-07-2026, H1822):** все семь строк таблицы «Phase V2» из [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) закрыты одним заходом, только правки модулей в [`scripts/viz/`](https://github.com/gasyoun/BookIndex/tree/main/scripts/viz) и CSS шаблона:
  - **VIZ-01 (карта по векам):** автопоказ уважает `prefers-reduced-motion` — из ссылки с `autoplay=1` тур больше не самозапускается (в тулбаре появляется пояснение), запустить его можно только явной кнопкой Play; смена системной настройки на «уменьшить анимацию» останавливает идущий тур.
  - **VIZ-02 (граф сосуществования):** порог min weight прижимается к максимальному весу ребра текущей лекции — фильтром больше нельзя получить пустой граф; в сводке при этом появляется «порог снижен до N, выше граф пуст», и прижатое значение пишется в URL.
  - **VIZ-03 (лента открытий):** внутри адаптивной сетки появились полосы эпох — заголовки полувековых интервалов на всю ширину; полосы без видимых карточек скрываются вместе с фильтрами, прокрутка к карточке не использует smooth при reduced motion.
  - **VIZ-04 (тепловая матрица):** подписи лекций и левая дендрограмма вынесены в отдельный липкий (`position: sticky`) svg — при горизонтальной прокрутке матрицы они остаются на месте; сама матрица рисуется с реальной шириной ячейки (16 px) и прокручивается вместо сжатия в фиксированную рамку; тултип крупнее и называет лекцию по имени; экспорт SVG склеивает подписи и матрицу в один файл.
  - **VIZ-05 (Sankey «Слово»):** честное состояние частичных данных — узел без привязанного аргумента раньше молча заимствовал текст первого аргумента, теперь он рисуется пунктиром и полупрозрачным, панель детали объясняет отсутствие источника, в сводке появляется «данные частичны: без источника N из M узлов»; анимация потоков отключается при reduced motion.
  - **VIZ-06 (хорда языков):** новые фильтры топ-N (8/12/16/24/все) и семьи языков (по полю `family` указателя языков), оба сохраняются в URL; цвета стали стабильными — они привязаны к позиции языка в общем списке и совпадают с точками легенды, поэтому язык не меняет цвет при смене фильтров.
  - **VIZ-07 (bump-chart рангов):** пунктирные линии-выноски связывают подпись, смещённую защитой от коллизий, с концом её линии (и участвуют в подсветке серии); значение `top` из ссылки прижимается к диапазону 5–30 и пишется обратно в URL, чтобы скопированная ссылка воспроизводила ровно видимый вид.

## [4.4.1] - 2026-07-30
### Fixed
- **Брейнсторм по восьми полосам сверен с трекинг-issue [#135](https://github.com/gasyoun/BookIndex/issues/135) — и одна ошибка исправлена (Opus 5 1M `claude-opus-5[1m]`, 30-07-2026):** первая редакция [`BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md) писалась по одному брифу H1609 и не проверила issue, где владелец уже зафиксировал вводные. Следствие: четыре из шести концепций предлагали «одну сводную азбучную полосу», тогда как вводная № 2 прямо запрещает сжимать три алфавита на одну полосу. Заменено на два режима владельца — компакт (3 полосы) и простор (6). Добавлен § 4c с блоками, которых в брейнсторме не было вовсе: разворот карты археологических раскопок Великого Новгорода (не путать с картой топонимов), реклама издательства, 3 уже пустые страницы, сценарий 4 фоторазворотов, отложенная грамматика древнерусского. Бюджет владельца (компакт 7, простор 10 полос) означает, что обязательные блоки в просторном режиме сами не влезают в 8 — это сужает выбор концепций сильнее, чем предполагала первая редакция.

## [4.8.0] - 2026-07-30

### Added
- **Палитра команд / быстрый переключатель (Ctrl+K) (Opus 5 (`claude-opus-5`), 30-07-2026, H1824):** одно модальное окно, из которого доступна вся навигация и часть действий, без обхода шапки и вкладок. Реестр строится из того же `NAV_SECTIONS`, что рисует переключатель разделов, — 24 маршрута плюс 5 действий (фокус в глобальный поиск, три режима плотности, «назад»), поэтому новый раздел появляется в палитре сам, без второго списка, который разошёлся бы с первым. Три источника результатов в одном поле ввода: команды, недавно открытые записи (`Zalizniakiada.recentItems.v1`, показываются без запроса) и содержание указателя через уже существующий `getGlobalSearchMatches` (Fuse + устаревший точный поиск как запас) — палитра ничего из этого не переизобретает.
- Отбор команд — по подпоследовательности с приоритетом префикса (`совпадение с начала` 100, вхождение 70 − смещение, подпоследовательность 20), поэтому «глосс», «плтнст» и «лекц» находят нужную строку. Клавиатура закрыта целиком: Ctrl+K / ⌘K открывает и закрывает (работает и когда фокус стоит в поле ввода — обработчик стоит выше `shouldIgnoreGlobalHotkeys`, который глушит хоткеи с модификаторами), ↑↓ с закольцовыванием, Enter, Esc с возвратом фокуса туда, откуда палитру позвали. Для мыши и мобильных — кнопка «⌘K» в шапке рядом с поиском.
- Доступность: `role="dialog"` + `aria-modal`, `aria-hidden` снимается только на время показа, поле ввода — `combobox` с `aria-controls`/`aria-activedescendant`, строки — `option` с `aria-selected`. Заголовки в текст выводятся через `textContent`/`appendHighlightedSearchText` (контракт C3/H1607: никакого `innerHTML` на данных).
- [`tests/e2e/command-palette.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/command-palette.spec.js) — 12 тестов: открытие хоткеем и кнопкой, три способа закрытия, фильтрация с переходом по Enter, стрелки, клик по строке, попадание в содержание указателя, открытие поверх фокуса в поле поиска с возвратом фокуса, недавние записи без запроса, смена плотности, пустой результат, атрибуты доступности.

### Fixed
- Enter (и стрелки) сразу после быстрого набора выполняли **предыдущий** список: рендер результатов отложен на 80 мс, и активной оставалась строка от прошлого запроса. Добавлен принудительный сброс отложенного рендера перед действием, а выбранная запись теперь хранится на самой строке (`row._entry`), а не только по индексу, — клик выполняет то, что человек видел, даже если список успел перерисоваться.
- Два теста падали в полном прогоне и проходили по отдельности (числились в `.ai_state.md` как «order-dependent flakes» после H1823): причина не в утечке `localStorage`, а в том, что оба трогали интерфейс до `wireGlobalUI()` — `fill()` по `#global-search` без привязанного `oninput` и `selectOption()` по `#density-select` без обработчика `change` тихо не давали эффекта. Оба теперь ждут признак загрузки приложения; полный набор — 169 тестов зелёными подряд.

### Changed
- Потолок `v3_app.js` в [`scripts/check_performance_budget.mjs`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs): 670 000 → 700 000 B raw, 156 000 → 162 000 B gzip. Палитра стоит +27,8 KiB raw / +1,9 KiB gzip (реестр, скорер, отрисовка); прежний потолок был выбран под H1604 и не оставлял места.

## [4.7.0] - 2026-07-30

### Added
- **Phase U4 — верификационная обвязка перед редизайном интерфейса (Opus 5 (`claude-opus-5`), 30-07-2026, H1823):** [`tests/e2e/redesign-baseline.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/redesign-baseline.spec.js) — 17 тестов на восемь маршрутов из § «Phase U4» [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md), каждый на двух ширинах (1366×900 и 390×844). Проверяется всё, что перечислено в спецификации: горизонтальное переполнение, наличие и видимость основных элементов управления, их непересечение (попарный тест ограничивающих прямоугольников, вложенные пары исключены), непустые поверхности отрисовки при наличии данных, нулевой бюджет ошибок консоли. Скриншоты пишутся в `test-results/redesign-baseline/` как артефакты для глазного сравнения, а не как пиксельные эталоны: растеризация шрифтов на Windows и в CI различается, поэтому закоммиченный эталон `toHaveScreenshot` падал бы везде, кроме машины-автора. Запуск отдельно — `npm run check:redesign`; в `npm run check:e2e` набор попадает автоматически.
- Семнадцатый тест набора (16 маршрутных + 1) — контрактный: он перечитывает список маршрутов прямо из § «Phase U4» дорожной карты и падает, если спецификация и обвязка разойдутся. Объявленные поверхности данных тоже строгие — селектор, который перестал совпадать, роняет тест, а не тихо пропускает проверку (эта же ошибка была допущена и найдена при разработке: `.viz-module-body` не существует, у VIZ-03 это `.viz-card` + `.tl-wrap`).

## [4.6.0] - 2026-07-30

### Added
- **VIZ-08, второй центр карты — режим «Центр: сущность» (Opus 5 (`claude-opus-5`), 30-07-2026, H1821, добор до полной спецификации):** `v4.5.0` выпустил карту с центром на *направлении исследований*, а Phase V3 в [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) специфицирует центр на *выбранной сущности* с прогрессивным раскрытием и переиспользованием `cross_links`. Теперь есть оба: переключатель «Центр: направление / сущность». В режиме сущности — первый круг связей по умолчанию, второй по требованию, тип связей переключается между `cross_links` (типизированные, с весами) и `semantic_links` (нетипизированные, по общим страницам); рядом с картой — страницы книги, лекции/главы, термины глоссария и видео с таймкодом. Клик по узлу переносит центр карты (обход графа через URL), клик по центру открывает карточку. Ссылка воспроизводима: `mode`, `entity`, `rel`, `depth`.
- Четыре ключа состояния (`mode`, `entity`, `depth`, `rel`) добавлены в `ALLOWED_KEYS` [`scripts/viz/viz-state.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/viz-state.js) — совместимо со всеми остальными модулями.
- Тесты режима сущности в [`tests/e2e/research-map.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/research-map.spec.js): 7 → 12 (первый круг + URL, второй круг с проверкой после reload, переключение `cross`/`semantic`, перенос центра кликом, видимость полей по режиму и сброс).

### Fixed
- `.viz-toolbar label` ставил `display:inline-flex`, перебивая атрибут `[hidden]`: поля, относящиеся только к одному режиму, не скрывались. Добавлено `.viz-toolbar label[hidden] { display: none; }` — правило общее для всех модулей, так что тот же класс дефектов закрыт и на будущее.

## [4.5.0] - 2026-07-30

### Added
- **VIZ-08 «Исследовательская карта» — восьмой модуль визуализаций, первый интегративный (Opus 5 (`claude-opus-5`), 30-07-2026, H1821):** [`scripts/viz/research-map.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/research-map.js) собирает исследовательскую программу А. А. Зализняка в один экран — семь направлений (сравнительно-историческое языкознание, акцентология, берестяные грамоты, «Слово о полку Игореве», диалектология, морфология, против любительской лингвистики), каждое агрегирует четыре слоя данных: свидетельства из `scholar.*`, границы глав и страниц, сущности указателя и связанные видео из `video_catalog`. Остальные семь модулей показывают по одному срезу; этот показывает, как срезы сходятся. Обзор — концентратор с семью узлами (размер ∝ числу свидетельств) и пунктирными мостиками по общим сущностям; раскрытое направление — спутники-сущности с переходом в карточку. Панель справа ведёт к главам (`openLecturePage`), к видео (`openVideoDetail`), в смежные направления и в профильный модуль VIZ-01…07. Состояние в URL (`filter`, `top`), SVG-экспорт, полная обвязка `VizShell`. Замеры охвата и мостиков: [`RESULTS_LOG.md`](https://github.com/gasyoun/BookIndex/blob/main/RESULTS_LOG.md) § H1821.
- Регрессионный набор [`tests/e2e/research-map.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/research-map.spec.js) (7 тестов: обзор, мостики, раскрытие с состоянием в URL, глубокая ссылка, сброс, переход в карточку, клик по сводной таблице) плюс `viz08` в контрактном [`tests/e2e/viz-shell.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/viz-shell.spec.js).

### Changed
- Потолок gzip для `aaz-index.html` в [`scripts/check_performance_budget.mjs`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs) поднят 180 000 → 186 000 B: предыдущий `main` уже занимал 179 435 B (99,7%), из-за чего любая новая панель ломала гейт независимо от своей цены. Стили VIZ-08 — ~871 B gzip.
- Из дорожных карт вычеркнуты два устаревших пункта дрейфа (H1878, [PR #171](https://github.com/gasyoun/BookIndex/pull/171)): [`docs/DH_ROADMAP_2026.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/DH_ROADMAP_2026.md), [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md).

### Fixed
- Версия синхронизирована по всем файлам: релиз `v4.4.0` был тегирован, но `package.json`, `CITATION.cff` и README остались на `4.3.1`. Теперь все три несут `4.5.0`, а `date-released` в `CITATION.cff` — дату этого релиза.

## [4.4.0] - 2026-07-29
### Added
- **Брейнсторм по восьми полосам печатного спутника (Opus 5 1M `claude-opus-5[1m]`, 29-07-2026, [PR #168](https://github.com/gasyoun/BookIndex/pull/168)):** ruling MG «я не решил что именно будет на 8 полосах, надо brainstorm» открыл всю тетрадь, а не только полосу 8, которую держал открытой бриф H1609. [`docs/BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md) — шесть цельных концепций тетради, пул из 14 вариантов по отдельным полосам (4 новых, найдены в самих данных: указатель имён как «кто есть кто» на 176 персоналий, этнонимический разворот на 66, практикум поиска по 3 708 KWIC-сегментам, «слова-звёзды» из 1 403 обратных лексических входов) и замер того, что набирается из готовых массивов против того, что требует авторского текста.

### Fixed
- **Две поправки к производственному брифу, найденные при замере (тот же проход):** (1) вариант 3 «мини-словарь лингвистических терминов 30–40» вышел с оговоркой «не дублировать глоссарий, если он уже есть» — глоссарий **уже есть**, 36 статей в [`data/modules/21-materials.json`](https://github.com/gasyoun/BookIndex/blob/main/data/modules/21-materials.json), ровно тот объём, так что это не «написать словарь», а «отобрать и сверстать существующее»; (2) вариант 9 (колофон) помечен в брифе как слабый «пока не выпущен Zenodo-DOI» — **DOI выпущен**, concept `10.5281/zenodo.21630473` (см. [4.3.1] от 27-07-2026, на день позже брифа), поэтому колофон разблокирован и одно из четырёх решений человека снято за ненадобностью.

## [4.3.1] - 2026-07-27
### Added
- Real Zenodo DOI wired in (H1601 follow-up): the Zenodo↔GitHub webhook (configured 2026-07-09, previously undocumented) minted a concept DOI `10.5281/zenodo.21630473` and version DOI `10.5281/zenodo.21630474` from the `v4.3.0` release. Backfilled into `CITATION.cff` (`identifiers:` block), README (DOI badge + citation section), `LICENSE-DATA.md`, and `docs/ZENODO_RU.md` status note. ORCID is still the one open item — no human input yet, placeholder stays commented.

## [4.3.0] - 2026-07-27
### Note
First tagged GitHub release since `v4.2.0` (2026-04-18). The sections previously
dated `[1.0.0] - 2026-06-13` and `[2.3.0] - 2026-05-26` below were drafted in this
file but never actually tagged or released — `package.json`, `CITATION.cff` and
the README all stayed at `2.2.0` the whole time, and no `v1.0.0`/`v2.2.0`/`v2.3.0`
git tag was ever cut (only `v2.1.0`, `v4.1.0`, `v4.2.0` exist). This release folds
that drafted-but-unshipped content together with everything accumulated under
`[Unreleased]` since into one real release, and continues the actual git-tag
sequence (`v4.2.0` → `v4.3.0`) rather than the changelog's separate internal
numbering. It also lands the citability/Zenodo release packaging (H1601).

### Added
- Landing-promotion decision brief (H1603): `docs/LANDING_SUSTAINABLE_PROMOTION_DECIDE_2026.md` —
  adopt/hybrid/reject brief for promoting `mockups/sustainable.html` (H654) to the live
  `index.html`. No ruling was on record at launch, so per the handoff's own gate the session
  stopped with this brief instead of force-adopting. Key facts: current landing is already
  near-sustainable (15.6 KB, 0 webfonts/trackers, SVG-only); mockup's real delta is the dark
  scheme (−2.7 KB cosmetic); the app it opens into is light-only parchment, so a moss-dark
  front door creates a dark→light handoff. Recommendation: hybrid (dark scheme on the
  existing parchment tokens), else reject. Human `@DECIDE` mirrored in Uprava GTD.
- Print-companion brief (H1609): `docs/PRINT_8PP_COMPANION_BACKMATTER_2026.md` — 8-page
  endmatter signature for «Из жизни слов и языков» (mumintroll, 2026): fixed map for
  pages 1–7 (Devanagari / Arabic / Old-Russian charts, video-archive spread with measured
  176 lectures ≈213 h / 27 transcripts, two sibling-book cards), 10 ranked options for the
  open page 8 with a recommendation (QR guide), fallback one-alphabet layout, typesetting
  and rights notes. Page-8 pick is an open human `@DECIDE` (mirrored in Uprava GTD).
- VIZ Phase V1 shell (H1605): shared `scripts/viz/viz-shell.js` chrome for all seven
  active modules — module header (title + data-source chip + Сброс/Ссылка/SVG),
  toolbar grammar (filters left / view right), unified loading/empty/error states,
  focus rings and max-width overflow guards. Exceptions documented in
  `docs/VIZ_SHELL_EXCEPTIONS_H1605.md`.
- Video **detail card** (H1604 / B4 residual): hash route `#v4/materials/video/<id>` shows title, date, duration, YouTube link, related-entity chips (`navigateToItem`), and an honesty note on book-chapter thematic overlap (not a recording of the chapter). Reachable from the video gallery titles and the home «Я смотрю видео» search; gallery keeps a separate YouTube deep link. Home search uses `getDedupedVideoCatalog` so counts are not inflated. E2E in `tests/e2e/session-features.spec.js`.
- H1602 context-coverage batch: **+88** direct contexts (stratified: lexicon 50, names 12, languages 6, toponyms 6, ethnonyms 5, lexicon_tech 5, lexicon_reverse 4). Direct coverage **24.2% → 26.8%** (816→904); effective **32.3% → 36.3%** (clears 35% target). Metrics in `RESULTS_LOG.md`; `validate_content.py` green.
- Volume-II entity **candidates** from lectures-v2 (DH C3 residual, H1599):
  `scripts/extract_entities_from_transcripts.py --candidates` proposes heads
  *absent* from `app_data` (names with initials, languages, quoted subjects;
  ethnonym hints) with type guess, first-mention timecode and frequency caps.
  Emits `data/imports/lectures-v2/entity_candidates.{json,csv}` plus
  `ENTITY_CANDIDATES_README.md` (review protocol + `import_source.py` promotion).
  Never writes unreviewed heads into `app_data`.
- «Сообщить об ошибке» flow (DH roadmap C4): entity cards link to a prefilled GitHub issue form (`.github/ISSUE_TEMPLATE/entity_correction.yml`) carrying the entity's slug, type, canonical URL and a `[правка] <head>` title; new `type:correction` label completes the four-group taxonomy for reader-reported corrections.
- KWIC over lectures matches accent-tolerantly — «победа» also matches the stressed transcript form «побе́да».
- Entity-card secondary actions (show on map, copy link, export .md) collapse into a «⋯ еще» menu; prev/next/back stay visible (B5).
- Regression E2E suite (`tests/e2e/session-features.spec.js`) covering the home task dashboard, chapter ribbon, lecture KWIC, video gallery, card order/dedup/actions, page citations and the lecture↔video link.
- Authority review worklist: `scripts/retier_authority_candidates.py` (`npm run authority:retier`) emits `data/authority_review.{json,csv}` — the 209 unconfirmed Wikidata candidates tiered by decision effort (decide / research / none) with a suggested QID and a `decision` column.
- Entity-card content priority (B5): the card now orders sections by reader value — pages + contexts, then the «Видео» chips (moved up above the cross-link cluster), then cross-links with the «Авторитетные записи» chips grouped right after them, then external-DB (LOD) links and the citation widget.
- Video gallery (B3.5): a new «Видеогалерея» tab under Материалы lists all 175 (deduplicated) videos with title, date, duration and clickable entity chips, plus search (by title or mentioned entity), a book-chapter filter, and sort by date or duration.
- Video ↔ chapter linkage (B3.4): each lecture/chapter page now lists topically related videos — public lectures whose discussed entities overlap that chapter's pages — under «Видео по теме главы», with an explicit note that they are related lectures, not recordings of the book chapter. The chapter ↔ page-range mapping was already shown («стр. X–Y»).
- Page-level citations + canonical links (B2): the entity card's «скопировать ссылку» now copies the stable clean canonical URL (the prerendered page) instead of the app hash route, and the on-card citation widget (ГОСТ/APA/MLA/Chicago) now includes the page reference («С. 157») and the correct book title from `corpus.books`, citing the clean canonical URL.
- Home as a task dashboard (B4): the home page now leads with a "С чего начать?" band of three reader tasks — «Я читаю страницу книги» (page number → page view), «Я смотрю видео» (inline title search over the 191-video catalog), «Найти слово, имя, термин» (→ global index search). The stats/showcase moved below.
- Book-spine chapter ribbon (B1): the «Читаю сейчас» page view gained a navigable density mini-map of the 11 chapters — each segment is sized by page span and shaded by mention density, the current page's chapter is highlighted, and clicking a segment jumps the page view to that chapter.
- KWIC over the lecture corpus: the concordance gained a "Лекции (видео)" source that searches the ~240k-word timecoded transcript corpus and links each hit to the exact minute in the video (`&t=<sec>s`). Backed by a compact, lazy-loaded index (`data/lectures_kwic.json`, built by `scripts/build_lectures_kwic.py` / `npm run kwic:build`) so it never bloats the main artifact.
- Live GitHub Pages health checks plus Lighthouse and axe accessibility quality gates.
- Video-production pipeline tracker: `data/video_pipeline.json` (per-video proof-reading stage, transcription quality, assignees, dates, links) migrated from `video-archive.xlsx`, plus a self-contained volunteer dashboard at `pipeline/index.html` (`npm run pipeline:dashboard`).
- Reverse video links on entity cards: names, languages, ethnonyms, toponyms, lexicon and subject cards now list the lectures/talks that mention them (built from `video_catalog[].related_entities`), newest first, with duration and a total count.
- Lecture transcript corpus (`data/imports/lectures-v2/`): `scripts/ingest_transcripts.py` fetches edited transcripts from public Yandex.Disk links recorded in `data/video_pipeline.json`, extracts timecoded segments (`.docx`/`.srt`, stdlib only), and stores one reviewable JSON per lecture plus a corpus index. 27 lectures ingested (~240k words, ~3.7k timecoded segments) with proof-reading-stage provenance; feeds upcoming deep video links (B3.2), entity extraction (C3) and lecture KWIC.
- Deep video links by timecode (B3.2): `scripts/build_transcript_timecodes.py` matches each entity against the transcript corpus and writes the first-mention timecode onto `video_catalog[].related_entities[].t`; entity-card video links now jump straight to that minute (`&t=<sec>s`) and show a `▸ MM:SS` marker. 85 of 113 entity/video pairs on transcribed lectures are timecoded; the rest fall back to a plain link.
- TEI standOff + CSV exports (A6): `scripts/export_tei.py` (`npm run export:tei`) generates `exports/bookindex.tei.xml` (`listPerson`/`listPlace`/`listNym` + language/subject lists, each with `xml:id`, authority `<idno>`, canonical `<ptr>` and page/source notes) plus per-type CSV dumps. Output is deterministic and self-validated for XML well-formedness; TEI is an export format, not an authoring format.
- Simulator source audit (A5): `docs/SIMULATOR_AUDIT_RU.md` inventories every claim in the three linguistic simulators (sound laws, accent reconstructor, orthography hydrator) with a source/status for each (standard / authoritative / illustrative). Each simulator now carries a visible source footnote framing it as an educational/illustrative tool — accent paradigms A/B/C attributed to Zaliznyak's accentology (1985/2008), sound changes to standard comparative Slavistics, and the orthography hydrator's substring matching flagged as approximate.
- Provenance of derived layers (A4): `docs/METHODS_RU.md` and machine-readable `data/provenance.json` document how `edges`, `language_edges`, `cross_links` and `semantic_links` are derived (proximity-weighted co-mention / similarity), and state honestly that no generator is committed so the exact formulas are not reproducible from the repo. The name and language co-mention graphs now carry a provenance caption ("связи вычислены автоматически… поисковый сигнал, не нормативное утверждение") linking to the methods doc.
- Authority identifiers (A3): `scripts/align_authorities.py` aligns names/toponyms/ethnonyms to Wikidata (with VIAF/GND/GeoNames pulled from the matched item). 131 of 340 high-confidence matches auto-written to `authority` blocks in `app_data.json` (`src: wikidata-auto`); the rest are left in `data/authority_candidates.json` for manual review. Persons are verified by instance-of=human + surname + initials + a scholarly/historical domain filter (rejects off-domain same-name matches). Entity cards show an "Авторитетные записи" chip row; prerendered pages add schema.org `sameAs`. Schema extended with an `authority` property.
- Stable canonical entity URIs (A2): a frozen slug registry (`data/slug_registry.json`, keyed by each entity's `canonical_id`) makes URL slugs stable across releases — a head rename never changes the URL. `scripts/build_slug_registry.mjs` (`npm run slug:freeze`) maintains it; `scripts/prerender.mjs` consumes it. Entity pages now declare the clean prerendered path as `<link rel="canonical">`, `og:url` and JSON-LD `@id` (was the app hash route). Added a retired-slug redirect table (`data/slug_redirects.json`) consulted by `404.html`. URIs stay global (one merged entity = one URI), matching the by-head identity model; introduced with zero change to existing slugs.
- Citability / scholarly infrastructure (A1): `CITATION.cff` (CFF 1.2.0, GitHub "Cite this repository"), `.zenodo.json` for DOI minting on release, `LICENSE-DATA.md` separating code (Apache-2.0), index data (CC BY 4.0) and book quotes/transcripts (© rights holders, cited with permission), a "Как цитировать" + license section in the README, and `docs/ZENODO_RU.md` deposit guide.
- Entity↔lecture linking from the corpus (C3): `scripts/extract_entities_from_transcripts.py` links known index entities (names, toponyms, ethnonyms, languages, subject terms — lexicon excluded as too noisy) to the lectures that mention them, with first-mention timecodes. Adds 807 `src:"transcript"` edges to `video_catalog[].related_entities`, raising the number of entities with a video section from ~48 to ~239. Russian matching uses stemmed prefixes, strict multiword phrases, and surname anchoring with epithet/patronymic/collision guards.
- **Sound Law Simulator**: Interactive po-shagovaya historical phonology engine showing the evolution of Proto-Slavic reconstructed roots to modern Slavic descendants (Russian, Polish, Czech).
- **Linguistic Database Interoperability (LOD)**: Direct Glottolog, WALS, Vasmer's Dictionary on Starling, and Russian National Corpus (RNC) connections integrated in Language and Lexicon SPA cards.
- **Old Russian Accentology Paradigm Simulator**: Dynamic reconstructor for Accent Paradigms A (baritone), B (oxytone), and C (mobile) tracing nominal declensions across three historical stages.
- **Old East Slavic Orthography Hydrator**: Real-time medieval grapheme processing engine translating modern Russian words to Old East Slavic spelling forms (`ѣ`, `ъ`/`ь`, `ѫ`/`Ѧ`, `ѡ`).
- Complete E2E and visual check suite passing all 104 Playwright tests cleanly.

### Changed
- Regenerated `tests/index-audit-queue.json` + `tests/context-entry-pack.{json,md}` after H1602 context drain (missing_context 2285→2149).
- H1598 lecture-transcript ingest re-check: still **27/176** videos with `links.text` — NO-OP documented in `docs/LECTURE_TRANSCRIPT_INGEST_H1598_NOOP_24.07.2026.md` (no corpus/KWIC regeneration).
- Raised the axe accessibility gate to require zero critical and zero serious violations on audited routes.
- Switched the standalone app from embedding the full `app_data.json` payload to lazy-loaded `data/modules/*.json` chunks that are pre-cached for offline use.
- Darkened muted helper text in the app shell so route metadata, index summary chips, chapter labels and KWIC controls meet contrast requirements.
- Replaced script CSP `unsafe-inline` with build-generated SHA-256 hashes for the landing page and standalone app shell.
- Replaced broad style CSP `unsafe-inline` with build-generated SHA-256 hashes for inline style blocks.
- Removed the remaining `style-src-attr 'unsafe-inline'` exception by moving runtime style attributes to `data-*` driven DOM style updates.
- Opted GitHub workflows into the Node 24 JavaScript action runtime ahead of the June 2026 migration.
- Raised the `v3_app.js` runtime-script performance budget to match the app's real size after the corpus/video/DH feature growth (the budget had been exceeded since a pre-existing commit); the gate is enforceable again.

### Fixed
- Deploy-asset drift (found while running the `build:vite` step of this release): `public/sw.js` had silently fallen out of sync with the root `sw.js` since commit `ed2b7faa` (26-05-2026) — it was still precaching `zaliznyak_portrait.png` instead of `.webp` and missing `404.html`, so every `npm run build:vite` run regenerated a stale service worker. Synced `public/sw.js`, added the missing `public/zaliznyak_portrait.webp`, and added `zaliznyak_portrait.webp` to the `deployAssets` list in `scripts/vite/postbuild-copy.mjs` so the drift can't reoccur silently.
- `npm audit` CI gate: bump transitive `brace-expansion` **2.1.0 → 2.1.2** (GHSA-3jxr-9vmj-r5cp high / DoS). Clears `check:security` (`npm audit --audit-level=moderate`) which had been failing every main push.
- C3 / H1607: priority UI paths (global search rows, entity list heads, KWIC empty/result rows, card context + source-quote rows) render untrusted text via `textContent` / DOM APIs instead of data-bearing `innerHTML`; `escapeHtml` stays as defense-in-depth for residual template joins. Regression: `tests/e2e/dom-render-harden.spec.js`.
- Restored the README «Audit Summary» section (dropped by the H550 README refresh), un-reddening the `validate_content.py` CI gate that had failed on every push to `main` since.
- Reverse video links now de-duplicate by video id (`video_catalog` contains duplicate-id rows), so entity-card video counts and lists are no longer inflated; the chapter-related-videos and gallery views share the same deduped catalog.
- Entity citations fall back to per-book `occurrences` pages when `page_list` is empty, so the «С. N» reference is no longer dropped (e.g. «Saloni Z.» → «С. 157»).
- Security hardening (defensive, author-curated data): escape interpolated values in the app + prerender citation widgets and the prerendered JSON-LD (`</script>` guard); validate the 404 retired-slug redirect against `^[a-z0-9-]+$`; CSV formula-injection guard in the TEI exports; `</script>` guard in the pipeline dashboard.
- Matcher precision: whole-word (not substring) surname matching in the authority aligner; a ≥4-char floor in the transcript timecoder.

### Removed
- Dead root build artifact `v13_app_test.js` archived to `docs/history/v13_app_test.js` (H1506) — May-2026 concatenated output of the old `bundle.js` pipeline; zero live references in package.json/CI; `npm run build`, `check:js`, and Playwright (127) still pass.
- Root runtime dead copies `v3_app.js.orig` (tracked) and ignore-policy for `*.orig` / existing `*.bak` (H1608) — large backup siblings of live `v3_app.js` that confused greps and inflated the tree; no package/docs references.
- Retired `video-archive.xlsx` from the repository; the canonical production status now lives in `data/video_pipeline.json`.

## [4.2.0] - 2026-04-18

# Release Notes - v4.2.0 (2026-04-18)

## Highlights

- ???????? ???????????? `runtime_test.py`:
  - ????-????? Node.js ????? `NODE_BINARY`, PATH ? ??????? ???? Windows;
  - ???????? ??????????? ????????? ??? ?????????? Node.js.
- ???????? `scripts/content_report.py`:
  - ??????? ??????? ?? `app_data.json`;
  - ??????? ??????: Markdown (`--format md`) ? JSON (`--format json`).
- ????????? ????????? reduced motion:
  - CSS-????????? ??? `prefers-reduced-motion: reduce`;
  - ?????????? smooth-scroll ? ?????? ? scholar-??????? ??? reduced motion.
- ????????? ????????????:
  - ????? `README.md` ? ?????????? ????????? ???????????;
  - ????????? ??????? ?????????? `KIDS_GUIDE_RU.md`.

## QA (?????? 2026-04-18)

- `python runtime_test.py` (c `NODE_BINARY`) - OK (`21/21`).
- `npx playwright test` (????? ????????? Node.js) - OK (`34 passed`).

## GitHub

- Merged PR:
  - `#50` runtime_test Node guard.
  - `#52` content audit report.
  - `#54` reduced motion support.
- Closed issues:
  - `#49`, `#51`, `#53`.

## [4.1.0] - 2026-04-17

# Release Notes - v4.1.0 (2026-04-17)

## Highlights

- `#43` KWIC MVP ??????? ?? ??????????? DoD:
  - ????? ?? `lexicon` ? `glossary`;
  - ?????? ????????? ???????;
  - ?????????? ?? ??????/??????? ????????? ? ????????;
  - ???????? ? ???????? ? ? ?????? ?????????.
- ????????? ??????????? ? ??????? guard'? ??? ????????? KWIC-??????????:
  - ???????????? `contexts` ?? ????? ?????????? ??????;
  - ?????????? ???????? ?? ??????????;
  - ?????? ?? ?????? ????????? ? ?????????? ????? ??????;
  - ????? ???? ???????? ?????? ? ????????? ? UI ("???????? ?????? N").
- `#45` ???? ?????????? ????????? ?? `D3.js`:
  - zoom/pan;
  - ?????? ???????????? ???? ?????;
  - tooltip ? ???????;
  - ???? ?? ???? ????????? ???????? ???????.
- `#46` PWA foundations:
  - `manifest.webmanifest`;
  - `sw.js` (cache shell + offline fallback);
  - ?????? `icon-192.svg`, `icon-512.svg`;
  - ??????????? service worker ? ????????.
- `#47` BibTeX export:
  - ??????? scholar bibliography;
  - ??????? further reading;
  - ??????? ?????????? ?? ????????.

## KWIC Perf Snapshot

??????? ???? ?? ????????? ?????? ????????:

```bash
node scripts/profile_kwic.js
```

???? ?? 30 ????????? ?? ??????:

- Lexicon KWIC: ???????? `avg ~14.1ms`, ???????? `p95 ~30.8ms`, ?? `593` ?????.
- Glossary KWIC: ???????? `avg ~61.2ms`, ???????? `p95 ~78.5ms`, capped at `1200` ????? (`truncated=true` ??? ??????? ????????).
- ?????????? `left` ?? 400 ?????: ???????? `avg ~34.5ms`, ???????? `p95 ~50.7ms`.

## QA

- `python scripts/build_aaz_index.py` - OK.
- `python scripts/check_encoding.py` - OK.
- `python scripts/validate_content.py app_data.json` - OK (`0 errors`, `2` ????????? warning ?? ?????? ??????).
- `python runtime_test.py` - OK (`21/21`).
- `playwright test` - OK (`34 passed`).

## Included Artifacts

- `aaz-index.html` (standalone SPA build).

## Notes

- ?????? PR [#48](https://github.com/gasyoun/BookIndex/pull/48) (Ready for review) ?? ????? `codex/v4.1-local-finalize`.
- ? `#44/#45/#46/#47` ????????? ??????????? ?? ??????? ?? PR `#48`; ???????? ???????? ????? `Closes #...` ? PR body.

## [2.2.0] - 2026-05-17
### Added
- Open Graph, Twitter Card and JSON-LD metadata for `index.html` and `aaz-index.html`.
- Local Leaflet CSS/JS assets so runtime scripts no longer depend on `unpkg.com`.
- Full Playwright CI gate, npm audit, static security policy guard, performance budget, Dependabot and CodeQL.
- `robots.txt`, `sitemap.xml`, PWA icons, manifest copies and portrait preview asset for GitHub Pages.

### Changed
- Restored the tested `v3_template.html` + `v3_app.js` standalone runtime after the temporary `src/entry.js` path failed full parity.
- Kept Vite as a standalone build smoke and deploy-asset copy path.
- Updated Vite to the current 8.x line and kept dependency audit at zero vulnerabilities.
- Normalized README, Codex workflow, Claude guidance, changelog and documentation archive notes.

## [2.1.0] - 2026-04-15

# Release Notes — v2.1.0 (2026-04-15)

## Highlights

- Closed full v2 backlog (`#16`–`#25`).
- Added density modes (`compact`, `reader`, `research`) with persistence.
- Added lecture comparison panel (intersection and unique entities).
- Added page-range trends analytics with interactive window selection.
- Added analytics export to `CSV` and `Markdown`.
- Added data schema versioning and migrations:
  - `schema_version` / `schema_migrations` in `app_data.json`;
  - runtime migration layer in `v3_app.js`;
  - validation checks in `scripts/validate_content.py`;
  - standalone migration tool `scripts/migrate_app_data.py`.

## Build and QA

- Built fresh standalone artifact: `aaz-index.html`.
- Validation: `python scripts/validate_content.py app_data.json` — `0 errors`.
- Runtime smoke: `python runtime_test.py` — `20/20`.

## Included artifact

- `aaz-index.html` (standalone SPA build for browser use).
