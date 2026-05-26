// State variables and configuration constants for BookIndex

export const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
export const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
export const APP_DATA_MODULES_BASE_URL = './data/modules/';
export const APP_DATA_SCHEMA_CURRENT = 2;
export const KWIC_MAX_SNIPPETS_PER_PAGE = 24;
export const KWIC_MAX_SNIPPET_LENGTH = 420;
export const KWIC_MAX_ROWS = 1200;
export const DEFAULT_TOTAL_PAGES = 424;
export const APP_BUILD_ID = '__APP_BUILD_ID__';

export const MAX_HASH_SLUG_LENGTH = 60;
export const MAX_HASH_PART_LENGTH = 120;
export const MAX_GLOBAL_QUERY_LENGTH = 100;
export const MAX_LIST_QUERY_LENGTH = 100;
export const NORMALIZE_CACHE_LIMIT = 5000;
export const AGGREGATE_CACHE_MAX = 100;
export const MAX_HASH_PARTS = 16;
export const HASH_ROUTE_PREFIX = 'v4';

// Dynamic State Variables
export let APP_DATA = null;
export let LABELS = null;
export let COLORS = null;
export let EPOCH_LABELS = null;
export let EPOCH_COLORS = null;
export let FAMILY_COLORS = null;

export let ENTITY_TYPES = null;
export let ITEM_INDEX_EXACT = new Map();
export let ITEM_INDEX_NORMALIZED = new Map();
export let CHAPTER_ITEM_INDEX = new Map();
export let ITEM_HASH_SLUG_BY_HEAD = new Map();
export let ITEM_HASH_HEAD_BY_SLUG = new Map();
export let PAGE_TO_CHAPTER = new Map();

export let currentEntity = 'home';
export let currentTab = 'home';
export let activeFilters = new Set();
export let onlyDiscussed = false;
export let onlyQuestionCandidates = false;
export let searchQuery = '';
export let sortMostFrequentFirst = false;
export let selectedItem = null;
export let selectedItemType = null;
export let rightPaneMode = 'histogram';
export let graphStrongOnly = false;
export let nameGraphMinEdgeWeight = 0.1;
export let currentLecture = 0;
export let lectureCompareA = 1;
export let lectureCompareB = 2;
export let trendsRangeStart = 1;
export let trendsRangeEnd = DEFAULT_TOTAL_PAGES;
export let historyStack = [];
export let isNavigatingHistory = false;
export let suppressHashSync = false;
export let expectedHash = null;
export let globalSearchTimer = null;
export let globalSearchActiveIndex = -1;
export let globalSearchScope = 'corpus';
export let pendingGlossaryQuery = '';
export const getPendingGlossaryQuery = () => pendingGlossaryQuery;
export const setPendingGlossaryQuery = (v) => { pendingGlossaryQuery = v; };
export let currentGlossaryTerm = '';
export const getCurrentGlossaryTerm = () => currentGlossaryTerm;
export const setCurrentGlossaryTerm = (v) => { currentGlossaryTerm = v; };
export let pendingScholarAnchor = '';
export const getPendingScholarAnchor = () => pendingScholarAnchor;
export const setPendingScholarAnchor = (v) => { pendingScholarAnchor = v; };
export let currentScholarAnchor = '';
export const getCurrentScholarAnchor = () => currentScholarAnchor;
export const setCurrentScholarAnchor = (v) => { currentScholarAnchor = v; };
export let currentVizModule = 'viz03';
export const getCurrentVizModule = () => currentVizModule;
export const setCurrentVizModule = (v) => { currentVizModule = v; };
export let currentVizQueryString = '';
export const getCurrentVizQueryString = () => currentVizQueryString;
export const setCurrentVizQueryString = (v) => { currentVizQueryString = v; };
export let currentKwicSource = 'lexicon';
export const getCurrentKwicSource = () => currentKwicSource;
export const setCurrentKwicSource = (v) => { currentKwicSource = v; };
export let currentKwicQuery = '';
export const getCurrentKwicQuery = () => currentKwicQuery;
export const setCurrentKwicQuery = (v) => { currentKwicQuery = v; };
export let currentKwicSort = 'left';
export const getCurrentKwicSort = () => currentKwicSort;
export const setCurrentKwicSort = (v) => { currentKwicSort = v; };
export let currentKwicPageStart = 1;
export const getCurrentKwicPageStart = () => currentKwicPageStart;
export const setCurrentKwicPageStart = (v) => { currentKwicPageStart = v; };
export let currentKwicPageEnd = DEFAULT_TOTAL_PAGES;
export const getCurrentKwicPageEnd = () => currentKwicPageEnd;
export const setCurrentKwicPageEnd = (v) => { currentKwicPageEnd = v; };
export let pendingKwicTerm = '';
export const getPendingKwicTerm = () => pendingKwicTerm;
export const setPendingKwicTerm = (v) => { pendingKwicTerm = v; };

// Caches
export const normalizeHeadCache = new Map();
export const aggregateCache = new Map();
export const nameGraphLayoutPromiseCache = new Map();
export const familiesGraphLayoutPromiseCache = new Map();

// Helper setters to modify let variables from other files
export function setAppData(val) {
  APP_DATA = val;
  if (typeof window !== 'undefined') window.APP_DATA = val;
  else if (typeof globalThis !== 'undefined') globalThis.APP_DATA = val;
}
export function setLabels(val) {
  LABELS = val;
  if (typeof window !== 'undefined') window.LABELS = val;
}
export function setColors(val) {
  COLORS = val;
  if (typeof window !== 'undefined') window.COLORS = val;
}
export function setEpochLabels(val) {
  EPOCH_LABELS = val;
  if (typeof window !== 'undefined') window.EPOCH_LABELS = val;
}
export function setEpochColors(val) {
  EPOCH_COLORS = val;
  if (typeof window !== 'undefined') window.EPOCH_COLORS = val;
}
export function setFamilyColors(val) {
  FAMILY_COLORS = val;
  if (typeof window !== 'undefined') window.FAMILY_COLORS = val;
}
export function setEntityTypes(val) {
  ENTITY_TYPES = val;
  if (typeof window !== 'undefined') window.ENTITY_TYPES = val;
}
export function setItemIndexExact(val) {
  ITEM_INDEX_EXACT = val;
  if (typeof window !== 'undefined') window.ITEM_INDEX_EXACT = val;
}
export function setItemIndexNormalized(val) {
  ITEM_INDEX_NORMALIZED = val;
  if (typeof window !== 'undefined') window.ITEM_INDEX_NORMALIZED = val;
}
export function setChapterItemIndex(val) {
  CHAPTER_ITEM_INDEX = val;
  if (typeof window !== 'undefined') window.CHAPTER_ITEM_INDEX = val;
}
export function setItemHashSlugByHead(val) {
  ITEM_HASH_SLUG_BY_HEAD = val;
  if (typeof window !== 'undefined') window.ITEM_HASH_SLUG_BY_HEAD = val;
}
export function setItemHashHeadBySlug(val) {
  ITEM_HASH_HEAD_BY_SLUG = val;
  if (typeof window !== 'undefined') window.ITEM_HASH_HEAD_BY_SLUG = val;
}
export function setPageToChapter(val) {
  PAGE_TO_CHAPTER = val;
  if (typeof window !== 'undefined') window.PAGE_TO_CHAPTER = val;
}

export function setCurrentEntity(val) {
  currentEntity = val;
  if (typeof window !== 'undefined') window.currentEntity = val;
}
export function setCurrentTab(val) {
  currentTab = val;
  if (typeof window !== 'undefined') window.currentTab = val;
}
export function setActiveFilters(val) {
  activeFilters = val;
  if (typeof window !== 'undefined') window.activeFilters = val;
}
export function setOnlyDiscussed(val) {
  onlyDiscussed = val;
  if (typeof window !== 'undefined') window.onlyDiscussed = val;
}
export function setOnlyQuestionCandidates(val) {
  onlyQuestionCandidates = val;
  if (typeof window !== 'undefined') window.onlyQuestionCandidates = val;
}
export function setSearchQuery(val) {
  searchQuery = val;
  if (typeof window !== 'undefined') window.searchQuery = val;
}
export function setSortMostFrequentFirst(val) {
  sortMostFrequentFirst = val;
  if (typeof window !== 'undefined') window.sortMostFrequentFirst = val;
}
export function setSelectedItem(val) {
  selectedItem = val;
  if (typeof window !== 'undefined') window.selectedItem = val;
}
export function setSelectedItemType(val) {
  selectedItemType = val;
  if (typeof window !== 'undefined') window.selectedItemType = val;
}
export function setRightPaneMode(val) {
  rightPaneMode = val;
  if (typeof window !== 'undefined') window.rightPaneMode = val;
}
export function setGraphStrongOnly(val) {
  graphStrongOnly = val;
  if (typeof window !== 'undefined') window.graphStrongOnly = val;
}
export function setNameGraphMinEdgeWeight(val) {
  nameGraphMinEdgeWeight = val;
  if (typeof window !== 'undefined') window.nameGraphMinEdgeWeight = val;
}
export function setCurrentLecture(val) {
  currentLecture = val;
  if (typeof window !== 'undefined') window.currentLecture = val;
}
export function setLectureCompareA(val) {
  lectureCompareA = val;
  if (typeof window !== 'undefined') window.lectureCompareA = val;
}
export function setLectureCompareB(val) {
  lectureCompareB = val;
  if (typeof window !== 'undefined') window.lectureCompareB = val;
}
export function setTrendsRangeStart(val) {
  trendsRangeStart = val;
  if (typeof window !== 'undefined') window.trendsRangeStart = val;
}
export function setTrendsRangeEnd(val) {
  trendsRangeEnd = val;
  if (typeof window !== 'undefined') window.trendsRangeEnd = val;
}
export function setHistoryStack(val) {
  historyStack = val;
  if (typeof window !== 'undefined') window.historyStack = val;
}
export function setIsNavigatingHistory(val) {
  isNavigatingHistory = val;
  if (typeof window !== 'undefined') window.isNavigatingHistory = val;
}
export function setSuppressHashSync(val) {
  suppressHashSync = val;
  if (typeof window !== 'undefined') window.suppressHashSync = val;
}
export function setExpectedHash(val) {
  expectedHash = val;
  if (typeof window !== 'undefined') window.expectedHash = val;
}
export function setGlobalSearchTimer(val) {
  globalSearchTimer = val;
  if (typeof window !== 'undefined') window.globalSearchTimer = val;
}
export function setGlobalSearchActiveIndex(val) {
  globalSearchActiveIndex = val;
  if (typeof window !== 'undefined') window.globalSearchActiveIndex = val;
}
export function setGlobalSearchScope(val) {
  globalSearchScope = val;
  if (typeof window !== 'undefined') window.globalSearchScope = val;
}


// Attaches dynamic properties to window for backward compatibility with external scripts
export function syncStateToGlobal() {
  if (typeof window === 'undefined') return;
  window.APP_DATA = APP_DATA;
  window.currentEntity = currentEntity;
  window.currentTab = currentTab;
  window.activeFilters = activeFilters;
  window.onlyDiscussed = onlyDiscussed;
  window.onlyQuestionCandidates = onlyQuestionCandidates;
  window.searchQuery = searchQuery;
  window.sortMostFrequentFirst = sortMostFrequentFirst;
  window.selectedItem = selectedItem;
  window.selectedItemType = selectedItemType;
  window.rightPaneMode = rightPaneMode;
  window.currentLecture = currentLecture;
  window.lectureCompareA = lectureCompareA;
  window.lectureCompareB = lectureCompareB;
  window.trendsRangeStart = trendsRangeStart;
  window.trendsRangeEnd = trendsRangeEnd;
  window.currentVizModule = currentVizModule;
  window.currentKwicSource = currentKwicSource;
  window.currentKwicQuery = currentKwicQuery;
  window.currentKwicSort = currentKwicSort;
  window.currentKwicPageStart = currentKwicPageStart;
  window.currentKwicPageEnd = currentKwicPageEnd;
  window.globalSearchScope = globalSearchScope;
  window.pendingGlossaryQuery = pendingGlossaryQuery;
  window.currentGlossaryTerm = currentGlossaryTerm;
  window.pendingScholarAnchor = pendingScholarAnchor;
  window.currentScholarAnchor = currentScholarAnchor;
  window.currentVizQueryString = currentVizQueryString;
  window.pendingKwicTerm = pendingKwicTerm;
  window.graphStrongOnly = graphStrongOnly;
  window.nameGraphMinEdgeWeight = nameGraphMinEdgeWeight;
  window.historyStack = historyStack;
  window.isNavigatingHistory = isNavigatingHistory;
  window.suppressHashSync = suppressHashSync;
  window.expectedHash = expectedHash;
  window.globalSearchTimer = globalSearchTimer;
  window.globalSearchActiveIndex = globalSearchActiveIndex;
}

export function syncStateFromGlobal() {
  if (typeof window === 'undefined') return;
  if (window.currentEntity !== undefined) currentEntity = window.currentEntity;
  if (window.currentTab !== undefined) currentTab = window.currentTab;
  if (window.activeFilters !== undefined) activeFilters = window.activeFilters;
  if (window.onlyDiscussed !== undefined) onlyDiscussed = window.onlyDiscussed;
  if (window.onlyQuestionCandidates !== undefined) onlyQuestionCandidates = window.onlyQuestionCandidates;
  if (window.searchQuery !== undefined) searchQuery = window.searchQuery;
  if (window.sortMostFrequentFirst !== undefined) sortMostFrequentFirst = window.sortMostFrequentFirst;
  if (window.selectedItem !== undefined) selectedItem = window.selectedItem;
  if (window.selectedItemType !== undefined) selectedItemType = window.selectedItemType;
  if (window.rightPaneMode !== undefined) rightPaneMode = window.rightPaneMode;
  if (window.currentLecture !== undefined) currentLecture = window.currentLecture;
  if (window.lectureCompareA !== undefined) lectureCompareA = window.lectureCompareA;
  if (window.lectureCompareB !== undefined) lectureCompareB = window.lectureCompareB;
  if (window.trendsRangeStart !== undefined) trendsRangeStart = window.trendsRangeStart;
  if (window.trendsRangeEnd !== undefined) trendsRangeEnd = window.trendsRangeEnd;
  if (window.currentVizModule !== undefined) currentVizModule = window.currentVizModule;
  if (window.currentKwicSource !== undefined) currentKwicSource = window.currentKwicSource;
  if (window.currentKwicQuery !== undefined) currentKwicQuery = window.currentKwicQuery;
  if (window.currentKwicSort !== undefined) currentKwicSort = window.currentKwicSort;
  if (window.currentKwicPageStart !== undefined) currentKwicPageStart = window.currentKwicPageStart;
  if (window.currentKwicPageEnd !== undefined) currentKwicPageEnd = window.currentKwicPageEnd;
  if (window.globalSearchScope !== undefined) globalSearchScope = window.globalSearchScope;
  if (window.pendingGlossaryQuery !== undefined) pendingGlossaryQuery = window.pendingGlossaryQuery;
  if (window.currentGlossaryTerm !== undefined) currentGlossaryTerm = window.currentGlossaryTerm;
  if (window.pendingScholarAnchor !== undefined) pendingScholarAnchor = window.pendingScholarAnchor;
  if (window.currentScholarAnchor !== undefined) currentScholarAnchor = window.currentScholarAnchor;
  if (window.currentVizQueryString !== undefined) currentVizQueryString = window.currentVizQueryString;
  if (window.pendingKwicTerm !== undefined) pendingKwicTerm = window.pendingKwicTerm;
  if (window.graphStrongOnly !== undefined) graphStrongOnly = window.graphStrongOnly;
  if (window.nameGraphMinEdgeWeight !== undefined) nameGraphMinEdgeWeight = window.nameGraphMinEdgeWeight;
  if (window.historyStack !== undefined) historyStack = window.historyStack;
  if (window.isNavigatingHistory !== undefined) isNavigatingHistory = window.isNavigatingHistory;
  if (window.suppressHashSync !== undefined) suppressHashSync = window.suppressHashSync;
  if (window.expectedHash !== undefined) expectedHash = window.expectedHash;
  if (window.globalSearchTimer !== undefined) globalSearchTimer = window.globalSearchTimer;
  if (window.globalSearchActiveIndex !== undefined) globalSearchActiveIndex = window.globalSearchActiveIndex;
}

if (typeof window !== 'undefined') {
  window.APP_DATA = APP_DATA;
  window.LABELS = LABELS;
  window.COLORS = COLORS;
  window.EPOCH_LABELS = EPOCH_LABELS;
  window.EPOCH_COLORS = EPOCH_COLORS;
  window.FAMILY_COLORS = FAMILY_COLORS;
  window.ENTITY_TYPES = ENTITY_TYPES;
  window.currentEntity = currentEntity;
  window.currentTab = currentTab;
  window.activeFilters = activeFilters;
  window.onlyDiscussed = onlyDiscussed;
  window.onlyQuestionCandidates = onlyQuestionCandidates;
  window.searchQuery = searchQuery;
  window.sortMostFrequentFirst = sortMostFrequentFirst;
  window.selectedItem = selectedItem;
  window.selectedItemType = selectedItemType;
  window.rightPaneMode = rightPaneMode;
  window.graphStrongOnly = graphStrongOnly;
  window.nameGraphMinEdgeWeight = nameGraphMinEdgeWeight;
  window.currentLecture = currentLecture;
  window.lectureCompareA = lectureCompareA;
  window.lectureCompareB = lectureCompareB;
  window.trendsRangeStart = trendsRangeStart;
  window.trendsRangeEnd = trendsRangeEnd;
  window.historyStack = historyStack;
  window.isNavigatingHistory = isNavigatingHistory;
  window.suppressHashSync = suppressHashSync;
  window.expectedHash = expectedHash;
  window.globalSearchTimer = globalSearchTimer;
  window.globalSearchActiveIndex = globalSearchActiveIndex;
  window.globalSearchScope = globalSearchScope;
  window.pendingGlossaryQuery = pendingGlossaryQuery;
  window.currentGlossaryTerm = currentGlossaryTerm;
  window.pendingScholarAnchor = pendingScholarAnchor;
  window.currentScholarAnchor = currentScholarAnchor;
  window.currentVizModule = currentVizModule;
  window.currentVizQueryString = currentVizQueryString;
  window.currentKwicSource = currentKwicSource;
  window.currentKwicQuery = currentKwicQuery;
  window.currentKwicSort = currentKwicSort;
  window.currentKwicPageStart = currentKwicPageStart;
  window.currentKwicPageEnd = currentKwicPageEnd;
  window.pendingKwicTerm = pendingKwicTerm;
  window.normalizeHeadCache = normalizeHeadCache;
  window.aggregateCache = aggregateCache;
  window.nameGraphLayoutPromiseCache = nameGraphLayoutPromiseCache;
  window.familiesGraphLayoutPromiseCache = familiesGraphLayoutPromiseCache;
  window.ITEM_INDEX_EXACT = ITEM_INDEX_EXACT;
  window.ITEM_INDEX_NORMALIZED = ITEM_INDEX_NORMALIZED;
  window.CHAPTER_ITEM_INDEX = CHAPTER_ITEM_INDEX;
  window.ITEM_HASH_SLUG_BY_HEAD = ITEM_HASH_SLUG_BY_HEAD;
  window.ITEM_HASH_HEAD_BY_SLUG = ITEM_HASH_HEAD_BY_SLUG;
  window.PAGE_TO_CHAPTER = PAGE_TO_CHAPTER;
}

