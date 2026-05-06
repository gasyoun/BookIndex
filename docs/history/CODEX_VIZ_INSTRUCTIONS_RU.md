# CODEX_VIZ_INSTRUCTIONS_RU.md

## Цель

Реализовать 7 визуализационных модулей (VIZ-00 — VIZ-07) в ветке `feat/viz-modules`.
Все данные берутся из уже загруженного `APP_DATA`. Никаких дополнительных сетевых запросов.

---

## Шаг 0 — Препроцессор `build-viz-cache.js` (блокирует всё остальное)

**Файл:** `scripts/viz/build-viz-cache.js`

```js
window.__vizCache = window.__vizCache || {};

function buildVizCache(appData) {
  if (window.__vizCache._built) return window.__vizCache;
  const cache = window.__vizCache;

  // 1. termFreq: {chapterIdx: {term: count}}
  cache.termFreq = {};
  const chapters = appData.chapters || [];
  const subjects = appData.subject_index || [];
  chapters.forEach((ch, ci) => {
    cache.termFreq[ci] = {};
    subjects.forEach(s => {
      const cnt = (s.page_list || []).filter(p => p >= ch.start && p <= ch.end).length;
      if (cnt) cache.termFreq[ci][s.head] = cnt;
    });
  });

  // 2. coGraph: рёбра совместных упоминаний имён по страницам
  cache.coGraph = (appData.edges || []).map(e => ({
    source: e.source, target: e.target, weight: e.weight
  }));

  // 3. langCoMatrix: матрица топ-20 языков
  const langs = [...(appData.languages || [])]
    .sort((a,b) => (b.page_list||[]).length - (a.page_list||[]).length)
    .slice(0, 20).map(l => l.head);
  const co = {};
  langs.forEach(l => { co[l] = {}; langs.forEach(l2 => co[l][l2] = 0); });
  (appData.language_edges || []).forEach(e => {
    if (co[e.source] && co[e.source][e.target] !== undefined) {
      co[e.source][e.target] = e.weight;
      co[e.target][e.source] = e.weight;
    }
  });
  cache.langCoMatrix = co;
  cache.topLangs = langs;

  // 4. termRankByLecture: {term: [rank_l0, rank_l1, ...]}
  cache.termRankByLecture = {};
  chapters.forEach((ch, ci) => {
    const freq = cache.termFreq[ci];
    const sorted = Object.keys(freq).sort((a,b) => freq[b] - freq[a]);
    sorted.forEach((term, rank) => {
      if (!cache.termRankByLecture[term]) cache.termRankByLecture[term] = new Array(chapters.length).fill(null);
      cache.termRankByLecture[term][ci] = rank + 1;
    });
  });

  // 5. geoEntities: имена с координатами (через языки)
  cache.geoEntities = (appData.names || [])
    .filter(n => n.epoch)
    .map(n => ({ id: n.head, name: n.head, epoch: n.epoch, subcategory: n.subcategory, chapters: n.chapters }));

  cache._built = true;
  return cache;
}
```

**Критерий:** полный прогон за < 3 с. Запускать в Web Worker при активации вкладки «Визуализации».

---

## Шаг 1 — VIZ-03: Лента открытий

**Файл:** `scripts/viz/discovery-timeline.js`  
**Коммит-prefix:** `feat(viz): discovery-timeline`

### Данные
- `APP_DATA.scholar.chronology` — 15 событий с `year`, `event`, `page`
- `APP_DATA.names` — поля `epoch`, `subcategory`, `head`, `chapters`

### Что реализовать

```js
function renderDiscoveryTimeline(container) {
  const cache = buildVizCache(APP_DATA);

  // Объединить события хронологии + учёных с эпохой
  const items = [];
  (APP_DATA.scholar.chronology || []).forEach(e => {
    items.push({ year: e.year, label: e.event, type: 'discovery', page: e.page });
  });
  (APP_DATA.names || []).filter(n => n.epoch && ['linguist','historical'].includes(n.subcategory))
    .forEach(n => {
      items.push({ year: n.epoch, label: n.head, type: n.subcategory, sub: (n.chapters||[]).join(', ') });
    });
  items.sort((a, b) => a.year - b.year);

  // Фильтр-кнопки по типу (discovery / linguist / historical)
  // Цвета: linguist → APP_DATA.colors.linguist (#3a6ea5)
  //        historical → APP_DATA.colors.historical (#c0392b)
  //        discovery → var(--primary)

  // DOM: .tl-wrap > .tl-line + .tl-item[]
  // Клик по карточке → navigateTo('names', 'card', item.label) если тип linguist/historical
}
```

### Критерии готовности
- [ ] Лента рендерится в порядке возрастания дат (−1500 → 2004)
- [ ] Чекбоксы фильтруют через `display:none` без перестройки DOM
- [ ] Клик на учёного → `navigateTo('names', 'card', head)`
- [ ] Пустое состояние если все фильтры сняты

---

## Шаг 2 — VIZ-04: Тепловая матрица

**Файл:** `scripts/viz/heatmap-matrix.js`  
**Коммит-prefix:** `feat(viz): heatmap-matrix`

### Данные
- `__vizCache.termFreq` — уже построен
- `APP_DATA.chapters` — 11 лекций
- `APP_DATA.subject_index` — 88 терминов

### Что реализовать

```js
function renderHeatmapMatrix(container, topN = 20) {
  const cache = buildVizCache(APP_DATA);
  const chapters = APP_DATA.chapters;
  const subjects = [...(APP_DATA.subject_index || [])]
    .sort((a,b) => (b.page_list||[]).length - (a.page_list||[]).length)
    .slice(0, topN);

  // D3 heatmap: ось Y = chapters, ось X = subjects
  // Цвет: d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal])
  // Tooltip: «Лекция N · Термин · Упоминаний: X»
  // Клик по ячейке → navigateTo('subject', 'list') с фильтром по термину
  // Кнопка «Скачать SVG»
  // Слайдер top-N: 5 / 10 / 20 / 30
}
```

### Критерии готовности
- [ ] Матрица перерисовывается при изменении top-N без мерцания
- [ ] Tooltip при наведении
- [ ] Клик по ячейке → переход к термину
- [ ] Экспорт SVG

---

## Шаг 3 — VIZ-02: Граф сосуществования

**Файл:** `scripts/viz/cooccurrence-graph.js`  
**Коммит-prefix:** `feat(viz): cooccurrence-graph`

### Данные
- `APP_DATA.edges` — 60 рёбер `{source, target, weight}`
- `APP_DATA.colors` — цвета по subcategory

### Что реализовать

```js
function renderCooccurrenceGraph(container, minWeight = 10) {
  const edges = APP_DATA.edges.filter(e => e.weight >= minWeight);
  // Cytoscape.js, layout: cose
  // Узел: цвет = APP_DATA.colors[subcategory] || '#3a6ea5'
  // Ребро: ширина = mapData(weight, 1, 100, 1, 8)
  // Двойной клик → navigateTo('names', 'card', node.id)
  // Ползунок min weight → пересобирает граф
}
```

### Критерии готовности
- [ ] Граф строится за < 2 с
- [ ] Фильтр по min-weight без мерцания
- [ ] Двойной клик → карточка имени
- [ ] Легенда по subcategory

---

## Шаг 4 — VIZ-07: Bump-chart рангов терминов

**Файл:** `scripts/viz/term-bump-chart.js`  
**Коммит-prefix:** `feat(viz): term-bump-chart`

### Данные
- `__vizCache.termRankByLecture`
- `APP_DATA.chapters` — подписи по оси X

### Что реализовать

```js
function renderTermBumpChart(container, topTerms = 15) {
  const cache = buildVizCache(APP_DATA);
  const chapters = APP_DATA.chapters;
  // Топ-15 терминов по суммарной частоте
  // D3: ось X = номер лекции, ось Y = ранг (1 вверху)
  // При наведении: линия подсвечивается, остальные opacity 0.1
  // Клик на точку → navigateTo('subject', 'list') с фильтром
}
```

---

## Шаг 5 — VIZ-06: Хорда языков

**Файл:** `scripts/viz/lang-chord.js`  
**Коммит-prefix:** `feat(viz): lang-chord`

### Данные
- `__vizCache.langCoMatrix` + `__vizCache.topLangs`
- `APP_DATA.language_edges` — 1931 ребро

### Что реализовать

```js
function renderLangChord(container, minVal = 20) {
  const { topLangs, langCoMatrix } = buildVizCache(APP_DATA);
  // d3.chord() + d3.arc() + d3.ribbon()
  // При наведении на дугу: остальные opacity 0.1
  // Ползунок порога minVal
}
```

---

## Шаг 6 — VIZ-01: Карта со слайдером по векам

**Файл:** `scripts/viz/map-timeline.js`  
**Коммит-prefix:** `feat(viz): map-timeline`

### Подготовка данных
Добавить поле `century` в каждый объект `chapters` в `app_data.json`:

```json
{ "name": "Историческая лингвистика", "start": 50, "end": 91, "century": 19 }
```

### Стек
- Leaflet.js (уже в `vendor/`)
- Нативный `<input type="range" min="-15" max="21">`

### Критерии готовности
- [ ] Маркеры перерисовываются без полной перезагрузки карты (`L.LayerGroup.clearLayers()`)
- [ ] Клик по маркеру → карточка сущности
- [ ] Мобильный: слайдер снизу

---

## Шаг 7 — VIZ-05: Sankey «Слово о полку Игореве»

**Файл:** `scripts/viz/narrative-sankey.js`  
**Коммит-prefix:** `feat(viz): narrative-sankey`

### Данные (уже есть в `app_data.json`)
APP_DATA.scholar.slovo.arguments — 6 аргументов
APP_DATA.scholar.slovo.counterarguments — 3 контраргумента
APP_DATA.scholar.slovo.verdict
APP_DATA.scholar.slovo.thesis

### Узлы Sankey
| id | label | color |
|---|---|---|
| `question` | Вопрос о подлинности | `#c0392b` |
| `birch` | Берестяные грамоты | `#3a6ea5` |
| `syntax` | Синтаксис (энклитики) | `#3a6ea5` |
| `grammar` | Двойственное число | `#3a6ea5` |
| `accent` | Акцентология | `#3a6ea5` |
| `lexicon` | Лексика | `#3a6ea5` |
| `coherence` | Согласованность | `#27ae60` |
| `verdict` | Текст подлинный | `#27ae60` |

### Критерии готовности
- [ ] Анимация появления потоков 600 мс
- [ ] Клик по узлу → detail-панель с текстом аргумента и ссылкой на страницу
- [ ] Empty state если данных нет

---

## Общий препроцессор `__vizCache`

| Ключ | Содержимое | Используется |
|---|---|---|
| `termFreq` | `{chapterIdx: {term: count}}` | VIZ-04, VIZ-07 |
| `coGraph` | `[{source, target, weight}]` | VIZ-02 |
| `langCoMatrix` | матрица N×N | VIZ-06 |
| `termRankByLecture` | `{term: [rank_l0, ...]}` | VIZ-07 |
| `geoEntities` | `[{name, epoch, lat, lng}]` | VIZ-01 |

---

## GitHub Issues

Для каждого модуля создать issue:
[v4/viz] VIZ-0N — <название>

Labels: `priority:P1` `area:analytics` `type:feature` `phase:v4`

Порядок: VIZ-00 → VIZ-04 → VIZ-02 → VIZ-03 → VIZ-07 → VIZ-06 → VIZ-01 → VIZ-05

---

## Definition of Done

Модуль завершён если:
1. Файл `scripts/viz/viz-0N-*.js` запушен в `main`
2. Корректно рендерится в Chrome, Firefox, Safari (desktop + mobile)
3. Нет `console.error`
4. Все чекбоксы раздела «Критерии готовности» выполнены
5. Проверки из `CODEX_WORKFLOW_RU.md` раздел 5 пройдены
6. Issue оформлен по `CODEX_WORKFLOW_RU.md` разделы 2–3
7. Дана ссылка: `https://gasyoun.github.io/BookIndex/aaz-index.html?v=<short_sha>#viz`
