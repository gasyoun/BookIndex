// Данные хранятся как строка и парсятся асинхронно после первого отображения интерфейса
const APP_DATA_STRING = __APP_DATA_STRING__;
let APP_DATA = null;
let LABELS = null, COLORS = null, EPOCH_LABELS = null, EPOCH_COLORS = null, FAMILY_COLORS = null;
const APP_DATA_SCHEMA_CURRENT = 2;

function parseAppData() {
  if (globalSearchCache && typeof globalSearchCache.clear === 'function') {
    globalSearchCache.clear();
  }
  APP_DATA = JSON.parse(APP_DATA_STRING);
  migrateAppDataSchema(APP_DATA);
  LABELS = APP_DATA.labels;
  COLORS = APP_DATA.colors;
  EPOCH_LABELS = APP_DATA.epoch_labels;
  EPOCH_COLORS = APP_DATA.epoch_colors;
  FAMILY_COLORS = APP_DATA.family_colors;
}

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

function normalizeAppData() {
  if (!APP_DATA) return;

  APP_DATA.labels = APP_DATA.labels || {};
  APP_DATA.colors = APP_DATA.colors || {};

  // Legacy compatibility: older datasets may still use schoolchild/lecture_host.
  APP_DATA.labels.literator = 'Носитель языка';
  APP_DATA.labels.schoolchild = 'Участник лекции';
  APP_DATA.labels.lecture_host = 'Участник лекции';
  APP_DATA.labels.participant = APP_DATA.labels.participant || APP_DATA.labels.schoolchild || APP_DATA.labels.lecture_host || 'Участник лекции';
  APP_DATA.colors.participant = APP_DATA.colors.participant || APP_DATA.colors.schoolchild || APP_DATA.colors.lecture_host || '#16a085';

  const names = Array.isArray(APP_DATA.names) ? APP_DATA.names : [];
  for (const n of names) {
    if (n.subcategory === 'schoolchild' || n.subcategory === 'lecture_host') n.subcategory = 'participant';
  }

  const editorialKeys = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech', 'subject_index'];
  for (const key of editorialKeys) {
    const arr = Array.isArray(APP_DATA[key]) ? APP_DATA[key] : [];
    for (const item of arr) {
      normalizeEditorialFlags(item);
      normalizeItemSources(item);
    }
  }

  const stats = APP_DATA.book_stats || (APP_DATA.book_stats = {});
  if (Array.isArray(APP_DATA.lectures) && stats.lectures == null) stats.lectures = APP_DATA.lectures.length;
  if (stats.has_preface == null) {
    const firstName = (APP_DATA.lectures || [])[0]?.name || '';
    stats.has_preface = firstName.toLowerCase().includes('предислов');
  }

  const currentTop = stats.top_name && names.find(n => n.head === stats.top_name.head);
  if (!stats.top_name || (currentTop && currentTop.is_moderator)) {
    const topNonModerator = [...names]
      .filter(n => !n.is_moderator)
      .sort((a, b) => ((b.page_list || []).length - (a.page_list || []).length))[0];
    if (topNonModerator) {
      stats.top_name = {
        head: topNonModerator.head,
        count: (topNonModerator.page_list || []).length,
      };
    }
  }

  APP_DATA.routes = Array.isArray(APP_DATA.routes) ? APP_DATA.routes : [];
  APP_DATA.further_reading = Array.isArray(APP_DATA.further_reading) ? APP_DATA.further_reading : [];
  APP_DATA.featured_quote = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };

  const scholar = APP_DATA.scholar || (APP_DATA.scholar = {});
  scholar.bibliography = Array.isArray(scholar.bibliography) ? scholar.bibliography : [];
  scholar.birch_grammar = Array.isArray(scholar.birch_grammar) ? scholar.birch_grammar : [];
  scholar.accent_paradigms = Array.isArray(scholar.accent_paradigms) ? scholar.accent_paradigms : [];
  scholar.sound_correspondences = Array.isArray(scholar.sound_correspondences) ? scholar.sound_correspondences : [];
  scholar.visualization_ideas = Array.isArray(scholar.visualization_ideas) ? scholar.visualization_ideas : [];
  scholar.slovo_links = Array.isArray(scholar.slovo_links) ? scholar.slovo_links : [];
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

function getFirstContextQuote(item) {
  if (!item || !item.contexts || typeof item.contexts !== 'object') return '';
  const pages = Object.keys(item.contexts).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const pg of pages) {
    const snippets = Array.isArray(item.contexts[pg]) ? item.contexts[pg] : [];
    for (const raw of snippets) {
      const text = String(raw || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
  }
  return '';
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
  if (normalized.length && !normalized.some(s => s.quote)) {
    const firstQuote = getFirstContextQuote(item);
    if (firstQuote) normalized[0].quote = firstQuote;
  }
  item.sources = normalized;
}

// =========================================================
// КОНФИГУРАЦИЯ ТИПОВ СУЩНОСТЕЙ — строится после парсинга
// =========================================================
let ENTITY_TYPES = null;
let ITEM_INDEX_EXACT = new Map();      // type -> Map(head -> item)
let ITEM_INDEX_NORMALIZED = new Map(); // type -> Map(normalizedHead -> item)
let CHAPTER_ITEM_INDEX = new Map();    // type -> Map(chapterName -> item[])

function initEntityTypes() {
  ENTITY_TYPES = {
  home: {
    title: 'Главная',
    items: [],
    tabs: ['home'],
  },
  materials: {
    title: 'Материалы',
    items: [],
    tabs: ['lectures','lecture_compare','lecture_pages','further_reading','glossary','gallery','russian_evolution','phonetic_laws','tasks'],
  },
  scholar: {
    title: 'Профессиональный аппарат',
    items: [],
    tabs: ['scholar','chronology','page_trends'],
  },
  all: {
    title: 'Сводный указатель',
    items: null,
    tabs: ['list'],
  },
  names: {
    title: 'Имена',
    items: APP_DATA.names,
    edges: APP_DATA.edges,
    tabs: ['list','cards','histogram','timeline','heatmap','graph'],
  },
  toponyms: {
    title: 'Топонимы',
    items: APP_DATA.toponyms,
    tabs: ['list','cards','histogram','epochs','map','heatmap'],
  },
  ethnonyms: {
    title: 'Этнонимы',
    items: APP_DATA.ethnonyms,
    tabs: ['list','cards','histogram','map','heatmap'],
  },
  languages: {
    title: 'Языки',
    items: APP_DATA.languages,
    tabs: ['list','cards','histogram','families','tree','map','heatmap'],
  },
  lexicon: {
    title: 'Лексика',
    items: APP_DATA.lexicon,
    tabs: ['list','histogram'],
  },
  lexicon_reverse: {
    title: 'Лексика (обратная)',
    items: APP_DATA.lexicon_reverse,
    tabs: ['list'],
  },
  lexicon_tech: {
    title: 'Реконструкции',
    items: APP_DATA.lexicon_tech,
    tabs: ['list'],
  },
  subject: {
    title: 'Предметный',
    items: APP_DATA.subject_index || [],
    tabs: ['list','histogram','heatmap'],
  },
  };
  ENTITY_TYPES.all.items = buildAllItems();
  for (const key of Object.keys(ENTITY_TYPES)) {
    indexItems(ENTITY_TYPES[key].items);
  }
  buildDataIndexes();
  invalidateAggregateCache('entity-types-init');
}

const TAB_LABELS = {
  list: 'Список',
  cards: 'Карточки',
  histogram: 'По лекциям',
  timeline: 'Шкала',
  heatmap: 'Тепловая карта',
  graph: 'Граф связей',
  map: 'Карта мира',
  epochs: 'Эпохи',
  families: 'Граф языков',
  tree: 'Древо языков',
  home: 'Главная',
  lectures: 'Лекции',
  lecture_compare: 'Сравнение лекций',
  lecture_pages: 'Страница лекции',
  tasks: 'Проверьте себя',
  further_reading: 'Что почитать ещё',
  glossary: 'Глоссарий',
  gallery: 'Галерея лингвистов',
  russian_evolution: 'Русский во времени',
  phonetic_laws: 'Фонетические законы',
  scholar: 'Профессиональный аппарат',
  chronology: 'Хронология открытий',
  page_trends: 'Динамика по страницам',
};

// Единый сводный словник: все элементы из всех типов с пометкой
function buildAllItems() {
  const all = [];
  function add(items, type, typeLabel) {
    for (const it of items) {
      all.push({...it, _entityType: type, _entityLabel: typeLabel});
    }
  }
  add(APP_DATA.names, 'names', 'имя');
  add(APP_DATA.toponyms, 'toponyms', 'топоним');
  add(APP_DATA.ethnonyms, 'ethnonyms', 'этноним');
  add(APP_DATA.languages, 'languages', 'язык');
  add(APP_DATA.lexicon, 'lexicon', 'лексема');
  add(APP_DATA.lexicon_tech, 'lexicon_tech', 'реконструкция');
  add(APP_DATA.lexicon_reverse, 'lexicon_reverse', 'лексема (обр.)');
  add(APP_DATA.subject_index || [], 'subject', 'понятие');
  return all;
}

function indexItems(items) {
  if (!items) return;
  for (const it of items) {
    if (!it._search) {
      const raw = String(it.head || '');
      it._search = raw.toLowerCase();
      it._searchNorm = normalizeHeadForMatch(raw);
    }
  }
}

function buildDataIndexes() {
  ITEM_INDEX_EXACT = new Map();
  ITEM_INDEX_NORMALIZED = new Map();
  CHAPTER_ITEM_INDEX = new Map();

  const chapters = Array.isArray(APP_DATA?.chapters) ? APP_DATA.chapters : [];
  const pageToChapter = new Map();
  for (const ch of chapters) {
    for (let p = ch.start; p <= ch.end; p++) pageToChapter.set(p, ch.name);
  }

  for (const [type, conf] of Object.entries(ENTITY_TYPES || {})) {
    if (!conf || !Array.isArray(conf.items)) continue;
    const exact = new Map();
    const normalized = new Map();
    const byChapter = new Map();
    for (const ch of chapters) byChapter.set(ch.name, []);

    for (const it of conf.items) {
      if (!it || !it.head) continue;
      if (!exact.has(it.head)) exact.set(it.head, it);
      const nHead = normalizeHeadForMatch(it.head);
      if (nHead && !normalized.has(nHead)) normalized.set(nHead, it);

      if (chapters.length) {
        const seenChapters = new Set();
        for (const p of (it.page_list || [])) {
          const chName = pageToChapter.get(p);
          if (!chName || seenChapters.has(chName)) continue;
          seenChapters.add(chName);
          byChapter.get(chName).push(it);
        }
      }
    }
    ITEM_INDEX_EXACT.set(type, exact);
    ITEM_INDEX_NORMALIZED.set(type, normalized);
    CHAPTER_ITEM_INDEX.set(type, byChapter);
  }
}

function getIndexedItem(type, head) {
  if (!type || !head) return null;
  const exact = ITEM_INDEX_EXACT.get(type);
  if (exact && exact.has(head)) return exact.get(head);
  const nHead = normalizeHeadForMatch(head);
  const normalized = ITEM_INDEX_NORMALIZED.get(type);
  if (nHead && normalized && normalized.has(nHead)) return normalized.get(nHead);
  return null;
}

function getChapterIndexedItems(type, chapterName) {
  const map = CHAPTER_ITEM_INDEX.get(type);
  if (!map) return null;
  const arr = map.get(chapterName);
  return Array.isArray(arr) ? arr : null;
}

let currentEntity = 'home';
let currentTab = 'home';
let activeFilters = new Set();
let onlyDiscussed = false;
let onlyQuestionCandidates = false;
let searchQuery = '';
let selectedItem = null;
let selectedItemType = null; // тип сущности выбранного — нужно для сводного
let rightPaneMode = 'histogram'; // 'histogram' до выбора, 'card' после
let graphStrongOnly = false;     // Фильтр графа: только вес ≥ 2
let currentLecture = 0;
let lectureCompareA = 1;
let lectureCompareB = 2;
let trendsRangeStart = 1;
let trendsRangeEnd = 404;
let historyStack = [];
let isNavigatingHistory = false;
let suppressHashSync = false;
let expectedHash = null;
let globalSearchTimer = null;
let globalSearchActiveIndex = -1;
let pendingGlossaryQuery = '';
let currentGlossaryTerm = '';
let pendingScholarAnchor = '';
let currentScholarAnchor = '';
const UI_STATE_STORAGE_KEY = 'zaliznyakiada.ui.v1';
const UI_STATE_SCHEMA_VERSION = 2;
const THEME_STORAGE_KEY = 'zaliznyakiada.theme.v1';
const DENSITY_STORAGE_KEY = 'zaliznyakiada.density.v1';
const READING_PAGE_STORAGE_KEY = 'zaliznyakiada.readingPage.v1';
const RECENT_ITEMS_STORAGE_KEY = 'zaliznyakiada.recentItems.v1';
let globalKeyHandlersWired = false;
let visibleItemsCache = null;
let currentListSearchRaw = '';
let currentListSearchNorm = '';
const MAX_HASH_PARTS = 16;
const MAX_HASH_PART_LENGTH = 220;
const MAX_LIST_QUERY_LENGTH = 80;
const MAX_GLOBAL_QUERY_LENGTH = 80;
const MAX_URL_LENGTH = 2048;
const GLOBAL_SEARCH_CACHE_MAX = 120;
const NORMALIZE_CACHE_LIMIT = 8000;
let normalizeHeadCache = new Map();
let globalSearchCache = new Map();
const AGGREGATE_CACHE_MAX = 80;
let aggregateCache = new Map();
let nameGraphWorker = null;
let nameGraphWorkerBlobUrl = null;
let nameGraphWorkerRequestId = 0;
let nameGraphRenderToken = 0;
let nameGraphLayoutPromiseCache = new Map();
let familiesGraphWorker = null;
let familiesGraphWorkerBlobUrl = null;
let familiesGraphWorkerRequestId = 0;
let familiesGraphRenderToken = 0;
let familiesGraphLayoutPromiseCache = new Map();
let workersLifecycleWired = false;

// =========================================================
// УТИЛИТЫ
// =========================================================
function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function safeSetAttr(el, name, value) {
  if (!el || typeof el.setAttribute !== 'function') return;
  el.setAttribute(name, value);
}

function perfDebug(label, ms, meta = '') {
  if (typeof console === 'undefined' || typeof console.debug !== 'function') return;
  const extra = meta ? ` · ${meta}` : '';
  console.debug(`[perf] ${label}: ${ms.toFixed(1)}ms${extra}`);
}

function deterministicUnitFromString(text, salt = 0) {
  const src = String(text || '');
  let h = (2166136261 ^ (salt >>> 0)) >>> 0;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function getDataSignature() {
  if (!APP_DATA) return 'none';
  return [
    (APP_DATA.names || []).length,
    (APP_DATA.toponyms || []).length,
    (APP_DATA.ethnonyms || []).length,
    (APP_DATA.languages || []).length,
    (APP_DATA.lexicon || []).length,
    (APP_DATA.lexicon_reverse || []).length,
    (APP_DATA.lexicon_tech || []).length,
    (APP_DATA.edges || []).length,
    (APP_DATA.language_edges || []).length,
    (APP_DATA.chapters || []).length,
  ].join('-');
}

function getCachedAggregate(kind, key, computeFn) {
  const fullKey = `${kind}::${key}`;
  if (aggregateCache.has(fullKey)) {
    perfDebug(`${kind} cache`, 0, 'hit');
    return aggregateCache.get(fullKey);
  }
  const t0 = nowMs();
  const value = computeFn();
  const dt = nowMs() - t0;
  aggregateCache.set(fullKey, value);
  if (aggregateCache.size > AGGREGATE_CACHE_MAX) {
    const oldest = aggregateCache.keys().next();
    if (!oldest.done) aggregateCache.delete(oldest.value);
  }
  perfDebug(`${kind} cache`, dt, 'miss');
  return value;
}

function invalidateAggregateCache(reason = '') {
  const hadAny = (
    aggregateCache.size > 0 ||
    nameGraphLayoutPromiseCache.size > 0 ||
    familiesGraphLayoutPromiseCache.size > 0
  );
  aggregateCache.clear();
  nameGraphLayoutPromiseCache.clear();
  familiesGraphLayoutPromiseCache.clear();
  if (hadAny) perfDebug('aggregate cache reset', 0, reason || 'clear');
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  let text = String(s);
  if (typeof text.normalize === 'function') text = text.normalize('NFC');
  return text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeUrl(url, fallback = '#') {
  if (url === null || url === undefined) return fallback;
  const raw = String(url).trim();
  if (!raw) return fallback;
  if (raw.length > MAX_URL_LENGTH) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  if (raw.startsWith('#')) return raw;
  try {
    const base = (typeof window !== 'undefined' && window.location && window.location.href)
      ? window.location.href
      : 'https://example.invalid/';
    const parsed = new URL(raw, base);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return fallback;
    return parsed.href;
  } catch (e) {
    return fallback;
  }
}

function safeImageUrl(url, fallback = '') {
  if (url === null || url === undefined) return fallback;
  const raw = String(url).trim();
  if (!raw) return fallback;
  if (raw.length > MAX_URL_LENGTH) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);/i.test(raw)) return raw;
  try {
    const base = (typeof window !== 'undefined' && window.location && window.location.href)
      ? window.location.href
      : 'https://example.invalid/';
    const parsed = new URL(raw, base);
    if (!['http:', 'https:', 'blob:'].includes(parsed.protocol)) return fallback;
    return parsed.href;
  } catch (e) {
    return fallback;
  }
}

function wireSafeImageFallback(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('img').forEach(img => {
    if (!img || img.dataset.fallbackWired === '1') return;
    img.dataset.fallbackWired = '1';
    img.addEventListener('error', () => {
      img.style.display = 'none';
    }, { once: true });
  });
}

function safeColor(value, fallback = '#888') {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
  if (/^rgba?\(\s*\d{1,3}\s*(,\s*\d{1,3}\s*){2}(,\s*(0|1|0?\.\d+)\s*)?\)$/i.test(raw)) return raw;
  if (/^hsla?\(\s*[-]?\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i.test(raw)) return raw;
  if (/^[a-z]{3,20}$/i.test(raw)) return raw;
  return fallback;
}

function safeIcon(icon, fallback = '•') {
  if (icon === null || icon === undefined) return fallback;
  const raw = String(icon).trim();
  if (!raw) return fallback;
  const clean = raw.replace(/[<>]/g, '').slice(0, 8);
  return escapeHtml(clean || fallback);
}

function clampUiInput(value, maxLen) {
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 80;
  return String(value || '').trim().slice(0, limit);
}

function announceUiMessage(message) {
  if (typeof document === 'undefined' || !document.body) return;
  const text = String(message || '').trim();
  if (!text) return;
  let live = document.getElementById('ui-live-status');
  if (!live) {
    live = document.createElement('div');
    live.id = 'ui-live-status';
    safeSetAttr(live, 'aria-live', 'polite');
    safeSetAttr(live, 'aria-atomic', 'true');
    live.style.position = 'fixed';
    live.style.width = '1px';
    live.style.height = '1px';
    live.style.margin = '-1px';
    live.style.padding = '0';
    live.style.border = '0';
    live.style.overflow = 'hidden';
    live.style.clip = 'rect(0 0 0 0)';
    live.style.whiteSpace = 'nowrap';
    document.body.appendChild(live);
  }
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 0);
}

function shuffleArray(input) {
  const arr = Array.isArray(input) ? [...input] : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function renderAccentSafe(s) {
  const escaped = escapeHtml(s);
  return escaped.replace(/([^\s,;()[\]{}]+[\u0300-\u036f][^\s,;()[\]{}]*)/g, '<span class="accent-safe">$1</span>');
}

function highlightInContext(text, head) {
  if (!head) return escapeHtml(text);
  const parts = head.split(/[\s,]/);
  const surname = parts[0];
  if (!surname || surname.length < 3) return escapeHtml(text);
  const stem = surname.length > 5 ? surname.slice(0, -2) : surname;
  const escStem = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const re = new RegExp(escStem + '[А-Яа-яёЁA-Za-z]{0,5}', 'gi');
    return escapeHtml(text).replace(re, m => '<mark>' + m + '</mark>');
  } catch (e) {
    return escapeHtml(text);
  }
}

function getFirstLetter(head) {
  const normalized = normalizeHeadForMatch(head);
  if (!normalized) return '#';
  for (const ch of normalized) {
    if (/[a-zа-я]/i.test(ch)) return ch.toUpperCase().replace('Ё', 'Е');
    if (/[0-9]/.test(ch)) return '#';
  }
  return '#';
}

function pluralPages(n) {
  if (n === 1) return 'странице';
  return 'страницах';
}

function captureViewState() {
  const globalSearchInput = (typeof document !== 'undefined') ? document.getElementById('global-search') : null;
  return {
    version: UI_STATE_SCHEMA_VERSION,
    currentEntity,
    currentTab,
    selectedItem,
    selectedItemType,
    rightPaneMode,
    currentLecture,
    lectureCompareA,
    lectureCompareB,
    trendsRangeStart,
    trendsRangeEnd,
    searchQuery,
    onlyDiscussed,
    onlyQuestionCandidates,
    currentGlossaryTerm,
    currentScholarAnchor,
    activeFilters: Array.from(activeFilters),
    globalSearchQuery: globalSearchInput ? String(globalSearchInput.value || '') : '',
  };
}

function persistViewState() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(captureViewState()));
  } catch (e) {}
}

function restoreViewState() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== UI_STATE_SCHEMA_VERSION) {
      // Soft reset for incompatible storage schema.
      localStorage.removeItem(UI_STATE_STORAGE_KEY);
      return null;
    }
    if (!ENTITY_TYPES[parsed.currentEntity]) return null;
    const tabs = ENTITY_TYPES[parsed.currentEntity].tabs || [];
    if (!tabs.includes(parsed.currentTab)) parsed.currentTab = tabs[0];
    if (parsed.rightPaneMode !== 'card' && parsed.rightPaneMode !== 'histogram') parsed.rightPaneMode = 'histogram';
    if (!Number.isInteger(parsed.currentLecture)) parsed.currentLecture = 0;
    if (!Number.isInteger(parsed.lectureCompareA)) parsed.lectureCompareA = 1;
    if (!Number.isInteger(parsed.lectureCompareB)) parsed.lectureCompareB = 2;
    if (!Number.isInteger(parsed.trendsRangeStart)) parsed.trendsRangeStart = 1;
    if (!Number.isInteger(parsed.trendsRangeEnd)) parsed.trendsRangeEnd = 404;
    if (typeof parsed.searchQuery !== 'string') parsed.searchQuery = '';
    if (typeof parsed.currentGlossaryTerm !== 'string') parsed.currentGlossaryTerm = '';
    if (typeof parsed.currentScholarAnchor !== 'string') parsed.currentScholarAnchor = '';
    parsed.onlyDiscussed = !!parsed.onlyDiscussed;
    parsed.onlyQuestionCandidates = !!parsed.onlyQuestionCandidates;
    if (!Array.isArray(parsed.activeFilters)) parsed.activeFilters = [];
    parsed.activeFilters = parsed.activeFilters.filter(x => typeof x === 'string');
    if (typeof parsed.globalSearchQuery !== 'string') parsed.globalSearchQuery = '';
    return parsed;
  } catch (e) {
    return null;
  }
}

function getSavedTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'dark' || raw === 'light' ? raw : null;
  } catch (e) {
    return null;
  }
}

function bodyHasDarkTheme() {
  if (typeof document === 'undefined' || !document.body) return false;
  const body = document.body;
  if (body.classList && typeof body.classList.contains === 'function') return body.classList.contains('theme-dark');
  return String(body.className || '').split(/\s+/).includes('theme-dark');
}

function applyTheme(theme) {
  if (typeof document === 'undefined' || !document.body) return;
  const isDark = theme === 'dark';
  const body = document.body;
  if (body.classList && typeof body.classList.toggle === 'function') {
    body.classList.toggle('theme-dark', isDark);
  } else {
    const parts = String(body.className || '').split(/\s+/).filter(Boolean).filter(c => c !== 'theme-dark');
    if (isDark) parts.push('theme-dark');
    body.className = parts.join(' ');
  }
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light'); } catch (e) {}
  }
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.textContent = isDark ? '☀' : '◐';
    btn.title = isDark ? 'Светлая тема' : 'Тёмная тема';
    btn.setAttribute('aria-label', btn.title);
  }
}

function initTheme() {
  const saved = getSavedTheme();
  if (saved) {
    applyTheme(saved);
    return;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const dark = !!window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(dark ? 'dark' : 'light');
      return;
    } catch (e) {}
  }
  applyTheme('light');
}

function toggleTheme() {
  applyTheme(bodyHasDarkTheme() ? 'light' : 'dark');
}

function normalizeDensityMode(mode) {
  return ['compact', 'reader', 'research'].includes(mode) ? mode : 'research';
}

function getSavedDensityMode() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DENSITY_STORAGE_KEY);
    return normalizeDensityMode(raw);
  } catch (e) {
    return null;
  }
}

function applyDensityMode(mode) {
  if (typeof document === 'undefined' || !document.body) return;
  const nextMode = normalizeDensityMode(mode);
  const body = document.body;
  const classes = ['density-compact', 'density-reader', 'density-research'];
  const nextClass = `density-${nextMode}`;

  if (body.classList && typeof body.classList.add === 'function' && typeof body.classList.remove === 'function') {
    for (const cls of classes) body.classList.remove(cls);
    body.classList.add(nextClass);
  } else {
    const parts = String(body.className || '').split(/\s+/).filter(Boolean).filter(c => !classes.includes(c));
    parts.push(nextClass);
    body.className = parts.join(' ');
  }

  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(DENSITY_STORAGE_KEY, nextMode); } catch (e) {}
  }
  const select = document.getElementById('density-select');
  if (select && 'value' in select) select.value = nextMode;
}

function initDensityMode() {
  const saved = getSavedDensityMode();
  applyDensityMode(saved || 'research');
}

function applyViewState(state) {
  if (!state) return;
  currentEntity = ENTITY_TYPES[state.currentEntity] ? state.currentEntity : 'home';
  currentTab = state.currentTab || ENTITY_TYPES[currentEntity].tabs[0];
  if (!ENTITY_TYPES[currentEntity].tabs.includes(currentTab)) currentTab = ENTITY_TYPES[currentEntity].tabs[0];
  selectedItem = state.selectedItem || null;
  selectedItemType = state.selectedItemType || null;
  rightPaneMode = state.rightPaneMode || 'histogram';
  currentLecture = Number.isInteger(state.currentLecture) ? state.currentLecture : 0;
  lectureCompareA = Number.isInteger(state.lectureCompareA) ? state.lectureCompareA : 1;
  lectureCompareB = Number.isInteger(state.lectureCompareB) ? state.lectureCompareB : 2;
  trendsRangeStart = Number.isInteger(state.trendsRangeStart) ? state.trendsRangeStart : 1;
  trendsRangeEnd = Number.isInteger(state.trendsRangeEnd) ? state.trendsRangeEnd : 404;
  searchQuery = typeof state.searchQuery === 'string' ? state.searchQuery : '';
  currentGlossaryTerm = typeof state.currentGlossaryTerm === 'string' ? state.currentGlossaryTerm : '';
  currentScholarAnchor = typeof state.currentScholarAnchor === 'string' ? state.currentScholarAnchor : '';
  if (currentEntity === 'materials' && currentTab === 'glossary' && currentGlossaryTerm) {
    pendingGlossaryQuery = currentGlossaryTerm;
  }
  if (currentEntity === 'scholar' && currentTab === 'scholar' && currentScholarAnchor) {
    pendingScholarAnchor = currentScholarAnchor;
  }
  onlyDiscussed = !!state.onlyDiscussed;
  onlyQuestionCandidates = !!state.onlyQuestionCandidates;
  activeFilters = new Set(Array.isArray(state.activeFilters) ? state.activeFilters.filter(x => typeof x === 'string') : []);
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  const globalSearchInput = document.getElementById('global-search');
  if (globalSearchInput) globalSearchInput.value = typeof state.globalSearchQuery === 'string' ? state.globalSearchQuery : '';
}

function sameViewState(a, b) {
  if (!a || !b) return false;
  const aFilters = Array.isArray(a.activeFilters) ? a.activeFilters.join('|') : '';
  const bFilters = Array.isArray(b.activeFilters) ? b.activeFilters.join('|') : '';
  return a.currentEntity === b.currentEntity &&
    a.currentTab === b.currentTab &&
    a.selectedItem === b.selectedItem &&
    a.selectedItemType === b.selectedItemType &&
    a.rightPaneMode === b.rightPaneMode &&
    a.currentLecture === b.currentLecture &&
    a.lectureCompareA === b.lectureCompareA &&
    a.lectureCompareB === b.lectureCompareB &&
    a.trendsRangeStart === b.trendsRangeStart &&
    a.trendsRangeEnd === b.trendsRangeEnd &&
    (a.currentGlossaryTerm || '') === (b.currentGlossaryTerm || '') &&
    (a.currentScholarAnchor || '') === (b.currentScholarAnchor || '') &&
    (a.searchQuery || '') === (b.searchQuery || '') &&
    !!a.onlyDiscussed === !!b.onlyDiscussed &&
    !!a.onlyQuestionCandidates === !!b.onlyQuestionCandidates &&
    aFilters === bFilters;
}

function closeCardView() {
  if (currentTab !== 'list' || rightPaneMode !== 'card') return false;
  if (isMobileViewport()) {
    closeMobileSheet();
    return true;
  }
  rightPaneMode = 'histogram';
  selectedItem = null;
  selectedItemType = null;
  renderList();
  renderRightContent();
  syncNavigationState();
  return true;
}

function openMaterialsLectures() {
  currentEntity = 'materials';
  currentTab = 'lectures';
  selectedItem = null;
  selectedItemType = null;
  rightPaneMode = 'histogram';
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function buildBreadcrumbModel() {
  const model = [];
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf) return model;

  model.push({ action: 'entity', label: conf.title || currentEntity });

  if (currentEntity === 'materials' && currentTab === 'lecture_pages') {
    model.push({ action: 'materials_lectures', label: TAB_LABELS.lectures || 'Лекции' });
    const lectures = Array.isArray(APP_DATA?.lectures) ? APP_DATA.lectures : [];
    const l = lectures[currentLecture] || null;
    const lectureLabel = currentLecture === 0 ? 'Предисловие' : `Лекция ${currentLecture}`;
    model.push({ action: 'lecture_page', label: l ? `${lectureLabel}: ${l.name}` : lectureLabel });
  } else if (currentTab && currentTab !== 'home') {
    model.push({ action: 'tab', label: TAB_LABELS[currentTab] || currentTab });
  }

  if (rightPaneMode === 'card' && selectedItem) {
    model.push({ action: 'item', label: selectedItem });
  }
  return model;
}

function onBreadcrumbClick(action) {
  if (!action) return;
  if (action === 'entity') {
    switchEntity(currentEntity);
    return;
  }
  if (action === 'materials_lectures') {
    openMaterialsLectures();
    return;
  }
  if (action === 'lecture_page') {
    openLecturePage(currentLecture);
    return;
  }
  if (action === 'tab') {
    if (currentTab === 'list' && rightPaneMode === 'card') {
      closeCardView();
      return;
    }
    switchTab(currentTab);
    return;
  }
  if (action === 'item' && selectedItem) {
    navigateToItem(selectedItemType || currentEntity, selectedItem);
  }
}

function renderBreadcrumbs() {
  const host = document.getElementById('breadcrumbs');
  if (!host) return;
  const model = buildBreadcrumbModel();
  host.innerHTML = '';
  if (!model.length) return;

  model.forEach((crumb, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'breadcrumb-link' + (idx === model.length - 1 ? ' current' : '');
    btn.dataset.action = crumb.action || '';
    btn.textContent = crumb.label || '';
    btn.onclick = () => onBreadcrumbClick(crumb.action || '');
    host.appendChild(btn);
    if (idx < model.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '›';
      host.appendChild(sep);
    }
  });
}

function buildHashFromState() {
  const parts = [currentEntity, currentTab];
  if (currentEntity === 'materials' && currentTab === 'lecture_pages') {
    parts.push(String(Math.max(0, currentLecture)));
  }
  if (currentEntity === 'materials' && currentTab === 'glossary' && currentGlossaryTerm) {
    parts.push('term', currentGlossaryTerm);
  }
  if (currentEntity === 'scholar' && currentTab === 'scholar' && currentScholarAnchor) {
    parts.push('anchor', currentScholarAnchor);
  }
  if (currentTab === 'list' && searchQuery && !selectedItem) {
    parts.push('q', searchQuery);
  }
  if (selectedItem && rightPaneMode === 'card') {
    parts.push('item', selectedItemType || currentEntity, selectedItem);
  }
  return '#' + parts.map(x => encodeURIComponent(String(x))).join('/');
}

function pushHistoryState() {
  const snap = captureViewState();
  const last = historyStack.length ? historyStack[historyStack.length - 1] : null;
  if (sameViewState(last, snap)) return;
  historyStack.push(snap);
  if (historyStack.length > 150) historyStack.shift();
  updateBackButton();
}

function updateBackButton() {
  const btn = document.getElementById('back-btn');
  if (!btn) return;
  btn.style.display = historyStack.length > 1 ? 'inline-flex' : 'none';
}

async function copyCurrentUrl() {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch (e) {}
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = window.location.href;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) {
    return false;
  }
}

function syncNavigationState() {
  if (!isNavigatingHistory) pushHistoryState();
  updateBackButton();
  renderBreadcrumbs();
  persistViewState();
  if (suppressHashSync) return;
  if (typeof window === 'undefined' || !window.location) return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    expectedHash = nextHash;
    window.location.hash = nextHash;
  }
}

function applyHash(hash) {
  closeGlobalSearchResults();
  if (!hash || hash === '#') return false;
  const rawParts = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (rawParts.length > MAX_HASH_PARTS) return false;
  if (!rawParts.length) return false;
  const parts = [];
  for (const p of rawParts) {
    let decoded = '';
    try { decoded = decodeURIComponent(p); } catch (e) { decoded = p; }
    decoded = String(decoded || '');
    if (decoded.length > MAX_HASH_PART_LENGTH) return false;
    parts.push(decoded);
  }

  const entity = parts[0];
  if (!ENTITY_TYPES[entity]) return false;
  const tabCandidate = parts[1] || ENTITY_TYPES[entity].tabs[0];
  const tab = ENTITY_TYPES[entity].tabs.includes(tabCandidate) ? tabCandidate : ENTITY_TYPES[entity].tabs[0];
  const queryPos = parts.indexOf('q');
  const itemPos = parts.indexOf('item');

  const state = {
    currentEntity: entity,
    currentTab: tab,
    selectedItem: null,
    selectedItemType: null,
    rightPaneMode: 'histogram',
    currentLecture: 0,
    searchQuery: '',
    currentScholarAnchor: '',
  };
  pendingGlossaryQuery = '';
  currentGlossaryTerm = '';
  pendingScholarAnchor = '';
  currentScholarAnchor = '';

  if (entity === 'materials' && tab === 'lecture_pages' && /^\d+$/.test(parts[2] || '')) {
    state.currentLecture = parseInt(parts[2], 10);
  }
  if (entity === 'materials' && tab === 'glossary') {
    const termPos = parts.indexOf('term');
    if (termPos >= 0 && parts[termPos + 1]) {
      pendingGlossaryQuery = clampUiInput(parts[termPos + 1], MAX_LIST_QUERY_LENGTH).toLowerCase();
      currentGlossaryTerm = pendingGlossaryQuery;
    }
  }
  if (entity === 'scholar' && tab === 'scholar') {
    const anchorPos = parts.indexOf('anchor');
    if (anchorPos >= 0 && parts[anchorPos + 1]) {
      const rawAnchor = String(parts[anchorPos + 1] || '');
      const safeAnchor = rawAnchor.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
      if (safeAnchor) {
        pendingScholarAnchor = safeAnchor;
        state.currentScholarAnchor = safeAnchor;
      }
    }
  }
  if (tab === 'list' && queryPos >= 0 && parts[queryPos + 1]) {
    state.searchQuery = clampUiInput(parts[queryPos + 1], MAX_LIST_QUERY_LENGTH);
  }

  if (itemPos >= 0 && parts[itemPos + 1] && parts[itemPos + 2]) {
    state.currentEntity = parts[itemPos + 1];
    state.currentTab = 'list';
    state.selectedItemType = parts[itemPos + 1];
    state.selectedItem = clampUiInput(parts[itemPos + 2], MAX_HASH_PART_LENGTH);
    state.rightPaneMode = 'card';
  }

  applyViewState(state);
  if (!isNavigatingHistory) pushHistoryState();
  updateBackButton();
  renderBreadcrumbs();
  return true;
}

function goBackInApp() {
  if (historyStack.length < 2) return;
  historyStack.pop();
  const prev = historyStack[historyStack.length - 1];
  if (!prev) return;
  isNavigatingHistory = true;
  applyViewState(prev);
  syncNavigationState();
  isNavigatingHistory = false;
}

function normalizeHeadForMatch(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const cached = normalizeHeadCache.get(raw);
  if (cached !== undefined) return cached;
  let s = raw.trim().toLowerCase();
  if (typeof s.normalize === 'function') s = s.normalize('NFD');
  s = s.replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е');
  s = s.replace(/^[?]+/, '').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  if (normalizeHeadCache.size >= NORMALIZE_CACHE_LIMIT) normalizeHeadCache.clear();
  normalizeHeadCache.set(raw, s);
  return s;
}

function compareHeadsRu(aHead, bHead) {
  const aRaw = String(aHead || '');
  const bRaw = String(bHead || '');
  const aNorm = normalizeHeadForMatch(aRaw);
  const bNorm = normalizeHeadForMatch(bRaw);
  const primary = aNorm.localeCompare(bNorm, 'ru', { sensitivity: 'base', numeric: true });
  if (primary !== 0) return primary;
  return aRaw.localeCompare(bRaw, 'ru', { sensitivity: 'base', numeric: true });
}

function compareItemsByHead(a, b) {
  return compareHeadsRu(a && a.head, b && b.head);
}

function resolveExistingHead(type, head) {
  const conf = ENTITY_TYPES[type];
  if (!conf || !Array.isArray(conf.items)) return head;
  const indexed = getIndexedItem(type, head);
  if (indexed) return indexed.head;
  const nHead = normalizeHeadForMatch(head);
  if (!nHead) return head;
  const loose = conf.items.find(it => {
    const n = normalizeHeadForMatch(it.head);
    return n.includes(nHead) || nHead.includes(n);
  });
  return loose ? loose.head : head;
}

function navigateToItem(type, head) {
  closeGlobalSearchResults();
  const targetType = ENTITY_TYPES[type] ? type : currentEntity;
  currentEntity = targetType;
  currentTab = 'list';
  selectedItem = resolveExistingHead(targetType, head);
  selectedItemType = targetType;
  currentGlossaryTerm = '';
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  rememberRecentItem(selectedItemType, selectedItem);
  rightPaneMode = 'card';
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function bindActionWithKeyboard(el, handler) {
  if (!el || typeof handler !== 'function') return;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag !== 'a' && tag !== 'button') {
    safeSetAttr(el, 'role', 'button');
    safeSetAttr(el, 'tabindex', '0');
  }
  el.onclick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    handler();
  };
  el.onkeydown = (e) => {
    const key = e && e.key ? String(e.key) : '';
    if (key === 'Enter' || key === ' ') {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      handler();
    }
  };
}

function bindNavigateLinks(root, selector, defaultType = 'all') {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll(selector).forEach(el => {
    if (!el) return;
    bindActionWithKeyboard(el, () => {
      const t = el.dataset && el.dataset.type ? el.dataset.type : defaultType;
      const h = el.dataset && el.dataset.head ? el.dataset.head : '';
      if (!h) return;
      navigateToItem(t || defaultType, h);
    });
  });
}

function openLecturePage(index) {
  closeGlobalSearchResults();
  currentEntity = 'materials';
  currentTab = 'lecture_pages';
  currentLecture = Math.max(0, index || 0);
  selectedItem = null;
  selectedItemType = null;
  currentGlossaryTerm = '';
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  rightPaneMode = 'histogram';
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function buildLecturePageHash(index) {
  const idx = Math.max(0, parseInt(String(index || '0'), 10) || 0);
  return '#materials/lecture_pages/' + encodeURIComponent(String(idx));
}

function openGlossaryTerm(term) {
  closeGlobalSearchResults();
  const q = String(term || '').trim().toLowerCase();
  if (!q) return;
  pendingGlossaryQuery = q;
  currentGlossaryTerm = q;
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  currentEntity = 'materials';
  currentTab = 'glossary';
  selectedItem = null;
  selectedItemType = null;
  rightPaneMode = 'histogram';
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function buildGlossaryTermHash(term) {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return '#materials/glossary';
  return '#materials/glossary/term/' + encodeURIComponent(q);
}

function buildListSearchHash(entity, query) {
  const e = ENTITY_TYPES[entity] ? entity : 'all';
  const q = String(query || '').trim();
  if (!q) return '#' + [e, 'list'].map(x => encodeURIComponent(String(x))).join('/');
  return '#' + [e, 'list', 'q', q].map(x => encodeURIComponent(String(x))).join('/');
}

function buildItemHash(type, head) {
  const t = ENTITY_TYPES[type] ? type : 'all';
  const resolvedHead = resolveExistingHead(t, head);
  return '#' + [t, 'list', 'item', t, resolvedHead].map(x => encodeURIComponent(String(x))).join('/');
}

function buildScholarAnchorHash(anchorId) {
  const safeAnchor = String(anchorId || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  if (!safeAnchor) return '#scholar/scholar';
  return '#' + ['scholar', 'scholar', 'anchor', safeAnchor].map(x => encodeURIComponent(String(x))).join('/');
}

function buildLectureTermHash(term) {
  const raw = String(term || '').trim();
  if (!raw) return '#materials/glossary';
  const q = raw.toLowerCase();
  const glossary = APP_DATA.glossary || [];
  const hasGlossaryHit = glossary.some(g => {
    const gt = String(g.term || '').toLowerCase();
    return gt.includes(q) || q.includes(gt);
  });
  if (hasGlossaryHit) return buildGlossaryTermHash(raw);
  return buildListSearchHash('all', raw);
}

function findLectureIndexByName(name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return -1;
  const lectures = Array.isArray(APP_DATA?.lectures) ? APP_DATA.lectures : [];
  for (let i = 0; i < lectures.length; i++) {
    const lectureName = String(lectures[i]?.name || '').trim().toLowerCase();
    if (lectureName && (lectureName === needle || lectureName.includes(needle) || needle.includes(lectureName))) return i;
  }
  return -1;
}

function openLectureTerm(term) {
  closeGlobalSearchResults();
  const raw = String(term || '').trim();
  if (!raw) return;
  const q = raw.toLowerCase();
  const glossary = APP_DATA.glossary || [];
  const hasGlossaryHit = glossary.some(g => {
    const gt = String(g.term || '').toLowerCase();
    return gt.includes(q) || q.includes(gt);
  });

  if (hasGlossaryHit) {
    openGlossaryTerm(raw);
    return;
  }

  currentEntity = 'all';
  currentTab = 'list';
  currentGlossaryTerm = '';
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  activeFilters.clear();
  onlyDiscussed = false;
  searchQuery = raw;
  selectedItem = null;
  selectedItemType = null;
  rightPaneMode = 'histogram';
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function buildSearchSnippet(item, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q || !item || !item.contexts || typeof item.contexts !== 'object') return '';
  const pages = Object.keys(item.contexts).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const pg of pages) {
    const ctxs = Array.isArray(item.contexts[pg]) ? item.contexts[pg] : [];
    for (const raw of ctxs) {
      const text = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const low = text.toLowerCase();
      const idx = low.indexOf(q);
      if (idx < 0) continue;
      const start = Math.max(0, idx - 42);
      const end = Math.min(text.length, idx + q.length + 42);
      const left = start > 0 ? '…' : '';
      const right = end < text.length ? '…' : '';
      return `${left}${text.slice(start, end)}${right}`;
    }
  }
  return '';
}

function highlightSearchMatch(text, query) {
  const source = String(text || '');
  const q = String(query || '').trim();
  if (!q) return escapeHtml(source);
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let re;
  try {
    re = new RegExp(esc, 'ig');
  } catch (e) {
    return escapeHtml(source);
  }
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(source)) !== null) {
    const idx = m.index;
    const seg = m[0] || '';
    out += escapeHtml(source.slice(last, idx));
    out += '<mark>' + escapeHtml(seg) + '</mark>';
    last = idx + seg.length;
    if (!seg.length) re.lastIndex += 1;
  }
  out += escapeHtml(source.slice(last));
  return out;
}

function getGlobalSearchMatches(query) {
  const q = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH).toLowerCase();
  if (q.length < 2) return [];
  const searchKey = `${getDataSignature()}::${q}`;
  const cached = globalSearchCache.get(searchKey);
  if (cached) return cached;
  const out = [];
  const push = (kind, type, head, meta, lectureIndex, snippet) => {
    if (!head) return;
    const score = head.toLowerCase().startsWith(q) ? 0 : 1;
    out.push({ kind, type, head, meta, lectureIndex, snippet, score });
  };

  const typedSources = [
    { type: 'names', kind: 'имя', items: APP_DATA.names || [] },
    { type: 'toponyms', kind: 'топоним', items: APP_DATA.toponyms || [] },
    { type: 'ethnonyms', kind: 'этноним', items: APP_DATA.ethnonyms || [] },
    { type: 'languages', kind: 'язык', items: APP_DATA.languages || [] },
    { type: 'lexicon', kind: 'лексема', items: APP_DATA.lexicon || [] },
    { type: 'subject', kind: 'понятие', items: APP_DATA.subject_index || [] },
  ];
  for (const src of typedSources) {
    for (const it of src.items) {
      const h = (it.head || '').toLowerCase();
      if (h.includes(q)) {
        const snippet = buildSearchSnippet(it, q);
        push(src.kind, src.type, it.head, `${(it.page_list || []).length} стр.`, null, snippet);
      }
    }
  }

  const glossary = APP_DATA.glossary || [];
  for (const g of glossary) {
    const term = String(g.term || '').trim();
    const def = String(g.definition || '').trim();
    if (!term) continue;
    const hay = (term + ' ' + def).toLowerCase();
    if (!hay.includes(q)) continue;
    push('термин', 'glossary', term, 'глоссарий', null, def);
  }

  const lectures = APP_DATA.lectures || [];
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i];
    if ((l.name || '').toLowerCase().includes(q) || (l.main_idea || '').toLowerCase().includes(q)) {
      const snippet = (l.main_idea || '').trim();
      push('лекция', 'lecture', l.name, `стр. ${l.pages || ''}`, i, snippet);
    }
  }

  out.sort((a, b) => a.score - b.score || compareHeadsRu(a.head, b.head));
  const sliced = out.slice(0, 40);
  globalSearchCache.set(searchKey, sliced);
  if (globalSearchCache.size > GLOBAL_SEARCH_CACHE_MAX) {
    const firstKey = globalSearchCache.keys().next();
    if (!firstKey.done) globalSearchCache.delete(firstKey.value);
  }
  return sliced;
}

function closeGlobalSearchResults() {
  const box = document.getElementById('global-search-results');
  if (!box) return;
  const input = document.getElementById('global-search');
  if (box.classList && typeof box.classList.remove === 'function') {
    box.classList.remove('open');
  } else {
    box.className = String(box.className || '').replace(/\bopen\b/g, '').replace(/\s+/g, ' ').trim();
  }
  box.innerHTML = '';
  box._matches = [];
  globalSearchActiveIndex = -1;
  if (input) {
    safeSetAttr(input, 'aria-expanded', 'false');
    safeSetAttr(input, 'aria-activedescendant', '');
  }
}

function setGlobalSearchActiveItem(box, idx, scrollIntoView = true) {
  if (!box || typeof box.querySelectorAll !== 'function') return;
  const input = document.getElementById('global-search');
  const rows = Array.from(box.querySelectorAll('.header-search-item'));
  if (!rows.length) {
    globalSearchActiveIndex = -1;
    if (input) safeSetAttr(input, 'aria-activedescendant', '');
    return;
  }
  const clamped = Math.max(0, Math.min(idx, rows.length - 1));
  rows.forEach((row, i) => {
    const active = i === clamped;
    if (!row.id) row.id = `global-search-item-${i}`;
    row.classList.toggle('active', active);
    safeSetAttr(row, 'aria-selected', active ? 'true' : 'false');
  });
  globalSearchActiveIndex = clamped;
  if (input) safeSetAttr(input, 'aria-activedescendant', rows[clamped].id || '');
  if (scrollIntoView && typeof rows[clamped].scrollIntoView === 'function') {
    rows[clamped].scrollIntoView({ block: 'nearest' });
  }
}

function openGlobalSearchMatch(match) {
  if (!match) return;
  if (match.type === 'lecture') openLecturePage(match.lectureIndex || 0);
  else if (match.type === 'glossary') openGlossaryTerm(match.head || '');
  else navigateToItem(match.type, match.head);
  const input = document.getElementById('global-search');
  if (input) input.value = '';
  closeGlobalSearchResults();
}

function renderGlobalSearchResults(matches, query = '') {
  const box = document.getElementById('global-search-results');
  const input = document.getElementById('global-search');
  if (!box) return;
  if (!matches.length) {
    closeGlobalSearchResults();
    return;
  }
  const q = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH);
  safeSetAttr(box, 'role', 'listbox');
  box.innerHTML = matches.map((m, idx) =>
    `<div class="header-search-item" data-idx="${idx}" role="option" aria-selected="false">
      <span>${highlightSearchMatch(m.head, q)}</span>
      <span class="kind">${escapeHtml(m.kind)}</span>
      ${m.meta ? `<div style="color:#888;font-size:10px;margin-top:2px;">${escapeHtml(m.meta)}</div>` : ''}
      ${m.snippet ? `<div style="color:#6c5640;font-size:10px;line-height:1.25;margin-top:2px;">${highlightSearchMatch(m.snippet, q)}</div>` : ''}
    </div>`
  ).join('');
  box._matches = matches;
  globalSearchActiveIndex = -1;
  box.classList.add('open');
  if (input) safeSetAttr(input, 'aria-expanded', 'true');
  box.querySelectorAll('.header-search-item').forEach(row => {
    row.onclick = () => {
      const m = (box._matches || [])[parseInt(row.dataset.idx || '0', 10)];
      openGlobalSearchMatch(m);
    };
  });
}

function shouldIgnoreGlobalHotkeys(e) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey) return true;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  const tag = (target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function moveListSelection(delta) {
  if (currentTab !== 'list') return false;
  const list = document.getElementById('name-list');
  if (!list) return false;
  const rows = Array.from(list.querySelectorAll('.name-item[data-head]'));
  if (!rows.length) return false;
  let idx = rows.findIndex(r => (r.dataset.head || '') === (selectedItem || '') && (r.dataset.type || currentEntity) === (selectedItemType || currentEntity));
  if (idx < 0) idx = delta > 0 ? -1 : 0;
  idx += delta;
  if (idx < 0) idx = 0;
  if (idx >= rows.length) idx = rows.length - 1;
  const row = rows[idx];
  if (!row) return false;
  const rowType = row.dataset.type || currentEntity;
  const it = getIndexedItem(rowType, row.dataset.head || '');
  if (!it) return false;
  selectListItem(it, rowType);
  if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  return true;
}

function stepLecture(delta) {
  if (currentEntity !== 'materials' || currentTab !== 'lecture_pages') return false;
  const lectures = APP_DATA.lectures || [];
  const next = currentLecture + delta;
  if (next < 0 || next >= lectures.length) return false;
  openLecturePage(next);
  return true;
}

function onGlobalKeydown(e) {
  if (shouldIgnoreGlobalHotkeys(e)) return;
  if (e.key === '/') {
    const globalInput = document.getElementById('global-search');
    if (globalInput && typeof globalInput.focus === 'function') {
      globalInput.focus();
      if (typeof globalInput.select === 'function') globalInput.select();
      e.preventDefault();
    }
    return;
  }
  if (e.key === 'ArrowDown') {
    if (moveListSelection(1)) e.preventDefault();
    return;
  }
  if (e.key === 'ArrowUp') {
    if (moveListSelection(-1)) e.preventDefault();
    return;
  }
  if (e.key === 'ArrowLeft') {
    if (navigateCardByDelta(-1) || stepLecture(-1)) e.preventDefault();
    return;
  }
  if (e.key === 'ArrowRight') {
    if (navigateCardByDelta(1) || stepLecture(1)) e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    const box = document.getElementById('global-search-results');
    const isOpen = !!(box && (
      (box.classList && typeof box.classList.contains === 'function' && box.classList.contains('open')) ||
      /\bopen\b/.test(String(box.className || ''))
    ));
    if (isOpen) {
      closeGlobalSearchResults();
      e.preventDefault();
      return;
    }
    if (closeCardView()) e.preventDefault();
  }
}

function wireGlobalUI() {
  wireGraphWorkersLifecycle();
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.onclick = () => goBackInApp();
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.onclick = () => toggleTheme();
  const densitySelect = document.getElementById('density-select');
  if (densitySelect) {
    if ('value' in densitySelect) densitySelect.value = getSavedDensityMode() || 'research';
    densitySelect.onchange = (e) => {
      const target = e && e.target;
      if (!target || typeof target.value !== 'string') return;
      applyDensityMode(target.value);
    };
  }
  const homeLink = document.getElementById('home-link');
  if (homeLink) {
    homeLink.onclick = (e) => {
      if (e) e.preventDefault();
      switchEntity('home');
    };
  }

  const entitySwitcher = document.getElementById('entity-switcher');
  if (entitySwitcher) {
    entitySwitcher.onclick = (e) => {
      const target = e && e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest('.entity-btn[data-entity]');
      if (!btn) return;
      const key = btn.dataset.entity;
      if (!key || !ENTITY_TYPES[key]) return;
      switchEntity(key);
    };
  }

  const tabs = document.getElementById('tabs');
  if (tabs) {
    tabs.onclick = (e) => {
      const target = e && e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest('.tab[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (!tab || !ENTITY_TYPES[currentEntity].tabs.includes(tab)) return;
      switchTab(tab);
    };
  }

  const input = document.getElementById('global-search');
  const box = document.getElementById('global-search-results');
  if (input && box) {
    safeSetAttr(input, 'role', 'combobox');
    safeSetAttr(input, 'aria-autocomplete', 'list');
    safeSetAttr(input, 'aria-expanded', 'false');
    safeSetAttr(input, 'aria-controls', 'global-search-results');
    safeSetAttr(input, 'aria-activedescendant', '');
    safeSetAttr(box, 'role', 'listbox');
    input.oninput = () => {
      if (globalSearchTimer) clearTimeout(globalSearchTimer);
      globalSearchTimer = setTimeout(() => {
        const q = clampUiInput(input.value, MAX_GLOBAL_QUERY_LENGTH);
        if (input.value !== q) input.value = q;
        renderGlobalSearchResults(getGlobalSearchMatches(q), q);
      }, 100);
    };
    input.onkeydown = (e) => {
      if (e.key === 'Escape') {
        closeGlobalSearchResults();
        input.blur();
        return;
      }
      if (e.key === 'ArrowDown') {
        if (!box.classList.contains('open')) {
          const q = clampUiInput(input.value, MAX_GLOBAL_QUERY_LENGTH);
          renderGlobalSearchResults(getGlobalSearchMatches(q), q);
        }
        if (box.classList.contains('open')) {
          setGlobalSearchActiveItem(box, globalSearchActiveIndex + 1);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        if (box.classList.contains('open')) {
          const base = globalSearchActiveIndex < 0 ? 0 : globalSearchActiveIndex;
          setGlobalSearchActiveItem(box, base - 1);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Enter') {
        let matches = [];
        if (box.classList.contains('open')) {
          matches = Array.isArray(box._matches) ? box._matches : [];
        } else {
          const q = clampUiInput(input.value, MAX_GLOBAL_QUERY_LENGTH);
          matches = getGlobalSearchMatches(q);
        }
        if (!matches.length) return;
        const idx = globalSearchActiveIndex < 0 ? 0 : globalSearchActiveIndex;
        openGlobalSearchMatch(matches[idx]);
        e.preventDefault();
      }
    };
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('click', (e) => {
        if (!box.classList.contains('open')) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.closest('.header-search')) {
          closeGlobalSearchResults();
        }
      });
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', () => {
      const currentHash = (window.location && typeof window.location.hash === 'string') ? window.location.hash : '';
      if (expectedHash && currentHash === expectedHash) {
        expectedHash = null;
        return;
      }
      applyHash(currentHash);
    });
  }
  if (!globalKeyHandlersWired && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', onGlobalKeydown);
    globalKeyHandlersWired = true;
  }
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function downloadTextFile(filename, text, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

function getItemByTypeAndHead(type, head) {
  return getIndexedItem(type, head);
}

function itemToMarkdown(it, type) {
  const pages = (it.page_list || []);
  const yaml = [
    '---',
    `title: "${String(it.head || '').replace(/"/g, '\\"')}"`,
    `type: "${type}"`,
    `discussed: ${it.discussed ? 'true' : 'false'}`,
    `pages_count: ${pages.length}`,
    '---',
    '',
  ].join('\n');
  const lines = [];
  lines.push(`# ${it.head}`);
  lines.push('');
  lines.push(`Тип: **${type}**`);
  lines.push('');
  lines.push(`Страницы: ${it.pages || it.head_pages || pages.join(', ') || '—'}`);
  lines.push('');
  if (it.is_moderator && it.moderator_note) {
    lines.push(`> Примечание: ${it.moderator_note}`);
    lines.push('');
  }
  if (it.chapters && it.chapters.length) {
    lines.push('## Лекции');
    for (const ch of it.chapters) lines.push(`- [[${ch}]]`);
    lines.push('');
  }
  const ctxKeys = it.contexts ? Object.keys(it.contexts).sort((a, b) => Number(a) - Number(b)).slice(0, 10) : [];
  if (ctxKeys.length) {
    lines.push('## Контексты');
    for (const pg of ctxKeys) {
      const sample = (it.contexts[pg] || [])[0];
      if (sample) lines.push(`- стр. ${pg}: ${sample}`);
    }
    lines.push('');
  }
  return yaml + lines.join('\n');
}

function exportCurrentCardMarkdown() {
  if (!selectedItem || !selectedItemType) return;
  const it = getItemByTypeAndHead(selectedItemType, selectedItem);
  if (!it) return;
  const md = itemToMarkdown(it, selectedItemType);
  downloadTextFile(`${slugify(selectedItem)}.md`, md);
}

function exportCurrentSectionMarkdown() {
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !Array.isArray(conf.items)) return;
  const blocks = [];
  blocks.push(`# Раздел: ${conf.title}`);
  blocks.push('');
  blocks.push(`Всего карточек: ${conf.items.length}`);
  blocks.push('');
  for (const it of conf.items) {
    const refType = it._entityType || currentEntity;
    blocks.push(`## [[${it.head}]]`);
    blocks.push(`- Тип: ${refType}`);
    blocks.push(`- Страницы: ${it.pages || it.head_pages || (it.page_list || []).join(', ') || '—'}`);
    blocks.push('');
  }
  downloadTextFile(`${slugify(currentEntity)}-section.md`, blocks.join('\n'));
}

function exportWholeSiteMarkdown() {
  const parts = [];
  parts.push('# Зализнякиада');
  parts.push('');
  parts.push('## Разделы');
  for (const [key, conf] of Object.entries(ENTITY_TYPES)) {
    if (!Array.isArray(conf.items)) continue;
    parts.push(`- ${conf.title}: ${conf.items.length}`);
    if (['home', 'materials', 'scholar', 'all'].includes(key)) continue;
    for (const it of conf.items.slice(0, 2000)) {
      parts.push(`  - [[${it.head}]] (${key})`);
    }
  }
  parts.push('');
  parts.push('## Лекции');
  for (let i = 0; i < (APP_DATA.lectures || []).length; i++) {
    const l = APP_DATA.lectures[i];
    const label = i === 0 ? 'Предисловие' : `Лекция ${i}`;
    parts.push(`- ${label}: ${l.name} (стр. ${l.pages || ''})`);
  }
  parts.push('');
  downloadTextFile('zaliznyakiada-site.md', parts.join('\n'));
}

// =========================================================
// ШАПКА: ПЕРЕКЛЮЧАТЕЛИ
// =========================================================
function renderEntitySwitcher() {
  const container = document.getElementById('entity-switcher');
  container.innerHTML = '';
  safeSetAttr(container, 'role', 'toolbar');
  safeSetAttr(container, 'aria-label', 'Entity switcher');
  const order = ['materials', 'scholar', 'all', 'subject', 'names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse'];
  for (const key of order) {
    const conf = ENTITY_TYPES[key];
    if (!conf) continue;
    const btn = document.createElement('button');
    btn.className = 'entity-btn' + (key === currentEntity ? ' active' : '');
    btn.dataset.entity = key;
    safeSetAttr(btn, 'aria-pressed', key === currentEntity ? 'true' : 'false');
    const count = Array.isArray(conf.items) ? conf.items.length : 0;
    const showCount = !['materials', 'scholar'].includes(key);
    btn.textContent = conf.title;
    if (showCount) {
      const countSpan = document.createElement('span');
      countSpan.className = 'count';
      countSpan.textContent = String(count);
      btn.appendChild(countSpan);
    }
    container.appendChild(btn);
  }
}

function renderTabs() {
  const container = document.getElementById('tabs');
  container.innerHTML = '';
  safeSetAttr(container, 'role', 'tablist');
  safeSetAttr(container, 'aria-label', 'View tabs');
  const conf = ENTITY_TYPES[currentEntity];
  for (const tab of conf.tabs) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (tab === currentTab ? ' active' : '');
    btn.dataset.tab = tab;
    safeSetAttr(btn, 'role', 'tab');
    safeSetAttr(btn, 'aria-selected', tab === currentTab ? 'true' : 'false');
    btn.textContent = TAB_LABELS[tab];
    container.appendChild(btn);
  }
}

function switchEntity(key) {
  closeGlobalSearchResults();
  visibleItemsCache = null;
  currentEntity = key;
  currentGlossaryTerm = '';
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  activeFilters.clear();
  onlyDiscussed = false;
  onlyQuestionCandidates = false;
  searchQuery = '';
  selectedItem = null;
  selectedItemType = null;
  rightPaneMode = 'histogram';
  const tabs = ENTITY_TYPES[key].tabs;
  if (!tabs.includes(currentTab)) currentTab = tabs[0];
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function switchTab(tab) {
  closeGlobalSearchResults();
  visibleItemsCache = null;
  currentTab = tab;
  if (!(currentEntity === 'materials' && tab === 'glossary')) currentGlossaryTerm = '';
  if (!(currentEntity === 'scholar' && tab === 'scholar')) {
    currentScholarAnchor = '';
    pendingScholarAnchor = '';
  }
  renderTabs();
  renderContent();
  syncNavigationState();
}

function renderContent() {
  const container = document.getElementById('content');
  container.innerHTML = '';
  if (currentTab !== 'list') setMobileSheetOpen(false);
  if (currentTab !== 'graph') nameGraphRenderToken += 1;
  if (currentTab !== 'families') familiesGraphRenderToken += 1;
  const renderers = {
    home: renderHomePanel,
    lectures: renderLecturesPanel,
    lecture_compare: renderLectureComparePanel,
    lecture_pages: renderLecturePagePanel,
    tasks: renderTasksPanel,
    further_reading: renderFurtherReadingPanel,
    glossary: renderGlossaryPanel,
    gallery: renderGalleryPanel,
    russian_evolution: renderRussianEvolutionPanel,
    phonetic_laws: renderPhoneticLawsPanel,
    scholar: renderScholarPanel,
    chronology: renderScholarChronologyPanel,
    page_trends: renderPageTrendsPanel,
    list: renderListPanel,
    cards: renderCardsPanel,
    histogram: renderHistogramPanel,
    timeline: renderTimelinePanel,
    heatmap: renderHeatmapPanel,
    graph: renderGraphPanel,
    map: renderMapPanel,
    epochs: renderEpochsPanel,
    families: renderFamiliesPanel,
    tree: renderTreePanel,
  };
  const render = renderers[currentTab];
  if (render) render(container);
}

// =========================================================
// СПИСОК + КАРТОЧКА (или гистограмма по умолчанию)
// =========================================================
function renderListPanel(container) {
  const conf = ENTITY_TYPES[currentEntity];

  let catChips = '';
  if (currentEntity === 'names') {
    const cats = {};
    for (const it of conf.items) {
      const sub = it.subcategory || 'other';
      cats[sub] = (cats[sub] || 0) + 1;
    }
    const order = ['linguist','literator','historical','participant','edition_staff'];
    catChips = '<div class="filter-row">';
    for (const sub of order) {
      if (!cats[sub]) continue;
      catChips += `<button class="filter-chip ${activeFilters.has(sub)?'active':''}" data-subcat="${sub}">
        <span class="dot" style="background:${safeColor(COLORS[sub], '#888')}"></span>${LABELS[sub]} (${cats[sub]})
      </button>`;
    }
    catChips += '</div>';
  }
  const canFilterCandidates = currentEntity === 'names' || currentEntity === 'all';
  const candidateTotal = canFilterCandidates ? conf.items.filter(it => (it.head || '').startsWith('?')).length : 0;
  const candidateBtnHtml = canFilterCandidates
    ? `<button class="filter-chip ${onlyQuestionCandidates ? 'active' : ''}" id="only-question-btn">только ?-кандидаты (${candidateTotal})</button>`
    : '';

  container.innerHTML = `
    <div class="panel active">
      <div class="list-card-layout">
        <div class="left-pane">
          <div class="filters">
            <input type="text" id="search-input" placeholder="${currentEntity==='all'?'Поиск по всем указателям…':'Поиск…'}" value="${escapeHtml(searchQuery)}" autofocus />
            ${catChips}
            <div class="filter-row">
              ${candidateBtnHtml}
              <button class="filter-chip ${onlyDiscussed?'active':''}" id="only-discussed-btn">только обсуждаемые (≥2 стр.)</button>
              <button class="filter-chip" id="export-section-md">экспорт раздела .md</button>
            </div>
          </div>
          <div class="name-list" id="name-list"></div>
        </div>
        <div class="right-pane">
          <div id="right-content"></div>
        </div>
      </div>
      <div class="mobile-card-backdrop" id="mobile-card-backdrop"></div>
      <div class="mobile-card-sheet" id="mobile-card-sheet">
        <div class="mobile-card-sheet-head">
          <div class="mobile-card-sheet-title">Карточка</div>
          <button class="mobile-card-sheet-close" id="mobile-sheet-close" type="button">×</button>
        </div>
        <div class="mobile-card-sheet-content" id="mobile-sheet-content"></div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById('search-input');
  let searchTimeout = null;
  if (searchInput) safeSetAttr(searchInput, 'aria-label', 'List search');
  searchInput.oninput = (e) => {
    const val = clampUiInput(e.target.value, MAX_LIST_QUERY_LENGTH);
    if (e.target.value !== val) e.target.value = val;
    if (searchTimeout) clearTimeout(searchTimeout);
    // Для коротких запросов задержка больше — не дергаем рендер при печати
    const delay = val.length < 3 ? 250 : 120;
    searchTimeout = setTimeout(() => {
      searchQuery = val;
      visibleItemsCache = null;
      renderList();
      persistViewState();
    }, delay);
  };
  searchInput.focus();
  const nameListEl = document.getElementById('name-list');
  if (nameListEl) {
    nameListEl.onclick = (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest('.name-item[data-head]');
      if (!row || !nameListEl.contains(row)) return;
      const head = row.dataset.head || '';
      const rowType = row.dataset.type || currentEntity;
      const it = getIndexedItem(rowType, head);
      if (!it) return;
      selectListItem(it, rowType);
    };
    nameListEl.onkeydown = (e) => {
      const key = e.key;
      if (key !== 'Enter' && key !== ' ') return;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest('.name-item[data-head]');
      if (!row || !nameListEl.contains(row)) return;
      const head = row.dataset.head || '';
      const rowType = row.dataset.type || currentEntity;
      const it = getIndexedItem(rowType, head);
      if (!it) return;
      e.preventDefault();
      selectListItem(it, rowType);
    };
  }
  
  document.getElementById('only-discussed-btn').onclick = (e) => {
    onlyDiscussed = !onlyDiscussed;
    e.target.classList.toggle('active', onlyDiscussed);
    visibleItemsCache = null;
    renderList();
    persistViewState();
  };
  const onlyQuestionBtn = document.getElementById('only-question-btn');
  if (onlyQuestionBtn) {
    onlyQuestionBtn.onclick = (e) => {
      onlyQuestionCandidates = !onlyQuestionCandidates;
      e.target.classList.toggle('active', onlyQuestionCandidates);
      visibleItemsCache = null;
      renderList();
      persistViewState();
    };
  }
  const exportSectionBtn = document.getElementById('export-section-md');
  if (exportSectionBtn) exportSectionBtn.onclick = () => exportCurrentSectionMarkdown();
  const sheetCloseBtn = document.getElementById('mobile-sheet-close');
  if (sheetCloseBtn) sheetCloseBtn.onclick = () => closeMobileSheet();
  const sheetBackdrop = document.getElementById('mobile-card-backdrop');
  if (sheetBackdrop) sheetBackdrop.onclick = () => closeMobileSheet();
  container.querySelectorAll('.filter-chip[data-subcat]').forEach(chip => {
    chip.onclick = () => {
      const sub = chip.dataset.subcat;
      if (activeFilters.has(sub)) activeFilters.delete(sub);
      else activeFilters.add(sub);
      chip.classList.toggle('active');
      visibleItemsCache = null;
      renderList();
      persistViewState();
    };
  });

  renderList();
  renderRightContent();
}

function itemMatchesFilters(it) {
  if (searchQuery) {
    const qRaw = currentListSearchRaw || searchQuery.toLowerCase();
    const qNorm = currentListSearchNorm || normalizeHeadForMatch(searchQuery);
    const hitRaw = it._search && it._search.includes(qRaw);
    const hitNorm = qNorm && it._searchNorm && it._searchNorm.includes(qNorm);
    if (!hitRaw && !hitNorm) return false;
  }
  if (currentEntity === 'names' && activeFilters.size > 0) {
    if (!activeFilters.has(it.subcategory)) return false;
  }
  if (onlyQuestionCandidates && !(it.head || '').startsWith('?')) return false;
  if (onlyDiscussed && !it.discussed) return false;
  return true;
}

function buildVisibleItemsCacheKey() {
  const filters = Array.from(activeFilters).sort().join('|');
  const conf = ENTITY_TYPES[currentEntity];
  const itemCount = conf && Array.isArray(conf.items) ? conf.items.length : 0;
  return [
    currentEntity,
    searchQuery || '',
    onlyDiscussed ? '1' : '0',
    onlyQuestionCandidates ? '1' : '0',
    filters,
    String(itemCount),
  ].join('::');
}

function getVisibleItemsForCurrentEntity() {
  const cacheKey = buildVisibleItemsCacheKey();
  if (visibleItemsCache && visibleItemsCache.key === cacheKey) {
    return visibleItemsCache.value;
  }

  const items = (ENTITY_TYPES[currentEntity] && ENTITY_TYPES[currentEntity].items) || [];
  currentListSearchRaw = searchQuery ? searchQuery.toLowerCase() : '';
  currentListSearchNorm = searchQuery ? normalizeHeadForMatch(searchQuery) : '';
  let filtered = items.filter(itemMatchesFilters);
  filtered.sort(compareItemsByHead);
  const candidateCount = filtered.reduce((acc, it) => acc + (((it.head || '').startsWith('?')) ? 1 : 0), 0);
  const maxResults = currentEntity === 'all' ? 5000 : (currentEntity === 'lexicon_reverse' ? 2500 : 800);
  let truncated = false;
  if (filtered.length > maxResults) {
    filtered = filtered.slice(0, maxResults);
    truncated = true;
  }
  const value = { filtered, truncated, maxResults, candidateCount };
  visibleItemsCache = { key: cacheKey, value };
  return value;
}

function navigateCardByDelta(delta) {
  if (currentTab !== 'list' || rightPaneMode !== 'card') return false;
  const { filtered } = getVisibleItemsForCurrentEntity();
  if (!filtered.length) return false;
  let idx = filtered.findIndex(it => {
    if (!it || it.head !== selectedItem) return false;
    if (currentEntity !== 'all') return true;
    return (it._entityType || currentEntity) === (selectedItemType || currentEntity);
  });
  if (idx < 0) idx = delta > 0 ? -1 : filtered.length;
  idx += delta;
  if (idx < 0 || idx >= filtered.length) return false;
  const next = filtered[idx];
  if (!next) return false;
  selectListItem(next, next._entityType || currentEntity);
  return true;
}

function getCardNavigationState() {
  const { filtered } = getVisibleItemsForCurrentEntity();
  if (!filtered.length) return { canPrev: false, canNext: false };
  const idx = filtered.findIndex(it => {
    if (!it || it.head !== selectedItem) return false;
    if (currentEntity !== 'all') return true;
    return (it._entityType || currentEntity) === (selectedItemType || currentEntity);
  });
  if (idx < 0) return { canPrev: false, canNext: false };
  return { canPrev: idx > 0, canNext: idx < filtered.length - 1 };
}

function buildListItemInnerHtml(it, showTypeLabel) {
  let dot = '';
  if (currentEntity === 'names' && it.subcategory) {
    dot = `<span class="cat-dot" style="background:${safeColor(COLORS[it.subcategory], '#888')}"></span>`;
  } else if (currentEntity === 'all' && it._entityType === 'names' && it.subcategory) {
    dot = `<span class="cat-dot" style="background:${safeColor(COLORS[it.subcategory], '#888')}"></span>`;
  }
  const typeLabel = showTypeLabel ? ` <span class="entity-type-tag">${it._entityLabel}</span>` : '';
  const moderatorMark = it.is_moderator ? ' <span style="color:#999;font-size:10px;">· мод.</span>' : '';
  return `${dot}<span class="head ${it.discussed ? 'discussed' : ''}">${escapeHtml(it.head)}</span>${typeLabel}${moderatorMark}<span class="pages-count">${(it.page_list || []).length}</span>`;
}

function selectListItem(it, fallbackType) {
  selectedItem = it.head;
  selectedItemType = it._entityType || fallbackType || currentEntity;
  rememberRecentItem(selectedItemType, selectedItem);
  rightPaneMode = 'card';
  renderList();
  renderRightContent();
  syncNavigationState();
}

function appendItemsWithLetters(list, items, fallbackType) {
  const rows = buildListRowsWithLetters(items);
  const tmp = document.createElement('div');
  for (const row of rows) appendListRow(tmp, row, fallbackType, 1);
  if (typeof document.createDocumentFragment === 'function') {
    const frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    list.appendChild(frag);
    return;
  }
  while (tmp.firstChild) list.appendChild(tmp.firstChild);
}

function buildListRowsWithLetters(items) {
  const rows = [];
  let prevLetter = null;
  for (const it of items) {
    const letter = getFirstLetter(it.head);
    if (letter !== prevLetter) {
      rows.push({ kind: 'header', letter });
      prevLetter = letter;
    }
    rows.push({ kind: 'item', it });
  }
  return rows;
}

function appendListRow(list, row, fallbackType, reverseColumns) {
  if (row.kind === 'header') {
    const h = document.createElement('div');
    h.className = 'letter-header';
    h.textContent = row.letter;
    if (reverseColumns > 1) {
      h.style.breakInside = 'avoid-column';
      h.style.webkitColumnBreakInside = 'avoid';
    }
    list.appendChild(h);
    return false;
  }
  const it = row.it;
  const item = document.createElement('div');
  const isSelected = selectedItem === it.head && (currentEntity !== 'all' || selectedItemType === it._entityType);
  item.className = 'name-item' + (isSelected ? ' selected' : '');
  safeSetAttr(item, 'role', 'button');
  item.tabIndex = 0;
  safeSetAttr(item, 'aria-label', `${it.head || ''} (${(it.page_list || []).length})`);
  item.dataset.head = it.head || '';
  item.dataset.type = it._entityType || fallbackType || currentEntity;
  item.innerHTML = buildListItemInnerHtml(it, currentEntity === 'all');
  if (reverseColumns > 1) {
    item.style.breakInside = 'avoid-column';
    item.style.webkitColumnBreakInside = 'avoid';
  }
  list.appendChild(item);
  return true;
}

function renderListProgressive(list, items, fallbackType, reverseColumns) {
  const rows = buildListRowsWithLetters(items);
  const chunkRows = currentEntity === 'all' ? 900 : 650;
  let cursor = 0;
  let shownItems = 0;
  const selectedRowIndex = selectedItem
    ? rows.findIndex(r => r.kind === 'item' && r.it && r.it.head === selectedItem && (currentEntity !== 'all' || selectedItemType === r.it._entityType))
    : -1;
  const firstTarget = selectedRowIndex >= 0 ? Math.max(chunkRows, selectedRowIndex + 24) : chunkRows;

  const hint = document.createElement('div');
  hint.style.cssText = 'padding:8px 10px;color:#888;font-size:11px;text-align:center;';
  if (reverseColumns > 1) hint.style.columnSpan = 'all';

  const updateHint = () => {
    hint.textContent = cursor < rows.length
      ? `Показано ${shownItems} из ${items.length}. Прокрутите вниз для подгрузки.`
      : `Показано ${shownItems} элементов.`;
  };

  const appendChunk = (limitRows) => {
    const target = Math.min(rows.length, cursor + limitRows);
    while (cursor < target) {
      if (appendListRow(list, rows[cursor], fallbackType, reverseColumns)) shownItems++;
      cursor++;
    }
    updateHint();
    if (!hint.parentNode) list.appendChild(hint);
  };

  appendChunk(firstTarget);
  scrollSelectedItemIntoView(list);

  if (cursor >= rows.length) return;

  const onScroll = () => {
    if (list.scrollTop + list.clientHeight < list.scrollHeight - 220) return;
    appendChunk(chunkRows);
    if (cursor >= rows.length) {
      list.removeEventListener('scroll', onScroll);
      list._progressiveScrollHandler = null;
    }
  };
  list._progressiveScrollHandler = onScroll;
  list.addEventListener('scroll', onScroll);
}

function rowIndexForOffset(offsets, y) {
  if (!offsets || offsets.length < 2) return 0;
  if (y <= 0) return 0;
  const lastVal = offsets[offsets.length - 1];
  if (y >= lastVal) return Math.max(0, offsets.length - 2);
  let lo = 0, hi = offsets.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, Math.min(offsets.length - 2, lo));
}

function renderListVirtualized(list, items, fallbackType) {
  const rows = buildListRowsWithLetters(items);
  const HEADER_H = 24;
  const ITEM_H = 28;
  const OVERSCAN_PX = 500;
  const offsets = new Array(rows.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < rows.length; i++) {
    offsets[i + 1] = offsets[i] + (rows[i].kind === 'header' ? HEADER_H : ITEM_H);
  }
  const totalHeight = offsets[offsets.length - 1];
  const topSpacer = document.createElement('div');
  const viewport = document.createElement('div');
  const bottomSpacer = document.createElement('div');
  topSpacer.style.height = '0px';
  bottomSpacer.style.height = `${Math.max(0, totalHeight)}px`;
  viewport.style.willChange = 'contents';

  list.innerHTML = '';
  list.appendChild(topSpacer);
  list.appendChild(viewport);
  list.appendChild(bottomSpacer);

  let prevStart = -1;
  let prevEnd = -1;
  const selectedRowIndex = selectedItem
    ? rows.findIndex(r => r.kind === 'item' && r.it && r.it.head === selectedItem && (currentEntity !== 'all' || selectedItemType === r.it._entityType))
    : -1;
  if (selectedRowIndex >= 0) {
    const top = offsets[selectedRowIndex];
    const bottom = offsets[selectedRowIndex + 1];
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = Math.max(0, bottom - list.clientHeight);
  }

  const renderWindow = () => {
    const vh = Math.max(200, list.clientHeight || 0);
    const fromY = Math.max(0, list.scrollTop - OVERSCAN_PX);
    const toY = Math.min(totalHeight, list.scrollTop + vh + OVERSCAN_PX);
    const start = rowIndexForOffset(offsets, fromY);
    const end = Math.min(rows.length, rowIndexForOffset(offsets, toY) + 2);
    if (start === prevStart && end === prevEnd) return;
    prevStart = start;
    prevEnd = end;
    topSpacer.style.height = `${offsets[start]}px`;
    bottomSpacer.style.height = `${Math.max(0, totalHeight - offsets[end])}px`;
    viewport.innerHTML = '';
    for (let i = start; i < end; i++) appendListRow(viewport, rows[i], fallbackType, 1);
  };

  const onScroll = () => {
    if (list._virtualRaf) return;
    list._virtualRaf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(() => {
          list._virtualRaf = 0;
          renderWindow();
        })
      : 0;
    if (!list._virtualRaf) renderWindow();
  };
  list._virtualScrollHandler = onScroll;
  list.addEventListener('scroll', onScroll);
  renderWindow();
}

function scrollSelectedItemIntoView(list) {
  if (!list || !selectedItem) return;
  const selected = list.querySelector('.name-item.selected');
  if (!selected || typeof selected.scrollIntoView !== 'function') return;
  selected.scrollIntoView({ block: 'nearest' });
}

function getListColumnCount(entity, size) {
  if (typeof window === 'undefined' || typeof window.innerWidth !== 'number') return 1;
  const w = window.innerWidth;
  if (entity === 'lexicon_reverse') {
    if (size < 120) return 1;
    if (w >= 1700) return 5;
    if (w >= 1450) return 4;
    if (w >= 1200) return 3;
    if (w >= 950) return 2;
    return 1;
  }
  if (entity === 'all') {
    if (size < 180) return 1;
    if (w >= 1700) return 4;
    if (w >= 1350) return 3;
    if (w >= 1050) return 2;
    return 1;
  }
  return 1;
}

function renderList() {
  const list = document.getElementById('name-list');
  if (!list) return;
  if (list._virtualScrollHandler) {
    list.removeEventListener('scroll', list._virtualScrollHandler);
    list._virtualScrollHandler = null;
  }
  if (list._virtualRaf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(list._virtualRaf);
    list._virtualRaf = 0;
  }
  if (list._progressiveScrollHandler) {
    list.removeEventListener('scroll', list._progressiveScrollHandler);
    list._progressiveScrollHandler = null;
  }
  const { filtered, truncated, maxResults: MAX_RESULTS, candidateCount } = getVisibleItemsForCurrentEntity();
  const candidateBtn = document.getElementById('only-question-btn');
  if (candidateBtn) candidateBtn.textContent = `только ?-кандидаты (${candidateCount})`;

  list.innerHTML = '';
  const listColumns = getListColumnCount(currentEntity, filtered.length);
  const useVirtual = filtered.length > 1000 && currentEntity === 'lexicon';
  if (listColumns > 1 && !useVirtual) {
    list.style.columnCount = String(listColumns);
    list.style.columnGap = '12px';
    list.style.paddingRight = '4px';
  } else {
    list.style.columnCount = '';
    list.style.columnGap = '';
    list.style.paddingRight = '';
  }
  const useProgressive = !useVirtual && filtered.length > 1200 && ['all', 'lexicon', 'lexicon_reverse'].includes(currentEntity);
  if (useVirtual) {
    renderListVirtualized(list, filtered, currentEntity);
  } else if (useProgressive) {
    renderListProgressive(list, filtered, currentEntity, listColumns);
  } else {
    appendItemsWithLetters(list, filtered, currentEntity);
    if (listColumns > 1) {
      list.querySelectorAll('.letter-header, .name-item').forEach(el => {
        el.style.breakInside = 'avoid-column';
        el.style.webkitColumnBreakInside = 'avoid';
      });
    }
    scrollSelectedItemIntoView(list);
  }

  if (truncated) {
    const more = document.createElement('div');
    more.style.cssText = 'padding:12px; color:#888; text-align:center; font-size:11px;';
    if (listColumns > 1) more.style.columnSpan = 'all';
    more.textContent = `Показано первые ${MAX_RESULTS} результатов. Уточните запрос для сужения.`;
    list.appendChild(more);
  }
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:24px; color:#999; text-align:center;">Ничего не найдено</div>';
  }
}

function renderRightContent() {
  const right = getRightContentHost();
  if (!right) return;
  if (rightPaneMode === 'card' && selectedItem) {
    renderCardInRight();
  } else {
    renderHistogramInRight();
  }
  if (isMobileViewport()) {
    setMobileSheetOpen(rightPaneMode === 'card' && !!selectedItem);
  } else {
    setMobileSheetOpen(false);
  }
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
  if (backdrop.classList && typeof backdrop.classList.toggle === 'function') {
    backdrop.classList.toggle('open', !!open);
  } else {
    backdrop.style.display = open ? 'block' : 'none';
  }
  if (sheet.classList && typeof sheet.classList.toggle === 'function') {
    sheet.classList.toggle('open', !!open);
  } else {
    sheet.style.transform = open ? 'translateY(0)' : 'translateY(101%)';
  }
  if (document.body && document.body.classList && typeof document.body.classList.toggle === 'function') {
    document.body.classList.toggle('mobile-sheet-lock', !!open);
  }
}

function closeMobileSheet() {
  if (!isMobileViewport()) return;
  if (!(rightPaneMode === 'card' && selectedItem)) {
    setMobileSheetOpen(false);
    return;
  }
  rightPaneMode = 'histogram';
  selectedItem = null;
  selectedItemType = null;
  renderList();
  renderRightContent();
  syncNavigationState();
}

function getEntityItems(entityKey) {
  if (entityKey === 'all') return ENTITY_TYPES.all.items || [];
  return (ENTITY_TYPES[entityKey] && ENTITY_TYPES[entityKey].items) || [];
}

function getItemsForChapter(entityKey, chapter) {
  const items = getEntityItems(entityKey);
  const indexed = getChapterIndexedItems(entityKey, chapter.name);
  const filtered = indexed ? [...indexed] : items.filter(it => {
    for (const p of (it.page_list || [])) {
      if (p >= chapter.start && p <= chapter.end) return true;
    }
    return false;
  });
  filtered.sort(compareItemsByHead);
  return filtered;
}

function getChapterHistogramStats(entityKey) {
  const key = `${entityKey}::${getDataSignature()}`;
  return getCachedAggregate('histogram', key, () => {
    const counts = {};
    for (const ch of APP_DATA.chapters) {
      const indexed = getChapterIndexedItems(entityKey, ch.name);
      counts[ch.name] = indexed ? indexed.length : 0;
    }
    const max = Math.max(1, ...Object.values(counts));
    return { counts, max };
  });
}

function renderChapterListFilter(entityKey, chapterName) {
  const chapter = APP_DATA.chapters.find(c => c.name === chapterName);
  const list = document.getElementById('name-list');
  if (!chapter || !list) return;
  const filtered = getItemsForChapter(entityKey, chapter);
  list.innerHTML = `<div style="padding:6px 12px; background:#fff8e8; border-bottom:1px solid #d4c8b0; font-size:11px;"><strong>Лекция:</strong> ${escapeHtml(chapter.name)} <span style="color:#888">(${filtered.length})</span></div>`;
  appendItemsWithLetters(list, filtered, entityKey);
}

function renderChapterHistogramRows(host, entityKey) {
  const stats = getChapterHistogramStats(entityKey);
  const counts = stats.counts;
  const max = stats.max;
  let html = '';
  for (const ch of APP_DATA.chapters) {
    const c = counts[ch.name] || 0;
    const pct = c / max * 100;
    html += `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(ch.name)}<br><small style="color:#999">стр. ${ch.start}–${ch.end}</small></div>
        <div class="bar-bg"><div class="bar-fill" data-chapter="${escapeHtml(ch.name)}" style="width:${pct}%"></div></div>
        <div class="bar-count">${c}</div>
      </div>`;
  }
  host.innerHTML = html;
}

function renderHistogramInRight() {
  const right = getRightContentHost();
  if (!right) return;
  let html = `<div class="chart">
    <p class="chart-intro">Распределение элементов по лекциям. Кликните по столбцу — увидите элементы этой лекции.</p>
    <div id="right-histogram"></div>`;
  html += '</div></div>';
  right.innerHTML = html;
  const root = document.getElementById('right-histogram');
  if (!root) return;
  renderChapterHistogramRows(root, currentEntity);
  right.querySelectorAll('.bar-fill').forEach(bar => {
    bar.onclick = () => renderChapterListFilter(currentEntity, bar.dataset.chapter);
  });
}

function findItemByHeadAndType(head, type) {
  const targetType = type || currentEntity;
  return getIndexedItem(targetType, head);
}

function renderCardInRight() {
  const right = getRightContentHost();
  if (!right) return;
  const it = findItemByHeadAndType(selectedItem, selectedItemType);
  if (!it) {
    right.innerHTML = '<div class="card"><div style="color:#999; font-style:italic; text-align:center; padding:40px 0;">Элемент не найден</div></div>';
    return;
  }

  const photo = it.img ? `<img class="card-photo" src="${escapeHtml(safeImageUrl(it.img))}" alt="">` : '';
  const wikiLink = it.wiki ? `<a class="wiki-link" href="${escapeHtml(safeUrl(it.wiki))}" target="_blank" rel="noopener noreferrer">Статья в Википедии →</a>` : '';
  const eType = it._entityType || currentEntity;
  const editorial = (it.editorial_flags && typeof it.editorial_flags === 'object') ? it.editorial_flags : {};
  let category = '';
  if (eType === 'names') category = LABELS[it.subcategory] || 'Имя';
  else if (eType === 'toponyms') {
    category = 'Топоним';
    if (it.epoch_class && it.epoch_class !== 'unknown') {
      category += ' · ' + EPOCH_LABELS[it.epoch_class];
    }
  }
  else if (eType === 'ethnonyms') category = 'Этноним';
  else if (eType === 'languages') {
    category = 'Язык';
    if (it.family) category += ' · ' + it.family + (it.group && it.group !== it.family ? ' / ' + it.group : '');
  }
  else if (eType === 'lexicon') category = 'Лексема';
  else if (eType === 'lexicon_tech') category = 'Реконструированная или иноязычная форма';
  else if (eType === 'lexicon_reverse') category = 'Лексема (обратный алфавит)';
  else if (eType === 'subject') category = it.needs_review ? 'Понятие / термин (требует сверки — артефакт парсинга двухколоночной верстки)' : 'Понятие / термин';
  if (it.head && it.head.startsWith('?')) category = 'Кандидат — требует проверки редактором' + (it.note ? ' · ' + it.note : '');

  if (eType === 'subject' && editorial.suspect) category = 'Понятие / термин (требует сверки редактором)';
  if (editorial.suspect && it.head && it.head.startsWith('?')) {
    category = 'Кандидат — требует проверки редактором' + ((editorial.note || it.note) ? ' · ' + (editorial.note || it.note) : '');
  }
  const allPages = (it.page_list || []);
  let pagesText = it.pages || it.head_pages || '';

  let html = `
    <div class="card">
      <div class="card-header">
        ${photo}
        <div class="card-title-block">
          <h2>${escapeHtml(it.head)}</h2>
          <div class="category">${escapeHtml(category)}</div>
          ${wikiLink}
          <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="related-link related-link-btn" id="card-prev" aria-label="Предыдущая карточка" style="font-size:11px;">◀</button>
            <button type="button" class="related-link related-link-btn" id="card-next" aria-label="Следующая карточка" style="font-size:11px;">▶</button>
            <button type="button" class="related-link related-link-btn" id="back-to-histo" style="font-size:11px;">← вернуться к гистограмме</button>
            <button type="button" class="related-link related-link-btn" id="export-card-md" style="font-size:11px;">экспорт карточки .md</button>
            <button type="button" class="related-link related-link-btn" id="copy-card-link" style="font-size:11px;">скопировать ссылку</button>
          </div>
        </div>
      </div>
      <div class="pages-info">
        <strong>Упоминается на ${allPages.length} ${pluralPages(allPages.length)}:</strong>
        ${escapeHtml(pagesText)}
        ${it.discussed ? ' · <em>обсуждается</em>' : ' · однократное упоминание'}
      </div>
  `;
  const flagBadges = [];
  if (editorial.verified) flagBadges.push('<span style="padding:2px 6px;border-radius:999px;background:#e7f7ed;border:1px solid #b5e2c4;color:#2e6d44;font-size:11px;">verified</span>');
  if (editorial.suspect) flagBadges.push('<span style="padding:2px 6px;border-radius:999px;background:#fff6e8;border:1px solid #f0d1a6;color:#8b5a2b;font-size:11px;">suspect</span>');
  if (editorial.source_confirmed) flagBadges.push('<span style="padding:2px 6px;border-radius:999px;background:#eef4ff;border:1px solid #c3d6ff;color:#355a9a;font-size:11px;">source confirmed</span>');
  if (flagBadges.length) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${flagBadges.join('')}</div>`;
  }
  if (editorial.note) {
    html += `<div style="margin-top:8px;padding:8px 10px;background:#fffdf5;border-left:3px solid #d9c28a;border-radius:4px;font-size:12px;color:#6a5a3c;">
      <strong>Editor note:</strong> ${escapeHtml(editorial.note)}
    </div>`;
  }
  if (it.is_moderator && it.moderator_note) {
    html += `<div style="margin-top:10px;padding:8px 10px;background:#fff8e8;border-left:3px solid #8a7050;border-radius:4px;font-size:12px;color:#6a5040;">
      <strong>Примечание о подсчёте:</strong> ${escapeHtml(it.moderator_note)}
    </div>`;
  }

  // Контексты
  if (Array.isArray(it.sources) && it.sources.length > 0) {
    html += '<h3>Sources</h3><div class="related">';
    for (const src of it.sources.slice(0, 5)) {
      const label = escapeHtml(src.label || 'Source');
      const pageHint = src.page ? ` · p. ${escapeHtml(src.page)}` : '';
      const link = src.url
        ? `<a href="${escapeHtml(safeUrl(src.url))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
        : `<span>${label}</span>`;
      const quote = src.quote ? `<div style="font-size:12px;color:#444;line-height:1.45;margin:4px 0 2px 0;">“${escapeHtml(src.quote)}”</div>` : '';
      html += `<div style="padding:6px 0;border-bottom:1px dashed #ddd;">${link}<span style="color:#888;font-size:11px;">${pageHint}</span>${quote}</div>`;
    }
    html += '</div>';
  }
  const ctxKeys = it.contexts ? Object.keys(it.contexts).sort((a, b) => parseInt(a) - parseInt(b)) : [];
  if (ctxKeys.length > 0) {
    html += '<h3>Контексты упоминаний (KWIC)</h3>';
    for (const pg of ctxKeys.slice(0, 10)) {
      const ctxs = it.contexts[pg];
      for (const ctx of ctxs.slice(0, 1)) {
        html += `
          <div class="context-item">
            <div class="context-page">стр. ${pg}</div>
            <div class="context-text">${highlightInContext(ctx, it.head)}</div>
          </div>`;
      }
    }
  }

  // Главы
  if (it.chapters && it.chapters.length > 0) {
    html += '<h3>Лекции</h3><ul style="margin:0; padding-left:18px; font-size:12px;">';
    for (const ch of it.chapters) {
      const lectureIdx = findLectureIndexByName(ch);
      if (lectureIdx >= 0) {
        html += `<li><a class="related-link lecture-open-link" data-lecture-idx="${lectureIdx}" href="${escapeHtml(buildLecturePageHash(lectureIdx))}" style="text-decoration:underline dotted;">${escapeHtml(ch)}</a></li>`;
      } else {
        html += `<li>${escapeHtml(ch)}</li>`;
      }
    }
    html += '</ul>';
  }

  // Связи (только для имён)
  if (['lexicon', 'lexicon_reverse', 'lexicon_tech'].includes(eType)) {
    const relatedGlossary = findRelatedGlossaryTerms(it.head, 6);
    if (relatedGlossary.length > 0) {
      html += '<h3>Связанные термины глоссария</h3><div class="related">';
      for (const g of relatedGlossary) {
        const shortDef = g.definition.length > 92 ? (g.definition.slice(0, 89) + '…') : g.definition;
        html += `<a class="glossary-backlink" data-term="${escapeHtml(g.term)}" href="${escapeHtml(buildGlossaryTermHash(g.term))}" style="display:flex;justify-content:space-between;gap:8px;cursor:pointer;padding:2px 0;color:inherit;text-decoration:none;">
          <span>${escapeHtml(g.term)}</span>
          <span style="color:#888;font-size:10px;">${escapeHtml(shortDef)}</span>
        </a>`;
      }
      html += '</div>';
    }
  }

  if (eType === 'names' && APP_DATA.edges) {
    const relatedEdges = APP_DATA.edges.filter(e => e.source === it.head || e.target === it.head);
    if (relatedEdges.length > 0) {
      relatedEdges.sort((a, b) => b.weight - a.weight);
      html += '<h3>Рядом в тексте</h3><div class="related">';
      for (const e of relatedEdges.slice(0, 10)) {
        const other = e.source === it.head ? e.target : e.source;
        html += `<a class="xlink" data-type="names" data-head="${escapeHtml(other)}" href="${escapeHtml(buildItemHash('names', other))}" style="display:flex;justify-content:space-between;gap:8px;cursor:pointer;padding:2px 0;color:inherit;text-decoration:none;">
          <span>${escapeHtml(other)}</span>
          ${e.weight > 1 ? `<span style="color:#888;font-size:10px;">· ${escapeHtml(e.weight)}</span>` : '<span></span>'}
        </a>`;
      }
      html += '</div>';
    }
  }

  // Универсальные перекрёстные ссылки: связанные сущности других типов
  const crossLabels = {names: 'Связанные имена', toponyms: 'Связанные топонимы',
                       ethnonyms: 'Связанные этнонимы', languages: 'Связанные языки'};
  const cross = (APP_DATA.cross_links || {})[eType] || {};
  for (const [tgtType, tgtMap] of Object.entries(cross)) {
    const links = tgtMap[it.head];
    if (!links || links.length === 0) continue;
    html += `<h3>${crossLabels[tgtType] || tgtType}</h3><div class="related">`;
    for (const lnk of links.slice(0, 8)) {
    html += `<a class="xlink" data-type="${escapeHtml(tgtType)}" data-head="${escapeHtml(lnk.head)}" href="${escapeHtml(buildItemHash(tgtType, lnk.head))}" style="display:flex;justify-content:space-between;gap:8px;cursor:pointer;padding:2px 0;color:inherit;text-decoration:none;">
        <span>${escapeHtml(lnk.head)}</span>
        ${lnk.weight > 1 ? `<span style="color:#888;font-size:10px;">· ${escapeHtml(lnk.weight)}</span>` : '<span></span>'}
      </a>`;
    }
    html += '</div>';
  }

  html += '</div>';
  right.innerHTML = html;
  wireSafeImageFallback(right);

  const navState = getCardNavigationState();
  const prevBtn = document.getElementById('card-prev');
  if (prevBtn) {
    prevBtn.style.opacity = navState.canPrev ? '1' : '0.35';
    prevBtn.style.pointerEvents = navState.canPrev ? 'auto' : 'none';
    prevBtn.onclick = () => navigateCardByDelta(-1);
  }
  const nextBtn = document.getElementById('card-next');
  if (nextBtn) {
    nextBtn.style.opacity = navState.canNext ? '1' : '0.35';
    nextBtn.style.pointerEvents = navState.canNext ? 'auto' : 'none';
    nextBtn.onclick = () => navigateCardByDelta(1);
  }
  document.getElementById('back-to-histo').onclick = () => {
    rightPaneMode = 'histogram';
    selectedItem = null;
    selectedItemType = null;
    renderList();
    renderRightContent();
    syncNavigationState();
  };
  const exportCardBtn = document.getElementById('export-card-md');
  if (exportCardBtn) exportCardBtn.onclick = () => exportCurrentCardMarkdown();
  const copyLinkBtn = document.getElementById('copy-card-link');
  if (copyLinkBtn) {
    copyLinkBtn.onclick = async () => {
      const ok = await copyCurrentUrl();
      const prev = copyLinkBtn.textContent;
      copyLinkBtn.textContent = ok ? 'ссылка скопирована' : 'не удалось скопировать';
      announceUiMessage(ok ? 'Link copied' : 'Failed to copy link');
      setTimeout(() => { copyLinkBtn.textContent = prev; }, 1200);
    };
  }
  // Универсальная привязка для всех кросс-ссылок (xlink) с указанием типа
  bindNavigateLinks(right, '.xlink[data-head]', 'names');
  right.querySelectorAll('.glossary-backlink[data-term]').forEach(el => {
    el.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openGlossaryTerm(el.dataset.term || '');
    };
  });
  right.querySelectorAll('.lecture-open-link[data-lecture-idx]').forEach(el => {
    bindActionWithKeyboard(el, () => {
      const idx = parseInt((el.dataset && el.dataset.lectureIdx) || '0', 10);
      openLecturePage(Number.isFinite(idx) ? idx : 0);
    });
  });
  right.querySelectorAll('.related-link[data-name]').forEach(el => {
    el.onclick = () => {
      selectedItem = el.dataset.name;
      selectedItemType = 'names';
      rightPaneMode = 'card';
      renderList();
      renderRightContent();
      syncNavigationState();
    };
  });
}

// =========================================================
// КАРТОЧКИ СЕТКОЙ
// =========================================================
function renderCardsPanel(container) {
  container.innerHTML = '<div class="panel active"><div class="cards-grid-container"><div class="cards-grid" id="cards-grid"></div></div></div>';
  const grid = document.getElementById('cards-grid');
  const items = ENTITY_TYPES[currentEntity].items;
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
    card.innerHTML = `
      <div class="mc-head">${escapeHtml(it.head)}${it.discussed ? '<span class="mc-discussed">обсуждается</span>' : ''}</div>
      <div class="mc-cat">${escapeHtml(cat)}</div>
      <div class="mc-pages">стр. ${escapeHtml(pages)}</div>
    `;
    card.onclick = () => {
      selectedItem = it.head;
      selectedItemType = currentEntity;
      rightPaneMode = 'card';
      switchTab('list');
    };
    grid.appendChild(card);
  }
}

// =========================================================
// ГИСТОГРАММА (отдельная вкладка)
// =========================================================
function renderHistogramPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="chart">
    <p class="chart-intro">Распределение по лекциям книги. Кликните по столбцу — увидите элементы этой лекции.</p>
    <div id="histogram"></div></div></div>`;
  const chart = document.getElementById('histogram');
  if (!chart) return;
  renderChapterHistogramRows(chart, currentEntity);
  chart.querySelectorAll('.bar-fill').forEach(bar => {
    bar.onclick = () => {
      switchTab('list');
      setTimeout(() => renderChapterListFilter(currentEntity, bar.dataset.chapter), 50);
    };
  });
  perfDebug('render-histogram', nowMs() - t0, currentEntity);
}

// =========================================================
// ШКАЛА
// =========================================================
function renderTimelinePanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Имена на оси времени по векам. Каждая точка — одно имя; цвет показывает категорию. Кликните, чтобы открыть карточку.</p>
    <div id="timeline"></div>
    <div class="legend" id="timeline-legend"></div></div></div>`;
  const tl = document.getElementById('timeline');
  const items = ENTITY_TYPES[currentEntity].items;
  const withEpoch = items.filter(n => n.epoch !== null && n.epoch !== undefined);
  if (withEpoch.length === 0) { tl.innerHTML = '<p style="color:#888;">Нет данных.</p>'; return; }
  withEpoch.sort((a, b) => a.epoch - b.epoch);

  const isNarrow = window.innerWidth < 1000;
  const ticks = [-1500, -500, 0, 500, 1000, 1500, 1700, 1850, 1900, 1950, 2000, 2025];
  
  if (isNarrow) {
    // Вертикальная шкала для узких экранов
    const W = Math.max(480, window.innerWidth - 80);
    const padL = 100, padR = 20, padT = 20;
    const rowH = 28;
    const H = padT + withEpoch.length * rowH + 20;
    let svg = `<svg class="timeline-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - 20}" stroke="#8a7050" stroke-width="2"/>`;
    // Метки времени — слева от оси, в виде текста рядом с точками соответствующих десятилетий
    for (let i = 0; i < withEpoch.length; i++) {
      const n = withEpoch[i];
      const y = padT + 10 + i * rowH;
      const color = safeColor(COLORS[n.subcategory], '#888');
      const epochLabel = n.epoch < 0 ? (-n.epoch) + ' до н.э.' : String(n.epoch);
      svg += `<text x="${padL - 8}" y="${y + 4}" fill="#888" font-size="10" text-anchor="end">${epochLabel}</text>`;
      svg += `<g style="cursor:pointer" data-name="${escapeHtml(n.head)}">
        <circle cx="${padL}" cy="${y}" r="5" fill="${color}" stroke="white" stroke-width="1.5"></circle>
        <text x="${padL + 10}" y="${y + 4}" fill="#1a1a1a" font-size="12">${escapeHtml(n.head)}</text>
      </g>`;
    }
    svg += '</svg>';
    tl.innerHTML = svg;
  } else {
    // Горизонтальная шкала для широких экранов
    const W = Math.max(1200, window.innerWidth - 100);
    const padL = 80, padR = 60, padT = 40, rowH = 22;
    function epochToX(e) {
      for (let i = 0; i < ticks.length - 1; i++) {
        if (e >= ticks[i] && e <= ticks[i+1]) {
          const t = (e - ticks[i]) / (ticks[i+1] - ticks[i]);
          return padL + (i + t) / (ticks.length - 1) * (W - padL - padR);
        }
      }
      if (e < ticks[0]) return padL;
      return W - padR;
    }
    const placed = [];
    for (const n of withEpoch) {
      const x = epochToX(n.epoch);
      const labelW = n.head.length * 6 + 16;
      let level = 0;
      while (placed.some(p => p.level === level && !(p.x + p.labelW < x - 4 || x + labelW < p.x - 4))) level++;
      placed.push({ name: n, x, level, labelW });
    }
    const maxLevel = Math.max(...placed.map(p => p.level));
    const H = padT + (maxLevel + 1) * rowH + 30;
    let svg = `<svg class="timeline-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    const axisY = padT;
    svg += `<line x1="${padL}" y1="${axisY}" x2="${W - padR}" y2="${axisY}" stroke="#8a7050" stroke-width="2"/>`;
    for (let i = 0; i < ticks.length; i++) {
      const t = ticks[i];
      const x = padL + i / (ticks.length - 1) * (W - padL - padR);
      svg += `<line x1="${x}" y1="${axisY - 6}" x2="${x}" y2="${axisY + 6}" stroke="#8a7050" stroke-width="2"/>`;
      svg += `<line x1="${x}" y1="${axisY + 6}" x2="${x}" y2="${H - 5}" stroke="#f0e8d8" stroke-width="1" stroke-dasharray="2 3"/>`;
      let label;
      if (t < 0) label = (-t) + ' до н.э.';
      else if (t === 0) label = '0';
      else label = String(t);
      svg += `<text x="${x}" y="${axisY - 12}" fill="#5a3818" font-size="11" text-anchor="middle">${label}</text>`;
    }
    for (const p of placed) {
      const cy = axisY + 18 + p.level * rowH;
      const color = safeColor(COLORS[p.name.subcategory], '#888');
      svg += `<line x1="${p.x}" y1="${axisY}" x2="${p.x}" y2="${cy - 5}" stroke="#d4c8b0" stroke-width="1"/>`;
      svg += `<g style="cursor:pointer" data-name="${escapeHtml(p.name.head)}">
        <circle cx="${p.x}" cy="${cy}" r="5" fill="${color}" stroke="white" stroke-width="1.5"></circle>
        <text x="${p.x + 7}" y="${cy + 4}" fill="#1a1a1a" font-size="11">${escapeHtml(p.name.head)}</text>
      </g>`;
    }
    svg += '</svg>';
    tl.innerHTML = svg;
  }
  tl.querySelectorAll('g[data-name]').forEach(g => {
    g.onclick = () => {
      selectedItem = g.dataset.name;
      selectedItemType = currentEntity;
      rightPaneMode = 'card';
      switchTab('list');
    };
  });

  const lg = document.getElementById('timeline-legend');
  const subsPresent = new Set(withEpoch.map(n => n.subcategory));
  const order = ['linguist','literator','historical','participant','edition_staff'];
  for (const sub of order) {
    if (!subsPresent.has(sub)) continue;
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML = `<span class="legend-dot" style="background:${safeColor(COLORS[sub], '#888')}"></span>${LABELS[sub]}`;
    lg.appendChild(div);
  }
}

// =========================================================
// ЭПОХИ ТОПОНИМОВ
// =========================================================
function renderEpochsPanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Топонимы, разнесенные по историческим эпохам. В каждой колонке — те места, чья историческая роль приходится на этот период (древность, средневековье, новое время, новейшее).</p>
    <div id="epochs-grid"></div></div></div>`;
  const grid = document.getElementById('epochs-grid');
  const epochs = [
    {key: 'ancient', label: 'Античность', sub: 'до 500 г.'},
    {key: 'medieval', label: 'Средневековье', sub: '500–1500'},
    {key: 'modern', label: 'Новое время', sub: '1500–1900'},
    {key: 'contemporary', label: 'Новейшее', sub: '1900+'},
  ];
  const items = APP_DATA.toponyms;
  const grouped = {};
  for (const ep of epochs) grouped[ep.key] = [];
  for (const t of items) {
    if (t.epoch_class && grouped[t.epoch_class]) grouped[t.epoch_class].push(t);
  }
  for (const ep of epochs) {
    grouped[ep.key].sort(compareItemsByHead);
  }

  let html = '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px;">';
  for (const ep of epochs) {
    const list = grouped[ep.key];
    html += `<div style="border:1px solid #d4c8b0; border-radius:4px; padding:10px; background:#fff;">
      <div style="border-bottom:2px solid ${safeColor(EPOCH_COLORS[ep.key], '#8a7050')}; padding-bottom:6px; margin-bottom:8px;">
        <div style="font-weight:bold; font-size:14px; color:${safeColor(EPOCH_COLORS[ep.key], '#8a7050')};">${ep.label}</div>
        <div style="font-size:11px; color:#888;">${ep.sub} · ${list.length}</div>
      </div>
      <div style="font-size:12px;">`;
    for (const t of list) {
      html += `<a class="related-link" data-head="${escapeHtml(t.head)}" href="${escapeHtml(buildItemHash('toponyms', t.head))}" style="display:block;padding:2px 0; ${t.discussed?'font-weight:bold;':''}color:#5a3818;text-decoration:underline dotted;">${escapeHtml(t.head)}</a>`;
    }
    html += '</div></div>';
  }
  html += '</div>';
  grid.innerHTML = html;
  bindNavigateLinks(grid, '.related-link[data-head]', 'toponyms');
}

// =========================================================
// ТЕПЛОВАЯ КАРТА
// =========================================================
function getHeatmapTopItems(entityKey, limit = 50) {
  const key = `${entityKey}:${limit}:${getDataSignature()}`;
  return getCachedAggregate('heatmap', key, () => {
    const src = (ENTITY_TYPES[entityKey] && Array.isArray(ENTITY_TYPES[entityKey].items)) ? ENTITY_TYPES[entityKey].items : [];
    const items = src.filter(it => it.discussed);
    items.sort((a, b) => (b.page_list || []).length - (a.page_list || []).length);
    return items.slice(0, limit);
  });
}

function renderHeatmapPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="heatmap-container">
    <p class="chart-intro">Сетка «элемент × страница книги» (только обсуждаемые, топ-50). Цветные ячейки — упоминания.</p>
    <div id="heatmap"></div></div></div>`;
  const hm = document.getElementById('heatmap');
  const top = getHeatmapTopItems(currentEntity, 50);

  const TOTAL_PAGES = 404;
  const cellW = 2.2, cellH = 14, labelW = 220;
  const W = labelW + TOTAL_PAGES * cellW + 30;
  const H = top.length * cellH + 40;

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (const ch of APP_DATA.chapters) {
    const x1 = labelW + (ch.start - 1) * cellW;
    const x2 = labelW + ch.end * cellW;
    svg += `<rect x="${x1}" y="0" width="${x2-x1}" height="${H - 20}" fill="#fbf6e8" />`;
    svg += `<line x1="${x2}" y1="0" x2="${x2}" y2="${H - 20}" stroke="#e8dfc5" stroke-width="1"/>`;
  }
  let chIdx = 0;
  for (const ch of APP_DATA.chapters) {
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

// =========================================================
// ГРАФ ИМЁН
// =========================================================
function getNameGraphLayoutSync(strongOnly, W, H) {
  const key = `${strongOnly ? 1 : 0}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-names', key, () => {
    const items = APP_DATA.names || [];
    const srcEdges = APP_DATA.edges || [];
    const edges = strongOnly ? srcEdges.filter(e => e.weight >= 2) : srcEdges;
    const connectedNames = new Set();
    for (const e of edges) {
      connectedNames.add(e.source);
      connectedNames.add(e.target);
    }
    const nodes = items.filter(n => connectedNames.has(n.head)).map(n => ({
      name: n.head,
      subcat: n.subcategory,
      weight: (n.page_list || []).length,
      x: W / 2 + (deterministicUnitFromString(n.head + ':x', 11) - 0.5) * W * 0.8,
      y: H / 2 + (deterministicUnitFromString(n.head + ':y', 23) - 0.5) * H * 0.8,
      vx: 0,
      vy: 0,
    }));
    const idx = {};
    nodes.forEach((n, i) => { idx[n.name] = i; });
    const validEdges = edges.filter(e => idx[e.source] !== undefined && idx[e.target] !== undefined);

    function step() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const force = 1000 / d2;
          a.vx -= (dx / d) * force; a.vy -= (dy / d) * force;
          b.vx += (dx / d) * force; b.vy += (dy / d) * force;
        }
      }
      for (const e of validEdges) {
        const a = nodes[idx[e.source]], b = nodes[idx[e.target]];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const force = (d - 90) * 0.01 * Math.sqrt(e.weight);
        a.vx += (dx / d) * force; a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force; b.vy -= (dy / d) * force;
      }
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.001; n.vy += (H / 2 - n.y) * 0.001;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(40, Math.min(W - 40, n.x));
        n.y = Math.max(40, Math.min(H - 40, n.y));
      }
    }
    for (let i = 0; i < 300; i++) step();
    return { nodes, idx, validEdges };
  });
}

function getNameGraphLayout(strongOnly, W, H) {
  return getNameGraphLayoutSync(strongOnly, W, H);
}

function supportsNameGraphWorker() {
  return (
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

function disposeNameGraphWorker() {
  if (nameGraphWorker) {
    try { nameGraphWorker.terminate(); } catch (e) {}
    nameGraphWorker = null;
  }
  if (nameGraphWorkerBlobUrl) {
    try { URL.revokeObjectURL(nameGraphWorkerBlobUrl); } catch (e) {}
    nameGraphWorkerBlobUrl = null;
  }
}

function getNameGraphWorkerScript() {
  return [
    "function seed(text, salt) {",
    "  var h = (2166136261 ^ salt) >>> 0;",
    "  for (var i = 0; i < text.length; i++) {",
    "    h ^= text.charCodeAt(i);",
    "    h = Math.imul(h, 16777619);",
    "  }",
    "  h ^= h >>> 13;",
    "  h = Math.imul(h, 1274126177);",
    "  h ^= h >>> 16;",
    "  return (h >>> 0) / 4294967295;",
    "}",
    "self.onmessage = function(event) {",
    "  var data = event.data || {};",
    "  var requestId = data.requestId;",
    "  try {",
    "    var strongOnly = !!data.strongOnly;",
    "    var W = Number(data.W) || 1200;",
    "    var H = Number(data.H) || 600;",
    "    var names = Array.isArray(data.names) ? data.names : [];",
    "    var srcEdges = Array.isArray(data.edges) ? data.edges : [];",
    "    var edges = strongOnly ? srcEdges.filter(function(e) { return (e.weight || 0) >= 2; }) : srcEdges.slice();",
    "    var connected = new Set();",
    "    for (var ei = 0; ei < edges.length; ei++) {",
    "      connected.add(edges[ei].source);",
    "      connected.add(edges[ei].target);",
    "    }",
    "    var nodes = [];",
    "    for (var ni = 0; ni < names.length; ni++) {",
    "      var n = names[ni];",
    "      if (!connected.has(n.head)) continue;",
    "      var rx = seed(n.head + ':x', 11) - 0.5;",
    "      var ry = seed(n.head + ':y', 23) - 0.5;",
    "      nodes.push({",
    "        name: n.head,",
    "        subcat: n.subcat || '',",
    "        weight: Number(n.weight) || 0,",
    "        x: W / 2 + rx * W * 0.8,",
    "        y: H / 2 + ry * H * 0.8,",
    "        vx: 0,",
    "        vy: 0",
    "      });",
    "    }",
    "    var idx = {};",
    "    for (var i = 0; i < nodes.length; i++) idx[nodes[i].name] = i;",
    "    var validEdges = edges.filter(function(e) { return idx[e.source] !== undefined && idx[e.target] !== undefined; });",
    "    function step() {",
    "      for (var aIdx = 0; aIdx < nodes.length; aIdx++) {",
    "        for (var bIdx = aIdx + 1; bIdx < nodes.length; bIdx++) {",
    "          var a = nodes[aIdx], b = nodes[bIdx];",
    "          var dx = b.x - a.x, dy = b.y - a.y;",
    "          var d2 = dx * dx + dy * dy + 0.01;",
    "          var d = Math.sqrt(d2);",
    "          var force = 1000 / d2;",
    "          a.vx -= (dx / d) * force; a.vy -= (dy / d) * force;",
    "          b.vx += (dx / d) * force; b.vy += (dy / d) * force;",
    "        }",
    "      }",
    "      for (var eIdx = 0; eIdx < validEdges.length; eIdx++) {",
    "        var edge = validEdges[eIdx];",
    "        var left = nodes[idx[edge.source]], right = nodes[idx[edge.target]];",
    "        var ex = right.x - left.x, ey = right.y - left.y;",
    "        var ed = Math.sqrt(ex * ex + ey * ey) + 0.01;",
    "        var edgeForce = (ed - 90) * 0.01 * Math.sqrt(edge.weight || 0);",
    "        left.vx += (ex / ed) * edgeForce; left.vy += (ey / ed) * edgeForce;",
    "        right.vx -= (ex / ed) * edgeForce; right.vy -= (ey / ed) * edgeForce;",
    "      }",
    "      for (var nIdx = 0; nIdx < nodes.length; nIdx++) {",
    "        var node = nodes[nIdx];",
    "        node.vx += (W / 2 - node.x) * 0.001;",
    "        node.vy += (H / 2 - node.y) * 0.001;",
    "        node.vx *= 0.85;",
    "        node.vy *= 0.85;",
    "        node.x += node.vx;",
    "        node.y += node.vy;",
    "        node.x = Math.max(40, Math.min(W - 40, node.x));",
    "        node.y = Math.max(40, Math.min(H - 40, node.y));",
    "      }",
    "    }",
    "    for (var stepIdx = 0; stepIdx < 300; stepIdx++) step();",
    "    self.postMessage({ requestId: requestId, ok: true, layout: { nodes: nodes, idx: idx, validEdges: validEdges } });",
    "  } catch (error) {",
    "    self.postMessage({ requestId: requestId, ok: false, error: String((error && error.message) ? error.message : error) });",
    "  }",
    "};",
  ].join('\n');
}

function getNameGraphWorker() {
  if (!supportsNameGraphWorker()) return null;
  if (nameGraphWorker) return nameGraphWorker;
  try {
    const blob = new Blob([getNameGraphWorkerScript()], { type: 'text/javascript' });
    nameGraphWorkerBlobUrl = URL.createObjectURL(blob);
    nameGraphWorker = new Worker(nameGraphWorkerBlobUrl);
    return nameGraphWorker;
  } catch (e) {
    disposeNameGraphWorker();
    return null;
  }
}

function requestNameGraphLayoutFromWorker(strongOnly, W, H) {
  const worker = getNameGraphWorker();
  if (!worker) return null;
  const requestId = ++nameGraphWorkerRequestId;
  const names = (APP_DATA.names || []).map(n => ({
    head: n.head,
    subcat: n.subcategory,
    weight: (n.page_list || []).length,
  }));
  const edges = (APP_DATA.edges || []).map(e => ({
    source: e.source,
    target: e.target,
    weight: Number(e.weight) || 0,
  }));
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const data = event.data || {};
      if (data.requestId !== requestId) return;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (data.ok && data.layout) resolve(data.layout);
      else reject(new Error(data.error || 'name graph worker failed'));
    };
    const onError = (event) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      const msg = event && event.message ? event.message : 'name graph worker error';
      reject(new Error(msg));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ requestId, strongOnly, W, H, names, edges });
  });
}

function getNameGraphLayoutAsync(strongOnly, W, H) {
  const key = `${strongOnly ? 1 : 0}:${W}x${H}:${getDataSignature()}`;
  const cacheKey = `graph-names::${key}`;
  if (aggregateCache.has(cacheKey)) {
    perfDebug('graph-names-worker cache', 0, 'hit');
    return Promise.resolve(aggregateCache.get(cacheKey));
  }
  if (nameGraphLayoutPromiseCache.has(cacheKey)) {
    return nameGraphLayoutPromiseCache.get(cacheKey);
  }
  const t0 = nowMs();
  let job = null;
  if (supportsNameGraphWorker()) {
    job = requestNameGraphLayoutFromWorker(strongOnly, W, H);
  }
  if (!job) {
    job = Promise.resolve(getNameGraphLayoutSync(strongOnly, W, H));
  } else {
    job = job.catch((error) => {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[graph-worker] fallback to sync layout:', error && error.message ? error.message : error);
      }
      disposeNameGraphWorker();
      return getNameGraphLayoutSync(strongOnly, W, H);
    });
  }
  const promise = job.then((layout) => {
    aggregateCache.set(cacheKey, layout);
    if (aggregateCache.size > AGGREGATE_CACHE_MAX) {
      const oldest = aggregateCache.keys().next();
      if (!oldest.done) aggregateCache.delete(oldest.value);
    }
    nameGraphLayoutPromiseCache.delete(cacheKey);
    perfDebug('graph-names-worker', nowMs() - t0, 'miss');
    return layout;
  }).catch((error) => {
    nameGraphLayoutPromiseCache.delete(cacheKey);
    throw error;
  });
  nameGraphLayoutPromiseCache.set(cacheKey, promise);
  return promise;
}

function renderGraphPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Граф совместных упоминаний: имена соединены, если встречаются в тексте близко друг к другу. Вес связи учитывает позицию слов на странице — упоминание в конце одной страницы и в начале следующей даёт такой же вклад, как упоминание на одной строке. Иллюстрационные страницы пропускаются. Толщина линии — суммарный вес близостей всех упоминаний.</p>
    <div style="margin-bottom:8px;"><button class="filter-chip ${graphStrongOnly?'active':''}" id="graph-strong-btn">только сильные связи (вес ≥ 2)</button></div>
    <div id="graph-status" style="font-size:12px;color:#7b5b38;margin-bottom:8px;">Рассчитываю расположение узлов…</div>
    <canvas id="graph-canvas" width="1200" height="600"></canvas></div></div>`;

  document.getElementById('graph-strong-btn').onclick = (e) => {
    graphStrongOnly = !graphStrongOnly;
    e.target.classList.toggle('active', graphStrongOnly);
    renderGraphPanel(container);
  };

  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const status = document.getElementById('graph-status');
  const renderToken = ++nameGraphRenderToken;
  const modeMeta = graphStrongOnly ? 'strong' : 'all';

  function mountLayout(layout) {
    if (renderToken !== nameGraphRenderToken) return;
    const nodes = Array.isArray(layout.nodes) ? layout.nodes : [];
    const idx = layout.idx || {};
    const validEdges = Array.isArray(layout.validEdges) ? layout.validEdges : [];
    const canTransform = (
      typeof ctx.save === 'function' &&
      typeof ctx.restore === 'function' &&
      typeof ctx.translate === 'function' &&
      typeof ctx.scale === 'function'
    );
    let viewScale = 1;
    let viewOffsetX = 0;
    let viewOffsetY = 0;
    let hoverNode = null;
    let dragActive = false;
    let dragMoved = false;
    let dragLastX = 0;
    let dragLastY = 0;
    if (status) {
      status.textContent = '';
      status.style.display = 'none';
    }

    function eventToCanvasPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    }

    function screenToWorld(pt) {
      return {
        x: (pt.x - viewOffsetX) / viewScale,
        y: (pt.y - viewOffsetY) / viewScale,
      };
    }

    function pickNode(screenPt) {
      const worldPt = screenToWorld(screenPt);
      for (const n of nodes) {
        const r = 4 + Math.sqrt(n.weight) * 1.5;
        const hitR = (r + 5) / Math.max(0.25, viewScale);
        if ((worldPt.x - n.x) ** 2 + (worldPt.y - n.y) ** 2 < hitR ** 2) return n;
      }
      return null;
    }

    function draw(hover) {
      ctx.clearRect(0, 0, W, H);
      if (canTransform) {
        ctx.save();
        ctx.translate(viewOffsetX, viewOffsetY);
        ctx.scale(viewScale, viewScale);
      }
      for (const e of validEdges) {
        const a = nodes[idx[e.source]], b = nodes[idx[e.target]];
        if (!a || !b) continue;
        const ax = canTransform ? a.x : (a.x * viewScale + viewOffsetX);
        const ay = canTransform ? a.y : (a.y * viewScale + viewOffsetY);
        const bx = canTransform ? b.x : (b.x * viewScale + viewOffsetX);
        const by = canTransform ? b.y : (b.y * viewScale + viewOffsetY);
        ctx.strokeStyle = 'rgba(138, 112, 80, ' + Math.min(0.6, 0.2 + e.weight * 0.15) + ')';
        ctx.lineWidth = canTransform ? Math.sqrt(e.weight) * 1.2 : Math.sqrt(e.weight) * 1.2 * viewScale;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      for (const n of nodes) {
        const rBase = 4 + Math.sqrt(n.weight) * 1.5;
        const nx = canTransform ? n.x : (n.x * viewScale + viewOffsetX);
        const ny = canTransform ? n.y : (n.y * viewScale + viewOffsetY);
        const r = canTransform ? rBase : rBase * viewScale;
        ctx.fillStyle = safeColor(COLORS[n.subcat], '#666');
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
        if (r > 6) {
          ctx.fillStyle = '#1a1a1a'; ctx.font = '11px Georgia';
          ctx.textAlign = 'left'; ctx.fillText(n.name, nx + r + 3, ny + 4);
        }
      }
      if (canTransform) ctx.restore();
      if (hover) {
        const r = (4 + Math.sqrt(hover.weight) * 1.5) * viewScale;
        const hx = hover.x * viewScale + viewOffsetX;
        const hy = hover.y * viewScale + viewOffsetY;
        ctx.font = 'bold 13px Georgia';
        const tw = ctx.measureText(hover.name).width;
        ctx.fillStyle = 'rgba(255,248,232,0.95)';
        ctx.fillRect(hx + r + 2, hy - 16, tw + 8, 22);
        ctx.strokeStyle = '#8a7050';
        ctx.strokeRect(hx + r + 2, hy - 16, tw + 8, 22);
        ctx.fillStyle = '#5a3818';
        ctx.fillText(hover.name, hx + r + 6, hy);
      }
    }

    draw();
    canvas.style.cursor = 'grab';
    canvas.onwheel = (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const point = eventToCanvasPoint(e);
      const before = screenToWorld(point);
      const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      const nextScale = Math.max(0.45, Math.min(3.2, viewScale * zoomFactor));
      if (Math.abs(nextScale - viewScale) < 0.0001) return;
      viewScale = nextScale;
      viewOffsetX = point.x - before.x * viewScale;
      viewOffsetY = point.y - before.y * viewScale;
      hoverNode = pickNode(point);
      draw(hoverNode);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onmousedown = (e) => {
      if (e && e.button !== undefined && e.button !== 0) return;
      const point = eventToCanvasPoint(e);
      dragActive = true;
      dragMoved = false;
      dragLastX = point.x;
      dragLastY = point.y;
      canvas.style.cursor = 'grabbing';
    };
    canvas.onmousemove = (e) => {
      const point = eventToCanvasPoint(e);
      if (dragActive) {
        const dx = point.x - dragLastX;
        const dy = point.y - dragLastY;
        dragLastX = point.x;
        dragLastY = point.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.4) dragMoved = true;
        viewOffsetX += dx;
        viewOffsetY += dy;
        draw(hoverNode);
        canvas.style.cursor = 'grabbing';
        return;
      }
      hoverNode = pickNode(point);
      draw(hoverNode);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onmouseup = () => {
      if (!dragActive) return;
      dragActive = false;
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onmouseleave = () => {
      dragActive = false;
      canvas.style.cursor = 'grab';
    };
    canvas.ondblclick = () => {
      viewScale = 1;
      viewOffsetX = 0;
      viewOffsetY = 0;
      draw(hoverNode);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onclick = (e) => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      const point = eventToCanvasPoint(e);
      const picked = pickNode(point);
      if (!picked) return;
      selectedItem = picked.name;
      selectedItemType = 'names';
      rightPaneMode = 'card';
      switchTab('list');
    };
    perfDebug('render-graph-names', nowMs() - t0, modeMeta);
  }

  getNameGraphLayoutAsync(graphStrongOnly, W, H)
    .then((layout) => mountLayout(layout))
    .catch((error) => {
      if (renderToken !== nameGraphRenderToken) return;
      if (status) {
        status.style.display = 'block';
        status.textContent = 'Не удалось рассчитать граф.';
      }
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[graph-names] render failed:', error && error.message ? error.message : error);
      }
    });
}

// =========================================================
// ГРАФ ЯЗЫКОВЫХ СЕМЕЙ
// =========================================================
function getFamiliesGraphLayoutSync(strongOnly, W, H) {
  const key = `${strongOnly ? 1 : 0}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-families', key, () => {
    const items = APP_DATA.languages || [];
    const rawEdges = APP_DATA.language_edges || [];
    const edges = strongOnly
      ? rawEdges.filter(e => e.weight >= 50)
      : rawEdges.filter(e => e.weight >= 10);
    const connectedSet = new Set();
    for (const e of edges) {
      connectedSet.add(e.source);
      connectedSet.add(e.target);
    }
    const connectedItems = items.filter(l => connectedSet.has(l.head));
    const byFamily = {};
    for (const l of connectedItems) {
      const f = l.family || 'Не классифицировано';
      if (!byFamily[f]) byFamily[f] = [];
      byFamily[f].push(l);
    }
    const families = Object.keys(byFamily).sort((a, b) => byFamily[b].length - byFamily[a].length);
    const familyCounts = {};
    for (const fam of families) familyCounts[fam] = byFamily[fam].length;

    const nodes = [];
    const idx = {};
    const cx = W / 2, cy = H / 2;
    const familyAngles = {};
    for (let fi = 0; fi < families.length; fi++) {
      const angle = (fi / Math.max(1, families.length)) * Math.PI * 2;
      familyAngles[families[fi]] = angle;
    }
    for (let fi = 0; fi < families.length; fi++) {
      const fam = families[fi];
      const langs = byFamily[fam];
      const baseAngle = familyAngles[fam];
      const baseR = fam === 'Индоевропейская' ? 0 : 200;
      const fcx = cx + Math.cos(baseAngle) * baseR;
      const fcy = cy + Math.sin(baseAngle) * baseR;
      for (let li = 0; li < langs.length; li++) {
        const l = langs[li];
        const a = (li / Math.max(1, langs.length)) * Math.PI * 2;
        const r = fam === 'Индоевропейская' ? 230 : 50;
        nodes.push({
          name: l.head,
          family: fam,
          group: l.group,
          weight: (l.page_list || []).length,
          x: fcx + Math.cos(a) * r,
          y: fcy + Math.sin(a) * r,
          vx: 0,
          vy: 0,
        });
        idx[l.head] = nodes.length - 1;
      }
    }
    const validEdges = edges.filter(e => idx[e.source] !== undefined && idx[e.target] !== undefined);
    function step() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          if (d > 250) continue;
          const force = 800 / d2;
          a.vx -= (dx / d) * force; a.vy -= (dy / d) * force;
          b.vx += (dx / d) * force; b.vy += (dy / d) * force;
        }
      }
      for (const e of validEdges) {
        const a = nodes[idx[e.source]], b = nodes[idx[e.target]];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const force = (d - 60) * 0.02;
        a.vx += (dx / d) * force; a.vy += (dy / d) * force;
        b.vx -= (dx / d) * force; b.vy -= (dy / d) * force;
      }
      for (const n of nodes) {
        n.vx *= 0.8; n.vy *= 0.8;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(60, Math.min(W - 60, n.x));
        n.y = Math.max(60, Math.min(H - 60, n.y));
      }
    }
    for (let i = 0; i < 200; i++) step();
    return { nodes, idx, validEdges, families, familyCounts };
  });
}

function supportsFamiliesGraphWorker() {
  return (
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

function disposeFamiliesGraphWorker() {
  if (familiesGraphWorker) {
    try { familiesGraphWorker.terminate(); } catch (e) {}
    familiesGraphWorker = null;
  }
  if (familiesGraphWorkerBlobUrl) {
    try { URL.revokeObjectURL(familiesGraphWorkerBlobUrl); } catch (e) {}
    familiesGraphWorkerBlobUrl = null;
  }
}

function getFamiliesGraphWorkerScript() {
  return [
    "self.onmessage = function(event) {",
    "  var data = event.data || {};",
    "  var requestId = data.requestId;",
    "  try {",
    "    var strongOnly = !!data.strongOnly;",
    "    var W = Number(data.W) || 1300;",
    "    var H = Number(data.H) || 650;",
    "    var items = Array.isArray(data.languages) ? data.languages : [];",
    "    var rawEdges = Array.isArray(data.edges) ? data.edges : [];",
    "    var edges = strongOnly ? rawEdges.filter(function(e) { return (e.weight || 0) >= 50; }) : rawEdges.filter(function(e) { return (e.weight || 0) >= 10; });",
    "    var connectedSet = new Set();",
    "    for (var ei = 0; ei < edges.length; ei++) { connectedSet.add(edges[ei].source); connectedSet.add(edges[ei].target); }",
    "    var connectedItems = items.filter(function(l) { return connectedSet.has(l.head); });",
    "    var byFamily = {};",
    "    for (var li = 0; li < connectedItems.length; li++) {",
    "      var lang = connectedItems[li];",
    "      var family = lang.family || 'Не классифицировано';",
    "      if (!byFamily[family]) byFamily[family] = [];",
    "      byFamily[family].push(lang);",
    "    }",
    "    var families = Object.keys(byFamily).sort(function(a, b) { return byFamily[b].length - byFamily[a].length; });",
    "    var familyCounts = {};",
    "    for (var fi0 = 0; fi0 < families.length; fi0++) familyCounts[families[fi0]] = byFamily[families[fi0]].length;",
    "    var nodes = [];",
    "    var idx = {};",
    "    var cx = W / 2, cy = H / 2;",
    "    var familyAngles = {};",
    "    for (var fi = 0; fi < families.length; fi++) { familyAngles[families[fi]] = (fi / Math.max(1, families.length)) * Math.PI * 2; }",
    "    for (var fIdx = 0; fIdx < families.length; fIdx++) {",
    "      var fam = families[fIdx];",
    "      var langs = byFamily[fam];",
    "      var baseAngle = familyAngles[fam];",
    "      var baseR = fam === 'Индоевропейская' ? 0 : 200;",
    "      var fcx = cx + Math.cos(baseAngle) * baseR;",
    "      var fcy = cy + Math.sin(baseAngle) * baseR;",
    "      for (var lIdx = 0; lIdx < langs.length; lIdx++) {",
    "        var l = langs[lIdx];",
    "        var a = (lIdx / Math.max(1, langs.length)) * Math.PI * 2;",
    "        var r = fam === 'Индоевропейская' ? 230 : 50;",
    "        nodes.push({",
    "          name: l.head,",
    "          family: fam,",
    "          group: l.group,",
    "          weight: Number(l.weight) || 0,",
    "          x: fcx + Math.cos(a) * r,",
    "          y: fcy + Math.sin(a) * r,",
    "          vx: 0,",
    "          vy: 0",
    "        });",
    "        idx[l.head] = nodes.length - 1;",
    "      }",
    "    }",
    "    var validEdges = edges.filter(function(e) { return idx[e.source] !== undefined && idx[e.target] !== undefined; });",
    "    function step() {",
    "      for (var i = 0; i < nodes.length; i++) {",
    "        for (var j = i + 1; j < nodes.length; j++) {",
    "          var a = nodes[i], b = nodes[j];",
    "          var dx = b.x - a.x, dy = b.y - a.y;",
    "          var d2 = dx * dx + dy * dy + 0.01;",
    "          var d = Math.sqrt(d2);",
    "          if (d > 250) continue;",
    "          var force = 800 / d2;",
    "          a.vx -= (dx / d) * force; a.vy -= (dy / d) * force;",
    "          b.vx += (dx / d) * force; b.vy += (dy / d) * force;",
    "        }",
    "      }",
    "      for (var eIdx = 0; eIdx < validEdges.length; eIdx++) {",
    "        var edge = validEdges[eIdx];",
    "        var left = nodes[idx[edge.source]], right = nodes[idx[edge.target]];",
    "        var ex = right.x - left.x, ey = right.y - left.y;",
    "        var ed = Math.sqrt(ex * ex + ey * ey) + 0.01;",
    "        var edgeForce = (ed - 60) * 0.02;",
    "        left.vx += (ex / ed) * edgeForce; left.vy += (ey / ed) * edgeForce;",
    "        right.vx -= (ex / ed) * edgeForce; right.vy -= (ey / ed) * edgeForce;",
    "      }",
    "      for (var nIdx = 0; nIdx < nodes.length; nIdx++) {",
    "        var node = nodes[nIdx];",
    "        node.vx *= 0.8; node.vy *= 0.8;",
    "        node.x += node.vx; node.y += node.vy;",
    "        node.x = Math.max(60, Math.min(W - 60, node.x));",
    "        node.y = Math.max(60, Math.min(H - 60, node.y));",
    "      }",
    "    }",
    "    for (var stepIdx = 0; stepIdx < 200; stepIdx++) step();",
    "    self.postMessage({ requestId: requestId, ok: true, layout: { nodes: nodes, idx: idx, validEdges: validEdges, families: families, familyCounts: familyCounts } });",
    "  } catch (error) {",
    "    self.postMessage({ requestId: requestId, ok: false, error: String((error && error.message) ? error.message : error) });",
    "  }",
    "};",
  ].join('\n');
}

function getFamiliesGraphWorker() {
  if (!supportsFamiliesGraphWorker()) return null;
  if (familiesGraphWorker) return familiesGraphWorker;
  try {
    const blob = new Blob([getFamiliesGraphWorkerScript()], { type: 'text/javascript' });
    familiesGraphWorkerBlobUrl = URL.createObjectURL(blob);
    familiesGraphWorker = new Worker(familiesGraphWorkerBlobUrl);
    return familiesGraphWorker;
  } catch (e) {
    disposeFamiliesGraphWorker();
    return null;
  }
}

function requestFamiliesGraphLayoutFromWorker(strongOnly, W, H) {
  const worker = getFamiliesGraphWorker();
  if (!worker) return null;
  const requestId = ++familiesGraphWorkerRequestId;
  const languages = (APP_DATA.languages || []).map(l => ({
    head: l.head,
    family: l.family || 'Не классифицировано',
    group: l.group || '',
    weight: (l.page_list || []).length,
  }));
  const edges = (APP_DATA.language_edges || []).map(e => ({
    source: e.source,
    target: e.target,
    weight: Number(e.weight) || 0,
  }));
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const data = event.data || {};
      if (data.requestId !== requestId) return;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (data.ok && data.layout) resolve(data.layout);
      else reject(new Error(data.error || 'families graph worker failed'));
    };
    const onError = (event) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      const msg = event && event.message ? event.message : 'families graph worker error';
      reject(new Error(msg));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ requestId, strongOnly, W, H, languages, edges });
  });
}

function getFamiliesGraphLayoutAsync(strongOnly, W, H) {
  const key = `${strongOnly ? 1 : 0}:${W}x${H}:${getDataSignature()}`;
  const cacheKey = `graph-families::${key}`;
  if (aggregateCache.has(cacheKey)) {
    perfDebug('graph-families-worker cache', 0, 'hit');
    return Promise.resolve(aggregateCache.get(cacheKey));
  }
  if (familiesGraphLayoutPromiseCache.has(cacheKey)) {
    return familiesGraphLayoutPromiseCache.get(cacheKey);
  }
  const t0 = nowMs();
  let job = null;
  if (supportsFamiliesGraphWorker()) {
    job = requestFamiliesGraphLayoutFromWorker(strongOnly, W, H);
  }
  if (!job) {
    job = Promise.resolve(getFamiliesGraphLayoutSync(strongOnly, W, H));
  } else {
    job = job.catch((error) => {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[families-worker] fallback to sync layout:', error && error.message ? error.message : error);
      }
      disposeFamiliesGraphWorker();
      return getFamiliesGraphLayoutSync(strongOnly, W, H);
    });
  }
  const promise = job.then((layout) => {
    aggregateCache.set(cacheKey, layout);
    if (aggregateCache.size > AGGREGATE_CACHE_MAX) {
      const oldest = aggregateCache.keys().next();
      if (!oldest.done) aggregateCache.delete(oldest.value);
    }
    familiesGraphLayoutPromiseCache.delete(cacheKey);
    perfDebug('graph-families-worker', nowMs() - t0, 'miss');
    return layout;
  }).catch((error) => {
    familiesGraphLayoutPromiseCache.delete(cacheKey);
    throw error;
  });
  familiesGraphLayoutPromiseCache.set(cacheKey, promise);
  return promise;
}

function wireGraphWorkersLifecycle() {
  if (workersLifecycleWired) return;
  workersLifecycleWired = true;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  const disposeAll = () => {
    disposeNameGraphWorker();
    disposeFamiliesGraphWorker();
  };
  window.addEventListener('pagehide', disposeAll, { passive: true });
  window.addEventListener('beforeunload', disposeAll);
}

function renderFamiliesPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Граф языков: соединены языки, упоминаемые в книге близко друг к другу в тексте. Алгоритм позиционного взвешивания учитывает место упоминания на странице, а не только её номер — разрыв страницы между близкими упоминаниями не наказывается. Цвет узла — языковая семья. По умолчанию показаны только сильные связи (вес ≥ 10).</p>
    <div style="margin-bottom:8px;"><button class="filter-chip ${graphStrongOnly ? 'active' : ''}" id="lang-strong-btn">только сильные связи (вес ≥ 50)</button></div>
    <div id="families-status" style="font-size:12px;color:#7b5b38;margin-bottom:8px;">Рассчитываю расположение узлов…</div>
    <canvas id="graph-canvas" width="1300" height="650"></canvas>
    <div class="legend" id="families-legend"></div></div></div>`;

  document.getElementById('lang-strong-btn').onclick = (e) => {
    graphStrongOnly = !graphStrongOnly;
    e.target.classList.toggle('active', graphStrongOnly);
    renderFamiliesPanel(container);
  };

  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const status = document.getElementById('families-status');
  const renderToken = ++familiesGraphRenderToken;

  function mountLayout(layout) {
    if (renderToken !== familiesGraphRenderToken) return;
    const nodes = Array.isArray(layout.nodes) ? layout.nodes : [];
    const idx = layout.idx || {};
    const validEdges = Array.isArray(layout.validEdges) ? layout.validEdges : [];
    const families = Array.isArray(layout.families) ? layout.families : [];
    const familyCounts = layout.familyCounts || {};
    const canTransform = (
      typeof ctx.save === 'function' &&
      typeof ctx.restore === 'function' &&
      typeof ctx.translate === 'function' &&
      typeof ctx.scale === 'function'
    );
    let viewScale = 1;
    let viewOffsetX = 0;
    let viewOffsetY = 0;
    let hoverNode = null;
    let dragActive = false;
    let dragMoved = false;
    let dragLastX = 0;
    let dragLastY = 0;

    if (status) {
      status.textContent = '';
      status.style.display = 'none';
    }

    function eventToCanvasPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    }

    function screenToWorld(pt) {
      return {
        x: (pt.x - viewOffsetX) / viewScale,
        y: (pt.y - viewOffsetY) / viewScale,
      };
    }

    function pickNode(screenPt) {
      const worldPt = screenToWorld(screenPt);
      for (const n of nodes) {
        const r = 4 + Math.sqrt(n.weight) * 1.2;
        const hitR = (r + 5) / Math.max(0.25, viewScale);
        if ((worldPt.x - n.x) ** 2 + (worldPt.y - n.y) ** 2 < hitR ** 2) return n;
      }
      return null;
    }

    function draw(hover) {
      ctx.clearRect(0, 0, W, H);
      if (canTransform) {
        ctx.save();
        ctx.translate(viewOffsetX, viewOffsetY);
        ctx.scale(viewScale, viewScale);
      }
      for (const e of validEdges) {
        const a = nodes[idx[e.source]], b = nodes[idx[e.target]];
        if (!a || !b) continue;
        const ax = canTransform ? a.x : (a.x * viewScale + viewOffsetX);
        const ay = canTransform ? a.y : (a.y * viewScale + viewOffsetY);
        const bx = canTransform ? b.x : (b.x * viewScale + viewOffsetX);
        const by = canTransform ? b.y : (b.y * viewScale + viewOffsetY);
        const fam = a.family;
        const color = safeColor(FAMILY_COLORS[fam], '#888');
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = canTransform ? 1 : viewScale;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      for (const n of nodes) {
        const rBase = 4 + Math.sqrt(n.weight) * 1.2;
        const nx = canTransform ? n.x : (n.x * viewScale + viewOffsetX);
        const ny = canTransform ? n.y : (n.y * viewScale + viewOffsetY);
        const r = canTransform ? rBase : rBase * viewScale;
        const color = safeColor(FAMILY_COLORS[n.family], '#888');
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
        if (r > 5) {
          ctx.fillStyle = '#1a1a1a'; ctx.font = '10px Georgia';
          ctx.textAlign = 'left'; ctx.fillText(n.name, nx + r + 3, ny + 4);
        }
      }
      if (canTransform) ctx.restore();
      if (hover) {
        const r = (4 + Math.sqrt(hover.weight) * 1.2) * viewScale;
        const hx = hover.x * viewScale + viewOffsetX;
        const hy = hover.y * viewScale + viewOffsetY;
        ctx.font = 'bold 12px Georgia';
        const text = hover.name + ' (' + hover.family + ')';
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(255,248,232,0.95)';
        ctx.fillRect(hx + r + 2, hy - 16, tw + 8, 22);
        ctx.strokeStyle = '#8a7050';
        ctx.strokeRect(hx + r + 2, hy - 16, tw + 8, 22);
        ctx.fillStyle = '#5a3818';
        ctx.fillText(text, hx + r + 6, hy);
      }
    }

    draw();
    canvas.style.cursor = 'grab';
    canvas.onwheel = (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const point = eventToCanvasPoint(e);
      const before = screenToWorld(point);
      const zoomFactor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      const nextScale = Math.max(0.45, Math.min(3.2, viewScale * zoomFactor));
      if (Math.abs(nextScale - viewScale) < 0.0001) return;
      viewScale = nextScale;
      viewOffsetX = point.x - before.x * viewScale;
      viewOffsetY = point.y - before.y * viewScale;
      hoverNode = pickNode(point);
      draw(hoverNode);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onmousedown = (e) => {
      if (e && e.button !== undefined && e.button !== 0) return;
      const point = eventToCanvasPoint(e);
      dragActive = true;
      dragMoved = false;
      dragLastX = point.x;
      dragLastY = point.y;
      canvas.style.cursor = 'grabbing';
    };
    canvas.onmousemove = (e) => {
      const point = eventToCanvasPoint(e);
      if (dragActive) {
        const dx = point.x - dragLastX;
        const dy = point.y - dragLastY;
        dragLastX = point.x;
        dragLastY = point.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.4) dragMoved = true;
        viewOffsetX += dx;
        viewOffsetY += dy;
        draw(hoverNode);
        canvas.style.cursor = 'grabbing';
        return;
      }
      hoverNode = pickNode(point);
      draw(hoverNode);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onmouseup = () => {
      if (!dragActive) return;
      dragActive = false;
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onmouseleave = () => {
      dragActive = false;
      canvas.style.cursor = 'grab';
    };
    canvas.ondblclick = () => {
      viewScale = 1;
      viewOffsetX = 0;
      viewOffsetY = 0;
      draw(hoverNode);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    };
    canvas.onclick = (e) => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      const point = eventToCanvasPoint(e);
      const picked = pickNode(point);
      if (!picked) return;
      selectedItem = picked.name;
      selectedItemType = 'languages';
      rightPaneMode = 'card';
      switchTab('list');
    };

    const lg = document.getElementById('families-legend');
    if (lg) {
      lg.innerHTML = '';
      for (const fam of families) {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `<span class="legend-dot" style="background:${safeColor(FAMILY_COLORS[fam], '#888')}"></span>${fam} (${familyCounts[fam] || 0})`;
        lg.appendChild(div);
      }
    }
    perfDebug('render-graph-families', nowMs() - t0, graphStrongOnly ? 'strong' : 'all');
  }

  getFamiliesGraphLayoutAsync(graphStrongOnly, W, H)
    .then((layout) => mountLayout(layout))
    .catch((error) => {
      if (renderToken !== familiesGraphRenderToken) return;
      if (status) {
        status.style.display = 'block';
        status.textContent = 'Не удалось рассчитать граф.';
      }
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[graph-families] render failed:', error && error.message ? error.message : error);
      }
    });
}

function getSavedReadingPage() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = parseInt(localStorage.getItem(READING_PAGE_STORAGE_KEY) || '', 10);
    return Number.isFinite(raw) ? raw : null;
  } catch (e) {
    return null;
  }
}

function saveReadingPage(page) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(READING_PAGE_STORAGE_KEY, String(page)); } catch (e) {}
}

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

function loadRecentItems() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(x => x && typeof x.type === 'string' && typeof x.head === 'string').slice(0, 20);
  } catch (e) {
    return [];
  }
}

function saveRecentItems(items) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(items.slice(0, 20))); } catch (e) {}
}

function rememberRecentItem(type, head) {
  if (!type || !head) return;
  const items = loadRecentItems();
  const normalizedHead = String(head);
  const filtered = items.filter(x => !(x.type === type && x.head === normalizedHead));
  filtered.unshift({ type, head: normalizedHead, ts: Date.now() });
  saveRecentItems(filtered);
}

// =========================================================
// ГЛАВНАЯ: статистика, маршруты, задачи
// =========================================================
function renderHomePanel(container) {
  const stats = APP_DATA.book_stats;
  const routes = APP_DATA.routes || [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const vw = (typeof window !== 'undefined' && typeof window.innerWidth === 'number') ? window.innerWidth : 0;
  const vh = (typeof window !== 'undefined' && typeof window.innerHeight === 'number') ? window.innerHeight : 0;
  const desktopNoInnerScroll = vw >= 980;
  const compactHome = desktopNoInnerScroll && vh > 0 && vh <= 840;
  const routeGridStyle = compactHome
    ? 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px;'
    : desktopNoInnerScroll
      ? 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px;'
      : 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:24px;';
  const homePanelOverflow = desktopNoInnerScroll ? 'hidden' : 'auto';
  const homeInnerPadding = compactHome ? '10px 14px' : '14px 20px';
  const factPairStyle = compactHome
    ? 'display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,0.95fr);gap:8px;align-items:start;'
    : 'display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px;align-items:start;';
  const quoteTextClamp = compactHome
    ? 'display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;'
    : '';

  let html = `<div class="panel active home-panel" style="overflow-y:${homePanelOverflow};height:100%;"><div style="padding:${homeInnerPadding};max-width:1200px;margin:0 auto;">`;

  // === БЛОК 1: КНИГА В ЦИФРАХ ===
  html += `<div style="background:linear-gradient(135deg,#5a3818,#8a7050);color:#fff8e8;padding:16px 20px;border-radius:6px;margin-bottom:14px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <h2 style="margin:0 0 4px 0;font-size:22px;font-weight:normal;">Книга в цифрах</h2>
      <button id="export-site-md" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;white-space:nowrap;">Экспорт всего сайта в Markdown</button>
    </div>
    <div style="font-size:13px;opacity:0.85;font-style:italic;margin-bottom:14px;">Что внутри 404 страниц лекций А. А. Зализняка</div>
    <div id="home-stats-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">`;

  const cells = [
    ['404', 'страницы'],
    [stats.has_preface ? '10 + 1' : String(stats.lectures || 10), stats.has_preface ? 'лекций + предисловие' : 'лекций'],
    [stats.names, 'имён'],
    [stats.languages, 'языков'],
    [stats.toponyms, 'топонимов'],
    [stats.ethnonyms, 'этнонимов'],
    [stats.lexicon.toLocaleString('ru'), 'лексем'],
    [stats.subject_index, 'понятий'],
  ];
  for (const [num, label] of cells) {
    html += `<div style="background:rgba(255,248,232,0.15);padding:10px 12px;border-radius:4px;border-left:3px solid #fff8e8;">
      <div style="font-size:24px;font-weight:bold;line-height:1;">${num}</div>
      <div style="font-size:11px;opacity:0.85;margin-top:4px;">${label}</div>
    </div>`;
  }
  html += '</div>';

  // Изюминки
  html += `<div style="margin-top:${compactHome ? 10 : 14}px;padding-top:${compactHome ? 10 : 14}px;border-top:1px solid rgba(255,248,232,0.25);font-size:12px;line-height:${compactHome ? 1.55 : 1.7};">
    <div id="home-fact-pair" style="${factPairStyle}">
      <div>
        <div>📖 Самая длинная лекция — <strong>«${escapeHtml(stats.longest_lecture.name)}»</strong> (${stats.longest_lecture.pages} страниц)</div>
        <div>🗣 Самый часто упоминаемый язык — <strong>${escapeHtml(stats.top_lang.head)}</strong> (${stats.top_lang.count} упоминаний)</div>
        <div>🌍 Самое часто упоминаемое место — <strong>${escapeHtml(stats.top_topo.head)}</strong> (${stats.top_topo.count} упоминаний)</div>
        <div>👤 Самый часто упоминаемый человек — <strong>${escapeHtml(stats.top_name.head)}</strong> (${stats.top_name.count} упоминаний)</div>
        <div>📜 Самое часто обсуждаемое слово — <strong>«${escapeHtml(stats.top_lex.head)}»</strong> (${stats.top_lex.count} упоминаний)</div>
        <div>⏳ Самый ранний из упомянутых — <strong>${escapeHtml(stats.earliest_person.head)}</strong> (${Math.abs(stats.earliest_person.epoch)} ${stats.earliest_person.epoch < 0 ? 'до н.&nbsp;э.' : 'г.'})</div>
        <div>🌐 Самая представленная семья — <strong>${escapeHtml(stats.top_family[0])}</strong> (${stats.top_family[1]} языков)</div>
      </div>
      <div id="home-featured-quote" style="padding-left:${compactHome ? 8 : 10}px;border-left:2px solid rgba(255,248,232,0.45);font-style:italic;align-self:start;">
        <div id="home-featured-quote-text" style="${quoteTextClamp}">«${escapeHtml(featured.text)}»</div>
        <div style="margin-top:6px;font-style:normal;opacity:0.85;">— стр. ${escapeHtml(featured.page)}, лекция «${escapeHtml(featured.lecture)}»</div>
        <div style="margin-top:8px;font-style:normal;opacity:0.9;font-size:11px;">Выберите свой путь по книге — если не знаете, с чего начать, выберите тему, которая вас интересует.</div>
      </div>
    </div>
  </div></div>`;

  // === БЛОК 1.5: ЧИТАЮ СЕЙЧАС ===
  html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:12px 14px;margin-bottom:14px;">
    <div style="font-size:16px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Режим «Читаю сейчас»</div>
    <div style="font-size:12px;color:#777;margin-bottom:8px;">Введите номер страницы, и мы покажем, кто и что на ней упоминается.</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button id="reading-page-prev" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">←</button>
      <input id="reading-page-input" type="number" min="1" max="${escapeHtml(stats.total_pages || 404)}" step="1" style="width:120px;padding:6px 8px;border:1px solid #c4b890;border-radius:4px;font-family:inherit;font-size:13px;" />
      <button id="reading-page-next" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">→</button>
      <button id="reading-page-go" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Показать</button>
      <button id="reading-page-trends" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Динамика страницы</button>
    </div>
    <div id="reading-now-results" style="margin-top:10px;font-size:12px;line-height:1.6;color:#444;"></div>
  </div>`;

  const recentItems = loadRecentItems().slice(0, 10);
  if (!compactHome) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;margin-bottom:14px;">
      <div style="font-size:14px;color:#5a3818;font-weight:normal;margin-bottom:6px;">Недавно открывали</div>
      <div id="home-recent-items" style="font-size:12px;line-height:1.6;">${recentItems.length ? '' : '<span style="color:#888;">Пока пусто — откройте любую карточку.</span>'}</div>
    </div>`;
  }

  // === БЛОК 2: МАРШРУТЫ ===
  if (compactHome) {
    html += `<details id="home-routes-details" style="margin-top:8px;border:1px solid #d4c8b0;border-radius:6px;background:#fff;padding:8px 10px;">
      <summary style="cursor:pointer;color:#5a3818;font-size:15px;">Выберите свой путь по книге (${routes.length})</summary>
      <div style="margin-top:8px;${routeGridStyle}">`;
  } else {
    html += `<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:14px 0 4px 0;">Выберите свой путь по книге</h2>
      <div style="${routeGridStyle}">`;
  }
  for (const r of routes) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;border-top:3px solid #8a7050;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:4px;">
        <div style="font-size:16px;font-weight:bold;color:#5a3818;">${escapeHtml(r.title)}</div>
        <div style="font-size:20px;line-height:1;min-width:20px;text-align:right;">${safeIcon(r.icon)}</div>
      </div>
      <div style="font-size:11px;color:#444;line-height:1.45;margin-bottom:6px;">${escapeHtml(r.desc)}</div>
      <div style="font-size:11px;color:#888;margin-bottom:6px;">📑 страницы ${escapeHtml(r.pages)}</div>
      <div style="font-size:11px;">`;
    for (const e of r.entities) {
      html += `<a class="route-link" data-type="${escapeHtml(e.type)}" data-head="${escapeHtml(e.head)}" href="${escapeHtml(buildItemHash(e.type, e.head))}" style="display:inline-block;padding:2px 8px;background:#f0e8d8;border-radius:10px;margin:2px 2px 2px 0;cursor:pointer;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(e.head)}</a>`;
    }
    html += '</div></div>';
  }
  html += '</div>';
  if (compactHome) html += '</details>';

  html += '</div></div>';

  container.innerHTML = html;
  const homeGrid = document.getElementById('home-stats-grid');
  if (homeGrid && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth < 900) {
    homeGrid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  }
  const homeFactPair = document.getElementById('home-fact-pair');
  if (homeFactPair) {
    const pairChildren = homeFactPair.children || [];
    const factCol = pairChildren[0] || null;
    const quoteCol = pairChildren[1] || null;
    const factRows = factCol && factCol.children ? Array.from(factCol.children) : [];
    const openTopFamily = () => {
      currentEntity = 'languages';
      currentTab = 'families';
      selectedItem = null;
      selectedItemType = null;
      rightPaneMode = 'histogram';
      renderEntitySwitcher();
      renderTabs();
      renderContent();
      syncNavigationState();
    };
    const factActions = [
      () => {
        const idx = findLectureIndexByName(stats?.longest_lecture?.name);
        openLecturePage(idx >= 0 ? idx : 1);
      },
      () => navigateToItem('languages', stats?.top_lang?.head || ''),
      () => navigateToItem('toponyms', stats?.top_topo?.head || ''),
      () => navigateToItem('names', stats?.top_name?.head || ''),
      () => navigateToItem('lexicon', stats?.top_lex?.head || ''),
      () => navigateToItem('names', stats?.earliest_person?.head || ''),
      () => openTopFamily(),
    ];
    for (let i = 0; i < factRows.length && i < factActions.length; i++) {
      const row = factRows[i];
      row.style.textDecoration = 'underline dotted';
      bindActionWithKeyboard(row, factActions[i]);
    }
    if (quoteCol) {
      quoteCol.style.fontSize = compactHome ? '14px' : '15px';
      quoteCol.style.lineHeight = compactHome ? '1.55' : '1.65';
      const hint = typeof quoteCol.querySelector === 'function' ? quoteCol.querySelector('div') : null;
      if (hint) {
        hint.style.fontStyle = 'italic';
        hint.style.fontSize = '12px';
      }
    }
  }
  if (homeFactPair && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth < 900) {
    homeFactPair.style.gridTemplateColumns = '1fr';
  }

  const readingInput = document.getElementById('reading-page-input');
  const readingGo = document.getElementById('reading-page-go');
  const readingPrev = document.getElementById('reading-page-prev');
  const readingNext = document.getElementById('reading-page-next');
  const readingTrends = document.getElementById('reading-page-trends');
  const readingResults = document.getElementById('reading-now-results');
  const maxPage = Number(stats.total_pages) || 404;
  const clampReadingPage = (page) => {
    const raw = Number.isFinite(page) ? page : parseInt(String(page || ''), 10);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(maxPage, raw));
  };
  const getInputPage = () => clampReadingPage(parseInt(readingInput?.value || '', 10));
  const openReadingTrends = (page) => {
    const p = clampReadingPage(page);
    currentEntity = 'scholar';
    currentTab = 'page_trends';
    trendsRangeStart = p;
    trendsRangeEnd = p;
    selectedItem = null;
    selectedItemType = null;
    rightPaneMode = 'histogram';
    renderEntitySwitcher();
    renderTabs();
    renderContent();
    syncNavigationState();
  };
  const updateReadingPagerControls = (page) => {
    if (readingPrev) {
      const disabled = page <= 1;
      readingPrev.disabled = disabled;
      readingPrev.style.opacity = disabled ? '0.45' : '1';
      readingPrev.style.cursor = disabled ? 'default' : 'pointer';
    }
    if (readingNext) {
      const disabled = page >= maxPage;
      readingNext.disabled = disabled;
      readingNext.style.opacity = disabled ? '0.45' : '1';
      readingNext.style.cursor = disabled ? 'default' : 'pointer';
    }
  };
  const renderReadingNow = (page) => {
    const currentPage = clampReadingPage(page);
    if (!readingResults) return;
    saveReadingPage(currentPage);
    updateReadingPagerControls(currentPage);
    if (readingInput) readingInput.value = String(currentPage);
    const chapters = APP_DATA.chapters || [];
    const chapterIdx = chapters.findIndex(ch => currentPage >= ch.start && currentPage <= ch.end);
    const chapter = chapterIdx >= 0 ? chapters[chapterIdx] : null;
    const groups = collectReadingNow(currentPage, 7);
    let htmlOut = `<div style="margin-bottom:6px;color:#6a5040;"><strong>Страница ${currentPage}</strong>${chapter ? ` · ${escapeHtml(chapter.name)}` : ''}</div>`;
    htmlOut += `<div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;">`;
    htmlOut += `<button class="reading-now-open-trends" data-page="${currentPage}" style="padding:3px 8px;border:1px solid #c4b890;background:#fff8e8;border-radius:10px;cursor:pointer;font-family:inherit;font-size:11px;color:#5a3818;">Динамика этой страницы</button>`;
    if (chapter) {
      htmlOut += `<button class="reading-now-open-lecture" data-idx="${chapterIdx}" style="padding:3px 8px;border:1px solid #c4b890;background:#fff8e8;border-radius:10px;cursor:pointer;font-family:inherit;font-size:11px;color:#5a3818;">Открыть лекцию</button>`;
    }
    htmlOut += `</div>`;
    if (!groups.length) {
      htmlOut += '<div style="color:#888;">На этой странице в базе не найдено размеченных сущностей.</div>';
      readingResults.innerHTML = htmlOut;
    } else {
      for (const g of groups) {
        htmlOut += `<div style="margin-bottom:6px;"><strong>${escapeHtml(g.label)}:</strong> `;
        for (const it of g.items) {
          htmlOut += `<a class="reading-now-link" data-type="${escapeHtml(g.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(g.type, it.head))}" style="display:inline-block;padding:2px 8px;background:#f0e8d8;border-radius:10px;margin:2px 4px 2px 0;cursor:pointer;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(it.head)}</a>`;
        }
        if (g.total > g.items.length) htmlOut += `<span style="color:#888;">и ещё ${g.total - g.items.length}</span>`;
        htmlOut += `</div>`;
      }
      readingResults.innerHTML = htmlOut;
    }
    bindNavigateLinks(readingResults, '.reading-now-link', 'all');
    readingResults.querySelectorAll('.reading-now-open-trends').forEach(btn => {
      btn.onclick = () => openReadingTrends(parseInt(btn.dataset.page || '', 10));
    });
    readingResults.querySelectorAll('.reading-now-open-lecture').forEach(btn => {
      btn.onclick = () => openLecturePage(parseInt(btn.dataset.idx || '0', 10) || 0);
    });
  };
  if (readingInput && readingGo) {
    const savedPage = getSavedReadingPage();
    const defaultPage = Number.isFinite(savedPage) ? clampReadingPage(savedPage) : 1;
    readingInput.value = String(defaultPage);
    renderReadingNow(defaultPage);
    readingGo.onclick = () => {
      renderReadingNow(getInputPage());
    };
    if (readingPrev) {
      readingPrev.onclick = () => renderReadingNow(getInputPage() - 1);
    }
    if (readingNext) {
      readingNext.onclick = () => renderReadingNow(getInputPage() + 1);
    }
    if (readingTrends) {
      readingTrends.onclick = () => openReadingTrends(getInputPage());
    };
    readingInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        renderReadingNow(getInputPage());
      } else if (e.key === 'ArrowLeft') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        renderReadingNow(getInputPage() - 1);
      } else if (e.key === 'ArrowRight') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        renderReadingNow(getInputPage() + 1);
      }
    };
    readingInput.onblur = () => {
      readingInput.value = String(getInputPage());
      updateReadingPagerControls(getInputPage());
    };
  }

  const recentBox = document.getElementById('home-recent-items');
  if (recentBox && recentItems.length) {
    let recentHtml = '';
    for (const r of recentItems) {
      const conf = ENTITY_TYPES[r.type];
      const label = conf ? conf.title : r.type;
      recentHtml += `<a class="home-recent-link" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}" style="display:inline-block;padding:2px 8px;background:#f0e8d8;border-radius:10px;margin:2px 4px 2px 0;cursor:pointer;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(r.head)} <span style="color:#777;">· ${escapeHtml(label)}</span></a>`;
    }
    recentBox.innerHTML = recentHtml;
    bindNavigateLinks(recentBox, '.home-recent-link', 'all');
  }

  // Маршрутные ссылки
  bindNavigateLinks(container, '.route-link', 'all');
  const exportSiteBtn = document.getElementById('export-site-md');
  if (exportSiteBtn) exportSiteBtn.onclick = () => exportWholeSiteMarkdown();
}

function buildTopQuestion(items, entityType, question, hintPrefix, limitOptions = 4, skipModerator = false) {
  const list = (Array.isArray(items) ? items : [])
    .filter(it => it && it.head)
    .filter(it => !skipModerator || !it.is_moderator)
    .map(it => ({ head: it.head, count: (it.page_list || []).length }))
    .filter(it => it.count > 0)
    .sort((a, b) => b.count - a.count || compareHeadsRu(a.head, b.head));
  if (list.length < 2) return null;
  const options = list.slice(0, Math.max(2, limitOptions)).map(it => it.head);
  const top = list[0];
  return {
    id: `dyn_${entityType}_top`,
    question,
    options,
    correct: 0,
    hint: `${hintPrefix}: ${top.head} (${top.count}).`,
    entity: { type: entityType, head: top.head },
  };
}

function buildLectureLengthQuestion() {
  const chapters = Array.isArray(APP_DATA.chapters) ? APP_DATA.chapters : [];
  const lectureRows = chapters
    .map((ch, idx) => {
      const span = Math.max(1, (Number(ch.end) || 0) - (Number(ch.start) || 0) + 1);
      return { idx, name: ch.name || '', span };
    })
    .filter(ch => ch.idx > 0);
  if (lectureRows.length < 2) return null;
  lectureRows.sort((a, b) => b.span - a.span || compareHeadsRu(a.name, b.name));
  const options = lectureRows.slice(0, 4).map(ch => ch.name);
  const top = lectureRows[0];
  return {
    id: 'dyn_lecture_length',
    question: 'Какая лекция в книге самая длинная?',
    options,
    correct: 0,
    hint: `Самая длинная лекция — ${top.name} (${top.span} стр.).`,
    entity: { type: 'lecture', index: top.idx },
  };
}

function buildDynamicTasks() {
  const out = [];
  const topNameTask = buildTopQuestion(
    APP_DATA.names || [],
    'names',
    'Кто чаще всего упоминается в книге среди персональных имён?',
    'Чаще всего упоминается',
    4,
    true
  );
  if (topNameTask) out.push(topNameTask);

  const topLangTask = buildTopQuestion(
    APP_DATA.languages || [],
    'languages',
    'Какой язык упоминается чаще всего?',
    'Чаще всего упоминается',
    4,
    false
  );
  if (topLangTask) out.push(topLangTask);

  const topTopoTask = buildTopQuestion(
    APP_DATA.toponyms || [],
    'toponyms',
    'Какой топоним встречается чаще всего?',
    'Чаще всего встречается',
    4,
    false
  );
  if (topTopoTask) out.push(topTopoTask);

  const lectureLenTask = buildLectureLengthQuestion();
  if (lectureLenTask) out.push(lectureLenTask);
  return out;
}

function renderTasksPanel(container) {
  const baseTasks = Array.isArray(APP_DATA.tasks) ? APP_DATA.tasks : [];
  const dynamicTasks = buildDynamicTasks();
  const tasks = [...baseTasks, ...dynamicTasks];
  const tasksShuffled = shuffleArray(tasks);
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:980px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Проверьте себя</h2>';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">';
  html += `<div style="font-size:12px;color:#888;font-style:italic;">${baseTasks.length} базовых + ${dynamicTasks.length} динамических вопросов. Кликните на ответ, чтобы проверить.</div>`;
  html += '<button id="tasks-regen" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Новая подборка</button>';
  html += '</div>';
  html += '<div id="tasks-container"></div></div></div>';
  container.innerHTML = html;

  const tc = document.getElementById('tasks-container');
  for (let ti = 0; ti < tasksShuffled.length; ti++) {
    const t = tasksShuffled[ti];
    const taskDiv = document.createElement('div');
    taskDiv.style.cssText = 'background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:14px 18px;margin-bottom:12px;';
    taskDiv.innerHTML = `
      <div style="font-size:14px;color:#5a3818;font-weight:bold;margin-bottom:10px;">Вопрос ${ti+1}. ${escapeHtml(t.question)}</div>
      <div class="task-options" id="task-tab-${t.id}-opts"></div>
      <div class="task-result" id="task-tab-${t.id}-res" style="display:none;margin-top:10px;padding:10px 12px;border-radius:4px;font-size:12px;line-height:1.5;"></div>
    `;
    tc.appendChild(taskDiv);
    const optsDiv = document.getElementById(`task-tab-${t.id}-opts`);
    const optionsShuffled = shuffleArray((t.options || []).map((text, idx) => ({ text, idx })));
    for (let oi = 0; oi < optionsShuffled.length; oi++) {
      const opt = optionsShuffled[oi];
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:6px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:13px;color:#444;transition:all 0.1s;';
      btn.dataset.sourceIndex = String(opt.idx);
      btn.textContent = String.fromCharCode(65 + oi) + '. ' + opt.text;
      btn.onclick = () => {
        const isCorrect = opt.idx === t.correct;
        optsDiv.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.cursor = 'default'; });
        if (isCorrect) {
          btn.style.background = '#d4edda';
          btn.style.borderColor = '#5cb85c';
          btn.style.color = '#155724';
          btn.style.fontWeight = 'bold';
        } else {
          btn.style.background = '#f8d7da';
          btn.style.borderColor = '#dc3545';
          btn.style.color = '#721c24';
          const correctBtn = optsDiv.querySelector(`button[data-source-index="${String(t.correct)}"]`);
          if (correctBtn) {
            correctBtn.style.background = '#d4edda';
            correctBtn.style.borderColor = '#5cb85c';
            correctBtn.style.color = '#155724';
            correctBtn.style.fontWeight = 'bold';
          }
        }
        const res = document.getElementById(`task-tab-${t.id}-res`);
        res.style.display = 'block';
        res.style.background = isCorrect ? '#e8f5e9' : '#fff8e8';
        res.style.borderLeft = '3px solid ' + (isCorrect ? '#5cb85c' : '#8a7050');
        const linkHref = t.entity
          ? ((t.entity.type || '') === 'lecture'
            ? buildLecturePageHash(t.entity.index)
            : buildItemHash(t.entity.type || 'all', t.entity.head || ''))
          : '';
        const linkBtn = t.entity
        ? ` <a class="task-card-link" data-type="${escapeHtml(t.entity.type || '')}" data-head="${escapeHtml(t.entity.head || '')}" data-lecture-idx="${escapeHtml(t.entity.index != null ? String(t.entity.index) : '')}" href="${escapeHtml(linkHref)}" style="cursor:pointer;text-decoration:underline dotted;color:#5a3818;font-weight:bold;">Открыть карточку →</a>`
          : '';
        res.innerHTML = (isCorrect ? '<strong>Верно!</strong> ' : '<strong>Не угадали.</strong> ') + escapeHtml(t.hint) + linkBtn;
        res.querySelectorAll('.task-card-link').forEach(el => {
          el.onclick = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            if ((el.dataset.type || '') === 'lecture') {
              openLecturePage(parseInt(el.dataset.lectureIdx || '0', 10) || 0);
              return;
            }
            navigateToItem(el.dataset.type, el.dataset.head);
          };
        });
      };
      optsDiv.appendChild(btn);
    }
  }
  const regenBtn = document.getElementById('tasks-regen');
  if (regenBtn) regenBtn.onclick = () => renderTasksPanel(container);
}

// =========================================================
// ЛЕКЦИИ — карточки-резюме
// =========================================================
function renderLecturesPanel(container) {
  const lectures = APP_DATA.lectures || [];
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1200px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Все лекции книги — за пять минут</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px;">Краткие резюме: 10 лекций + предисловие. Нажмите карточку, чтобы открыть отдельную мини-страницу.</div>';
  html += '<div id="lectures-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">';
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i];
    const title = i === 0 ? 'Предисловие' : `Лекция ${i}`;
    const cardSpan = i === 0 ? 'grid-column:1 / -1;' : '';
    html += `<div class="lecture-card" data-idx="${i}" style="${cardSpan}background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:14px 18px;border-top:3px solid #8a7050;cursor:pointer;">
      <div style="font-size:11px;color:#888;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;">${title} · стр. ${escapeHtml(l.pages)}</div>
      <div style="font-size:17px;font-weight:bold;color:#5a3818;margin:4px 0 8px 0;">${escapeHtml(l.name)}</div>
      <div style="font-size:13px;color:#333;line-height:1.5;margin-bottom:10px;">${escapeHtml(l.main_idea)}</div>
      <div style="font-size:11px;color:#6a5040;font-weight:bold;margin-bottom:4px;">КЛЮЧЕВЫЕ ФАКТЫ</div>
      <ul style="margin:0 0 10px 0;padding-left:18px;font-size:12px;line-height:1.5;color:#444;">`;
    for (const f of l.key_facts) html += `<li>${escapeHtml(f)}</li>`;
    html += `</ul>
      <div style="font-size:11px;color:#6a5040;font-weight:bold;margin-bottom:4px;">ТЕРМИНЫ</div>
      <div style="font-size:11px;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:4px;">`;
    for (const t of l.terms) html += `<a class="lecture-term-chip" data-term="${escapeHtml(t.toLowerCase())}" href="${escapeHtml(buildLectureTermHash(t))}" style="display:inline-block;padding:2px 8px;background:#f0e8d8;border-radius:10px;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(t)}</a>`;
    html += `</div>
      <div style="font-size:12px;color:#5a3818;font-style:italic;border-top:1px solid #f0e8d8;padding-top:8px;">${escapeHtml(l.why_read)}</div>
    </div>`;
  }
  html += '</div></div></div>';
  container.innerHTML = html;
  const lecturesGrid = document.getElementById('lectures-grid');
  if (lecturesGrid && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth < 900) {
    lecturesGrid.style.gridTemplateColumns = '1fr';
  }
  container.querySelectorAll('.lecture-card').forEach(card => {
    card.onclick = () => {
      openLecturePage(parseInt(card.dataset.idx || '0', 10) || 0);
    };
  });
  container.querySelectorAll('.lecture-term-chip').forEach(chip => {
    chip.onclick = (e) => {
      if (e) {
        e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
      }
      openLectureTerm(chip.dataset.term || chip.textContent || '');
    };
  });
}

function renderLectureComparePanel(container) {
  const chapters = APP_DATA.chapters || [];
  if (chapters.length < 2) {
    container.innerHTML = '<div class="panel active"><div style="padding:20px;color:#777;">Недостаточно лекций для сравнения.</div></div>';
    return;
  }

  const clampIdx = (idx) => Math.max(0, Math.min(chapters.length - 1, Number.isInteger(idx) ? idx : 0));
  lectureCompareA = clampIdx(lectureCompareA);
  lectureCompareB = clampIdx(lectureCompareB);
  if (lectureCompareA === lectureCompareB) lectureCompareB = (lectureCompareA + 1) % chapters.length;

  const chapterA = chapters[lectureCompareA];
  const chapterB = chapters[lectureCompareB];
  const types = [
    { key: 'names', label: 'Имена' },
    { key: 'toponyms', label: 'Топонимы' },
    { key: 'ethnonyms', label: 'Этнонимы' },
    { key: 'languages', label: 'Языки' },
    { key: 'lexicon', label: 'Лексика' },
    { key: 'subject', label: 'Предметный' },
  ];

  const headsFor = (type, chapter) => {
    const set = new Set();
    for (const it of getItemsForChapter(type, chapter)) {
      if (it && it.head) set.add(it.head);
    }
    return set;
  };
  const asSorted = (arr) => arr.sort(compareHeadsRu);
  const renderHeadLinks = (type, heads, max = 10) => {
    if (!heads.length) return '<span style="color:#999;font-size:12px;">—</span>';
    let out = '';
    for (const head of heads.slice(0, max)) {
      out += `<a class="lecture-compare-link" data-type="${escapeHtml(type)}" data-head="${escapeHtml(head)}" href="${escapeHtml(buildItemHash(type, head))}" style="display:inline-block;margin:2px 6px 2px 0;padding:2px 7px;border-radius:10px;background:#f0e8d8;color:#5a3818;cursor:pointer;font-size:11px;text-decoration:none;">${escapeHtml(head)}</a>`;
    }
    if (heads.length > max) out += `<span style="color:#888;font-size:11px;">+${heads.length - max}</span>`;
    return out;
  };
  const chapterLabel = (idx, ch) => (idx === 0 ? 'Предисловие' : `Лекция ${idx}`) + ` · ${ch.name}`;

  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1200px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Сравнение двух лекций</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:14px;">Показываем пересечения и уникальные сущности по типам. Нажмите на элемент, чтобы открыть карточку.</div>';
  html += `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px;">
    <label style="display:block;">
      <div style="font-size:11px;color:#6a5040;margin-bottom:4px;">Лекция A</div>
      <select id="lecture-compare-a" style="width:100%;padding:7px 9px;border:1px solid #c4b890;border-radius:4px;font-family:inherit;font-size:12px;background:#fff;">
        ${chapters.map((ch, idx) => `<option value="${idx}" ${idx === lectureCompareA ? 'selected' : ''}>${escapeHtml(chapterLabel(idx, ch))} (стр. ${ch.start}-${ch.end})</option>`).join('')}
      </select>
    </label>
    <label style="display:block;">
      <div style="font-size:11px;color:#6a5040;margin-bottom:4px;">Лекция B</div>
      <select id="lecture-compare-b" style="width:100%;padding:7px 9px;border:1px solid #c4b890;border-radius:4px;font-family:inherit;font-size:12px;background:#fff;">
        ${chapters.map((ch, idx) => `<option value="${idx}" ${idx === lectureCompareB ? 'selected' : ''}>${escapeHtml(chapterLabel(idx, ch))} (стр. ${ch.start}-${ch.end})</option>`).join('')}
      </select>
    </label>
  </div>`;

  html += `<div style="font-size:12px;color:#5a3818;margin-bottom:10px;"><strong>A:</strong> ${escapeHtml(chapterA.name)} <span style="color:#888;">(стр. ${chapterA.start}-${chapterA.end})</span><br><strong>B:</strong> ${escapeHtml(chapterB.name)} <span style="color:#888;">(стр. ${chapterB.start}-${chapterB.end})</span></div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;">';

  for (const t of types) {
    const setA = headsFor(t.key, chapterA);
    const setB = headsFor(t.key, chapterB);
    const inter = asSorted([...setA].filter(h => setB.has(h)));
    const onlyA = asSorted([...setA].filter(h => !setB.has(h)));
    const onlyB = asSorted([...setB].filter(h => !setA.has(h)));
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:8px;padding:12px 14px;border-top:3px solid #8a7050;">
      <div style="font-size:15px;color:#5a3818;font-weight:bold;margin-bottom:6px;">${t.label}</div>
      <div style="font-size:11px;color:#666;margin-bottom:8px;">Общие: <strong>${inter.length}</strong> · Только A: <strong>${onlyA.length}</strong> · Только B: <strong>${onlyB.length}</strong></div>
      <div style="font-size:11px;color:#6a5040;margin-bottom:2px;">Пересечение</div>
      <div style="margin-bottom:7px;">${renderHeadLinks(t.key, inter, 10)}</div>
      <div style="font-size:11px;color:#6a5040;margin-bottom:2px;">Только A</div>
      <div style="margin-bottom:7px;">${renderHeadLinks(t.key, onlyA, 8)}</div>
      <div style="font-size:11px;color:#6a5040;margin-bottom:2px;">Только B</div>
      <div>${renderHeadLinks(t.key, onlyB, 8)}</div>
    </div>`;
  }

  html += '</div></div></div>';
  container.innerHTML = html;

  const selA = document.getElementById('lecture-compare-a');
  const selB = document.getElementById('lecture-compare-b');
  if (selA) {
    selA.onchange = () => {
      lectureCompareA = clampIdx(parseInt(selA.value, 10));
      if (lectureCompareA === lectureCompareB) lectureCompareB = (lectureCompareA + 1) % chapters.length;
      renderLectureComparePanel(container);
      persistViewState();
    };
  }
  if (selB) {
    selB.onchange = () => {
      lectureCompareB = clampIdx(parseInt(selB.value, 10));
      if (lectureCompareA === lectureCompareB) lectureCompareA = (lectureCompareB + 1) % chapters.length;
      renderLectureComparePanel(container);
      persistViewState();
    };
  }
  bindNavigateLinks(container, '.lecture-compare-link[data-head]', 'all');
}

function renderLecturePagePanel(container) {
  const lectures = APP_DATA.lectures || [];
  if (!lectures.length) {
    container.innerHTML = '<div class="panel active"><div style="padding:20px;color:#777;">Нет данных о лекциях.</div></div>';
    return;
  }
  if (currentLecture < 0) currentLecture = 0;
  if (currentLecture >= lectures.length) currentLecture = lectures.length - 1;
  const l = lectures[currentLecture];
  const title = currentLecture === 0 ? 'Предисловие' : `Лекция ${currentLecture}`;

  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:900px;margin:0 auto;">';
  html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
    <button id="lecture-prev" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;">← Предыдущая</button>
    <button id="lecture-all" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;">Ко всем лекциям</button>
    <button id="lecture-next" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;">Следующая →</button>
  </div>`;
  html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:8px;padding:18px 20px;border-top:4px solid #8a7050;">
    <div style="font-size:12px;color:#888;font-weight:bold;letter-spacing:0.4px;text-transform:uppercase;">${title} · стр. ${escapeHtml(l.pages || '')}</div>
    <h2 style="font-size:24px;color:#5a3818;margin:6px 0 10px 0;font-weight:normal;">${escapeHtml(l.name || '')}</h2>
    <div style="font-size:14px;line-height:1.6;color:#333;margin-bottom:12px;">${escapeHtml(l.main_idea || '')}</div>
    <h3 style="font-size:12px;color:#6a5040;margin:14px 0 6px;">Ключевые факты</h3>
    <ul style="margin:0 0 10px 0;padding-left:18px;font-size:13px;line-height:1.6;color:#333;">`;
  for (const fact of (l.key_facts || [])) html += `<li>${escapeHtml(fact)}</li>`;
  html += `</ul>
    <h3 style="font-size:12px;color:#6a5040;margin:14px 0 6px;">Термины</h3>
    <div style="font-size:12px;line-height:1.7;display:flex;flex-wrap:wrap;gap:4px;">`;
  for (const t of (l.terms || [])) html += `<a class="lecture-term-chip" data-term="${escapeHtml(t.toLowerCase())}" href="${escapeHtml(buildLectureTermHash(t))}" style="display:inline-block;padding:2px 8px;background:#f0e8d8;border-radius:10px;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(t)}</a>`;
  html += `</div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #efe3cb;font-size:13px;color:#5a3818;font-style:italic;">${escapeHtml(l.why_read || '')}</div>
  </div>`;
  if (currentLecture === 0 && Array.isArray(APP_DATA.further_reading) && APP_DATA.further_reading.length) {
    html += `<div style="margin-top:14px;background:#fff;border:1px solid #d4c8b0;border-radius:8px;padding:14px 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <h3 style="margin:0;font-size:16px;color:#5a3818;font-weight:normal;">Что почитать ещё</h3>
        <button id="go-further-reading" style="padding:5px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;color:#5a3818;">Открыть весь раздел</button>
      </div>`;
    for (const sec of APP_DATA.further_reading) {
      html += `<div style="margin-bottom:10px;">
        <div style="font-size:13px;font-weight:bold;color:#5a3818;margin-bottom:4px;">${escapeHtml(sec.topic || '')}</div>`;
      for (const b of (sec.books || [])) {
        html += `<div style="font-size:12px;color:#444;line-height:1.45;margin-bottom:3px;">• <strong>${escapeHtml(b.title || '')}</strong>: ${escapeHtml(b.why || '')}</div>`;
      }
      html += '</div>';
    }
    html += `</div>`;
  }
  html += `</div></div></div>`;
  container.innerHTML = html;

  const prev = document.getElementById('lecture-prev');
  const next = document.getElementById('lecture-next');
  const all = document.getElementById('lecture-all');
  prev.disabled = currentLecture <= 0;
  next.disabled = currentLecture >= lectures.length - 1;
  prev.style.opacity = prev.disabled ? '0.5' : '1';
  next.style.opacity = next.disabled ? '0.5' : '1';
  prev.onclick = () => {
    if (currentLecture > 0) {
      openLecturePage(currentLecture - 1);
    }
  };
  next.onclick = () => {
    if (currentLecture < lectures.length - 1) {
      openLecturePage(currentLecture + 1);
    }
  };
  all.onclick = () => switchTab('lectures');
  const openFurther = document.getElementById('go-further-reading');
  if (openFurther) openFurther.onclick = () => switchTab('further_reading');
  container.querySelectorAll('.lecture-term-chip').forEach(chip => {
    chip.onclick = (e) => {
      if (e) {
        e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
      }
      openLectureTerm(chip.dataset.term || chip.textContent || '');
    };
  });
}

function renderFurtherReadingPanel(container) {
  const sections = APP_DATA.further_reading || [];
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1000px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Что почитать ещё</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px;">Небольшой школьный навигатор по научно-популярным и базовым лингвистическим книгам.</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">';
  for (const sec of sections) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:14px 16px;border-top:3px solid #8a7050;">
      <div style="font-size:15px;color:#5a3818;font-weight:bold;margin-bottom:8px;">${escapeHtml(sec.topic || '')}</div>`;
    for (const b of (sec.books || [])) {
      html += `<div style="margin-bottom:10px;">
        <div style="font-size:13px;color:#333;font-weight:bold;">${escapeHtml(b.title || '')}</div>
        <div style="font-size:12px;color:#666;line-height:1.5;">${escapeHtml(b.why || '')}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div></div></div>';
  container.innerHTML = html;
}

const GLOSSARY_TOKEN_STOPWORDS = new Set([
  'это', 'этот', 'эта', 'эти', 'такой', 'также', 'который', 'которые', 'когда',
  'где', 'что', 'как', 'для', 'или', 'при', 'под', 'над', 'без', 'между',
  'среди', 'так', 'ещё', 'уже', 'его', 'её', 'их', 'они', 'она', 'оно',
  'из', 'по', 'на', 'в', 'к', 'о', 'об', 'от', 'до',
]);

function tokenizeNormalizedForGlossary(value, minLen = 3) {
  const norm = normalizeHeadForMatch(value);
  if (!norm) return [];
  const out = [];
  for (const token of norm.split(/\s+/)) {
    const t = String(token || '').trim();
    if (!t || t.length < minLen) continue;
    if (GLOSSARY_TOKEN_STOPWORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function findRelatedLexiconItems(term, definition = '', limit = 4) {
  const needle = normalizeHeadForMatch(term);
  if (!needle) return [];
  const termTokens = tokenizeNormalizedForGlossary(term, 3);
  const defTokens = new Set(tokenizeNormalizedForGlossary(definition, 4));
  const rows = [];
  const sources = [
    { type: 'lexicon', items: APP_DATA.lexicon || [], typePriority: 0 },
    { type: 'lexicon_reverse', items: APP_DATA.lexicon_reverse || [], typePriority: 1 },
    { type: 'lexicon_tech', items: APP_DATA.lexicon_tech || [], typePriority: 2 },
  ];
  const kindPriority = { exact: 0, prefix: 1, term_token: 2, definition_token: 3 };

  for (const src of sources) {
    for (const it of src.items) {
      const head = String(it.head || '').trim();
      const headNorm = normalizeHeadForMatch(head);
      if (!headNorm) continue;
      const headTokens = tokenizeNormalizedForGlossary(head, 3);

      let score = 99;
      let matchKind = '';
      let signal = '';
      const assign = (nextScore, kind, nextSignal) => {
        if (nextScore < score) {
          score = nextScore;
          matchKind = kind;
          signal = nextSignal || '';
        }
      };

      if (headNorm === needle) {
        assign(0, 'exact', head);
      } else if (headNorm.startsWith(needle) || needle.startsWith(headNorm)) {
        assign(1, 'prefix', head);
      } else {
        const tokenHit = termTokens.find(t => headNorm.includes(t));
        if (tokenHit) assign(2, 'term_token', tokenHit);
        const defHit = headTokens.find(t => defTokens.has(t));
        if (defHit) assign(3, 'definition_token', defHit);
      }

      if (score < 99) {
        rows.push({
          type: src.type,
          typePriority: src.typePriority,
          head,
          headNorm,
          score,
          matchKind,
          signal,
          weight: (it.page_list || []).length,
          hint: (
            matchKind === 'exact' ? 'точное совпадение' :
            matchKind === 'prefix' ? 'совпадение по началу термина' :
            matchKind === 'term_token' ? `совпадение по токену: ${signal}` :
            `совпадение по определению: ${signal}`
          ),
        });
      }
    }
  }

  rows.sort((a, b) =>
    (a.score - b.score) ||
    ((kindPriority[a.matchKind] || 9) - (kindPriority[b.matchKind] || 9)) ||
    (b.weight - a.weight) ||
    (a.typePriority - b.typePriority) ||
    compareHeadsRu(a.head, b.head)
  );

  const unique = [];
  const seen = new Set();
  for (const r of rows) {
    const key = r.headNorm;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
    if (unique.length >= limit) break;
  }
  return unique;
}

// =========================================================
// ГЛОССАРИЙ
// =========================================================
function findRelatedGlossaryTerms(head, limit = 5) {
  const needle = normalizeHeadForMatch(head);
  if (!needle) return [];
  const glossary = Array.isArray(APP_DATA?.glossary) ? APP_DATA.glossary : [];
  const needleTokens = needle.split(/\s+/).filter(t => t.length >= 3);
  const rows = [];

  for (const g of glossary) {
    const term = String(g.term || '').trim();
    if (!term) continue;
    const termNorm = normalizeHeadForMatch(term);
    const defNorm = normalizeHeadForMatch(g.definition || '');
    let score = 99;
    if (termNorm === needle) score = 0;
    else if (termNorm && (termNorm.startsWith(needle) || needle.startsWith(termNorm))) score = 1;
    else if (needleTokens.some(t => termNorm.includes(t))) score = 2;
    else if (needleTokens.some(t => defNorm.includes(t)) || (defNorm && defNorm.includes(needle))) score = 3;
    if (score < 99) rows.push({ term, definition: String(g.definition || ''), score });
  }

  rows.sort((a, b) => (a.score - b.score) || compareHeadsRu(a.term, b.term));
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const key = normalizeHeadForMatch(row.term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function renderGlossaryPanel(container) {
  const glossary = APP_DATA.glossary || [];
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1100px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Глоссарий простыми словами</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Лингвистические термины из книги, объяснённые так, чтобы понял школьник. У каждого термина — отдельная внешняя ссылка.</div>';
  // Простое поле поиска
  html += '<input type="text" id="glossary-search" placeholder="Поиск термина…" style="width:100%;padding:8px 12px;font-family:inherit;font-size:14px;border:1px solid #c4b890;border-radius:3px;background:white;margin-bottom:14px;" />';
  html += '<div id="glossary-list" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">';
  for (const g of glossary) {
    const termUrl = g.url || ('https://samskrtam.ru/sanskrit-lexicon/les-1990/?s=' + encodeURIComponent(String(g.term || '')));
    const related = findRelatedLexiconItems(g.term, g.definition || '', 4);
    let relatedHtml = '';
    if (related.length) {
      relatedHtml += '<div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">';
      relatedHtml += '<span style="font-size:10px;color:#7a6350;">Связанные лексемы:</span>';
      for (const r of related) {
        relatedHtml += `<a class="glossary-xlink" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}" title="${escapeHtml(r.hint || '')}" style="display:inline-block;padding:2px 7px;border:1px solid #cdbb9a;border-radius:10px;background:#fff8e8;color:#5a3818;font-size:10px;cursor:pointer;text-decoration:underline dotted;">${escapeHtml(r.head)}</a>`;
      }
      relatedHtml += '</div>';
    }
    html += `<div class="glossary-entry" data-term="${escapeHtml(g.term.toLowerCase())}" style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #8a7050;">
      <div style="font-size:14px;font-weight:bold;color:#5a3818;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span>${escapeHtml(g.term)}</span>
        <a class="glossary-les-link" href="${escapeHtml(safeUrl(termUrl))}" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:normal;color:#5a3818;text-decoration:underline dotted;white-space:nowrap;">LES-1990 ↗</a>
      </div>
      <div style="font-size:13px;color:#444;line-height:1.6;">${escapeHtml(g.definition)}</div>
      ${relatedHtml}
    </div>`;
  }
  html += '</div></div></div>';
  container.innerHTML = html;
  const glist = document.getElementById('glossary-list');
  if (glist && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth < 900) {
    glist.style.gridTemplateColumns = '1fr';
  }
  
  const applyGlossaryFilter = (value) => {
    const q = (value || '').trim().toLowerCase();
    container.querySelectorAll('.glossary-entry').forEach(el => {
      const t = el.dataset.term;
      el.style.display = (!q || t.includes(q)) ? 'block' : 'none';
    });
  };
  const input = document.getElementById('glossary-search');
  input.oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    currentGlossaryTerm = q;
    applyGlossaryFilter(q);
  };
  input.onchange = () => {
    syncNavigationState();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      syncNavigationState();
    }
  };
  if (pendingGlossaryQuery) {
    input.value = pendingGlossaryQuery;
    currentGlossaryTerm = pendingGlossaryQuery;
    applyGlossaryFilter(pendingGlossaryQuery);
    pendingGlossaryQuery = '';
  } else {
    currentGlossaryTerm = String(input.value || '').trim().toLowerCase();
  }
  bindNavigateLinks(container, '.glossary-xlink', 'lexicon');
}

// =========================================================
// ГАЛЕРЕЯ ЛИНГВИСТОВ
// =========================================================
function renderGalleryPanel(container) {
  const names = APP_DATA.names.filter(n => n.img);
  // Сортировка: сначала по эпохе (если есть), потом по фамилии
  names.sort((a, b) => {
    if (a.epoch && b.epoch) return a.epoch - b.epoch;
    if (a.epoch) return -1;
    if (b.epoch) return 1;
    return compareHeadsRu(a.head, b.head);
  });
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1200px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Галерея лингвистов</h2>';
  html += `<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px;">${names.length} лингвистов и литераторов, упомянутых в книге, с фотографиями. Расположены примерно в хронологическом порядке. Кликните по портрету, чтобы открыть карточку.</div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">';
  for (const n of names) {
    const epochLabel = n.epoch ? (n.epoch < 0 ? Math.abs(n.epoch) + ' до н.э.' : n.epoch + ' г.') : '';
    html += `<a class="gallery-card" data-head="${escapeHtml(n.head)}" href="${escapeHtml(buildItemHash('names', n.head))}" style="display:block;background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:8px;cursor:pointer;text-align:center;transition:all 0.15s;color:inherit;text-decoration:none;">
      <img src="${escapeHtml(safeImageUrl(n.img))}" alt="" style="width:100%;height:130px;object-fit:cover;border-radius:3px;background:#f7f0e0;">
      <div style="font-size:12px;font-weight:bold;color:#5a3818;margin-top:6px;line-height:1.3;">${escapeHtml(n.head)}</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${epochLabel}</div>
    </a>`;
  }
  html += '</div></div></div>';
  container.innerHTML = html;
  wireSafeImageFallback(container);
  container.querySelectorAll('.gallery-card').forEach(card => {
    card.onmouseover = () => { card.style.borderColor = '#8a7050'; card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; };
    card.onmouseout = () => { card.style.borderColor = '#d4c8b0'; card.style.boxShadow = 'none'; };
    card.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      navigateToItem('names', card.dataset.head);
    };
  });
}

// =========================================================
// РУССКИЙ ЯЗЫК ВО ВРЕМЕНИ
// =========================================================
function renderRussianEvolutionPanel(container) {
  const samples = APP_DATA.russian_evolution || [];
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1000px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Русский язык во времени</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:20px;">Семь срезов истории русского языка, от XI до XXI века. Видно, как менялся алфавит, лексика и грамматика.</div>';
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const isLast = i === samples.length - 1;
    html += `<div style="display:grid;grid-template-columns:120px 1fr;gap:18px;margin-bottom:${isLast?'0':'24px'};position:relative;">
      <div style="text-align:right;border-right:3px solid #8a7050;padding-right:14px;padding-top:6px;">
        <div style="font-size:18px;font-weight:bold;color:#5a3818;">${escapeHtml(s.epoch)}</div>
        <div style="font-size:11px;color:#888;">≈ ${s.year} г.</div>
      </div>
      <div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:14px 18px;">
        <div style="font-size:15px;font-style:italic;color:#5a3818;line-height:1.6;margin-bottom:8px;">«${escapeHtml(s.sample)}»</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">${escapeHtml(s.translation)}</div>
        <div style="font-size:11px;color:#888;border-top:1px solid #f0e8d8;padding-top:6px;">${escapeHtml(s.note)} · стр. ${s.page}</div>
      </div>
    </div>`;
  }
  html += '</div></div>';
  container.innerHTML = html;
}

// =========================================================
// ФОНЕТИЧЕСКИЕ ЗАКОНЫ
// =========================================================
function renderPhoneticLawsPanel(container) {
  const laws = APP_DATA.phonetic_laws || [];
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1100px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Фонетические законы из лекций Зализняка</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px;">Восемь ключевых фонетических законов, обсуждаемых в книге, с примерами из текста. Для каждого закона показан переход «было → стало» и пояснение.</div>';
  for (const law of laws) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:14px 20px;margin-bottom:14px;border-top:3px solid #8a7050;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
        <div style="font-size:17px;font-weight:bold;color:#5a3818;">${escapeHtml(law.name)}</div>
        <div style="font-size:11px;color:#888;">${escapeHtml(law.discoverer)} · ${escapeHtml(law.year)} · стр. ${escapeHtml(law.page)}</div>
      </div>
      <div style="font-size:13px;color:#444;line-height:1.55;margin:8px 0 12px 0;">${escapeHtml(law.description)}</div>
      <div style="background:#fbf6e8;padding:10px 14px;border-radius:4px;border-left:3px solid #8a7050;">
        <div style="font-size:11px;color:#6a5040;font-weight:bold;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Примеры</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <thead><tr style="font-size:11px;color:#888;text-align:left;">
            <th style="padding:4px 8px 4px 0;width:40%;">было</th>
            <th style="padding:4px 8px;width:40%;">стало</th>
            <th style="padding:4px 0 4px 8px;">комментарий</th>
          </tr></thead>
          <tbody>`;
    for (const ex of law.examples) {
      html += `<tr style="border-top:1px solid #f0e8d8;">
        <td style="padding:6px 8px 6px 0;font-style:italic;color:#5a3818;">${escapeHtml(ex.from)}</td>
        <td style="padding:6px 8px;color:#1a1a1a;"><strong>→</strong> ${escapeHtml(ex.to)}</td>
        <td style="padding:6px 0 6px 8px;color:#666;font-size:12px;">${escapeHtml(ex.comment)}</td>
      </tr>`;
    }
    html += '</tbody></table></div></div>';
  }
  html += '</div></div>';
  container.innerHTML = html;
}

// =========================================================
// ПРОФЕССИОНАЛЬНЫЙ АППАРАТ — для взрослого читателя и лингвиста
// =========================================================
function countMentionsInRange(pageList, start, end) {
  if (!Array.isArray(pageList) || start > end) return 0;
  let count = 0;
  for (const p of pageList) {
    if (typeof p === 'number' && p >= start && p <= end) count++;
  }
  return count;
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
  const pickExistingHead = (type, heads) => {
    for (const h of (heads || [])) {
      const resolved = resolveExistingHead(type, h);
      if (getIndexedItem(type, resolved)) return resolved;
    }
    return '';
  };
  const classifyEvent = (ev) => {
    const text = String(ev && ev.event ? ev.event : '').toLowerCase();
    if (text.includes('расшифров')) return 'decipherment';
    if (text.includes('закон') || text.includes('теор')) return 'law';
    if (text.includes('публику') || text.includes('изда')) return 'publication';
    if (text.includes('найден') || text.includes('обнаруж')) return 'discovery';
    return 'milestone';
  };
  const romanToInt = (roman) => {
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
  };
  const parseYearSpan = (value) => {
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
    const decade = raw.match(/(\d{3,4})\s*-\s*е/);
    if (decade) {
      const left = parseInt(decade[1], 10);
      return { from: left, to: left + 9, label: raw };
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
    const firstInt = raw.match(/-?\d{3,4}/);
    if (firstInt) {
      const y = parseInt(firstInt[0], 10);
      return { from: y, to: y, label: raw };
    }
    return { from: 0, to: 0, label: raw };
  };
  const resolveTarget = (ev) => {
    const text = String(ev && ev.event ? ev.event : '');
    const lower = text.toLowerCase();
    for (const row of chronologyMap) {
      if (!lower.includes(row.needle)) continue;
      const head = pickExistingHead(row.type, row.heads);
      if (head) return { mode: 'item', type: row.type, head, href: buildItemHash(row.type, head) };
    }
    const firstToken = text.split(/[,\s]+/).filter(Boolean)[0] || '';
    const query = firstToken.length >= 3 ? firstToken : text.slice(0, 40);
    return { mode: 'search', query, href: buildListSearchHash('all', query) };
  };

  const events = rawEvents.map((ev, idx) => {
    const span = parseYearSpan(ev.year);
    const target = resolveTarget(ev);
    const type = classifyEvent(ev);
    return {
      ...ev,
      _idx: idx,
      _from: span.from,
      _to: span.to,
      _yearLabel: span.label,
      _type: type,
      _target: target,
    };
  }).sort((a, b) => a._from - b._from || a._to - b._to || a._idx - b._idx);

  const minYear = events.length ? Math.min(...events.map(e => e._from)) : 0;
  const maxYear = events.length ? Math.max(...events.map(e => e._to)) : 0;
  const state = { type: 'all', start: minYear, end: maxYear };

  container.innerHTML = `<div class="panel active" style="overflow-y:auto;height:100%;">
    <div style="padding:16px 22px;max-width:1200px;margin:0 auto;">
      <h2 style="font-size:22px;color:#5a3818;font-weight:normal;margin:0 0 6px 0;">Хронология лингвистических открытий</h2>
      <div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Отдельный интерактивный таб: фильтры по типам событий, диапазон лет (включая диапазоны/века), переходы к карточкам и экспорт в Markdown.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:8px 10px;margin-bottom:10px;">
        <label style="font-size:11px;color:#6a5040;">Тип события
          <select id="chronology-type" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
            ${Object.keys(typeLabels).map(k => `<option value="${escapeHtml(k)}">${escapeHtml(typeLabels[k])}</option>`).join('')}
          </select>
        </label>
        <label style="font-size:11px;color:#6a5040;">Zoom
          <select id="chronology-zoom" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
            <option value="all">Весь диапазон</option>
            <option value="xix">XIX век</option>
            <option value="xx">XX век</option>
            <option value="xxi">XXI век</option>
            <option value="custom">Пользовательский</option>
          </select>
        </label>
        <label style="font-size:11px;color:#6a5040;">От
          <input id="chronology-start" type="number" value="${escapeHtml(String(minYear))}" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;max-width:120px;">
        </label>
        <label style="font-size:11px;color:#6a5040;">До
          <input id="chronology-end" type="number" value="${escapeHtml(String(maxYear))}" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;max-width:120px;">
        </label>
        <button id="chronology-export-md" type="button" class="related-link related-link-btn">Экспорт диапазона в Markdown</button>
      </div>
      <div id="chronology-stats" style="font-size:12px;color:#6a5040;margin-bottom:8px;"></div>
      <div id="chronology-list" style="display:grid;gap:8px;"></div>
    </div>
  </div>`;

  const typeSelect = container.querySelector('#chronology-type');
  const zoomSelect = container.querySelector('#chronology-zoom');
  const startInput = container.querySelector('#chronology-start');
  const endInput = container.querySelector('#chronology-end');
  const exportBtn = container.querySelector('#chronology-export-md');
  const statsEl = container.querySelector('#chronology-stats');
  const listEl = container.querySelector('#chronology-list');
  let lastFiltered = events.slice();

  const applyZoomPreset = (zoom) => {
    if (zoom === 'xix') { state.start = 1800; state.end = 1899; return; }
    if (zoom === 'xx') { state.start = 1900; state.end = 1999; return; }
    if (zoom === 'xxi') { state.start = 2000; state.end = Math.max(2000, maxYear); return; }
    if (zoom === 'all') { state.start = minYear; state.end = maxYear; return; }
  };
  const syncRangeInputs = () => {
    if (startInput) startInput.value = String(state.start);
    if (endInput) endInput.value = String(state.end);
  };
  const filterEvents = () => {
    const start = Math.min(state.start, state.end);
    const end = Math.max(state.start, state.end);
    return events.filter((ev) => {
      const byType = state.type === 'all' || ev._type === state.type;
      const byRange = ev._to >= start && ev._from <= end;
      return byType && byRange;
    });
  };
  const buildMarkdown = (rows) => {
    const start = Math.min(state.start, state.end);
    const end = Math.max(state.start, state.end);
    const lines = [
      '# Хронология лингвистических открытий',
      '',
      `Диапазон: ${start}—${end}`,
      `Фильтр по типу: ${typeLabels[state.type] || typeLabels.all}`,
      '',
    ];
    for (const ev of rows) {
      const page = ev.page ? ` (стр. ${ev.page})` : '';
      lines.push(`- [${ev._yearLabel}] ${ev.event}${page}`);
    }
    return lines.join('\n');
  };
  const renderRows = () => {
    const rows = filterEvents();
    lastFiltered = rows;
    const start = Math.min(state.start, state.end);
    const end = Math.max(state.start, state.end);
    if (statsEl) statsEl.textContent = `Показано: ${rows.length} из ${events.length} · диапазон ${start}—${end} · тип: ${typeLabels[state.type] || typeLabels.all}`;
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = '<div style="padding:10px 12px;background:#fff;border:1px solid #d4c8b0;border-radius:4px;color:#888;font-style:italic;">Нет событий в текущем фильтре.</div>';
      return;
    }
    listEl.innerHTML = rows.map((ev) => {
      const target = ev._target || {};
      const page = ev.page ? `<span style="font-size:11px;color:#888;">стр. ${escapeHtml(String(ev.page))}</span>` : '';
      return `<a class="chronology-event-link" href="${escapeHtml(target.href || '#scholar/chronology')}" data-mode="${escapeHtml(target.mode || '')}" data-type="${escapeHtml(target.type || '')}" data-head="${escapeHtml(target.head || '')}" data-query="${escapeHtml(target.query || '')}" style="display:grid;grid-template-columns:120px 1fr;gap:12px;background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:8px 10px;color:inherit;text-decoration:none;">
        <div style="font-weight:bold;color:#5a3818;border-right:2px solid #8a7050;padding-right:10px;text-align:right;">${escapeHtml(String(ev._yearLabel || '—'))}</div>
        <div>
          <div style="font-size:13px;color:#333;line-height:1.45;">${escapeHtml(String(ev.event || ''))}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:#6a5040;">
            <span>${escapeHtml(typeLabels[ev._type] || ev._type || '')}</span>
            ${page}
          </div>
        </div>
      </a>`;
    }).join('');
    bindActionWithKeyboardList(listEl);
  };
  const bindActionWithKeyboardList = (root) => {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('.chronology-event-link').forEach((el) => {
      bindActionWithKeyboard(el, () => {
        const mode = String(el.dataset.mode || '');
        if (mode === 'item') {
          const type = String(el.dataset.type || '');
          const head = String(el.dataset.head || '');
          if (type && head) navigateToItem(type, head);
          return;
        }
        const query = String(el.dataset.query || '');
        if (!query) return;
        currentEntity = 'all';
        currentTab = 'list';
        searchQuery = query;
        selectedItem = null;
        selectedItemType = null;
        rightPaneMode = 'histogram';
        renderEntitySwitcher();
        renderTabs();
        renderContent();
        syncNavigationState();
      });
    });
  };

  if (typeSelect) {
    typeSelect.value = state.type;
    typeSelect.onchange = (e) => {
      const next = e && e.target && typeof e.target.value === 'string' ? e.target.value : 'all';
      state.type = typeLabels[next] ? next : 'all';
      renderRows();
    };
  }
  if (zoomSelect) {
    zoomSelect.value = 'all';
    zoomSelect.onchange = (e) => {
      const next = e && e.target && typeof e.target.value === 'string' ? e.target.value : 'all';
      if (next !== 'custom') {
        applyZoomPreset(next);
        syncRangeInputs();
      }
      renderRows();
    };
  }
  if (startInput) {
    startInput.onchange = () => {
      const raw = parseInt(startInput.value || '', 10);
      if (Number.isFinite(raw)) state.start = raw;
      if (zoomSelect) zoomSelect.value = 'custom';
      renderRows();
    };
  }
  if (endInput) {
    endInput.onchange = () => {
      const raw = parseInt(endInput.value || '', 10);
      if (Number.isFinite(raw)) state.end = raw;
      if (zoomSelect) zoomSelect.value = 'custom';
      renderRows();
    };
  }
  if (exportBtn) {
    exportBtn.onclick = () => {
      const start = Math.min(state.start, state.end);
      const end = Math.max(state.start, state.end);
      const md = buildMarkdown(lastFiltered);
      downloadTextFile(`chronology-${start}-${end}.md`, md, 'text/markdown;charset=utf-8');
    };
  }
  renderRows();
}

function renderPageTrendsPanel(container) {
  const totalPages = Math.max(1, parseInt(APP_DATA?.book_stats?.total_pages || 404, 10) || 404);
  const clamp = (v) => Math.max(1, Math.min(totalPages, Number.isInteger(v) ? v : parseInt(v || '1', 10) || 1));
  trendsRangeStart = clamp(trendsRangeStart);
  trendsRangeEnd = clamp(trendsRangeEnd);
  if (trendsRangeStart > trendsRangeEnd) [trendsRangeStart, trendsRangeEnd] = [trendsRangeEnd, trendsRangeStart];
  const start = trendsRangeStart;
  const end = trendsRangeEnd;
  const mid = Math.floor((start + end) / 2);

  const chapters = APP_DATA.chapters || [];
  const types = [
    { key: 'names', label: 'Имена' },
    { key: 'toponyms', label: 'Топонимы' },
    { key: 'ethnonyms', label: 'Этнонимы' },
    { key: 'languages', label: 'Языки' },
    { key: 'lexicon', label: 'Лексика' },
    { key: 'subject', label: 'Предметный' },
  ];

  const stats = [];
  const globalTrend = [];
  for (const t of types) {
    const items = (ENTITY_TYPES[t.key] && ENTITY_TYPES[t.key].items) || [];
    let mentionTotal = 0;
    const activeItems = [];
    for (const it of items) {
      const totalCount = countMentionsInRange(it.page_list || [], start, end);
      if (totalCount > 0) {
        activeItems.push({ head: it.head, count: totalCount, type: t.key });
        mentionTotal += totalCount;
      }
      if (end > start) {
        const leftCount = countMentionsInRange(it.page_list || [], start, mid);
        const rightCount = countMentionsInRange(it.page_list || [], mid + 1, end);
        const delta = rightCount - leftCount;
        if (delta !== 0 && leftCount + rightCount >= 2) {
          globalTrend.push({ head: it.head, type: t.key, delta, leftCount, rightCount });
        }
      }
    }
    activeItems.sort((a, b) => (b.count - a.count) || compareHeadsRu(a.head, b.head));
    stats.push({ ...t, mentionTotal, activeCount: activeItems.length, top: activeItems.slice(0, 8) });
  }

  const trendUp = globalTrend.filter(x => x.delta > 0).sort((a, b) => (b.delta - a.delta) || compareHeadsRu(a.head, b.head)).slice(0, 14);
  const trendDown = globalTrend.filter(x => x.delta < 0).sort((a, b) => (a.delta - b.delta) || compareHeadsRu(a.head, b.head)).slice(0, 14);

  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1200px;margin:0 auto;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">';
  html += '<div><h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Динамика по страницам</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:12px;">Выберите окно страниц и смотрите, как меняется плотность упоминаний и какие сущности усиливаются/ослабевают во второй половине диапазона.</div></div>';
  html += '<div style="display:flex;gap:6px;align-items:center;">';
  html += '<button id="trend-export-csv" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;color:#5a3818;">Экспорт CSV</button>';
  html += '<button id="trend-export-md" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;color:#5a3818;">Экспорт Markdown</button>';
  html += '</div></div>';

  const chapterOptions = chapters.map((ch, idx) => `<option value="${idx}">${escapeHtml(ch.name)} (${ch.start}-${ch.end})</option>`).join('');
  html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:12px 14px;margin-bottom:12px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end;">
      <label style="font-size:11px;color:#6a5040;">
        Начальная страница
        <input id="trend-start-range" type="range" min="1" max="${totalPages}" value="${start}" style="width:100%;margin-top:4px;">
        <input id="trend-start-input" type="number" min="1" max="${totalPages}" value="${start}" style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid #c4b890;border-radius:4px;font-family:inherit;">
      </label>
      <label style="font-size:11px;color:#6a5040;">
        Конечная страница
        <input id="trend-end-range" type="range" min="1" max="${totalPages}" value="${end}" style="width:100%;margin-top:4px;">
        <input id="trend-end-input" type="number" min="1" max="${totalPages}" value="${end}" style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid #c4b890;border-radius:4px;font-family:inherit;">
      </label>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px;">
      <label style="font-size:11px;color:#6a5040;">Быстрый выбор главы:
        <select id="trend-chapter-select" style="margin-left:6px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
          <option value="">—</option>${chapterOptions}
        </select>
      </label>
      <span style="font-size:11px;color:#888;">Диапазон: ${start}-${end} · ширина ${end - start + 1} стр.</span>
    </div>
  </div>`;

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-bottom:12px;">';
  for (const s of stats) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;">
      <div style="font-size:14px;color:#5a3818;font-weight:bold;margin-bottom:2px;">${s.label}</div>
      <div style="font-size:11px;color:#666;margin-bottom:7px;">Сущностей: <strong>${s.activeCount}</strong> · упоминаний: <strong>${s.mentionTotal}</strong></div>
      <div style="font-size:11px;color:#6a5040;margin-bottom:4px;">Топ в выбранном окне</div>
      <div>${s.top.length ? s.top.map(it => `<a class="trend-link" data-type="${escapeHtml(it.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(it.type, it.head))}" style="display:inline-block;padding:2px 7px;margin:2px 6px 2px 0;background:#f0e8d8;border-radius:10px;color:#5a3818;cursor:pointer;font-size:11px;text-decoration:none;">${escapeHtml(it.head)} · ${it.count}</a>`).join('') : '<span style="color:#999;font-size:12px;">—</span>'}</div>
    </div>`;
  }
  html += '</div>';

  const trendLinks = (rows, color) => rows.length
    ? rows.map(r => `<a class="trend-link" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}" style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;cursor:pointer;color:inherit;text-decoration:none;">
        <span style="color:#5a3818;text-decoration:underline dotted;">${escapeHtml(r.head)}</span>
        <span style="color:${color};font-size:11px;">${r.delta > 0 ? '+' : ''}${r.delta} (${r.leftCount}→${r.rightCount})</span>
      </a>`).join('')
    : '<div style="color:#999;font-size:12px;">—</div>';

  html += `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
    <div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;">
      <div style="font-size:13px;color:#5a3818;font-weight:bold;margin-bottom:6px;">Растут во второй половине диапазона</div>
      ${trendLinks(trendUp, '#1f7a3e')}
    </div>
    <div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;">
      <div style="font-size:13px;color:#5a3818;font-weight:bold;margin-bottom:6px;">Слабеют во второй половине диапазона</div>
      ${trendLinks(trendDown, '#8b3a2a')}
    </div>
  </div>`;

  html += '</div></div>';
  container.innerHTML = html;

  const rerender = () => {
    renderPageTrendsPanel(container);
    persistViewState();
  };
  const startRange = document.getElementById('trend-start-range');
  const endRange = document.getElementById('trend-end-range');
  const startInput = document.getElementById('trend-start-input');
  const endInput = document.getElementById('trend-end-input');
  const chapterSelect = document.getElementById('trend-chapter-select');
  const exportCsvBtn = document.getElementById('trend-export-csv');
  const exportMdBtn = document.getElementById('trend-export-md');

  const csvEscape = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows = [['range_start', 'range_end', 'section', 'type', 'head', 'value', 'delta', 'left_half', 'right_half']];
  for (const s of stats) {
    csvRows.push([start, end, 'summary', s.key, '', s.mentionTotal, '', '', '']);
    for (const top of s.top) csvRows.push([start, end, 'top', s.key, top.head, top.count, '', '', '']);
  }
  for (const row of trendUp) csvRows.push([start, end, 'trend_up', row.type, row.head, '', row.delta, row.leftCount, row.rightCount]);
  for (const row of trendDown) csvRows.push([start, end, 'trend_down', row.type, row.head, '', row.delta, row.leftCount, row.rightCount]);
  const csvText = csvRows.map(r => r.map(csvEscape).join(',')).join('\n');

  const mdLines = [];
  mdLines.push(`# Динамика по страницам: ${start}-${end}`);
  mdLines.push('');
  mdLines.push(`Окно: **${start}-${end}** (ширина ${end - start + 1} стр.)`);
  mdLines.push('');
  mdLines.push('## Сводка по типам');
  for (const s of stats) mdLines.push(`- ${s.label}: сущностей ${s.activeCount}, упоминаний ${s.mentionTotal}`);
  mdLines.push('');
  mdLines.push('## Рост во второй половине');
  if (trendUp.length) for (const r of trendUp) mdLines.push(`- ${r.head} [${r.type}] ${r.leftCount}→${r.rightCount} (Δ ${r.delta > 0 ? '+' : ''}${r.delta})`);
  else mdLines.push('- —');
  mdLines.push('');
  mdLines.push('## Снижение во второй половине');
  if (trendDown.length) for (const r of trendDown) mdLines.push(`- ${r.head} [${r.type}] ${r.leftCount}→${r.rightCount} (Δ ${r.delta})`);
  else mdLines.push('- —');
  const mdText = mdLines.join('\n');

  if (startRange) startRange.oninput = () => { trendsRangeStart = clamp(parseInt(startRange.value, 10)); rerender(); };
  if (endRange) endRange.oninput = () => { trendsRangeEnd = clamp(parseInt(endRange.value, 10)); rerender(); };
  if (startInput) startInput.onchange = () => { trendsRangeStart = clamp(parseInt(startInput.value, 10)); rerender(); };
  if (endInput) endInput.onchange = () => { trendsRangeEnd = clamp(parseInt(endInput.value, 10)); rerender(); };
  if (chapterSelect) {
    chapterSelect.onchange = () => {
      const idx = parseInt(chapterSelect.value, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= chapters.length) return;
      trendsRangeStart = chapters[idx].start;
      trendsRangeEnd = chapters[idx].end;
      rerender();
    };
  }
  if (exportCsvBtn) exportCsvBtn.onclick = () => downloadTextFile(`page-trends-${start}-${end}.csv`, csvText, 'text/csv;charset=utf-8');
  if (exportMdBtn) exportMdBtn.onclick = () => downloadTextFile(`page-trends-${start}-${end}.md`, mdText, 'text/markdown;charset=utf-8');
  bindNavigateLinks(container, '.trend-link[data-head]', 'all');
}

function renderScholarPanel(container) {
  const s = APP_DATA.scholar || {};
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1200px;margin:0 auto;">';
  html += '<h2 style="font-size:22px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Профессиональный аппарат</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:20px;">Дополнительные материалы для взрослого читателя, студента-лингвиста, преподавателя и специалиста-русиста.</div>';

  // Якорное оглавление
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
  html += '<div style="background:#f0e8d8;padding:10px 14px;border-radius:4px;margin-bottom:18px;font-size:12px;">';
  for (const [id, title] of sections) {
    html += `<a href="#sch-${id}" style="display:inline-block;margin:3px 10px 3px 0;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(title)}</a>`;
  }
  html += '</div>';

  // 1. Библиография
  html += '<h3 id="sch-biblio" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;">1. Библиография работ Зализняка по темам лекций</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Каждая лекция в книге — выжимка из академических работ Зализняка. Здесь — ключевые публикации, где темы изложены подробнее. PDF-подборка: <a href="https://inslav.ru/people/zaliznyak-andrey-anatolevich-1935-2017" target="_blank" rel="noopener noreferrer" style="color:#5a3818;text-decoration:underline dotted;">страница ИСл РАН ↗</a>.</div>';
  for (const lec of (s.bibliography || [])) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:10px 14px;margin-bottom:8px;">
      <div style="font-weight:bold;color:#5a3818;font-size:13px;margin-bottom:6px;">Лекция «${escapeHtml(lec.lecture)}»</div>`;
    for (const w of lec.works) {
      html += `<div style="font-size:12px;margin-bottom:4px;padding-left:12px;border-left:2px solid #d4c8b0;">
        <strong>${escapeHtml(w.title)}</strong> (${escapeHtml(String(w.year))})${w.url ? ` <a href="${escapeHtml(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer" style="color:#5a3818;text-decoration:underline dotted;">PDF/страница ↗</a>` : ''}<br>
        <span style="color:#666;font-style:italic;">${escapeHtml(w.note)}</span>
      </div>`;
    }
    html += '</div>';
  }

  // 2. Расширенные сведения — отсылка к карточкам имён
  html += '<h3 id="sch-extended_cards" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">2. Расширенные сведения о ключевых лингвистах</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Подробные карточки лингвистов с биографией, библиографией и научно-исторической информацией доступны в разделе «Имена». Кликните по любому имени, чтобы открыть карточку.</div>';
  html += '<div>';
  const keyLinguists = ['Вакернагель Я.','Гримм Я.','Вернер К.','Раск Р. К.','Бопп Фр.','Мейе А.','Шампольон Ф.','Вентрис М.','Янин В. Л.','Гиппиус А. А.','Аванесов Р. И.','Дыбо В. А.','Иллич-Свитыч В. М.','Падучева Е. В.'];
  for (const name of keyLinguists) {
    html += `<a class="scholar-link" data-type="names" data-head="${escapeHtml(name)}" href="${escapeHtml(buildItemHash('names', name))}" style="display:inline-block;padding:4px 10px;background:#f0e8d8;border-radius:12px;margin:3px;cursor:pointer;color:#5a3818;text-decoration:underline dotted;font-size:12px;">${escapeHtml(name)}</a>`;
  }
  html += '</div>';

  // 3. Спорные вопросы
  html += '<h3 id="sch-controversies" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">3. Спорные вопросы и дискуссионные места</h3>';
  for (const c of (s.controversies || [])) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:12px 16px;margin-bottom:10px;border-left:4px solid #c0392b;">
      <div style="font-weight:bold;color:#5a3818;font-size:14px;margin-bottom:4px;">${escapeHtml(c.topic)} <span style="font-size:11px;color:#888;font-weight:normal;">· стр. ${escapeHtml(c.page)}</span></div>
      <div style="font-size:13px;color:#444;line-height:1.5;margin-bottom:6px;">${escapeHtml(c.description)}</div>
      <div style="font-size:12px;color:#6a5040;"><strong>Стороны:</strong> ${escapeHtml(c.sides)}</div>
    </div>`;
  }

  // 4. Оригинальные формы по языкам
  html += '<h3 id="sch-original" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">4. Оригинальные формы по языкам</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Слова из лекций в авторских системах транслитерации и оригинальном письме.</div>';
  const langLabels = {sanskrit:'Санскрит',greek:'Древнегреческий',latin:'Латинский',arabic:'Арабский',old_russian:'Древнерусский'};
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;">';
  for (const [key, label] of Object.entries(langLabels)) {
    const forms = (s.original_forms || {})[key] || [];
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:10px 14px;">
      <div style="font-weight:bold;color:#5a3818;font-size:13px;margin-bottom:6px;">${label}</div>`;
    for (const f of forms) {
      html += `<div style="font-size:12px;margin-bottom:3px;"><span style="font-style:italic;color:#5a3818;font-family:'Noto Serif','DejaVu Serif',Georgia,serif;">${renderAccentSafe(f.form)}</span> — ${escapeHtml(f.translation)} <span style="color:#888;">(стр. ${escapeHtml(f.page)})</span></div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // 5. Конкорданс берестяных грамот
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
  html += '<h3 id="sch-birch" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">5. Конкорданс берестяных грамот</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Берестяные грамоты, упоминаемые в лекции, по номерам. Полная база: <a href="https://gramoty.ru/birchbark" target="_blank" rel="noopener noreferrer" style="color:#5a3818;text-decoration:underline dotted;">gramoty.ru/birchbark ↗</a>.</div>';
  html += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px;background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:8px 10px;">
    <label style="font-size:11px;color:#6a5040;">Город
      <select id="birch-city-filter" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
        <option value="">Все</option>
        ${birchCities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>
    <label style="font-size:11px;color:#6a5040;">Век
      <select id="birch-century-filter" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
        <option value="">Все</option>
        ${birchCenturies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>
    <label style="font-size:11px;color:#6a5040;">Номер грамоты
      <input id="birch-number-filter" type="text" inputmode="numeric" placeholder="например, 776" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;min-width:140px;">
    </label>
  </div>`;
  html += '<table style="width:100%;font-size:13px;border-collapse:collapse;background:#fff;border:1px solid #d4c8b0;border-radius:4px;overflow:hidden;">';
  html += '<thead><tr style="background:#f0e8d8;"><th style="padding:8px 12px;text-align:left;">№</th><th style="padding:8px 12px;text-align:left;">Город</th><th style="padding:8px 12px;text-align:left;">Дата</th><th style="padding:8px 12px;text-align:left;">Содержание</th><th style="padding:8px 12px;text-align:left;">Стр.</th></tr></thead><tbody id="birch-concordance-body">';
  for (const g of birchRows) {
    const birchLink = g.url ? `<a href="${escapeHtml(safeUrl(g.url))}" target="_blank" rel="noopener noreferrer" style="color:#5a3818;text-decoration:underline dotted;">№${escapeHtml(g.num)} ↗</a>` : `№${escapeHtml(g.num)}`;
    html += `<tr class="birch-row" data-city="${escapeHtml(g.city)}" data-century="${escapeHtml(g.century)}" data-num="${escapeHtml(String(g.num || ''))}" style="border-top:1px solid #f0e8d8;">
      <td style="padding:6px 12px;font-weight:bold;color:#5a3818;">${birchLink}</td>
      <td style="padding:6px 12px;color:#666;">${escapeHtml(g.city)}</td>
      <td style="padding:6px 12px;color:#666;">${escapeHtml(g.year)}</td>
      <td style="padding:6px 12px;">${escapeHtml(g.content)}</td>
      <td style="padding:6px 12px;color:#888;">${escapeHtml(g.page)}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // 6. Хронология
  html += '<h3 id="sch-chronology" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">6. Хронология лингвистических открытий</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">События истории лингвистики, связанные с темами книги.</div>';
  for (const ev of (s.chronology || [])) {
    html += `<div style="display:grid;grid-template-columns:80px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid #f0e8d8;">
      <div style="font-weight:bold;color:#5a3818;text-align:right;border-right:2px solid #8a7050;padding-right:10px;">${escapeHtml(ev.year)}</div>
      <div style="font-size:13px;">${escapeHtml(ev.event)}${ev.page ? '<span style="color:#888;font-size:11px;"> · стр. '+escapeHtml(ev.page)+'</span>' : ''}</div>
    </div>`;
  }
  if (Array.isArray(s.visualization_ideas) && s.visualization_ideas.length) {
    html += '<div style="margin-top:10px;background:#fff8e8;border:1px solid #d4c8b0;border-radius:4px;padding:10px 12px;">';
    html += '<div style="font-size:12px;color:#5a3818;font-weight:bold;margin-bottom:4px;">Как ещё можно визуализировать</div>';
    for (const idea of s.visualization_ideas) html += `<div style="font-size:12px;color:#444;line-height:1.5;">• ${escapeHtml(idea)}</div>`;
    html += '</div>';
  }

  // 7. Изоглоссы
  html += '<h3 id="sch-isoglosses" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">7. Изоглоссы русских диалектов</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Линии, разделяющие диалекты по конкретным фонетическим, морфологическим и лексическим признакам, обсуждаемым в книге.</div>';
  for (const i of (s.isoglosses || [])) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #16a085;">
      <div style="font-weight:bold;color:#5a3818;font-size:13px;margin-bottom:4px;">${escapeHtml(i.name)}${i.page ? ' <span style="font-weight:normal;font-size:11px;color:#888;">· стр. '+escapeHtml(i.page)+'</span>' : ''}</div>
      <div style="font-size:12px;color:#444;line-height:1.5;">${escapeHtml(i.description)}</div>
    </div>`;
  }

  // 8. Слово о полку Игореве
  html += '<h3 id="sch-slovo" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">8. Аргументация Зализняка о подлинности «Слова о полку Игореве»</h3>';
  if (s.slovo) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:14px 18px;margin-bottom:8px;">
      <div style="font-size:12px;color:#444;line-height:1.6;margin-bottom:10px;font-style:italic;">${escapeHtml(s.slovo.thesis)}</div>
      ${s.slovo.context ? `<div style="font-size:12px;color:#444;line-height:1.5;background:#fbf6e8;padding:8px 10px;border-radius:4px;">${escapeHtml(s.slovo.context)}</div>` : ''}`;
    html += `<div style="font-size:12px;margin-top:10px;color:#666;"><strong>Оппоненты:</strong> ${escapeHtml(s.slovo.opponents)}</div>
      <div style="font-size:12px;margin-top:4px;color:#5a3818;font-weight:bold;">${escapeHtml(s.slovo.verdict)}</div>
    </div>`;
  }
  if (Array.isArray(s.slovo_links) && s.slovo_links.length) {
    html += '<div style="font-size:12px;margin-top:6px;">';
    for (const link of s.slovo_links) {
      html += `<a href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer" style="color:#5a3818;text-decoration:underline dotted;margin-right:12px;">${escapeHtml(link.title)} ↗</a>`;
    }
    html += '</div>';
  }
  if (s.slovo) {
    const slovoArgs = Array.isArray(s.slovo.arguments) ? s.slovo.arguments : [];
    const slovoCounters = Array.isArray(s.slovo.counterarguments) ? s.slovo.counterarguments : [];
    html += '<div style="margin-top:8px;background:#fff8e8;border:1px solid #d4c8b0;border-radius:4px;padding:10px 12px;">';
    html += '<div style="font-size:12px;color:#5a3818;font-weight:bold;margin-bottom:6px;">Тезисы / контраргументы / контекст</div>';
    if (s.slovo.context) {
      html += `<div style="font-size:12px;color:#444;line-height:1.5;margin-bottom:8px;">${escapeHtml(s.slovo.context)}</div>`;
    }
    for (let i = 0; i < slovoArgs.length; i++) {
      const a = slovoArgs[i];
      const anchorId = `sch-slovo-arg-${i + 1}`;
      const pageMeta = a.page ? `<span style="font-size:11px;color:#888;">Стр. ${escapeHtml(a.page)}</span>` : '';
      const sourceMeta = a.url ? `<a href="${escapeHtml(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#5a3818;text-decoration:underline dotted;">источник ↗</a>` : '';
      html += `<div id="${anchorId}" style="background:#fff;padding:8px 10px;border:1px solid #e3d6c0;border-radius:4px;margin-bottom:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="font-weight:bold;color:#5a3818;font-size:12px;">${escapeHtml(a.name)}</div>
          <a class="scholar-slovo-anchor" data-anchor="${anchorId}" href="${escapeHtml(buildScholarAnchorHash(anchorId))}" style="font-size:11px;color:#7a6048;text-decoration:underline dotted;">якорь #${i + 1}</a>
        </div>
        <div style="font-size:12px;color:#444;line-height:1.5;margin-top:3px;">${escapeHtml(a.detail)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">${pageMeta}${sourceMeta}</div>
      </div>`;
    }
    if (slovoCounters.length) {
      html += '<div style="font-size:11px;color:#6a5040;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 6px;">Контраргументы:</div>';
      for (const c of slovoCounters) {
        const pageMeta = c.page ? `<span style="font-size:11px;color:#888;">Стр. ${escapeHtml(c.page)}</span>` : '';
        const sourceMeta = c.url ? `<a href="${escapeHtml(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#5a3818;text-decoration:underline dotted;">источник ↗</a>` : '';
        html += `<div style="background:#fff;padding:8px 10px;border:1px solid #e9d9c9;border-radius:4px;margin-bottom:6px;">
          <div style="font-weight:bold;color:#6b3d31;font-size:12px;margin-bottom:3px;">${escapeHtml(c.name)}</div>
          <div style="font-size:12px;color:#444;line-height:1.5;">${escapeHtml(c.detail)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">${pageMeta}${sourceMeta}</div>
        </div>`;
      }
    }
    html += '</div>';
  }
  if (Array.isArray(s.slovo_reading) && s.slovo_reading.length) {
    html += '<div style="margin-top:8px;background:#fff8e8;border:1px solid #d4c8b0;border-radius:4px;padding:10px 12px;">';
    html += '<div style="font-size:12px;color:#5a3818;font-weight:bold;margin-bottom:6px;">Что читать дальше</div>';
    for (const item of s.slovo_reading) {
      html += `<div style="margin-bottom:6px;font-size:12px;line-height:1.45;">
        <a href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" style="color:#5a3818;text-decoration:underline dotted;">${escapeHtml(item.title)} ↗</a>
        ${item.note ? `<div style="color:#666;font-size:11px;margin-top:2px;">${escapeHtml(item.note)}</div>` : ''}
      </div>`;
    }
    html += '</div>';
  }

  // 9. Акцентологические парадигмы
  html += '<h3 id="sch-accents" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">9. Акцентологические парадигмы Зализняка</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Базовые и расширенные типы русского ударения по классификации Зализняка («Грамматический словарь русского языка», 1977) с историко-диалектными комментариями.</div>';
  for (const ap of (s.accent_paradigms || [])) {
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:12px 16px;margin-bottom:10px;">
      <div style="font-weight:bold;color:#5a3818;font-size:14px;margin-bottom:4px;">Тип ${escapeHtml(ap.type)}</div>
      <div style="font-size:12px;color:#444;line-height:1.5;margin-bottom:8px;">${escapeHtml(ap.description)}</div>`;
    for (const ex of ap.examples) {
      html += `<div style="background:#fbf6e8;padding:6px 10px;margin-bottom:4px;border-radius:3px;font-size:12px;"><strong>${renderAccentSafe(ex.word)}</strong> — <span style="color:#666;font-style:italic;">${renderAccentSafe(ex.forms)}</span></div>`;
    }
    html += '</div>';
  }
  const accentOptions = (s.accent_paradigms || []).map((ap, idx) => `<option value="${idx}">${escapeHtml(ap.type)}</option>`).join('');
  html += `<div style="background:#fff8e8;border:1px solid #d4c8b0;border-radius:4px;padding:10px 12px;margin-bottom:12px;">
    <div style="font-size:12px;color:#5a3818;font-weight:bold;margin-bottom:8px;">Сравнение 2–3 парадигм</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px;">
      <label style="font-size:11px;color:#6a5040;">Парадигма A
        <select id="accent-compare-a" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">${accentOptions}</select>
      </label>
      <label style="font-size:11px;color:#6a5040;">Парадигма B
        <select id="accent-compare-b" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">${accentOptions}</select>
      </label>
      <label style="font-size:11px;color:#6a5040;">Парадигма C (опц.)
        <select id="accent-compare-c" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
          <option value="-1">—</option>
          ${accentOptions}
        </select>
      </label>
      <button id="accent-compare-export-md" type="button" class="related-link related-link-btn">Экспорт сравнения в Markdown</button>
    </div>
    <div id="accent-compare-box"></div>
  </div>`;

  // 10. Сравнительная таблица
  html += '<h3 id="sch-correspondences" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">10. Сравнительная таблица фонетических соответствий</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">Расширенный набор соответствий (ПИЕ → славянские, греческие, индоиранские и западноевропейские формы), который можно дальше наращивать на материале работ Зализняка.</div>';
  html += '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;border-collapse:collapse;background:#fff;border:1px solid #d4c8b0;border-radius:4px;">';
  html += '<thead><tr style="background:#f0e8d8;"><th style="padding:6px 8px;text-align:left;">ПИЕ</th><th style="padding:6px 8px;text-align:left;">Русск.</th><th style="padding:6px 8px;text-align:left;">Лат.</th><th style="padding:6px 8px;text-align:left;">Греч.</th><th style="padding:6px 8px;text-align:left;">Санскр.</th><th style="padding:6px 8px;text-align:left;">Англ.</th><th style="padding:6px 8px;text-align:left;">Нем.</th><th style="padding:6px 8px;text-align:left;">Значение</th></tr></thead><tbody>';
  for (const r of (s.sound_correspondences || [])) {
    html += `<tr style="border-top:1px solid #f0e8d8;">
      <td style="padding:6px 8px;font-style:italic;color:#5a3818;">${renderAccentSafe(r.pie)}</td>
      <td style="padding:6px 8px;font-weight:bold;">${renderAccentSafe(r.rus)}</td>
      <td style="padding:6px 8px;">${renderAccentSafe(r.lat)}</td>
      <td style="padding:6px 8px;font-family:'Noto Serif','DejaVu Serif',Georgia,serif;">${renderAccentSafe(r.gre)}</td>
      <td style="padding:6px 8px;font-family:'Noto Serif','DejaVu Serif',Georgia,serif;">${renderAccentSafe(r.san)}</td>
      <td style="padding:6px 8px;">${renderAccentSafe(r.eng)}</td>
      <td style="padding:6px 8px;">${renderAccentSafe(r.ger)}</td>
      <td style="padding:6px 8px;color:#888;font-style:italic;">${escapeHtml(r.meaning)}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  // 11. Реконструкции
  const recon = APP_DATA.lexicon_tech || [];
  html += '<h3 id="sch-reconstructions" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">11. Реконструкции</h3>';
  html += `<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">${recon.length} реконструированных и иноязычных форм, вынесенных в подраздел профессионального аппарата.</div>`;
  html += '<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:10px 12px;">';
  for (const item of recon) {
    html += `<a class="scholar-link" data-type="lexicon_tech" data-head="${escapeHtml(item.head)}" href="${escapeHtml(buildItemHash('lexicon_tech', item.head))}" style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;cursor:pointer;color:inherit;text-decoration:none;">
      <span style="color:#5a3818;text-decoration:underline dotted;">${escapeHtml(item.head)}</span>
      <span style="font-size:11px;color:#888;">${escapeHtml((item.page_list || []).length)} стр.</span>
    </a>`;
  }
  html += '</div>';

  html += '</div></div>';
  container.innerHTML = html;

  // Привязки кликов на имена
  bindNavigateLinks(container, '.scholar-link', 'all');
  container.querySelectorAll('.scholar-slovo-anchor[data-anchor]').forEach((link) => {
    link.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const anchorId = String(link.dataset.anchor || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
      if (!anchorId) return;
      currentScholarAnchor = anchorId;
      pendingScholarAnchor = anchorId;
      syncNavigationState();
      const target = container.querySelector(`#${anchorId}`);
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
  });
  if (pendingScholarAnchor) {
    const target = container.querySelector(`#${pendingScholarAnchor}`);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start' });
    }
    currentScholarAnchor = pendingScholarAnchor;
    pendingScholarAnchor = '';
  }
  const accentCompareA = container.querySelector('#accent-compare-a');
  const accentCompareB = container.querySelector('#accent-compare-b');
  const accentCompareC = container.querySelector('#accent-compare-c');
  const accentCompareBox = container.querySelector('#accent-compare-box');
  const accentCompareExport = container.querySelector('#accent-compare-export-md');
  if (accentCompareA && accentCompareB && accentCompareC && accentCompareBox) {
    const paradigms = Array.isArray(s.accent_paradigms) ? s.accent_paradigms : [];
    const splitForms = (text) => String(text || '')
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12);
    const stripAccents = (text) => String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const mdEscapeCell = (text) => String(text || '').replace(/\|/g, '\\|');
    const parseIdx = (el, fallback) => {
      if (!el || typeof el.value !== 'string') return fallback;
      const n = parseInt(el.value, 10);
      if (!Number.isInteger(n)) return fallback;
      return Math.max(-1, Math.min(n, paradigms.length - 1));
    };
    let lastMd = '';
    const renderAccentCompare = () => {
      const idxA = parseIdx(accentCompareA, 0);
      let idxB = parseIdx(accentCompareB, paradigms.length > 1 ? 1 : 0);
      const idxC = parseIdx(accentCompareC, -1);
      if (idxB === idxA) idxB = paradigms.length > 1 ? ((idxA + 1) % paradigms.length) : idxA;
      const selected = [idxA, idxB, idxC].filter((idx, pos, arr) => idx >= 0 && arr.indexOf(idx) === pos);
      if (selected.length < 2) {
        accentCompareBox.innerHTML = '<div style="font-size:12px;color:#888;">Выберите минимум две разные парадигмы.</div>';
        lastMd = '';
        return;
      }
      const selectedParadigms = selected.map((idx) => paradigms[idx]).filter(Boolean);
      const labels = selectedParadigms.map((p) => String(p.type || 'тип'));
      const rows = [];
      let maxRows = 0;
      for (const p of selectedParadigms) {
        const ex = Array.isArray(p.examples) ? p.examples : [];
        const first = ex.length ? ex[0] : { word: '', forms: '' };
        const forms = splitForms(first.forms || first.word || '');
        rows.push(forms);
        if (forms.length > maxRows) maxRows = forms.length;
      }
      const htmlRows = [];
      const mdRows = [];
      for (let i = 0; i < maxRows; i++) {
        const cells = rows.map((r) => String(r[i] || ''));
        const norms = cells.map(stripAccents).filter(Boolean);
        const same = norms.length > 1 && norms.every((n) => n === norms[0]);
        const cellHtml = cells.map((cell) => {
          const bg = !same && cell ? 'background:#fff3e4;' : '';
          return `<td style="padding:6px 8px;border-top:1px solid #f0e8d8;${bg}">${cell ? renderAccentSafe(cell) : '<span style="color:#bbb;">—</span>'}</td>`;
        }).join('');
        htmlRows.push(`<tr><td style="padding:6px 8px;border-top:1px solid #f0e8d8;color:#888;font-size:11px;">${i + 1}</td>${cellHtml}</tr>`);
        mdRows.push(`| ${i + 1} | ${cells.map(mdEscapeCell).join(' | ')} |`);
      }
      accentCompareBox.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;border-collapse:collapse;background:#fff;border:1px solid #d4c8b0;border-radius:4px;">
        <thead><tr style="background:#f0e8d8;"><th style="padding:6px 8px;text-align:left;">№</th>${labels.map((l) => `<th style="padding:6px 8px;text-align:left;">${escapeHtml(l)}</th>`).join('')}</tr></thead>
        <tbody>${htmlRows.join('')}</tbody>
      </table></div>`;
      const mdHeader = `| № | ${labels.join(' | ')} |`;
      const mdSep = `| ${['---', ...labels.map(() => '---')].join(' | ')} |`;
      lastMd = ['# Сравнение акцентологических парадигм', '', mdHeader, mdSep, ...mdRows, ''].join('\n');
    };
    if (paradigms.length > 1) {
      accentCompareA.value = '0';
      accentCompareB.value = '1';
    }
    accentCompareC.value = '-1';
    accentCompareA.onchange = renderAccentCompare;
    accentCompareB.onchange = renderAccentCompare;
    accentCompareC.onchange = renderAccentCompare;
    if (accentCompareExport) {
      accentCompareExport.onclick = () => {
        if (!lastMd) return;
        downloadTextFile('accent-paradigms-compare.md', lastMd, 'text/markdown;charset=utf-8');
      };
    }
    renderAccentCompare();
  }

  // Локальные фильтры конкорданса берестяных грамот
  const birchCityFilter = container.querySelector('#birch-city-filter');
  const birchCenturyFilter = container.querySelector('#birch-century-filter');
  const birchNumberFilter = container.querySelector('#birch-number-filter');
  const birchRowsEls = Array.from(container.querySelectorAll('.birch-row'));
  const birchBody = container.querySelector('#birch-concordance-body');
  const applyBirchFilters = () => {
    const city = (birchCityFilter && birchCityFilter.value ? String(birchCityFilter.value) : '').toLowerCase();
    const century = birchCenturyFilter && birchCenturyFilter.value ? String(birchCenturyFilter.value) : '';
    const numNeedle = normalizeHeadForMatch(birchNumberFilter && birchNumberFilter.value ? String(birchNumberFilter.value) : '');
    let shown = 0;
    for (const row of birchRowsEls) {
      const rowCity = String(row.dataset.city || '').toLowerCase();
      const rowCentury = String(row.dataset.century || '');
      const rowNum = normalizeHeadForMatch(String(row.dataset.num || ''));
      const byCity = !city || rowCity === city;
      const byCentury = !century || rowCentury === century;
      const byNum = !numNeedle || rowNum.includes(numNeedle);
      const visible = byCity && byCentury && byNum;
      row.style.display = visible ? '' : 'none';
      if (visible) shown += 1;
    }
    if (!birchBody) return;
    const oldEmpty = birchBody.querySelector('.birch-empty-row');
    if (oldEmpty) oldEmpty.remove();
    if (!shown) {
      const tr = document.createElement('tr');
      tr.className = 'birch-empty-row';
      tr.innerHTML = '<td colspan="5" style="padding:10px 12px;color:#888;font-style:italic;">Ничего не найдено: попробуйте ослабить фильтры.</td>';
      birchBody.appendChild(tr);
    }
  };
  if (birchCityFilter) birchCityFilter.onchange = applyBirchFilters;
  if (birchCenturyFilter) birchCenturyFilter.onchange = applyBirchFilters;
  if (birchNumberFilter) {
    birchNumberFilter.oninput = (e) => {
      const t = e && e.target;
      if (!t || typeof t.value !== 'string') return;
      const next = t.value.replace(/[^\d]/g, '').slice(0, 6);
      if (t.value !== next) t.value = next;
      applyBirchFilters();
    };
  }
  applyBirchFilters();
}

// =========================================================
// ДРЕВО ЯЗЫКОВ
// =========================================================
function renderTreePanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Генеалогическое древо языков книги: языковая семья → подгруппа → язык. Полужирным выделены языки, обсуждаемые содержательно. Кликните по языку, чтобы открыть карточку.</p>
    <div id="lang-tree"></div></div></div>`;
  const container_tree = document.getElementById('lang-tree');
  const tree = APP_DATA.language_tree;
  if (!tree) { container_tree.innerHTML = '<p>Нет данных</p>'; return; }

  const rowH = 20;
  const col1 = 20, col2 = 220, col3 = 480;
  const W = 1000;
  let y = 40;
  const positioned = [];
  for (const fam of tree) {
    const famStartY = y;
    for (const grp of fam.children) {
      const grpStartY = y;
      for (const lang of grp.children) {
        positioned.push({
          famName: fam.name, grpName: grp.name, langName: lang.name,
          discussed: lang.discussed, y: y,
        });
        y += rowH;
      }
      grp.endY = y - rowH;
      grp.midY = (grpStartY + grp.endY) / 2;
    }
    fam.endY = y - rowH;
    fam.midY = (famStartY + fam.endY) / 2;
    y += 10;
  }
  const H = y + 30;

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:Georgia,serif;">`;
  for (const fam of tree) {
    const famColor = safeColor(FAMILY_COLORS[fam.name], '#888');
    svg += `<text x="${col1}" y="${fam.midY + 4}" fill="${famColor}" font-size="13" font-weight="bold">${escapeHtml(fam.name)}</text>`;
    for (const grp of fam.children) {
      svg += `<path d="M ${col1 + 180} ${fam.midY} C ${col2 - 20} ${fam.midY}, ${col2 - 20} ${grp.midY}, ${col2} ${grp.midY}" fill="none" stroke="${famColor}" stroke-width="1.5" opacity="0.6"/>`;
      svg += `<text x="${col2}" y="${grp.midY + 4}" fill="#5a3818" font-size="11" font-style="italic">${escapeHtml(grp.name)}</text>`;
      for (const lang of grp.children) {
        const p = positioned.find(p => p.famName===fam.name && p.grpName===grp.name && p.langName===lang.name);
        if (!p) continue;
        svg += `<path d="M ${col2 + 240} ${grp.midY} C ${col3 - 20} ${grp.midY}, ${col3 - 20} ${p.y}, ${col3} ${p.y}" fill="none" stroke="${famColor}" stroke-width="1" opacity="0.4"/>`;
        svg += `<g style="cursor:pointer" data-lang="${escapeHtml(lang.name)}">
          <circle cx="${col3 - 6}" cy="${p.y}" r="3" fill="${famColor}"/>
          <text x="${col3}" y="${p.y + 4}" fill="#1a1a1a" font-size="12"${lang.discussed?' font-weight="bold"':''}>${escapeHtml(lang.name)}</text>
        </g>`;
      }
    }
  }
  svg += '</svg>';
  container_tree.innerHTML = svg;
  container_tree.querySelectorAll('g[data-lang]').forEach(g => {
    g.onclick = () => {
      selectedItem = g.dataset.lang;
      selectedItemType = 'languages';
      rightPaneMode = 'card';
      switchTab('list');
    };
  });
}

// =========================================================
// КАРТА: Google My Maps embed
// =========================================================
function renderMapPanel(container) {
  const type = currentEntity;
  let note, items, colorFn, radiusFn;
  if (type === 'toponyms') {
    note = 'Топонимы лекций на карте мира. Размер точки — число упоминаний; цвет — историческая эпоха. Кликните по маркеру, чтобы открыть карточку.';
    items = APP_DATA.toponyms.filter(t => t.lat !== undefined);
    colorFn = t => safeColor(EPOCH_COLORS[t.epoch_class], '#888');
    radiusFn = t => 4 + Math.sqrt((t.page_list||[]).length) * 1.5;
  } else if (type === 'ethnonyms') {
    note = 'Народы, упоминаемые в лекциях, в местах их исторического расселения. Размер — число упоминаний. Кликните, чтобы открыть карточку.';
    items = APP_DATA.ethnonyms.filter(t => t.lat !== undefined);
    colorFn = t => t.discussed ? '#c0392b' : '#3a6ea5';
    radiusFn = t => 4 + Math.sqrt((t.page_list||[]).length) * 1.5;
  } else if (type === 'languages') {
    note = 'Языки на карте мира, размещённые по центрам своих исторических ареалов. Цвет — языковая семья. Размер — число упоминаний в книге.';
    items = APP_DATA.languages.filter(t => t.lat !== undefined);
    colorFn = l => safeColor(FAMILY_COLORS[l.family], '#888');
    radiusFn = l => 4 + Math.sqrt((l.page_list||[]).length) * 1.3;
  } else {
    note = 'Карта'; items = []; colorFn = () => '#888'; radiusFn = () => 6;
  }

  container.innerHTML = `<div class="panel active"><div class="map-container">
    <p class="chart-intro">${note}</p>
    <div id="leaflet-map" style="flex:1; min-height:0;"></div></div></div>`;

  // Fallback при отсутствии Leaflet / интернета
  if (typeof L === 'undefined') {
    renderOfflineMap(type, items, colorFn, radiusFn);
    return;
  }

  setTimeout(() => {
    let map;
    try {
      map = L.map('leaflet-map', { preferCanvas: true }).setView([40, 30], 3);
      const providers = [
        {
          name: 'CARTO',
          url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          options: { subdomains: 'abcd', maxZoom: 20, attribution: '© OpenStreetMap contributors © CARTO' },
        },
        {
          name: 'Esri WorldStreetMap',
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          options: {
            maxZoom: 19,
            attribution: 'Tiles © Esri',
          },
        },
        {
          name: 'OpenTopoMap',
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          options: { subdomains: 'abc', maxZoom: 17, attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap' },
        },
      ];

      const status = document.createElement('div');
      status.style.cssText = 'position:absolute;right:8px;top:8px;z-index:450;background:rgba(255,255,255,.9);border:1px solid #cbb79a;border-radius:3px;padding:2px 6px;font-size:11px;color:#6a5040;';
      status.textContent = 'Карта: загрузка…';
      const mapEl = document.getElementById('leaflet-map');
      if (mapEl) mapEl.appendChild(status);

      let loaded = false;
      let providerIndex = -1;
      let layer = null;
      let loadWatch = null;

      const failToOffline = () => {
        try { if (loadWatch) clearTimeout(loadWatch); } catch (e) {}
        try { map.remove(); } catch (e) {}
        renderOfflineMap(type, items, colorFn, radiusFn);
      };

      const switchProvider = () => {
        providerIndex += 1;
        if (providerIndex >= providers.length) {
          failToOffline();
          return;
        }
        const p = providers[providerIndex];
        loaded = false;
        try {
          if (layer) map.removeLayer(layer);
        } catch (e) {}
        layer = L.tileLayer(p.url, p.options || {});
        let tileErrors = 0;
        layer.on('load', () => {
          loaded = true;
          status.textContent = `Карта: ${p.name}`;
        });
        layer.on('tileerror', () => {
          tileErrors += 1;
          if (tileErrors >= 6 && !loaded) {
            switchProvider();
          }
        });
        layer.addTo(map);
        if (loadWatch) clearTimeout(loadWatch);
        loadWatch = setTimeout(() => {
          if (!loaded) switchProvider();
        }, 4500);
      };

      switchProvider();
    } catch (e) {
      renderOfflineMap(type, items, colorFn, radiusFn);
      return;
    }
    for (const it of items) {
      const marker = L.circleMarker([it.lat, it.lon], {
        radius: radiusFn(it),
        color: 'white',
        weight: 1.5,
        fillColor: colorFn(it),
        fillOpacity: 0.8,
      }).addTo(map);
      const pagesInfo = (it.page_list || []).length + ' стр.';
      let extra = '';
      if (type === 'toponyms' && it.epoch_class && it.epoch_class !== 'unknown') {
        extra = '<br><small>' + escapeHtml(EPOCH_LABELS[it.epoch_class] || '') + '</small>';
      } else if (type === 'languages' && it.family) {
        extra = '<br><small>' + escapeHtml(it.family) + '</small>';
      }
      marker.bindTooltip(`<strong>${escapeHtml(it.head)}</strong><br>${pagesInfo}${extra}`, {sticky: true});
      marker.on('click', () => {
        selectedItem = it.head;
        selectedItemType = type;
        rightPaneMode = 'card';
        switchTab('list');
      });
    }
  }, 50);
}

// Офлайн-заглушка карты: SVG с координатной сеткой и маркерами
function renderOfflineMap(type, items, colorFn, radiusFn) {
  const div = document.getElementById('leaflet-map');
  if (!div) return;
  const W = 1100, H = 600;
  // Простая равноугольная проекция (Plate Carrée)
  function project(lat, lon) {
    const x = ((lon + 180) / 360) * W;
    const y = ((85 - lat) / 145) * H;
    return [x, y];
  }
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;background:#dde6ee;">`;
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#e8edf3"/>`;
  // Координатная сетка
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = project(0, lon);
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#c8d2dc" stroke-width="0.5"/>`;
  }
  for (let lat = -60; lat <= 80; lat += 20) {
    const [, y] = project(lat, 0);
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#c8d2dc" stroke-width="0.5"/>`;
    svg += `<text x="4" y="${y - 2}" fill="#88a" font-size="9">${lat}°</text>`;
  }
  // Маркеры
  for (const it of items) {
    const [x, y] = project(it.lat, it.lon);
    const r = radiusFn(it);
    const color = colorFn(it);
    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.75" stroke="white" stroke-width="1" data-head="${escapeHtml(it.head)}" data-type="${escapeHtml(type)}" style="cursor:pointer"><title>${escapeHtml(it.head)} · стр. ${escapeHtml(it.pages || it.head_pages || '')}</title></circle>`;
  }
  // Заглушка-текст
  svg += `<text x="${W/2}" y="24" fill="#6a5040" font-size="13" text-anchor="middle" font-style="italic">Офлайн-режим: тайлы карты недоступны, показаны только точки</text>`;
  svg += '</svg>';
  div.innerHTML = svg;
  div.style.background = '#e8edf3';
  div.querySelectorAll('circle[data-head]').forEach(c => {
    c.onclick = () => {
      selectedItem = c.dataset.head;
      selectedItemType = c.dataset.type;
      rightPaneMode = 'card';
      switchTab('list');
    };
  });
}

// =========================================================
// ЗАПУСК (асинхронный: сначала отрисовать каркас, потом парсить данные)
// =========================================================
document.getElementById('content').innerHTML = '<div style="padding:40px; text-align:center; color:#888; font-style:italic;">Загрузка указателей…</div>';

setTimeout(() => {
  parseAppData();
  normalizeAppData();
  initEntityTypes();
  wireGlobalUI();
  initTheme();
  initDensityMode();
  const initialHash = (typeof window !== 'undefined' && window.location && typeof window.location.hash === 'string')
    ? window.location.hash
    : '';
  const restored = applyHash(initialHash);
  if (!restored) {
    const saved = restoreViewState();
    if (saved) {
      applyViewState(saved);
      syncNavigationState();
    } else {
      renderEntitySwitcher();
      renderTabs();
      renderContent();
      syncNavigationState();
    }
  }
}, 10);
