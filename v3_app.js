/**
 * BookIndex (Zalizniakiada) v1.0.0
 * --------------------------------------------------
 * Modular architecture bundle.
 * Generated on: 2026-05-16T19:44:19.683Z
 */

(function() {
  "use strict";

// --- Module: core/state.js ---
/**
 * @file state.js
 * @description Core application state and constants for BookIndex v13.0
 */

// --- Constants ---
var APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
var APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
var APP_DATA_SCHEMA_CURRENT = 2;
var HASH_ROUTE_PREFIX = 'v4';

var KWIC_MAX_SNIPPETS_PER_PAGE = 24;
var KWIC_MAX_SNIPPET_LENGTH = 420;
var KWIC_MAX_ROWS = 1200;

var DEFAULT_TOTAL_PAGES = 424;
var APP_BUILD_ID = '__APP_BUILD_ID__';
var MAX_LIST_QUERY_LENGTH = 80;

var DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
  'desc', 'about', 'why', 'why_read', 'description', 
  'definition', 'main_idea', 'tagline', 'event'
]);

var LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

var HOME_DECL_FACTORY_KEY = '__bookindexHomeDeclarativeFactory';

var AGGREGATE_CACHE = new Map([
  ['histogram', new Map()],
  ['heatmap', new Map()],
  ['graph-names', new Map()],
  ['graph-families', new Map()]
]);

function getDataSignature() {
  if (!APP_DATA) return 'none';
  return APP_DATA.signature || 'default';
}

function getCachedAggregate(kind, key, computeFn) {
  const c = AGGREGATE_CACHE.get(kind);
  if (!c) return computeFn();
  if (c.has(key)) return c.get(key);
  const res = computeFn();
  c.set(key, res);
  return res;
}

// --- Graph State ---
var nameGraphMinEdgeWeight = 1.0;
var nameGraphRenderToken = 0;
var familiesGraphRenderToken = 0;
var graphStrongOnly = false;

// --- KWIC State ---
var currentKwicQuery = '';
var currentKwicSource = 'lexicon';
var currentKwicSort = 'left';
var currentKwicPageStart = 1;
var currentKwicPageEnd = 424;
var pendingKwicTerm = '';

// --- Mutable State (Global References) ---
var APP_DATA = null;
var LABELS = null;
var COLORS = null;
var EPOCH_LABELS = null;
var EPOCH_COLORS = null;
var FAMILY_COLORS = null;

// --- Lecture Compare State ---
var lectureCompareA = 0;
var lectureCompareB = 1;
var currentLecture = 0;

// --- UI State ---
var currentTab = 'home';
var currentEntity = 'all';
var searchQuery = '';
var selectedItem = null;
var selectedItemType = null;
var rightPaneMode = 'histogram'; // 'card' or 'histogram'
var visibleItemsCache = null;

var historyStack = [];
var isNavigatingHistory = false;
var suppressHashSync = false;

var globalSearchTimer = null;
var globalSearchActiveIndex = -1;
var globalSearchCache = new Map();
var globalSearchFuse = null;
var globalSearchFuseSignature = '';
var globalSearchFuseDisabled = false;
var aggregateCache = new Map();

var scholarPins = new Set();
var dossierMetadata = { title: '', description: '' };

var currentVizModule = 'viz03';
var currentVizQueryString = '';
var currentVizCleanup = null;
var vizCacheWarmPromise = null;
var vizScriptLoadPromises = new Map();
var vizScriptLoadAborts = new Map();

var trendsRangeStart = 1;
var trendsRangeEnd = 424;

// --- Shared Constants for Entity Types ---
var TAB_LABELS = {
  home: 'Обзор',
  list: 'Список',
  lectures: 'Лекции',
  materials: 'Материалы',
  sources: 'Источники',
  lecture_compare: 'Сравнение',
  lecture_pages: 'Страницы',
  tasks: 'Практикум',
  glossary: 'Глоссарий',
  kwic: 'KWIC',
  further_reading: 'Чтение',
  scholar: 'Аппарат',
  viz: 'Визуализация',
  chronology: 'Хронология',
  page_trends: 'Динамика',
  corpus: 'Корпус',
  cards: 'Карточки',
  histogram: 'Частотность',
  timeline: 'Хронология',
  heatmap: 'Теплокарта',
  graph: 'Граф',
  map: 'Карта',
  epochs: 'Эпохи',
  families: 'Семьи',
  tree: 'Дерево'
};

var ENTITY_TYPES = {
  home: { title: 'Главная', tabs: ['home'], items: [] },
  materials: { title: 'Материалы', tabs: ['lectures', 'sources', 'lecture_compare', 'lecture_pages', 'tasks', 'glossary', 'kwic', 'further_reading'], items: [] },
  scholar: { title: 'Профессиональный аппарат', tabs: ['scholar', 'viz', 'chronology', 'page_trends'], items: [] },
  all: { title: 'Сводный указатель', tabs: ['list'], items: null },
  names: { title: 'Имена', tabs: ['list', 'cards', 'histogram', 'timeline', 'heatmap', 'graph'], items: [] },
  toponyms: { title: 'Топонимы', tabs: ['list', 'cards', 'histogram', 'epochs', 'map', 'heatmap'], items: [] },
  ethnonyms: { title: 'Этнонимы', tabs: ['list', 'cards', 'histogram', 'map', 'heatmap'], items: [] },
  languages: { title: 'Языки', tabs: ['list', 'cards', 'histogram', 'families', 'tree', 'map', 'heatmap'], items: [] },
  lexicon: { title: 'Лексика', tabs: ['list', 'histogram'], items: [] },
  lexicon_reverse: { title: 'Лексика (обратная)', tabs: ['list'], items: [] },
  lexicon_tech: { title: 'Реконструкции', tabs: ['list'], items: [] },
  subject: { title: 'Предметный', tabs: ['list', 'histogram', 'heatmap'], items: [] }
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

function setGlobalSearchFuse(val) { globalSearchFuse = val; }
function setGlobalSearchFuseSignature(val) { globalSearchFuseSignature = val; }
function setGlobalSearchFuseDisabled(val) { globalSearchFuseDisabled = val; }
function setVizCacheWarmPromise(val) { vizCacheWarmPromise = val; }
function setVizScriptLoadPromises(val) { vizScriptLoadPromises = val; }
function setCurrentVizModule(val) { 
  currentVizModule = val; 
  setSetting('currentVizModule', val);
}
function setCurrentVizCleanup(val) { currentVizCleanup = val; }
function setVisibleItemsCache(val) { visibleItemsCache = val; }

/**
 * Hydrate state from persistent storage.
 */
function hydrateStateFromStorage() {
  const settings = getSetting('trendsRangeStart'); // Check one to see if settings exist
  if (settings === null) return; // No settings saved yet

  trendsRangeStart = getSetting('trendsRangeStart', trendsRangeStart);
  trendsRangeEnd = getSetting('trendsRangeEnd', trendsRangeEnd);
  lectureCompareA = getSetting('lectureCompareA', lectureCompareA);
  lectureCompareB = getSetting('lectureCompareB', lectureCompareB);
  currentLecture = getSetting('currentLecture', currentLecture);
  nameGraphMinEdgeWeight = getSetting('nameGraphMinEdgeWeight', nameGraphMinEdgeWeight);
  graphStrongOnly = getSetting('graphStrongOnly', graphStrongOnly);
  currentKwicSort = getSetting('currentKwicSort', currentKwicSort);
  currentKwicSource = getSetting('currentKwicSource', currentKwicSource);
  currentVizModule = getSetting('currentVizModule', currentVizModule);
  
  const pins = getSetting('scholarPins', []);
  scholarPins = new Set(pins);

  rightPaneMode = getSetting('rightPaneMode', rightPaneMode);
}

function setCurrentTab(val) { currentTab = val; }
function setCurrentEntity(val) { currentEntity = val; }
function setSearchQuery(val) { searchQuery = val; }
function setSelectedItem(val) { selectedItem = val; }
function setSelectedItemType(val) { selectedItemType = val; }
function setRightPaneMode(val) { 
  rightPaneMode = val; 
  setSetting('rightPaneMode', val);
}

function setTrendsRangeStart(val) { 
  trendsRangeStart = val; 
  setSetting('trendsRangeStart', val);
}
function setTrendsRangeEnd(val) { 
  trendsRangeEnd = val; 
  setSetting('trendsRangeEnd', val);
}

function setLectureCompareA(val) { 
  lectureCompareA = val; 
  setSetting('lectureCompareA', val);
}
function setLectureCompareB(val) { 
  lectureCompareB = val; 
  setSetting('lectureCompareB', val);
}

function setCurrentLecture(val) {
  const next = Math.max(0, parseInt(String(val), 10) || 0);
  currentLecture = next;
  setSetting('currentLecture', next);
}

function setNameGraphMinEdgeWeight(val) { 
  nameGraphMinEdgeWeight = val; 
  setSetting('nameGraphMinEdgeWeight', val);
}
function setNameGraphRenderToken(val) { nameGraphRenderToken = val; }
function setFamiliesGraphRenderToken(val) { familiesGraphRenderToken = val; }
function setGraphStrongOnly(val) { 
  graphStrongOnly = val; 
  setSetting('graphStrongOnly', val);
}

function setCurrentKwicQuery(val) { currentKwicQuery = val; }
function setCurrentKwicSource(val) { 
  currentKwicSource = val; 
  setSetting('currentKwicSource', val);
}
function setCurrentKwicSort(val) { 
  currentKwicSort = val; 
  setSetting('currentKwicSort', val);
}
function setCurrentKwicPageStart(val) { currentKwicPageStart = val; }
function setCurrentKwicPageEnd(val) { currentKwicPageEnd = val; }
function setPendingKwicTerm(val) { pendingKwicTerm = val; }

function toggleScholarPin(itemId) {
  if (scholarPins.has(itemId)) {
    scholarPins.delete(itemId);
  } else {
    scholarPins.add(itemId);
  }
  setSetting('scholarPins', Array.from(scholarPins));
}

function getActiveBook() {
  if (!APP_DATA) return {};
  return APP_DATA.active_book || APP_DATA.activeBook || {};
}

function getSavedReadingPage() {
  try {
    const v = localStorage.getItem('v13_reading_page');
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

function saveReadingPage(page) {
  try {
    localStorage.setItem('v13_reading_page', String(page));
  } catch (e) {}
}


// --- Module: core/data.js ---
/**
 * @file data.js
 * @description Data hydration, schema migration, and normalization
 */
/**
 * Extract raw JSON string from the DOM or global fallback.
 */
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

/**
 * Parse embedded APP_DATA payload and hydrate global references.
 */
function parseAppData() {
  clearGlobalSearchCaches();
  const payload = getEmbeddedAppDataText();
  if (!payload) throw new Error('Embedded app data not found');
  
  const data = JSON.parse(payload);
  setAppData(data);
  
  if (typeof window !== 'undefined') {
    window.APP_DATA = data;
    window.__vizCache = window.__vizCache || {};
    window.VIZ_MODULES = window.VIZ_MODULES || {};
  }
  
  setVizCacheWarmPromise(null);
  setVizScriptLoadPromises(new Map());
  cleanupActiveVizModule();
  
  migrateAppDataSchema(data);
  normalizeAppData(data);
  initEntityTypes();
  
  return data;
}

/**
 * Migrate data schema if version is older.
 */
function migrateAppDataSchema(data) {
  if (!data || typeof data !== 'object') return;
  let version = Number.isInteger(data.schema_version) ? data.schema_version : 1;
  data.schema_migrations = Array.isArray(data.schema_migrations) ? data.schema_migrations : [];

  if (version < 2) {
    const marker = '1->2: editorial_flags_and_sources';
    if (!data.schema_migrations.includes(marker)) data.schema_migrations.push(marker);
    data.schema_version = 2;
    version = 2;
  }

  if (version > APP_DATA_SCHEMA_CURRENT && typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[schema] app_data schema_version ${version} is newer than supported ${APP_DATA_SCHEMA_CURRENT}`);
  }
}

/**
 * Normalize application data after parsing.
 */
function normalizeAppData(data) {
  if (!data) return;

  data.labels = data.labels || {};
  data.colors = data.colors || {};
  normalizeCorpusRegistry(data);

  // Legacy compatibility
  data.labels.literator = 'Носитель языка';
  data.labels.schoolchild = 'Участник лекции';
  data.labels.lecture_host = 'Участник лекции';
  data.labels.participant = data.labels.participant || data.labels.schoolchild || data.labels.lecture_host || 'Участник лекции';
  data.colors.participant = data.colors.participant || data.colors.schoolchild || data.colors.lecture_host || '#16a085';

  const names = Array.isArray(data.names) ? data.names : [];
  for (const n of names) {
    if (n.subcategory === 'schoolchild' || n.subcategory === 'lecture_host') n.subcategory = 'participant';
  }

  const editorialKeys = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech', 'subject_index'];
  for (const key of editorialKeys) {
    const arr = Array.isArray(data[key]) ? data[key] : [];
    for (const item of arr) {
      normalizeEditorialFlags(item);
      normalizeItemSources(item);
      normalizeItemContexts(item);
    }
  }

  const stats = data.book_stats || (data.book_stats = {});
  if (Array.isArray(data.lectures) && stats.lectures == null) stats.lectures = data.lectures.length;
  if (stats.has_preface == null) {
    const firstName = (data.lectures || [])[0]?.name || '';
    stats.has_preface = firstName.toLowerCase().includes('предислов');
  }

  data.routes = Array.isArray(data.routes) ? data.routes : [];
  data.further_reading = Array.isArray(data.further_reading) ? data.further_reading : [];
  data.featured_quote = data.featured_quote || { text: '', page: '', lecture: '' };

  const scholar = data.scholar || (data.scholar = {});
  scholar.bibliography = Array.isArray(scholar.bibliography) ? scholar.bibliography : [];
  scholar.birch_grammar = Array.isArray(scholar.birch_grammar) ? scholar.birch_grammar : [];
  scholar.accent_paradigms = Array.isArray(scholar.accent_paradigms) ? scholar.accent_paradigms : [];
  scholar.sound_correspondences = Array.isArray(scholar.sound_correspondences) ? scholar.sound_correspondences : [];
  scholar.visualization_ideas = Array.isArray(scholar.visualization_ideas) ? scholar.visualization_ideas : [];
  scholar.slovo_links = Array.isArray(scholar.slovo_links) ? scholar.slovo_links : [];

  applyDescriptionEditorialConventions(data);
}

function normalizeCorpusRegistry(data) {
  const defaults = {
    schema_version: 1,
    active_book_id: 'mumintroll',
    books: [
      {
        book_id: 'mumintroll',
        title: 'Из жизни слов и языков',
        author: 'А. А. Зализняк',
        year: 2026,
        edition: 'Альпина нон-фикшн',
        status: 'active',
        pages_total: DEFAULT_TOTAL_PAGES,
        default_route: '#v4/home/home',
        content_modules: ['app_data.json'],
      },
    ],
  };
  const raw = data.corpus && typeof data.corpus === 'object' ? data.corpus : {};
  data.corpus = { ...defaults, ...raw };
}

function normalizeEditorialFlags(item) {
  if (!item || typeof item !== 'object') return;
  const raw = (item.editorial_flags && typeof item.editorial_flags === 'object') ? item.editorial_flags : {};
  const head = String(item.head || '').trim();
  const suspectByLegacy = head.startsWith('?') || item.needs_review === true;
  const flags = {
    verified: raw.verified === true || item.verified === true,
    suspect: raw.suspect === true || suspectByLegacy,
    source_confirmed: raw.source_confirmed === true || item.source_confirmed === true || !!item.wiki,
  };
  const note = (typeof raw.note === 'string' && raw.note.trim())
    ? raw.note.trim()
    : ((typeof item.note === 'string' && item.note.trim()) ? item.note.trim() : '');
  if (note) flags.note = note;
  item.editorial_flags = flags;
}

function normalizeItemSources(item) {
  if (!item || typeof item !== 'object') return;
  const arr = Array.isArray(item.sources) ? item.sources : [];
  const normalized = [];
  for (const src of arr) {
    if (!src || typeof src !== 'object') continue;
    const label = String(src.label || '').trim();
    const url = String(src.url || '').trim();
    const quote = String(src.quote || '').trim();
    const page = src.page != null ? String(src.page).trim() : '';
    if (!label && !url && !quote && !page) continue;
    normalized.push({ label, url, quote, page });
  }
  if (!normalized.length && item.wiki) {
    normalized.push({ label: 'Wikipedia', url: String(item.wiki), quote: '', page: '' });
  }
  item.sources = normalized;
}

function normalizeContextSnippet(raw) {
  const text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= KWIC_MAX_SNIPPET_LENGTH) return text;
  return text.slice(0, KWIC_MAX_SNIPPET_LENGTH).trim();
}

function normalizeItemContexts(item) {
  if (!item || typeof item !== 'object') return;
  const src = item.contexts;
  if (!src || typeof src !== 'object') {
    item.contexts = {};
    return;
  }
  if (Array.isArray(src)) {
    item.contexts = src.map(normalizeContextSnippet).filter(Boolean);
    return;
  }
  const normalized = {};
  for (const [pageRaw, snippets] of Object.entries(src)) {
    const page = parseInt(String(pageRaw || ''), 10);
    if (!Number.isFinite(page) || page < 1 || page > 5000) continue;
    if (!Array.isArray(snippets)) continue;
    const out = [];
    for (const raw of snippets) {
      const snippet = normalizeContextSnippet(raw);
      if (!snippet) continue;
      out.push(snippet);
      if (out.length >= KWIC_MAX_SNIPPETS_PER_PAGE) break;
    }
    if (out.length) normalized[String(page)] = out;
  }
  item.contexts = normalized;
}

function normalizeDescriptionYoText(value) {
  return String(value == null ? '' : value)
    .replace(/е\u0308/g, 'е')
    .replace(/Е\u0308/g, 'Е')
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е');
}

function normalizeDescriptionYoInNode(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) normalizeDescriptionYoInNode(item);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && DESCRIPTION_FIELDS_WITH_NORMALIZED_YO.has(key)) {
      node[key] = normalizeDescriptionYoText(value);
      continue;
    }
    if (value && typeof value === 'object') normalizeDescriptionYoInNode(value);
  }
}

function applyDescriptionEditorialConventions(data) {
  normalizeDescriptionYoInNode(data);

  const lectures = Array.isArray(data?.lectures) ? data.lectures : [];
  if (
    lectures[2] &&
    typeof lectures[2].why_read === 'string' &&
    lectures[2].why_read.includes('brother') &&
    lectures[2].why_read.includes('брат')
  ) {
    lectures[2].why_read = LECTURE_WHY_READ_BROTHER_BRAT;
  }
}

function getCorpusRegistry() {
  return APP_DATA.corpus_registry || { books: [], sources: [] };
}

function getPlannedVideoCatalogSource() {
  const sources = getCorpusRegistry().sources || [];
  return sources.find(s => s.is_video_catalog) || null;
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

/**
 * Collect entities mentioned on a specific page.
 */
function collectReadingNow(page, limitPerType = 8) {
  const sources = [
    { type: 'names', label: 'Имена', items: APP_DATA.names || [] },
    { type: 'languages', label: 'Языки', items: APP_DATA.languages || [] },
    { type: 'toponyms', label: 'Топонимы', items: APP_DATA.toponyms || [] },
    { type: 'ethnonyms', label: 'Этнонимы', items: APP_DATA.ethnonyms || [] },
    { type: 'subject', label: 'Понятия', items: APP_DATA.subject_index || [] },
    { type: 'lexicon', label: 'Лексика', items: APP_DATA.lexicon || [] },
  ];
  const groups = [];
  for (const src of sources) {
    const hits = [];
    for (const it of src.items) {
      const pages = it.page_list || [];
      if (pages.includes(page)) hits.push(it);
    }
    if (!hits.length) continue;
    hits.sort((a, b) => {
      if (!!b.discussed !== !!a.discussed) return (b.discussed ? 1 : 0) - (a.discussed ? 1 : 0);
      return (b.page_list || []).length - (a.page_list || []).length || compareHeadsRu(a.head, b.head);
    });
    groups.push({ type: src.type, label: src.label, items: hits.slice(0, limitPerType), total: hits.length });
  }
  return groups;
}


// --- Module: core/registry.js ---
/**
 * @file registry.js
 * @description Global entity registry and item indexing
 */
var ITEM_INDEX_EXACT = new Map();      // type -> Map(head -> item)
var ITEM_INDEX_NORMALIZED = new Map(); // type -> Map(normalizedHead -> item)
var ITEM_HASH_SLUG_BY_HEAD = new Map(); // type -> Map(head -> slug)
var ITEM_HASH_HEAD_BY_SLUG = new Map(); // type -> Map(slug -> head)

/**
 * Initialize all entity type indexes.
 */
function initEntityTypes() {
  if (!APP_DATA) return;
  
  // Update ENTITY_TYPES with actual data from APP_DATA
  Object.keys(ENTITY_TYPES).forEach(key => {
    if (APP_DATA[key] && Array.isArray(APP_DATA[key])) {
      ENTITY_TYPES[key].items = APP_DATA[key];
    }
  });

  // buildAllItems() logic...
  if (ENTITY_TYPES.all) {
    ENTITY_TYPES.all.items = buildAllItems();
  }

  for (const key of Object.keys(ENTITY_TYPES)) {
    indexItems(key, ENTITY_TYPES[key].items);
  }
}

function buildAllItems() {
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index'];
  const all = [];
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      all.push({ ...it, _original_type: cat === 'subject_index' ? 'subject' : cat });
    }
  }
  return all;
}

function indexItems(type, items) {
  if (!Array.isArray(items)) return;
  
  const exact = new Map();
  const normalized = new Map();
  const slugByHead = new Map();
  const headBySlug = new Map();

  for (const it of items) {
    const head = String(it.head || it.name || '').trim();
    if (!head) continue;
    
    exact.set(head, it);
    normalized.set(normalizeHeadForMatch(head), it);
    
    // Slug logic (v13.0+)
    const slug = it.slug || encodeURIComponent(head).replace(/%/g, '_');
    slugByHead.set(head, slug);
    headBySlug.set(slug, head);
  }

  ITEM_INDEX_EXACT.set(type, exact);
  ITEM_INDEX_NORMALIZED.set(type, normalized);
  ITEM_HASH_SLUG_BY_HEAD.set(type, slugByHead);
  ITEM_HASH_HEAD_BY_SLUG.set(type, headBySlug);
}

function encodeItemHeadForHash(type, head) {
  if (!head) return '';
  const map = ITEM_HASH_SLUG_BY_HEAD.get(type);
  if (map && map.has(head)) return map.get(head);
  return encodeURIComponent(head);
}

function decodeItemHeadFromHash(type, slug) {
  if (!slug) return '';
  const map = ITEM_HASH_HEAD_BY_SLUG.get(type);
  if (map && map.has(slug)) return map.get(slug);
  return decodeURIComponent(slug.replace(/_/g, '%'));
}

function findItemByHeadAndType(head, type) {
  const exact = ITEM_INDEX_EXACT.get(type);
  if (exact && exact.has(head)) return exact.get(head);
  const normMap = ITEM_INDEX_NORMALIZED.get(type);
  if (normMap) {
    const nh = normalizeHeadForMatch(head);
    if (normMap.has(nh)) return normMap.get(nh);
  }
  return null;
}


// --- Module: core/storage.js ---
/**
 * @file storage.js
 * @description Persistent storage management using IndexedDB for Zalizniakiada v13.0
 */

const DB_NAME = 'ZalizniakiadaDB';
const DB_VERSION = 1;
const STORE_NOTES = 'notes';

let dbInstance = null;

/**
 * Open the database and ensure the object store exists.
 */
async function initStorage() {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Save a researcher note.
 */
async function saveNote(id, text) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES], 'readwrite');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.put({ id, text, updatedAt: new Date().toISOString() });
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieve a researcher note.
 */
async function getNote(id) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES], 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.get(id);
    
    request.onsuccess = (event) => resolve(event.target.result ? event.target.result.text : '');
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieve all researcher notes for export.
 */
async function getAllNotes() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES], 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.getAll();
    
    request.onsuccess = (event) => resolve(event.target.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

// --- Settings & Preferences ---

const SETTINGS_KEY = 'v13_settings';

/**
 * Get all saved settings.
 */
function getAllSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to parse settings from localStorage', e);
    return {};
  }
}

/**
 * Get a specific setting.
 */
function getSetting(key, defaultValue = null) {
  const settings = getAllSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Save a specific setting.
 */
function setSetting(key, value) {
  try {
    const settings = getAllSettings();
    settings[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save setting to localStorage', e);
  }
}

/**
 * Clear all settings.
 */
function clearAllSettings() {
  localStorage.removeItem(SETTINGS_KEY);
}


// --- Module: core/ai.js ---
/**
 * @file ai.js
 * @description Linguistic AI Copilot for Zalizniakiada v15.0
 * Provides smart insights, etymological hypotheses, and cross-corpus connections.
 */
/**
 * Generate an "Insight" for a specific entity.
 * This simulates an AI assistant by performing deep cross-category analysis.
 */
function getLinguisticInsight(head, type) {
  const qStem = stemRussian(normalizeHeadForMatch(head));
  const insights = [];
  
  // 1. Semantic Proximity Insight
  const semantic = (APP_DATA.semantic_links || {})[head] || [];
  if (semantic.length > 0) {
    insights.push(`Обнаружена высокая семантическая близость с термином "${semantic[0].head}" (${Math.round(semantic[0].score * 100)}%).`);
  }
  
  // 2. Cross-Category Morphological Connection
  const categories = ['lexicon', 'names', 'toponyms'];
  for (const cat of categories) {
    if (cat === type) continue;
    const items = APP_DATA[cat] || [];
    const match = items.find(it => stemRussian(normalizeHeadForMatch(it.head || '')) === qStem);
    if (match) {
      insights.push(`Замечена морфологическая связь с ${cat === 'names' ? 'личностью' : 'топонимом'} "${match.head}". Возможно общее происхождение.`);
    }
  }
  
  // 3. Frequency Analysis
  const item = (APP_DATA[type] || []).find(it => it.head === head);
  if (item && (item.page_list || []).length > 5) {
    insights.push(`Данный термин является высокочастотным для этого корпуса. Рекомендуется проверить его роль в ключевых лингвистических законах Зализняка.`);
  }

  return insights.length > 0 ? insights : ["Инсайтов пока нет, продолжайте исследование."];
}

/**
 * Bridge for external LLM API integration.
 */
async function askLinguisticAI(prompt) {
  // Placeholder for future OpenAI/Anthropic integration
  return "Этот запрос будет передан языковой модели в будущих версиях v15.x";
}


// --- Module: core/analytics.js ---
/**
 * @file analytics.js
 * @description Advanced DH Analytics: Distant Reading, TF-IDF, and Topic Clustering for v16.0
 */
/**
 * Perform Distant Reading analysis: 
 * Group items into thematic clusters based on description text.
 */
function buildTopicClusters() {
  const corpus = [];
  const categories = ['lexicon', 'names', 'toponyms', 'languages'];
  
  // 1. Prepare Documents
  categories.forEach(cat => {
    const items = APP_DATA[cat] || [];
    items.forEach(it => {
      if (!it.description && !it.head) return;
      corpus.push({
        id: `${cat}:${it.head}`,
        head: it.head,
        text: (it.head + ' ' + (it.description || '')).toLowerCase()
      });
    });
  });

  // 2. Simple TF-IDF / Keyword Extraction
  const clusters = new Map();
  const stopwords = new Set(['в', 'и', 'на', 'что', 'с', 'по', 'из', 'к', 'для']);

  corpus.forEach(doc => {
    const words = doc.text.split(/[^а-яёa-z]+/i)
      .map(w => stemRussian(w))
      .filter(w => w.length > 3 && !stopwords.has(w));
      
    // Assign to clusters based on top stems
    words.slice(0, 3).forEach(stem => {
      if (!clusters.has(stem)) clusters.set(stem, []);
      if (clusters.get(stem).length < 20) {
        clusters.get(stem).push(doc.head);
      }
    });
  });

  // 3. Filter and Rank Clusters
  const ranked = Array.from(clusters.entries())
    .filter(([stem, docs]) => docs.length > 5 && docs.length < 50)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);

  return ranked;
}

/**
 * Calculate Network Centrality (Hubs) based on cross-links.
 */
function calculateCentrality() {
  const scores = new Map();
  const cross = APP_DATA.cross_links || {};
  
  Object.values(cross).forEach(sourceTypeMap => {
    Object.values(sourceTypeMap).forEach(links => {
      links.forEach(lnk => {
        scores.set(lnk.head, (scores.get(lnk.head) || 0) + (lnk.weight || 1));
      });
    });
  });
  
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
}


// --- Module: core/quiz.js ---
/**
 * @file quiz.js
 * @description Interactive Linguistics Quiz based on A.A. Zaliznyak's works
 */

var QUIZ_LEVELS = [
  {
    id: 1,
    title: "Уровень 1: Историческая лингвистика (Начинающий)",
    questions: [
      {
        text: "Какое слово является этимологическим родственником русского 'глаз' в немецком языке (через значение 'шар')?",
        options: ["Glass", "Kugel", "Glanz"],
        answer: 1
      },
      {
        text: "С каким латинским словом родственно русское 'солнце'?",
        options: ["Luna", "Sol", "Stella"],
        answer: 1
      }
    ]
  },
  {
    id: 2,
    title: "Уровень 2: Берестяные грамоты и новгородский диалект (Средний)",
    questions: [
      {
        text: "Отсутствие какого процесса является уникальной чертой древненовгородского диалекта?",
        options: ["Первая палатализация", "Вторая палатализация", "Третья палатализация"],
        answer: 1
      },
      {
        text: "Согласно закону Вакернагеля, где в предложении должны стоять краткие формы местоимений (энклитики)?",
        options: ["В самом конце", "В самом начале", "После первого ударного слова"],
        answer: 2
      }
    ]
  },
  {
    id: 3,
    title: "Уровень 3: Текстология и 'Слово о полку Игореве' (Продвинутый)",
    questions: [
      {
        text: "Почему 'Слово...' не могло быть подделкой XVIII века с лингвистической точки зрения?",
        options: ["Слишком длинный текст", "Точное соблюдение правил постановки энклитик, неизвестных в XVIII веке", "Упоминание реальных князей"],
        answer: 1
      }
    ]
  },
  {
    id: 4,
    title: "Уровень 4: Грамматика и Акцентология (Эксперт)",
    questions: [
      {
        text: "Что означает индекс в Грамматическом словаре Зализняка?",
        options: ["Год издания слова", "Тип склонения и схема ударения", "Частота употребления"],
        answer: 1
      }
    ]
  }
];

let currentScore = 0;

function checkAnswer(levelId, questionIdx, optionIdx) {
  const level = QUIZ_LEVELS.find(l => l.id === levelId);
  const q = level.questions[questionIdx];
  const isCorrect = q.answer === optionIdx;
  if (isCorrect) currentScore += 10;
  return isCorrect;
}


// --- Module: core/achievements.js ---
/**
 * @file achievements.js
 * @description Gamification and Achievement system for Zalizniakiada v17.5
 */
var ACHIEVEMENTS = [
  { id: 'first_note', title: 'Первое открытие', desc: 'Напишите свою первую заметку к термину', icon: '📝' },
  { id: 'quiz_master', title: 'Магистр лингвистики', desc: 'Пройдите все уровни теста без ошибок', icon: '🎓' },
  { id: 'polyglot', title: 'Полиглот', desc: 'Посетите карточки 10 разных языков', icon: '🌍' },
  { id: 'beresto_fan', title: 'Берестолог', desc: 'Изучите 5 берестяных грамот', icon: '📜' },
  { id: 'navigator', title: 'Великий навигатор', desc: 'Воспользуйтесь перекрестной ссылкой 20 раз', icon: '⚓' },
  { id: 'night_watch', title: 'Ночной дозор', desc: 'Занимались лингвистикой глубокой ночью', icon: '🌙', secret: true },
  { id: 'easter_egg', title: 'Искатель секретов', desc: 'Нашли скрытую кнопку в подвале', icon: '🥚', secret: true }
];

/**
 * Check and unlock achievements based on user actions.
 */
async function checkAchievements(actionType, data) {
  const unlocked = JSON.parse(localStorage.getItem('unlocked_achievements') || '[]');
  const newUnlocks = [];
  
  if (actionType === 'note_saved' && !unlocked.includes('first_note')) {
    newUnlocks.push('first_note');
  }
  
  if (actionType === 'app_opened') {
    const hour = new Date().getHours();
    if ((hour >= 0 && hour <= 4) && !unlocked.includes('night_watch')) {
      newUnlocks.push('night_watch');
    }
  }
  
  if (actionType === 'easter_egg_clicked' && !unlocked.includes('easter_egg')) {
    newUnlocks.push('easter_egg');
  }
  
  if (actionType === 'language_visited') {
    const visited = JSON.parse(localStorage.getItem('visited_languages') || '[]');
    if (!visited.includes(data.id)) visited.push(data.id);
    localStorage.setItem('visited_languages', JSON.stringify(visited));
    if (visited.length >= 10 && !unlocked.includes('polyglot')) {
      newUnlocks.push('polyglot');
    }
  }

  if (newUnlocks.length > 0) {
    const total = [...unlocked, ...newUnlocks];
    localStorage.setItem('unlocked_achievements', JSON.stringify(total));
    return newUnlocks.map(id => ACHIEVEMENTS.find(a => a.id === id));
  }
  
  return [];
}


// --- Module: core/bibliography.js ---
/**
 * @file bibliography.js
 * @description Bibliographic management system for Zalizniakiada v14.0
 */
/**
 * Registry of all bibliographic sources found in the corpus data.
 * Key: Short citation (e.g., "Зализняк 1967")
 * Value: Metadata and list of items citing it.
 */
let bibRegistry = null;

/**
 * Build the bibliography index by scanning all items.
 */
function buildBibliographyIndex() {
  const index = new Map();
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index'];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const sources = Array.isArray(it.sources) ? it.sources : [];
      for (const src of sources) {
        if (!src.label) continue;
        
        // Extract canonical citation (e.g., from "Зализняк 1967, стр. 12" -> "Зализняк 1967")
        const citation = src.label.split(',')[0].trim();
        if (!index.has(citation)) {
          index.set(citation, {
            label: citation,
            full_refs: new Set(),
            citing_items: []
          });
        }
        
        const entry = index.get(citation);
        if (src.full_reference) entry.full_refs.add(src.full_reference);
        entry.citing_items.push({
          head: it.head,
          type: cat,
          page: src.page
        });
      }
    }
  }
  
  bibRegistry = index;
  console.log(`[Bib] Index built: ${index.size} citations found.`);
  return index;
}

/**
 * Get citation details.
 */
function getCitationDetails(citation) {
  if (!bibRegistry) buildBibliographyIndex();
  return bibRegistry.get(citation);
}

/**
 * Export all bibliography as BibTeX.
 */
function exportBibliographyBibTeX() {
  if (!bibRegistry) buildBibliographyIndex();
  let bibtex = '';
  for (const [cite, data] of bibRegistry) {
    const key = cite.replace(/\s+/g, '_').toLowerCase();
    bibtex += `@misc{${key},\n  title = {${cite}},\n  note = {Citations in corpus: ${data.citing_items.length}}\n}\n\n`;
  }
  return bibtex;
}


// --- Module: utils/dom.js ---
/**
 * @file dom.js
 * @description DOM manipulation and event binding helpers
 */
function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function nowMs() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

function perfDebug(label, ms, meta = '') {
  if (typeof window !== 'undefined' && window.location && window.location.search.includes('perf=1')) {
    console.log(`[perf] ${label}: ${ms.toFixed(1)}ms ${meta ? `(${meta})` : ''}`);
  }
}

const scriptLoadPromises = new Map();
const LOCAL_SCRIPT_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

function isAllowedScriptUrl(src) {
  try {
    const parsed = new URL(src, document.baseURI);
    if (!LOCAL_SCRIPT_PROTOCOLS.has(parsed.protocol)) return false;
    if (parsed.protocol === 'file:') {
      return window.location.protocol === 'file:' && /^\.{0,2}\//.test(src);
    }
    return parsed.origin === window.location.origin;
  } catch (err) {
    return false;
  }
}

function loadScriptOnce(src, attrs = {}) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Document is not available.'));
  }
  const url = String(src || '').trim();
  if (!url) return Promise.reject(new Error('Script URL is required.'));
  if (!isAllowedScriptUrl(url)) return Promise.reject(new Error('Script URL is not allowed.'));
  if (scriptLoadPromises.has(url)) return scriptLoadPromises.get(url);

  const promise = new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find(script => script.getAttribute('src') === url || script.src === url);
    if (existing && existing.dataset.loaded === 'true') {
      resolve(existing);
      return;
    }

    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = url;
      script.async = true;
    }
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === false || value == null) return;
      if (key === 'crossOrigin') script.crossOrigin = String(value);
      else if (key === 'integrity') script.integrity = String(value);
      else script.setAttribute(key, String(value));
    });
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(script);
    }, { once: true });
    script.addEventListener('error', () => {
      scriptLoadPromises.delete(url);
      reject(new Error(`Failed to load script: ${url}`));
    }, { once: true });
    if (!existing) document.head.appendChild(script);
  });

  scriptLoadPromises.set(url, promise);
  return promise;
}

function isMobileViewport() {
  return typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 900;
}

function getRightContentHost() {
  if (isMobileViewport()) {
    const mobile = document.getElementById('mobile-sheet-content');
    if (mobile) return mobile;
  }
  return document.getElementById('right-content');
}

function setMobileSheetOpen(open) {
  const backdrop = document.getElementById('mobile-card-backdrop');
  const sheet = document.getElementById('mobile-card-sheet');
  if (!backdrop || !sheet || typeof document === 'undefined') return;
  
  backdrop.classList.toggle('open', !!open);
  sheet.classList.toggle('open', !!open);
  
  if (document.body) {
    document.body.classList.toggle('mobile-sheet-lock', !!open);
  }
}

function renderAccentSafe(s) {
  if (!s || typeof s !== 'string') return '';
  return escapeHtml(s).replace(/`/g, '&#x301;');
}

function buildCanonicalHash(parts) {
  return `#${HASH_ROUTE_PREFIX}/${parts.filter(Boolean).join('/')}`;
}

function buildItemHash(type, head) {
  const t = type || 'all';
  const encodedHead = encodeItemHeadForHash(t, head);
  const defaultTab = ENTITY_TYPES[t] ? ENTITY_TYPES[t].tabs[0] : 'list';
  return buildCanonicalHash([t, defaultTab, 'item', t, encodedHead]);
}

function buildScholarAnchorHash(anchorId) {
  return buildCanonicalHash(['scholar', 'scholar', 'anchor', String(anchorId || '').replace(/[^a-z0-9_-]/gi, '')]);
}

function buildListSearchHash(entity, query) {
  const e = entity || 'all';
  const q = String(query || '').trim();
  if (!q) return buildCanonicalHash([e, 'list']);
  return buildCanonicalHash([e, 'list', 'q', encodeURIComponent(q)]);
}

function safeIcon(icon, fallback = '•') {
  if (!icon) return fallback;
  const text = String(icon);
  if (text.length > 2) return fallback;
  return text;
}

function renderTextWithPageLinks(text, options = {}) {
  if (!text || typeof text !== 'string') return '';
  const className = options.className || 'material-page-link card-page-link related-link';
  const rangeTarget = options.rangeTarget || 'trends';
  
  return text.replace(/(?:стр\.|с\.|[Pp]\.)\s*(\d+(?:\s*[-–]\s*\d+)?)/g, (match, p1) => {
    const range = p1.split(/[-–]/).map(s => s.trim());
    const startRaw = parseInt(range[0], 10);
    const endRaw = range[1] ? parseInt(range[1], 10) : startRaw;
    const start = clampPageInBook(Number.isFinite(startRaw) ? startRaw : 1);
    const end = clampPageInBook(Number.isFinite(endRaw) ? endRaw : start);
    
    let href = '';
    if (rangeTarget === 'trends') {
      href = buildCanonicalHash(['scholar', 'page_trends', 'range', String(Math.min(start, end)), String(Math.max(start, end))]);
    } else {
      href = buildCanonicalHash(['materials', 'lectures', 'reading', String(start)]);
    }
    
    return `<a href="${escapeHtml(href)}" class="${escapeHtml(className)}" data-start="${start}" data-end="${end}">${escapeHtml(match)}</a>`;
  });
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const raw = url.trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return '#';
  if (raw.startsWith('#')) return raw;
  if (raw.startsWith('//')) return '#';
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') return raw;
    if (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
      return raw;
    }
  } catch (err) {
    return '#';
  }
  return '#';
}

function safeColor(value, fallback = '#888') {
  if (!value || typeof value !== 'string') return fallback;
  return value;
}

function safeImageUrl(url) {
  return safeUrl(url);
}

function safeSetAttr(el, attr, val) {
  if (el && typeof el.setAttribute === 'function') {
    el.setAttribute(attr, val);
  }
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

function announceAchievement(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="ach-icon">${achievement.icon}</div>
    <div class="ach-info">
      <div class="ach-title">Достижение разблокировано!</div>
      <div class="ach-name">${escapeHtml(achievement.title)}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 100);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}


// --- Module: utils/linguistics.js ---
/**
 * @file linguistics.js
 * @description Linguistic utilities, stemming, and numerical clamping
 */
function getTotalBookPages() {
  const stats = APP_DATA && APP_DATA.book_stats ? APP_DATA.book_stats : {};
  return Number.isFinite(Number(stats.total_pages)) ? Number(stats.total_pages) : DEFAULT_TOTAL_PAGES;
}

function clampUiInput(val, maxLen) {
  return String(val || '').slice(0, maxLen);
}

function clampPageInBook(page) {
  const p = parseInt(String(page || '1'), 10);
  const total = getTotalBookPages();
  if (!Number.isFinite(p)) return 1;
  return Math.max(1, Math.min(total, p));
}
function parseLeipzigGloss(text, gloss) {
  if (!text || !gloss) return null;
  const words = text.split(/\s+/);
  const glosses = gloss.split(/\s+/);
  
  return words.map((w, i) => ({
    text: w,
    gloss: glosses[i] || ''
  }));
}

function stemRussian(word) {
  if (!word || typeof word !== 'string') return '';
  let w = word.toLowerCase().replace(/ё/g, 'е');
  // Simple suffix removal (Porter-like)
  const suffixes = /(иями|иями|ями|ия|ие|ии|ию|ей|ой|ий|ый|ов|ам|ах|и|ы|а|о|у|ь)$/;
  return w.replace(suffixes, '');
}

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

function compareItemsByHead(a, b) {
  return compareHeadsRu(a.head || a.name || '', b.head || b.name || '');
}

function sortUniquePages(pages) {
  if (!Array.isArray(pages)) return [];
  return Array.from(new Set(pages.map(p => parseInt(p, 10)).filter(p => Number.isFinite(p)))).sort((a, b) => a - b);
}


// --- Module: utils/export.js ---
/**
 * @file export.js
 * @description Export utilities for researcher data (Markdown, BibTeX)
 */
/**
 * Export all researcher notes as a single Markdown file.
 */
function generateEntityJsonLd(item, type) {
  if (!item) return '';
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "name": item.head || item.name,
    "description": item.description,
    "inDefinedTermSet": "https://zaliznyak.philology.ru/corpus",
    "termCode": `${type}:${item.head}`
  };
  return JSON.stringify(ld, null, 2);
}

async function exportAllNotesMarkdown() {
  const notes = await getAllNotes();
  if (!notes || notes.length === 0) {
    alert('Нет заметок для экспорта.');
    return;
  }
  
  let md = `# Исследовательские заметки: Zalizniakiada\n\n`;
  md += `Дата экспорта: ${new Date().toLocaleDateString()}\n\n---\n\n`;
  
  notes.forEach(note => {
    const [type, head] = note.id.split(':');
    md += `## [${type}] ${head}\n\n`;
    md += `${note.text}\n\n`;
    md += `*Обновлено: ${new Date(note.updatedAt).toLocaleString()}*\n\n---\n\n`;
  });
  
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zalizniakiada_research_notes_${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCurrentCardMarkdown() {
  // logic to export single card...
}


// --- Module: core/search.js ---
/**
 * @file search.js
 * @description Search engine integration (Fuse.js + Intellectual Stemming)
 */
const GLOBAL_SEARCH_CACHE_MAX = 120;
const GLOBAL_SEARCH_FUSE_LIMIT = 80;
const MAX_GLOBAL_QUERY_LENGTH = 80;

/**
 * Reset the Fuse.js search engine state.
 */
function resetGlobalSearchFuseState() {
  setGlobalSearchFuse(null);
  setGlobalSearchFuseSignature('');
  setGlobalSearchFuseDisabled(false);
}

/**
 * Clear search results and normalization caches.
 */
function clearGlobalSearchCaches() {
  if (globalSearchCache && typeof globalSearchCache.clear === 'function') {
    globalSearchCache.clear();
  }
  resetGlobalSearchFuseState();
}

/**
 * Initialize or retrieve the Fuse instance.
 */
function ensureGlobalSearchFuse() {
  if (globalSearchFuseDisabled) return false;
  
  const signature = `${APP_DATA ? APP_DATA.schema_version : 0}::${(APP_DATA && APP_DATA.lexicon ? APP_DATA.lexicon.length : 0)}`;
  if (globalSearchFuse && globalSearchFuseSignature === signature) return true;
  
  try {
    const records = buildGlobalSearchFuseRecords();
    if (!records.length) return false;
    
    const fuse = new Fuse(records, {
      includeScore: true,
      shouldSort: true,
      threshold: 0.36,
      ignoreLocation: true,
      distance: 140,
      minMatchCharLength: 2,
      keys: [
        { name: 'searchHead', weight: 0.78 },
        { name: 'searchSecondary', weight: 0.22 },
      ],
    });
    
    setGlobalSearchFuse(fuse);
    setGlobalSearchFuseSignature(signature);
    return true;
  } catch (e) {
    resetGlobalSearchFuseState();
    setGlobalSearchFuseDisabled(true);
    return false;
  }
}

function buildGlobalSearchFuseRecords() {
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'lexicon_reverse', 'subject_index'];
  const records = [];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const head = it.head || it.name || '';
      records.push({
        head,
        searchHead: normalizeHeadForMatch(head),
        searchSecondary: normalizeHeadForMatch(it.description || ''),
        type: cat === 'subject_index' ? 'subject' : cat,
        item: it
      });
    }
  }
  return records;
}

/**
 * Perform a global search across all categories.
 */
function getGlobalSearchMatches(query) {
  const qRaw = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH).toLowerCase();
  const qNorm = normalizeHeadForMatch(qRaw);
  if (qNorm.length < 2) return [];
  
  const searchKey = `global::${qNorm}`;
  const cached = globalSearchCache.get(searchKey);
  if (cached) return cached;
  
  let results = [];
  if (ensureGlobalSearchFuse()) {
    const fuseResults = globalSearchFuse.search(qNorm, { limit: GLOBAL_SEARCH_FUSE_LIMIT });
    results = fuseResults.map(r => ({
      item: r.item.item,
      type: r.item.type,
      score: r.score
    }));
  } else {
    // Fallback to intellectual search if Fuse is disabled
    results = intellectualSearch(query);
  }
  
  globalSearchCache.set(searchKey, results);
  // Simple cache eviction
  if (globalSearchCache.size > GLOBAL_SEARCH_CACHE_MAX) {
    const firstKey = globalSearchCache.keys().next().value;
    globalSearchCache.delete(firstKey);
  }
  
  return results;
}

/**
 * Legacy/Intellectual search (stemming based).
 */
function intellectualSearch(query) {
  if (!query || query.length < 2) return [];
  
  const qNorm = normalizeHeadForMatch(query);
  const qStem = stemRussian(qNorm);
  
  const results = [];
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'lexicon_reverse', 'subject_index'];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const head = it.head || it.name || '';
      const headNorm = normalizeHeadForMatch(head);
      const headStem = stemRussian(headNorm);
      
      let score = 1.0;
      
      if (headNorm === qNorm) score = 0.1;
      else if (headNorm.startsWith(qNorm)) score = 0.3;
      else if (headStem.includes(qStem) || qStem.includes(headStem)) score = 0.5;
      else if (normalizeHeadForMatch(it.description || '').includes(qNorm)) score = 0.8;
      else continue;
      
      results.push({
        item: it,
        type: cat === 'subject_index' ? 'subject' : cat,
        score
      });
    }
  }
  
  return results.sort((a, b) => a.score - b.score).slice(0, 50);
}

function initSearchWorker() {
  console.log('[Search] Engine initialized (Fuse.js + Stemming)');
}


// --- Module: core/router.js ---
/**
 * @file router.js
 * @description Routing and hash management for BookIndex v13.0
 */
/**
 * Parse hash into parts and query string.
 */
function parseHashRoute(hash) {
  if (!hash || typeof hash !== 'string') return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== HASH_ROUTE_PREFIX) {
    if (ENTITY_TYPES[parts[0]]) return { parts, query, legacy: true };
    return null;
  }
  return { parts: parts.slice(1), query };
}

/**
 * Build canonical hash from current application state.
 */
function buildHashFromState() {
  const parts = [currentEntity, currentTab];
  
  if (currentEntity === 'scholar' && currentTab === 'page_trends') {
    const start = clampPageInBook(trendsRangeStart);
    const end = clampPageInBook(trendsRangeEnd);
    parts.push('range', String(Math.min(start, end)), String(Math.max(start, end)));
  }
  
  if (currentEntity === 'scholar' && currentTab === 'viz' && currentVizModule) {
    parts.push('module', String(currentVizModule));
  }
  
  if (currentTab === 'list' && searchQuery && !selectedItem) {
    parts.push('q', searchQuery);
  }
  
  if (selectedItem && rightPaneMode === 'card') {
    const itemType = selectedItemType || currentEntity;
    const itemHashHead = encodeItemHeadForHash(itemType, selectedItem);
    parts.push('item', itemType, itemHashHead);
  }

  const hash = '#' + [HASH_ROUTE_PREFIX, ...parts].join('/');
  // Note: viz query string is handled by caller or specific modules if needed
  return hash;
}

/**
 * Apply hash to application state.
 */
function applyHash(hash) {
  const parsed = parseHashRoute(hash);
  if (!parsed) return false;
  
  const routedParts = parsed.parts;
  const entity = routedParts[0];
  if (!ENTITY_TYPES[entity]) return false;
  
  const tabCandidate = routedParts[1] || ENTITY_TYPES[entity].tabs[0];
  const tab = ENTITY_TYPES[entity].tabs.includes(tabCandidate) ? tabCandidate : ENTITY_TYPES[entity].tabs[0];
  
  setCurrentEntity(entity);
  setCurrentTab(tab);
  setSelectedItem(null);
  setSelectedItemType(null);
  setRightPaneMode('histogram');
  setSearchQuery('');
  
  // Range (trends)
  const rangePos = routedParts.indexOf('range');
  if (rangePos >= 0 && routedParts[rangePos + 1] && routedParts[rangePos + 2]) {
    setTrendsRangeStart(clampPageInBook(routedParts[rangePos + 1]));
    setTrendsRangeEnd(clampPageInBook(routedParts[rangePos + 2]));
  }
  
  // Search Query
  const qPos = routedParts.indexOf('q');
  if (qPos >= 0 && routedParts[qPos + 1]) {
    setSearchQuery(clampUiInput(routedParts[qPos + 1], MAX_LIST_QUERY_LENGTH));
  }
  
  // Item
  const itemPos = routedParts.indexOf('item');
  if (itemPos >= 0 && routedParts[itemPos + 1] && routedParts[itemPos + 2]) {
    const type = routedParts[itemPos + 1];
    const slug = routedParts[itemPos + 2];
    const head = decodeItemHeadFromHash(type, slug);
    if (head) {
      setSelectedItem(head);
      setSelectedItemType(type);
      setRightPaneMode('card');
    }
  }
  
  return true;
}

/**
 * Sync current state to window.location.hash.
 */
function syncNavigationState() {
  if (typeof window === 'undefined' || !window.location) return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}


// --- Module: core/seo.js ---
/**
 * @file seo.js
 * @description Lightweight document metadata updates for hash-routed views.
 */
const SITE_NAME = 'Зализнякиада';
const DEFAULT_DESCRIPTION = 'Интерактивный веб-справочник и корпусная лаборатория по наследию А. А. Зализняка: 3 376 сущностей, лекции, KWIC, карты, графы и научный аппарат.';

const TAB_DESCRIPTIONS = {
  home: DEFAULT_DESCRIPTION,
  lectures: 'Краткий навигатор по лекциям книги А. А. Зализняка «Из жизни слов и языков» с переходом к связанным указателям и контекстам.',
  sources: 'Корпус источников BookIndex: книги, материалы, редакторские данные и планируемый видеокаталог по наследию А. А. Зализняка.',
  lecture_compare: 'Сравнение лекций по пересечениям имен, языков, топонимов, этнонимов, лексики и предметных понятий.',
  glossary: 'Глоссарий лингвистических терминов и учебных определений для чтения А. А. Зализняка.',
  kwic: 'KWIC-конкорданс BookIndex: поиск ключевых слов в контексте по корпусу книги и связанным материалам.',
  scholar: 'Научный аппарат BookIndex: хронология, библиография, лингвистические данные и исследовательские инструменты.',
  viz: 'Интерактивные визуализации BookIndex: графы, карты, деревья языков и динамика тем по корпусу.',
  list: 'Сводный указатель BookIndex по именам, местам, народам, языкам, лексике и предметным понятиям.'
};

function setMetaContent(selector, value) {
  if (typeof document === 'undefined') return;
  const node = document.querySelector(selector);
  if (node) node.setAttribute('content', value);
}

function truncate(value, maxLength = 170) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function buildRouteTitle() {
  const entityTitle = ENTITY_TYPES[currentEntity]?.title || 'BookIndex';
  const tabTitle = TAB_LABELS[currentTab] || currentTab || 'Обзор';

  if (selectedItem) {
    const itemType = ENTITY_TYPES[selectedItemType || currentEntity]?.title || entityTitle;
    return `${selectedItem} — ${itemType} | ${SITE_NAME}`;
  }

  if (currentTab === 'home') {
    return `${SITE_NAME} — интерактивный справочник по Зализняку | BookIndex`;
  }

  return `${tabTitle} — ${entityTitle} | ${SITE_NAME}`;
}

function buildRouteDescription() {
  if (selectedItem) {
    const itemType = ENTITY_TYPES[selectedItemType || currentEntity]?.title || 'указатель';
    return truncate(`Карточка «${selectedItem}» в разделе «${itemType}»: страницы, контексты, связи и исследовательские пометы BookIndex.`);
  }

  return truncate(TAB_DESCRIPTIONS[currentTab] || DEFAULT_DESCRIPTION);
}

function updateDocumentSeo() {
  if (typeof document === 'undefined') return;

  const title = buildRouteTitle();
  const description = buildRouteDescription();

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}


// --- Module: core/navigation.js ---
/**
 * @file navigation.js
 * @description Navigation actions and state synchronization
 */
/**
 * Navigate to a specific entity category.
 */
function navigateToEntity(entity) {
  if (!ENTITY_TYPES[entity]) return;
  setCurrentEntity(entity);
  const defaultTab = ENTITY_TYPES[entity].tabs[0];
  setCurrentTab(defaultTab);
  setSelectedItem(null);
  setSearchQuery('');
  
  cleanupActiveVizModule();
  syncNavigationState();
  
  // Note: render functions are called by the hashchange listener in entry.js
}

/**
 * Navigate to a specific tab within the current entity.
 */
function navigateToTab(tab) {
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !conf.tabs.includes(tab)) return;
  
  setCurrentTab(tab);
  syncNavigationState();
}

/**
 * Global back button handler.
 */
function navigateBack() {
  if (typeof window !== 'undefined' && window.history) {
    window.history.back();
  }
}

/**
 * Open a specific lecture page.
 */
function openLecturePage(index) {
  const idx = Math.max(0, index);
  setCurrentEntity('materials');
  setCurrentTab('lecture_pages');
  setCurrentLecture(idx);
  
  syncNavigationState();
}

/**
 * Open a specific glossary term.
 */
function openLectureTerm(term) {
  setCurrentEntity('materials');
  setCurrentTab('glossary');
  setSearchQuery(term.toLowerCase());
  
  syncNavigationState();
}

/**
 * Navigate to a specific item and show its card.
 */
function navigateToItem(type, head) {
  setSelectedItem(head);
  setSelectedItemType(type);
  setRightPaneMode('card');
  setCurrentTab('list'); // Usually cards are viewed in the list tab's right pane
  
  syncNavigationState();
}

/**
 * Filter the list by a specific chapter.
 */
function filterByChapter(chapterName) {
  const ch = (APP_DATA.chapters || []).find(c => c.name === chapterName);
  if (!ch) return;
  const query = `@ch:"${chapterName}"`;
  setSearchQuery(query);
  
  syncNavigationState();
}

/**
 * Get items for a specific chapter/lecture.
 */
function getItemsForChapter(type, chapter) {
  const items = ENTITY_TYPES[type]?.items || [];
  if (!chapter) return [];
  return items.filter(it => {
    const pages = it.page_list || [];
    return pages.some(p => p >= chapter.start && p <= chapter.end);
  });
}


// --- Module: core/viz.js ---
/**
 * @file viz.js
 * @description Visualization lifecycle and shell management
 */
/**
 * Cleanup the currently active visualization module by calling its cleanup function.
 */
function cleanupActiveVizModule() {
  if (typeof currentVizCleanup === 'function') {
    try {
      currentVizCleanup();
    } catch (e) {
      console.error('[viz] cleanup error:', e);
    }
  }
  setCurrentVizCleanup(null);
  
  if (typeof window !== 'undefined' && window.__vizCache) {
    // Optional: partial cache clear if needed in the future
  }
}


// --- Module: renderers/scholar.js ---
/**
 * @file scholar.js
 * @description Renderer for the Professional Scholar Panel
 */
/**
 * Render the Scholar Panel.
 */
function renderScholarPanel(container) {
  const s = APP_DATA.scholar || {};
  const scholarViewportWidth = (typeof window !== 'undefined' && typeof window.innerWidth === 'number') ? window.innerWidth : 1280;
  
  let html = '<div class="panel active scholar-panel"><div class="scholar-inner">';
  html += '<h2 class="scholar-title">Профессиональный аппарат</h2>';
  html += '<div class="scholar-intro">Дополнительные материалы для взрослого читателя, студента-лингвиста, преподавателя и специалиста-русиста.</div>';

  // 1. TOC
  const sections = [
    ['biblio', '1. Библиография работ Зализняка'],
    ['extended_cards', '2. Расширенные сведения о ключевых лингвистах'],
    ['controversies', '3. Спорные вопросы и дискуссионные места'],
    ['original', '4. Оригинальные формы по языкам'],
    ['birch', '5. Конкорданс берестяных грамот'],
    ['chronology', '6. Хронология лингвистических открытий'],
    ['isoglosses', '7. Изоглоссы русских диалектов'],
    ['slovo', '8. Аргументация о подлинности «Слова о полку Игореве»'],
    ['accents', '9. Акцентологические парадигмы Зализняка'],
    ['correspondences', '10. Сравнительная таблица фонетических соответствий'],
    ['reconstructions', '11. Реконструкции'],
  ];
  html += '<div class="scholar-toc">';
  for (const [id, title] of sections) {
    html += `<a class="scholar-toc-link" href="#sch-${id}">${escapeHtml(title)}</a>`;
  }
  html += '</div>';

  // 1. Bibliography
  html += '<h3 id="sch-biblio" class="scholar-section-title">1. Библиография работ Зализняка по темам лекций</h3>';
  html += '<div class="scholar-section-intro">Каждая лекция в книге — выжимка из академических работ Зализняка. Здесь — ключевые публикации, где темы изложены подробнее.</div>';
  for (const lec of (s.bibliography || [])) {
    html += `<div class="scholar-card">
      <div class="scholar-card-title">Лекция «${escapeHtml(lec.lecture)}»</div>`;
    for (const w of lec.works) {
      html += `<div class="scholar-work">
        <strong>${escapeHtml(w.title)}</strong> (${escapeHtml(String(w.year))})${w.url ? ` <a class="related-link" href="${escapeHtml(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer">PDF/страница ↗</a>` : ''}<br>
        <span class="scholar-note">${escapeHtml(w.note)}</span>
      </div>`;
    }
    html += '</div>';
  }

  // 2. Extended Cards (Linguists)
  html += '<h3 id="sch-extended_cards" class="scholar-section-title scholar-section-title-spaced">2. Расширенные сведения о ключевых лингвистах</h3>';
  html += '<div class="scholar-section-intro">Подробные карточки лингвистов доступны в разделе «Имена».</div>';
  html += '<div>';
  const keyLinguists = ['Вакернагель Я.','Гримм Я.','Вернер К.','Раск Р. К.','Бопп Фр.','Мейе А.','Шампольон Ф.','Вентрис М.','Янин В. Л.','Гиппиус А. А.','Аванесов Р. И.','Дыбо В. А.','Иллич-Свитыч В. М.','Падучева Е. В.'];
  for (const name of keyLinguists) {
    html += `<a class="scholar-link scholar-chip-link" data-type="names" data-head="${escapeHtml(name)}" href="${escapeHtml(buildItemHash('names', name))}">${escapeHtml(name)}</a>`;
  }
  html += '</div>';

  // 3. Controversies
  html += '<h3 id="sch-controversies" class="scholar-section-title scholar-section-title-spaced">3. Спорные вопросы и дискуссионные места</h3>';
  for (const c of (s.controversies || [])) {
    const controversyPageMeta = c.page
      ? renderTextWithPageLinks(`стр. ${c.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-card scholar-controversy-card">
      <div class="scholar-controversy-title">${escapeHtml(c.topic)}${controversyPageMeta ? ` <span class="scholar-muted-meta">· ${controversyPageMeta}</span>` : ''}</div>
      <div class="scholar-controversy-desc">${escapeHtml(c.description)}</div>
      <div class="scholar-controversy-sides"><strong>Стороны:</strong> ${escapeHtml(c.sides)}</div>
    </div>`;
  }

  // 4. Original Forms
  html += '<h3 id="sch-original" class="scholar-section-title scholar-section-title-spaced">4. Оригинальные формы по языкам</h3>';
  const langLabels = {sanskrit:'Санскрит',greek:'Древнегреческий',latin:'Латинский',arabic:'Арабский',old_russian:'Древнерусский'};
  html += '<div class="scholar-grid">';
  for (const [key, label] of Object.entries(langLabels)) {
    const forms = (s.original_forms || {})[key] || [];
    html += `<div class="scholar-card">
      <div class="scholar-card-title">${label}</div>`;
    for (const f of forms) {
      const formPageMeta = f.page
        ? renderTextWithPageLinks(`стр. ${f.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
        : '';
      html += `<div class="scholar-original-form"><span class="scholar-original-word">${renderAccentSafe(f.form)}</span> — ${escapeHtml(f.translation)}${formPageMeta ? ` <span class="scholar-muted-meta">(${formPageMeta})</span>` : ''}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // 5. Birchbark Concordance
  const birchRows = (s.birch_grammar || []).map((g) => {
    const rawUrl = String(g.url || '');
    const cityMatch = rawUrl.match(/show\/([^/]+)\//i);
    const city = cityMatch ? cityMatch[1].toLowerCase() : 'unknown';
    const yearText = String(g.year || '');
    const centuryMatch = yearText.toUpperCase().match(/X{1,3}(?:I{0,3}|V?I{0,3})/);
    const century = centuryMatch ? `${centuryMatch[0]} в.` : 'не указано';
    return { ...g, city, century };
  });
  const birchCities = Array.from(new Set(birchRows.map(r => r.city))).sort(compareHeadsRu);
  const birchCenturies = Array.from(new Set(birchRows.map(r => r.century))).sort(compareHeadsRu);
  html += '<h3 id="sch-birch" class="scholar-section-title scholar-section-title-spaced">5. Конкорданс берестяных грамот</h3>';
  html += '<table class="scholar-table">';
  html += '<thead><tr class="scholar-table-head-row"><th>№</th><th>Город</th><th>Дата</th><th>Содержание</th><th>Стр.</th></tr></thead><tbody id="birch-concordance-body">';
  for (const g of birchRows) {
    const birchLink = g.url ? `<a class="related-link" href="${escapeHtml(safeUrl(g.url))}" target="_blank" rel="noopener noreferrer">№${escapeHtml(g.num)} ↗</a>` : `№${escapeHtml(g.num)}`;
    html += `<tr class="birch-row scholar-table-row" data-city="${escapeHtml(g.city)}" data-century="${escapeHtml(g.century)}" data-num="${escapeHtml(String(g.num || ''))}">
      <td class="scholar-table-key">${birchLink}</td>
      <td class="scholar-table-muted">${escapeHtml(g.city)}</td>
      <td class="scholar-table-muted">${escapeHtml(g.year)}</td>
      <td>${escapeHtml(g.content)}</td>
      <td class="scholar-table-page">${g.page ? renderTextWithPageLinks(`стр. ${g.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' }) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // 6. Chronology
  html += '<h3 id="sch-chronology" class="scholar-section-title scholar-section-title-spaced">6. Хронология лингвистических открытий</h3>';
  for (const ev of (s.chronology || [])) {
    const chronologyPageMeta = ev.page
      ? renderTextWithPageLinks(`стр. ${ev.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-chronology-row">
      <div class="scholar-chronology-year">${escapeHtml(ev.year)}</div>
      <div class="scholar-chronology-event">${escapeHtml(ev.event)}${chronologyPageMeta ? `<span class="scholar-muted-meta"> · ${chronologyPageMeta}</span>` : ''}</div>
    </div>`;
  }

  // 7. Isoglosses
  html += '<h3 id="sch-isoglosses" class="scholar-section-title scholar-section-title-spaced">7. Изоглоссы русских диалектов</h3>';
  for (const i of (s.isoglosses || [])) {
    const isoglossPageMeta = i.page
      ? renderTextWithPageLinks(`стр. ${i.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-card scholar-isogloss-card">
      <div class="scholar-card-title">${escapeHtml(i.name)}${isoglossPageMeta ? ` <span class="scholar-muted-meta">· ${isoglossPageMeta}</span>` : ''}</div>
      <div class="scholar-body-text">${escapeHtml(i.description)}</div>
    </div>`;
  }

  // 8. Slovo o Polku Igoreve
  html += '<h3 id="sch-slovo" class="scholar-section-title scholar-section-title-spaced">8. Аргументация Зализняка о подлинности «Слова о полку Игореве»</h3>';
  if (s.slovo) {
    html += `<div class="scholar-slovo-card">
      <div class="scholar-slovo-thesis">${escapeHtml(s.slovo.thesis)}</div>
      ${s.slovo.context ? `<div class="scholar-slovo-context">${escapeHtml(s.slovo.context)}</div>` : ''}
      <div class="scholar-slovo-opponents"><strong>Оппоненты:</strong> ${escapeHtml(s.slovo.opponents)}</div>
      <div class="scholar-slovo-verdict">${escapeHtml(s.slovo.verdict)}</div>
    </div>`;
  }

  html += '</div></div>';
  container.innerHTML = html;
}

/**
 * Render the Chronology of Discoveries Panel.
 */
function renderScholarChronologyPanel(container) {
  const events = APP_DATA.scholar?.chronology || [];
  let html = `<div class="panel active chronology-panel"><div class="chronology-inner">
    <h2 class="chronology-title">Хронология лингвистических событий</h2>
    <div class="chronology-list">`;
  
  events.forEach(ev => {
    html += `
      <div class="chronology-event">
        <div class="chronology-event-year">${escapeHtml(String(ev.year))}</div>
        <div class="chronology-event-text">${escapeHtml(ev.event)}</div>
      </div>`;
  });

  html += '</div></div></div>';
  container.innerHTML = html;
}

/**
 * Render the Page Trends Panel.
 */
function renderPageTrendsPanel(container) {
  container.innerHTML = `<div class="panel active page-trends-panel"><div class="page-trends-inner">
    <h2 class="page-trends-title">Динамика упоминаний</h2>
    <p class="page-trends-intro">Распределение всех упоминаний по страницам книги.</p>
    <div id="page-trends-chart" class="page-trends-chart"></div>
  </div></div>`;
  
  const chart = container.querySelector('#page-trends-chart');
  if (!chart) return;
  
  // Simple sparkline-like representation
  chart.innerHTML = '<p class="panel-muted-message">График динамики загружается...</p>';
}


// --- Module: renderers/materials.js ---
/**
 * @file materials.js
 * @description Renderer for the Materials and Lectures Panel
 */
/**
 * Render the Lectures Panel.
 */
function renderLecturesPanel(container) {
  const lectures = APP_DATA.lectures || [];
  const stats = APP_DATA.book_stats || {};
  const maxPage = Number(stats.total_pages) || getTotalBookPages();
  
  let html = '<div class="panel active lectures-panel"><div class="lectures-inner">';
  html += '<h2 class="lectures-title">Все лекции книги — за пять минут</h2>';
  html += '<div class="lectures-intro">Краткие резюме: 10 лекций + предисловие.</div>';
  
  html += `<div class="reading-now-box">
    <div class="reading-now-title">Режим «Читаю сейчас»</div>
    <div class="reading-now-desc">Введите номер страницы, и мы покажем, кто и что на ней упоминается.</div>
    <div class="reading-now-controls">
      <button id="reading-page-prev" class="reading-now-btn">←</button>
      <input id="reading-page-input" class="reading-now-input" type="number" min="1" max="${escapeHtml(maxPage)}" step="1" />
      <button id="reading-page-next" class="reading-now-btn">→</button>
      <button id="reading-page-go" class="reading-now-btn">Показать</button>
    </div>
    <div id="reading-now-results" class="reading-now-results"></div>
  </div>`;

  html += '<div id="lectures-grid" class="lectures-grid">';
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i];
    const title = i === 0 ? 'Предисловие' : `Лекция ${i}`;
    const cardClass = i === 0 ? 'lecture-card preface' : 'lecture-card';
    html += `<div class="${cardClass}" data-idx="${i}">
      <div class="lecture-card-meta">${title} · стр. ${escapeHtml(l.pages)}</div>
      <div class="lecture-card-title">${escapeHtml(l.name)}</div>
      <div class="lecture-card-idea">${escapeHtml(l.main_idea)}</div>
    </div>`;
  }
  html += '</div></div></div>';
  
  container.innerHTML = html;
  wireReadingNowWidget(container, maxPage);
  
  container.querySelectorAll('.lecture-card').forEach(card => {
    card.onclick = () => openLecturePage(parseInt(card.dataset.idx || '0', 10));
  });
}

function wireReadingNowWidget(root, totalPages) {
  const readingInput = root.querySelector('#reading-page-input');
  const readingGo = root.querySelector('#reading-page-go');
  const readingPrev = root.querySelector('#reading-page-prev');
  const readingNext = root.querySelector('#reading-page-next');
  const readingResults = root.querySelector('#reading-now-results');
  
  if (!readingInput || !readingGo || !readingResults) return;
  
  const clamp = (p) => Math.max(1, Math.min(totalPages, parseInt(String(p || '1'), 10) || 1));
  
  const renderResults = (page) => {
    const p = clamp(page);
    saveReadingPage(p);
    readingInput.value = String(p);
    
    const groups = collectReadingNow(p, 7);
    let out = `<div class="reading-now-page-title"><strong>Страница ${p}</strong></div>`;
    
    if (!groups.length) {
      out += '<div class="reading-now-empty">Ничего не найдено.</div>';
    } else {
      for (const g of groups) {
        out += `<div class="reading-now-group"><strong>${escapeHtml(g.label)}:</strong> `;
        for (const it of g.items) {
          out += `<a class="reading-now-link" data-type="${escapeHtml(g.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(g.type, it.head))}">${escapeHtml(it.head)}</a> `;
        }
        out += `</div>`;
      }
    }
    readingResults.innerHTML = out;
  };
  
  const saved = getSavedReadingPage();
  const startPage = saved ? clamp(saved) : 1;
  renderResults(startPage);
  
  readingGo.onclick = () => renderResults(readingInput.value);
  if (readingPrev) readingPrev.onclick = () => renderResults(parseInt(readingInput.value, 10) - 1);
  if (readingNext) readingNext.onclick = () => renderResults(parseInt(readingInput.value, 10) + 1);
}

/**
 * Render the Glossary Panel.
 */
function renderGlossaryPanel(container) {
  const glossary = APP_DATA.glossary || [];
  let html = '<div class="panel active glossary-panel"><div class="glossary-inner">';
  html += '<h2 class="glossary-title">Глоссарий терминов</h2>';
  html += '<div class="glossary-intro">Учебные определения лингвистических терминов, используемых в книге.</div>';
  
  for (const g of glossary) {
    html += `<div class="glossary-entry">
      <div class="glossary-entry-head">${escapeHtml(g.term)}</div>
      <div class="glossary-definition">${g.definition}</div>
    </div>`;
  }
  
  html += '</div></div>';
  container.innerHTML = html;
}

/**
 * Render the KWIC Panel.
 */
function renderKwicPanel(container) {
  const totalPages = getTotalBookPages();
  
  container.innerHTML = `<div class="panel active kwic-panel">
    <div class="kwic-inner">
      <h2 class="kwic-title">KWIC-конкорданс</h2>
      <div class="kwic-intro">Key Word In Context: ключевое слово в окружении.</div>
      <div class="kwic-controls">
        <label class="kwic-field">Запрос <input id="kwic-query" type="text" value="${escapeHtml(currentKwicQuery)}" class="kwic-input"></label>
        <button id="kwic-run" class="kwic-run-btn">Показать</button>
      </div>
      <div id="kwic-results" class="kwic-results"></div>
    </div>
  </div>`;
  
  const resultsEl = container.querySelector('#kwic-results');
  const runBtn = container.querySelector('#kwic-run');
  const queryInput = container.querySelector('#kwic-query');
  
  runBtn.onclick = () => {
    setCurrentKwicQuery(queryInput.value);
    // Logic for KWIC results collection would go here
    resultsEl.innerHTML = '<p class="panel-muted-message">Результаты поиска...</p>';
  };
}

/**
 * Render the Further Reading Panel.
 */
function renderFurtherReadingPanel(container) {
  const sections = APP_DATA.further_reading || [];
  let html = '<div class="panel active further-reading-panel"><div class="further-reading-inner">';
  html += '<h2 class="further-reading-title">Что почитать ещё</h2>';
  html += '<div class="further-reading-intro">Навигатор по научно-популярным и базовым лингвистическим книгам.</div>';
  html += '<div class="further-reading-grid">';
  
  for (const sec of sections) {
    html += `<div class="further-reading-card">
      <div class="further-reading-topic">${escapeHtml(sec.topic || '')}</div>`;
    for (const b of (sec.books || [])) {
      html += `<div class="further-reading-book">
        <div class="further-reading-book-title">${escapeHtml(b.title || '')}</div>
        <div class="further-reading-book-why">${escapeHtml(b.why || '')}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div></div></div>';
  container.innerHTML = html;
}

/**
 * Render the Lecture Comparison Panel.
 */
function renderLectureComparePanel(container) {
  const chapters = APP_DATA.chapters || [];
  if (chapters.length < 2) {
    container.innerHTML = '<div class="panel active"><div class="panel-empty-state">Недостаточно лекций для сравнения.</div></div>';
    return;
  }

  const chapterA = chapters[lectureCompareA] || chapters[0];
  const chapterB = chapters[lectureCompareB] || chapters[1];
  
  const types = [
    { key: 'names', label: 'Имена' },
    { key: 'toponyms', label: 'Топонимы' },
    { key: 'ethnonyms', label: 'Этнонимы' },
    { key: 'languages', label: 'Языки' },
    { key: 'lexicon', label: 'Лексика' },
    { key: 'subject', label: 'Предметный' },
  ];

  let html = '<div class="panel active lecture-compare-panel"><div class="lecture-compare-inner">';
  html += '<h2 class="lecture-compare-title">Сравнение двух лекций</h2>';
  html += '<div class="lecture-compare-grid">';

  for (const t of types) {
    const itemsA = getItemsForChapter(t.key, chapterA);
    const itemsB = getItemsForChapter(t.key, chapterB);
    const setA = new Set(itemsA.map(it => it.head));
    const setB = new Set(itemsB.map(it => it.head));
    const inter = [...setA].filter(h => setB.has(h)).sort(compareHeadsRu);
    
    html += `<div class="lecture-compare-card">
      <div class="lecture-compare-card-title">${t.label}</div>
      <div class="lecture-compare-card-meta">Общие: <strong>${inter.length}</strong></div>
      <div class="lecture-compare-link-row">
        ${inter.slice(0, 10).map(h => `<a class="lecture-compare-link" href="${buildItemHash(t.key, h)}">${escapeHtml(h)}</a>`).join('')}
        ${inter.length > 10 ? `<span class="lecture-compare-more">+${inter.length - 10}</span>` : ''}
      </div>
    </div>`;
  }

  html += '</div></div></div>';
  container.innerHTML = html;
}

/**
 * Render an individual Lecture Page Panel.
 */
function renderLecturePagePanel(container) {
  container.innerHTML = '<div class="panel active"><p class="panel-muted-message">Раздел в разработке.</p></div>';
}


// --- Module: renderers/home.js ---
/**
 * @file home.js
 * @description Renderer for the Application Home Panel
 */
/**
 * Render the Home Panel.
 */
function renderHomePanel(container) {
  const stats = APP_DATA.book_stats || {};
  const routes = APP_DATA.routes || [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const totalPages = getTotalBookPages();
  
  let html = `<div class="panel active home-panel"><div class="home-panel-inner">`;

  // 1. Stats Hero
  html += `<div class="home-stats-hero">
    <h2 class="home-stats-title">Книга в цифрах</h2>
    <div class="home-stats-subtitle">Что внутри ${escapeHtml(totalPages)} страниц лекций А. А. Зализняка</div>
    <div id="home-stats-grid" class="home-stats-grid">`;

  const cells = [
    [String(totalPages), 'страницы'],
    [stats.has_preface ? '10 + 1' : String(stats.lectures || 10), 'лекций'],
    [stats.names, 'имён'],
    [stats.languages, 'языков'],
    [stats.toponyms, 'топонимов'],
    [stats.lexicon?.toLocaleString('ru') || '0', 'лексем'],
  ];
  for (const [num, label] of cells) {
    html += `<div class="home-stat-cell"><div class="home-stat-num">${num}</div><div class="home-stat-label">${label}</div></div>`;
  }
  html += '</div></div>';

  // 2. Featured Quote
  html += `<div class="home-facts">
    <div class="home-featured-quote">
      <div class="home-featured-quote-text">«${escapeHtml(featured.text)}»</div>
      <div class="home-featured-meta">— ${renderTextWithPageLinks(`стр. ${featured.page}`, { className: 'home-featured-page-link', rangeTarget: 'trends' })}, лекция «${escapeHtml(featured.lecture)}»</div>
    </div>
  </div>`;

  // 3. How-to Guide
  html += buildHomeHowToGuideHtml();

  html += '</div></div>';
  container.innerHTML = html;
}

function buildHomeHowToGuideHtml() {
  const udarenieAllHash = buildListSearchHash('all', 'ударение');
  const subjectListHash = buildListSearchHash('subject', '');
  const corpusBooks = getCorpusBooks();
  const videoCatalog = getPlannedVideoCatalogSource();
  const corpusBookCount = corpusBooks.length || 1;
  
  const videoCount = videoCatalog?.planned_count || 0;
  const corpusSummary = `Сейчас корпусная модель держит ${corpusBookCount} книг(у).`;

  return `<div class="home-howto">
    <h3 class="home-howto-h3">Как пользоваться «Зализнякиадой»</h3>
    <p>${escapeHtml(corpusSummary)}</p>
    <ul class="home-howto-list">
      <li>Начните с глобального поиска: попробуйте <a href="${escapeHtml(udarenieAllHash)}" class="home-howto-link">ударение</a>.</li>
      <li>Откройте <a href="${escapeHtml(subjectListHash)}" class="home-howto-link">предметный указатель</a>.</li>
    </ul>
  </div>`;
}


// --- Module: renderers/specialized.js ---
/**
 * @file specialized.js
 * @description Specialized visualizations (Cards grid, Histogram, Timeline, etc.)
 */
/**
 * Render the Cards Grid Panel.
 */
function renderCardsPanel(container) {
  container.innerHTML = '<div class="panel active"><div class="cards-grid-container"><div class="cards-grid" id="cards-grid"></div></div></div>';
  const grid = document.getElementById('cards-grid');
  if (!grid) return;
  const items = ENTITY_TYPES[currentEntity]?.items || [];
  const sorted = [...items].sort(compareItemsByHead);
  for (const it of sorted) {
    const card = document.createElement('div');
    card.className = 'mini-card';
    if (currentEntity === 'names') card.style.borderTopColor = safeColor(COLORS[it.subcategory], '#8a7050');
    let cat = '';
    if (currentEntity === 'names') cat = LABELS[it.subcategory] || '';
    else if (currentEntity === 'toponyms') cat = 'Топоним';
    else if (currentEntity === 'ethnonyms') cat = 'Этноним';
    else if (currentEntity === 'languages') cat = it.family || 'Язык';
    const pages = it.pages || it.head_pages || '';
    const head = document.createElement('div');
    head.className = 'mc-head';
    head.textContent = String(it.head || '');
    if (it.discussed) {
      const discussed = document.createElement('span');
      discussed.className = 'mc-discussed';
      discussed.textContent = 'обсуждается';
      head.appendChild(discussed);
    }
    const catEl = document.createElement('div');
    catEl.className = 'mc-cat';
    catEl.textContent = String(cat || '');
    const pagesEl = document.createElement('div');
    pagesEl.className = 'mc-pages';
    pagesEl.textContent = `стр. ${String(pages || '')}`;
    card.appendChild(head);
    card.appendChild(catEl);
    card.appendChild(pagesEl);
    card.onclick = () => navigateToItem(currentEntity, it.head);
    grid.appendChild(card);
  }
}

/**
 * Render the Histogram Panel.
 */
function renderHistogramPanel(container) {
  const t0 = nowMs();
  const focusedItem = getFocusedHistogramItem(currentEntity);
  const introText = buildHistogramIntroText(currentEntity, focusedItem);
  const introHtml = introText ? `<p class="chart-intro">${escapeHtml(introText)}</p>` : '';
  
  container.innerHTML = `<div class="panel active"><div class="chart">
    ${introHtml}
    <div id="histogram"></div></div></div>`;
  
  const chart = document.getElementById('histogram');
  if (!chart) return;
  
  renderChapterHistogramRows(chart, currentEntity, focusedItem);
  
  chart.querySelectorAll('.bar-fill').forEach(bar => {
    bar.onclick = () => filterByChapter(bar.dataset.chapter);
  });
  
  perfDebug('render-histogram', nowMs() - t0, currentEntity);
}

function getFocusedHistogramItem(entityKey) {
  if (!selectedItem || !entityKey) return null;
  const type = selectedItemType || entityKey;
  if (type !== entityKey) return null;
  return findRegistryItem(selectedItem, entityKey);
}

function buildHistogramIntroText(entityKey, focusedItem) {
  if (focusedItem && focusedItem.head) {
    return `Распределение упоминаний «${focusedItem.head}» по лекциям книги.`;
  }
  return `Распределение элементов раздела по лекциям книги.`;
}

function renderChapterHistogramRows(host, entityKey, focusedItem = null) {
  const stats = getChapterHistogramStats(entityKey, focusedItem);
  const counts = stats.counts;
  const max = stats.max || 1;
  let html = '';
  const chapters = APP_DATA?.chapters || [];
  for (const ch of chapters) {
    const c = counts[ch.name] || 0;
    const pct = (c / max) * 100;
    html += `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(ch.name)}<br><small>стр. ${ch.start}–${ch.end}</small></div>
        <div class="bar-bg"><div class="bar-fill" data-chapter="${escapeHtml(ch.name)}" style="width:${pct}%"></div></div>
        <div class="bar-count">${c}</div>
      </div>`;
  }
  host.innerHTML = html;
}

function getChapterHistogramStats(entityKey, focusedItem = null) {
  const focusKey = focusedItem && focusedItem.head ? normalizeHeadForMatch(focusedItem.head) : '*';
  const key = `${entityKey}::${focusKey}::${getDataSignature()}`;
  
  return getCachedAggregate('histogram', key, () => {
    const counts = {};
    const chapters = APP_DATA?.chapters || [];
    let max = 0;
    
    if (focusedItem && Array.isArray(focusedItem.page_list)) {
      const pages = sortUniquePages(focusedItem.page_list);
      for (const ch of chapters) {
        let hit = 0;
        for (const p of pages) {
          if (p >= ch.start && p <= ch.end) hit++;
        }
        counts[ch.name] = hit;
        if (hit > max) max = hit;
      }
    } else {
      const items = ENTITY_TYPES[entityKey]?.items || [];
      for (const it of items) {
        const pages = sortUniquePages(it.page_list || []);
        const itemChapters = new Set();
        for (const p of pages) {
          const ch = chapters.find(c => p >= c.start && p <= c.end);
          if (ch) itemChapters.add(ch.name);
        }
        for (const chName of itemChapters) {
          counts[chName] = (counts[chName] || 0) + 1;
          if (counts[chName] > max) max = counts[chName];
        }
      }
    }
    return { counts, max };
  });
}

/**
 * Render the Timeline Panel.
 */
function renderTimelinePanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Имена на оси времени по векам. Каждая точка — одно имя; цвет показывает категорию. Кликните, чтобы открыть карточку.</p>
    <div id="timeline"></div>
    <div class="legend" id="timeline-legend"></div></div></div>`;
  
  const tl = document.getElementById('timeline');
  if (!tl) return;
  
  const items = ENTITY_TYPES[currentEntity]?.items || [];
  const withEpoch = items.filter(n => n.epoch !== null && n.epoch !== undefined);
  if (withEpoch.length === 0) { 
    tl.innerHTML = '<p class="panel-muted-message">Нет данных для временной шкалы.</p>'; 
    return; 
  }
  withEpoch.sort((a, b) => a.epoch - b.epoch);

  const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
  const isNarrow = vw < 1000;
  const ticks = [-1500, -500, 0, 500, 1000, 1500, 1700, 1850, 1900, 1950, 2000, 2025];
  
  if (isNarrow) {
    // Vertical timeline
    const padL = 100, padR = 20, padT = 20, rowH = 28;
    const W = Math.max(480, vw - 80);
    const H = padT + withEpoch.length * rowH + 20;
    let svg = `<svg class="timeline-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - 20}" stroke="#8a7050" stroke-width="2"/>`;
    
    for (let i = 0; i < withEpoch.length; i++) {
      const n = withEpoch[i];
      const y = padT + 10 + i * rowH;
      const color = safeColor(COLORS[n.subcategory], '#888');
      const epochLabel = n.epoch < 0 ? (-n.epoch) + ' до н.э.' : String(n.epoch);
      svg += `<text x="${padL - 8}" y="${y + 4}" fill="#888" font-size="10" text-anchor="end">${epochLabel}</text>`;
      svg += `<g class="timeline-point" data-head="${escapeHtml(n.head)}">
        <circle cx="${padL}" cy="${y}" r="5" fill="${color}" stroke="white" stroke-width="1.5"></circle>
        <text x="${padL + 10}" y="${y + 4}" fill="#1a1a1a" font-size="12">${escapeHtml(n.head)}</text>
      </g>`;
    }
    svg += '</svg>';
    tl.innerHTML = svg;
  } else {
    // Horizontal timeline
    const W = Math.max(1200, vw - 100);
    const padL = 80, padR = 60, padT = 40, rowH = 22;
    const epochToX = (e) => {
      for (let i = 0; i < ticks.length - 1; i++) {
        if (e >= ticks[i] && e <= ticks[i+1]) {
          const t = (e - ticks[i]) / (ticks[i+1] - ticks[i]);
          return padL + (i + t) / (ticks.length - 1) * (W - padL - padR);
        }
      }
      return e < ticks[0] ? padL : W - padR;
    };

    const placed = [];
    let maxRow = 0;
    for (const n of withEpoch) {
      const x = epochToX(n.epoch);
      let row = 0;
      while (placed.some(p => p.row === row && Math.abs(p.x - x) < 80)) row++;
      placed.push({ n, x, row });
      if (row > maxRow) maxRow = row;
    }

    const H = padT + (maxRow + 1) * rowH + 40;
    let svg = `<svg class="timeline-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    
    for (const t of ticks) {
      const x = epochToX(t);
      svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - 30}" stroke="#eee" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${H - 10}" fill="#aaa" font-size="10" text-anchor="middle">${t < 0 ? (-t)+' до н.э.' : t}</text>`;
    }

    for (const p of placed) {
      const y = padT + p.row * rowH;
      const color = safeColor(COLORS[p.n.subcategory], '#888');
      svg += `<g class="timeline-point" data-head="${escapeHtml(p.n.head)}">
        <circle cx="${p.x}" cy="${y}" r="4" fill="${color}" stroke="white" stroke-width="1"></circle>
        <text x="${p.x + 6}" y="${y + 4}" fill="#333" font-size="11">${escapeHtml(p.n.head)}</text>
      </g>`;
    }
    svg += '</svg>';
    tl.innerHTML = svg;
  }
  
  tl.querySelectorAll('.timeline-point').forEach(g => {
    g.onclick = () => navigateToItem(currentEntity, g.dataset.head);
  });
}

/**
 * Render the Heatmap Panel.
 */
function renderHeatmapPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="heatmap-container">
    <p class="chart-intro">Сетка «элемент × страница книги» (только обсуждаемые, топ-50). Цветные ячейки — упоминания.</p>
    <div id="heatmap"></div></div></div>`;
  
  const hm = document.getElementById('heatmap');
  if (!hm) return;
  
  const top = getHeatmapTopItems(currentEntity, 50);
  const totalPages = getTotalBookPages();
  
  const cellW = 2.2, cellH = 14, labelW = 220;
  const W = labelW + totalPages * cellW + 30;
  const H = top.length * cellH + 40;

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  const chapters = APP_DATA?.chapters || [];
  
  for (const ch of chapters) {
    const x1 = labelW + (ch.start - 1) * cellW;
    const x2 = labelW + ch.end * cellW;
    svg += `<rect x="${x1}" y="0" width="${x2-x1}" height="${H - 20}" fill="#fbf6e8" />`;
    svg += `<line x1="${x2}" y1="0" x2="${x2}" y2="${H - 20}" stroke="#e8dfc5" stroke-width="1"/>`;
  }
  
  let chIdx = 0;
  for (const ch of chapters) {
    const xMid = labelW + ((ch.start + ch.end) / 2) * cellW;
    const shortName = ch.name.length > 18 ? ch.name.slice(0, 16) + '…' : ch.name;
    const yLabel = (chIdx % 2 === 0) ? H - 12 : H - 2;
    svg += `<text x="${xMid}" y="${yLabel}" fill="#888" font-size="9" text-anchor="middle">${escapeHtml(shortName)}</text>`;
    chIdx++;
  }
  
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    const y = i * cellH + 8;
    const label = it.head.length > 30 ? it.head.slice(0, 28) + '…' : it.head;
    svg += `<text x="${labelW - 6}" y="${y + 4}" fill="#1a1a1a" font-size="10" text-anchor="end">${escapeHtml(label)}</text>`;
    const color = currentEntity === 'names' ? safeColor(COLORS[it.subcategory], '#888') : '#5a3818';
    for (const p of (it.page_list || [])) {
      const x = labelW + (p - 1) * cellW;
      svg += `<rect x="${x}" y="${y - 4}" width="${Math.max(2.5, cellW)}" height="${cellH - 4}" fill="${color}" opacity="0.85"><title>${escapeHtml(it.head)} · стр. ${p}</title></rect>`;
    }
  }
  svg += '</svg>';
  hm.innerHTML = svg;
  
  perfDebug('render-heatmap', nowMs() - t0, currentEntity);
}

function getHeatmapTopItems(entityKey, limit = 50) {
  const key = `${entityKey}:${limit}:${getDataSignature()}`;
  return getCachedAggregate('heatmap', key, () => {
    const items = ENTITY_TYPES[entityKey]?.items || [];
    const sorted = [...items].sort((a, b) => {
      if (!!b.discussed !== !!a.discussed) return (b.discussed ? 1 : 0) - (a.discussed ? 1 : 0);
      return (b.page_list || []).length - (a.page_list || []).length;
    });
    return sorted.slice(0, limit);
  });
}


// --- Module: renderers/graph.js ---
/**
 * @file graph.js
 * @description Graph visualizations (Names and Families)
 */
let nameGraphWorker = null;
let nameGraphWorkerBlobUrl = null;

/**
 * Render the Names Graph Panel.
 */
function renderGraphPanel(container) {
  const t0 = nowMs();
  const edgesRaw = APP_DATA.edges || [];
  const maxEdgeWeight = edgesRaw.reduce((mx, e) => Math.max(mx, Number(e.weight) || 0), 0);
  const sliderMax = Math.max(2, Math.ceil(maxEdgeWeight * 10) / 10);
  
  const minWeightLabel = (Math.round(nameGraphMinEdgeWeight * 10) / 10).toFixed(1);

  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Граф связей имён: близость упоминаний в тексте.</p>
    <div class="graph-toolbar">
      <label class="graph-range">порог веса
        <input id="graph-min-weight" type="range" min="0" max="${sliderMax.toFixed(1)}" step="0.1" value="${minWeightLabel}">
        <strong id="graph-min-weight-value">${minWeightLabel}</strong>
      </label>
    </div>
    <div id="graph-status" class="graph-status">Вычисление раскладки...</div>
    <div id="graph-summary" class="graph-summary" aria-live="polite"></div>
    <div id="graph-stage" aria-label="Граф связей имен"></div>
    <div id="graph-tooltip" class="graph-tooltip" hidden></div>
  </div></div>`;

  const slider = document.getElementById('graph-min-weight');
  const sliderValue = document.getElementById('graph-min-weight-value');
  const status = document.getElementById('graph-status');
  const stage = document.getElementById('graph-stage');
  const W = 1200;
  const H = 620;
  
  if (slider) {
    slider.oninput = () => {
      setNameGraphMinEdgeWeight(Number(slider.value));
      if (sliderValue) sliderValue.textContent = slider.value;
      renderGraphPanel(container);
    };
  }

  if (typeof d3 === 'undefined') {
    if (status) status.textContent = 'D3.js недоступен.';
    if (status) status.textContent = 'Loading D3.js...';
    loadScriptOnce('./vendor/d3.v7.min.js')
      .then(() => {
        if (container && container.isConnected) renderGraphPanel(container);
      })
      .catch(() => {
        if (status) status.textContent = 'D3.js unavailable.';
      });
    return;
  }

  runNameGraphLayout(nameGraphMinEdgeWeight, W, H).then(layout => {
    if (!stage) return;
    status.style.display = 'none';
    const summary = document.getElementById('graph-summary');
    if (summary) {
      summary.textContent = `${layout.nodes.length} nodes, ${layout.validEdges.length} links, min weight ${minWeightLabel}`;
    }
    renderNameGraphSvg(stage, layout, W, H);
    perfDebug('render-graph-names', nowMs() - t0, `min=${nameGraphMinEdgeWeight}`);
  }).catch(err => {
    if (status) status.textContent = `Ошибка: ${err.message}`;
  });
}

async function runNameGraphLayout(minWeight, W, H) {
  const key = `${minWeight.toFixed(2)}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-names', key, async () => {
    return new Promise((resolve, reject) => {
      ensureNameGraphWorker();
      const requestId = Math.random().toString(36).slice(2);
      
      const onMsg = (e) => {
        if (e.data.requestId === requestId) {
          nameGraphWorker.removeEventListener('message', onMsg);
          if (e.data.ok) resolve(e.data.layout);
          else reject(new Error(e.data.error || 'worker failed'));
        }
      };
      nameGraphWorker.addEventListener('message', onMsg);
      nameGraphWorker.postMessage({
        requestId,
        minWeight,
        W, H,
        names: APP_DATA.names || [],
        edges: APP_DATA.edges || []
      });
    });
  });
}

function ensureNameGraphWorker() {
  if (nameGraphWorker) return;
  const script = getNameGraphWorkerScript();
  const blob = new Blob([script], { type: 'application/javascript' });
  nameGraphWorkerBlobUrl = URL.createObjectURL(blob);
  nameGraphWorker = new Worker(nameGraphWorkerBlobUrl);
}

function renderNameGraphSvg(host, layout, W, H) {
  const svg = d3.select(host).append('svg')
    .attr('viewBox', [0, 0, W, H])
    .attr('width', '100%')
    .attr('height', 'auto');

  const g = svg.append('g');

  const link = g.append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(layout.validEdges)
    .join('line')
    .attr('x1', d => layout.nodes[layout.idx[d.source]].x)
    .attr('y1', d => layout.nodes[layout.idx[d.source]].y)
    .attr('x2', d => layout.nodes[layout.idx[d.target]].x)
    .attr('y2', d => layout.nodes[layout.idx[d.target]].y)
    .attr('stroke-width', d => Math.sqrt(d.weight));

  const node = g.append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(layout.nodes)
    .join('circle')
    .attr('class', 'name-graph-node')
    .attr('tabindex', 0)
    .attr('r', 5)
    .attr('fill', d => safeColor(COLORS[d.subcat], '#888'))
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .on('mouseenter focus', (event, d) => showNameGraphTooltip(event, d))
    .on('mousemove', (event, d) => showNameGraphTooltip(event, d))
    .on('mouseleave blur', hideNameGraphTooltip)
    .on('click', (event, d) => {
      event.preventDefault();
      if (typeof window !== 'undefined') window.location.hash = buildItemHash('names', d.name);
    });

  node.append('title').text(d => d.name);
}

function showNameGraphTooltip(event, node) {
  const tooltip = document.getElementById('graph-tooltip');
  if (!tooltip || !node) return;
  tooltip.hidden = false;
  tooltip.textContent = node.name;
  const x = Number(event?.clientX || 0) + 12;
  const y = Number(event?.clientY || 0) + 12;
  tooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function hideNameGraphTooltip() {
  const tooltip = document.getElementById('graph-tooltip');
  if (tooltip) tooltip.hidden = true;
}

function getNameGraphWorkerScript() {
  return `
function seed(text, salt) {
  var h = (2166136261 ^ salt) >>> 0;
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
self.onmessage = function(event) {
  var data = event.data || {};
  var requestId = data.requestId;
  try {
    var minWeight = Number(data.minWeight) || 0;
    var W = Number(data.W) || 1200;
    var H = Number(data.H) || 600;
    var names = data.names || [];
    var edges = (data.edges || []).filter(e => Number(e.weight || 0) >= minWeight);
    var connected = new Set();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    var nodes = names.filter(n => connected.has(n.head)).map(n => ({
      name: n.head,
      subcat: n.subcategory || '',
      weight: Number(n.page_list?.length || 0),
      x: W/2 + (seed(n.head+':x', 11)-0.5)*W*0.8,
      y: H/2 + (seed(n.head+':y', 23)-0.5)*H*0.8,
      vx: 0, vy: 0
    }));
    var idx = {}; nodes.forEach((n, i) => idx[n.name] = i);
    var validEdges = edges.filter(e => idx[e.source] !== undefined && idx[e.target] !== undefined);
    function step() {
      for (var i=0; i<nodes.length; i++) {
        for (var j=i+1; j<nodes.length; j++) {
          var a=nodes[i], b=nodes[j], dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy+0.01, d=Math.sqrt(d2), f=1000/d2;
          a.vx-=dx/d*f; a.vy-=dy/d*f; b.vx+=dx/d*f; b.vy+=dy/d*f;
        }
      }
      validEdges.forEach(e => {
        var a=nodes[idx[e.source]], b=nodes[idx[e.target]], dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01, f=(d-90)*0.01*Math.sqrt(e.weight||0);
        a.vx+=dx/d*f; a.vy+=dy/d*f; b.vx-=dx/d*f; b.vy-=dy/d*f;
      });
      nodes.forEach(n => {
        n.vx+=(W/2-n.x)*0.001; n.vy+=(H/2-n.y)*0.001; n.vx*=0.85; n.vy*=0.85; n.x+=n.vx; n.y+=n.vy;
        n.x=Math.max(40, Math.min(W-40, n.x)); n.y=Math.max(40, Math.min(H-40, n.y));
      });
    }
    for (var s=0; s<300; s++) step();
    self.postMessage({ requestId: requestId, ok: true, layout: { nodes, idx, validEdges } });
  } catch(e) { self.postMessage({ requestId, ok: false, error: e.message }); }
};`;
}

let familiesGraphWorker = null;
let familiesGraphWorkerBlobUrl = null;

/**
 * Render the Families Graph Panel (Canvas).
 */
function renderFamiliesPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Граф языков: соединены языки, упоминаемые близко в тексте. По умолчанию вес ≥ 10.</p>
    <div class="graph-filter-row"><button class="filter-chip ${graphStrongOnly ? 'active' : ''}" id="lang-strong-btn">только сильные связи (вес ≥ 50)</button></div>
    <div id="families-status" class="graph-status">Рассчитываю расположение узлов…</div>
    <canvas id="graph-canvas" width="1300" height="650"></canvas>
    <div class="legend" id="families-legend"></div></div></div>`;

  const btn = document.getElementById('lang-strong-btn');
  if (btn) {
    btn.onclick = () => {
      setGraphStrongOnly(!graphStrongOnly);
      renderFamiliesPanel(container);
    };
  }

  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const status = document.getElementById('families-status');

  runFamiliesGraphLayout(graphStrongOnly, W, H).then(layout => {
    if (status) status.style.display = 'none';
    renderFamiliesGraphCanvas(canvas, ctx, layout, W, H);
    perfDebug('render-graph-families', nowMs() - t0, graphStrongOnly ? 'strong' : 'all');
  }).catch(err => {
    if (status) status.textContent = `Ошибка: ${err.message}`;
  });
}

async function runFamiliesGraphLayout(strongOnly, W, H) {
  const key = `${strongOnly ? 1 : 0}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-families', key, async () => {
    return new Promise((resolve, reject) => {
      ensureFamiliesGraphWorker();
      const requestId = Math.random().toString(36).slice(2);
      const onMsg = (e) => {
        if (e.data.requestId === requestId) {
          familiesGraphWorker.removeEventListener('message', onMsg);
          if (e.data.ok) resolve(e.data.layout);
          else reject(new Error(e.data.error || 'worker failed'));
        }
      };
      familiesGraphWorker.addEventListener('message', onMsg);
      familiesGraphWorker.postMessage({
        requestId,
        strongOnly,
        W, H,
        languages: APP_DATA.languages || [],
        edges: APP_DATA.language_edges || []
      });
    });
  });
}

function ensureFamiliesGraphWorker() {
  if (familiesGraphWorker) return;
  const script = getFamiliesGraphWorkerScript();
  const blob = new Blob([script], { type: 'application/javascript' });
  familiesGraphWorkerBlobUrl = URL.createObjectURL(blob);
  familiesGraphWorker = new Worker(familiesGraphWorkerBlobUrl);
}

function renderFamiliesGraphCanvas(canvas, ctx, layout, W, H) {
  const nodes = layout.nodes;
  const idx = layout.idx;
  const edges = layout.validEdges;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    
    // Draw edges
    ctx.strokeStyle = 'rgba(150,150,150,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const e of edges) {
      const a = nodes[idx[e.source]], b = nodes[idx[e.target]];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // Draw nodes
    for (const n of nodes) {
      ctx.fillStyle = safeColor(FAMILY_COLORS[n.family], '#888');
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  draw();
}

function getFamiliesGraphWorkerScript() {
  return `
self.onmessage = function(event) {
  var data = event.data || {};
  var requestId = data.requestId;
  try {
    var strongOnly = !!data.strongOnly;
    var W = data.W || 1300, H = data.H || 650;
    var items = data.languages || [];
    var rawEdges = data.edges || [];
    var edges = rawEdges.filter(e => (e.weight || 0) >= (strongOnly ? 50 : 10));
    var connected = new Set();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    var nodes = items.filter(l => connected.has(l.head)).map(l => ({
      name: l.head, family: l.family || 'Other', x: W/2, y: H/2, vx: 0, vy: 0
    }));
    var idx = {}; nodes.forEach((n, i) => idx[n.name] = i);
    var validEdges = edges.filter(e => idx[e.source] !== undefined && idx[e.target] !== undefined);
    function step() {
      for (var i=0; i<nodes.length; i++) {
        for (var j=i+1; j<nodes.length; j++) {
          var a=nodes[i], b=nodes[j], dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy+0.01, d=Math.sqrt(d2);
          if (d > 250) continue;
          var f = 800/d2; a.vx-=dx/d*f; a.vy-=dy/d*f; b.vx+=dx/d*f; b.vy+=dy/d*f;
        }
      }
      validEdges.forEach(e => {
        var a=nodes[idx[e.source]], b=nodes[idx[e.target]], dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01, f=(d-60)*0.02;
        a.vx+=dx/d*f; a.vy+=dy/d*f; b.vx-=dx/d*f; b.vy-=dy/d*f;
      });
      nodes.forEach(n => {
        n.vx*=0.8; n.vy*=0.8; n.x+=n.vx; n.y+=n.vy;
        n.x=Math.max(60, Math.min(W-60, n.x)); n.y=Math.max(60, Math.min(H-60, n.y));
      });
    }
    for (var s=0; s<200; s++) step();
    self.postMessage({ requestId, ok: true, layout: { nodes, idx, validEdges } });
  } catch(e) { self.postMessage({ requestId, ok: false, error: e.message }); }
};`;
}


// --- Module: renderers/card.js ---
/**
 * @file card.js
 * @description Detailed entity card renderer and right pane management.
 */
/**
 * Main dispatcher for the right pane content.
 */
function renderRightContent() {
  const host = getRightContentHost();
  if (!host) return;
  
  if (rightPaneMode === 'card' && selectedItem) {
    renderCardInRight(host);
  } else {
    renderHistogramInRight(host);
  }
  
  if (isMobileViewport()) {
    setMobileSheetOpen(rightPaneMode === 'card' && !!selectedItem);
  } else {
    setMobileSheetOpen(false);
  }
}

/**
 * Render the detailed item card in the specified host.
 */
function renderCardInRight(container) {
  const it = findRegistryItem(selectedItem, selectedItemType || currentEntity);
  if (!it) {
    container.innerHTML = '<div class="panel-muted-message">Элемент не найден.</div>';
    return;
  }
  
  const eType = selectedItemType || currentEntity;
  let category = LABELS[it.subcategory] || it.subcategory || '';
  if (eType === 'toponyms') category = 'Топоним';
  else if (eType === 'ethnonyms') category = 'Этноним';
  else if (eType === 'languages') category = it.family || 'Язык';
  
  const allPages = sortUniquePages(it.page_list || []);
  const pageLinksHtml = buildCardPageLinksHtml(allPages);
  
  let html = `
    <div class="card">
      <div class="card-header">
        <div class="card-title-block">
          <h2>${renderAccentSafe(it.head)}</h2>
          <div class="card-meta-row">
            <div class="category">${escapeHtml(category)}</div>
          </div>
        </div>
      </div>
      
      <div class="card-body">
        <div class="card-pages-section">
          <div class="card-section-title">Упоминания (стр. ${allPages.length})</div>
          <div class="card-page-links">
            ${pageLinksHtml}
          </div>
        </div>
        
        ${it.description ? `<div class="card-desc">${it.description}</div>` : ''}
        
        <div class="card-stats-strip">
          <span><strong>${allPages.length}</strong> <em>pages</em></span>
          <span><strong>${countItemContexts(it)}</strong> <em>contexts</em></span>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Wire up page links
  container.querySelectorAll('.card-page-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        // Handle page navigation
        console.log('Navigate to page', page);
      }
    };
  });
}

function buildCardPageLinksHtml(pages, maxLinks = 40) {
  if (!pages || !pages.length) return '<span class="panel-muted-text">нет страниц</span>';
  const display = pages.slice(0, maxLinks);
  let html = display.map(p => `<span class="card-page-link" data-page="${p}">${p}</span>`).join(' ');
  if (pages.length > maxLinks) {
    html += ` <span class="card-page-more">... и ещё ${pages.length - maxLinks}</span>`;
  }
  return html;
}

function countItemContexts(it) {
  let count = 0;
  if (it.context) count++;
  if (Array.isArray(it.contexts)) count += it.contexts.length;
  if (it.extra_contexts) count += it.extra_contexts.length;
  return count;
}

/**
 * Render the histogram in the right pane context.
 */
function renderHistogramInRight(container) {
  renderHistogramPanel(container);
}


// --- Module: renderers/geo.js ---
/**
 * @file geo.js
 * @description Map visualizations (Toponyms, Ethnonyms, Languages)
 */
/**
 * Render the Map Panel.
 */
function renderMapPanel(container) {
  const type = currentEntity;
  const selectedHeadForMap = selectedItemType === type ? String(selectedItem || '').trim() : '';
  let note, items, colorFn, radiusFn;
  
  if (type === 'toponyms') {
    note = 'Топонимы лекций на карте мира. Размер точки — число упоминаний; цвет — историческая эпоха.';
    items = (APP_DATA.toponyms || []).filter(t => Number.isFinite(t.lat));
    colorFn = t => safeColor(EPOCH_COLORS[t.epoch_class], '#888');
    radiusFn = t => 4 + Math.sqrt((t.page_list || []).length) * 1.5;
  } else if (type === 'ethnonyms') {
    note = 'Народы, упоминаемые в лекциях. Размер — число упоминаний.';
    items = (APP_DATA.ethnonyms || []).filter(t => Number.isFinite(t.lat));
    colorFn = t => (t.discussed ? '#c0392b' : '#3a6ea5');
    radiusFn = t => 4 + Math.sqrt((t.page_list || []).length) * 1.5;
  } else if (type === 'languages') {
    note = 'Языки на карте мира. Цвет — языковая семья. Размер — число упоминаний.';
    items = (APP_DATA.languages || []).filter(t => Number.isFinite(t.lat));
    colorFn = l => safeColor(FAMILY_COLORS[l.family], '#888');
    radiusFn = l => 4 + Math.sqrt((l.page_list || []).length) * 1.3;
  } else {
    note = 'Карта'; items = []; colorFn = () => '#888'; radiusFn = () => 6;
  }

  container.innerHTML = `<div class="panel active"><div class="map-container">
    <p class="chart-intro">${note}</p>
    <div id="leaflet-map" class="leaflet-map-host"></div>
  </div></div>`;

  if (typeof L === 'undefined') {
    const mapEl = document.getElementById('leaflet-map');
    if (mapEl) mapEl.textContent = 'Loading map...';
    loadScriptOnce('./vendor/leaflet.js')
      .then(() => {
        if (container && container.isConnected) renderMapPanel(container);
      })
      .catch(() => renderOfflineMap(mapEl, items, colorFn, radiusFn, selectedHeadForMap));
    return;
  }

  // Initialize Leaflet
  setTimeout(() => {
    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return;
    
    try {
      const map = L.map('leaflet-map').setView([40, 30], 3);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO'
      }).addTo(map);

      items.forEach(it => {
        const isFocused = selectedHeadForMap && String(it.head || '') === selectedHeadForMap;
        const marker = L.circleMarker([it.lat, it.lon], {
          radius: radiusFn(it),
          color: isFocused ? '#1f2933' : 'white',
          weight: isFocused ? 2.5 : 1.5,
          fillColor: colorFn(it),
          fillOpacity: 0.8,
        }).addTo(map);
        
        marker.bindTooltip(`<strong>${escapeHtml(it.head)}</strong>`, { sticky: true });
      });
    } catch (e) {
      console.error('Leaflet error', e);
      renderOfflineMap(mapEl, items, colorFn, radiusFn, selectedHeadForMap);
    }
  }, 50);
}

function renderOfflineMap(container, items, colorFn, radiusFn, selectedHead) {
  if (!container) return;
  const W = 1100, H = 600;
  function project(lat, lon) {
    const x = ((lon + 180) / 360) * W;
    const y = ((85 - lat) / 145) * H;
    return [x, y];
  }
  
  let svg = `<svg class="offline-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  items.forEach(it => {
    const [x, y] = project(it.lat, it.lon);
    const isFocused = selectedHead && String(it.head || '') === selectedHead;
    svg += `<circle cx="${x}" cy="${y}" r="${radiusFn(it)}" fill="${colorFn(it)}" fill-opacity="0.7" stroke="${isFocused ? '#000' : '#fff'}" stroke-width="${isFocused ? 2 : 1}">
      <title>${escapeHtml(it.head)}</title>
    </circle>`;
  });
  svg += '</svg>';
  container.innerHTML = svg;
}


// --- Module: renderers/tree.js ---
/**
 * @file tree.js
 * @description Language genealogy tree visualization.
 */
/**
 * Render the Language Tree Panel.
 */
function renderTreePanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Генеалогическое древо языков: семья → группа → язык.</p>
    <div id="lang-tree" class="language-tree-host"></div>
  </div></div>`;
  
  const host = document.getElementById('lang-tree');
  const tree = APP_DATA.language_tree;
  if (!tree || !host) {
    if (host) host.innerHTML = '<p class="panel-muted-message">Данные древа отсутствуют.</p>';
    return;
  }

  const rowH = 22;
  const col1 = 20, col2 = 220, col3 = 480;
  const W = 1000;
  let y = 40;
  const positioned = [];
  
  // Calculate layout
  tree.forEach(fam => {
    const famStartY = y;
    fam.children.forEach(grp => {
      const grpStartY = y;
      grp.children.forEach(lang => {
        positioned.push({
          famName: fam.name,
          grpName: grp.name,
          langName: lang.name,
          discussed: lang.discussed,
          y: y
        });
        y += rowH;
      });
      grp.midY = (grpStartY + y - rowH) / 2;
    });
    fam.midY = (famStartY + y - rowH) / 2;
    y += 15;
  });

  const H = y + 40;
  let svg = `<svg class="language-tree-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  
  tree.forEach(fam => {
    const famColor = safeColor(FAMILY_COLORS[fam.name], '#888');
    svg += `<text x="${col1}" y="${fam.midY + 5}" fill="${famColor}" font-size="14" font-weight="bold">${escapeHtml(fam.name)}</text>`;
    
    fam.children.forEach(grp => {
      svg += `<path d="M ${col1 + 160} ${fam.midY} C ${col2 - 40} ${fam.midY}, ${col2 - 40} ${grp.midY}, ${col2} ${grp.midY}" fill="none" stroke="${famColor}" stroke-width="1.5" opacity="0.4"/>`;
      svg += `<text x="${col2}" y="${grp.midY + 4}" fill="#5a3818" font-size="12" font-style="italic">${escapeHtml(grp.name)}</text>`;
      
      grp.children.forEach(lang => {
        const p = positioned.find(node => node.famName === fam.name && node.grpName === grp.name && node.langName === lang.name);
        if (!p) return;
        svg += `<path d="M ${col2 + 220} ${grp.midY} C ${col3 - 40} ${grp.midY}, ${col3 - 40} ${p.y}, ${col3} ${p.y}" fill="none" stroke="${famColor}" stroke-width="1" opacity="0.2"/>`;
        svg += `<g class="tree-node" data-head="${escapeHtml(lang.name)}">
          <circle cx="${col3 - 8}" cy="${p.y}" r="3.5" fill="${famColor}"/>
          <text x="${col3}" y="${p.y + 5}" fill="#1a1a1a" font-size="13" ${p.discussed ? 'font-weight="bold"' : ''}>${escapeHtml(lang.name)}</text>
        </g>`;
      });
    });
  });
  
  svg += '</svg>';
  host.innerHTML = svg;
  
  // Wire up clicks
  host.querySelectorAll('.tree-node').forEach(node => {
    node.onclick = () => {
      navigateToItem('languages', node.dataset.head);
    };
  });
}


// --- Module: renderers/linguistics_tools.js ---
/**
 * @file linguistics_tools.js
 * @description Advanced linguistic tools: Russian Evolution, Phonetic Laws, and Gallery
 */
/**
 * Render the Gallery of Linguists Panel.
 */
function renderGalleryPanel(container) {
  const gallery = APP_DATA.gallery || [];
  let html = `<div class="panel active gallery-panel"><div class="gallery-inner">
    <h2 class="gallery-title">Галерея лингвистов</h2>
    <p class="gallery-intro">Ученые, чьи труды и биографии обсуждаются в лекциях А. А. Зализняка.</p>
    <div class="gallery-grid">`;
  
  gallery.forEach(p => {
    const photoUrl = safeUrl(p.photo_url || '');
    html += `
      <div class="gallery-card">
        <img class="gallery-card-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(p.name || 'Лингвист')}" loading="lazy" decoding="async">
        <div class="gallery-info">
          <div class="gallery-name">${escapeHtml(p.name)}</div>
          <div class="gallery-years">${escapeHtml(p.years || '')}</div>
          <div class="gallery-desc">${escapeHtml(p.description || '')}</div>
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}

/**
 * Render the Russian Evolution Panel.
 */
function renderRussianEvolutionPanel(container) {
  const evolution = APP_DATA.russian_evolution || [];
  let html = `<div class="panel active evolution-panel"><div class="evolution-inner">
    <h2 class="evolution-title">Эволюция русского языка</h2>
    <p class="evolution-intro">Основные этапы развития фонетики и грамматики от праславянского до современного русского.</p>
    <div class="evolution-timeline">`;

  evolution.forEach(stage => {
    html += `
      <div class="evolution-stage">
        <div class="evolution-stage-header">
          <div class="evolution-stage-title">${escapeHtml(stage.title)}</div>
          <div class="evolution-stage-period">${escapeHtml(stage.period || '')}</div>
        </div>
        <div class="evolution-stage-desc">${escapeHtml(stage.description || '')}</div>
        <div class="evolution-changes">
          ${(stage.changes || []).map(ch => `<div class="evolution-change">
            <span class="evolution-change-label">${escapeHtml(ch.label)}:</span> ${escapeHtml(ch.detail)}
          </div>`).join('')}
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}

/**
 * Render the Phonetic Laws Panel.
 */
function renderPhoneticLawsPanel(container) {
  const laws = APP_DATA.phonetic_laws || [];
  let html = `<div class="panel active laws-panel"><div class="laws-inner">
    <h2 class="laws-title">Фонетические законы и переходы</h2>
    <p class="laws-intro">Систематизация регулярных звуковых соответствий, упоминаемых в книге.</p>
    <div class="laws-list">`;

  laws.forEach(law => {
    html += `
      <div class="law-entry">
        <div class="law-head">${escapeHtml(law.head)}</div>
        <div class="law-desc">${escapeHtml(law.description || '')}</div>
        <div class="law-examples">
          ${(law.examples || []).map(ex => `<div class="law-example">
            <span class="law-example-source">${escapeHtml(ex.source)}</span> →
            <span class="law-example-target">${escapeHtml(ex.target)}</span>
            <span class="law-example-comment">(${escapeHtml(ex.comment || '')})</span>
          </div>`).join('')}
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}


// --- Module: renderers/tasks.js ---
/**
 * @file tasks.js
 * @description Interactive linguistics practice and self-verification tasks
 */
/**
 * Render the Tasks Panel.
 */
function renderTasksPanel(container, options = {}) {
  const baseTasks = Array.isArray(APP_DATA.tasks) ? APP_DATA.tasks : [];
  let html = '<div class="panel active tasks-panel"><div class="tasks-panel-inner">';
  html += '<h2 class="tasks-title">Проверьте себя</h2>';
  html += `<div class="tasks-toolbar-note">${baseTasks.length} базовых вопросов.</div>`;
  html += '<div id="tasks-container"></div></div></div>';
  container.innerHTML = html;

  const tc = document.getElementById('tasks-container');
  if (!tc) return;

  baseTasks.forEach((t, ti) => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-card';
    taskDiv.innerHTML = `
      <div class="task-card-question">Вопрос ${ti + 1}. ${escapeHtml(t.question)}</div>
      <div class="task-options" id="task-${ti}-opts"></div>
      <div class="task-result" id="task-${ti}-res"></div>
    `;
    tc.appendChild(taskDiv);
    
    const optsDiv = taskDiv.querySelector(`#task-${ti}-opts`);
    (t.options || []).forEach((opt, oi) => {
      const btn = document.createElement('button');
      btn.className = 'task-option-btn';
      btn.textContent = String.fromCharCode(65 + oi) + '. ' + opt;
      btn.onclick = () => {
        if (optsDiv.dataset.locked === '1') return;
        optsDiv.dataset.locked = '1';
        const isCorrect = oi === t.correct;
        optsDiv.querySelectorAll('button').forEach(b => {
          b.disabled = true;
          b.classList.add('locked');
        });
        if (isCorrect) {
          btn.classList.add('correct');
        } else {
          btn.classList.add('incorrect');
          const correctBtn = optsDiv.querySelectorAll('button')[t.correct];
          if (correctBtn) correctBtn.classList.add('correct');
        }
        const res = taskDiv.querySelector(`#task-${ti}-res`);
        res.classList.add('visible', isCorrect ? 'correct' : 'incorrect');
        res.textContent = isCorrect ? 'Верно!' : 'Неверно. Правильный ответ выделен.';
      };
      optsDiv.appendChild(btn);
    });
  });
}


// --- Module: renderers/corpus.js ---
/**
 * @file corpus.js
 * @description Corpus metadata, source management, and quality reporting
 */
/**
 * Render the Corpus Sources Panel.
 */
function renderCorpusSourcesPanel(container) {
  const panel = document.createElement('div');
  panel.className = 'panel corpus-panel active';

  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  const sourceTypes = Array.isArray(registry.source_types) ? registry.source_types : [];
  const plannedVideo = getPlannedVideoCatalogSource();

  panel.innerHTML = `
    <div class="corpus-panel-header">
      <h2>Источники корпуса</h2>
      <p>Текущая книга, будущие книги и видеокаталог используют один корпусный слой навигации, поиска и цитирования.</p>
    </div>
    <div class="corpus-metrics-row">
      <div class="corpus-metric"><strong>${books.length}</strong><span>книг сейчас</span></div>
      <div class="corpus-metric"><strong>${getActiveBook().title || getActiveBook().book_id}</strong><span>активный источник</span></div>
      <div class="corpus-metric"><strong>${sourceTypes.length}</strong><span>типов источников</span></div>
      <div class="corpus-metric"><strong>${plannedVideo?.planned_count || 0}</strong><span>план видео</span></div>
    </div>
    <h3 class="corpus-section-title">Книги</h3>
    <div class="corpus-sources-grid" id="books-grid"></div>
    <h3 class="corpus-section-title">Типы источников</h3>
    <div class="corpus-sources-grid corpus-source-types-grid" id="types-grid"></div>
  `;

  const booksGrid = panel.querySelector('#books-grid');
  books.forEach(book => {
    booksGrid.appendChild(createCorpusSourceCard(book));
  });

  const typesGrid = panel.querySelector('#types-grid');
  sourceTypes.forEach(type => {
    const source = {
      ...type,
      title: type.title || type.label || type.type,
      description: type.type === 'video_catalog' 
        ? 'Будущий каталог видео Зализняка с тайм-кодами и стенограммами.' 
        : (type.description || ''),
    };
    typesGrid.appendChild(createCorpusSourceCard(source, 'тип источника'));
  });

  container.appendChild(panel);
}

function createCorpusSourceCard(source, kindLabel = 'книга') {
  const card = document.createElement('div');
  card.className = 'corpus-source-card';
  if (source.status === 'active') card.classList.add('active');
  
  card.innerHTML = `
    <div class="csc-kind">${escapeHtml(kindLabel)}</div>
    <div class="csc-title">${escapeHtml(source.title)}</div>
    <div class="csc-desc">${escapeHtml(source.description || '')}</div>
    <div class="csc-meta">
      ${source.author ? `<span>${escapeHtml(source.author)}</span>` : ''}
      ${source.year ? `<span>${escapeHtml(String(source.year))}</span>` : ''}
    </div>
    <div class="csc-status-tag">${escapeHtml(source.status || 'active')}</div>
  `;
  return card;
}


// --- Module: renderers/lists.js ---
/**
 * @file lists.js
 * @description Renderers for navigation switchers and entity lists
 */
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
  const fragment = document.createDocumentFragment();
  const order = ['materials', 'scholar', 'all', 'subject', 'names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech'];
  
  for (const key of order) {
    const conf = ENTITY_TYPES[key];
    if (!conf) continue;
    const btn = document.createElement('button');
    btn.className = `entity-btn ${currentEntity === key ? 'active' : ''}`;
    btn.id = `entity-btn-${key}`;
    btn.setAttribute('type', 'button');
    const count = Array.isArray(conf.items) ? conf.items.length : 0;
    btn.innerHTML = `${escapeHtml(conf.title)}${count > 0 ? `<span class="count">${count}</span>` : ''}`;
    btn.onclick = () => navigateToEntity(key);
    fragment.appendChild(btn);
  }
  container.replaceChildren(fragment);
}

function renderTabs() {
  const container = document.getElementById('tabs');
  if (!container) return;
  const fragment = document.createDocumentFragment();
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !conf.tabs) return;
  
  for (const tab of conf.tabs) {
    const btn = document.createElement('button');
    btn.className = `tab ${tab === currentTab ? 'active' : ''}`;
    btn.id = `tab-${tab}`;
    btn.setAttribute('type', 'button');
    btn.textContent = TAB_LABELS[tab] || tab;
    btn.onclick = () => navigateToTab(tab);
    fragment.appendChild(btn);
  }
  container.replaceChildren(fragment);
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
          <div id="right-content"></div>
        </div>
      </div>
    </div>
  `;
  
  const searchInput = container.querySelector('#search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const results = intellectualSearch(e.target.value);
      const listEl = container.querySelector('#name-list');
      if (listEl) {
        listEl.innerHTML = results.map(r => `
          <div class="name-item" data-head="${escapeHtml(r.item.head)}" data-type="${r.type}">
            <div class="head">${escapeHtml(r.item.head)}</div>
            <div class="entity-type-tag">${r.type}</div>
          </div>
        `).join('');
      }
    };
  }
}

const CONTENT_RENDERERS = {
  home: renderHomePanel,
  list: renderListPanel,
  sources: renderCorpusSourcesPanel,
  lectures: renderLecturesPanel,
  lecture_compare: renderLectureComparePanel,
  lecture_pages: renderLecturePagePanel,
  tasks: renderTasksPanel,
  further_reading: renderFurtherReadingPanel,
  glossary: renderGlossaryPanel,
  kwic: renderKwicPanel,
  gallery: renderGalleryPanel,
  russian_evolution: renderRussianEvolutionPanel,
  phonetic_laws: renderPhoneticLawsPanel,
  scholar: renderScholarPanel,
  chronology: renderScholarChronologyPanel,
  page_trends: renderPageTrendsPanel,
  cards: renderCardsPanel,
  histogram: renderHistogramPanel,
  timeline: renderTimelinePanel,
  heatmap: renderHeatmapPanel,
  graph: renderGraphPanel,
  map: renderMapPanel,
  families: renderFamiliesPanel,
  tree: renderTreePanel
};

/**
 * Main content dispatcher.
 */
function renderContent() {
  const container = document.getElementById('content');
  if (!container) return;
  
  // Choose renderer based on current tab or entity
  // In v4 architecture, the 'tab' is the primary key for the renderer
  const renderer = CONTENT_RENDERERS[currentTab];
  
  if (renderer) {
    renderer(container);
  } else {
    // Fallback for missing renderers
    container.innerHTML = `<div class="panel active">
      <h2>${escapeHtml(ENTITY_TYPES[currentEntity]?.title || currentEntity)} - ${escapeHtml(TAB_LABELS[currentTab] || currentTab)}</h2>
      <p class="panel-muted-message">Этот раздел находится в разработке или был перемещен.</p>
    </div>`;
  }
  
  // Update right pane
  renderRightContent();
}


// --- Module: entry.js ---
/**
 * @file entry.js
 * @description Application entry point and initialization logic for BookIndex v13.0
 */
/* global initScholarWorkspace, initCardNotes, initPremiumIntro, injectSemanticStyles */

/**
 * Main application initialization.
 */
function initApp() {
  console.log('🚀 Zalizniakiada v3.1.0 initializing (Modular + Vite)...');
  
  try {
    // 1. Hydrate Data & Initialize Registry
    const data = parseAppData();
    hydrateStateFromStorage();
    
    // 2. Initialize Core Systems
    initSearchWorker();
    
    // Legacy integrations (until modularized)
    if (typeof initScholarWorkspace === 'function') initScholarWorkspace();
    if (typeof initCardNotes === 'function') initCardNotes();
    if (typeof initPremiumIntro === 'function') initPremiumIntro();
    if (typeof injectSemanticStyles === 'function') injectSemanticStyles();
    
    // 3. Routing & Navigation
    window.addEventListener('hashchange', () => {
      if (applyHash(window.location.hash)) {
        renderEntitySwitcher();
        renderTabs();
        renderContent();
        updateDocumentSeo();
      }
    });

    // 4. Initial Render
    const initialHash = window.location.hash || '#v4/home/home';
    applyHash(initialHash);
    renderEntitySwitcher();
    renderTabs();
    renderContent();
    updateDocumentSeo();
    
    // 5. Gamification
    checkAchievements('app_opened').then(newUnlocks => {
      newUnlocks.forEach(a => announceAchievement(a));
    });

    const versionEl = document.querySelector('.footer-version');
    if (versionEl) {
      versionEl.onclick = () => {
        checkAchievements('easter_egg_clicked').then(newUnlocks => {
          newUnlocks.forEach(a => announceAchievement(a));
        });
      };
    }
    
    console.log('✅ Zalizniakiada v3.1.0 ready.');
  } catch (e) {
    console.error('❌ App initialization failed:', e);
  }
}

// Note: renderContent is imported from ./renderers/lists.js above.

// Start the app
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}


})();
