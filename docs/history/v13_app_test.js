/**
 * Zalizniakiada (BookIndex) v13.0 Modular
 * Generated on: 2026-05-06T18:25:36.746Z
 * --------------------------------------------------
 */

(function() {
  "use strict";

// --- Module: core/state.js ---
/**
 * @file state.js
 * @description Core application state and constants for BookIndex v13.0
 */

// --- Constants ---
const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
const APP_DATA_SCHEMA_CURRENT = 2;

const KWIC_MAX_SNIPPETS_PER_PAGE = 24;
const KWIC_MAX_SNIPPET_LENGTH = 420;
const KWIC_MAX_ROWS = 1200;

const DEFAULT_TOTAL_PAGES = 424;
const APP_BUILD_ID = '__APP_BUILD_ID__';

const DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
  'desc', 'about', 'why', 'why_read', 'description', 
  'definition', 'main_idea', 'tagline', 'event'
]);

const LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

const HOME_DECL_FACTORY_KEY = '__bookindexHomeDeclarativeFactory';

// --- Mutable State (Global References) ---
let APP_DATA = null;
let LABELS = null;
let COLORS = null;
let EPOCH_LABELS = null;
let EPOCH_COLORS = null;
let FAMILY_COLORS = null;

// --- UI State ---
let currentTab = 'home';
let currentEntity = 'all';
let searchQuery = '';
let selectedItem = null;
let selectedItemType = null;
let rightPaneMode = 'histogram'; // 'card' or 'histogram'

let scholarPins = new Set();
let dossierMetadata = { title: '', description: '' };

let currentVizModule = 'viz03';
let currentVizQueryString = '';
let currentVizCleanup = null;
let vizCacheWarmPromise = null;
let vizScriptLoadPromises = new Map();

let trendsRangeStart = 1;
let trendsRangeEnd = 424;

// --- Shared Constants for Entity Types ---
const TAB_LABELS = {
  home: 'Обзор',
  list: 'Список',
  materials: 'Материалы',
  scholar: 'Аппарат',
  viz: 'Визуализация',
  corpus: 'Корпус'
};

const ENTITY_TYPES = {
  home: { title: 'Главная', tabs: ['home'], items: [] },
  corpus: { title: 'Библиотека', tabs: ['corpus'], items: [] },
  materials: { title: 'Материалы', tabs: ['materials'], items: [] },
  scholar: { title: 'Аппарат', tabs: ['scholar', 'viz'], items: [] },
  all: { title: 'Все связи', tabs: ['list'], items: [] },
  names: { title: 'Имена', tabs: ['list'], items: [] },
  toponyms: { title: 'Топонимы', tabs: ['list'], items: [] },
  ethnonyms: { title: 'Этнонимы', tabs: ['list'], items: [] },
  languages: { title: 'Языки', tabs: ['list'], items: [] },
  lexicon: { title: 'Лексика (А-Я)', tabs: ['list'], items: [] },
  lexicon_reverse: { title: 'Лексика (Я-А)', tabs: ['list'], items: [] },
  subject: { title: 'Предметы', tabs: ['list'], items: [] }
};

/**
 * Update global state reference (used by hydrators)
 */
function setAppData(data) {
  APP_DATA = data;
  if (data) {
    LABELS = data.labels || {};
    COLORS = data.colors || {};
    EPOCH_LABELS = data.epoch_labels || {};
    EPOCH_COLORS = data.epoch_colors || {};
    FAMILY_COLORS = data.family_colors || {};
    
    // Refresh ENTITY_TYPES counts
    Object.keys(ENTITY_TYPES).forEach(key => {
      if (data[key] && Array.isArray(data[key])) {
        ENTITY_TYPES[key].items = data[key];
      }
    });
  }
}


// --- Module: core/data.js ---
/**
 * @file data.js
 * @description Data hydration, schema migration, and corpus management
 */


const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
const APP_DATA_SCHEMA_CURRENT = 2;

function getEmbeddedAppDataText() {
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const node = document.getElementById(APP_DATA_SCRIPT_TAG_ID);
    if (node && typeof node.textContent === 'string') {
      const raw = node.textContent.trim();
      if (raw) return raw;
    }
  }
  const fallback = (typeof globalThis !== 'undefined' && typeof globalThis[APP_DATA_GLOBAL_FALLBACK_KEY] === 'string')
    ? globalThis[APP_DATA_GLOBAL_FALLBACK_KEY]
    : '';
  return String(fallback || '').trim();
}

function migrateAppDataSchema(data) {
  if (!data) return;
  // Migration logic from v3_app.js...
  data._schema_version = APP_DATA_SCHEMA_CURRENT;
}

function getCorpusRegistry() {
  if (!APP_DATA || !APP_DATA.corpus || typeof APP_DATA.corpus !== 'object') {
    return { active_book_id: 'default', books: [] };
  }
  return APP_DATA.corpus;
}

function getCorpusBooks() {
  const books = getCorpusRegistry().books;
  return Array.isArray(books) ? books.filter(book => book && typeof book.book_id === 'string') : [];
}

function getActiveBook() {
  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  return books.find(book => book.book_id === registry.active_book_id) || books[0] || { book_id: 'unknown' };
}

function getBookLabelForSearch(bookId) {
  const id = String(bookId || '').trim();
  const book = getCorpusBooks().find(item => item.book_id === id) || getActiveBook();
  return String(book.short_title || book.title || book.book_id || 'текущая книга');
}


// --- Module: utils/dom.js ---
/**
 * @file dom.js
 * @description DOM manipulation and event binding helpers
 */

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('./')) return url;
  return '#';
}

function bindActionWithKeyboard(el, callback) {
  if (!el) return;
  el.onclick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    callback(e);
  };
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      callback(e);
    }
  };
}

function announceUiMessage(msg, type = 'info') {
  if (typeof window === 'undefined') return;
  const el = document.getElementById('ui-message-toast');
  if (!el) {
    const toast = document.createElement('div');
    toast.id = 'ui-message-toast';
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: #fff; padding: 0.5rem 1.5rem;
      border-radius: 20px; z-index: 10000; font-size: 0.9rem; pointer-events: none;
      transition: opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  const toast = document.getElementById('ui-message-toast');
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}


// --- Module: utils/linguistics.js ---
/**
 * @file linguistics.js
 * @description Russian language processing and normalization
 */

function normalizeHeadForMatch(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/е\u0308/g, 'е')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareHeadsRu(a, b) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true });
}

function clampPageInBook(page, totalPages = 424) {
  const p = parseInt(String(page || '1'), 10);
  if (!Number.isFinite(p)) return 1;
  return Math.max(1, Math.min(totalPages, p));
}

function normalizePageRangeInBook(start, end, min = 1, max = 424) {
  let s = parseInt(String(start || min), 10);
  let e = parseInt(String(end || max), 10);
  if (!Number.isFinite(s)) s = min;
  if (!Number.isFinite(e)) e = max;
  s = Math.max(min, Math.min(max, s));
  e = Math.max(min, Math.min(max, e));
  if (s > e) [s, e] = [e, s];
  return { start: s, end: e };
}


// --- Module: utils/export.js ---
/**
 * @file export.js
 * @description Utilities for data export (Markdown, BibTeX, Text)
 */



function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBibtexFile(filename, entries) {
  const text = entries.join('\n\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportWholeSiteMarkdown() {
  const stats = APP_DATA.book_stats || {};
  const activeBook = getActiveBook();
  const parts = [];
  
  parts.push('# Zalizniakiada Export');
  parts.push('');
  parts.push(`Book: ${activeBook.title || activeBook.book_id}`);
  parts.push('');
  parts.push('## Statistics');
  parts.push(`- Pages: ${stats.total_pages || 0}`);
  parts.push(`- Lectures: ${stats.lectures || 0}`);
  
  // Logic for iterating through all entities and generating markdown
  // (Will be expanded in the final bundle)
  
  downloadTextFile('Zalizniakiada-Export.md', parts.join('\n'));
}

function lectureToMarkdown(lecture, index) {
  const title = index === 0 ? 'Preface' : `Lecture ${index}`;
  return `### ${title}: ${lecture.name}\n\n${lecture.main_idea}\n`;
}


// --- Module: core/search.js ---
/**
 * @file search.js
 * @description Search orchestration and Web Worker management
 */


let globalSearchWorker = null;
let globalSearchWorkerReady = false;

function initSearchWorker() {
  if (typeof Worker === 'undefined') return;
  try {
    globalSearchWorker = new Worker('./scripts/search-worker.js');
    globalSearchWorker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        globalSearchWorkerReady = true;
        console.log('[SearchWorker] Ready');
      }
      if (e.data.type === 'results') {
        // This will call a handler in the main app or a UI module
        if (typeof window.handleWorkerSearchResults === 'function') {
          window.handleWorkerSearchResults(e.data.results, e.data.query);
        }
      }
    };
    const records = buildGlobalSearchFuseRecords();
    globalSearchWorker.postMessage({ type: 'init', data: records });
  } catch(e) {
    console.error('[SearchWorker] Init failed', e);
  }
}

function buildGlobalSearchFuseRecords() {
  const records = [];
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index'];
  for (const cat of categories) {
    const items = Array.isArray(APP_DATA[cat]) ? APP_DATA[cat] : [];
    for (const it of items) {
      records.push({
        head: it.head || it.name,
        type: cat === 'subject_index' ? 'subject' : cat,
        desc: it.description || it.about || '',
        pageCount: (it.page_list || []).length
      });
    }
  }
  return records;
}

function performGlobalSearch(query) {
  if (globalSearchWorker && globalSearchWorkerReady) {
    globalSearchWorker.postMessage({ type: 'search', query });
  }
}


// --- Module: core/router.js ---
/**
 * @file router.js
 * @description Routing and hash management for BookIndex v13.0
 */


  currentTab, 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  rightPaneMode,
  searchQuery
} from './state.js';

function parseHashRoute(hash) {
  if (!hash || typeof hash !== 'string') return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'v4') return null;
  return { parts: parts.slice(1), query };
}

function buildHashFromState() {
  const parts = ['v4', currentEntity, currentTab];
  if (selectedItem && selectedItemType) {
    parts.push('item', selectedItemType, encodeURIComponent(selectedItem));
  } else if (searchQuery && currentTab === 'list') {
    parts.push('q', encodeURIComponent(searchQuery));
  }
  return '#' + parts.join('/');
}

function syncNavigationState() {
  // Logic to sync internal state to window.location.hash
  if (typeof window === 'undefined') return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

function applyHash(hash) {
  const parsed = parseHashRoute(hash);
  if (!parsed) return false;
  // Implementation of state application...
  // This will be expanded as we modularize more components.
  return true;
}


// --- Module: renderers/scholar.js ---
/**
 * @file scholar.js
 * @description Renderers for the Professional Apparatus (Scholar) section
 */




  APP_DATA, 
  currentVizModule, 
  trendsRangeStart, 
  trendsRangeEnd,
  currentVizCleanup,
  currentVizQueryString
} from '../core/state.js';

// --- External References (Globally available or to be exported) ---
// These will be resolved once the full modular structure is built.
/* global buildItemHash, navigateToItem, buildVizHash, buildCorpusVizHash, 
   getActiveBook, getBookLabelForSearch, getVizRegistry, ensureVizStateLoaded, 
   ensureVizModuleLoaded, warmupVizCacheInWorker, cleanupActiveVizModule,
   syncNavigationHashOnly, buildListSearchHash, getTotalBookPages,
   renderEntitySwitcher, renderTabs, renderContent, syncNavigationState,
   downloadTextFile, downloadCsvFile, buildPageTrendsLink, persistViewState */

function getVizModuleCatalog() {
  const registry = getVizRegistry();
  return [
    { id: 'viz03', title: 'VIZ-03 · Лента открытий', renderKey: 'renderDiscoveryTimeline', render: registry.renderDiscoveryTimeline },
    { id: 'viz04', title: 'VIZ-04 · Тепловая матрица', renderKey: 'renderHeatmapMatrix', render: registry.renderHeatmapMatrix },
    { id: 'viz02', title: 'VIZ-02 · Граф сосуществования', renderKey: 'renderCooccurrenceGraph', render: registry.renderCooccurrenceGraph },
    { id: 'viz07', title: 'VIZ-07 · Bump-chart рангов', renderKey: 'renderTermBumpChart', render: registry.renderTermBumpChart },
    { id: 'viz06', title: 'VIZ-06 · Хорда языков', renderKey: 'renderLangChord', render: registry.renderLangChord },
    { id: 'viz01', title: 'VIZ-01 · Карта по векам', renderKey: 'renderMapTimeline', render: registry.renderMapTimeline },
    { id: 'viz05', title: 'VIZ-05 · Sankey «Слово»', renderKey: 'renderNarrativeSankey', render: registry.renderNarrativeSankey },
    { id: 'viz08', title: 'VIZ-08 · Хронология лекций', renderKey: 'renderCorpusTimeline', render: registry.renderCorpusTimeline },
    { id: 'viz09', title: 'VIZ-09 · Семантическая сеть', renderKey: 'renderSemanticGraph', render: registry.renderSemanticGraph },
    { id: 'viz10', title: 'VIZ-10 · Сравнительная хронология', renderKey: 'renderComparativeTimeline', render: registry.renderComparativeTimeline },
    { id: 'viz11', title: 'VIZ-11 · Мировая карта', renderKey: 'renderWorldMap', render: registry.renderWorldMap },
    { id: 'viz12', title: 'VIZ-12 · Сеть знаний', renderKey: 'renderKnowledgeWeb', render: registry.renderKnowledgeWeb },
    { id: 'viz13', title: 'VIZ-13 · Древо языков', renderKey: 'renderLanguageTree', render: registry.renderLanguageTree },
    { id: 'viz14', title: 'VIZ-14 · Мультимедийный мост', renderKey: 'renderMultimediaBridge', render: registry.renderMultimediaBridge },
  ];
}

function setVizHostStatus(host, message, className = 'viz-loading') {
  if (!host) return;
  host.textContent = '';
  const status = document.createElement('div');
  status.className = String(className || 'viz-loading');
  status.textContent = String(message || '');
  host.appendChild(status);
}

function mountVizModule(host, moduleDef) {
  if (!host || !moduleDef) return;
  setVizHostStatus(host, 'Загрузка модуля…');
  ensureVizStateLoaded()
    .then(() => ensureVizModuleLoaded(moduleDef.id))
    .catch(() => null)
    .then(() => warmupVizCacheInWorker().catch(() => null))
    .then(() => {
      const registry = getVizRegistry();
      const renderFn = registry[moduleDef.renderKey] || moduleDef.render;
      if (typeof renderFn !== 'function') {
        setVizHostStatus(host, 'Модуль не подключён. Проверьте scripts/viz/*.js.', 'viz-card');
        return;
      }
      try {
        renderFn(host);
        window.currentVizCleanup = typeof host.__vizCleanup === 'function' ? host.__vizCleanup : null;
      } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        setVizHostStatus(host, `Ошибка рендера: ${msg}`, 'viz-card');
      }
    })
    .catch((e) => {
      const msg = String(e && e.message ? e.message : e);
      setVizHostStatus(host, `Ошибка загрузки модуля: ${msg}`, 'viz-card');
    });
}

function renderVizPanel(container) {
  cleanupActiveVizModule();
  const catalog = getVizModuleCatalog();
  const validModuleIds = new Set(catalog.map((m) => m.id));
  if (!validModuleIds.has(currentVizModule)) {
    // Note: State update might need a setter if using strict modules
    // but here we are in the middle of a refactoring.
  }
  const activeBook = getActiveBook();
  const activeBookLabel = activeBook.short_title || activeBook.title || activeBook.book_id || 'текущая книга';

  container.innerHTML = `<div class="panel active viz-shell">
    <div class="viz-header-row">
      <h2 class="viz-title">Визуализации</h2>
      <div class="viz-header-actions">
        <span class="viz-source-chip">${escapeHtml(activeBookLabel)}</span>
        <a class="related-link viz-canonical-link" href="${escapeHtml(buildVizHash(currentVizModule))}">канонический hash</a>
        <a class="related-link viz-corpus-link" href="${escapeHtml(buildCorpusVizHash(currentVizModule))}">corpus hash</a>
      </div>
    </div>
    <div class="viz-module-tabs" id="viz-module-tabs"></div>
    <div id="viz-module-host" class="viz-module-host"><div class="viz-loading">Подготовка кэша…</div></div>
  </div>`;

  const tabs = container.querySelector('#viz-module-tabs');
  const host = container.querySelector('#viz-module-host');
  if (!tabs || !host) return;

  for (const item of catalog) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'viz-module-btn' + (item.id === currentVizModule ? ' active' : '');
    btn.dataset.module = item.id;
    btn.textContent = item.title;
    bindActionWithKeyboard(btn, () => {
      window.currentVizModule = item.id;
      window.currentVizQueryString = '';
      renderVizPanel(container);
      syncNavigationHashOnly();
    });
    tabs.appendChild(btn);
  }

  mountVizModule(host, catalog.find((m) => m.id === currentVizModule) || catalog[0]);
}

// --- Chronology Helpers ---
const chronologyMap = [
  { needle: 'бопп', type: 'names', heads: ['Бопп Фр.'] },
  { needle: 'раск', type: 'names', heads: ['Раск Р. К.'] },
  { needle: 'гримм', type: 'names', heads: ['Гримм Я.'] },
  { needle: 'вернер', type: 'names', heads: ['Вернер К.'] },
  { needle: 'вакернагель', type: 'names', heads: ['Вакернагель Я.'] },
  { needle: 'шампольон', type: 'names', heads: ['Шампольон Ф.'] },
  { needle: 'вентрис', type: 'names', heads: ['Вентрис М.'] },
  { needle: 'зализняк', type: 'names', heads: ['Зализняк А. А.'] },
  { needle: 'берестян', type: 'toponyms', heads: ['Новгород'] },
  { needle: 'санскрит', type: 'languages', heads: ['санскрит'] },
  { needle: 'древнеперсид', type: 'languages', heads: ['древнеперсидский'] },
  { needle: 'линейное письмо', type: 'languages', heads: ['древнегреческий'] },
];

function romanToInt(roman) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let prev = 0;
  let sum = 0;
  const raw = String(roman || '').toUpperCase();
  for (let i = raw.length - 1; i >= 0; i--) {
    const cur = map[raw[i]] || 0;
    if (cur < prev) sum -= cur;
    else sum += cur;
    prev = cur;
  }
  return sum;
}

function parseYearSpan(value) {
  if (Number.isFinite(value)) return { from: value, to: value, label: String(value) };
  const raw = String(value || '').trim();
  if (!raw) return { from: 0, to: 0, label: '—' };
  if (/^\d{3,4}$/.test(raw)) {
    const y = parseInt(raw, 10);
    return { from: y, to: y, label: raw };
  }
  const range = raw.match(/(\d{3,4})\s*[–-]\s*(\d{2,4})/);
  if (range) {
    const left = parseInt(range[1], 10);
    let right = parseInt(range[2], 10);
    if (range[2].length === 2) {
      const prefix = Math.floor(left / 100) * 100;
      right = prefix + right;
    }
    return { from: Math.min(left, right), to: Math.max(left, right), label: raw };
  }
  const century = raw.match(/([IVXLCDM]+)\s*в/i);
  if (century) {
    const cent = romanToInt(century[1]);
    const bce = /до\s*н\.?\s*э\.?/i.test(raw);
    if (cent > 0) {
      if (bce) return { from: -cent * 100 + 1, to: -(cent - 1) * 100, label: raw };
      return { from: (cent - 1) * 100 + 1, to: cent * 100, label: raw };
    }
  }
  return { from: 0, to: 0, label: raw };
}

function renderScholarChronologyPanel(container) {
  const scholar = APP_DATA.scholar || {};
  const rawEvents = Array.isArray(scholar.chronology) ? scholar.chronology : [];
  const typeLabels = {
    all: 'Все типы',
    discovery: 'Открытия и находки',
    publication: 'Публикации',
    decipherment: 'Расшифровки',
    law: 'Законы и теории',
    milestone: 'Ключевые вехи',
  };

  // ... (Remainder of renderScholarChronologyPanel body from v3_app.js)
  // Note: Due to size, I'll extract it in the next step or keep it condensed.
  container.innerHTML = `<div class="panel active chronology-panel">...Chronology...</div>`;
}

function renderPageTrendsPanel(container) {
  // ... (Logic from v3_app.js)
  container.innerHTML = `<div class="panel active page-trends-panel">...Trends...</div>`;
}


// --- Module: renderers/lists.js ---
/**
 * @file lists.js
 * @description Renderers for navigation switchers and entity lists
 */


  APP_DATA, 
  currentEntity, 
  currentTab,
  searchQuery,
  MAX_LIST_QUERY_LENGTH,
  LABELS,
  ENTITY_TYPES,
  TAB_LABELS
} from '../core/state.js';

  escapeHtml, 
  bindActionWithKeyboard,
  safeSetAttr 
} from '../utils/dom.js';

  normalizeHeadForMatch, 
  clampUiInput, 
  compareHeadsRu 
} from '../utils/linguistics.js';

// --- External References ---
/* global cleanupActiveVizModule, setMobileSheetOpen, renderHomePanel, 
   renderCorpusSourcesPanel, renderLecturesPanel, renderScholarPanel, 
   renderListPanel, renderCardsPanel, syncNavigationState, selectListItem,
   renderList, renderRightContent, getVisibleItemsForCurrentEntity,
   persistViewState, invalidateVisibleItemsCache, navigateToItem,
   getIndexedItem, exportCurrentSectionMarkdown, closeMobileSheet,
   getCategoryColorClass, activeFilters, onlyDiscussed, onlyQuestionCandidates,
   sortMostFrequentFirst, getItemFrequencyScore, compareItemsByHead,
   renderAccentSafe */

function renderEntitySwitcher() {
  const container = document.getElementById('entity-switcher');
  if (!container) return;
  container.innerHTML = '';
  
  const order = ['corpus', 'materials', 'scholar', 'all', 'subject', 'names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse'];
  order.forEach(key => {
    const conf = ENTITY_TYPES[key];
    if (!conf) return;
    const btn = document.createElement('button');
    btn.className = 'entity-btn' + (key === currentEntity ? ' active' : '');
    btn.dataset.entity = key;
    btn.textContent = conf.title;
    container.appendChild(btn);
  });
}

function renderTabs() {
  const container = document.getElementById('tabs');
  if (!container) return;
  container.innerHTML = '';
  
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !conf.tabs) return;
  
  conf.tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (tab === currentTab ? ' active' : '');
    btn.dataset.tab = tab;
    btn.textContent = TAB_LABELS[tab] || tab;
    container.appendChild(btn);
  });
}

function renderListPanel(container) {
  container.innerHTML = `
    <div class="panel active">
      <div class="list-card-layout">
        <div class="left-pane">
          <div class="filters">
            <input type="text" id="search-input" value="${escapeHtml(searchQuery)}" placeholder="Поиск...">
          </div>
          <div class="name-list" id="name-list"></div>
        </div>
        <div class="right-pane">
          <div id="right-pane-content"></div>
        </div>
      </div>
    </div>
  `;
  
  const searchInput = container.querySelector('#search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      // Search logic...
    };
  }
}


// --- Module: renderers/cards.js ---
/**
 * @file cards.js
 * @description Renderers for individual entity cards and details
 */


  APP_DATA, 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  scholarPins,
  LABELS,
  COLORS,
  EPOCH_LABELS,
  MAX_LIST_QUERY_LENGTH
} from '../core/state.js';

  escapeHtml, 
  safeUrl, 
  safeImageUrl, 
  bindActionWithKeyboard,
  announceUiMessage 
} from '../utils/dom.js';

  sortUniquePages, 
  clampUiInput, 
  clampPageInBook 
} from '../utils/linguistics.js';

  getActiveBook, 
  getBookLabelForSearch 
} from '../core/data.js';

// --- External References ---
/* global findItemByHeadAndType, getRightContentHost, getFirstContextQuote,
   buildCardPageLinksHtml, countItemContexts, buildLecturePageBreakdownHtml,
   renderAccentSafe, togglePin, navigateCardByDelta, exportCurrentCardMarkdown,
   copyCurrentUrl, openReadingNowPage, openKwicTerm, buildCardSourceBibEntry,
   slugify, downloadBibtexFile, openGlossaryTerm, openLecturePage,
   findLectureIndexByName, buildLecturePageHash, findRelatedGlossaryTerms,
   buildGlossaryTermHash, getSubjectByLexiconIndex, buildItemHash,
   openVideoPlayer, seekVideo, findEntityTypeByHead, collectNameRelationLinks,
   getCardNavigationState, renderList, renderRightContent, syncNavigationState,
   switchTab, getCardNote, saveCardNote, renderContextTextWithLinks,
   wireSafeImageFallback, bindNavigateLinks, pluralPages */

function renderCardInRight() {
  const right = typeof getRightContentHost === 'function' ? getRightContentHost() : document.getElementById('right-pane-content');
  if (!right) return;
  
  const it = typeof findItemByHeadAndType === 'function' 
    ? findItemByHeadAndType(selectedItem, selectedItemType)
    : (APP_DATA[selectedItemType] || []).find(x => x.head === selectedItem);

  if (!it) {
    right.innerHTML = '<div class="card"><div class="card-missing-message">Элемент не найден</div></div>';
    return;
  }

  const photo = it.img ? `<img class="card-photo" src="${escapeHtml(safeImageUrl(it.img))}" alt="">` : '';
  const wikiLink = it.wiki ? `<a class="wiki-link" href="${escapeHtml(safeUrl(it.wiki))}" target="_blank" rel="noopener noreferrer">Статья в Википедии →</a>` : '';
  const eType = it._entityType || currentEntity;
  const editorial = (it.editorial_flags && typeof it.editorial_flags === 'object') ? it.editorial_flags : {};
  
  let category = '';
  if (eType === 'names') category = LABELS[it.subcategory] || 'Имя';
  else if (eType === 'toponyms') category = 'Топоним';
  else if (eType === 'languages') category = 'Язык';
  else category = LABELS[eType] || eType;

  const itemBookId = String(it.book_id || it.bookId || getActiveBook().book_id || '');
  const itemBookLabel = getBookLabelForSearch(itemBookId);
  const allPages = sortUniquePages(it.page_list || []);
  
  let html = `
    <div class="card">
      <div class="card-header">
        ${photo}
        <div class="card-title-block">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h2>${escapeHtml(it.head)}</h2>
            <button id="card-pin-btn" class="pin-btn${scholarPins.has(`${eType}:${it.head}`) ? ' active' : ''}" 
                    onclick="togglePin('${escapeHtml(it.head)}', '${eType}')">📌</button>
          </div>
          <div class="category">${escapeHtml(category)}</div>
          <div class="card-meta-chips">
            <span class="card-book-chip">${escapeHtml(itemBookLabel)}</span>
          </div>
          ${wikiLink}
        </div>
      </div>
      <div class="pages-info">
        <strong>Упоминается на ${allPages.length} страницах:</strong>
        <span class="pages-links">${allPages.join(', ')}</span>
      </div>
      <div id="card-dynamic-content"></div>
    </div>
  `;
  
  right.innerHTML = html;
  
  // Wire up actions
  const pinBtn = right.querySelector('#card-pin-btn');
  if (pinBtn) {
    pinBtn.onclick = () => {
      if (typeof togglePin === 'function') togglePin(it.head, eType);
    };
  }
}

function renderCardsPanel(container) {
  const items = (APP_DATA[currentEntity] || []);
  container.innerHTML = '<div class="panel active"><div class="cards-grid" id="cards-grid"></div></div>';
  const grid = container.querySelector('#cards-grid');
  
  items.slice(0, 100).forEach(it => {
    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <div class="mc-head">${escapeHtml(it.head)}</div>
      <div class="mc-pages">стр. ${it.page_list ? it.page_list[0] : '—'}</div>
    `;
    card.onclick = () => {
      // Navigation logic
    };
    grid.appendChild(card);
  });
}


// --- Module: renderers/home.js ---
/**
 * @file home.js
 * @description Renderers for the landing page and welcome dashboards
 */




// --- External References ---
/* global buildHomeHowToGuideHtml, getTotalBookPages, renderTextWithPageLinks,
   loadRecentItems, buildItemHash, findLectureIndexByName, openLecturePage,
   navigateToItem, renderEntitySwitcher, renderTabs, renderContent,
   syncNavigationState, exportWholeSiteMarkdown, HOME_DECL_FACTORY_KEY,
   syncNavigationHashOnly, bindNavigateLinks */

function renderHomePanel(container) {
  const stats = APP_DATA.book_stats || {};
  const routes = APP_DATA.routes || [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const totalPages = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
  
  let html = `<div class="panel active home-panel"><div class="home-panel-inner">`;

  // Stats Hero
  html += `<div class="home-stats-hero">
    <div class="home-stats-head">
      <h2 class="home-stats-title">Книга в цифрах</h2>
      <button id="export-site-md" class="home-export-btn">Экспорт всего BookIndex в Markdown</button>
    </div>
    <div class="home-stats-subtitle">Что внутри ${escapeHtml(String(totalPages))} страниц лекций А. А. Зализняка</div>
    <div id="home-stats-grid" class="home-stats-grid">`;

  const statsList = [
    [String(totalPages), 'страницы'],
    [stats.lectures || '10', 'лекций'],
    [stats.names || '0', 'имён'],
    [stats.languages || '0', 'языков'],
    [stats.toponyms || '0', 'топонимов'],
    [stats.lexicon ? stats.lexicon.toLocaleString('ru') : '0', 'лексем'],
  ];

  for (const [num, label] of statsList) {
    html += `<div class="home-stat-cell">
      <div class="home-stat-num">${num}</div>
      <div class="home-stat-label">${label}</div>
    </div>`;
  }
  html += '</div></div>';

  // Routes
  html += `<h2 class="home-routes-title">Выберите свой путь по книге</h2>
    <div class="home-routes-grid">`;
  for (const r of routes) {
    html += `<div class="home-route-card">
      <div class="home-route-head">
        <div class="home-route-title">${escapeHtml(r.title)}</div>
        <div class="home-route-icon">${safeIcon(r.icon)}</div>
      </div>
      <div class="home-route-desc">${escapeHtml(r.desc)}</div>
      <div class="home-route-links">`;
    for (const e of r.entities || []) {
      html += `<a class="route-link home-route-link" data-type="${escapeHtml(e.type)}" data-head="${escapeHtml(e.head)}" href="${escapeHtml(buildItemHash(e.type, e.head))}">${escapeHtml(e.head)}</a>`;
    }
    html += '</div></div>';
  }
  html += '</div>';

  html += '</div></div>';
  container.innerHTML = html;
  
  if (typeof bindNavigateLinks === 'function') {
    bindNavigateLinks(container, '.route-link', 'all');
  }
  
  const exportBtn = document.getElementById('export-site-md');
  if (exportBtn && typeof exportWholeSiteMarkdown === 'function') {
    exportBtn.onclick = () => exportWholeSiteMarkdown();
  }
}

function renderHomePanelDeclarative(container) {
  // Logic for Alpine.js based home page
  // (Will be implemented in the bundle or as a separate module if needed)
}


// --- Module: renderers/materials.js ---
/**
 * @file materials.js
 * @description Renderers for the core book materials (Lectures, Glossary, Reading)
 */


  APP_DATA, 
  currentTab, 
  currentEntity, 
  currentLecture, 
  currentGlossaryTerm,
  trendsRangeStart,
  trendsRangeEnd 
} from '../core/state.js';


// --- External References ---
/* global getTotalBookPages, wireReadingNowWidget, openLecturePage, 
   buildLectureTermHash, openLectureTerm, openGlossaryTerm, buildItemHash,
   buildLecturePageHash, switchTab, collectFurtherReadingBibEntries,
   downloadBibtexFile, announceUiMessage, persistViewState, getItemsForChapter,
   compareHeadsRu, buildReadingNowHash, saveReadingPage, syncNavigationState,
   renderEntitySwitcher, renderTabs, renderContent, navigateToItem */

function renderLecturesPanel(container) {
  const lectures = APP_DATA.lectures || [];
  const totalPages = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
  
  let html = '<div class="panel active lectures-panel"><div class="lectures-inner">';
  html += '<h2 class="lectures-title">Все лекции книги — за пять минут</h2>';
  html += '<div class="lectures-intro">Краткие резюме лекций. Нажмите карточку для подробностей.</div>';
  
  // Reading Now Widget
  html += `<div class="reading-now-box">
    <div class="reading-now-title">Режим «Читаю сейчас»</div>
    <div class="reading-now-controls">
      <button id="reading-page-prev" class="reading-now-btn">←</button>
      <input id="reading-page-input" class="reading-now-input" type="number" min="1" max="${totalPages}" value="1" />
      <button id="reading-page-next" class="reading-now-btn">→</button>
      <button id="reading-page-go" class="reading-now-btn">Показать</button>
    </div>
    <div id="reading-now-results" class="reading-now-results"></div>
  </div>`;

  html += '<div id="lectures-grid" class="lectures-grid">';
  lectures.forEach((l, i) => {
    html += `<div class="lecture-card" data-idx="${i}">
      <div class="lecture-card-meta">Лекция ${i} · стр. ${escapeHtml(l.pages)}</div>
      <div class="lecture-card-title">${escapeHtml(l.name)}</div>
      <div class="lecture-card-idea">${escapeHtml(l.main_idea)}</div>
    </div>`;
  });
  html += '</div></div></div>';
  
  container.innerHTML = html;
  
  if (typeof wireReadingNowWidget === 'function') {
    wireReadingNowWidget(container, totalPages);
  }
  
  container.querySelectorAll('.lecture-card').forEach(card => {
    card.onclick = () => {
      if (typeof openLecturePage === 'function') {
        openLecturePage(parseInt(card.dataset.idx || '0', 10));
      }
    };
  });
}

function renderGlossaryPanel(container) {
  const glossary = APP_DATA.glossary || [];
  let html = '<div class="panel active glossary-panel"><div class="glossary-inner">';
  html += '<h2 class="glossary-title">Глоссарий</h2>';
  html += '<div id="glossary-list" class="glossary-list">';
  glossary.forEach(g => {
    html += `<div class="glossary-entry" data-term="${escapeHtml(g.term.toLowerCase())}">
      <div class="glossary-entry-head">${escapeHtml(g.term)}</div>
      <div class="glossary-definition">${escapeHtml(g.definition)}</div>
    </div>`;
  });
  html += '</div></div></div>';
  container.innerHTML = html;
}


// --- Module: renderers/multimedia.js ---
/**
 * @file multimedia.js
 * @description Renderers for the Video Archive and YouTube player integration
 */



let ytPlayer = null;

function openVideoPlayer(videoId) {
  const v = (APP_DATA.video_catalog || []).find(x => x.id === videoId);
  if (!v) return;
  
  const modal = document.getElementById('video-player-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  
  const ytId = v.url.split('v=')[1];
  const tcList = document.getElementById('video-modal-tc-list');
  if (tcList) {
    tcList.innerHTML = v.timecodes.map(tc => {
      const minutes = Math.floor(tc.time / 60);
      const seconds = String(tc.time % 60).padStart(2, '0');
      return `<div class="video-modal-tc-item" onclick="seekVideo(${tc.time})">
        <div style="font-weight:700; color:#80deea;">${minutes}:${seconds}</div>
        <div style="font-size:0.85rem; color:#ccc;">${escapeHtml(tc.label)}</div>
      </div>`;
    }).join('');
  }

  if (typeof YT !== 'undefined' && YT.Player) {
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById(ytId);
    } else {
      ytPlayer = new YT.Player('yt-player-container', {
        height: '100%',
        width: '100%',
        videoId: ytId,
        playerVars: { 'autoplay': 1, 'modestbranding': 1 }
      });
    }
  } else {
    const container = document.getElementById('yt-player-container');
    if (container) {
      container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
    }
  }
}

function seekVideo(seconds) {
  if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(seconds, true);
  }
}

function renderVideoArchivePanel(container) {
  const videos = APP_DATA.video_catalog || [];
  let html = `<div class="panel active video-panel"><div class="video-inner">
    <h2 class="video-title">Видеоархив лекций А. А. Зализняка</h2>
    <div class="video-grid">`;
  
  videos.forEach(v => {
    const ytId = v.url.split('v=')[1];
    html += `
      <div class="video-card" onclick="openVideoPlayer('${v.id}')">
        <div class="video-thumb" style="background-image:url(https://img.youtube.com/vi/${ytId}/mqdefault.jpg);"></div>
        <div class="video-info">
          <div class="video-title">${escapeHtml(v.title)}</div>
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}


// --- Module: renderers/viz-panels.js ---
/**
 * @file viz-panels.js
 * @description Renderers for complex visualizations and linguistic dashboards (KWIC, Heatmap, Maps)
 */


  APP_DATA, 
  currentTab, 
  currentEntity, 
  currentVizModule,
  currentKwicQuery,
  currentKwicSource,
  currentKwicSort,
  currentKwicPageStart,
  currentKwicPageEnd,
  MAX_LIST_QUERY_LENGTH,
  KWIC_MAX_ROWS
} from '../core/state.js';

  escapeHtml, 
  safeUrl, 
  safeImageUrl, 
  bindActionWithKeyboard 
} from '../utils/dom.js';

  getBookLabelForSearch 
} from '../core/data.js';

  normalizeHeadForMatch, 
  compareHeadsRu, 
  clampUiInput, 
  normalizePageRangeInBook 
} from '../utils/linguistics.js';

// --- External References ---
/* global getTotalBookPages, normalizeKwicSource, normalizeKwicSort, 
   buildReadingNowHash, collectLexiconContextBundles, buildKwicContextRow,
   collectMatchingGlossaryTerms, navigateToItem, openGlossaryTerm, openReadingNowPage,
   persistViewState, getVizModuleCatalog, cleanupActiveVizModule,
   buildVizHash, buildCorpusVizHash, mountVizModule, syncNavigationHashOnly,
   buildItemHash, wireSafeImageFallback, clampPageInBook */

function collectLexiconKwicRows(query, pageStart, pageEnd) {
  const q = clampUiInput(query, MAX_LIST_QUERY_LENGTH);
  const qNorm = normalizeHeadForMatch(q);
  if (qNorm.length < 2) return [];
  const rows = [];
  rows._truncated = false;
  
  // Logic from v3_app.js
  const bundles = typeof collectLexiconContextBundles === 'function' ? collectLexiconContextBundles(pageStart, pageEnd) : [];
  for (const bundle of bundles) {
    for (const entry of bundle.entries) {
      for (const raw of entry.snippets) {
        const snippetNorm = normalizeHeadForMatch(raw);
        if (!snippetNorm.includes(qNorm)) continue;
        const row = typeof buildKwicContextRow === 'function' ? buildKwicContextRow({
          source: 'lexicon',
          term: bundle.itemHead,
          itemType: 'lexicon',
          itemHead: bundle.itemHead,
          page: entry.page,
          snippet: raw,
          query: q,
        }) : null;
        if (row) rows.push(row);
        if (rows.length >= KWIC_MAX_ROWS) {
          rows._truncated = true;
          return rows;
        }
      }
    }
  }
  return rows;
}

function renderKwicPanel(container) {
  const totalPages = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
  
  container.innerHTML = `<div class="panel active kwic-panel">
    <div class="kwic-inner">
      <h2 class="kwic-title">KWIC-конкорданс</h2>
      <div class="kwic-controls">
        <label class="kwic-field">Запрос
          <input id="kwic-query" type="text" value="${escapeHtml(currentKwicQuery || '')}" class="kwic-input">
        </label>
        <button id="kwic-run" type="button" class="kwic-run-btn">Показать</button>
      </div>
      <div id="kwic-results" class="kwic-results"></div>
    </div>
  </div>`;
  
  const resultsEl = container.querySelector('#kwic-results');
  const runBtn = container.querySelector('#kwic-run');
  
  const renderRows = () => {
    const query = container.querySelector('#kwic-query').value;
    const rows = collectLexiconKwicRows(query, currentKwicPageStart, currentKwicPageEnd);
    resultsEl.innerHTML = rows.map(r => `
      <div class="kwic-row">
        <div class="kwic-row-head"><strong>${escapeHtml(r.itemHead)}</strong> (стр. ${r.page})</div>
        <div class="kwic-context">${escapeHtml(r.leftText)}<mark>${escapeHtml(r.keyText)}</mark>${escapeHtml(r.rightText)}</div>
      </div>
    `).join('');
  };
  
  if (runBtn) runBtn.onclick = renderRows;
}


})();
