// Данные хранятся как строка и парсятся асинхронно после первого отображения интерфейса
const APP_DATA_STRING = __APP_DATA_STRING__;
let APP_DATA = null;
let LABELS = null, COLORS = null, EPOCH_LABELS = null, EPOCH_COLORS = null, FAMILY_COLORS = null;
const APP_DATA_SCHEMA_CURRENT = 2;
const KWIC_MAX_SNIPPETS_PER_PAGE = 24;
const KWIC_MAX_SNIPPET_LENGTH = 420;
const KWIC_MAX_ROWS = 1200;
const APP_BUILD_ID = '__APP_BUILD_ID__';
const DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
  'desc',
  'about',
  'why',
  'why_read',
  'description',
  'definition',
  'main_idea',
  'tagline',
  'event',
]);
const LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

function parseAppData() {
  if (globalSearchCache && typeof globalSearchCache.clear === 'function') {
    globalSearchCache.clear();
  }
  resetGlobalSearchFuseState();
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
      normalizeItemContexts(item);
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

  applyDescriptionEditorialConventions();
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

function normalizeContextSnippet(raw) {
  const text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= KWIC_MAX_SNIPPET_LENGTH) return text;
  return text.slice(0, KWIC_MAX_SNIPPET_LENGTH).trim();
}

function normalizeItemContexts(item) {
  if (!item || typeof item !== 'object') return;
  const src = item.contexts;
  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    item.contexts = {};
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

function applyDescriptionEditorialConventions() {
  normalizeDescriptionYoInNode(APP_DATA);

  const lectures = Array.isArray(APP_DATA?.lectures) ? APP_DATA.lectures : [];
  if (
    lectures[2] &&
    typeof lectures[2].why_read === 'string' &&
    lectures[2].why_read.includes('brother') &&
    lectures[2].why_read.includes('брат')
  ) {
    lectures[2].why_read = LECTURE_WHY_READ_BROTHER_BRAT;
  }
}

// =========================================================
// КОНФИГУРАЦИЯ ТИПОВ СУЩНОСТЕЙ — строится после парсинга
// =========================================================
let ENTITY_TYPES = null;
let ITEM_INDEX_EXACT = new Map();      // type -> Map(head -> item)
let ITEM_INDEX_NORMALIZED = new Map(); // type -> Map(normalizedHead -> item)
let CHAPTER_ITEM_INDEX = new Map();    // type -> Map(chapterName -> item[])
let ITEM_HASH_SLUG_BY_HEAD = new Map(); // type -> Map(head -> slug)
let ITEM_HASH_HEAD_BY_SLUG = new Map(); // type -> Map(slug -> head)

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
    tabs: ['lectures','lecture_compare','lecture_pages','further_reading','glossary','kwic','gallery','russian_evolution','phonetic_laws','tasks'],
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
  kwic: 'KWIC',
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
  ITEM_HASH_SLUG_BY_HEAD = new Map();
  ITEM_HASH_HEAD_BY_SLUG = new Map();

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
    const slugIndexes = buildHashSlugIndexesForItems(conf.items);
    ITEM_HASH_SLUG_BY_HEAD.set(type, slugIndexes.byHead);
    ITEM_HASH_HEAD_BY_SLUG.set(type, slugIndexes.bySlug);
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

function normalizeHashSlug(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim().toLowerCase();
  if (!text) return '';
  if (typeof text.normalize === 'function') text = text.normalize('NFD');
  text = text.replace(/[\u0300-\u036f]/g, '');

  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isAsciiAlpha = code >= 97 && code <= 122;
    const isAsciiDigit = code >= 48 && code <= 57;
    if (isAsciiAlpha || isAsciiDigit) {
      out += ch;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN_MAP, ch)) {
      out += CYRILLIC_TO_LATIN_MAP[ch];
      continue;
    }
    out += '-';
  }
  out = out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!out) return '';
  if (out.length > MAX_HASH_SLUG_LENGTH) {
    out = out.slice(0, MAX_HASH_SLUG_LENGTH).replace(/-+$/g, '');
  }
  return out;
}

function buildHashSlugIndexesForItems(items) {
  const byHead = new Map();
  const bySlug = new Map();
  if (!Array.isArray(items)) return { byHead, bySlug };

  for (const it of items) {
    const head = String(it && it.head ? it.head : '').trim();
    if (!head || byHead.has(head)) continue;

    const baseRaw = normalizeHashSlug(head);
    const base = baseRaw || 'item';
    let slug = base;
    let suffix = 2;
    while (bySlug.has(slug) && bySlug.get(slug) !== head) {
      const suffixToken = `-${suffix}`;
      const keep = Math.max(1, MAX_HASH_SLUG_LENGTH - suffixToken.length);
      const trimmedBase = (base.slice(0, keep).replace(/-+$/g, '') || 'item');
      slug = `${trimmedBase}${suffixToken}`;
      suffix += 1;
    }
    byHead.set(head, slug);
    if (!bySlug.has(slug)) bySlug.set(slug, head);
  }
  return { byHead, bySlug };
}

function encodeItemHeadForHash(type, head) {
  const resolved = resolveExistingHead(type, head);
  const byHead = ITEM_HASH_SLUG_BY_HEAD.get(type);
  if (byHead && byHead.has(resolved)) return byHead.get(resolved);
  const fallbackSlug = normalizeHashSlug(resolved);
  return fallbackSlug || resolved;
}

function resolveItemHeadFromHash(type, encodedHead) {
  const raw = clampUiInput(encodedHead, MAX_HASH_PART_LENGTH);
  if (!raw) return '';

  const exact = getIndexedItem(type, raw);
  if (exact) return exact.head;

  const bySlug = ITEM_HASH_HEAD_BY_SLUG.get(type);
  if (bySlug) {
    if (bySlug.has(raw)) return bySlug.get(raw);
    const normalizedSlug = normalizeHashSlug(raw);
    if (normalizedSlug && bySlug.has(normalizedSlug)) return bySlug.get(normalizedSlug);
  }

  return resolveExistingHead(type, raw);
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
let listFrequencyMin = 1;
let listFrequencyMax = 9999;
let selectedItem = null;
let selectedItemType = null; // тип сущности выбранного — нужно для сводного
let rightPaneMode = 'histogram'; // 'histogram' до выбора, 'card' после
let graphStrongOnly = false;     // Фильтр графа языковых семей: только вес ≥ 50
let nameGraphMinEdgeWeight = 0.1;
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
let currentKwicSource = 'lexicon';
let currentKwicQuery = '';
let currentKwicSort = 'left';
let currentKwicPageStart = 1;
let currentKwicPageEnd = 404;
let pendingKwicTerm = '';
const UI_STATE_STORAGE_KEY = 'zaliznyakiada.ui.v1';
const UI_STATE_SCHEMA_VERSION = 2;
const THEME_STORAGE_KEY = 'zaliznyakiada.theme.v1';
const DENSITY_STORAGE_KEY = 'zaliznyakiada.density.v1';
const READING_PAGE_STORAGE_KEY = 'zaliznyakiada.readingPage.v1';
const RECENT_ITEMS_STORAGE_KEY = 'zaliznyakiada.recentItems.v1';
const TASKS_PROGRESS_STORAGE_KEY = 'zaliznyakiada.tasksProgress.v1';
const TASKS_PROGRESS_SCHEMA_VERSION = 1;
const TASKS_HISTORY_LIMIT = 80;
let globalKeyHandlersWired = false;
let visibleItemsCache = null;
let currentListSearchRaw = '';
let currentListSearchNorm = '';
const MAX_HASH_PARTS = 16;
const MAX_HASH_PART_LENGTH = 220;
const HASH_ROUTE_PREFIX = 'v4';
const MAX_HASH_SLUG_LENGTH = 96;
const MAX_LIST_QUERY_LENGTH = 80;
const MAX_GLOBAL_QUERY_LENGTH = 80;
const LIST_FREQ_MIN_DEFAULT = 1;
const LIST_FREQ_MAX_DEFAULT = 9999;
const MAX_URL_LENGTH = 2048;
const GLOBAL_SEARCH_CACHE_MAX = 120;
const GLOBAL_SEARCH_FUSE_LIMIT = 80;
const NORMALIZE_CACHE_LIMIT = 8000;
let normalizeHeadCache = new Map();
let globalSearchCache = new Map();
let globalSearchFuse = null;
let globalSearchFuseSignature = '';
let globalSearchFuseDisabled = false;
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
let contextEntityLinkEntriesCache = null;
let subjectCrosslinksLookupCache = null;
let reverseEdgesCache = null;
const CYRILLIC_TO_LATIN_MAP = Object.freeze({
  '\u0430': 'a',    // а
  '\u0431': 'b',    // б
  '\u0432': 'v',    // в
  '\u0433': 'g',    // г
  '\u0434': 'd',    // д
  '\u0435': 'e',    // е
  '\u0451': 'yo',   // ё
  '\u0436': 'zh',   // ж
  '\u0437': 'z',    // з
  '\u0438': 'i',    // и
  '\u0439': 'y',    // й
  '\u043a': 'k',    // к
  '\u043b': 'l',    // л
  '\u043c': 'm',    // м
  '\u043d': 'n',    // н
  '\u043e': 'o',    // о
  '\u043f': 'p',    // п
  '\u0440': 'r',    // р
  '\u0441': 's',    // с
  '\u0442': 't',    // т
  '\u0443': 'u',    // у
  '\u0444': 'f',    // ф
  '\u0445': 'kh',   // х
  '\u0446': 'ts',   // ц
  '\u0447': 'ch',   // ч
  '\u0448': 'sh',   // ш
  '\u0449': 'shch', // щ
  '\u044a': '',     // ъ
  '\u044b': 'y',    // ы
  '\u044c': '',     // ь
  '\u044d': 'e',    // э
  '\u044e': 'yu',   // ю
  '\u044f': 'ya',   // я
  '\u0456': 'i',    // і
  '\u0457': 'yi',   // ї
  '\u0454': 'ye',   // є
  '\u0491': 'g',    // ґ
});

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

function getTotalBookPages() {
  return Math.max(1, parseInt(APP_DATA?.book_stats?.total_pages || 404, 10) || 404);
}

function normalizeKwicSource(source) {
  return source === 'glossary' ? 'glossary' : 'lexicon';
}

function normalizeKwicSort(mode) {
  return ['left', 'right', 'page'].includes(mode) ? mode : 'left';
}

function clampPageInBook(value) {
  const total = getTotalBookPages();
  const raw = Number.isFinite(value) ? value : parseInt(String(value || ''), 10);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(total, raw));
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

const ACCENT_SAFE_TOKEN_RE = /([^\s,;()[\]{}<>]+[\u0300-\u036f][^\s,;()[\]{}<>]*)/g;

function wrapAccentSafeInEscapedText(escapedText) {
  return String(escapedText || '').replace(ACCENT_SAFE_TOKEN_RE, '<span class="accent-safe">$1</span>');
}

function renderAccentSafe(s) {
  return wrapAccentSafeInEscapedText(escapeHtml(s));
}

function renderAccentSafeInHtmlTextNodes(html) {
  return String(html || '').replace(/(^|>)([^<>]+)(?=<|$)/g, (match, prefix, textPart) => {
    return `${prefix}${wrapAccentSafeInEscapedText(textPart)}`;
  });
}

function escapeRegexLiteral(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildContextLinkMatchTerms(head) {
  const raw = String(head || '').trim();
  if (!raw) return [];
  const variants = new Set([raw]);
  const simpleWord = /^[A-Za-zА-Яа-яЁё]+$/u.test(raw);
  if (!simpleWord) return Array.from(variants);

  if (/ь$/iu.test(raw)) {
    const stem = raw.slice(0, -1);
    if (stem) {
      variants.add(`${stem}и`);
      variants.add(`${stem}е`);
      variants.add(`${stem}ю`);
      variants.add(`${stem}ью`);
    }
  }

  if (/т$/iu.test(raw)) {
    variants.add(`${raw}а`);
    variants.add(`${raw}у`);
    variants.add(`${raw}е`);
    variants.add(`${raw}ом`);
  }

  if (/(ий|ой)$/iu.test(raw)) {
    const stem = raw.slice(0, -2);
    if (stem.length >= 3) {
      variants.add(`${stem}ого`);
      variants.add(`${stem}ому`);
      variants.add(`${stem}ым`);
      variants.add(`${stem}ом`);
      variants.add(`${stem}ая`);
      variants.add(`${stem}ую`);
      variants.add(`${stem}ое`);
      variants.add(`${stem}ые`);
      variants.add(`${stem}ых`);
      variants.add(`${stem}ыми`);
    }
  }

  return Array.from(variants);
}

function getContextEntityLinkEntries() {
  if (Array.isArray(contextEntityLinkEntriesCache) && contextEntityLinkEntriesCache.length) {
    return contextEntityLinkEntriesCache;
  }
  const out = [];
  const seen = new Set();
  const sources = [
    ['names', 'names'],
    ['toponyms', 'toponyms'],
    ['ethnonyms', 'ethnonyms'],
    ['languages', 'languages'],
  ];
  for (const [dataKey, entityType] of sources) {
    const list = Array.isArray(APP_DATA && APP_DATA[dataKey]) ? APP_DATA[dataKey] : [];
    for (const it of list) {
      const head = String(it && it.head ? it.head : '').trim();
      if (!head) continue;
      const matchTerms = buildContextLinkMatchTerms(head);
      for (const term of matchTerms) {
        const norm = normalizeHeadForMatch(term);
        if (!norm) continue;
        const uniq = `${entityType}::${norm}`;
        if (seen.has(uniq)) continue;
        seen.add(uniq);
        out.push({
          type: entityType,
          head,
          matchText: term,
          norm,
          length: term.length,
        });
      }
    }
  }
  out.sort((a, b) => (b.length - a.length) || compareHeadsRu(a.head, b.head));
  contextEntityLinkEntriesCache = out;
  return out;
}

function isContextLinkWordChar(ch) {
  return /[A-Za-zА-Яа-яЁё0-9]/.test(String(ch || ''));
}

function hasContextLinkBoundaries(text, start, end) {
  const prev = start > 0 ? text[start - 1] : '';
  const next = end < text.length ? text[end] : '';
  if (prev && isContextLinkWordChar(prev)) return false;
  if (next && isContextLinkWordChar(next)) return false;
  return true;
}

function autoLinkEntitiesPlain(rawText) {
  const text = String(rawText || '');
  if (!text) return '';
  const entries = getContextEntityLinkEntries();
  if (!entries.length) return renderAccentSafe(text);
  const occupied = new Array(text.length).fill(false);
  const matches = [];
  for (const entry of entries) {
    let re = null;
    try {
      re = new RegExp(escapeRegexLiteral(entry.matchText || entry.head || ''), 'giu');
    } catch (e) {
      continue;
    }
    let m = null;
    while ((m = re.exec(text)) !== null) {
      const value = String(m[0] || '');
      if (!value) break;
      const start = m.index;
      const end = start + value.length;
      if (start < 0 || end <= start || end > text.length) continue;
      if (!hasContextLinkBoundaries(text, start, end)) continue;
      let overlap = false;
      for (let i = start; i < end; i++) {
        if (occupied[i]) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;
      for (let i = start; i < end; i++) occupied[i] = true;
      matches.push({ start, end, value, entry });
    }
  }
  if (!matches.length) return renderAccentSafe(text);
  matches.sort((a, b) => a.start - b.start);
  let html = '';
  let cursor = 0;
  for (const hit of matches) {
    if (hit.start > cursor) html += renderAccentSafe(text.slice(cursor, hit.start));
    const href = buildItemHash(hit.entry.type, hit.entry.head);
    html += `<a href="${escapeHtml(href)}" class="ctx-link" data-type="${escapeHtml(hit.entry.type)}" data-head="${escapeHtml(hit.entry.head)}">${renderAccentSafe(hit.value)}</a>`;
    cursor = hit.end;
  }
  if (cursor < text.length) html += renderAccentSafe(text.slice(cursor));
  return html;
}

function autoLinkEntities(text) {
  const raw = String(text || '');
  if (!raw) return '';
  const anchorTagRe = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let html = '';
  let cursor = 0;
  let m = null;
  while ((m = anchorTagRe.exec(raw)) !== null) {
    const start = m.index;
    const full = String(m[0] || '');
    if (start > cursor) html += autoLinkEntitiesPlain(raw.slice(cursor, start));
    html += full;
    cursor = start + full.length;
  }
  if (cursor < raw.length) html += autoLinkEntitiesPlain(raw.slice(cursor));
  return html;
}

function getPreferredContextSplitIndex(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw || raw.startsWith('…')) return -1;
  if (raw.length < 68 || raw.length > 170) return -1;
  const dashMatch = raw.match(/\s+—\s+/u);
  if (!dashMatch || typeof dashMatch.index !== 'number') return -1;
  const splitIdx = dashMatch.index + 1;
  const leftLen = splitIdx;
  const rightLen = raw.length - splitIdx;
  if (leftLen < 28 || rightLen < 24) return -1;
  return splitIdx;
}

function renderContextTextWithLinks(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const splitIdx = getPreferredContextSplitIndex(raw);
  if (splitIdx < 1 || splitIdx >= raw.length) {
    return autoLinkEntities(raw);
  }
  const left = raw.slice(0, splitIdx).trimEnd();
  const right = raw.slice(splitIdx).trimStart();
  if (!left || !right) return autoLinkEntities(raw);
  return `${autoLinkEntities(left)}<br class="context-balance-break"><span class="context-line-two">${autoLinkEntities(right)}</span>`;
}

function highlightInContext(text, head) {
  if (!head) return renderAccentSafe(text);
  const parts = head.split(/[\s,]/);
  const surname = parts[0];
  if (!surname || surname.length < 3) return renderAccentSafe(text);
  const stem = surname.length > 5 ? surname.slice(0, -2) : surname;
  const escStem = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const re = new RegExp(escStem + '[А-Яа-яёЁA-Za-z]{0,5}', 'gi');
    const highlighted = escapeHtml(text).replace(re, m => '<mark>' + m + '</mark>');
    return renderAccentSafeInHtmlTextNodes(highlighted);
  } catch (e) {
    return renderAccentSafe(text);
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

function countItemMentions(it) {
  return Array.isArray(it && it.page_list) ? it.page_list.length : 0;
}

function getListFrequencyBounds(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { min: LIST_FREQ_MIN_DEFAULT, max: LIST_FREQ_MIN_DEFAULT };
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const it of list) {
    const count = countItemMentions(it);
    if (count < min) min = count;
    if (count > max) max = count;
  }
  if (!Number.isFinite(min)) min = LIST_FREQ_MIN_DEFAULT;
  if (!Number.isFinite(max) || max < min) max = min;
  return { min, max };
}

function clampListFrequencyValue(value, min, max, fallback) {
  const parsed = Number.isFinite(value) ? value : parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  const lo = Number.isFinite(min) ? min : LIST_FREQ_MIN_DEFAULT;
  const hi = Number.isFinite(max) ? max : Math.max(lo, LIST_FREQ_MAX_DEFAULT);
  return Math.max(lo, Math.min(hi, parsed));
}

function sortUniquePages(pages) {
  const uniq = new Set();
  for (const raw of Array.isArray(pages) ? pages : []) {
    const page = Number.isFinite(raw) ? raw : parseInt(String(raw || ''), 10);
    if (!Number.isFinite(page) || page <= 0) continue;
    uniq.add(page);
  }
  return Array.from(uniq).sort((a, b) => a - b);
}

function buildCardPageLinksHtml(pages, maxLinks = 28) {
  const list = sortUniquePages(pages);
  if (!list.length) return '';
  const shown = list.slice(0, Math.max(1, maxLinks));
  let html = shown.map((page) => {
    return `<a class="card-page-link related-link page-ref-link" data-page="${page}" href="${escapeHtml(buildReadingNowHash(page))}">стр. ${page}</a>`;
  }).join(', ');
  const hiddenCount = list.length - shown.length;
  if (hiddenCount > 0) html += ` <span style="color:#888;">и ещё ${hiddenCount}</span>`;
  return html;
}

function renderTextWithPageLinks(text, options = {}) {
  const raw = String(text == null ? '' : text);
  if (!raw) return '';
  const classNameRaw = String(options.className || 'card-page-link related-link');
  const className = /\bpage-ref-link\b/.test(classNameRaw) ? classNameRaw : `${classNameRaw} page-ref-link`;
  const style = (typeof options.style === 'string')
    ? options.style
    : 'text-decoration:underline dotted;color:#5a3818;';
  const rangeTarget = String(options.rangeTarget || 'trends');
  const matcher = /\b\u0441\u0442\u0440\.?\s*(\d{1,4})(?:\s*[\u2013\u2014-]\s*(\d{1,4}))?/giu;
  let out = '';
  let cursor = 0;
  let match = null;
  while ((match = matcher.exec(raw)) !== null) {
    const hit = String(match[0] || '');
    const idx = Number.isFinite(match.index) ? match.index : raw.indexOf(hit, cursor);
    if (idx > cursor) out += escapeHtml(raw.slice(cursor, idx));
    const startRaw = parseInt(String(match[1] || ''), 10);
    const endRaw = match[2] ? parseInt(String(match[2] || ''), 10) : startRaw;
    const start = clampPageInBook(Number.isFinite(startRaw) ? startRaw : 1);
    const end = clampPageInBook(Number.isFinite(endRaw) ? endRaw : start);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const hasRange = hi > lo;
    const href = (hasRange && rangeTarget === 'trends')
      ? buildCanonicalHash(['scholar', 'page_trends', 'range', String(lo), String(hi)])
      : buildReadingNowHash(lo);
    out += `<a class="${escapeHtml(className)}" data-page="${lo}"${hasRange ? ` data-page-end="${hi}"` : ''} href="${escapeHtml(href)}"${style ? ` style="${escapeHtml(style)}"` : ''}>${escapeHtml(hit)}</a>`;
    cursor = idx + hit.length;
  }
  if (cursor < raw.length) out += escapeHtml(raw.slice(cursor));
  return out;
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
    listFrequencyMin,
    listFrequencyMax,
    onlyDiscussed,
    onlyQuestionCandidates,
    currentGlossaryTerm,
    currentScholarAnchor,
    currentKwicSource,
    currentKwicQuery,
    currentKwicSort,
    currentKwicPageStart,
    currentKwicPageEnd,
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
    if (!Number.isInteger(parsed.listFrequencyMin)) parsed.listFrequencyMin = LIST_FREQ_MIN_DEFAULT;
    if (!Number.isInteger(parsed.listFrequencyMax)) parsed.listFrequencyMax = LIST_FREQ_MAX_DEFAULT;
    parsed.listFrequencyMin = Math.max(LIST_FREQ_MIN_DEFAULT, parsed.listFrequencyMin);
    parsed.listFrequencyMax = Math.max(parsed.listFrequencyMin, parsed.listFrequencyMax);
    if (typeof parsed.currentGlossaryTerm !== 'string') parsed.currentGlossaryTerm = '';
    if (typeof parsed.currentScholarAnchor !== 'string') parsed.currentScholarAnchor = '';
    parsed.currentKwicSource = normalizeKwicSource(parsed.currentKwicSource);
    parsed.currentKwicQuery = typeof parsed.currentKwicQuery === 'string'
      ? clampUiInput(parsed.currentKwicQuery, MAX_LIST_QUERY_LENGTH)
      : '';
    parsed.currentKwicSort = normalizeKwicSort(parsed.currentKwicSort);
    parsed.currentKwicPageStart = parsed.currentKwicPageStart == null
      ? 1
      : clampPageInBook(parsed.currentKwicPageStart);
    parsed.currentKwicPageEnd = parsed.currentKwicPageEnd == null
      ? getTotalBookPages()
      : clampPageInBook(parsed.currentKwicPageEnd);
    if (parsed.currentKwicPageStart > parsed.currentKwicPageEnd) {
      const a = parsed.currentKwicPageStart;
      parsed.currentKwicPageStart = parsed.currentKwicPageEnd;
      parsed.currentKwicPageEnd = a;
    }
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

function createEmptyTasksProgress() {
  return {
    version: TASKS_PROGRESS_SCHEMA_VERSION,
    totalAnswered: 0,
    totalCorrect: 0,
    byTask: {},
    history: [],
  };
}

function hashString32(text) {
  const src = String(text || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

function getTaskStorageId(task, fallbackIndex = 0) {
  const existing = String(task && task._storageId ? task._storageId : '').trim();
  if (existing) return existing.slice(0, 120);
  const preferred = String(task && task.id ? task.id : '').trim();
  if (preferred) return preferred.slice(0, 120);
  const question = String(task && task.question ? task.question : '');
  const options = Array.isArray(task && task.options) ? task.options.join('|') : '';
  const entityType = String(task && task.entity && task.entity.type ? task.entity.type : '');
  const entityHead = String(task && task.entity && task.entity.head ? task.entity.head : '');
  const entityIndex = String(task && task.entity && task.entity.index != null ? task.entity.index : '');
  const coreSeed = `${question}|${options}|${entityType}|${entityHead}|${entityIndex}`.trim();
  const seed = coreSeed || `idx:${fallbackIndex}`;
  return `task_${hashString32(seed).toString(36)}`;
}

function normalizeTasksProgress(raw) {
  const out = createEmptyTasksProgress();
  if (!raw || typeof raw !== 'object') return out;
  if (raw.version !== TASKS_PROGRESS_SCHEMA_VERSION) return out;
  const answered = parseInt(raw.totalAnswered || 0, 10);
  const correct = parseInt(raw.totalCorrect || 0, 10);
  out.totalAnswered = Math.max(0, Number.isFinite(answered) ? answered : 0);
  out.totalCorrect = Math.max(0, Math.min(out.totalAnswered, Number.isFinite(correct) ? correct : 0));

  const byTask = raw.byTask && typeof raw.byTask === 'object' && !Array.isArray(raw.byTask)
    ? raw.byTask
    : {};
  for (const [taskIdRaw, statRaw] of Object.entries(byTask)) {
    const taskId = String(taskIdRaw || '').trim().slice(0, 120);
    if (!taskId || !statRaw || typeof statRaw !== 'object') continue;
    const itemAnswered = parseInt(statRaw.answered || 0, 10);
    const itemCorrect = parseInt(statRaw.correct || 0, 10);
    const answeredSafe = Math.max(0, Number.isFinite(itemAnswered) ? itemAnswered : 0);
    const correctSafe = Math.max(0, Math.min(answeredSafe, Number.isFinite(itemCorrect) ? itemCorrect : 0));
    out.byTask[taskId] = { answered: answeredSafe, correct: correctSafe };
  }

  const history = Array.isArray(raw.history) ? raw.history : [];
  out.history = [];
  for (const row of history) {
    if (!row || typeof row !== 'object') continue;
    const taskId = String(row.taskId || '').trim().slice(0, 120);
    const question = String(row.question || '').trim().slice(0, 240);
    const selected = String(row.selected || '').trim().slice(0, 240);
    const correctAnswer = String(row.correctAnswer || '').trim().slice(0, 240);
    const at = Number.isFinite(row.at) ? row.at : parseInt(row.at || 0, 10);
    if (!taskId || !question || !Number.isFinite(at) || at <= 0) continue;
    out.history.push({
      taskId,
      question,
      selected,
      correctAnswer,
      isCorrect: row.isCorrect === true,
      at,
    });
    if (out.history.length >= TASKS_HISTORY_LIMIT) break;
  }
  return out;
}

function getStoredTasksProgress() {
  if (typeof localStorage === 'undefined') return createEmptyTasksProgress();
  try {
    const raw = localStorage.getItem(TASKS_PROGRESS_STORAGE_KEY);
    if (!raw) return createEmptyTasksProgress();
    return normalizeTasksProgress(JSON.parse(raw));
  } catch (e) {
    return createEmptyTasksProgress();
  }
}

function persistTasksProgress(progress) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TASKS_PROGRESS_STORAGE_KEY, JSON.stringify(normalizeTasksProgress(progress)));
  } catch (e) {}
}

function clearStoredTasksProgress() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(TASKS_PROGRESS_STORAGE_KEY);
  } catch (e) {}
}

function recordTaskAnswer(task, selectedOption, isCorrect) {
  const progress = getStoredTasksProgress();
  const taskId = getTaskStorageId(task, Number.isInteger(task && task._taskIndex) ? task._taskIndex : 0);
  const question = String(task && task.question ? task.question : '').trim().slice(0, 240);
  const selected = String(selectedOption || '').trim().slice(0, 240);
  const correctAnswer = Array.isArray(task && task.options) && Number.isInteger(task.correct)
    ? String(task.options[task.correct] || '').trim().slice(0, 240)
    : '';

  progress.totalAnswered += 1;
  if (isCorrect) progress.totalCorrect += 1;

  const slot = progress.byTask[taskId] || { answered: 0, correct: 0 };
  slot.answered += 1;
  if (isCorrect) slot.correct += 1;
  progress.byTask[taskId] = slot;

  progress.history.unshift({
    taskId,
    question,
    selected,
    correctAnswer,
    isCorrect: isCorrect === true,
    at: Date.now(),
  });
  if (progress.history.length > TASKS_HISTORY_LIMIT) {
    progress.history = progress.history.slice(0, TASKS_HISTORY_LIMIT);
  }
  persistTasksProgress(progress);
  return progress;
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

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
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
  listFrequencyMin = Number.isInteger(state.listFrequencyMin) ? state.listFrequencyMin : LIST_FREQ_MIN_DEFAULT;
  listFrequencyMax = Number.isInteger(state.listFrequencyMax) ? state.listFrequencyMax : LIST_FREQ_MAX_DEFAULT;
  listFrequencyMin = Math.max(LIST_FREQ_MIN_DEFAULT, listFrequencyMin);
  listFrequencyMax = Math.max(listFrequencyMin, listFrequencyMax);
  currentGlossaryTerm = typeof state.currentGlossaryTerm === 'string' ? state.currentGlossaryTerm : '';
  currentScholarAnchor = typeof state.currentScholarAnchor === 'string' ? state.currentScholarAnchor : '';
  currentKwicSource = normalizeKwicSource(state.currentKwicSource);
  currentKwicQuery = typeof state.currentKwicQuery === 'string'
    ? clampUiInput(state.currentKwicQuery, MAX_LIST_QUERY_LENGTH)
    : '';
  currentKwicSort = normalizeKwicSort(state.currentKwicSort);
  currentKwicPageStart = state.currentKwicPageStart == null
    ? 1
    : clampPageInBook(state.currentKwicPageStart);
  currentKwicPageEnd = state.currentKwicPageEnd == null
    ? getTotalBookPages()
    : clampPageInBook(state.currentKwicPageEnd);
  if (currentKwicPageStart > currentKwicPageEnd) {
    const a = currentKwicPageStart;
    currentKwicPageStart = currentKwicPageEnd;
    currentKwicPageEnd = a;
  }
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
    (a.currentKwicSource || 'lexicon') === (b.currentKwicSource || 'lexicon') &&
    (a.currentKwicQuery || '') === (b.currentKwicQuery || '') &&
    (a.currentKwicSort || 'left') === (b.currentKwicSort || 'left') &&
    (a.currentKwicPageStart || 1) === (b.currentKwicPageStart || 1) &&
    (a.currentKwicPageEnd || 404) === (b.currentKwicPageEnd || 404) &&
    (a.searchQuery || '') === (b.searchQuery || '') &&
    (a.listFrequencyMin || LIST_FREQ_MIN_DEFAULT) === (b.listFrequencyMin || LIST_FREQ_MIN_DEFAULT) &&
    (a.listFrequencyMax || LIST_FREQ_MAX_DEFAULT) === (b.listFrequencyMax || LIST_FREQ_MAX_DEFAULT) &&
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

function decodeBreadcrumbRouteParts(routeHash) {
  const hash = String(routeHash || '').trim();
  if (!hash || hash === '#') return [];
  const rawParts = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (!rawParts.length) return [];
  const decoded = [];
  for (const part of rawParts) {
    try {
      decoded.push(decodeURIComponent(part));
    } catch (e) {
      decoded.push(part);
    }
  }
  return decoded[0] === HASH_ROUTE_PREFIX ? decoded.slice(1) : decoded;
}

function getEntityBreadcrumbLabel(entity) {
  const map = {
    home: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f',
    names: '\u0418\u043c\u0435\u043d\u0430',
    toponyms: '\u0422\u043e\u043f\u043e\u043d\u0438\u043c\u044b',
    ethnonyms: '\u042d\u0442\u043d\u043e\u043d\u0438\u043c\u044b',
    languages: '\u042f\u0437\u044b\u043a\u0438',
    lexicon: '\u041b\u0435\u043a\u0441\u0438\u043a\u0430',
    lexicon_reverse: '\u041b\u0435\u043a\u0441\u0438\u043a\u0430 (\u043e\u0431\u0440\u0430\u0442\u043d\u0430\u044f)',
    lexicon_tech: '\u0420\u0435\u043a\u043e\u043d\u0441\u0442\u0440\u0443\u043a\u0446\u0438\u0438',
    subject: '\u041f\u0440\u0435\u0434\u043c\u0435\u0442\u043d\u044b\u0439 \u0443\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c',
    materials: '\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b',
    scholar: '\u041f\u0440\u043e\u0444\u0435\u0441\u0441\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u0430\u043f\u043f\u0430\u0440\u0430\u0442',
    all: '\u0421\u0432\u043e\u0434\u043d\u044b\u0439 \u0443\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c',
  };
  if (map[entity]) return map[entity];
  if (ENTITY_TYPES[entity] && ENTITY_TYPES[entity].title) return ENTITY_TYPES[entity].title;
  return String(entity || '');
}

function getTabBreadcrumbLabel(entity, tab) {
  if (!entity || !tab) return '';
  if (entity === 'materials' && tab === 'kwic') return 'KWIC';
  return TAB_LABELS[tab] || '';
}

function buildBreadcrumbTrail(routeHash) {
  const parts = decodeBreadcrumbRouteParts(routeHash);
  const entity = parts[0] || currentEntity || 'home';
  const tab = parts[1] || (ENTITY_TYPES[entity] && ENTITY_TYPES[entity].tabs ? ENTITY_TYPES[entity].tabs[0] : 'home');
  const trail = [];
  const homeHash = buildCanonicalHash(['home', 'home']);

  if (entity === 'home' && tab === 'home') {
    trail.push({ label: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f' });
    return trail;
  }

  trail.push({ label: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f', href: homeHash });

  const entityHash = buildCanonicalHash([entity, entity === 'home' ? 'home' : 'list']);
  trail.push({ label: getEntityBreadcrumbLabel(entity), href: entityHash });

  if (entity === 'materials' || entity === 'scholar') {
    const tabLabel = getTabBreadcrumbLabel(entity, tab);
    if (tabLabel) trail.push({ label: tabLabel, href: buildCanonicalHash([entity, tab]) });
  }

  const itemPos = parts.indexOf('item');
  if (itemPos >= 0 && parts[itemPos + 1] && parts[itemPos + 2]) {
    const itemType = ENTITY_TYPES[parts[itemPos + 1]] ? parts[itemPos + 1] : entity;
    const encodedHead = parts[itemPos + 2];
    const resolvedHead = resolveItemHeadFromHash(itemType, encodedHead) || encodedHead;
    trail.push({ label: resolvedHead });
  }

  if (trail.length > 1) {
    trail[trail.length - 1].href = '';
  }

  return trail;
}

function renderBreadcrumb(routeHash) {
  const host = document.getElementById('breadcrumb-nav') || document.getElementById('breadcrumbs');
  if (!host) return;
  const sourceHash = String(routeHash || ((typeof window !== 'undefined' && window.location) ? window.location.hash : '') || buildHashFromState());
  const model = buildBreadcrumbTrail(sourceHash);
  host.innerHTML = '';
  if (!model.length) {
    host.style.display = 'none';
    return;
  }
  host.style.display = '';

  model.forEach((crumb, idx) => {
    const isLast = idx === model.length - 1;
    if (!isLast && crumb.href) {
      const link = document.createElement('a');
      link.className = 'breadcrumb-link';
      link.href = crumb.href;
      link.textContent = crumb.label || '';
      host.appendChild(link);
    } else {
      const current = document.createElement('span');
      current.className = 'breadcrumb-current';
      current.textContent = crumb.label || '';
      host.appendChild(current);
    }
    if (!isLast) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '\u203a';
      host.appendChild(sep);
    }
  });
}

function renderBreadcrumbs(routeHash) {
  renderBreadcrumb(routeHash);
}

function encodeHashPart(value) {
  return encodeURIComponent(String(value));
}

function buildCanonicalHash(parts) {
  const safeParts = [HASH_ROUTE_PREFIX, ...(Array.isArray(parts) ? parts : [])];
  return '#' + safeParts.map(encodeHashPart).join('/');
}

function buildHashFromState() {
  const parts = [currentEntity, currentTab];
  if (currentEntity === 'materials' && currentTab === 'lectures') {
    const readingPage = getSavedReadingPage();
    if (Number.isFinite(readingPage)) {
      parts.push('reading', String(clampPageInBook(readingPage)));
    }
  }
  if (currentEntity === 'materials' && currentTab === 'lecture_pages') {
    parts.push(String(Math.max(0, currentLecture)));
  }
  if (currentEntity === 'materials' && currentTab === 'glossary' && currentGlossaryTerm) {
    parts.push('term', currentGlossaryTerm);
  }
  if (currentEntity === 'scholar' && currentTab === 'scholar' && currentScholarAnchor) {
    parts.push('anchor', currentScholarAnchor);
  }
  if (currentEntity === 'scholar' && currentTab === 'page_trends') {
    const start = clampPageInBook(trendsRangeStart);
    const end = clampPageInBook(trendsRangeEnd);
    parts.push('range', String(Math.min(start, end)), String(Math.max(start, end)));
  }
  if (currentTab === 'list' && searchQuery && !selectedItem) {
    parts.push('q', searchQuery);
  }
  if (selectedItem && rightPaneMode === 'card') {
    const itemType = selectedItemType || currentEntity;
    const itemHashHead = encodeItemHeadForHash(itemType, selectedItem);
    parts.push('item', itemType, itemHashHead);
  }
  return buildCanonicalHash(parts);
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
  const canonicalHash = buildHashFromState();
  const canonicalUrl = (() => {
    if (typeof window === 'undefined' || !window.location) return canonicalHash;
    const href = String(window.location.href || '');
    const hashPos = href.indexOf('#');
    const base = hashPos >= 0 ? href.slice(0, hashPos) : href;
    return base + canonicalHash;
  })();
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      return true;
    } catch (e) {}
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = canonicalUrl;
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
  renderBreadcrumbs(buildHashFromState());
  persistViewState();
  if (suppressHashSync) return;
  if (typeof window === 'undefined' || !window.location) return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    expectedHash = nextHash;
    window.location.hash = nextHash;
  }
}

function syncNavigationHashOnly() {
  const prev = isNavigatingHistory;
  isNavigatingHistory = true;
  syncNavigationState();
  isNavigatingHistory = prev;
}

function applyHash(hash) {
  closeGlobalSearchResults();
  if (!hash || hash === '#') return false;
  const rawParts = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (rawParts.length > MAX_HASH_PARTS + 1) return false;
  if (!rawParts.length) return false;
  const decodedParts = [];
  for (const p of rawParts) {
    let decoded = '';
    try { decoded = decodeURIComponent(p); } catch (e) { decoded = p; }
    decoded = String(decoded || '');
    if (decoded.length > MAX_HASH_PART_LENGTH) return false;
    decodedParts.push(decoded);
  }
  const parts = decodedParts[0] === HASH_ROUTE_PREFIX ? decodedParts.slice(1) : decodedParts;
  if (!parts.length || parts.length > MAX_HASH_PARTS) return false;

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
    trendsRangeStart: 1,
    trendsRangeEnd: getTotalBookPages(),
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
  if (entity === 'materials' && tab === 'lectures') {
    const readingPos = parts.indexOf('reading');
    if (readingPos >= 0 && /^\d+$/.test(parts[readingPos + 1] || '')) {
      saveReadingPage(clampPageInBook(parseInt(parts[readingPos + 1], 10)));
    }
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
  if (entity === 'scholar' && tab === 'page_trends') {
    const rangePos = parts.indexOf('range');
    if (rangePos >= 0 && /^\d+$/.test(parts[rangePos + 1] || '') && /^\d+$/.test(parts[rangePos + 2] || '')) {
      state.trendsRangeStart = clampPageInBook(parseInt(parts[rangePos + 1], 10));
      state.trendsRangeEnd = clampPageInBook(parseInt(parts[rangePos + 2], 10));
      if (state.trendsRangeStart > state.trendsRangeEnd) {
        [state.trendsRangeStart, state.trendsRangeEnd] = [state.trendsRangeEnd, state.trendsRangeStart];
      }
    }
  }
  if (tab === 'list' && queryPos >= 0 && parts[queryPos + 1]) {
    state.searchQuery = clampUiInput(parts[queryPos + 1], MAX_LIST_QUERY_LENGTH);
  }

  if (itemPos >= 0 && parts[itemPos + 1] && parts[itemPos + 2]) {
    const itemType = ENTITY_TYPES[parts[itemPos + 1]] ? parts[itemPos + 1] : state.currentEntity;
    const resolvedHead = resolveItemHeadFromHash(itemType, parts[itemPos + 2]);
    state.currentEntity = itemType;
    state.currentTab = 'list';
    state.selectedItemType = itemType;
    state.selectedItem = resolvedHead || clampUiInput(parts[itemPos + 2], MAX_HASH_PART_LENGTH);
    state.rightPaneMode = 'card';
  }

  applyViewState(state);
  if (!isNavigatingHistory) pushHistoryState();
  updateBackButton();
  renderBreadcrumbs(hash);
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
  return buildCanonicalHash(['materials', 'lecture_pages', String(idx)]);
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
  if (!q) return buildCanonicalHash(['materials', 'glossary']);
  return buildCanonicalHash(['materials', 'glossary', 'term', q]);
}

function buildListSearchHash(entity, query) {
  const e = ENTITY_TYPES[entity] ? entity : 'all';
  const q = String(query || '').trim();
  if (!q) return buildCanonicalHash([e, 'list']);
  return buildCanonicalHash([e, 'list', 'q', q]);
}

function buildItemHash(type, head) {
  const t = ENTITY_TYPES[type] ? type : 'all';
  const encodedHead = encodeItemHeadForHash(t, head);
  return buildCanonicalHash([t, 'list', 'item', t, encodedHead]);
}

function buildScholarAnchorHash(anchorId) {
  const safeAnchor = String(anchorId || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
  if (!safeAnchor) return buildCanonicalHash(['scholar', 'scholar']);
  return buildCanonicalHash(['scholar', 'scholar', 'anchor', safeAnchor]);
}

function buildLectureTermHash(term) {
  const raw = String(term || '').trim();
  if (!raw) return buildCanonicalHash(['materials', 'glossary']);
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

function getGlobalSearchMatchesLegacy(query) {
  const q = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH).toLowerCase();
  const qNorm = normalizeSearchText(q);
  if (q.length < 2) return [];
  const searchKey = `${getDataSignature()}::${q}`;
  const cached = globalSearchCache.get(searchKey);
  if (cached) return cached;
  const out = [];
  const push = (kind, type, head, meta, lectureIndex, snippet, routeHash = '') => {
    if (!head) return;
    const score = head.toLowerCase().startsWith(q) ? 0 : 1;
    out.push({ kind, type, head, meta, lectureIndex, snippet, routeHash, score });
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

  if (qNorm.length >= 2) {
    const routeRecords = buildGlobalSearchRouteRecords();
    for (const route of routeRecords) {
      const hay = `${route.searchHead || ''} ${route.searchSecondary || ''}`.trim();
      if (!hay || !hay.includes(qNorm)) continue;
      push(route.kind, route.type, route.head, route.meta, null, route.snippet, route.routeHash || '');
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

function resetGlobalSearchFuseState() {
  globalSearchFuse = null;
  globalSearchFuseSignature = '';
  globalSearchFuseDisabled = false;
}

function normalizeSearchText(value) {
  return normalizeHeadForMatch(value).replace(/\s+/g, ' ').trim();
}

function buildGlobalSearchSecondaryForItem(item) {
  const parts = [];
  if (!item || typeof item !== 'object') return '';
  if (Array.isArray(item.subs) && item.subs.length) parts.push(item.subs.join(' '));
  if (Array.isArray(item.synonyms) && item.synonyms.length) parts.push(item.synonyms.join(' '));
  if (Array.isArray(item.aliases) && item.aliases.length) parts.push(item.aliases.join(' '));
  if (item.category) parts.push(item.category);
  if (item.subcategory) parts.push(item.subcategory);
  if (item.family) parts.push(item.family);
  if (item.group) parts.push(item.group);
  const quote = getFirstContextQuote(item);
  if (quote) parts.push(quote);
  return normalizeSearchText(parts.join(' '));
}

function buildGlobalSearchRouteRecords() {
  if (!ENTITY_TYPES) return [];
  const records = [];
  const seenHashes = new Set();
  const routeAliases = {
    'home/home': ['главная', 'домашняя панель', 'kpi', 'обзор'],
    'materials/lectures': ['лекции', 'содержание лекций'],
    'materials/lecture_compare': ['сравнение лекций', 'сопоставление лекций'],
    'materials/lecture_pages': ['страница лекции', 'лекция по страницам'],
    'materials/further_reading': ['что почитать еще', 'дополнительное чтение', 'рекомендуемая литература'],
    'materials/glossary': ['глоссарий', 'термины'],
    'materials/kwic': ['kwic', 'конкорданс', 'контексты'],
    'materials/gallery': ['галерея лингвистов'],
    'materials/russian_evolution': ['русский во времени', 'эволюция русского'],
    'materials/phonetic_laws': ['фонетические законы', 'историческая фонетика'],
    'materials/tasks': ['проверьте себя', 'тест', 'викторина'],
    'scholar/scholar': ['профессиональный аппарат', 'аппарат для специалистов'],
    'scholar/chronology': ['хронология открытий', 'лингвистические открытия'],
    'scholar/page_trends': ['динамика по страницам', 'тренды по страницам'],
  };

  const pushRoute = ({ head, routeHash, meta = 'раздел интерфейса', snippet = '', aliases = [], kind = 'раздел' }) => {
    const hash = String(routeHash || '').trim();
    if (!head || !hash || seenHashes.has(hash)) return;
    const searchHead = normalizeSearchText(head);
    if (!searchHead) return;
    seenHashes.add(hash);
    const searchSecondary = normalizeSearchText([
      meta,
      snippet,
      hash.replace(/^#/, '').replace(/[\/_]+/g, ' '),
      ...(Array.isArray(aliases) ? aliases : []),
    ].join(' '));
    records.push({
      kind,
      type: 'route',
      head,
      meta,
      lectureIndex: null,
      snippet,
      routeHash: hash,
      searchHead,
      searchSecondary,
    });
  };

  for (const [entityKey, conf] of Object.entries(ENTITY_TYPES || {})) {
    if (!conf || !Array.isArray(conf.tabs) || !conf.tabs.length) continue;
    const entityTitle = String(conf.title || entityKey || '').trim();
    for (const tab of conf.tabs) {
      const tabLabel = String(TAB_LABELS[tab] || tab || '').trim();
      if (!tabLabel) continue;
      const routeKey = `${entityKey}/${tab}`;
      const routeHash = buildCanonicalHash([entityKey, tab]);
      const head = routeKey === 'home/home'
        ? entityTitle
        : `${entityTitle}: ${tabLabel}`;
      const aliases = [
        entityKey,
        tab,
        entityTitle,
        tabLabel,
        ...(routeAliases[routeKey] || []),
      ];
      pushRoute({
        head,
        routeHash,
        meta: 'раздел интерфейса',
        snippet: `${entityTitle} / ${tabLabel}`,
        aliases,
      });
    }
  }

  const scholarSections = [
    { id: 'sch-biblio', title: 'Библиография работ Зализняка', aliases: ['библиография', 'работы зализняка'] },
    { id: 'sch-extended_cards', title: 'Ключевые лингвисты', aliases: ['лингвисты', 'карточки лингвистов'] },
    { id: 'sch-controversies', title: 'Спорные вопросы', aliases: ['дискуссии', 'спорные места'] },
    { id: 'sch-original', title: 'Оригинальные формы по языкам', aliases: ['оригинальные формы', 'формы по языкам'] },
    { id: 'sch-birch', title: 'Конкорданс берестяных грамот', aliases: ['берестяные грамоты', 'конкорданс грамот'] },
    { id: 'sch-chronology', title: 'Хронология лингвистических открытий', aliases: ['хронология', 'открытия'] },
    { id: 'sch-isoglosses', title: 'Изоглоссы русских диалектов', aliases: ['изоглоссы', 'диалекты'] },
    { id: 'sch-slovo', title: 'Подлинность «Слова о полку Игореве»', aliases: ['слово о полку игореве', 'подлинность слова'] },
    { id: 'sch-accents', title: 'Акцентологические парадигмы', aliases: ['акцентные парадигмы', 'акцентология', 'ударение'] },
    { id: 'sch-correspondences', title: 'Фонетические соответствия', aliases: ['сравнительная таблица', 'фонетическая таблица'] },
    { id: 'sch-reconstructions', title: 'Реконструкции', aliases: ['исторические реконструкции'] },
  ];
  for (const section of scholarSections) {
    pushRoute({
      head: `Профессиональный аппарат: ${section.title}`,
      routeHash: buildCanonicalHash(['scholar', 'scholar', 'anchor', section.id]),
      meta: 'секция раздела',
      snippet: `Профессиональный аппарат / ${section.title}`,
      aliases: [
        'профессиональный аппарат',
        section.id,
        section.id.replace(/^sch-/, '').replace(/[_-]+/g, ' '),
        ...(section.aliases || []),
      ],
    });
  }
  return records;
}

function buildGlobalSearchFuseRecords() {
  if (!APP_DATA) return [];
  const records = [];
  const typedSources = [
    { type: 'names', kind: LABELS && LABELS.name ? LABELS.name : 'name', items: APP_DATA.names || [] },
    { type: 'toponyms', kind: LABELS && LABELS.place ? LABELS.place : 'toponym', items: APP_DATA.toponyms || [] },
    { type: 'ethnonyms', kind: LABELS && LABELS.ethnos ? LABELS.ethnos : 'ethnonym', items: APP_DATA.ethnonyms || [] },
    { type: 'languages', kind: LABELS && LABELS.language ? LABELS.language : 'language', items: APP_DATA.languages || [] },
    { type: 'lexicon', kind: LABELS && LABELS.lexeme ? LABELS.lexeme : 'lexeme', items: APP_DATA.lexicon || [] },
    { type: 'subject', kind: LABELS && LABELS.subject ? LABELS.subject : 'subject', items: APP_DATA.subject_index || [] },
  ];
  for (const src of typedSources) {
    for (const it of src.items) {
      const head = String(it && it.head ? it.head : '').trim();
      if (!head) continue;
      const searchHead = normalizeSearchText(head);
      if (!searchHead) continue;
      const pageCount = Array.isArray(it.page_list) ? it.page_list.length : 0;
      records.push({
        kind: src.kind,
        type: src.type,
        head,
        meta: pageCount ? `${pageCount} \u0441\u0442\u0440.` : '',
        lectureIndex: null,
        snippet: getFirstContextQuote(it),
        searchHead,
        searchSecondary: buildGlobalSearchSecondaryForItem(it),
      });
    }
  }

  const glossary = APP_DATA.glossary || [];
  for (const g of glossary) {
    const term = String(g && g.term ? g.term : '').trim();
    if (!term) continue;
    const definition = String(g.definition || '').trim();
    const searchHead = normalizeSearchText(term);
    if (!searchHead) continue;
    records.push({
      kind: '\u0442\u0435\u0440\u043c\u0438\u043d',
      type: 'glossary',
      head: term,
      meta: '\u0433\u043b\u043e\u0441\u0441\u0430\u0440\u0438\u0439',
      lectureIndex: null,
      snippet: definition,
      searchHead,
      searchSecondary: normalizeSearchText(definition),
    });
  }

  const lectures = APP_DATA.lectures || [];
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i] || {};
    const name = String(l.name || '').trim();
    if (!name) continue;
    const terms = Array.isArray(l.terms) ? l.terms.join(' ') : '';
    const facts = Array.isArray(l.key_facts) ? l.key_facts.join(' ') : '';
    const snippet = String(l.main_idea || '').trim();
    const searchHead = normalizeSearchText(name);
    if (!searchHead) continue;
    records.push({
      kind: '\u043b\u0435\u043a\u0446\u0438\u044f',
      type: 'lecture',
      head: name,
      meta: `\u0441\u0442\u0440. ${l.pages || ''}`,
      lectureIndex: i,
      snippet,
      searchHead,
      searchSecondary: normalizeSearchText([l.main_idea || '', terms, l.why_read || '', facts].join(' ')),
    });
  }
  const routeRecords = buildGlobalSearchRouteRecords();
  if (routeRecords.length) records.push(...routeRecords);
  return records;
}

function ensureGlobalSearchFuse() {
  if (globalSearchFuseDisabled) return false;
  if (typeof Fuse !== 'function') {
    globalSearchFuseDisabled = true;
    return false;
  }
  const signature = `${getDataSignature()}::${(APP_DATA && APP_DATA.glossary ? APP_DATA.glossary.length : 0)}::${(APP_DATA && APP_DATA.lectures ? APP_DATA.lectures.length : 0)}`;
  if (globalSearchFuse && globalSearchFuseSignature === signature) return true;
  try {
    const records = buildGlobalSearchFuseRecords();
    if (!records.length) return false;
    globalSearchFuse = new Fuse(records, {
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
    globalSearchFuseSignature = signature;
    return true;
  } catch (e) {
    globalSearchFuse = null;
    globalSearchFuseSignature = '';
    return false;
  }
}

function getGlobalSearchMatchesFuzzy(queryNorm) {
  if (!queryNorm || queryNorm.length < 2) return [];
  if (!ensureGlobalSearchFuse()) return [];
  const rows = globalSearchFuse.search(queryNorm, { limit: GLOBAL_SEARCH_FUSE_LIMIT });
  if (!rows.length) return [];
  const dedupe = new Set();
  const out = [];
  for (const row of rows) {
    const item = row && row.item ? row.item : null;
    if (!item || !item.head) continue;
    const key = `${item.type}::${item.head}::${item.lectureIndex === null ? '' : item.lectureIndex}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    let score = Number.isFinite(row.score) ? row.score : 1;
    const headNorm = item.searchHead || '';
    if (headNorm.startsWith(queryNorm)) score -= 0.12;
    else if (headNorm.includes(queryNorm)) score -= 0.06;
    out.push({
      kind: item.kind,
      type: item.type,
      head: item.head,
      meta: item.meta,
      lectureIndex: item.lectureIndex,
      snippet: item.snippet,
      routeHash: item.routeHash || '',
      score,
    });
  }
  out.sort((a, b) => a.score - b.score || compareHeadsRu(a.head, b.head));
  return out.slice(0, 40);
}

function getGlobalSearchMatches(query) {
  const qRaw = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH).toLowerCase();
  const qNorm = normalizeSearchText(qRaw);
  if (qNorm.length < 2) return [];
  const searchKey = `${getDataSignature()}::${qNorm}`;
  const cached = globalSearchCache.get(searchKey);
  if (cached) return cached;
  let matches = [];
  try {
    matches = getGlobalSearchMatchesFuzzy(qNorm);
  } catch (e) {
    matches = [];
  }
  if (!Array.isArray(matches) || !matches.length) {
    matches = getGlobalSearchMatchesLegacy(qRaw);
  }
  const sliced = Array.isArray(matches) ? matches.slice(0, 40) : [];
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
  else if (match.type === 'route' && match.routeHash) {
    const targetHashRaw = String(match.routeHash || '').trim();
    const targetHash = targetHashRaw.startsWith('#') ? targetHashRaw : `#${targetHashRaw}`;
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.hash === targetHash) {
        applyHash(targetHash);
      } else {
        applyHash(targetHash);
        expectedHash = targetHash;
        window.location.hash = targetHash;
      }
    } else {
      applyHash(targetHash);
    }
  }
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

function registerAppServiceWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const buildIdRaw = String(APP_BUILD_ID || '').trim();
  const buildId = buildIdRaw && buildIdRaw !== '__APP_BUILD_ID__' ? buildIdRaw : 'dev';
  const swUrl = `./sw.js?v=${encodeURIComponent(buildId)}`;
  const register = () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register(swUrl, { scope: './', updateViaCache: 'none' })
      .then((registration) => {
        if (registration && typeof registration.update === 'function') {
          registration.update().catch(() => {});
        }
        if (registration && registration.waiting && typeof registration.waiting.postMessage === 'function') {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        if (registration && typeof registration.addEventListener === 'function') {
          registration.addEventListener('updatefound', () => {
            const next = registration.installing;
            if (!next || typeof next.addEventListener !== 'function') return;
            next.addEventListener('statechange', () => {
              if (next.state === 'installed' && navigator.serviceWorker.controller && typeof next.postMessage === 'function') {
                next.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        }
        if (hadController && typeof navigator.serviceWorker.addEventListener === 'function') {
          let reloaded = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            if (window && window.location && typeof window.location.reload === 'function') {
              window.location.reload();
            }
          });
        }
      })
      .catch(() => {});
  };
  if (typeof document !== 'undefined' && document.readyState === 'complete') {
    register();
    return;
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('load', register, { once: true });
  } else {
    register();
  }
}

function normalizeBibtexText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function escapeBibtexValue(value) {
  return normalizeBibtexText(value)
    .replace(/\\/g, '\\\\')
    .replace(/[{}]/g, '\\$&');
}

function buildBibtexKey(seed, year, index = 0) {
  const base = slugify(seed || `ref-${index + 1}`)
    .replace(/[^a-z0-9-]/gi, '')
    .replace(/-/g, '')
    .toLowerCase();
  const yearPart = String(year == null ? '' : year).replace(/[^0-9a-z]/gi, '').slice(0, 8).toLowerCase();
  const raw = `${base || `ref${index + 1}`}${yearPart}`;
  return /^[a-z]/i.test(raw) ? raw : `ref${raw}`;
}

function buildBibtexEntry(fields, index = 0) {
  const title = normalizeBibtexText(fields?.title) || `Untitled source ${index + 1}`;
  const author = normalizeBibtexText(fields?.author) || 'Unknown';
  const year = normalizeBibtexText(fields?.year) || 'n.d.';
  const key = buildBibtexKey(fields?.keySeed || title, year, index);
  const out = [
    ['author', author],
    ['title', title],
    ['year', year],
  ];
  const url = normalizeBibtexText(fields?.url);
  const note = normalizeBibtexText(fields?.note);
  const howpublished = normalizeBibtexText(fields?.howpublished);
  const keywords = normalizeBibtexText(fields?.keywords);
  if (url) out.push(['url', url]);
  if (howpublished) out.push(['howpublished', howpublished]);
  if (note) out.push(['note', note]);
  if (keywords) out.push(['keywords', keywords]);

  const lines = [`@misc{${key},`];
  for (let i = 0; i < out.length; i++) {
    const [field, value] = out[i];
    const comma = i === out.length - 1 ? '' : ',';
    lines.push(`  ${field} = {${escapeBibtexValue(value)}}${comma}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function downloadBibtexFile(filename, entries) {
  const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!rows.length) return;
  downloadTextFile(filename, `${rows.join('\n\n')}\n`, 'application/x-bibtex;charset=utf-8');
}

function guessAuthorAndTitle(rawTitle, fallbackAuthor = 'Unknown') {
  const text = normalizeBibtexText(rawTitle);
  const m = text.match(/^(.{2,80}?)\s*(?:-|\u2013|\u2014)\s*(.+)$/);
  if (!m) return { author: fallbackAuthor, title: text };
  const maybeAuthor = normalizeBibtexText(m[1]);
  const maybeTitle = normalizeBibtexText(m[2]);
  if (!maybeAuthor || !maybeTitle) return { author: fallbackAuthor, title: text };
  if (maybeAuthor.split(/\s+/).length > 8) return { author: fallbackAuthor, title: text };
  return { author: maybeAuthor, title: maybeTitle };
}

function buildCardSourceBibEntry(item, itemType, src, index = 0) {
  if (!src || typeof src !== 'object') return '';
  const label = normalizeBibtexText(src.label || 'Source');
  const noteParts = [];
  if (item && item.head) noteParts.push(`BookIndex card: ${item.head} (${itemType || 'item'})`);
  if (src.page != null && String(src.page).trim()) noteParts.push(`page ${String(src.page).trim()}`);
  if (src.quote) noteParts.push(String(src.quote));
  return buildBibtexEntry({
    author: 'Unknown',
    title: label,
    year: '',
    url: String(src.url || ''),
    note: noteParts.join('. '),
    howpublished: 'BookIndex card source',
    keywords: `bookindex,${itemType || 'item'},source`,
    keySeed: `${item && item.head ? item.head : 'card'}-${label}-${index + 1}`,
  }, index);
}

function collectScholarBibliographyBibEntries() {
  const s = APP_DATA && APP_DATA.scholar ? APP_DATA.scholar : {};
  const groups = Array.isArray(s.bibliography) ? s.bibliography : [];
  const out = [];
  let idx = 0;
  for (const group of groups) {
    const lecture = normalizeBibtexText(group && group.lecture);
    const works = Array.isArray(group && group.works) ? group.works : [];
    for (const work of works) {
      const title = normalizeBibtexText(work && work.title);
      if (!title) continue;
      const noteParts = [];
      if (lecture) noteParts.push(`Lecture: ${lecture}`);
      if (work && work.note) noteParts.push(String(work.note));
      out.push(buildBibtexEntry({
        author: normalizeBibtexText(work && (work.author || work.authors)) || 'A. A. Zaliznyak',
        title,
        year: String(work && work.year != null ? work.year : ''),
        url: String(work && work.url ? work.url : ''),
        note: noteParts.join('. '),
        howpublished: 'BookIndex scholar bibliography',
        keywords: 'bookindex,scholar,bibliography',
        keySeed: `${lecture || 'lecture'}-${title}`,
      }, idx));
      idx += 1;
    }
  }
  return out;
}

function collectFurtherReadingBibEntries() {
  const sections = Array.isArray(APP_DATA && APP_DATA.further_reading) ? APP_DATA.further_reading : [];
  const out = [];
  let idx = 0;
  for (const sec of sections) {
    const topic = normalizeBibtexText(sec && sec.topic);
    const books = Array.isArray(sec && sec.books) ? sec.books : [];
    for (const book of books) {
      const rawTitle = normalizeBibtexText(book && book.title);
      if (!rawTitle) continue;
      const parsed = guessAuthorAndTitle(rawTitle, normalizeBibtexText(book && (book.author || book.authors)) || 'Unknown');
      const noteParts = [];
      if (topic) noteParts.push(`Topic: ${topic}`);
      if (book && book.why) noteParts.push(String(book.why));
      out.push(buildBibtexEntry({
        author: parsed.author,
        title: parsed.title,
        year: String(book && book.year != null ? book.year : ''),
        url: String(book && book.url ? book.url : ''),
        note: noteParts.join('. '),
        howpublished: 'BookIndex further reading',
        keywords: 'bookindex,further_reading',
        keySeed: `${topic || 'topic'}-${parsed.title}`,
      }, idx));
      idx += 1;
    }
  }
  return out;
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
  listFrequencyMin = LIST_FREQ_MIN_DEFAULT;
  listFrequencyMax = LIST_FREQ_MAX_DEFAULT;
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
    kwic: renderKwicPanel,
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
  const canFilterFrequency = currentEntity === 'lexicon';
  const freqBounds = canFilterFrequency ? getListFrequencyBounds(conf.items) : { min: LIST_FREQ_MIN_DEFAULT, max: LIST_FREQ_MIN_DEFAULT };
  if (canFilterFrequency) {
    listFrequencyMin = clampListFrequencyValue(listFrequencyMin, freqBounds.min, freqBounds.max, freqBounds.min);
    listFrequencyMax = clampListFrequencyValue(listFrequencyMax, freqBounds.min, freqBounds.max, freqBounds.max);
    if (listFrequencyMin > listFrequencyMax) [listFrequencyMin, listFrequencyMax] = [listFrequencyMax, listFrequencyMin];
  }
  const frequencyFilterHtml = canFilterFrequency
    ? `<div class="filter-row filter-row-frequency">
        <label class="freq-filter-label">частотность от
          <input id="freq-min-input" type="number" min="${freqBounds.min}" max="${freqBounds.max}" value="${listFrequencyMin}" />
        </label>
        <label class="freq-filter-label">до
          <input id="freq-max-input" type="number" min="${freqBounds.min}" max="${freqBounds.max}" value="${listFrequencyMax}" />
        </label>
        <button class="filter-chip" id="freq-reset-btn">сброс</button>
      </div>`
    : '';

  container.innerHTML = `
    <div class="panel active">
      <div class="list-card-layout">
        <div class="left-pane">
          <div class="filters">
            <div class="filters-top-row">
              <div class="filters-search">
                <input type="text" id="search-input" placeholder="${currentEntity==='all'?'Поиск по всем указателям…':'Поиск…'}" value="${escapeHtml(searchQuery)}" autofocus />
              </div>
              <button class="filter-chip ${onlyDiscussed?'active':''}" id="only-discussed-btn">только обсуждаемые (≥2 стр.)</button>
            </div>
            ${frequencyFilterHtml}
            ${catChips}
            ${candidateBtnHtml ? `<div class="filter-row">${candidateBtnHtml}</div>` : ''}
          </div>
          <div class="name-list" id="name-list"></div>
        </div>
        <div class="right-pane">
          <div class="right-pane-tools">
            <button class="filter-chip" id="export-section-md">экспорт раздела .md</button>
          </div>
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
      const badge = target.closest('.crosslink-badge[data-type][data-head]');
      if (badge && nameListEl.contains(badge)) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        const t = badge.dataset.type || '';
        const h = badge.dataset.head || '';
        if (t && h) navigateToItem(t, h);
        return;
      }
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
      const badge = target.closest('.crosslink-badge[data-type][data-head]');
      if (badge && nameListEl.contains(badge)) {
        e.preventDefault();
        const t = badge.dataset.type || '';
        const h = badge.dataset.head || '';
        if (t && h) navigateToItem(t, h);
        return;
      }
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
  const freqMinInput = document.getElementById('freq-min-input');
  const freqMaxInput = document.getElementById('freq-max-input');
  const freqResetBtn = document.getElementById('freq-reset-btn');
  if (freqMinInput && freqMaxInput && canFilterFrequency) {
    const applyFrequencyInputs = () => {
      const nextMin = clampListFrequencyValue(freqMinInput.value, freqBounds.min, freqBounds.max, freqBounds.min);
      const nextMax = clampListFrequencyValue(freqMaxInput.value, freqBounds.min, freqBounds.max, freqBounds.max);
      listFrequencyMin = Math.min(nextMin, nextMax);
      listFrequencyMax = Math.max(nextMin, nextMax);
      freqMinInput.value = String(listFrequencyMin);
      freqMaxInput.value = String(listFrequencyMax);
      visibleItemsCache = null;
      renderList();
      persistViewState();
    };
    freqMinInput.onchange = applyFrequencyInputs;
    freqMaxInput.onchange = applyFrequencyInputs;
    freqMinInput.onkeydown = (e) => { if (e.key === 'Enter') applyFrequencyInputs(); };
    freqMaxInput.onkeydown = (e) => { if (e.key === 'Enter') applyFrequencyInputs(); };
    if (freqResetBtn) {
      freqResetBtn.onclick = () => {
        listFrequencyMin = freqBounds.min;
        listFrequencyMax = freqBounds.max;
        freqMinInput.value = String(listFrequencyMin);
        freqMaxInput.value = String(listFrequencyMax);
        visibleItemsCache = null;
        renderList();
        persistViewState();
      };
    }
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
  if (currentEntity === 'lexicon') {
    const mentions = countItemMentions(it);
    if (mentions < listFrequencyMin || mentions > listFrequencyMax) return false;
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
    currentEntity === 'lexicon' ? String(listFrequencyMin) : '',
    currentEntity === 'lexicon' ? String(listFrequencyMax) : '',
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

function normalizeSubjectCrosslinkHead(value) {
  return String(value || '').trim().toLocaleLowerCase('ru');
}

function pickBestCrosslinkByPageOverlap(subjectPages, pageIndex) {
  const pages = Array.isArray(subjectPages) ? subjectPages : [];
  if (!pages.length || !(pageIndex instanceof Map)) return '';
  const scoreByHead = new Map();
  for (const rawPage of pages) {
    const page = parseInt(rawPage, 10);
    if (!Number.isFinite(page)) continue;
    const heads = pageIndex.get(page);
    if (!Array.isArray(heads) || !heads.length) continue;
    for (const head of heads) {
      if (!head) continue;
      scoreByHead.set(head, (scoreByHead.get(head) || 0) + 1);
    }
  }
  let bestHead = '';
  let bestScore = -1;
  for (const [head, score] of scoreByHead.entries()) {
    if (score > bestScore) {
      bestHead = head;
      bestScore = score;
      continue;
    }
    if (score === bestScore && compareHeadsRu(head, bestHead) < 0) bestHead = head;
  }
  return bestHead;
}

function getSubjectCrosslinksLookup() {
  if (subjectCrosslinksLookupCache) return subjectCrosslinksLookupCache;
  const typeMeta = {
    lexicon: '\u041b\u0435\u043a\u0441\u0438\u043a\u043e\u043d',
    names: '\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u0438\u0438',
    languages: '\u042f\u0437\u044b\u043a\u0438',
  };
  const sources = [
    ['lexicon', APP_DATA.lexicon || []],
    ['names', APP_DATA.names || []],
    ['languages', APP_DATA.languages || []],
  ];
  const exactLookup = {};
  const pageLookup = {};
  for (const [type, list] of sources) {
    exactLookup[type] = new Map();
    pageLookup[type] = new Map();
    for (const it of Array.isArray(list) ? list : []) {
      const head = String(it && it.head ? it.head : '').trim();
      if (!head) continue;
      const exactKey = normalizeSubjectCrosslinkHead(head);
      if (!exactKey) continue;
      if (!exactLookup[type].has(exactKey)) exactLookup[type].set(exactKey, []);
      exactLookup[type].get(exactKey).push(head);
      const pages = sortUniquePages(it.page_list || []);
      for (const rawPage of pages) {
        const page = parseInt(rawPage, 10);
        if (!Number.isFinite(page)) continue;
        if (!pageLookup[type].has(page)) pageLookup[type].set(page, []);
        pageLookup[type].get(page).push(head);
      }
    }
  }
  const bySubject = new Map();
  const subjects = Array.isArray(APP_DATA.subject_index) ? APP_DATA.subject_index : [];
  for (const subj of subjects) {
    const head = String(subj && subj.head ? subj.head : '').trim();
    if (!head) continue;
    const subjectNorm = normalizeHeadForMatch(head);
    if (!subjectNorm) continue;
    const exactKey = normalizeSubjectCrosslinkHead(head);
    const links = [];
    for (const [type] of sources) {
      const exactHeads = exactLookup[type].get(exactKey) || [];
      if (exactHeads.length) links.push({ type, label: typeMeta[type], head: exactHeads[0] });
    }
    if (!links.length) {
      const subjectPages = sortUniquePages(subj.page_list || []);
      for (const [type] of sources) {
        const fallbackHead = pickBestCrosslinkByPageOverlap(subjectPages, pageLookup[type]);
        if (!fallbackHead) continue;
        links.push({ type, label: typeMeta[type], head: fallbackHead });
      }
    }
    if (links.length) bySubject.set(subjectNorm, links);
  }
  subjectCrosslinksLookupCache = { bySubject };
  return subjectCrosslinksLookupCache;
}

function buildSubjectCrosslinks(head) {
  const norm = normalizeHeadForMatch(head);
  if (!norm) return [];
  const lookup = getSubjectCrosslinksLookup();
  if (!lookup || !(lookup.bySubject instanceof Map)) return [];
  const links = lookup.bySubject.get(norm);
  return Array.isArray(links) ? links : [];
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
  const itemType = it && it._entityType ? it._entityType : currentEntity;
  let crosslinksHtml = '';
  if (itemType === 'subject') {
    const links = buildSubjectCrosslinks(it.head);
    if (links.length) {
      crosslinksHtml = `<div class="subject-crosslinks">
        <span class="crosslinks-label">Смотрите также:</span>
        ${links.map((lnk) => `<a href="${escapeHtml(buildItemHash(lnk.type, lnk.head))}" class="crosslink-badge" data-type="${escapeHtml(lnk.type)}" data-head="${escapeHtml(lnk.head)}">${escapeHtml(lnk.label)}: ${escapeHtml(lnk.head)}</a>`).join('')}
      </div>`;
    }
  }
  return `${dot}<span class="head ${it.discussed ? 'discussed' : ''}">${renderAccentSafe(it.head)}</span>${typeLabel}${moderatorMark}<span class="pages-count">${(it.page_list || []).length}</span>${crosslinksHtml}`;
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

function getReverseEdgesIndex() {
  if (reverseEdgesCache) return reverseEdgesCache;
  const index = {};
  const edges = Array.isArray(APP_DATA && APP_DATA.edges) ? APP_DATA.edges : [];
  for (const edge of edges) {
    const source = String(edge && edge.source ? edge.source : '').trim();
    const target = String(edge && edge.target ? edge.target : '').trim();
    if (!source || !target || source === target) continue;
    const weightRaw = Number(edge && edge.weight);
    const weight = Number.isFinite(weightRaw) ? weightRaw : 0;
    if (!index[target]) index[target] = [];
    index[target].push({ head: source, weight });
  }
  reverseEdgesCache = index;
  return reverseEdgesCache;
}

function collectNameRelationLinks(head) {
  const baseHead = String(head || '').trim();
  if (!baseHead) return [];
  const relationMap = new Map();
  const edges = Array.isArray(APP_DATA && APP_DATA.edges) ? APP_DATA.edges : [];
  for (const edge of edges) {
    const source = String(edge && edge.source ? edge.source : '').trim();
    const target = String(edge && edge.target ? edge.target : '').trim();
    if (!source || !target || source !== baseHead || source === target) continue;
    const weightRaw = Number(edge && edge.weight);
    const weight = Number.isFinite(weightRaw) ? weightRaw : 0;
    const prev = relationMap.get(target);
    if (!prev || weight > prev.weight) relationMap.set(target, { head: target, weight });
  }
  const reverse = getReverseEdgesIndex();
  const reverseEntries = Array.isArray(reverse[baseHead]) ? reverse[baseHead] : [];
  for (const edge of reverseEntries) {
    const otherHead = String(edge && edge.head ? edge.head : '').trim();
    if (!otherHead || otherHead === baseHead) continue;
    const weightRaw = Number(edge && edge.weight);
    const weight = Number.isFinite(weightRaw) ? weightRaw : 0;
    const prev = relationMap.get(otherHead);
    if (!prev || weight > prev.weight) relationMap.set(otherHead, { head: otherHead, weight });
  }
  return Array.from(relationMap.values())
    .sort((a, b) => (b.weight - a.weight) || compareHeadsRu(a.head, b.head));
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
  const useTwoColumnCardLayout = eType === 'toponyms';
  const itemSources = Array.isArray(it.sources) ? it.sources.slice(0, 5) : [];
  const renderSourcesInHeader = eType === 'names' && itemSources.length > 0;
  const sourceConfirmedInline = editorial.source_confirmed
    ? '<span class="card-status-inline">source confirmed</span>'
    : '';
  let headerSourcesHtml = '';
  if (renderSourcesInHeader) {
    const sourcePills = itemSources.slice(0, 3).map((src, sourceIdx) => {
      const label = escapeHtml(src.label || 'Source');
      const link = src.url
        ? `<a href="${escapeHtml(safeUrl(src.url))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
        : `<span>${label}</span>`;
      return `<span class="card-source-pill">${link}<button type="button" class="related-link related-link-btn source-export-bib" data-source-idx="${sourceIdx}" style="font-size:10px;">BibTeX</button></span>`;
    }).join('');
    if (sourcePills) {
      headerSourcesHtml = `<div class="card-sources-inline"><span class="card-sources-label">Sources</span>${sourcePills}</div>`;
    }
  }
  const allPages = sortUniquePages(it.page_list || []);
  let pagesText = it.pages || it.head_pages || '';
  const pageLinksHtml = buildCardPageLinksHtml(allPages);

  let html = `
    <div class="card">
      <div class="card-header">
        ${photo}
        <div class="card-title-block">
          <h2>${renderAccentSafe(it.head)}</h2>
          <div class="card-meta-row">
            <div class="category">${escapeHtml(category)}</div>
            <div class="card-meta-right">
              ${sourceConfirmedInline}
              ${headerSourcesHtml}
            </div>
          </div>
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
        <span class="pages-links">${pageLinksHtml || escapeHtml(pagesText)}</span>
        ${it.discussed ? ' · <em>обсуждается</em>' : ' · однократное упоминание'}
      </div>
  `;
  if (eType === 'lexicon' || eType === 'lexicon_tech') {
    html += `<div style="margin-top:8px;">
      <button type="button" class="related-link related-link-btn kwic-jump-btn" data-term="${escapeHtml(it.head)}">\u041d\u0430\u0439\u0442\u0438 \u0432 KWIC</button>
    </div>`;
  }
  const flagBadges = [];
  if (editorial.verified) flagBadges.push('<span style="padding:2px 6px;border-radius:999px;background:#e7f7ed;border:1px solid #b5e2c4;color:#2e6d44;font-size:11px;">verified</span>');
  if (editorial.suspect) flagBadges.push('<span style="padding:2px 6px;border-radius:999px;background:#fff6e8;border:1px solid #f0d1a6;color:#8b5a2b;font-size:11px;">suspect</span>');
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
  if (useTwoColumnCardLayout) html += '<div class="card-two-col-layout">';

  if (itemSources.length > 0 && !renderSourcesInHeader) {
    html += useTwoColumnCardLayout ? '<section class="card-col-block"><h3>Sources</h3><div class="related">' : '<h3>Sources</h3><div class="related">';
    for (let sourceIdx = 0; sourceIdx < itemSources.length; sourceIdx++) {
      const src = itemSources[sourceIdx];
      const label = escapeHtml(src.label || 'Source');
      const isWikiSource = /wikipedia/i.test(String(src.label || '')) || /wikipedia\.org/i.test(String(src.url || ''));
      const pageHint = src.page ? ` · p. ${escapeHtml(src.page)}` : '';
      const link = src.url
        ? `<a href="${escapeHtml(safeUrl(src.url))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
        : `<span>${label}</span>`;
      const quote = (!isWikiSource && src.quote) ? `<div style="font-size:12px;color:#444;line-height:1.45;margin:4px 0 2px 0;">“${escapeHtml(src.quote)}”</div>` : '';
      html += `<div style="padding:6px 0;border-bottom:1px dashed #ddd;">
        ${link}
        <span style="color:#888;font-size:11px;">${pageHint}</span>
        <button type="button" class="related-link related-link-btn source-export-bib" data-source-idx="${sourceIdx}" style="font-size:11px;margin-left:8px;padding:1px 8px;">BibTeX</button>
        ${quote}
      </div>`;
    }
    html += useTwoColumnCardLayout ? '</div></section>' : '</div>';
  }
  const ctxKeys = it.contexts ? Object.keys(it.contexts).sort((a, b) => parseInt(a) - parseInt(b)) : [];
  if (ctxKeys.length > 0) {
    html += '<h3>Контексты упоминаний (KWIC)</h3>';
    for (const pg of ctxKeys.slice(0, 10)) {
      const ctxs = it.contexts[pg];
      for (const ctx of ctxs.slice(0, 1)) {
        const ctxHtml = renderContextTextWithLinks(ctx);
        html += `
          <div class="context-item">
            <div class="context-page">стр. ${pg}</div>
            <div class="context-text">${ctxHtml}</div>
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

  if (eType === 'names') {
    const relationLinks = collectNameRelationLinks(it.head);
    if (relationLinks.length > 0) {
      html += '<h3>\u0421\u0432\u044f\u0437\u0430\u043d\u043d\u044b\u0435 \u0443\u0447\u0451\u043d\u044b\u0435</h3><div class="related">';
      for (const rel of relationLinks.slice(0, 12)) {
        const weightLabel = Number.isFinite(rel.weight) ? rel.weight.toFixed(1).replace(/\.0$/, '') : '0';
        html += `<a class="relation-chip" data-type="names" data-head="${escapeHtml(rel.head)}" href="${escapeHtml(buildItemHash('names', rel.head))}">
          <span>${escapeHtml(rel.head)}</span>
          <span class="chip-weight">${escapeHtml(weightLabel)}</span>
        </a>`;
      }
      html += '</div>';
    }
  }
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

  if (useTwoColumnCardLayout) html += '</div>';
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
  right.querySelectorAll('.card-page-link[data-page]').forEach((el) => {
    bindActionWithKeyboard(el, () => {
      const page = parseInt((el.dataset && el.dataset.page) || '0', 10);
      openReadingNowPage(Number.isFinite(page) ? page : 1);
    });
  });
  right.querySelectorAll('.kwic-jump-btn[data-term]').forEach((btn) => {
    bindActionWithKeyboard(btn, () => {
      const term = clampUiInput((btn.dataset && btn.dataset.term) || '', MAX_LIST_QUERY_LENGTH);
      if (!term) return;
      pendingKwicTerm = term;
      if (typeof window !== 'undefined') window._pendingKwicTerm = term;
      currentKwicSource = 'lexicon';
      currentKwicQuery = term;
      switchEntity('materials');
      switchTab('kwic');
    });
  });
  right.querySelectorAll('.source-export-bib[data-source-idx]').forEach((btn) => {
    bindActionWithKeyboard(btn, () => {
      const idx = parseInt(btn.dataset.sourceIdx || '-1', 10);
      if (!Number.isInteger(idx) || idx < 0) return;
      const sources = Array.isArray(it.sources) ? it.sources : [];
      const src = sources[idx];
      if (!src) return;
      const entry = buildCardSourceBibEntry(it, eType, src, idx);
      if (!entry) return;
      downloadBibtexFile(`${slugify(it.head)}-source-${idx + 1}.bib`, [entry]);
      announceUiMessage('BibTeX exported');
    });
  });
  bindNavigateLinks(right, '.xlink[data-head]', 'names');
  bindNavigateLinks(right, '.relation-chip[data-head]', 'names');
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
function getNameGraphLayoutSync(minEdgeWeight, W, H) {
  const minWeight = Number.isFinite(minEdgeWeight) ? Math.max(0, minEdgeWeight) : 0;
  const key = `${minWeight.toFixed(2)}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-names', key, () => {
    const items = APP_DATA.names || [];
    const srcEdges = APP_DATA.edges || [];
    const edges = srcEdges.filter(e => (Number(e.weight) || 0) >= minWeight);
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

function getNameGraphLayout(minEdgeWeight, W, H) {
  return getNameGraphLayoutSync(minEdgeWeight, W, H);
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
    "    var minWeight = Number(data.minWeight);",
    "    if (!isFinite(minWeight) || minWeight < 0) minWeight = 0;",
    "    var W = Number(data.W) || 1200;",
    "    var H = Number(data.H) || 600;",
    "    var names = Array.isArray(data.names) ? data.names : [];",
    "    var srcEdges = Array.isArray(data.edges) ? data.edges : [];",
    "    var edges = srcEdges.filter(function(e) { return Number(e.weight || 0) >= minWeight; });",
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

function requestNameGraphLayoutFromWorker(minEdgeWeight, W, H) {
  const worker = getNameGraphWorker();
  if (!worker) return null;
  const minWeight = Number.isFinite(minEdgeWeight) ? Math.max(0, minEdgeWeight) : 0;
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
    worker.postMessage({ requestId, minWeight, W, H, names, edges });
  });
}

function getNameGraphLayoutAsync(minEdgeWeight, W, H) {
  const minWeight = Number.isFinite(minEdgeWeight) ? Math.max(0, minEdgeWeight) : 0;
  const key = `${minWeight.toFixed(2)}:${W}x${H}:${getDataSignature()}`;
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
    job = requestNameGraphLayoutFromWorker(minWeight, W, H);
  }
  if (!job) {
    job = Promise.resolve(getNameGraphLayoutSync(minWeight, W, H));
  } else {
    job = job.catch((error) => {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[graph-worker] fallback to sync layout:', error && error.message ? error.message : error);
      }
      disposeNameGraphWorker();
      return getNameGraphLayoutSync(minWeight, W, H);
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
  const edgesRaw = APP_DATA.edges || [];
  const maxEdgeWeight = edgesRaw.reduce((mx, e) => Math.max(mx, Number(e.weight) || 0), 0);
  const sliderMax = Math.max(2, Math.ceil(maxEdgeWeight * 10) / 10);
  if (!Number.isFinite(nameGraphMinEdgeWeight) || nameGraphMinEdgeWeight < 0) nameGraphMinEdgeWeight = 0;
  nameGraphMinEdgeWeight = Math.min(nameGraphMinEdgeWeight, sliderMax);
  const minWeightLabel = (Math.round(nameGraphMinEdgeWeight * 10) / 10).toFixed(1);

  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Person-to-person co-mention graph. Nodes are people and weighted links reflect how close their mentions are in the text.</p>
    <div class="graph-toolbar">
      <label class="graph-range">min edge weight
        <input id="graph-min-weight" type="range" min="0" max="${sliderMax.toFixed(1)}" step="0.1" value="${minWeightLabel}">
        <strong id="graph-min-weight-value">${minWeightLabel}</strong>
      </label>
      <span class="graph-metric" id="graph-summary"></span>
    </div>
    <div id="graph-status" style="font-size:12px;color:#7b5b38;margin-bottom:8px;">Calculating graph layout...</div>
    <div id="graph-stage" aria-label="Person graph"></div>
    <div id="graph-legend" class="graph-legend"></div>
    <div id="graph-tooltip" class="graph-tooltip" hidden></div>
  </div></div>`;

  const slider = document.getElementById('graph-min-weight');
  const sliderValue = document.getElementById('graph-min-weight-value');
  const summary = document.getElementById('graph-summary');
  const status = document.getElementById('graph-status');
  const stage = document.getElementById('graph-stage');
  const legend = document.getElementById('graph-legend');
  const tooltip = document.getElementById('graph-tooltip');
  const W = 1200;
  const H = 620;
  const renderToken = ++nameGraphRenderToken;

  const setWeightValue = () => {
    const raw = Number(slider && slider.value);
    const next = Number.isFinite(raw) ? Math.max(0, Math.min(sliderMax, raw)) : 0;
    nameGraphMinEdgeWeight = next;
    if (slider) slider.value = next.toFixed(1);
    if (sliderValue) sliderValue.textContent = next.toFixed(1);
  };

  if (slider) {
    slider.oninput = () => {
      setWeightValue();
      renderGraphPanel(container);
    };
  }
  setWeightValue();

  if (!stage || typeof d3 === 'undefined' || !d3 || typeof d3.select !== 'function') {
    if (status) {
      status.style.display = 'block';
      status.textContent = 'D3.js is unavailable, graph view is disabled.';
    }
    return;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.hidden = true;
    tooltip.innerHTML = '';
  }

  function showTooltip(event, item) {
    if (!tooltip || !stage || !item) return;
    const rect = stage.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(0, px)}px`;
    tooltip.style.top = `${Math.max(0, py)}px`;
    tooltip.innerHTML = `<strong>${escapeHtml(item.name || '')}</strong>${escapeHtml(item.subcat || 'uncategorized')} - mentions: ${Number(item.weight || 0)}`;
  }

  function renderLegend(rows) {
    if (!legend) return;
    if (!rows.length) {
      legend.innerHTML = '';
      return;
    }
    legend.innerHTML = rows.map((row) => `
      <span class="graph-legend-item">
        <span class="graph-legend-swatch" style="background:${escapeHtml(row.color)};"></span>
        ${escapeHtml(row.label)} (${row.count})
      </span>
    `).join('');
  }

  getNameGraphLayoutAsync(nameGraphMinEdgeWeight, W, H)
    .then((layout) => {
      if (renderToken !== nameGraphRenderToken) return;
      const nodes = Array.isArray(layout.nodes) ? layout.nodes.map((n) => ({ ...n })) : [];
      const idx = layout.idx || {};
      const validEdges = Array.isArray(layout.validEdges) ? layout.validEdges : [];
      const links = validEdges
        .map((e) => ({
          source: nodes[idx[e.source]],
          target: nodes[idx[e.target]],
          weight: Number(e.weight) || 0,
        }))
        .filter((e) => e.source && e.target);
      if (summary) {
        summary.textContent = `nodes: ${nodes.length} - edges: ${links.length}`;
      }
      if (status) {
        status.style.display = 'none';
        status.textContent = '';
      }
      if (!nodes.length || !links.length) {
        if (status) {
          status.style.display = 'block';
          status.textContent = 'No edges for the selected threshold.';
        }
        stage.innerHTML = '';
        renderLegend([]);
        hideTooltip();
        return;
      }

      const legendMap = new Map();
      for (const n of nodes) {
        const label = n.subcat || 'uncategorized';
        const prev = legendMap.get(label) || 0;
        legendMap.set(label, prev + 1);
      }
      const legendRows = [...legendMap.entries()]
        .sort((a, b) => b[1] - a[1] || compareHeadsRu(a[0], b[0]))
        .map(([label, count]) => ({ label, count, color: safeColor(COLORS[label], '#666') }));
      renderLegend(legendRows);

      const svg = d3.select(stage)
        .html('')
        .append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('role', 'img')
        .attr('aria-label', 'Person graph');
      const root = svg.append('g').attr('class', 'graph-root');
      const linkLayer = root.append('g').attr('class', 'graph-links');
      const nodeLayer = root.append('g').attr('class', 'graph-nodes');
      const labelLayer = root.append('g').attr('class', 'graph-labels');

      const linkSel = linkLayer
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#8a7050')
        .attr('stroke-opacity', (d) => Math.min(0.75, 0.18 + Math.sqrt(d.weight) * 0.12))
        .attr('stroke-width', (d) => Math.max(0.6, Math.sqrt(d.weight) * 1.25));

      const nodeSel = nodeLayer
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('class', 'name-graph-node')
        .attr('r', (d) => 4 + Math.sqrt(d.weight) * 1.45)
        .attr('fill', (d) => safeColor(COLORS[d.subcat], '#666'))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.2)
        .style('cursor', 'pointer');

      const labelSel = labelLayer
        .selectAll('text')
        .data(nodes.filter((n) => (4 + Math.sqrt(n.weight) * 1.45) >= 6))
        .join('text')
        .text((d) => d.name)
        .attr('font-size', 11)
        .attr('fill', '#1a1a1a')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.85)
        .attr('font-family', 'Georgia, serif');

      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links)
          .distance((d) => Math.max(42, 150 - Math.sqrt(d.weight) * 18))
          .strength((d) => Math.min(0.75, 0.12 + Math.sqrt(d.weight) * 0.09)))
        .force('charge', d3.forceManyBody().strength(-95))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collide', d3.forceCollide().radius((d) => 7 + Math.sqrt(d.weight) * 1.7))
        .alpha(0.65)
        .alphaDecay(0.055);

      const drag = d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.2).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      nodeSel.call(drag);
      nodeSel.on('mousemove', (event, d) => showTooltip(event, d));
      nodeSel.on('mouseleave', hideTooltip);
      nodeSel.on('click', (event, d) => {
        event.stopPropagation();
        hideTooltip();
        simulation.stop();
        selectedItem = d.name;
        selectedItemType = 'names';
        rightPaneMode = 'card';
        switchTab('list');
      });

      const zoom = d3.zoom()
        .scaleExtent([0.45, 3.4])
        .on('zoom', (event) => {
          root.attr('transform', event.transform);
        });
      svg.call(zoom);
      svg.on('dblclick.zoom', null);
      svg.on('dblclick', () => {
        svg.transition().duration(180).call(zoom.transform, d3.zoomIdentity);
      });
      svg.on('mouseleave', hideTooltip);

      simulation.on('tick', () => {
        if (renderToken !== nameGraphRenderToken) {
          simulation.stop();
          return;
        }
        linkSel
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y);
        nodeSel
          .attr('cx', (d) => d.x)
          .attr('cy', (d) => d.y);
        labelSel
          .attr('x', (d) => d.x + 6 + Math.sqrt(d.weight))
          .attr('y', (d) => d.y + 4);
      });

      perfDebug('render-graph-names', nowMs() - t0, `min=${nameGraphMinEdgeWeight.toFixed(1)}`);
    })
    .catch((error) => {
      if (renderToken !== nameGraphRenderToken) return;
      if (status) {
        status.style.display = 'block';
        status.textContent = 'Failed to build graph.';
      }
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[graph-names] render failed:', error && error.message ? error.message : error);
      }
    });
}

// =========================================================
// LANGUAGE FAMILIES GRAPH
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

function buildHomeHowToGuideHtml() {
  const demoHref = 'https://gasyoun.github.io/BookIndex/aaz-index.html#v4/home/home';
  const namesListHash = buildCanonicalHash(['names', 'list']);
  const toponymsListHash = buildCanonicalHash(['toponyms', 'list']);
  const ethnonymsListHash = buildCanonicalHash(['ethnonyms', 'list']);
  const languagesListHash = buildCanonicalHash(['languages', 'list']);
  const lexiconListHash = buildCanonicalHash(['lexicon', 'list']);
  const lexiconReverseHash = buildCanonicalHash(['lexicon_reverse', 'list']);
  const reconstructionsHash = buildCanonicalHash(['lexicon_tech', 'list']);
  const subjectListHash = buildCanonicalHash(['subject', 'list']);
  const kwicHash = buildCanonicalHash(['materials', 'kwic']);
  const toponymsMapHash = buildCanonicalHash(['toponyms', 'map']);
  const ethnonymsMapHash = buildCanonicalHash(['ethnonyms', 'map']);
  const languagesMapHash = buildCanonicalHash(['languages', 'map']);
  const materialsPhoneticHash = buildCanonicalHash(['materials', 'phonetic_laws']);
  const udarenieAllHash = buildListSearchHash('all', 'ударение');
  const udarenieSubjectHash = buildListSearchHash('subject', 'ударение');
  const akanyeSubjectHash = buildListSearchHash('subject', 'аканье');
  const articleSubjectHash = buildListSearchHash('subject', 'артикль');
  const birchSubjectHash = buildListSearchHash('subject', 'берестяные грамоты');
  const avanesovHash = buildListSearchHash('names', 'Аванесов Р. И.');
  const avvakumHash = buildListSearchHash('names', 'Аввакум');
  const avanesovItemHash = buildItemHash('names', 'Аванесов Р. И.');
  const angliaHash = buildListSearchHash('toponyms', 'Англия');
  const angliaItemHash = buildItemHash('toponyms', 'Англия');
  const rossiyaHash = buildListSearchHash('toponyms', 'Россия');
  const austraHash = buildListSearchHash('languages', 'австралийские');
  const austraItemHash = buildItemHash('languages', 'австралийские');
  const sanskritHash = buildListSearchHash('all', 'санскрит');
  const globalBerestaHash = buildListSearchHash('all', 'берестяные грамоты');
  const globalAvanesovHash = buildListSearchHash('all', 'Аванесов Р. И.');
  const globalAngliaHash = buildListSearchHash('all', 'Англия');
  const globalLekciiHash = buildListSearchHash('all', 'лекция');
  const linkStyle = 'color:#5a3818;text-decoration:underline dotted;';

  return `<details id="home-howto-details" open style="margin-top:10px;margin-bottom:14px;border:1px solid #d4c8b0;border-radius:6px;background:#fff;padding:10px 12px;">
    <summary style="cursor:pointer;color:#5a3818;font-size:18px;font-weight:normal;">Как пользоваться «Зализнякиадой»</summary>
    <div style="margin-top:10px;display:grid;gap:10px;font-size:13px;line-height:1.6;color:#333;">
      <p><strong>BookIndex</strong> — интерактивный указатель к книге А. А. Зализняка «Из жизни слов и языков». Он собран в один файл <code>aaz-index.html</code> и работает как навигационная надстройка над книгой: помогает быстрее находить темы, имена, термины и географию книги. Демо: <a href="${escapeHtml(demoHref)}" style="${linkStyle}">${escapeHtml(demoHref)}</a>.</p>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Что это дает читателю</h3>
      <ul style="margin:0;padding-left:18px;">
        <li>Быстро находить нужные темы, имена и термины по странице: например, <a href="${escapeHtml(udarenieAllHash)}" style="${linkStyle}">ударение</a>, <a href="${escapeHtml(globalBerestaHash)}" style="${linkStyle}">берестяные грамоты</a>, <a href="${escapeHtml(globalAvanesovHash)}" style="${linkStyle}">Аванесов Р. И.</a> или <a href="${escapeHtml(globalAngliaHash)}" style="${linkStyle}">Англия</a>.</li>
        <li>Видеть, насколько тема важна: не по одному упоминанию, а по тому, сколько страниц она покрывает в <a href="${escapeHtml(subjectListHash)}" style="${linkStyle}">предметном указателе</a>.</li>
        <li>Путешествовать по книге не только по оглавлению, но и по <a href="${escapeHtml(toponymsMapHash)}" style="${linkStyle}">картам</a>, спискам <a href="${escapeHtml(languagesListHash)}" style="${linkStyle}">языков</a> и <a href="${escapeHtml(ethnonymsListHash)}" style="${linkStyle}">народов</a>.</li>
      </ul>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Какие указатели там есть</h3>
      <p style="margin:0;">Внутри BookIndex несколько разных указателей. Они выглядят как алфавитные списки, но отвечают на разные вопросы.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Имена</h4>
      <p style="margin:0;">Раздел <a href="${escapeHtml(namesListHash)}" style="${linkStyle}">«Имена»</a> — это указатель ученых, авторов и исторических фигур. Например, можно открыть <a href="${escapeHtml(avanesovItemHash)}" style="${linkStyle}">Аванесов Р. И.</a> или найти <a href="${escapeHtml(avvakumHash)}" style="${linkStyle}">Аввакум [Петров]</a>.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Топонимы</h4>
      <p style="margin:0;">Раздел <a href="${escapeHtml(toponymsListHash)}" style="${linkStyle}">«Топонимы»</a> — географический указатель: страны, города, регионы. Пример: <a href="${escapeHtml(angliaItemHash)}" style="${linkStyle}">Англия</a> в списке и в <a href="${escapeHtml(toponymsMapHash)}" style="${linkStyle}">режиме карты</a>. Еще пример для поиска — <a href="${escapeHtml(rossiyaHash)}" style="${linkStyle}">Россия</a>.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Этнонимы</h4>
      <p style="margin:0;">Раздел <a href="${escapeHtml(ethnonymsListHash)}" style="${linkStyle}">«Этнонимы»</a> собирает названия народов и этнических групп. Удобно проверять страницы, где народ обсуждается как носитель языка, традиции или контактной зоны.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Языки</h4>
      <p style="margin:0;">Раздел <a href="${escapeHtml(languagesListHash)}" style="${linkStyle}">«Языки»</a> — указатель языков и языковых групп. Пример: <a href="${escapeHtml(austraItemHash)}" style="${linkStyle}">австралийские</a> в списке и точка в <a href="${escapeHtml(languagesMapHash)}" style="${linkStyle}">карте языков</a>.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Лексика</h4>
      <p style="margin:0;">Раздел <a href="${escapeHtml(lexiconListHash)}" style="${linkStyle}">«Лексика»</a> — словарный указатель к книге. <a href="${escapeHtml(lexiconReverseHash)}" style="${linkStyle}">«Лексика (обратная)»</a> полезна, если хотите искать не по началу слова, а по окончанию, корню или модели.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Реконструкции</h4>
      <p style="margin:0;"><a href="${escapeHtml(reconstructionsHash)}" style="${linkStyle}">«Реконструкции»</a> — небольшой технический раздел для восстановленных форм и специальных обозначений.</p>

      <h4 style="margin:0;color:#5a3818;font-size:14px;">Предметный указатель</h4>
      <p style="margin:0;"><a href="${escapeHtml(subjectListHash)}" style="${linkStyle}">«Предметный»</a> отвечает на вопрос не «где встречается слово», а «где в книге разбирается явление»: <a href="${escapeHtml(akanyeSubjectHash)}" style="${linkStyle}">аканье</a>, <a href="${escapeHtml(birchSubjectHash)}" style="${linkStyle}">берестяные грамоты</a>, <a href="${escapeHtml(articleSubjectHash)}" style="${linkStyle}">артикль</a>, <a href="${escapeHtml(udarenieSubjectHash)}" style="${linkStyle}">ударение</a>.</p>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Как это помогает читать книгу</h3>
      <ul style="margin:0;padding-left:18px;">
        <li>Если вы ищете конкретное имя, BookIndex ведет прямо к страницам и контексту: <a href="${escapeHtml(avanesovHash)}" style="${linkStyle}">Аванесов Р. И.</a> или <a href="${escapeHtml(avvakumHash)}" style="${linkStyle}">Аввакум</a>.</li>
        <li>Если нужна география, откройте <a href="${escapeHtml(toponymsListHash)}" style="${linkStyle}">топонимы</a> и посмотрите <a href="${escapeHtml(toponymsMapHash)}" style="${linkStyle}">карту</a>: например, <a href="${escapeHtml(angliaHash)}" style="${linkStyle}">Англия</a>.</li>
        <li>Если нужны языки, используйте список + карту: пример <a href="${escapeHtml(austraHash)}" style="${linkStyle}">австралийские</a>.</li>
        <li>Если нужна тема, <a href="${escapeHtml(subjectListHash)}" style="${linkStyle}">предметный указатель</a> покажет, где она реально разбирается по страницам.</li>
      </ul>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Два вида поиска</h3>
      <p style="margin:0;"><strong>Глобальный поиск</strong> в шапке страницы: вводите имя, язык, топоним, термин или лекцию. Примеры: <a href="${escapeHtml(angliaHash)}" style="${linkStyle}">Англия</a>, <a href="${escapeHtml(udarenieAllHash)}" style="${linkStyle}">ударение</a>, <a href="${escapeHtml(globalLekciiHash)}" style="${linkStyle}">лекция</a>.</p>
      <p style="margin:0;"><strong>Локальный поиск</strong> внутри раздела: фильтрует только текущий список. Для контекстов по фрагментам используйте <a href="${escapeHtml(kwicHash)}" style="${linkStyle}">KWIC</a> и, например, запрос <a href="${escapeHtml(sanskritHash)}" style="${linkStyle}">санскрит</a>.</p>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Карта и примеры</h3>
      <p style="margin:0;">Карта работает в разделах <a href="${escapeHtml(toponymsMapHash)}" style="${linkStyle}">«Топонимы»</a>, <a href="${escapeHtml(ethnonymsMapHash)}" style="${linkStyle}">«Этнонимы»</a> и <a href="${escapeHtml(languagesMapHash)}" style="${linkStyle}">«Языки»</a>.</p>
      <ul style="margin:0;padding-left:18px;">
        <li><a href="${escapeHtml(angliaHash)}" style="${linkStyle}">Англия</a> — точка над Британскими островами и связанная карточка.</li>
        <li><a href="${escapeHtml(austraHash)}" style="${linkStyle}">австралийские</a> — языковая зона с привязкой к географии.</li>
        <li>Любой этноним — возможность увидеть, где живет группа, а не только как она названа.</li>
      </ul>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Как сохранить и читать офлайн</h3>
      <p style="margin:0;">Сайт можно открыть по ссылке или сохранить локально. Так как <code>aaz-index.html</code> автономен, списки, поиск, карточки и переходы между разделами остаются доступными без интернета; для тайлов карты может понадобиться сеть.</p>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">Как использовать в Obsidian</h3>
      <ul style="margin:0;padding-left:18px;">
        <li>Сохраните <code>aaz-index.html</code> в vault.</li>
        <li>Сделайте заметку «Зализнякиада — навигация».</li>
        <li>Добавьте в нее ссылки на нужные разделы, например <a href="${escapeHtml(materialsPhoneticHash)}" style="${linkStyle}">фонетические законы</a> и <a href="${escapeHtml(subjectListHash)}" style="${linkStyle}">предметный</a>.</li>
        <li>Для важных тем заводите отдельные заметки и переносите диапазоны страниц из указателей.</li>
      </ul>
      <ol style="margin:0;padding-left:18px;">
        <li>Откройте <a href="${escapeHtml(udarenieSubjectHash)}" style="${linkStyle}">ударение</a> в предметном указателе.</li>
        <li>Добавьте страницы в заметку Obsidian.</li>
        <li>Затем откройте <a href="${escapeHtml(angliaHash)}" style="${linkStyle}">Англия</a> в топонимах.</li>
        <li>После этого перейдите в <a href="${escapeHtml(languagesListHash)}" style="${linkStyle}">языки</a> и свяжите материал с другими заметками.</li>
      </ol>

      <h3 style="margin:2px 0 0 0;color:#5a3818;font-size:16px;font-weight:normal;">С чего начать</h3>
      <ol style="margin:0;padding-left:18px;">
        <li>Откройте <a href="${escapeHtml(demoHref)}" style="${linkStyle}">главную страницу</a>.</li>
        <li>В шапке попробуйте глобальный поиск по слову <a href="${escapeHtml(udarenieAllHash)}" style="${linkStyle}" id="home-howto-link-udarenie">ударение</a>.</li>
        <li>Откройте <a href="${escapeHtml(subjectListHash)}" style="${linkStyle}">«Предметный»</a> и посмотрите охват темы по страницам.</li>
        <li>Перейдите в <a href="${escapeHtml(toponymsListHash)}" style="${linkStyle}">«Топонимы»</a> и найдите <a href="${escapeHtml(angliaHash)}" style="${linkStyle}">Англия</a>.</li>
        <li>Откройте <a href="${escapeHtml(languagesMapHash)}" style="${linkStyle}">карту языков</a> и сравните с карточками.</li>
      </ol>

      <p style="margin:0;">Так BookIndex превращается в живую карту книги, а не просто в список ссылок.</p>
    </div>
  </details>`;
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
  const isDesktop = vw >= 980;
  const compactHome = isDesktop && vh > 0 && vh <= 840;
  const routeGridStyle = compactHome
    ? 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px;'
    : isDesktop
      ? 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px;'
      : 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:24px;';
  const homeInnerPadding = compactHome ? '10px 14px' : '14px 20px';
  const factPairStyle = compactHome
    ? 'display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,0.95fr);gap:8px;align-items:start;'
    : 'display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px;align-items:start;';
  const quoteTextClamp = compactHome
    ? 'display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;'
    : '';

  let html = `<div class="panel active home-panel" style="overflow-y:auto;height:100%;"><div style="padding:${homeInnerPadding};max-width:1200px;margin:0 auto;">`;

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
        <div style="margin-top:6px;font-style:normal;opacity:0.85;">— ${renderTextWithPageLinks(`стр. ${featured.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#fff8e8;', rangeTarget: 'trends' })}, лекция «${escapeHtml(featured.lecture)}»</div>
        <div style="margin-top:8px;font-style:normal;opacity:0.9;font-size:11px;">Выберите свой путь по книге — если не знаете, с чего начать, выберите тему, которая вас интересует.</div>
      </div>
    </div>
  </div></div>`;

  const recentItems = loadRecentItems().slice(0, 10);

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
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:96px;">
          <div style="font-size:11px;color:#888;white-space:nowrap;">📑 страницы ${escapeHtml(r.pages)}</div>
          <div style="font-size:20px;line-height:1;min-width:20px;text-align:right;">${safeIcon(r.icon)}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#444;line-height:1.45;margin-bottom:6px;">${escapeHtml(r.desc)}</div>
      <div style="font-size:11px;">`;
    for (const e of r.entities) {
      html += `<a class="route-link" data-type="${escapeHtml(e.type)}" data-head="${escapeHtml(e.head)}" href="${escapeHtml(buildItemHash(e.type, e.head))}" style="display:inline-block;padding:2px 8px;background:#f0e8d8;border-radius:10px;margin:2px 2px 2px 0;cursor:pointer;color:#5a3818;text-decoration:underline dotted;">${escapeHtml(e.head)}</a>`;
    }
    html += '</div></div>';
  }
  html += '</div>';
  if (compactHome) html += '</details>';
  html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;margin-bottom:14px;">
    <div style="font-size:14px;color:#5a3818;font-weight:normal;margin-bottom:6px;">Недавно открывали</div>
    <div id="home-recent-items" style="font-size:12px;line-height:1.6;">${recentItems.length ? '' : '<span style="color:#888;">Пока пусто — откройте любую карточку.</span>'}</div>
  </div>`;
  html += buildHomeHowToGuideHtml();

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

function openReadingPageTrends(page) {
  const maxPage = Number((APP_DATA && APP_DATA.book_stats && APP_DATA.book_stats.total_pages) || 404) || 404;
  const p = Math.max(1, Math.min(maxPage, Number.isFinite(page) ? page : parseInt(String(page || ''), 10) || 1));
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
}

function buildReadingNowHash(page) {
  const p = clampPageInBook(Number.isFinite(page) ? page : parseInt(String(page || ''), 10));
  return buildCanonicalHash(['materials', 'lectures', 'reading', String(p)]);
}

function openReadingNowPage(page) {
  const p = clampPageInBook(Number.isFinite(page) ? page : parseInt(String(page || ''), 10));
  saveReadingPage(p);
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

function wireReadingNowWidget(root, totalPages = 404) {
  if (!root || typeof root.querySelector !== 'function') return;
  const readingInput = root.querySelector('#reading-page-input');
  const readingGo = root.querySelector('#reading-page-go');
  const readingPrev = root.querySelector('#reading-page-prev');
  const readingNext = root.querySelector('#reading-page-next');
  const readingTrends = root.querySelector('#reading-page-trends');
  const readingResults = root.querySelector('#reading-now-results');
  if (!readingInput || !readingGo || !readingResults) return;
  const maxPage = Math.max(1, Number(totalPages) || 404);
  const clampReadingPage = (page) => {
    const raw = Number.isFinite(page) ? page : parseInt(String(page || ''), 10);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(maxPage, raw));
  };
  const getInputPage = () => clampReadingPage(parseInt(readingInput.value || '', 10));
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
    saveReadingPage(currentPage);
    updateReadingPagerControls(currentPage);
    readingInput.value = String(currentPage);
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
      btn.onclick = () => openReadingPageTrends(parseInt(btn.dataset.page || '', 10));
    });
    readingResults.querySelectorAll('.reading-now-open-lecture').forEach(btn => {
      btn.onclick = () => openLecturePage(parseInt(btn.dataset.idx || '0', 10) || 0);
    });
  };

  const savedPage = getSavedReadingPage();
  const defaultPage = Number.isFinite(savedPage) ? clampReadingPage(savedPage) : 1;
  readingInput.value = String(defaultPage);
  renderReadingNow(defaultPage);
  readingGo.onclick = () => renderReadingNow(getInputPage());
  if (readingPrev) readingPrev.onclick = () => renderReadingNow(getInputPage() - 1);
  if (readingNext) readingNext.onclick = () => renderReadingNow(getInputPage() + 1);
  if (readingTrends) readingTrends.onclick = () => openReadingPageTrends(getInputPage());
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

function renderTasksPanel(container, options = {}) {
  const collapseHistory = !!(options && options.collapseHistory);
  const baseTasks = Array.isArray(APP_DATA.tasks) ? APP_DATA.tasks : [];
  const dynamicTasks = buildDynamicTasks();
  const tasks = [...baseTasks, ...dynamicTasks];
  const tasksPrepared = tasks.map((task, idx) => ({
    ...task,
    _taskIndex: idx,
    _storageId: getTaskStorageId(task, idx),
  }));
  const tasksShuffled = shuffleArray(tasksPrepared);
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:980px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u0435\u0431\u044f</h2>';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">';
  html += `<div style="font-size:12px;color:#888;font-style:italic;">${baseTasks.length} \u0431\u0430\u0437\u043e\u0432\u044b\u0445 + ${dynamicTasks.length} \u0434\u0438\u043d\u0430\u043c\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0432\u043e\u043f\u0440\u043e\u0441\u043e\u0432. \u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043d\u0430 \u043e\u0442\u0432\u0435\u0442, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c.</div>`;
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
  html += '<button id="tasks-reset-progress" style="padding:6px 10px;border:1px solid #d1b18f;background:#fff;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#8a3f1c;">\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443</button>';
  html += '<button id="tasks-regen" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">\u041d\u043e\u0432\u0430\u044f \u043f\u043e\u0434\u0431\u043e\u0440\u043a\u0430</button>';
  html += '</div>';
  html += '</div>';
  html += '<div id="tasks-summary" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:10px 12px;margin-bottom:12px;"></div>';
  html += `<details id="tasks-history-box" style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:8px 12px;margin-bottom:14px;"${collapseHistory ? '' : ' open'}>`;
  html += '<summary id="tasks-history-summary" style="font-size:12px;color:#6a5040;font-weight:bold;letter-spacing:0.3px;text-transform:uppercase;cursor:pointer;user-select:none;outline:none;">\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u0442\u0432\u0435\u0442\u043e\u0432</summary>';
  html += '<div style="margin-top:8px;">';
  html += '<div id="tasks-history-list" style="display:grid;gap:6px;"></div>';
  html += '</div></details>';
  html += '<div id="tasks-container"></div></div></div>';
  container.innerHTML = html;

  const tc = document.getElementById('tasks-container');
  const summaryEl = document.getElementById('tasks-summary');
  const historyListEl = document.getElementById('tasks-history-list');
  const currentTaskIds = new Set(tasksShuffled.map(t => String(t._storageId || '').trim()).filter(Boolean));

  const formatHistoryDate = (ts) => {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '\u2014';
    try {
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return d.toISOString();
    }
  };

  const renderProgressPanels = (progressData = getStoredTasksProgress()) => {
    const progress = normalizeTasksProgress(progressData);
    const totalAnswered = progress.totalAnswered;
    const totalCorrect = progress.totalCorrect;
    const totalAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    let packAnswered = 0;
    let packCorrect = 0;
    for (const taskId of currentTaskIds) {
      const row = progress.byTask[taskId];
      if (!row) continue;
      packAnswered += Number(row.answered || 0);
      packCorrect += Number(row.correct || 0);
    }
    const packAccuracy = packAnswered ? Math.round((packCorrect / packAnswered) * 100) : 0;

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="font-size:13px;color:#5a3818;line-height:1.5;">
          <strong>\u0412\u0441\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0438</strong><br>
          \u041e\u0442\u0432\u0435\u0442\u043e\u0432: <strong>${totalAnswered}</strong> \u00b7
          \u0432\u0435\u0440\u043d\u044b\u0445: <strong>${totalCorrect}</strong> \u00b7
          \u0442\u043e\u0447\u043d\u043e\u0441\u0442\u044c: <strong>${totalAccuracy}%</strong>
        </div>
        <div style="font-size:13px;color:#5a3818;line-height:1.5;">
          <strong>\u0422\u0435\u043a\u0443\u0449\u0430\u044f \u043f\u043e\u0434\u0431\u043e\u0440\u043a\u0430</strong><br>
          \u041e\u0442\u0432\u0435\u0442\u043e\u0432: <strong>${packAnswered}</strong> \u00b7
          \u0432\u0435\u0440\u043d\u044b\u0445: <strong>${packCorrect}</strong> \u00b7
          \u0442\u043e\u0447\u043d\u043e\u0441\u0442\u044c: <strong>${packAccuracy}%</strong>
        </div>
      `;
    }

    if (historyListEl) {
      const rows = progress.history.slice(0, 12);
      if (!rows.length) {
        historyListEl.innerHTML = '<div style="font-size:12px;color:#888;font-style:italic;">\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0442\u0432\u0435\u0442\u043e\u0432. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u0432 \u043b\u044e\u0431\u043e\u043c \u0432\u043e\u043f\u0440\u043e\u0441\u0435, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e.</div>';
      } else {
        historyListEl.innerHTML = rows.map((row) => `
          <div class="task-history-row" style="padding:7px 8px;border:1px solid #ece1cf;border-radius:4px;background:${row.isCorrect ? '#eef8ef' : '#fff7ef'};">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <strong style="font-size:12px;color:${row.isCorrect ? '#1f6c3a' : '#8a4c25'};">${row.isCorrect ? '\u0412\u0435\u0440\u043d\u043e' : '\u041e\u0448\u0438\u0431\u043a\u0430'}</strong>
              <span style="font-size:11px;color:#7a6a58;">${escapeHtml(formatHistoryDate(row.at))}</span>
            </div>
            <div style="font-size:12px;color:#5a3818;line-height:1.4;margin-top:4px;">${escapeHtml(row.question)}</div>
            <div style="font-size:11px;color:#6a5040;margin-top:4px;">\u0412\u0430\u0448 \u043e\u0442\u0432\u0435\u0442: <strong>${escapeHtml(row.selected || '\u2014')}</strong>${row.correctAnswer ? ` \u00b7 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e: <strong>${escapeHtml(row.correctAnswer)}</strong>` : ''}</div>
          </div>
        `).join('');
      }
    }
  };

  for (let ti = 0; ti < tasksShuffled.length; ti++) {
    const t = tasksShuffled[ti];
    const taskDiv = document.createElement('div');
    taskDiv.style.cssText = 'background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:14px 18px;margin-bottom:12px;';
    taskDiv.innerHTML = `
      <div style="font-size:14px;color:#5a3818;font-weight:bold;margin-bottom:10px;">\u0412\u043e\u043f\u0440\u043e\u0441 ${ti+1}. ${escapeHtml(t.question)}</div>
      <div class="task-options" id="task-tab-${t._storageId}-opts"></div>
      <div class="task-result" id="task-tab-${t._storageId}-res" style="display:none;margin-top:10px;padding:10px 12px;border-radius:4px;font-size:12px;line-height:1.5;"></div>
    `;
    tc.appendChild(taskDiv);
    const optsDiv = document.getElementById(`task-tab-${t._storageId}-opts`);
    const optionsShuffled = shuffleArray((t.options || []).map((text, idx) => ({ text, idx })));
    for (let oi = 0; oi < optionsShuffled.length; oi++) {
      const opt = optionsShuffled[oi];
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:6px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:13px;color:#444;transition:all 0.1s;';
      btn.dataset.sourceIndex = String(opt.idx);
      btn.textContent = String.fromCharCode(65 + oi) + '. ' + opt.text;
      btn.onclick = () => {
        if (optsDiv.dataset.locked === '1') return;
        optsDiv.dataset.locked = '1';
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
        const res = document.getElementById(`task-tab-${t._storageId}-res`);
        res.style.display = 'block';
        res.style.background = isCorrect ? '#e8f5e9' : '#fff8e8';
        res.style.borderLeft = '3px solid ' + (isCorrect ? '#5cb85c' : '#8a7050');
        const linkHref = t.entity
          ? ((t.entity.type || '') === 'lecture'
            ? buildLecturePageHash(t.entity.index)
            : buildItemHash(t.entity.type || 'all', t.entity.head || ''))
          : '';
        const linkBtn = t.entity
          ? ` <a class="task-card-link" data-type="${escapeHtml(t.entity.type || '')}" data-head="${escapeHtml(t.entity.head || '')}" data-lecture-idx="${escapeHtml(t.entity.index != null ? String(t.entity.index) : '')}" href="${escapeHtml(linkHref)}" style="cursor:pointer;text-decoration:underline dotted;color:#5a3818;font-weight:bold;">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u2192</a>`
          : '';
        res.innerHTML = (isCorrect ? '<strong>\u0412\u0435\u0440\u043d\u043e!</strong> ' : '<strong>\u041d\u0435 \u0443\u0433\u0430\u0434\u0430\u043b\u0438.</strong> ')
          + renderTextWithPageLinks(t.hint, {
            className: 'task-page-link card-page-link related-link',
            style: 'text-decoration:underline dotted;color:#5a3818;',
            rangeTarget: 'trends',
          })
          + linkBtn;
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
        const progress = recordTaskAnswer(t, opt.text, isCorrect);
        renderProgressPanels(progress);
        persistViewState();
      };
      optsDiv.appendChild(btn);
    }
  }

  renderProgressPanels();
  const regenBtn = document.getElementById('tasks-regen');
  if (regenBtn) regenBtn.onclick = () => renderTasksPanel(container, { collapseHistory: true });
  const resetProgressBtn = document.getElementById('tasks-reset-progress');
  if (resetProgressBtn) {
    resetProgressBtn.onclick = () => {
      clearStoredTasksProgress();
      renderProgressPanels();
      announceUiMessage('\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u044b');
    };
  }
}

function renderLecturesPanel(container) {
  const lectures = APP_DATA.lectures || [];
  const stats = APP_DATA.book_stats || {};
  const maxPage = Number(stats.total_pages) || 404;
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1200px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Все лекции книги — за пять минут</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px;">Краткие резюме: 10 лекций + предисловие. Нажмите карточку, чтобы открыть отдельную мини-страницу.</div>';
  html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:12px 14px;margin-bottom:14px;">
    <div style="font-size:16px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Режим «Читаю сейчас»</div>
    <div style="font-size:12px;color:#777;margin-bottom:8px;">Введите номер страницы, и мы покажем, кто и что на ней упоминается.</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button id="reading-page-prev" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">←</button>
      <input id="reading-page-input" type="number" min="1" max="${escapeHtml(maxPage)}" step="1" style="width:120px;padding:6px 8px;border:1px solid #c4b890;border-radius:4px;font-family:inherit;font-size:13px;" />
      <button id="reading-page-next" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">→</button>
      <button id="reading-page-go" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Показать</button>
      <button id="reading-page-trends" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Динамика страницы</button>
    </div>
    <div id="reading-now-results" style="margin-top:10px;font-size:12px;line-height:1.6;color:#444;"></div>
  </div>`;
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
  wireReadingNowWidget(container, maxPage);
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
  const chapterSetCache = new Map();
  const getChapterHeadsCached = (type, chapter) => {
    const key = `${type}|${chapter.start}|${chapter.end}|${chapter.name || ''}`;
    const cached = chapterSetCache.get(key);
    if (cached) return cached;
    const set = headsFor(type, chapter);
    chapterSetCache.set(key, set);
    return set;
  };
  const buildRecommendedLecturePairs = (limit = 8) => {
    const rows = [];
    for (let a = 0; a < chapters.length; a++) {
      for (let b = a + 1; b < chapters.length; b++) {
        const chA = chapters[a];
        const chB = chapters[b];
        let sharedTotal = 0;
        let uniqueTotal = 0;
        let sizeA = 0;
        let sizeB = 0;
        const sharedByType = [];
        for (const t of types) {
          const setA = getChapterHeadsCached(t.key, chA);
          const setB = getChapterHeadsCached(t.key, chB);
          let shared = 0;
          for (const head of setA) if (setB.has(head)) shared += 1;
          const onlyA = Math.max(0, setA.size - shared);
          const onlyB = Math.max(0, setB.size - shared);
          sharedTotal += shared;
          uniqueTotal += onlyA + onlyB;
          sizeA += setA.size;
          sizeB += setB.size;
          sharedByType.push({ label: t.label, shared });
        }
        if (sharedTotal < 2) continue;
        const balance = 1 - (Math.abs(sizeA - sizeB) / Math.max(1, sizeA + sizeB));
        const score = sharedTotal * 2 + Math.min(60, uniqueTotal) * 0.08 + balance;
        const topSignals = sharedByType
          .filter(x => x.shared > 0)
          .sort((x, y) => y.shared - x.shared)
          .slice(0, 2)
          .map(x => `${x.label}: ${x.shared}`)
          .join(' · ');
        rows.push({
          a,
          b,
          score,
          sharedTotal,
          reason: topSignals || 'общие сущности',
        });
      }
    }
    rows.sort((x, y) => y.score - x.score || y.sharedTotal - x.sharedTotal || x.a - y.a || x.b - y.b);
    return rows.slice(0, limit);
  };
  const recommendedPairs = buildRecommendedLecturePairs(10);

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
  if (recommendedPairs.length) {
    html += '<div style="margin:0 0 12px 0;padding:10px 12px;background:#fff8e8;border:1px solid #e2d6bf;border-radius:8px;">';
    html += '<div style="font-size:12px;color:#6a5040;font-weight:bold;margin-bottom:6px;">Осмысленные пары для сравнения</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    for (const rec of recommendedPairs) {
      const selected =
        (rec.a === lectureCompareA && rec.b === lectureCompareB) ||
        (rec.a === lectureCompareB && rec.b === lectureCompareA);
      html += `<button type="button" class="lecture-compare-pair ${selected ? 'active' : ''}" data-a="${rec.a}" data-b="${rec.b}" style="padding:4px 10px;border:1px solid ${selected ? '#5a3818' : '#c4b890'};border-radius:999px;background:${selected ? '#5a3818' : '#fff'};color:${selected ? '#fff' : '#5a3818'};cursor:pointer;font-size:11px;">
        ${escapeHtml(chapterLabel(rec.a, chapters[rec.a]))} ↔ ${escapeHtml(chapterLabel(rec.b, chapters[rec.b]))}
        <span style="opacity:0.8;">(${escapeHtml(rec.reason)})</span>
      </button>`;
    }
    html += '</div></div>';
  }

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
  container.querySelectorAll('.lecture-compare-pair[data-a][data-b]').forEach(btn => {
    btn.onclick = () => {
      lectureCompareA = clampIdx(parseInt(btn.dataset.a || '0', 10));
      lectureCompareB = clampIdx(parseInt(btn.dataset.b || '1', 10));
      if (lectureCompareA === lectureCompareB) lectureCompareB = (lectureCompareA + 1) % chapters.length;
      renderLectureComparePanel(container);
      persistViewState();
    };
  });
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
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0;">Что почитать ещё</h2>';
  html += '<button id="export-further-bib" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Экспорт BibTeX (.bib)</button>';
  html += '</div>';
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
  const exportFurtherBibBtn = container.querySelector('#export-further-bib');
  if (exportFurtherBibBtn) {
    exportFurtherBibBtn.onclick = () => {
      const entries = collectFurtherReadingBibEntries();
      if (!entries.length) return;
      downloadBibtexFile('further-reading.bib', entries);
      announceUiMessage('BibTeX exported');
    };
  }
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

function findSnippetMatch(snippet, query) {
  const text = String(snippet || '');
  const q = String(query || '').trim();
  if (!text || !q) return null;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const re = new RegExp(escaped, 'i');
    const m = re.exec(text);
    if (m && Number.isInteger(m.index)) {
      return { index: m.index, len: String(m[0] || '').length || q.length };
    }
  } catch (e) {}
  const textFold = text.toLowerCase().replace(/ё/g, 'е');
  const qFold = q.toLowerCase().replace(/ё/g, 'е');
  const idx = textFold.indexOf(qFold);
  if (idx >= 0) return { index: idx, len: qFold.length };
  return null;
}

function buildKwicContextRow(opts) {
  const page = parseInt(String(opts.page || ''), 10);
  if (!Number.isFinite(page) || page < 1) return null;
  const snippet = String(opts.snippet || '').replace(/\s+/g, ' ').trim();
  if (!snippet) return null;
  let hit = findSnippetMatch(snippet, opts.query || '');
  if (!hit) {
    const hints = Array.isArray(opts.matchHints)
      ? opts.matchHints
      : [opts.matchHint];
    for (const hint of hints) {
      hit = findSnippetMatch(snippet, hint || '');
      if (hit) break;
    }
  }
  if (!hit && opts.allowLeadingFallback) {
    const m = /[A-Za-zА-Яа-яЁё0-9-]{2,}/.exec(snippet);
    if (m && Number.isInteger(m.index)) {
      hit = { index: m.index, len: String(m[0] || '').length || 2 };
    }
  }
  if (!hit) return null;
  const idx = Math.max(0, hit.index);
  const len = Math.max(1, hit.len || 1);
  const leftStart = Math.max(0, idx - 64);
  const rightEnd = Math.min(snippet.length, idx + len + 64);
  const leftText = snippet.slice(leftStart, idx);
  const keyText = snippet.slice(idx, idx + len);
  const rightText = snippet.slice(idx + len, rightEnd);
  return {
    source: String(opts.source || 'lexicon'),
    term: String(opts.term || ''),
    itemType: String(opts.itemType || 'lexicon'),
    itemHead: String(opts.itemHead || ''),
    page,
    leftPrefix: leftStart > 0 ? '…' : '',
    leftText,
    keyText,
    rightText,
    rightSuffix: rightEnd < snippet.length ? '…' : '',
    sortLeft: normalizeHeadForMatch(leftText.slice(-40)),
    sortRight: normalizeHeadForMatch(rightText.slice(0, 40)),
  };
}

function iterateKwicContextEntries(contexts, pageStart, pageEnd) {
  const safe = contexts && typeof contexts === 'object' && !Array.isArray(contexts) ? contexts : {};
  const entries = [];
  for (const [pageRaw, snippets] of Object.entries(safe)) {
    const page = parseInt(String(pageRaw || ''), 10);
    if (!Number.isFinite(page) || page < pageStart || page > pageEnd) continue;
    if (!Array.isArray(snippets)) continue;
    const normalizedSnippets = [];
    for (const raw of snippets) {
      const snippet = normalizeContextSnippet(raw);
      if (!snippet) continue;
      normalizedSnippets.push(snippet);
      if (normalizedSnippets.length >= KWIC_MAX_SNIPPETS_PER_PAGE) break;
    }
    if (!normalizedSnippets.length) continue;
    entries.push({ page, snippets: normalizedSnippets });
  }
  return entries;
}

function collectLexiconKwicRows(query, pageStart, pageEnd) {
  const q = clampUiInput(query, MAX_LIST_QUERY_LENGTH);
  const qNorm = normalizeHeadForMatch(q);
  if (qNorm.length < 2) return [];
  const rows = [];
  rows._truncated = false;
  const items = Array.isArray(APP_DATA?.lexicon) ? APP_DATA.lexicon : [];
  for (const it of items) {
    const head = String(it?.head || '').trim();
    if (!head) continue;
    const contextEntries = iterateKwicContextEntries(it && it.contexts, pageStart, pageEnd);
    for (const entry of contextEntries) {
      const page = entry.page;
      const snippets = entry.snippets;
      for (const raw of snippets) {
        const snippetNorm = normalizeHeadForMatch(raw);
        if (!snippetNorm.includes(qNorm)) continue;
        const row = buildKwicContextRow({
          source: 'lexicon',
          term: head,
          itemType: 'lexicon',
          itemHead: head,
          page,
          snippet: raw,
          query: q,
        });
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

function collectGlossaryKwicRows(query, pageStart, pageEnd) {
  const q = clampUiInput(query, MAX_LIST_QUERY_LENGTH);
  const qNorm = normalizeHeadForMatch(q);
  if (qNorm.length < 2) return [];
  const rows = [];
  rows._truncated = false;
  const seen = new Set();
  const glossary = Array.isArray(APP_DATA?.glossary) ? APP_DATA.glossary : [];
  const lexItems = Array.isArray(APP_DATA?.lexicon) ? APP_DATA.lexicon : [];
  for (const g of glossary) {
    const term = String(g?.term || '').trim();
    const definition = String(g?.definition || '').trim();
    const termNorm = normalizeHeadForMatch(term);
    const defNorm = normalizeHeadForMatch(definition);
    if (!termNorm) continue;
    if (!(termNorm.includes(qNorm) || defNorm.includes(qNorm) || qNorm.includes(termNorm))) continue;

    for (const item of lexItems) {
      const itemHead = String(item?.head || '').trim();
      if (!itemHead) continue;
      const contextEntries = iterateKwicContextEntries(item && item.contexts, pageStart, pageEnd);
      for (const entry of contextEntries) {
        const page = entry.page;
        const snippets = entry.snippets;
        for (const raw of snippets) {
          const row = buildKwicContextRow({
            source: 'glossary',
            term,
            itemType: 'lexicon',
            itemHead,
            page,
            snippet: raw,
            query: q,
            matchHints: [term],
          });
          if (!row) continue;
          const key = `${row.term}|${row.itemType}|${row.itemHead}|${row.page}|${row.leftText}|${row.keyText}|${row.rightText}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push(row);
          if (rows.length >= KWIC_MAX_ROWS) {
            rows._truncated = true;
            return rows;
          }
        }
      }
    }
  }
  return rows;
}

function sortKwicRows(rows, mode) {
  const sortMode = normalizeKwicSort(mode);
  rows.sort((a, b) => {
    if (sortMode === 'page') {
      return (a.page - b.page) || compareHeadsRu(a.itemHead, b.itemHead);
    }
    if (sortMode === 'right') {
      return compareHeadsRu(a.sortRight, b.sortRight) ||
        compareHeadsRu(a.sortLeft, b.sortLeft) ||
        (a.page - b.page) ||
        compareHeadsRu(a.itemHead, b.itemHead);
    }
    return compareHeadsRu(a.sortLeft, b.sortLeft) ||
      compareHeadsRu(a.sortRight, b.sortRight) ||
      (a.page - b.page) ||
      compareHeadsRu(a.itemHead, b.itemHead);
  });
}

function renderKwicPanel(container) {
  const totalPages = getTotalBookPages();
  currentKwicSource = normalizeKwicSource(currentKwicSource);
  currentKwicSort = normalizeKwicSort(currentKwicSort);
  currentKwicQuery = clampUiInput(currentKwicQuery, MAX_LIST_QUERY_LENGTH);
  currentKwicPageStart = clampPageInBook(currentKwicPageStart);
  currentKwicPageEnd = clampPageInBook(currentKwicPageEnd);
  if (currentKwicPageStart > currentKwicPageEnd) {
    const a = currentKwicPageStart;
    currentKwicPageStart = currentKwicPageEnd;
    currentKwicPageEnd = a;
  }
  const queuedKwicTerm = (() => {
    const localPending = clampUiInput(pendingKwicTerm || '', MAX_LIST_QUERY_LENGTH);
    if (localPending) return localPending;
    if (typeof window === 'undefined') return '';
    return clampUiInput(window._pendingKwicTerm || '', MAX_LIST_QUERY_LENGTH);
  })();
  if (queuedKwicTerm) {
    currentKwicSource = 'lexicon';
    currentKwicQuery = queuedKwicTerm;
    pendingKwicTerm = '';
    if (typeof window !== 'undefined') window._pendingKwicTerm = '';
  }

  container.innerHTML = `<div class="panel active" style="overflow-y:auto;height:100%;">
    <div style="padding:16px 22px;max-width:1200px;margin:0 auto;">
      <h2 style="font-size:20px;color:var(--title);font-weight:normal;margin:0 0 4px 0;">KWIC-конкорданс</h2>
      <div style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:12px;">
        Key Word In Context: показывает ключевое слово в его ближайшем окружении.
      </div>
      <div style="display:grid;grid-template-columns:1fr 190px 190px 150px 140px 140px;gap:8px;align-items:end;margin-bottom:10px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted);">
          Запрос
          <input id="kwic-query" type="text" value="${escapeHtml(currentKwicQuery)}" placeholder="например: энклитика" style="padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted);">
          Источник
          <select id="kwic-source" style="padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;">
            <option value="lexicon"${currentKwicSource === 'lexicon' ? ' selected' : ''}>Лексика (статьи)</option>
            <option value="glossary"${currentKwicSource === 'glossary' ? ' selected' : ''}>Глоссарий (термины)</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted);">
          Сортировка
          <select id="kwic-sort" style="padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;">
            <option value="left"${currentKwicSort === 'left' ? ' selected' : ''}>по левому контексту</option>
            <option value="right"${currentKwicSort === 'right' ? ' selected' : ''}>по правому контексту</option>
            <option value="page"${currentKwicSort === 'page' ? ' selected' : ''}>по странице</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted);">
          Стр. от
          <input id="kwic-page-start" type="number" min="1" max="${totalPages}" value="${currentKwicPageStart}" style="padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted);">
          Стр. до
          <input id="kwic-page-end" type="number" min="1" max="${totalPages}" value="${currentKwicPageEnd}" style="padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;">
        </label>
        <button id="kwic-run" type="button" style="height:34px;padding:0 12px;border:1px solid var(--line);border-radius:4px;background:var(--surface-soft);color:var(--title);cursor:pointer;font-family:inherit;">Показать</button>
      </div>
      <div id="kwic-source-hint" style="font-size:11px;color:var(--muted);margin:0 0 8px 0;"></div>
      <div id="kwic-meta" style="font-size:12px;color:var(--muted);margin:6px 0 10px 0;"></div>
      <div id="kwic-results" style="display:grid;gap:8px;"></div>
    </div>
  </div>`;

  const queryInput = container.querySelector('#kwic-query');
  const sourceInput = container.querySelector('#kwic-source');
  const sortInput = container.querySelector('#kwic-sort');
  const startInput = container.querySelector('#kwic-page-start');
  const endInput = container.querySelector('#kwic-page-end');
  const runBtn = container.querySelector('#kwic-run');
  const sourceHintEl = container.querySelector('#kwic-source-hint');
  const metaEl = container.querySelector('#kwic-meta');
  const resultsEl = container.querySelector('#kwic-results');
  let renderTimer = null;

  const renderSourceHint = () => {
    if (!sourceHintEl) return;
    if (currentKwicSource === 'glossary') {
      sourceHintEl.innerHTML = '<strong>Глоссарий:</strong> учебные определения терминов (например, энклитика, аблаут).';
      return;
    }
    sourceHintEl.innerHTML = '<strong>Лексика:</strong> словарные карточки слов/форм и их контексты в книге.';
  };

  const renderRows = () => {
    currentKwicSource = normalizeKwicSource(sourceInput.value);
    renderSourceHint();
    currentKwicSort = normalizeKwicSort(sortInput.value);
    currentKwicQuery = clampUiInput(queryInput.value, MAX_LIST_QUERY_LENGTH);
    queryInput.value = currentKwicQuery;
    currentKwicPageStart = clampPageInBook(startInput.value);
    currentKwicPageEnd = clampPageInBook(endInput.value);
    if (currentKwicPageStart > currentKwicPageEnd) {
      const a = currentKwicPageStart;
      currentKwicPageStart = currentKwicPageEnd;
      currentKwicPageEnd = a;
    }
    startInput.value = String(currentKwicPageStart);
    endInput.value = String(currentKwicPageEnd);

    const qNorm = normalizeHeadForMatch(currentKwicQuery);
    if (qNorm.length < 2) {
      metaEl.textContent = 'Введите минимум 2 символа для KWIC-поиска.';
      resultsEl.innerHTML = '<div style="padding:10px 12px;border:1px dashed var(--line);border-radius:6px;background:var(--surface);color:var(--muted);">Например: «энклитика», «санскрит», «закон».</div>';
      persistViewState();
      return;
    }

    const rows = currentKwicSource === 'glossary'
      ? collectGlossaryKwicRows(currentKwicQuery, currentKwicPageStart, currentKwicPageEnd)
      : collectLexiconKwicRows(currentKwicQuery, currentKwicPageStart, currentKwicPageEnd);
    sortKwicRows(rows, currentKwicSort);
    const kwicTruncated = rows && rows._truncated === true;

    if (!rows.length) {
      metaEl.textContent = `Совпадений не найдено: ${currentKwicSource === 'glossary' ? 'глоссарий' : 'лексика'}, стр. ${currentKwicPageStart}-${currentKwicPageEnd}.`;
      resultsEl.innerHTML = '<div style="padding:10px 12px;border:1px dashed var(--line);border-radius:6px;background:var(--surface);color:var(--muted);">Попробуйте расширить диапазон страниц или изменить запрос.</div>';
      persistViewState();
      return;
    }

    const terms = new Set(rows.map(r => r.term));
    const truncText = kwicTruncated ? ` Показаны первые ${KWIC_MAX_ROWS}.` : '';
    metaEl.textContent = `Найдено ${rows.length} контекстов (${terms.size} терминов), источник: ${currentKwicSource === 'glossary' ? 'глоссарий' : 'лексика'}.${truncText}`;
    resultsEl.innerHTML = rows.map(r => `
      <div class="kwic-row" style="background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:10px 12px;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">
          <button type="button" class="kwic-open-card" data-type="${escapeHtml(r.itemType)}" data-head="${escapeHtml(r.itemHead)}" style="padding:2px 8px;border:1px solid var(--line);background:var(--surface-soft);border-radius:999px;cursor:pointer;color:var(--title);font-size:11px;font-family:inherit;">${escapeHtml(r.itemHead)}</button>
          ${r.source === 'glossary' ? `<button type="button" class="kwic-open-glossary" data-term="${escapeHtml(r.term)}" style="padding:2px 8px;border:1px solid var(--line);background:var(--surface-soft);border-radius:999px;cursor:pointer;color:var(--title);font-size:11px;font-family:inherit;">термин: ${escapeHtml(r.term)}</button>` : ''}
          <a class="kwic-page-link card-page-link related-link" data-page="${escapeHtml(String(r.page))}" href="${escapeHtml(buildReadingNowHash(r.page))}" style="font-size:11px;color:var(--muted);text-decoration:underline dotted;">стр. ${r.page}</a>
        </div>
        <div style="font-size:13px;line-height:1.55;color:var(--text);word-break:break-word;">
          <span style="color:var(--muted);">${escapeHtml(r.leftPrefix + r.leftText)}</span><mark style="background:#ffe2a8;color:#4a2e12;padding:0 2px;border-radius:2px;">${escapeHtml(r.keyText)}</mark><span>${escapeHtml(r.rightText + r.rightSuffix)}</span>
        </div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.kwic-open-card').forEach(btn => {
      bindActionWithKeyboard(btn, () => {
        navigateToItem(btn.dataset.type || 'lexicon', btn.dataset.head || '');
      });
    });
    resultsEl.querySelectorAll('.kwic-open-glossary').forEach(btn => {
      bindActionWithKeyboard(btn, () => {
        openGlossaryTerm(btn.dataset.term || '');
      });
    });
    resultsEl.querySelectorAll('.kwic-page-link[data-page]').forEach((el) => {
      bindActionWithKeyboard(el, () => {
        const page = parseInt((el.dataset && el.dataset.page) || '0', 10);
        openReadingNowPage(Number.isFinite(page) ? page : 1);
      });
    });

    persistViewState();
  };

  const scheduleRender = () => {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(renderRows, 120);
  };

  queryInput.oninput = scheduleRender;
  queryInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      renderRows();
    }
  };
  sourceInput.onchange = renderRows;
  sortInput.onchange = renderRows;
  startInput.onchange = renderRows;
  endInput.onchange = renderRows;
  runBtn.onclick = renderRows;
  renderRows();
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
    const pageRaw = parseInt(String(s.page || ''), 10);
    const pageNum = clampPageInBook(Number.isFinite(pageRaw) ? pageRaw : 1);
    const pageLabel = escapeHtml(String(s.page || pageNum));
    const pageMetaHtml = s.page
      ? `<a class="russian-evolution-page-link card-page-link related-link" data-page="${pageNum}" href="${escapeHtml(buildReadingNowHash(pageNum))}" style="text-decoration:underline dotted;color:#5a3818;">стр. ${pageLabel}</a>`
      : '';
    html += `<div style="display:grid;grid-template-columns:120px 1fr;gap:18px;margin-bottom:${isLast?'0':'24px'};position:relative;">
      <div style="text-align:right;border-right:3px solid #8a7050;padding-right:14px;padding-top:6px;">
        <div style="font-size:18px;font-weight:bold;color:#5a3818;">${escapeHtml(s.epoch)}</div>
        <div style="font-size:11px;color:#888;">≈ ${s.year} г.</div>
      </div>
      <div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:14px 18px;">
        <div style="font-size:15px;font-style:italic;color:#5a3818;line-height:1.6;margin-bottom:8px;">«${escapeHtml(s.sample)}»</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">${escapeHtml(s.translation)}</div>
        <div style="font-size:11px;color:#888;border-top:1px solid #f0e8d8;padding-top:6px;">${escapeHtml(s.note)}${pageMetaHtml ? ` · ${pageMetaHtml}` : ''}</div>
      </div>
    </div>`;
  }
  html += '</div></div>';
  container.innerHTML = html;
  container.querySelectorAll('.russian-evolution-page-link[data-page]').forEach((el) => {
    bindActionWithKeyboard(el, () => {
      const page = parseInt((el.dataset && el.dataset.page) || '0', 10);
      openReadingNowPage(Number.isFinite(page) ? page : 1);
    });
  });
}

// =========================================================
// ФОНЕТИЧЕСКИЕ ЗАКОНЫ
// =========================================================
function formatPhoneticTransitionText(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const parts = raw.split('\u2192');
  if (parts.length !== 2) return escapeHtml(raw);
  const left = escapeHtml(parts[0].trim()).replace(/\s+/g, '&nbsp;');
  const right = escapeHtml(parts[1].trim()).replace(/\s+/g, '&nbsp;');
  return `${left} <span class="phonetic-arrow">\u2192</span> ${right}`;
}

function formatPhoneticCommentText(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (!raw.includes('\u2192')) return escapeHtml(raw);
  const colon = raw.indexOf(':');
  if (colon > -1 && colon < raw.length - 1) {
    const prefix = raw.slice(0, colon + 1).trim();
    const tail = raw.slice(colon + 1).trim();
    if (tail.includes('\u2192')) {
      return `${escapeHtml(prefix)} ${formatPhoneticTransitionText(tail)}`;
    }
  }
  return formatPhoneticTransitionText(raw);
}

function renderPhoneticLawsPanel(container) {
  const laws = APP_DATA.phonetic_laws || [];
  let html = '<div class="panel active" style="overflow-y:auto;height:100%;"><div style="padding:16px 22px;max-width:1100px;margin:0 auto;">';
  html += '<h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Фонетические законы из лекций Зализняка</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px;">Восемь ключевых фонетических законов, обсуждаемых в книге, с примерами из текста. Для каждого закона показан переход «было → стало» и пояснение.</div>';
  for (const law of laws) {
    const lawMetaText = law.page
      ? `${law.discoverer} · ${law.year} · стр. ${law.page}`
      : `${law.discoverer} · ${law.year}`;
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:6px;padding:14px 20px;margin-bottom:14px;border-top:3px solid #8a7050;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
        <div style="font-size:17px;font-weight:bold;color:#5a3818;">${escapeHtml(law.name)}</div>
        <div style="font-size:11px;color:#888;">${renderTextWithPageLinks(lawMetaText, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })}</div>
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
      const fromHtml = escapeHtml(String(ex.from || '')).replace(/\s+/g, '&nbsp;');
      const toHtml = escapeHtml(String(ex.to || '')).replace(/\s+/g, '&nbsp;');
      const commentHtml = formatPhoneticCommentText(ex.comment || '');
      html += `<tr style="border-top:1px solid #f0e8d8;">
        <td style="padding:6px 8px 6px 0;font-style:italic;color:#5a3818;">${fromHtml}</td>
        <td style="padding:6px 8px;color:#1a1a1a;"><strong class="phonetic-arrow">\u2192</strong> <span class="phonetic-transition">${toHtml}</span></td>
        <td style="padding:6px 0 6px 8px;color:#666;font-size:12px;">${commentHtml}</td>
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
      return `<a class="chronology-event-link" href="${escapeHtml(target.href || buildCanonicalHash(['scholar', 'chronology']))}" data-mode="${escapeHtml(target.mode || '')}" data-type="${escapeHtml(target.type || '')}" data-head="${escapeHtml(target.head || '')}" data-query="${escapeHtml(target.query || '')}" style="display:grid;grid-template-columns:120px 1fr;gap:12px;background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:8px 10px;color:inherit;text-decoration:none;">
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

  let html = '<div class="panel active page-trends-panel"><div class="page-trends-shell">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">';
  html += '<div><h2 style="font-size:20px;color:#5a3818;font-weight:normal;margin:0 0 4px 0;">Динамика по страницам</h2>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:12px;">Выберите окно страниц и смотрите, как меняется плотность упоминаний и какие сущности усиливаются/ослабевают во второй половине диапазона.</div></div>';
  html += '<div style="display:flex;gap:6px;align-items:center;">';
  html += '<button id="trend-export-csv" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;color:#5a3818;">Экспорт CSV</button>';
  html += '<button id="trend-export-md" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;color:#5a3818;">Экспорт Markdown</button>';
  html += '<button id="trend-copy-link" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit;color:#5a3818;">Скопировать ссылку</button>';
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
      <div>${s.top.length ? s.top.map(it => `<a class="trend-link page-trend-chip" data-type="${escapeHtml(it.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(it.type, it.head))}" style="display:inline-block;padding:2px 7px;margin:2px 6px 2px 0;background:#f0e8d8;border-radius:10px;color:#5a3818;cursor:pointer;font-size:11px;text-decoration:none;">${escapeHtml(it.head)} · ${it.count}</a>`).join('') : '<span style="color:#999;font-size:12px;">—</span>'}</div>
    </div>`;
  }
  html += '</div>';

  const trendLinks = (rows, color) => rows.length
    ? rows.map(r => `<a class="trend-link page-trend-row" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}">
        <span class="page-trend-head">${escapeHtml(r.head)}</span>
        <span class="page-trend-metrics" style="color:${color};">${r.delta > 0 ? '+' : ''}${r.delta} (${r.leftCount}→${r.rightCount})</span>
      </a>`).join('')
    : '<div style="color:#999;font-size:12px;">—</div>';

  html += `<div class="page-trends-delta-grid">
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
    syncNavigationHashOnly();
  };
  const startRange = document.getElementById('trend-start-range');
  const endRange = document.getElementById('trend-end-range');
  const startInput = document.getElementById('trend-start-input');
  const endInput = document.getElementById('trend-end-input');
  const chapterSelect = document.getElementById('trend-chapter-select');
  const exportCsvBtn = document.getElementById('trend-export-csv');
  const exportMdBtn = document.getElementById('trend-export-md');
  const copyLinkBtn = document.getElementById('trend-copy-link');

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
  if (copyLinkBtn) {
    copyLinkBtn.onclick = async () => {
      const ok = await copyCurrentUrl();
      const prev = copyLinkBtn.textContent;
      copyLinkBtn.textContent = ok ? 'Ссылка скопирована' : 'Не удалось скопировать';
      announceUiMessage(ok ? 'Link copied' : 'Failed to copy link');
      setTimeout(() => { copyLinkBtn.textContent = prev; }, 1200);
    };
  }
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
  html += '<div style="display:flex;justify-content:flex-end;margin:-4px 0 10px 0;"><button id="export-scholar-biblio-bib" style="padding:6px 10px;border:1px solid #c4b890;background:#fff8e8;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;color:#5a3818;">Экспорт BibTeX (.bib)</button></div>';
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
    const controversyPageMeta = c.page
      ? renderTextWithPageLinks(`стр. ${c.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })
      : '';
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:12px 16px;margin-bottom:10px;border-left:4px solid #c0392b;">
      <div style="font-weight:bold;color:#5a3818;font-size:14px;margin-bottom:4px;">${escapeHtml(c.topic)}${controversyPageMeta ? ` <span style="font-size:11px;color:#888;font-weight:normal;">· ${controversyPageMeta}</span>` : ''}</div>
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
      const formPageMeta = f.page
        ? renderTextWithPageLinks(`стр. ${f.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })
        : '';
      html += `<div style="font-size:12px;margin-bottom:3px;"><span style="font-style:italic;color:#5a3818;font-family:'Noto Serif','DejaVu Serif',Georgia,serif;">${renderAccentSafe(f.form)}</span> — ${escapeHtml(f.translation)}${formPageMeta ? ` <span style="color:#888;">(${formPageMeta})</span>` : ''}</div>`;
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
      <td style="padding:6px 12px;color:#888;">${g.page ? renderTextWithPageLinks(`стр. ${g.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' }) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // 6. Хронология
  html += '<h3 id="sch-chronology" style="color:#5a3818;border-bottom:2px solid #8a7050;padding-bottom:4px;margin-top:20px;">6. Хронология лингвистических открытий</h3>';
  html += '<div style="font-size:12px;color:#888;font-style:italic;margin-bottom:10px;">События истории лингвистики, связанные с темами книги.</div>';
  for (const ev of (s.chronology || [])) {
    const chronologyPageMeta = ev.page
      ? renderTextWithPageLinks(`стр. ${ev.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })
      : '';
    html += `<div style="display:grid;grid-template-columns:80px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid #f0e8d8;">
      <div style="font-weight:bold;color:#5a3818;text-align:right;border-right:2px solid #8a7050;padding-right:10px;">${escapeHtml(ev.year)}</div>
      <div style="font-size:13px;">${escapeHtml(ev.event)}${chronologyPageMeta ? `<span style="color:#888;font-size:11px;"> · ${chronologyPageMeta}</span>` : ''}</div>
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
    const isoglossPageMeta = i.page
      ? renderTextWithPageLinks(`стр. ${i.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })
      : '';
    html += `<div style="background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #16a085;">
      <div style="font-weight:bold;color:#5a3818;font-size:13px;margin-bottom:4px;">${escapeHtml(i.name)}${isoglossPageMeta ? ` <span style="font-weight:normal;font-size:11px;color:#888;">· ${isoglossPageMeta}</span>` : ''}</div>
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
      const pageMeta = a.page
        ? `<span style="font-size:11px;color:#888;">${renderTextWithPageLinks(`стр. ${a.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })}</span>`
        : '';
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
        const pageMeta = c.page
          ? `<span style="font-size:11px;color:#888;">${renderTextWithPageLinks(`стр. ${c.page}`, { className: 'material-page-link card-page-link related-link', style: 'text-decoration:underline dotted;color:#5a3818;', rangeTarget: 'trends' })}</span>`
          : '';
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
  const corrRows = (s.sound_correspondences || []).map((r) => {
    const focusLangRaw = String(r.focus_language || 'санскрит');
    const focusLang = resolveExistingHead('languages', focusLangRaw);
    const langs = ['rus', 'lat', 'gre', 'san', 'eng', 'ger'].filter((key) => {
      const v = String(r[key] == null ? '' : r[key]).trim();
      return !!v && v !== '—';
    });
    return {
      ...r,
      _family: String(r.family || 'индоевропейская'),
      _law: String(r.law || 'базовое соответствие'),
      _source: String(r.source || 'Источник не указан'),
      _focusLang: focusLang,
      _langs: langs.join(','),
    };
  });
  const corrFamilies = Array.from(new Set(corrRows.map((r) => r._family))).sort(compareHeadsRu);
  const corrLaws = Array.from(new Set(corrRows.map((r) => r._law))).sort(compareHeadsRu);
  html += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px;background:#fff;border:1px solid #d4c8b0;border-radius:4px;padding:8px 10px;">
    <label style="font-size:11px;color:#6a5040;">Семья
      <select id="corr-family-filter" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
        <option value="">Все</option>
        ${corrFamilies.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
      </select>
    </label>
    <label style="font-size:11px;color:#6a5040;">Язык в строке
      <select id="corr-lang-filter" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;">
        <option value="">Любой</option>
        <option value="rus">Русский</option>
        <option value="lat">Латинский</option>
        <option value="gre">Древнегреческий</option>
        <option value="san">Санскрит</option>
        <option value="eng">Английский</option>
        <option value="ger">Немецкий</option>
      </select>
    </label>
    <label style="font-size:11px;color:#6a5040;">Фонетический закон
      <select id="corr-law-filter" style="display:block;margin-top:4px;padding:5px 8px;border:1px solid #c4b890;border-radius:4px;background:#fff;min-width:220px;">
        <option value="">Все</option>
        ${corrLaws.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('')}
      </select>
    </label>
  </div>`;
  html += '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;border-collapse:collapse;background:#fff;border:1px solid #d4c8b0;border-radius:4px;">';
  html += '<thead><tr style="background:#f0e8d8;"><th style="padding:6px 8px;text-align:left;">ПИЕ</th><th style="padding:6px 8px;text-align:left;">Русск.</th><th style="padding:6px 8px;text-align:left;">Лат.</th><th style="padding:6px 8px;text-align:left;">Греч.</th><th style="padding:6px 8px;text-align:left;">Санскр.</th><th style="padding:6px 8px;text-align:left;">Англ.</th><th style="padding:6px 8px;text-align:left;">Нем.</th><th style="padding:6px 8px;text-align:left;">Значение</th><th style="padding:6px 8px;text-align:left;">Закон/семья</th><th style="padding:6px 8px;text-align:left;">Источник</th><th style="padding:6px 8px;text-align:left;">Связи</th></tr></thead><tbody id="corr-table-body">';
  for (const r of corrRows) {
    const langHash = buildItemHash('languages', r._focusLang || 'санскрит');
    html += `<tr class="corr-row" role="button" tabindex="0" data-family="${escapeHtml(r._family)}" data-law="${escapeHtml(r._law)}" data-langs="${escapeHtml(r._langs)}" data-focus-lang="${escapeHtml(r._focusLang)}" style="border-top:1px solid #f0e8d8;cursor:pointer;">
      <td style="padding:6px 8px;font-style:italic;color:#5a3818;">${renderAccentSafe(r.pie)}</td>
      <td style="padding:6px 8px;font-weight:bold;">${renderAccentSafe(r.rus)}</td>
      <td style="padding:6px 8px;">${renderAccentSafe(r.lat)}</td>
      <td style="padding:6px 8px;font-family:'Noto Serif','DejaVu Serif',Georgia,serif;">${renderAccentSafe(r.gre)}</td>
      <td style="padding:6px 8px;font-family:'Noto Serif','DejaVu Serif',Georgia,serif;">${renderAccentSafe(r.san)}</td>
      <td style="padding:6px 8px;">${renderAccentSafe(r.eng)}</td>
      <td style="padding:6px 8px;">${renderAccentSafe(r.ger)}</td>
      <td style="padding:6px 8px;color:#888;font-style:italic;">${escapeHtml(r.meaning)}</td>
      <td style="padding:6px 8px;">
        <div style="font-size:11px;color:#5a3818;">${escapeHtml(r._law)}</div>
        <div style="font-size:11px;color:#888;">${escapeHtml(r._family)}</div>
      </td>
      <td style="padding:6px 8px;font-size:11px;color:#666;">${escapeHtml(r._source)}</td>
      <td style="padding:6px 8px;font-size:11px;">
        <a class="corr-lang-link" data-type="languages" data-head="${escapeHtml(r._focusLang)}" href="${escapeHtml(langHash)}" style="color:#5a3818;text-decoration:underline dotted;">язык ↗</a><br>
        <a class="corr-law-link" href="${escapeHtml(buildCanonicalHash(['materials', 'phonetic_laws']))}" style="color:#5a3818;text-decoration:underline dotted;">закон ↗</a>
      </td>
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
  const exportScholarBiblioBibBtn = container.querySelector('#export-scholar-biblio-bib');
  if (exportScholarBiblioBibBtn) {
    exportScholarBiblioBibBtn.onclick = () => {
      const entries = collectScholarBibliographyBibEntries();
      if (!entries.length) return;
      downloadBibtexFile('scholar-bibliography.bib', entries);
      announceUiMessage('BibTeX exported');
    };
  }
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
        const opts = prefersReducedMotion()
          ? { block: 'start' }
          : { block: 'start', behavior: 'smooth' };
        target.scrollIntoView(opts);
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
  bindNavigateLinks(container, '.corr-lang-link', 'languages');
  container.querySelectorAll('.corr-law-link').forEach((link) => {
    bindActionWithKeyboard(link, () => {
      currentEntity = 'materials';
      currentTab = 'phonetic_laws';
      selectedItem = null;
      selectedItemType = null;
      rightPaneMode = 'histogram';
      renderEntitySwitcher();
      renderTabs();
      renderContent();
      syncNavigationState();
    });
  });
  const corrFamilyFilter = container.querySelector('#corr-family-filter');
  const corrLangFilter = container.querySelector('#corr-lang-filter');
  const corrLawFilter = container.querySelector('#corr-law-filter');
  const corrBody = container.querySelector('#corr-table-body');
  const corrRowsEls = Array.from(container.querySelectorAll('.corr-row'));
  const applyCorrespondenceFilters = () => {
    const family = corrFamilyFilter && corrFamilyFilter.value ? String(corrFamilyFilter.value) : '';
    const lang = corrLangFilter && corrLangFilter.value ? String(corrLangFilter.value) : '';
    const law = corrLawFilter && corrLawFilter.value ? String(corrLawFilter.value) : '';
    let shown = 0;
    for (const row of corrRowsEls) {
      const rowFamily = String(row.dataset.family || '');
      const rowLaw = String(row.dataset.law || '');
      const langs = String(row.dataset.langs || '').split(',').filter(Boolean);
      const byFamily = !family || rowFamily === family;
      const byLaw = !law || rowLaw === law;
      const byLang = !lang || langs.includes(lang);
      const visible = byFamily && byLaw && byLang;
      row.style.display = visible ? '' : 'none';
      if (visible) shown += 1;
    }
    if (!corrBody) return;
    const oldEmpty = corrBody.querySelector('.corr-empty-row');
    if (oldEmpty) oldEmpty.remove();
    if (!shown) {
      const tr = document.createElement('tr');
      tr.className = 'corr-empty-row';
      tr.innerHTML = '<td colspan="11" style="padding:10px 12px;color:#888;font-style:italic;">Нет строк под текущие фильтры.</td>';
      corrBody.appendChild(tr);
    }
  };
  if (corrFamilyFilter) corrFamilyFilter.onchange = applyCorrespondenceFilters;
  if (corrLangFilter) corrLangFilter.onchange = applyCorrespondenceFilters;
  if (corrLawFilter) corrLawFilter.onchange = applyCorrespondenceFilters;
  if (corrBody) {
    corrBody.onclick = (e) => {
      const target = e && e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('a')) return;
      const row = target.closest('.corr-row');
      if (!row || !corrBody.contains(row)) return;
      const focusLang = String(row.dataset.focusLang || '');
      if (!focusLang) return;
      navigateToItem('languages', focusLang);
    };
    corrBody.onkeydown = (e) => {
      const key = e && e.key ? String(e.key) : '';
      if (key !== 'Enter' && key !== ' ') return;
      const target = e && e.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest('.corr-row');
      if (!row || !corrBody.contains(row)) return;
      e.preventDefault();
      const focusLang = String(row.dataset.focusLang || '');
      if (!focusLang) return;
      navigateToItem('languages', focusLang);
    };
  }
  applyCorrespondenceFilters();

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

registerAppServiceWorker();

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
