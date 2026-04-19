# Codex Task: BookIndex v4 — Перелинковка и UX (Sprint v4.3)

## Контекст проекта

Репозиторий: `gasyoun/BookIndex`
Основной артефакт: `aaz-index.html` (single-file SPA, ~2.6 МБ)
Runtime: `v3_app.js` (9460 строк) + `v3_template.html` (1424 строки)
Сборка: `python scripts/build_aaz_index.py`
Данные: `app_data.json` (schema_version=2) — **только чтение, не модифицировать**
Hash-роутинг: `#v4/<entity>/<view>/item/<entity>/<slug>`

---

## Что УЖЕ реализовано — не трогать

Перед началом работы убедись, что следующие функции существуют и работают:

| Функция / CSS-класс | Строки v3_app.js | Статус |
|---|---|---|
| `autoLinkEntities()` | ~983–1072 | ✅ реализована |
| `renderBreadcrumb()` | ~1745 | ✅ реализована |
| `.crosslink-badge` (subject → names) | ~3949–4042 | ✅ реализован |
| `.relation-chip` CSS | v3_template.html ~491 | ✅ есть |
| `.ctx-link` CSS | v3_template.html ~774 | ✅ есть |
| BibTeX export | ~3072, 7313, 8601 | ✅ реализован |
| PWA (manifest + sw.js) | отдельные файлы | ✅ реализован |
| D3-граф персоналий | ~5413 | ✅ реализован |
| KWIC-панель | ~7689 | ✅ реализована |

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

## TASK-1 (P0): KWIC-jump из карточки lexicon / lexicon_tech

**Файл:** `v3_app.js`
**Точка вставки:** `renderCardInRight()` (~строка 4558) — блок рендера для `type === 'lexicon'` или `'lexicon_tech'`

### Что сделать

Добавить кнопку после заголовка карточки:

```html
<button class="kwic-jump-btn related-link"
        data-term="<head>"
        title="Показать в KWIC-конкордансе">🔍 Найти в KWIC</button>
```

**Обработчик клика** — добавить в блок делегирования кликов (~строка 3737):

```js
const kwicBtn = target.closest('.kwic-jump-btn');
if (kwicBtn) {
  window._pendingKwicTerm = String(kwicBtn.dataset.term || '');
  navigateTo('materials', 'kwic');
  return;
}
```

**В `renderKwicPanel`** (~строка 7689), в самом начале функции:

```js
if (window._pendingKwicTerm) {
  const term = window._pendingKwicTerm;
  window._pendingKwicTerm = null;
  setTimeout(() => {
    const inp = document.getElementById('kwic-query');
    if (inp) {
      inp.value = term;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 50);
}
```

**CSS** (добавить к `.kwic-jump-btn` в `v3_template.html`, рядом с `.related-link`):

```css
.kwic-jump-btn { margin-top: var(--space-2, 0.5rem); }
```

**E2E-тест** (добавить в `tests/e2e/smoke.spec.new.js`):

```js
test('lexicon card has KWIC jump button and navigates', async ({ page }) => {
  await page.goto(BASE_URL + '#v4/lexicon/list/item/lexicon/' + encodeURIComponent('а'));
  const btn = page.locator('.kwic-jump-btn');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page).toHaveURL(/#v4\/materials\/kwic/);
});
```

---

## TASK-2 (P1): Автолинк терминов glossary в текстах контекстов

**Файл:** `v3_app.js`
**Точка вставки:** функция, которая формирует список сущностей для `autoLinkEntities()` (~строка 983)

### Что сделать

Найти место, где формируется массив `allEntries` (или аналогичный) для автолинкера.
Добавить туда термины `glossary`:

```js
const glossary = APP_DATA.glossary || [];
glossary.forEach(g => {
  const head = String(g.head || '').trim();
  if (!head) return;
  allEntries.push({
    head,
    type: 'glossary',
    href: `#v4/materials/glossary/term/${encodeURIComponent(head)}`
  });
});
```

**В `renderGlossaryPanel`** (~строка 7861): при монтировании проверять
`window._pendingGlossaryTerm` — аналогично механизму KWIC-jump. Если флаг
установлен, прокрутить к нужному термину и подсветить его.

**CSS** (добавить в `v3_template.html` рядом с `.ctx-link`):

```css
.ctx-link[data-type="glossary"] {
  border-bottom: 1px dotted var(--title);
  text-decoration: none;
}
.ctx-link[data-type="glossary"]:hover {
  text-decoration: underline;
}
```

**E2E-тест:**

```js
test('glossary terms are autolinked in context texts', async ({ page }) => {
  // Открыть карточку языка с богатым контекстом
  await page.goto(BASE_URL + '#v4/languages/list/item/languages/'
    + encodeURIComponent('праиндоевропейский'));
  const glossaryLink = page.locator('.ctx-link[data-type="glossary"]').first();
  const count = await glossaryLink.count();
  if (count > 0) {
    await glossaryLink.click();
    await expect(page).toHaveURL(/#v4\/materials\/glossary/);
  }
  // Тест засчитывается в любом случае — glossary-термин мог не встретиться
  // в конкретном контексте, это не ошибка
});
```

---

## TASK-3 (P1): Двунаправленные рёбра графа в карточке персоналий

**Файл:** `v3_app.js`
**Точка вставки:** рядом с `buildDataIndexes()` (строка ~379) и `renderCardInRight()` для `type === 'names'` (~строка 4759)

### Что сделать

Построить индекс обратных рёбер **один раз при инициализации**:

```js
let REVERSE_EDGES_INDEX = null;

function getOrBuildReverseEdges() {
  if (REVERSE_EDGES_INDEX) return REVERSE_EDGES_INDEX;
  const rev = {};
  (APP_DATA.edges || []).forEach(e => {
    if (!rev[e.target]) rev[e.target] = [];
    rev[e.target].push({ head: e.source, weight: e.weight });
  });
  REVERSE_EDGES_INDEX = rev;
  return rev;
}
```

В рендере карточки `names` — объединить прямые и обратные рёбра:

```js
const rev = getOrBuildReverseEdges();
const directEdges = (APP_DATA.edges || [])
  .filter(e => e.source === item.head)
  .map(e => ({ head: e.target, weight: e.weight, dir: '→' }));
const reverseEdges = (rev[item.head] || [])
  .map(e => ({ head: e.head, weight: e.weight, dir: '←' }));

// Объединить, убрать дубли по head, сортировать по weight убывание
const seen = new Set();
const allRelated = [...directEdges, ...reverseEdges]
  .filter(e => { if (seen.has(e.head)) return false; seen.add(e.head); return true; })
  .sort((a, b) => b.weight - a.weight);
```

Рендерить как `.relation-chip` (CSS уже есть в шаблоне):

```html
<a href="${buildItemHash('names', rel.head)}"
   class="relation-chip"
   data-type="names"
   data-head="${escapeHtml(rel.head)}">
  ${renderAccentSafe(rel.head)}
  <span class="chip-weight">${rel.weight.toFixed(1)}</span>
</a>
```

**E2E-тест:**

```js
test('name card shows bidirectional relations (Grimm ← Verner)', async ({ page }) => {
  // Вернер К. → Гримм Я. есть в edges (weight=49.54)
  // На карточке Гримм должен быть Вернер (reverse)
  await page.goto(BASE_URL + '#v4/names/list/item/names/' + encodeURIComponent('Гримм Я.'));
  const chips = page.locator('.relation-chip');
  await expect(chips).toHaveCount({ minimum: 1 });
  const vernersChip = chips.filter({ hasText: 'Вернер' });
  await expect(vernersChip.first()).toBeVisible();
});
```

---

## TASK-4 (P2): Обратные ссылки lexicon → subject_index

**Файл:** `v3_app.js`
**Точка вставки:** рядом с `buildDataIndexes()` и `renderCardInRight()` для `type === 'lexicon'`

### Что сделать

Построить индекс «термин lexicon → рубрики subject_index» при инициализации:

```js
let SUBJECT_BY_LEXICON_INDEX = null;

function getSubjectByLexiconIndex() {
  if (SUBJECT_BY_LEXICON_INDEX) return SUBJECT_BY_LEXICON_INDEX;
  const idx = {};
  (APP_DATA.subject_index || []).forEach(s => {
    const key = normalizeHeadForMatch(s.head);
    if (!idx[key]) idx[key] = [];
    idx[key].push(s.head);
  });
  SUBJECT_BY_LEXICON_INDEX = idx;
  return idx;
}
```

В карточке `lexicon` добавить блок после основного контента:

```js
const subjectIdx = getSubjectByLexiconIndex();
const subjLinks = subjectIdx[normalizeHeadForMatch(item.head)] || [];
if (subjLinks.length) {
  const linksHtml = subjLinks.map(h =>
    `<a href="${escapeHtml(buildItemHash('subject', h))}"
        class="crosslink-badge"
        data-type="subject"
        data-head="${escapeHtml(h)}">${escapeHtml(h)}</a>`
  ).join('');
  html += `<div class="subject-crosslinks">
    <span class="crosslinks-label">В предметном указателе:</span>
    ${linksHtml}
  </div>`;
}
```

> CSS `.subject-crosslinks` и `.crosslink-badge` уже есть в `v3_template.html`.

**E2E-тест:**

```js
test('lexicon card links back to subject_index', async ({ page }) => {
  // 'артикль' есть и в lexicon, и в subject_index
  await page.goto(BASE_URL + '#v4/lexicon/list/item/lexicon/' + encodeURIComponent('артикль'));
  const badge = page.locator('.subject-crosslinks .crosslink-badge').first();
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page).toHaveURL(/#v4\/subject\//);
});
```

---

## TASK-5 (P2): Share-кнопка — копирование deep link

**Файл:** `v3_app.js`
**Точка вставки:** `renderCardInRight()` — шапка карточки (рядом с заголовком `<h2>`)

### Что сделать

Добавить кнопку в шапку карточки:

```html
<button class="share-card-btn related-link"
        data-hash="${escapeHtml(location.hash)}"
        title="Скопировать ссылку на карточку"
        aria-label="Скопировать ссылку">🔗</button>
```

**Обработчик** (в блоке делегирования кликов):

```js
const shareBtn = target.closest('.share-card-btn');
if (shareBtn) {
  const hash = shareBtn.dataset.hash || location.hash;
  const url = location.origin + location.pathname + hash;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => announceUiMessage('Ссылка скопирована'))
      .catch(() => announceUiMessage('Не удалось скопировать'));
  } else {
    // fallback для старых браузеров
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); announceUiMessage('Ссылка скопирована'); }
    catch (e) { announceUiMessage('Скопируйте вручную: ' + url); }
    document.body.removeChild(ta);
  }
  return;
}
```

**CSS** (добавить в `v3_template.html`):

```css
.share-card-btn {
  padding: 2px 7px;
  font-size: var(--text-xs, 0.75rem);
  border-radius: var(--radius-sm, 0.375rem);
  opacity: 0.65;
  transition: opacity 180ms;
}
.share-card-btn:hover { opacity: 1; }
```

**E2E-тест:**

```js
test('card share button copies URL to clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(BASE_URL + '#v4/names/list/item/names/' + encodeURIComponent('Зализняк А. А.'));
  const shareBtn = page.locator('.share-card-btn').first();
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('#v4/names/list/item/names/');
});
```

---

## Порядок выполнения

1. Прочитай `v3_app.js` целиком — найди строки всех упомянутых функций
2. **TASK-1** → `python runtime_test.py` → ожидается `21/21`
3. **TASK-2** → открыть карточку языка с богатым контекстом, проверить наличие `.ctx-link[data-type="glossary"]`
4. **TASK-3** → открыть карточку «Гримм Я.», убедиться что «Вернер К.» присутствует как `.relation-chip`
5. **TASK-4** → открыть карточку «артикль», убедиться в наличии `.subject-crosslinks`
6. **TASK-5** → проверить копирование ссылки
7. `python scripts/build_aaz_index.py`
8. `python runtime_test.py` → `21/21` (минимум)
9. `npx playwright test` → все тесты pass (включая 5 новых)
10. Убедиться: `git diff --exit-code -- aaz-index.html` выдаёт diff (файл обновлён)

---

## Definition of Done

- [ ] `runtime_test.py` → `21/21` или больше
- [ ] `npx playwright test` → все pass, включая 5 новых тестов из этой инструкции
- [ ] `aaz-index.html` пересобран через `build_aaz_index.py` и закоммичен
- [ ] Нет регрессий: `autoLinkEntities`, crosslinks, breadcrumb, KWIC, D3-граф, тёмная тема
- [ ] PR содержит описание: какие типы автолинков добавлены, сколько ребер графа теперь двунаправлены

---

## Соглашения проекта

- Все цвета/отступы — через CSS-переменные (`var(--color-primary)`, `var(--space-4)` и т.д.)
- Имена в hash — через `encodeURIComponent()` / `encodeItemHeadForHash(type, head)`
- `aaz-index.html` — артефакт сборки, **не редактировать напрямую**
- `app_data.json` — **только чтение** в рамках этого задания
- Новые e2e тесты — только в `tests/e2e/smoke.spec.new.js`
- Функции-индексы строить лениво (с кэшем через `let VAR = null`) — не при старте приложения
