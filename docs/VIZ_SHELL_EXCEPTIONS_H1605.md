# VIZ shell exceptions (H1605 Phase V1)

_Created: 24-07-2026 · Last updated: 30-07-2026_

Shared chrome lives in [`scripts/viz/viz-shell.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/viz-shell.js)
(`VizShell.buildModuleCard` / `wireModuleChrome` / `showStatus`). Loaded after
`viz-state.js` via `ensureVizStateLoaded()` in `v3_app.js`.

## Active catalog (shell applied)

| Module | File | Data-source chip | Export SVG | Reset behaviour |
|---|---|---|---|---|
| viz01 | `map-timeline.js` | `buildVizCache.geoEntities` | no (Leaflet map) | century → 21, stop autoplay |
| viz02 | `cooccurrence-graph.js` | `buildVizCache.coGraph` | yes | lecture=all, min=1 |
| viz03 | `discovery-timeline.js` | `scholar.chronology + names` | no (HTML timeline) | all type filters on |
| viz04 | `heatmap-matrix.js` | `subject_index × chapters` | yes | Top-N → 20 |
| viz05 | `narrative-sankey.js` | `scholar.slovo` | yes | first narrative tab |
| viz06 | `lang-chord.js` | `buildVizCache.langCoMatrix` | yes | min freq=20, clear hidden langs |
| viz07 | `term-bump-chart.js` | `termRankByLecture` | yes | top=15, clear search |
| viz08 | `research-map.js` | `scholar.* + chapters + сущности + video_catalog` · `cross_links` / `semantic_links` в режиме сущности | yes | центр=направление, направление=all, top=8, связи вкл., rel=all, круг=1 |

## Module-specific exceptions

1. **VIZ-01 map** — no SVG export; Play/Pause stays in the toolbar view slot; offline tile
   fallback uses `.viz-empty-state` over the map canvas (not a full-module empty).
2. **VIZ-03 discovery** — filters are type checkboxes only; empty state is filter-driven
   (all unchecked), not data-missing.
3. **VIZ-05 Sankey** — narrative tabs sit in the filters row; chart math is a custom
   node/link layout, not d3-sankey (unchanged by H1605).
4. **VIZ-08 исследовательская карта** (добавлен 30-07-2026, H1821) — единственный
   интегративный модуль: узел = направление исследований, агрегирующее свидетельства из
   `scholar.*`, границы глав, сущности указателя и `video_catalog`. Два режима в одном
   хосте — обзор (концентратор + 7 направлений + пунктирные мостики по общим сущностям) и
   раскрытое направление (спутники-сущности). Справа — панель `.rmap-detail` вместо
   легенды; она же несет переходы в карточки, к главам, к видео и в профильный модуль
   VIZ-01…07. Состояние в URL: `filter` = направление, `top` = число спутников.
   «Всеобщие» головы (в ≥5 направлениях или в ≥30% видео) исключены из мостиков и
   видеосвязей — иначе всё связано со всем через «русский».
   **Два центра карты** (второй добавлен тем же H1821, 30-07-2026): переключатель
   «Центр: направление / сущность». Режим сущности и есть спецификация Phase V3 из
   `docs/CLEANUP_AND_UI_ROADMAP.md` — центр на выбранной сущности, первый круг связей по
   умолчанию, второй по требованию, связи берутся из готовых индексов `cross_links`
   (типизированные) и `semantic_links` (нетипизированные), рядом — страницы, лекции/главы,
   термины глоссария и видео. Клик по узлу переносит центр (обход графа через URL), клик
   по центру открывает карточку. Состояние: `mode`, `entity`, `rel`, `depth` — четыре ключа
   добавлены в `ALLOWED_KEYS` в [`scripts/viz/viz-state.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/viz-state.js).
   Побочная находка: `.viz-toolbar label` ставит `display:inline-flex`, что перебивает
   атрибут `[hidden]`, — поля режимов не скрывались без явного `label[hidden]{display:none}`.
5. **Inactive modules** (`corpus-timeline.js`, `viz-semantic-graph.js`, `world-map.js`,
   `comparative-timeline.js`, `knowledge-web.js`, `language-tree.js`,
   `multimedia-bridge.js`) are **not** in `getVizModuleCatalog()` and were left alone —
   Phase V1 only unifies the seven active routes.

## Grammar (product-wide)

- Module header: title + data-source chip + actions (Сброс / Ссылка / SVG).
- Toolbar: filters left (`.viz-toolbar-filters`), view controls right (`.viz-toolbar-view`).
- Host states: `.viz-status-loading` / `.viz-status-empty` / `.viz-status-error`.
- Focus: `:focus-visible` ring on module tabs, action buttons, toolbar inputs.
- Overflow: `.viz-shell` / `.viz-card` max-width 100%; host may scroll horizontally for wide SVGs without growing the page.

_Dr. Mārcis Gasūns_
