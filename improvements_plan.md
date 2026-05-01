# BookIndex v4.4: стабилизация + UI

Актуализация на 2026-05-01 по локальному `main` и GitHub `gasyoun/BookIndex`.

## 0. Текущее подтверждение, 2026-05-01

- GitHub: открытых PR нет; открытая issue одна — [#82](https://github.com/gasyoun/BookIndex/issues/82) по LICENSE.
- PR [#81](https://github.com/gasyoun/BookIndex/pull/81) остаётся последним крупным merge-scope: VIZ-00..VIZ-07 уже реализованы, в v4.4 по ним актуальны только стабилизация, smoke и polish.
- Локальная текущая волна UI hardening расширена: кроме gallery / Russian evolution / phonetic laws / tasks / lectures / page trends, вынесены в CSS повторяющиеся scholar intro, bibliography, controversy, original forms, birch filters/tables, chronology, isoglosses, slovo, accent paradigms, correspondence table и reconstruction styles.
- После текущей волны source-level ` style="..."` в `v3_app.js` снижен с 172 до 11 и закреплён allowlist guard-командой `npm run check:ui`; production `home/home` и скрытый experimental `home/home_decl` переведены на общие CSS-классы/media-query, фиксированные category dots / moderator mark / timeline empty state / SVG cursor/root styles вынесены в CSS. Оставшиеся случаи — осознанные динамические custom properties, data-driven widths/colors и SVG text styling.
- Проверки после текущей волны: `npm ci --dry-run --ignore-scripts`, `npm run check`, `python scripts/check_encoding.py`, `python scripts/validate_content.py app_data.json`, `python runtime_test.py` (`21/21`) проходят; `npm run check` включает `typecheck`, `check:js`, `check:ui` и `check:e2e` (`66/66`), `aaz-index.html` пересобран через `npm run build`.

## 1. Статус по GitHub

- `origin/main` содержит v4.4-слой стабилизации; локальный `main` синхронизирован с `origin/main`.
- PR [#81](https://github.com/gasyoun/BookIndex/pull/81) смержен 2026-04-20: VIZ-00..VIZ-07 уже реализованы, это больше не будущий feature-scope.
- Issues [#73](https://github.com/gasyoun/BookIndex/issues/73)..[#80](https://github.com/gasyoun/BookIndex/issues/80) по VIZ закрыты как completed.
- Единственная открытая GitHub-задача сейчас: [#82](https://github.com/gasyoun/BookIndex/issues/82) — owner decision по LICENSE.
- Локально в текущей волне подготовлены UI-правки в `v3_app.js` и `v3_template.html`: широкий вынос повторяющихся inline styles в CSS для home, карточек/списков, learning-панелей, scholar/VIZ-поверхностей и SVG-root/cursor классов.

## 2. Что уже закрыто и не должно оставаться как open work

- `package.json` уже содержит единый npm-слой команд: `check`, `check:js`, `check:ui`, `check:e2e`, `typecheck`, `build`, `build:legacy`, `build:vite`, `e2e`.
- `package-lock.json` синхронизирован с `package.json`; `npm ci --dry-run --ignore-scripts` проходит на bundled Node 24.
- `requirements.txt` уже добавлен и фиксирует `jsonschema`.
- CI уже ставит Python-зависимости, выполняет `npm ci`, build, typecheck, JS syntax checks, encoding/content checks, runtime smoke, Vite smoke и Playwright; Node.js зафиксирован на 24, чтобы совпадать с Vite 8 и локальным bundled Node.
- `home/home_decl` уже скрыт из основной навигации; публичный стартовый экран остается `home/home`.
- VIZ hardening первого пакета уже отражен в README: `scripts/viz/viz-state.js`, state в URL, VIZ-01 autoplay, компактная VIZ-03 сетка, защита подписей VIZ-07.
- `CODEX_WORKFLOW_RU.md` очищен от битого раздела 1, а `CODEX_VISUALIZATIONS_RU.md` очищен от `[cite:*]`.
- README уже обновлен до v4.4 и описывает локальный старт, CI и release checks.

## 3. Что остается актуальным в v4.4

- Текущая v4.4 technical wave закрыта в рабочей копии: UI hardening, smoke, check layer и малый helper split прошли полный локальный gate.
- До merge/PR остаётся только финальная human review диффа и упаковка изменений; новых feature-scope задач в этот цикл не добавлять.
- После любых дополнительных runtime/template правок по-прежнему пересобирать `aaz-index.html` и запускать полный gate.
- Не переписывать крупные static/container templates без отдельного будущего scope: оставшиеся `innerHTML` места в основном являются panel-shell/table templates, а не быстрыми data-bearing row builders.
- LICENSE не выбирать в коде или README до явного решения владельца по issue #82.

## 4. Что было обновлено в плане

- Формулировка "синхронизировать `package-lock.json` с `package.json`" убрана как открытая задача. Новая формулировка: "периодически проверять `npm ci` на supported Node".
- Локальные инструкции уточнены: системный `npm` может отсутствовать в PATH; bundled Node 20.17 дает engine warning для Vite 8, поэтому для локальных smoke лучше использовать Node 24 или Node >=20.19.
- VIZ-00..VIZ-07 перенесены из раздела "реализовать" в раздел "стабилизировать, smoke-test, polish".
- "Создать отдельную задачу по LICENSE" заменено на "держать открытой #82 до owner decision".
- Обязательный шаг текущей UI-волны зафиксирован: после выноса CSS из `v3_app.js`/`v3_template.html` пересобрать `aaz-index.html`, затем прогнать проверки.

## 5. Обновленный порядок работ

### Пакет A — закрыть текущую UI-волну

Статус: выполнено в текущей рабочей копии.

1. Завершить текущий вынос inline styles в CSS, не смешивая с новыми feature-изменениями.
2. Пересобрать `aaz-index.html`.
3. Проверить, что `git diff --exit-code -- aaz-index.html` чистый после сборки или содержит ожидаемый rebuild.
4. Прогнать smoke по фонетическим законам и связанным карточкам.

### Пакет B — воспроизводимые проверки

Статус: выполнено в текущей рабочей копии; локальный npm-запуск зафиксирован через bundled Node 24.

1. Зафиксировать в README локальный Windows-вариант запуска npm через bundled Node 24 или PATH к supported Node.
2. Проверить:

```bash
npm ci
npm run typecheck
python scripts/check_encoding.py
python scripts/validate_content.py app_data.json
python runtime_test.py
npm run e2e
```

3. CI должен использовать Node 24, чтобы не зависеть от того, какую minor-версию даст floating `20`.

### Пакет C — UI smoke

Статус: выполнено в текущей рабочей копии для `1366x900`, `900x900`, `390x844`; `900x900` и `390x844` дополнительно закреплены Playwright smoke на отсутствие page-level horizontal overflow для home, list/card и scholar/viz.

Обязательные сценарии:

- global search;
- legacy hash;
- `#v4` card deep link;
- KWIC jump;
- theme/density;
- mobile card sheet;
- VIZ module switch;
- PWA/service worker smoke.

Viewport:

- `1366x900`;
- `900x900`;
- `390x844`.

### Пакет D — малый кодовый распил

Статус: выполнено в текущей рабочей копии. Сделаны безопасные переносы layout из JS в CSS для production home, tasks, lectures, chronology, scholar shell, scholar headings/links, scholar content sections, scholar tables/forms/reconstruction cards и page trends controls/cards. В коде добавлены маленькие hash/router helpers для чтения route markers и числовых параметров, aggregate cache теперь использует общий bounded-cache helper вместо дублирующей eviction-логики, `renderContent()` использует общий frozen renderer map и guard на отсутствующий content host, VIZ status rendering переведён на DOM/textContent, global search dropdown, mini-card rows, list rows, graph tooltip/legend, chronology rows, KWIC results и tasks history rows собираются DOM API вместо data-bearing `innerHTML`.

Без большого Svelte/Alpine-переезда:

- hash/router helpers;
- search/cache helpers;
- card/list render helpers;
- viz shell/helpers.

Каждый шаг должен быть маленьким, с отдельной проверкой standalone `aaz-index.html`.

## 6. Assumptions

- `app_data.json` не меняется в этом цикле, кроме явно согласованных data-задач.
- `schema_version` не меняется.
- Hash routes `#v4/...` остаются совместимыми.
- `aaz-index.html` остается коммитимым standalone-артефактом.
- Большой UI-framework migration не входит в v4.4; возможен только после стабилизационного цикла.
