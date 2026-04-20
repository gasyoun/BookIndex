# Codex Task: BookIndex v4 — Перелинковка и UX (Sprint v4.3)

## Контекст проекта

Репозиторий: `gasyoun/BookIndex`
Основной артефакт: `aaz-index.html` (single-file SPA, ~2.6 МБ)
Runtime: `v3_app.js` + `v3_template.html`
Сборка: `python scripts/build_aaz_index.py`
Данные: `app_data.json` (schema_version=2) — **только чтение, не модифицировать**
Hash-роутинг: `#v4/<entity>/<view>/item/<entity>/<slug>`

---

## Что УЖЕ реализовано — не трогать

Перед началом работы убедись, что следующие функции существуют и работают:

| Функция / CSS-класс | Якорь в v3_app.js | Статус |
|---|---|---|
| `autoLinkEntities()` | функция `autoLinkEntities()` | ✅ реализована |
| `renderBreadcrumb()` | функция `renderBreadcrumb()` | ✅ реализована |
| `.crosslink-badge` (subject → names) | функция `renderSubjectCard()` / секция crosslinks | ✅ реализован |
| `.relation-chip` CSS | v3_template.html, блок `.relation-chip` | ✅ есть |
| `.ctx-link` CSS | v3_template.html, блок `.ctx-link` | ✅ есть |
| BibTeX export | функции `exportBibtex*()` | ✅ реализован |
| PWA (manifest + sw.js) | отдельные файлы | ✅ реализован |
| D3-граф персоналий | функция `initD3Graph()` | ✅ реализован |
| KWIC-панель + KWIC-jump из lexicon | `renderKwicPanel()`, `renderCardInRight()`, блок `.kwic-jump-btn` | ✅ реализована |
| Двунаправленные рёбра в карточке names | `getReverseEdgesIndex()`, `collectNameRelationLinks()` | ✅ реализовано |
| Share deep link (копирование ссылки) | `copyCurrentUrl()`, кнопка `#copy-card-link` | ✅ реализовано |
| Автолинк glossary в контекстах | `getContextEntityLinkEntries()`, блок glossary | ✅ реализовано |
| Обратные ссылки lexicon → subject_index | `getSubjectByLexiconIndex()`, блок `.subject-crosslinks` в карточке lexicon | ✅ реализовано |

**Не переписывай и не дублируй эти блоки.**

---

## Данные — известные пробелы (справка)

| Сущность | n | contexts | sources | wiki |
|---|---|---|---|---|
| names | 96 | 56/96 | **0/96** | 63/96 |
| toponyms | 93 | 80/93 | **0/93** | **0/93** |
| languages | 130 | 124/130 | **0/130** | 0/130 |
| lexicon | 1364 | 177/1364 | **0/1364** | 0/1364 |
| subject_index | 88 | **0/88** | **0/88** | 0/88 |
| glossary | 36 | — | — | — |
| further_reading | **3** | — | — | — |

`cross_links` покрытие: languages→all = 100%, toponyms→languages = 100%,
names→toponyms = 23/27, names→languages = 56/56.

---

## Открытые задачи

Все задачи спринта v4.3 (TASK-1 — TASK-5) реализованы в `main`.
Следующие задачи определяются по результатам нового аудита или отдельных issue.

### Инфраструктурный долг

- Отсутствует `LICENSE` — вынесено в отдельную задачу, в этот scope не входит.

---

## Definition of Done (для будущих задач)

- [ ] `runtime_test.py` → `21/21` или больше (без регрессий)
- [ ] `npx playwright test` → все pass
- [ ] `aaz-index.html` пересобран через `build_aaz_index.py` и закоммичен
- [ ] Нет регрессий: `autoLinkEntities`, crosslinks, breadcrumb, KWIC, KWIC-jump, D3-граф, share-кнопка, glossary autolink, lexicon→subject backlinks, тёмная тема
- [ ] PR содержит описание изменений

---

## Соглашения проекта

- Все цвета/отступы — через CSS-переменные (`var(--color-primary)`, `var(--space-4)` и т.д.)
- Имена в hash — через `encodeURIComponent()` / `encodeItemHeadForHash(type, head)`
- `aaz-index.html` — артефакт сборки, **не редактировать напрямую**
- `app_data.json` — **только чтение** в рамках этого задания
- Новые e2e тесты — только в `tests/e2e/smoke.spec.new.js`
- Функции-индексы строить лениво (с кэшем через `let VAR = null`) — не при старте приложения
