/**
 * @file state.js
 * @description Core application state and constants for BookIndex v13.0
 */

// --- Constants ---
import { setSetting, getSetting } from './storage.js';

export const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
export const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
export const APP_DATA_SCHEMA_CURRENT = 2;
export const HASH_ROUTE_PREFIX = 'v4';

export const KWIC_MAX_SNIPPETS_PER_PAGE = 24;
export const KWIC_MAX_SNIPPET_LENGTH = 420;
export const KWIC_MAX_ROWS = 1200;

export const DEFAULT_TOTAL_PAGES = 424;
export const APP_BUILD_ID = '__APP_BUILD_ID__';
export const MAX_LIST_QUERY_LENGTH = 80;

export const DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
  'desc', 'about', 'why', 'why_read', 'description', 
  'definition', 'main_idea', 'tagline', 'event'
]);

export const LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

export const HOME_DECL_FACTORY_KEY = '__bookindexHomeDeclarativeFactory';

export const AGGREGATE_CACHE = new Map([
  ['histogram', new Map()],
  ['heatmap', new Map()],
  ['graph-names', new Map()],
  ['graph-families', new Map()]
]);

export function getDataSignature() {
  if (!APP_DATA) return 'none';
  return APP_DATA.signature || 'default';
}

export function getCachedAggregate(kind, key, computeFn) {
  const c = AGGREGATE_CACHE.get(kind);
  if (!c) return computeFn();
  if (c.has(key)) return c.get(key);
  const res = computeFn();
  c.set(key, res);
  return res;
}

// --- Graph State ---
export let nameGraphMinEdgeWeight = 1.0;
export let nameGraphRenderToken = 0;
export let familiesGraphRenderToken = 0;
export let graphStrongOnly = false;

// --- KWIC State ---
export let currentKwicQuery = '';
export let currentKwicSource = 'lexicon';
export let currentKwicSort = 'left';
export let currentKwicPageStart = 1;
export let currentKwicPageEnd = 424;
export let pendingKwicTerm = '';

// --- Mutable State (Global References) ---
export let APP_DATA = null;
export let LABELS = null;
export let COLORS = null;
export let EPOCH_LABELS = null;
export let EPOCH_COLORS = null;
export let FAMILY_COLORS = null;

// --- Lecture Compare State ---
export let lectureCompareA = 0;
export let lectureCompareB = 1;
export let currentLecture = 0;

// --- UI State ---
export let currentTab = 'home';
export let currentEntity = 'all';
export let searchQuery = '';
export let selectedItem = null;
export let selectedItemType = null;
export let rightPaneMode = 'histogram'; // 'card' or 'histogram'
export let visibleItemsCache = null;

export let historyStack = [];
export let isNavigatingHistory = false;
export let suppressHashSync = false;

export let globalSearchTimer = null;
export let globalSearchActiveIndex = -1;
export let globalSearchCache = new Map();
export let globalSearchFuse = null;
export let globalSearchFuseSignature = '';
export let globalSearchFuseDisabled = false;
export let aggregateCache = new Map();

export let scholarPins = new Set();
export let dossierMetadata = { title: '', description: '' };

export let currentVizModule = 'viz03';
export let currentVizQueryString = '';
export let currentVizCleanup = null;
export let vizCacheWarmPromise = null;
export let vizScriptLoadPromises = new Map();
export let vizScriptLoadAborts = new Map();

export let trendsRangeStart = 1;
export let trendsRangeEnd = 424;

// --- Shared Constants for Entity Types ---
export const TAB_LABELS = {
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

export const ENTITY_TYPES = {
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
export function setAppData(data) {
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

export function setGlobalSearchFuse(val) { globalSearchFuse = val; }
export function setGlobalSearchFuseSignature(val) { globalSearchFuseSignature = val; }
export function setGlobalSearchFuseDisabled(val) { globalSearchFuseDisabled = val; }
export function setVizCacheWarmPromise(val) { vizCacheWarmPromise = val; }
export function setVizScriptLoadPromises(val) { vizScriptLoadPromises = val; }
export function setCurrentVizModule(val) { 
  currentVizModule = val; 
  setSetting('currentVizModule', val);
}
export function setCurrentVizCleanup(val) { currentVizCleanup = val; }
export function setVisibleItemsCache(val) { visibleItemsCache = val; }

/**
 * Hydrate state from persistent storage.
 */
export function hydrateStateFromStorage() {
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

export function setCurrentTab(val) { currentTab = val; }
export function setCurrentEntity(val) { currentEntity = val; }
export function setSearchQuery(val) { searchQuery = val; }
export function setSelectedItem(val) { selectedItem = val; }
export function setSelectedItemType(val) { selectedItemType = val; }
export function setRightPaneMode(val) { 
  rightPaneMode = val; 
  setSetting('rightPaneMode', val);
}

export function setTrendsRangeStart(val) { 
  trendsRangeStart = val; 
  setSetting('trendsRangeStart', val);
}
export function setTrendsRangeEnd(val) { 
  trendsRangeEnd = val; 
  setSetting('trendsRangeEnd', val);
}

export function setLectureCompareA(val) { 
  lectureCompareA = val; 
  setSetting('lectureCompareA', val);
}
export function setLectureCompareB(val) { 
  lectureCompareB = val; 
  setSetting('lectureCompareB', val);
}

export function setCurrentLecture(val) {
  const next = Math.max(0, parseInt(String(val), 10) || 0);
  currentLecture = next;
  setSetting('currentLecture', next);
}

export function setNameGraphMinEdgeWeight(val) { 
  nameGraphMinEdgeWeight = val; 
  setSetting('nameGraphMinEdgeWeight', val);
}
export function setNameGraphRenderToken(val) { nameGraphRenderToken = val; }
export function setFamiliesGraphRenderToken(val) { familiesGraphRenderToken = val; }
export function setGraphStrongOnly(val) { 
  graphStrongOnly = val; 
  setSetting('graphStrongOnly', val);
}

export function setCurrentKwicQuery(val) { currentKwicQuery = val; }
export function setCurrentKwicSource(val) { 
  currentKwicSource = val; 
  setSetting('currentKwicSource', val);
}
export function setCurrentKwicSort(val) { 
  currentKwicSort = val; 
  setSetting('currentKwicSort', val);
}
export function setCurrentKwicPageStart(val) { currentKwicPageStart = val; }
export function setCurrentKwicPageEnd(val) { currentKwicPageEnd = val; }
export function setPendingKwicTerm(val) { pendingKwicTerm = val; }

export function toggleScholarPin(itemId) {
  if (scholarPins.has(itemId)) {
    scholarPins.delete(itemId);
  } else {
    scholarPins.add(itemId);
  }
  setSetting('scholarPins', Array.from(scholarPins));
}

export function getActiveBook() {
  if (!APP_DATA) return {};
  return APP_DATA.active_book || APP_DATA.activeBook || {};
}

export function getSavedReadingPage() {
  try {
    const v = localStorage.getItem('v13_reading_page');
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

export function saveReadingPage(page) {
  try {
    localStorage.setItem('v13_reading_page', String(page));
  } catch (e) {}
}
