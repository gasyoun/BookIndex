// Данные парсятся из <script type="application/json"> (с fallback для тестов/legacy-сборки)
const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
/** @typedef {import('./types/app-data').AppData} AppDataShape */
/** @type {AppDataShape | null} */
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
const HOME_DECL_FACTORY_KEY = '__bookindexHomeDeclarativeFactory';

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
 * @returns {AppDataShape}
 */
function parseAppData() {
  clearGlobalSearchCaches();
  const payload = getEmbeddedAppDataText();
  if (!payload) throw new Error('Embedded app data not found');
  APP_DATA = /** @type {AppDataShape} */ (JSON.parse(payload));
  if (typeof window !== 'undefined') {
    window.APP_DATA = APP_DATA;
    window.__vizCache = {};
    window.VIZ_MODULES = window.VIZ_MODULES || {};
  } else if (typeof globalThis !== 'undefined') {
    globalThis.APP_DATA = APP_DATA;
    globalThis.__vizCache = {};
  }
  vizCacheWarmPromise = null;
  vizScriptLoadPromises = new Map();
  cleanupActiveVizModule();
  migrateAppDataSchema(APP_DATA);
  LABELS = APP_DATA.labels;
  COLORS = APP_DATA.colors;
  EPOCH_LABELS = APP_DATA.epoch_labels;
  EPOCH_COLORS = APP_DATA.epoch_colors;
  FAMILY_COLORS = APP_DATA.family_colors;
  return APP_DATA;
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

function buildDefaultCorpusRegistry() {
  const stats = APP_DATA && APP_DATA.book_stats && typeof APP_DATA.book_stats === 'object'
    ? APP_DATA.book_stats
    : {};
  const pages = Number.isFinite(Number(stats.pages_total)) ? Number(stats.pages_total) : 404;
  return {
    schema_version: 1,
    active_book_id: 'zaliznyak-aaz-index',
    books: [
      {
        book_id: 'zaliznyak-aaz-index',
        title: 'Из жизни слов и языков',
        author: 'А. А. Зализняк',
        year: 2026,
        edition: 'Альпина нон-фикшн',
        status: 'active',
        source_type: 'book',
        pages_total: pages,
        default_route: '#v4/home/home',
        content_modules: ['app_data.json'],
      },
    ],
    source_types: [
      {
        type: 'book',
        title: 'Книги',
        status: 'active',
      },
      {
        type: 'video_catalog',
        title: 'Видеокаталог',
        status: 'planned',
        planned_count: 200,
        supports: ['timecodes', 'transcripts'],
      },
    ],
  };
}

function normalizeCorpusRegistry() {
  if (!APP_DATA || typeof APP_DATA !== 'object') return;
  const defaults = buildDefaultCorpusRegistry();
  const raw = APP_DATA.corpus && typeof APP_DATA.corpus === 'object' ? APP_DATA.corpus : {};
  const books = Array.isArray(raw.books) && raw.books.length ? raw.books : defaults.books;
  const sourceTypes = Array.isArray(raw.source_types) && raw.source_types.length ? raw.source_types : defaults.source_types;
  APP_DATA.corpus = {
    ...defaults,
    ...raw,
    books,
    source_types: sourceTypes,
  };
  const activeId = typeof APP_DATA.corpus.active_book_id === 'string' ? APP_DATA.corpus.active_book_id : '';
  if (!books.some(book => book && book.book_id === activeId)) {
    APP_DATA.corpus.active_book_id = defaults.active_book_id;
  }
}

function normalizeAppData() {
  if (!APP_DATA) return;

  APP_DATA.labels = APP_DATA.labels || {};
  APP_DATA.colors = APP_DATA.colors || {};
  normalizeCorpusRegistry();

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
let PAGE_TO_CHAPTER = new Map(); // page -> chapter object

function initEntityTypes() {
  ENTITY_TYPES = {
  home: {
    title: 'Главная',
    items: [],
    tabs: ['home'],
  },
  corpus: {
    title: 'Корпус',
    items: [],
    tabs: ['sources'],
  },
  materials: {
    title: 'Материалы',
    items: [],
    tabs: ['lectures','lecture_compare','lecture_pages','further_reading','glossary','kwic','gallery','russian_evolution','phonetic_laws','tasks'],
  },
  scholar: {
    title: 'Профессиональный аппарат',
    items: [],
    tabs: ['scholar','chronology','page_trends','viz'],
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
  viz: 'Визуализации',
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
  home_decl: 'Декларативная',
  sources: 'Источники',
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
  PAGE_TO_CHAPTER = new Map();

  const chapters = Array.isArray(APP_DATA?.chapters) ? APP_DATA.chapters : [];
  const pageToChapter = new Map();
  for (const ch of chapters) {
    for (let p = ch.start; p <= ch.end; p++) {
      pageToChapter.set(p, ch.name);
      PAGE_TO_CHAPTER.set(p, ch);
    }
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
let sortMostFrequentFirst = false;
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
let globalSearchScope = 'current';
let pendingGlossaryQuery = '';
let currentGlossaryTerm = '';
let pendingScholarAnchor = '';
let currentScholarAnchor = '';
let currentVizModule = 'viz03';
let currentVizQueryString = '';
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

function getCorpusRegistry() {
  if (!APP_DATA || !APP_DATA.corpus || typeof APP_DATA.corpus !== 'object') {
    return buildDefaultCorpusRegistry();
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
  return books.find(book => book.book_id === registry.active_book_id) || books[0] || buildDefaultCorpusRegistry().books[0];
}

function getPlannedVideoCatalogSource() {
  const sourceTypes = getCorpusRegistry().source_types;
  if (!Array.isArray(sourceTypes)) return null;
  return sourceTypes.find(source => source && source.type === 'video_catalog') || null;
}

function normalizeGlobalSearchScope(scope) {
  return scope === 'corpus' ? 'corpus' : 'current';
}

function getGlobalSearchScopeLabel(scope = globalSearchScope) {
  return normalizeGlobalSearchScope(scope) === 'corpus' ? 'весь корпус' : 'текущая книга';
}

function getBookLabelForSearch(bookId) {
  const id = String(bookId || '').trim();
  const book = getCorpusBooks().find(item => item.book_id === id) || getActiveBook();
  return String(book.short_title || book.title || book.book_id || 'текущая книга');
}

function enrichGlobalSearchRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const activeBook = getActiveBook();
  const bookId = record.bookId || activeBook.book_id;
  return {
    sourceType: 'book',
    ...record,
    bookId,
  };
}

function filterGlobalSearchMatchesForScope(matches, scope = globalSearchScope) {
  if (!Array.isArray(matches)) return [];
  if (normalizeGlobalSearchScope(scope) === 'corpus') return matches.map(enrichGlobalSearchRecord);
  const activeBookId = getActiveBook().book_id;
  return matches
    .map(enrichGlobalSearchRecord)
    .filter(match => !match.bookId || match.bookId === activeBookId);
}
let subjectCrosslinksLookupCache = null;
let reverseEdgesCache = null;
let SUBJECT_BY_LEXICON_INDEX = null;
let vizCacheWarmPromise = null;
let currentVizCleanup = null;
let vizScriptLoadPromises = new Map();
const VIZ_CACHE_WORKER_PATH = './scripts/viz/build-viz-cache-worker.js';
const VIZ_STATE_SCRIPT_PATH = './scripts/viz/viz-state.js';
const VIZ_SCRIPT_BY_MODULE = Object.freeze({
  viz01: './scripts/viz/map-timeline.js',
  viz02: './scripts/viz/cooccurrence-graph.js',
  viz03: './scripts/viz/discovery-timeline.js',
  viz04: './scripts/viz/heatmap-matrix.js',
  viz05: './scripts/viz/narrative-sankey.js',
  viz06: './scripts/viz/lang-chord.js',
  viz07: './scripts/viz/term-bump-chart.js',
});
const VIZ_RENDERER_BY_MODULE = Object.freeze({
  viz01: 'renderMapTimeline',
  viz02: 'renderCooccurrenceGraph',
  viz03: 'renderDiscoveryTimeline',
  viz04: 'renderHeatmapMatrix',
  viz05: 'renderNarrativeSankey',
  viz06: 'renderLangChord',
  viz07: 'renderTermBumpChart',
});
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
  rememberBoundedCacheValue(aggregateCache, fullKey, value, AGGREGATE_CACHE_MAX);
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

function getCategoryColorClass(subcategory) {
  const key = String(subcategory || 'other').replace(/_/g, '-');
  return ['linguist', 'literator', 'historical', 'participant', 'schoolchild', 'lecture-host', 'edition-staff'].includes(key)
    ? `cat-color-${key}`
    : 'cat-color-other';
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

function normalizePageRangeInBook(startValue, endValue, fallbackStart = 1, fallbackEnd = null) {
  const resolvedFallbackEnd = fallbackEnd == null ? getTotalBookPages() : fallbackEnd;
  const start = startValue == null ? clampPageInBook(fallbackStart) : clampPageInBook(startValue);
  const end = endValue == null ? clampPageInBook(resolvedFallbackEnd) : clampPageInBook(endValue);
  return start <= end ? { start, end } : { start: end, end: start };
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
      variants.add(`${stem}им`);
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
  const glossary = Array.isArray(APP_DATA && APP_DATA.glossary) ? APP_DATA.glossary : [];
  for (const g of glossary) {
    const head = String(g && (g.term || g.head) ? (g.term || g.head) : '').trim();
    if (!head) continue;
    const norm = normalizeHeadForMatch(head);
    if (!norm) continue;
    const uniq = `glossary::${norm}`;
    if (seen.has(uniq)) continue;
    seen.add(uniq);
    out.push({
      type: 'glossary',
      head,
      matchText: head,
      norm,
      length: head.length,
      href: buildGlossaryTermHash(head),
    });
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
    const href = hit.entry.href || (hit.entry.type === 'glossary'
      ? buildGlossaryTermHash(hit.entry.head)
      : buildItemHash(hit.entry.type, hit.entry.head));
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

function getRightEdgeSortKey(head) {
  const normalized = normalizeHeadForMatch(head).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return Array.from(normalized).reverse().join('');
}

function getLastLetter(head) {
  const normalized = normalizeHeadForMatch(head);
  if (!normalized) return '#';
  for (let idx = normalized.length - 1; idx >= 0; idx--) {
    const ch = normalized[idx];
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

function getItemFrequencyScore(it, typeHint = currentEntity) {
  const itemType = it && it._entityType ? it._entityType : typeHint;
  if (itemType === 'lexicon') return countItemMentions(it);
  return Array.isArray(it && it.page_list) ? it.page_list.length : 0;
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
  if (hiddenCount > 0) html += ` <span class="scholar-muted-meta">и ещё ${hiddenCount}</span>`;
  return html;
}

function groupPagesByLecture(pages) {
  const list = sortUniquePages(pages);
  if (!list.length) return [];
  const out = [];
  const byKey = new Map();
  for (const page of list) {
    const chapter = PAGE_TO_CHAPTER.get(page) || null;
    const key = chapter ? `chapter::${chapter.name}` : 'chapter::__other__';
    let row = byKey.get(key);
    if (!row) {
      row = { chapter, pages: [] };
      byKey.set(key, row);
      out.push(row);
    }
    row.pages.push(page);
  }
  out.sort((a, b) => {
    const aStart = a.chapter && Number.isFinite(a.chapter.start) ? a.chapter.start : Number.POSITIVE_INFINITY;
    const bStart = b.chapter && Number.isFinite(b.chapter.start) ? b.chapter.start : Number.POSITIVE_INFINITY;
    return aStart - bStart;
  });
  return out;
}

function buildLecturePageBreakdownHtml(pages) {
  const groups = groupPagesByLecture(pages);
  if (!groups.length) return '';
  let rows = '';
  for (const grp of groups) {
    const chapterName = grp.chapter ? String(grp.chapter.name || '').trim() : '';
    const lectureIdx = chapterName ? findLectureIndexByName(chapterName) : -1;
    const lectureLabel = lectureIdx >= 0
      ? `<a class="related-link lecture-open-link" data-lecture-idx="${lectureIdx}" href="${escapeHtml(buildLecturePageHash(lectureIdx))}">${escapeHtml(chapterName)}</a>`
      : `<span>${escapeHtml(chapterName || 'Вне диапазонов лекций')}</span>`;
    const pageLinks = buildCardPageLinksHtml(grp.pages, 18);
    rows += `<div class="pages-by-lecture-row"><span class="pages-by-lecture-lecture">${lectureLabel}</span><span class="pages-by-lecture-sep">:</span><span class="pages-by-lecture-pages">${pageLinks}</span></div>`;
  }
  return `<div class="pages-by-lecture"><strong>По лекциям:</strong>${rows}</div>`;
}

function renderTextWithPageLinks(text, options = {}) {
  const raw = String(text == null ? '' : text);
  if (!raw) return '';
  const classNameRaw = String(options.className || 'card-page-link related-link');
  const className = /\bpage-ref-link\b/.test(classNameRaw) ? classNameRaw : `${classNameRaw} page-ref-link`;
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
    out += `<a class="${escapeHtml(className)}" data-page="${lo}"${hasRange ? ` data-page-end="${hi}"` : ''} href="${escapeHtml(href)}">${escapeHtml(hit)}</a>`;
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
    sortMostFrequentFirst,
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
    globalSearchScope,
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
    parsed.sortMostFrequentFirst = !!parsed.sortMostFrequentFirst;
    if (typeof parsed.currentGlossaryTerm !== 'string') parsed.currentGlossaryTerm = '';
    if (typeof parsed.currentScholarAnchor !== 'string') parsed.currentScholarAnchor = '';
    parsed.currentKwicSource = normalizeKwicSource(parsed.currentKwicSource);
    parsed.currentKwicQuery = typeof parsed.currentKwicQuery === 'string'
      ? clampUiInput(parsed.currentKwicQuery, MAX_LIST_QUERY_LENGTH)
      : '';
    parsed.currentKwicSort = normalizeKwicSort(parsed.currentKwicSort);
    const kwicRange = normalizePageRangeInBook(
      parsed.currentKwicPageStart,
      parsed.currentKwicPageEnd,
      1,
      getTotalBookPages()
    );
    parsed.currentKwicPageStart = kwicRange.start;
    parsed.currentKwicPageEnd = kwicRange.end;
    parsed.onlyDiscussed = !!parsed.onlyDiscussed;
    parsed.onlyQuestionCandidates = !!parsed.onlyQuestionCandidates;
    if (!Array.isArray(parsed.activeFilters)) parsed.activeFilters = [];
    parsed.activeFilters = parsed.activeFilters.filter(x => typeof x === 'string');
    if (typeof parsed.globalSearchQuery !== 'string') parsed.globalSearchQuery = '';
    parsed.globalSearchScope = normalizeGlobalSearchScope(parsed.globalSearchScope);
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
  sortMostFrequentFirst = !!state.sortMostFrequentFirst;
  currentGlossaryTerm = typeof state.currentGlossaryTerm === 'string' ? state.currentGlossaryTerm : '';
  currentScholarAnchor = typeof state.currentScholarAnchor === 'string' ? state.currentScholarAnchor : '';
  currentKwicSource = normalizeKwicSource(state.currentKwicSource);
  currentKwicQuery = typeof state.currentKwicQuery === 'string'
    ? clampUiInput(state.currentKwicQuery, MAX_LIST_QUERY_LENGTH)
    : '';
  currentKwicSort = normalizeKwicSort(state.currentKwicSort);
  const kwicRange = normalizePageRangeInBook(
    state.currentKwicPageStart,
    state.currentKwicPageEnd,
    1,
    getTotalBookPages()
  );
  currentKwicPageStart = kwicRange.start;
  currentKwicPageEnd = kwicRange.end;
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
  globalSearchScope = normalizeGlobalSearchScope(state.globalSearchScope);
  const globalSearchScopeSelect = document.getElementById('global-search-scope');
  if (globalSearchScopeSelect && 'value' in globalSearchScopeSelect) globalSearchScopeSelect.value = globalSearchScope;
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
    normalizeGlobalSearchScope(a.globalSearchScope) === normalizeGlobalSearchScope(b.globalSearchScope) &&
    !!a.sortMostFrequentFirst === !!b.sortMostFrequentFirst &&
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
  const parsed = parseHashRoute(routeHash);
  return parsed ? parsed.parts : [];
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
    corpus: '\u041a\u043e\u0440\u043f\u0443\u0441',
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

function parseHashRoute(hash) {
  const cleanHash = String(hash || '').trim();
  if (!cleanHash || cleanHash === '#') return null;
  const queryStart = cleanHash.indexOf('?');
  const hashPath = queryStart >= 0 ? cleanHash.slice(0, queryStart) : cleanHash;
  const query = queryStart >= 0 ? cleanHash.slice(queryStart + 1) : '';
  const rawParts = hashPath.replace(/^#/, '').split('/').filter(Boolean);
  if (!rawParts.length || rawParts.length > MAX_HASH_PARTS + 1) return null;

  const decodedParts = [];
  for (const part of rawParts) {
    let decoded = '';
    try { decoded = decodeURIComponent(part); } catch (e) { decoded = part; }
    decoded = String(decoded || '');
    if (decoded.length > MAX_HASH_PART_LENGTH) return null;
    decodedParts.push(decoded);
  }

  let parts = decodedParts[0] === HASH_ROUTE_PREFIX ? decodedParts.slice(1) : decodedParts;
  if (parts[0] === 'books' && parts[1]) {
    const bookId = parts[1];
    const knownBook = getCorpusBooks().some(book => book.book_id === bookId);
    if (!knownBook) return null;
    parts = parts.slice(2);
  }
  if (!parts.length || parts.length > MAX_HASH_PARTS) return null;
  return { parts, query: query.slice(0, 240) };
}

function routeVizAlias(parts) {
  if (!Array.isArray(parts)) return parts;
  if (parts.length === 1 && parts[0] === 'viz') return ['scholar', 'viz'];
  if (parts[0] === 'corpus' && parts[1] === 'viz') return ['scholar', 'viz', ...parts.slice(2)];
  return parts;
}

function routeValueAfter(parts, marker) {
  const pos = Array.isArray(parts) ? parts.indexOf(marker) : -1;
  return pos >= 0 ? parts[pos + 1] : '';
}

function parsePositiveRouteNumber(value) {
  const raw = String(value || '');
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
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
  const hash = buildCanonicalHash(parts);
  if (currentEntity === 'scholar' && currentTab === 'viz' && currentVizQueryString) {
    return `${hash}?${currentVizQueryString}`;
  }
  return hash;
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

function renderCorpusStatus() {
  const host = document.getElementById('corpus-status');
  if (!host) return;
  host.innerHTML = '';
  const activeBook = getActiveBook();
  const books = getCorpusBooks();
  const videoCatalog = getPlannedVideoCatalogSource();

  const bookChip = document.createElement('span');
  bookChip.className = 'corpus-chip active';
  bookChip.textContent = `${activeBook.title || 'Текущая книга'} · ${activeBook.author || 'А. А. Зализняк'}`;
  safeSetAttr(bookChip, 'title', `Текущий источник: ${activeBook.title || activeBook.book_id}`);
  host.appendChild(bookChip);

  const scopeChip = document.createElement('span');
  scopeChip.className = 'corpus-chip';
  scopeChip.textContent = books.length > 1 ? `Корпус: ${books.length} книг` : 'Корпус: 1 книга';
  safeSetAttr(scopeChip, 'title', 'Будущая точка переключения между книгой и всем корпусом');
  host.appendChild(scopeChip);

  if (videoCatalog) {
    const videoChip = document.createElement('span');
    videoChip.className = 'corpus-chip planned';
    const count = Number.isFinite(Number(videoCatalog.planned_count)) ? Number(videoCatalog.planned_count) : 200;
    videoChip.textContent = `Видео: ${count} с тайм-кодами и стенограммами`;
    safeSetAttr(videoChip, 'title', 'Запланированный тип источника: видеокаталог с тайм-кодами и стенограммами');
    host.appendChild(videoChip);
  }
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
  renderCorpusStatus();
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
  const parsedRoute = parseHashRoute(hash);
  if (!parsedRoute) return false;
  const routedParts = routeVizAlias(parsedRoute.parts);

  const entity = routedParts[0];
  if (!ENTITY_TYPES[entity]) return false;
  const tabCandidate = routedParts[1] || ENTITY_TYPES[entity].tabs[0];
  const tab = ENTITY_TYPES[entity].tabs.includes(tabCandidate) ? tabCandidate : ENTITY_TYPES[entity].tabs[0];
  const itemPos = routedParts.indexOf('item');

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

  const lecturePageIndex = parsePositiveRouteNumber(routedParts[2]);
  if (entity === 'materials' && tab === 'lecture_pages' && lecturePageIndex !== null) {
    state.currentLecture = lecturePageIndex;
  }
  if (entity === 'materials' && tab === 'lectures') {
    const readingPage = parsePositiveRouteNumber(routeValueAfter(routedParts, 'reading'));
    if (readingPage !== null) {
      saveReadingPage(clampPageInBook(readingPage));
    }
  }
  if (entity === 'materials' && tab === 'glossary') {
    const termValue = routeValueAfter(routedParts, 'term');
    if (termValue) {
      pendingGlossaryQuery = clampUiInput(termValue, MAX_LIST_QUERY_LENGTH).toLowerCase();
      currentGlossaryTerm = pendingGlossaryQuery;
    }
  }
  if (entity === 'scholar' && tab === 'scholar') {
    const anchorValue = routeValueAfter(routedParts, 'anchor');
    if (anchorValue) {
      const rawAnchor = String(anchorValue || '');
      const safeAnchor = rawAnchor.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
      if (safeAnchor) {
        pendingScholarAnchor = safeAnchor;
        state.currentScholarAnchor = safeAnchor;
      }
    }
  }
  if (entity === 'scholar' && tab === 'viz') {
    currentVizQueryString = parsedRoute.query;
    const moduleValue = routeValueAfter(routedParts, 'module');
    if (moduleValue) {
      currentVizModule = String(moduleValue || '').trim() || currentVizModule;
    }
  } else {
    currentVizQueryString = '';
  }
  if (entity === 'scholar' && tab === 'page_trends') {
    const rangePos = routedParts.indexOf('range');
    const rangeStart = parsePositiveRouteNumber(routedParts[rangePos + 1]);
    const rangeEnd = parsePositiveRouteNumber(routedParts[rangePos + 2]);
    if (rangePos >= 0 && rangeStart !== null && rangeEnd !== null) {
      state.trendsRangeStart = clampPageInBook(rangeStart);
      state.trendsRangeEnd = clampPageInBook(rangeEnd);
      if (state.trendsRangeStart > state.trendsRangeEnd) {
        [state.trendsRangeStart, state.trendsRangeEnd] = [state.trendsRangeEnd, state.trendsRangeStart];
      }
    }
  }
  const queryValue = routeValueAfter(routedParts, 'q');
  if (tab === 'list' && queryValue) {
    state.searchQuery = clampUiInput(queryValue, MAX_LIST_QUERY_LENGTH);
  }

  if (itemPos >= 0 && routedParts[itemPos + 1] && routedParts[itemPos + 2]) {
    const itemType = ENTITY_TYPES[routedParts[itemPos + 1]] ? routedParts[itemPos + 1] : state.currentEntity;
    const resolvedHead = resolveItemHeadFromHash(itemType, routedParts[itemPos + 2]);
    state.currentEntity = itemType;
    state.currentTab = 'list';
    state.selectedItemType = itemType;
    state.selectedItem = resolvedHead || clampUiInput(routedParts[itemPos + 2], MAX_HASH_PART_LENGTH);
    state.rightPaneMode = 'card';
  }

  applyViewState(state);
  if (!isNavigatingHistory) pushHistoryState();
  syncNavigationHashOnly();
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

function rememberBoundedCacheValue(cache, key, value, maxSize, options = {}) {
  if (!cache || typeof cache.set !== 'function') return value;
  const limit = Number(maxSize || 0);
  if (limit > 0 && cache.size >= limit) {
    if (options && options.clearWhenFull && typeof cache.clear === 'function') {
      cache.clear();
    } else if (typeof cache.keys === 'function' && typeof cache.delete === 'function') {
      const firstKey = cache.keys().next();
      if (!firstKey.done) cache.delete(firstKey.value);
    }
  }
  cache.set(key, value);
  return value;
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
  rememberBoundedCacheValue(normalizeHeadCache, raw, s, NORMALIZE_CACHE_LIMIT, { clearWhenFull: true });
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
  const aType = a && a._entityType ? a._entityType : currentEntity;
  const bType = b && b._entityType ? b._entityType : currentEntity;
  if (aType === 'lexicon_reverse' && bType === 'lexicon_reverse') {
    const primary = compareHeadsRu(getRightEdgeSortKey(a && a.head), getRightEdgeSortKey(b && b.head));
    if (primary !== 0) return primary;
  }
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
  if (typeof window !== 'undefined') window._pendingGlossaryTerm = q;
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

function navigateTo(entity, view, payload) {
  const targetEntity = ENTITY_TYPES[entity] ? entity : currentEntity;
  const mode = String(view || '').toLowerCase();
  if (mode === 'card') {
    navigateToItem(targetEntity, payload || '');
    return;
  }
  closeGlobalSearchResults();
  currentEntity = targetEntity;
  currentTab = 'list';
  selectedItem = null;
  selectedItemType = null;
  currentGlossaryTerm = '';
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  rightPaneMode = 'histogram';
  searchQuery = clampUiInput(payload || '', MAX_LIST_QUERY_LENGTH);
  renderEntitySwitcher();
  renderTabs();
  renderContent();
  syncNavigationState();
}

function openKwicTerm(term) {
  closeGlobalSearchResults();
  const q = clampUiInput(term, MAX_LIST_QUERY_LENGTH);
  if (!q) return;
  pendingKwicTerm = q;
  if (typeof window !== 'undefined') window._pendingKwicTerm = q;
  currentKwicSource = 'lexicon';
  currentKwicQuery = q;
  currentEntity = 'materials';
  currentTab = 'kwic';
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

function getVizRegistry() {
  if (typeof window === 'undefined') return {};
  window.VIZ_MODULES = window.VIZ_MODULES || {};
  return window.VIZ_MODULES;
}

function setVizQueryString(query) {
  currentVizQueryString = String(query || '').slice(0, 240);
}

if (typeof window !== 'undefined') {
  window.setVizQueryString = setVizQueryString;
}

function cleanupActiveVizModule() {
  if (typeof currentVizCleanup !== 'function') return;
  try {
    currentVizCleanup();
  } catch (e) {}
  currentVizCleanup = null;
}

function loadVizScriptOnce(src) {
  const path = String(src || '').trim();
  if (!path) return Promise.resolve();
  if (vizScriptLoadPromises.has(path)) return vizScriptLoadPromises.get(path);
  if (typeof document === 'undefined') {
    const done = Promise.resolve();
    vizScriptLoadPromises.set(path, done);
    return done;
  }

  const existing = Array.from(document.querySelectorAll('script[src]')).find((node) => {
    try {
      const resolved = new URL(node.getAttribute('src') || '', window.location.href).pathname;
      const wanted = new URL(path, window.location.href).pathname;
      return resolved === wanted;
    } catch (e) {
      return false;
    }
  });
  if (existing) {
    const done = Promise.resolve();
    vizScriptLoadPromises.set(path, done);
    return done;
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = path;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${path}`));
    document.head.appendChild(script);
  }).catch((err) => {
    vizScriptLoadPromises.delete(path);
    throw err;
  });
  vizScriptLoadPromises.set(path, promise);
  return promise;
}

function ensureVizCoreLoaded() {
  if (typeof buildVizCache === 'function') return Promise.resolve();
  return loadVizScriptOnce('./scripts/viz/build-viz-cache.js');
}

function ensureVizStateLoaded() {
  if (typeof window !== 'undefined' && typeof window.readVizParams === 'function' && typeof window.writeVizParams === 'function') {
    return Promise.resolve();
  }
  return loadVizScriptOnce(VIZ_STATE_SCRIPT_PATH);
}

function ensureVizModuleLoaded(moduleId) {
  const moduleKey = String(moduleId || '').trim();
  const rendererName = VIZ_RENDERER_BY_MODULE[moduleKey];
  const registry = getVizRegistry();
  if (rendererName && typeof registry[rendererName] === 'function') return Promise.resolve();
  const scriptPath = VIZ_SCRIPT_BY_MODULE[moduleKey];
  if (!scriptPath) return Promise.resolve();
  return loadVizScriptOnce(scriptPath);
}

function buildVizHash(moduleId) {
  const moduleKey = String(moduleId || currentVizModule || 'viz03').trim();
  const hash = buildCanonicalHash(['scholar', 'viz', 'module', moduleKey]);
  if (moduleKey === currentVizModule && currentVizQueryString) return `${hash}?${currentVizQueryString}`;
  return hash;
}

function buildCorpusVizHash(moduleId) {
  const moduleKey = String(moduleId || currentVizModule || 'viz03').trim();
  const activeBook = getActiveBook();
  const params = new URLSearchParams(currentVizQueryString || '');
  if (activeBook && activeBook.book_id) params.set('books', activeBook.book_id);
  const query = params.toString();
  const hash = buildCanonicalHash(['corpus', 'viz', 'module', moduleKey]);
  return query ? `${hash}?${query}` : hash;
}

function warmupVizCacheInWorker() {
  return ensureVizCoreLoaded()
    .catch(() => null)
    .then(() => {
      if (typeof buildVizCache !== 'function') return null;
      const globalObj = (typeof window !== 'undefined') ? window : globalThis;
      globalObj.__vizCache = globalObj.__vizCache || {};
      if (globalObj.__vizCache._built) return globalObj.__vizCache;
      if (vizCacheWarmPromise) return vizCacheWarmPromise;

      const runFallback = () => {
        try {
          const cache = buildVizCache(APP_DATA || {});
          return Promise.resolve(cache);
        } catch (e) {
          return Promise.resolve(null);
        }
      };

      if (typeof Worker === 'undefined') {
        vizCacheWarmPromise = runFallback();
        return vizCacheWarmPromise;
      }

      vizCacheWarmPromise = new Promise((resolve) => {
        let worker = null;
        let settled = false;
        const finish = (cacheValue) => {
          if (settled) return;
          settled = true;
          if (worker) {
            try { worker.terminate(); } catch (e) {}
          }
          resolve(cacheValue || globalObj.__vizCache || null);
        };
        const timer = setTimeout(() => {
          runFallback().then((cache) => finish(cache));
        }, 3000);
        try {
          worker = new Worker(VIZ_CACHE_WORKER_PATH);
          worker.onmessage = (event) => {
            clearTimeout(timer);
            const payload = event && event.data ? event.data : {};
            if (payload.ok && payload.cache && typeof payload.cache === 'object') {
              globalObj.__vizCache = payload.cache;
              globalObj.__vizCache._built = true;
              globalObj.__vizCache._worker = true;
              finish(globalObj.__vizCache);
              return;
            }
            runFallback().then((cache) => finish(cache));
          };
          worker.onerror = () => {
            clearTimeout(timer);
            runFallback().then((cache) => finish(cache));
          };
          worker.postMessage({ type: 'build', appData: APP_DATA || {} });
        } catch (e) {
          clearTimeout(timer);
          runFallback().then((cache) => finish(cache));
        }
      });

      return vizCacheWarmPromise;
    });
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
  const scope = normalizeGlobalSearchScope(globalSearchScope);
  const searchKey = `${getDataSignature()}::${scope}::${q}`;
  const cached = globalSearchCache.get(searchKey);
  if (cached) return cached;
  const out = [];
  const push = (kind, type, head, meta, lectureIndex, snippet, routeHash = '') => {
    if (!head) return;
    const score = head.toLowerCase().startsWith(q) ? 0 : 1;
    out.push(enrichGlobalSearchRecord({ kind, type, head, meta, lectureIndex, snippet, routeHash, score }));
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
  const sliced = filterGlobalSearchMatchesForScope(out, scope).slice(0, 40);
  return rememberBoundedCacheValue(globalSearchCache, searchKey, sliced, GLOBAL_SEARCH_CACHE_MAX);
}

function resetGlobalSearchFuseState() {
  globalSearchFuse = null;
  globalSearchFuseSignature = '';
  globalSearchFuseDisabled = false;
}

function clearGlobalSearchCaches() {
  if (globalSearchCache && typeof globalSearchCache.clear === 'function') {
    globalSearchCache.clear();
  }
  resetGlobalSearchFuseState();
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
    'scholar/viz': ['визуализации', 'аналитические графики', '#viz'],
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
  const activeBook = getActiveBook();
  const activeBookId = activeBook.book_id || 'zaliznyak-aaz-index';
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
        bookId: activeBookId,
        sourceType: 'book',
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
      bookId: activeBookId,
      sourceType: 'book',
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
      bookId: activeBookId,
      sourceType: 'book',
      searchHead,
      searchSecondary: normalizeSearchText([l.main_idea || '', terms, l.why_read || '', facts].join(' ')),
    });
  }
  const routeRecords = buildGlobalSearchRouteRecords();
  if (routeRecords.length) records.push(...routeRecords.map(enrichGlobalSearchRecord));
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
    const key = `${item.type}::${item.bookId || ''}::${item.head}::${item.lectureIndex === null ? '' : item.lectureIndex}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    let score = Number.isFinite(row.score) ? row.score : 1;
    const headNorm = item.searchHead || '';
    if (headNorm.startsWith(queryNorm)) score -= 0.12;
    else if (headNorm.includes(queryNorm)) score -= 0.06;
    out.push(enrichGlobalSearchRecord({
      kind: item.kind,
      type: item.type,
      head: item.head,
      meta: item.meta,
      lectureIndex: item.lectureIndex,
      snippet: item.snippet,
      routeHash: item.routeHash || '',
      bookId: item.bookId || '',
      sourceType: item.sourceType || 'book',
      score,
    }));
  }
  out.sort((a, b) => a.score - b.score || compareHeadsRu(a.head, b.head));
  return out.slice(0, 40);
}

function getGlobalSearchMatches(query) {
  const qRaw = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH).toLowerCase();
  const qNorm = normalizeSearchText(qRaw);
  if (qNorm.length < 2) return [];
  const scope = normalizeGlobalSearchScope(globalSearchScope);
  const searchKey = `${getDataSignature()}::${scope}::${qNorm}`;
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
  const scoped = filterGlobalSearchMatchesForScope(matches, scope);
  const sliced = Array.isArray(scoped) ? scoped.slice(0, 40) : [];
  return rememberBoundedCacheValue(globalSearchCache, searchKey, sliced, GLOBAL_SEARCH_CACHE_MAX);
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

function appendGlobalSearchResult(box, match, idx, query) {
  if (!box || !match) return;
  const q = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH);
  const row = document.createElement('div');
  row.className = 'header-search-item';
  row.dataset.idx = String(idx);
  safeSetAttr(row, 'role', 'option');
  safeSetAttr(row, 'aria-selected', 'false');

  const head = document.createElement('span');
  head.innerHTML = highlightSearchMatch(match.head, q);
  const kind = document.createElement('span');
  kind.className = 'kind';
  kind.textContent = String(match.kind || '');
  row.appendChild(head);
  row.appendChild(kind);

  const metaParts = [];
  const bookLabel = getBookLabelForSearch(match.bookId);
  if (bookLabel) metaParts.push(bookLabel);
  if (match.meta) metaParts.push(String(match.meta || ''));
  if (metaParts.length) {
    const meta = document.createElement('div');
    meta.className = 'search-meta';
    meta.textContent = metaParts.join(' · ');
    row.appendChild(meta);
  }
  if (match.snippet) {
    const snippet = document.createElement('div');
    snippet.className = 'search-snippet';
    snippet.innerHTML = highlightSearchMatch(match.snippet, q);
    row.appendChild(snippet);
  }
  box.appendChild(row);
}

function appendGlobalSearchSourceGroup(box, label) {
  if (!box || !label) return;
  const group = document.createElement('div');
  group.className = 'header-search-group';
  safeSetAttr(group, 'role', 'presentation');
  group.textContent = label;
  box.appendChild(group);
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
  box.textContent = '';
  const groupedBySource = normalizeGlobalSearchScope(globalSearchScope) === 'corpus';
  let lastBookId = '';
  matches.forEach((m, idx) => {
    if (groupedBySource) {
      const bookId = m && m.bookId ? String(m.bookId) : '';
      if (bookId !== lastBookId) {
        appendGlobalSearchSourceGroup(box, getBookLabelForSearch(bookId) || 'Corpus source');
        lastBookId = bookId;
      }
    }
    appendGlobalSearchResult(box, m, idx, q);
  });
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
  const scopeSelect = document.getElementById('global-search-scope');
  if (scopeSelect) {
    if ('value' in scopeSelect) scopeSelect.value = globalSearchScope;
    scopeSelect.onchange = (e) => {
      const target = e && e.target;
      if (!target || typeof target.value !== 'string') return;
      globalSearchScope = normalizeGlobalSearchScope(target.value);
      clearGlobalSearchCaches();
      const q = input ? clampUiInput(input.value, MAX_GLOBAL_QUERY_LENGTH) : '';
      if (input && input.value !== q) input.value = q;
      renderGlobalSearchResults(getGlobalSearchMatches(q), q);
      persistViewState();
    };
  }
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

function lectureToMarkdown(lecture, index) {
  const lines = [];
  const title = index === 0 ? 'Предисловие' : `Лекция ${index}`;
  lines.push(`### ${title}: ${lecture.name || 'Без названия'}`);
  lines.push('');
  if (lecture.pages) lines.push(`Страницы: ${lecture.pages}`);
  if (lecture.main_idea) {
    lines.push('');
    lines.push(lecture.main_idea);
  }
  if (Array.isArray(lecture.key_facts) && lecture.key_facts.length) {
    lines.push('');
    lines.push('Ключевые факты:');
    for (const fact of lecture.key_facts) lines.push(`- ${fact}`);
  }
  if (Array.isArray(lecture.terms) && lecture.terms.length) {
    lines.push('');
    lines.push(`Термины: ${lecture.terms.join(', ')}`);
  }
  if (lecture.why_read) {
    lines.push('');
    lines.push(`Почему читать: ${lecture.why_read}`);
  }
  lines.push('');
  return lines.join('\n');
}

function routeToMarkdown(route) {
  const lines = [];
  lines.push(`### ${route.title || 'Маршрут'}`);
  lines.push('');
  if (route.desc) lines.push(route.desc);
  if (route.pages) {
    lines.push('');
    lines.push(`Страницы: ${route.pages}`);
  }
  if (Array.isArray(route.lectures) && route.lectures.length) {
    lines.push('');
    lines.push(`Лекции: ${route.lectures.join(', ')}`);
  }
  if (Array.isArray(route.entities) && route.entities.length) {
    lines.push('');
    lines.push('Опорные элементы:');
    for (const entity of route.entities) {
      lines.push(`- [${entity.type}] ${entity.head}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function glossaryEntryToMarkdown(entry) {
  const lines = [];
  lines.push(`### ${entry.term || 'Термин'}`);
  lines.push('');
  if (entry.definition) lines.push(entry.definition);
  if (entry.url) {
    lines.push('');
    lines.push(`Источник: ${entry.url}`);
  }
  lines.push('');
  return lines.join('\n');
}

function appendScholarMarkdown(parts) {
  const s = APP_DATA.scholar || {};
  parts.push('## Профессиональный аппарат');
  parts.push('');

  if (Array.isArray(s.bibliography) && s.bibliography.length) {
    parts.push('### Библиография по лекциям');
    parts.push('');
    for (const lecture of s.bibliography) {
      parts.push(`#### ${lecture.lecture || 'Лекция'}`);
      parts.push('');
      for (const work of lecture.works || []) {
        const suffix = work.year ? ` (${work.year})` : '';
        parts.push(`- ${work.title || 'Работа'}${suffix}`);
        if (work.note) parts.push(`  ${work.note}`);
        if (work.url) parts.push(`  ${work.url}`);
      }
      parts.push('');
    }
  }

  if (Array.isArray(s.controversies) && s.controversies.length) {
    parts.push('### Спорные вопросы');
    parts.push('');
    for (const item of s.controversies) {
      parts.push(`- ${item.topic}: ${item.description}${item.page ? ` (стр. ${item.page})` : ''}`);
    }
    parts.push('');
  }

  const originalForms = s.original_forms || {};
  const originalOrder = [
    ['sanskrit', 'Санскрит'],
    ['greek', 'Древнегреческий'],
    ['latin', 'Латинский'],
    ['arabic', 'Арабский'],
    ['old_russian', 'Древнерусский'],
  ];
  const hasOriginalForms = originalOrder.some(([key]) => Array.isArray(originalForms[key]) && originalForms[key].length);
  if (hasOriginalForms) {
    parts.push('### Оригинальные формы');
    parts.push('');
    for (const [key, label] of originalOrder) {
      const forms = Array.isArray(originalForms[key]) ? originalForms[key] : [];
      if (!forms.length) continue;
      parts.push(`#### ${label}`);
      parts.push('');
      for (const form of forms) {
        const tail = form.page ? ` (стр. ${form.page})` : '';
        parts.push(`- ${form.form} — ${form.translation}${tail}`);
      }
      parts.push('');
    }
  }

  if (Array.isArray(s.birch_grammar) && s.birch_grammar.length) {
    parts.push('### Конкорданс берестяных грамот');
    parts.push('');
    for (const item of s.birch_grammar) {
      const bits = [`№${item.num}`, item.year, item.content].filter(Boolean);
      const tail = item.page ? ` (стр. ${item.page})` : '';
      parts.push(`- ${bits.join(' — ')}${tail}`);
    }
    parts.push('');
  }

  if (Array.isArray(s.chronology) && s.chronology.length) {
    parts.push('### Хронология');
    parts.push('');
    for (const event of s.chronology) {
      parts.push(`- ${event.year}: ${event.event}${event.page ? ` (стр. ${event.page})` : ''}`);
    }
    parts.push('');
  }

  if (Array.isArray(s.isoglosses) && s.isoglosses.length) {
    parts.push('### Изоглоссы');
    parts.push('');
    for (const item of s.isoglosses) {
      parts.push(`- ${item.name}: ${item.description}${item.page ? ` (стр. ${item.page})` : ''}`);
    }
    parts.push('');
  }

  if (s.slovo) {
    parts.push('### «Слово о полку Игореве»');
    parts.push('');
    if (s.slovo.thesis) parts.push(s.slovo.thesis);
    if (s.slovo.context) {
      parts.push('');
      parts.push(`Контекст: ${s.slovo.context}`);
    }
    if (s.slovo.opponents) {
      parts.push('');
      parts.push(`Оппоненты: ${s.slovo.opponents}`);
    }
    if (Array.isArray(s.slovo.arguments) && s.slovo.arguments.length) {
      parts.push('');
      parts.push('Тезисы:');
      for (const item of s.slovo.arguments) {
        parts.push(`- ${item.name}: ${item.detail}${item.page ? ` (стр. ${item.page})` : ''}`);
      }
    }
    if (Array.isArray(s.slovo.counterarguments) && s.slovo.counterarguments.length) {
      parts.push('');
      parts.push('Контраргументы:');
      for (const item of s.slovo.counterarguments) {
        parts.push(`- ${item.name}: ${item.detail}${item.page ? ` (стр. ${item.page})` : ''}`);
      }
    }
    if (Array.isArray(s.slovo_reading) && s.slovo_reading.length) {
      parts.push('');
      parts.push('Что читать дальше:');
      for (const item of s.slovo_reading) {
        parts.push(`- ${item.title}${item.note ? ` — ${item.note}` : ''}${item.url ? ` (${item.url})` : ''}`);
      }
    }
    parts.push('');
  }

  if (Array.isArray(s.accent_paradigms) && s.accent_paradigms.length) {
    parts.push('### Акцентные парадигмы');
    parts.push('');
    for (const paradigm of s.accent_paradigms) {
      parts.push(`- Тип ${paradigm.type}: ${paradigm.description}`);
      for (const example of paradigm.examples || []) {
        parts.push(`  ${example.word} — ${example.forms}`);
      }
    }
    parts.push('');
  }

  if (Array.isArray(s.sound_correspondences) && s.sound_correspondences.length) {
    parts.push('### Фонетические соответствия');
    parts.push('');
    for (const row of s.sound_correspondences) {
      const languages = [row.rus, row.lat, row.gre, row.san, row.eng, row.ger].filter(Boolean).join(' | ');
      parts.push(`- ${row.pie} → ${languages} — ${row.meaning}`);
    }
    parts.push('');
  }

  const recon = APP_DATA.lexicon_tech || [];
  if (recon.length) {
    parts.push('### Реконструкции');
    parts.push('');
    for (const item of recon) {
      parts.push(`- ${item.head} (${(item.page_list || []).length} стр.)`);
    }
    parts.push('');
  }
}

function exportWholeSiteMarkdown() {
  const stats = APP_DATA.book_stats || {};
  const featured = APP_DATA.featured_quote || {};
  const parts = [];
  parts.push('# Зализнякиада');
  parts.push('');
  parts.push('## Обзор');
  parts.push('');
  const overviewBits = [
    stats.total_pages ? `Страниц: ${stats.total_pages}` : '',
    stats.lectures ? `Лекций: ${stats.lectures}` : '',
    stats.names ? `Имен: ${stats.names}` : '',
    stats.languages ? `Языков: ${stats.languages}` : '',
    stats.toponyms ? `Топонимов: ${stats.toponyms}` : '',
    stats.ethnonyms ? `Этнонимов: ${stats.ethnonyms}` : '',
    stats.lexicon ? `Лексем: ${stats.lexicon}` : '',
    stats.subject_index ? `Понятий: ${stats.subject_index}` : '',
  ].filter(Boolean);
  for (const bit of overviewBits) parts.push(`- ${bit}`);
  if (featured.text) {
    parts.push('');
    parts.push(`Цитата: «${featured.text}»${featured.page ? ` (стр. ${featured.page})` : ''}`);
  }
  parts.push('');

  if (Array.isArray(APP_DATA.routes) && APP_DATA.routes.length) {
    parts.push('## Маршруты');
    parts.push('');
    for (const route of APP_DATA.routes) parts.push(routeToMarkdown(route));
  }

  if (Array.isArray(APP_DATA.lectures) && APP_DATA.lectures.length) {
    parts.push('## Лекции');
    parts.push('');
    for (let i = 0; i < APP_DATA.lectures.length; i++) {
      parts.push(lectureToMarkdown(APP_DATA.lectures[i], i));
    }
  }

  if (Array.isArray(APP_DATA.further_reading) && APP_DATA.further_reading.length) {
    parts.push('## Что почитать ещё');
    parts.push('');
    for (const topic of APP_DATA.further_reading) {
      parts.push(`### ${topic.topic || 'Тема'}`);
      parts.push('');
      for (const book of topic.books || []) {
        const suffix = book.year ? ` (${book.year})` : '';
        parts.push(`- ${book.title || 'Книга'}${suffix}${book.why ? ` — ${book.why}` : ''}`);
      }
      parts.push('');
    }
  }

  if (Array.isArray(APP_DATA.glossary) && APP_DATA.glossary.length) {
    parts.push('## Глоссарий');
    parts.push('');
    for (const entry of APP_DATA.glossary) parts.push(glossaryEntryToMarkdown(entry));
  }

  appendScholarMarkdown(parts);

  const exportOrder = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech', 'subject'];
  for (const key of exportOrder) {
    const conf = ENTITY_TYPES[key];
    if (!conf || !Array.isArray(conf.items)) continue;
    parts.push(`## ${conf.title}`);
    parts.push('');
    parts.push(`Всего карточек: ${conf.items.length}`);
    parts.push('');
    for (const it of conf.items) {
      parts.push(itemToMarkdown(it, key));
      parts.push('');
    }
  }
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
  const order = ['corpus', 'materials', 'scholar', 'all', 'subject', 'names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse'];
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

function invalidateVisibleItemsCache() {
  visibleItemsCache = null;
}

function switchEntity(key) {
  closeGlobalSearchResults();
  invalidateVisibleItemsCache();
  currentEntity = key;
  currentGlossaryTerm = '';
  currentScholarAnchor = '';
  pendingScholarAnchor = '';
  activeFilters.clear();
  onlyDiscussed = false;
  onlyQuestionCandidates = false;
  searchQuery = '';
  sortMostFrequentFirst = false;
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
  invalidateVisibleItemsCache();
  currentTab = tab;
  if (!(currentEntity === 'materials' && tab === 'glossary')) currentGlossaryTerm = '';
  if (!(currentEntity === 'scholar' && tab === 'scholar')) {
    currentScholarAnchor = '';
    pendingScholarAnchor = '';
  }
  renderTabs();
  renderContent();
  if (currentEntity === 'scholar' && currentTab === 'viz') {
    warmupVizCacheInWorker();
  }
  syncNavigationState();
}

const CONTENT_RENDERERS = Object.freeze({
  home: renderHomePanel,
  home_decl: renderHomePanelDeclarative,
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
  viz: renderVizPanel,
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
});

function renderContent() {
  const container = document.getElementById('content');
  if (!container) return;
  if (!(currentEntity === 'scholar' && currentTab === 'viz')) cleanupActiveVizModule();
  container.innerHTML = '';
  if (currentTab !== 'list') setMobileSheetOpen(false);
  if (currentTab !== 'graph') nameGraphRenderToken += 1;
  if (currentTab !== 'families') familiesGraphRenderToken += 1;
  const render = CONTENT_RENDERERS[currentTab];
  if (render) render(container);
}

function createCorpusMetric(label, value) {
  const node = document.createElement('div');
  node.className = 'corpus-metric';
  const valueNode = document.createElement('strong');
  valueNode.textContent = String(value || '0');
  const labelNode = document.createElement('span');
  labelNode.textContent = String(label || '');
  node.appendChild(valueNode);
  node.appendChild(labelNode);
  return node;
}

function formatCoveragePercent(count, total) {
  if (!total) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function buildCorpusQualityMetrics() {
  const totals = {
    items: 0,
    withPages: 0,
    withContexts: 0,
    withSources: 0,
    duplicateGroups: 0,
  };
  for (const conf of Object.values(ENTITY_TYPES || {})) {
    const items = Array.isArray(conf && conf.items) ? conf.items : [];
    if (!items.length) continue;
    const heads = new Map();
    for (const item of items) {
      totals.items += 1;
      if (Array.isArray(item.page_list) && item.page_list.length) totals.withPages += 1;
      if (Array.isArray(item.contexts) && item.contexts.length) totals.withContexts += 1;
      if (Array.isArray(item.sources) && item.sources.length) totals.withSources += 1;
      const head = normalizeSearchText(item.head || '');
      if (head) heads.set(head, (heads.get(head) || 0) + 1);
    }
    for (const count of heads.values()) {
      if (count > 1) totals.duplicateGroups += 1;
    }
  }
  return {
    ...totals,
    pagesCoverage: formatCoveragePercent(totals.withPages, totals.items),
    contextsCoverage: formatCoveragePercent(totals.withContexts, totals.items),
    sourcesCoverage: formatCoveragePercent(totals.withSources, totals.items),
  };
}

function renderCorpusQualityPanel(panel) {
  if (!panel) return;
  const metrics = buildCorpusQualityMetrics();
  const section = document.createElement('section');
  section.className = 'corpus-quality-panel';
  const title = document.createElement('h3');
  title.className = 'corpus-section-title';
  title.textContent = '\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0434\u0430\u043d\u043d\u044b\u0445';
  section.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'corpus-metrics-row corpus-quality-metrics';
  grid.appendChild(createCorpusMetric('\u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432', metrics.items));
  grid.appendChild(createCorpusMetric('page coverage', metrics.pagesCoverage));
  grid.appendChild(createCorpusMetric('context coverage', metrics.contextsCoverage));
  grid.appendChild(createCorpusMetric('source coverage', metrics.sourcesCoverage));
  grid.appendChild(createCorpusMetric('duplicate head groups', metrics.duplicateGroups));
  section.appendChild(grid);

  const note = document.createElement('p');
  note.className = 'corpus-quality-note';
  note.textContent = '\u0411\u044b\u0441\u0442\u0440\u044b\u0439 runtime-\u0441\u0440\u0435\u0437 \u0434\u043b\u044f import readiness; \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u044b\u0439 \u043e\u0442\u0447\u0451\u0442: scripts/content_report.py.';
  section.appendChild(note);
  panel.appendChild(section);
}

function createCorpusSourceCard(source, options = {}) {
  const card = document.createElement('article');
  card.className = 'corpus-source-card';
  if (source.status) card.dataset.status = String(source.status);

  const top = document.createElement('div');
  top.className = 'corpus-source-top';
  const title = document.createElement('h3');
  title.textContent = String(source.title || source.book_id || source.type || 'Источник');
  const badge = document.createElement('span');
  badge.className = 'corpus-source-badge';
  badge.textContent = String(source.status || 'active');
  top.appendChild(title);
  top.appendChild(badge);
  card.appendChild(top);

  const meta = document.createElement('div');
  meta.className = 'corpus-source-meta';
  const metaParts = [];
  if (source.author) metaParts.push(source.author);
  if (source.year) metaParts.push(String(source.year));
  if (source.edition) metaParts.push(source.edition);
  if (source.source_type) metaParts.push(source.source_type === 'book' ? 'книга' : source.source_type);
  if (options.kindLabel) metaParts.push(options.kindLabel);
  meta.textContent = metaParts.join(' · ') || 'metadata source';
  card.appendChild(meta);

  if (source.description) {
    const description = document.createElement('p');
    description.className = 'corpus-source-description';
    description.textContent = String(source.description);
    card.appendChild(description);
  }

  const facts = document.createElement('div');
  facts.className = 'corpus-source-facts';
  if (source.pages_total) facts.appendChild(createCorpusMetric('страниц', source.pages_total));
  if (source.planned_count) facts.appendChild(createCorpusMetric('единиц', source.planned_count));
  if (Array.isArray(source.supports) && source.supports.length) {
    facts.appendChild(createCorpusMetric('поддержка', source.supports.join(', ')));
  }
  if (Array.isArray(source.content_modules) && source.content_modules.length) {
    facts.appendChild(createCorpusMetric('модули', source.content_modules.length));
  }
  if (facts.childNodes.length) card.appendChild(facts);

  if (source.default_route) {
    const actions = document.createElement('div');
    actions.className = 'corpus-source-actions';
    const link = document.createElement('a');
    link.href = String(source.default_route);
    link.textContent = 'Открыть';
    link.onclick = (event) => {
      event.preventDefault();
      applyHash(link.getAttribute('href') || '#v4/home/home');
    };
    actions.appendChild(link);
    card.appendChild(actions);
  }

  return card;
}

function renderCorpusSourcesPanel(container) {
  const panel = document.createElement('div');
  panel.className = 'panel corpus-panel active';

  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  const sourceTypes = Array.isArray(registry.source_types) ? registry.source_types : [];
  const plannedVideo = getPlannedVideoCatalogSource();

  const header = document.createElement('div');
  header.className = 'corpus-panel-header';
  const title = document.createElement('h2');
  title.textContent = 'Источники корпуса';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Текущая книга, будущие книги и видеокаталог используют один корпусный слой навигации, поиска и цитирования.';
  header.appendChild(title);
  header.appendChild(subtitle);
  panel.appendChild(header);

  const metrics = document.createElement('div');
  metrics.className = 'corpus-metrics-row';
  metrics.appendChild(createCorpusMetric('книг сейчас', books.length));
  metrics.appendChild(createCorpusMetric('активный источник', getActiveBook().title || getActiveBook().book_id));
  metrics.appendChild(createCorpusMetric('типов источников', sourceTypes.length));
  metrics.appendChild(createCorpusMetric('план видео', plannedVideo && plannedVideo.planned_count ? plannedVideo.planned_count : 0));
  panel.appendChild(metrics);
  renderCorpusQualityPanel(panel);

  const booksTitle = document.createElement('h3');
  booksTitle.className = 'corpus-section-title';
  booksTitle.textContent = 'Книги';
  panel.appendChild(booksTitle);

  const booksGrid = document.createElement('div');
  booksGrid.className = 'corpus-sources-grid';
  books.forEach(book => booksGrid.appendChild(createCorpusSourceCard(book)));
  panel.appendChild(booksGrid);

  const sourceTypesTitle = document.createElement('h3');
  sourceTypesTitle.className = 'corpus-section-title';
  sourceTypesTitle.textContent = 'Типы источников';
  panel.appendChild(sourceTypesTitle);

  const typesGrid = document.createElement('div');
  typesGrid.className = 'corpus-sources-grid corpus-source-types-grid';
  sourceTypes.forEach(type => {
    const source = {
      ...type,
      title: type.title || type.type,
      description: type.type === 'video_catalog'
        ? 'Будущий каталог видео Зализняка с тайм-кодами и стенограммами.'
        : '',
    };
    typesGrid.appendChild(createCorpusSourceCard(source, { kindLabel: 'тип источника' }));
  });
  panel.appendChild(typesGrid);

  container.appendChild(panel);
}

// =========================================================
// СПИСОК + КАРТОЧКА (или гистограмма по умолчанию)
// =========================================================
function renderListPanel(container) {
  const conf = ENTITY_TYPES[currentEntity];
  const isReverseLexicon = currentEntity === 'lexicon_reverse';

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
        <span class="dot ${getCategoryColorClass(sub)}"></span>${LABELS[sub]} (${cats[sub]})
      </button>`;
    }
    catChips += '</div>';
  }
  const canFilterCandidates = currentEntity === 'names' || currentEntity === 'all';
  const candidateTotal = canFilterCandidates ? conf.items.filter(it => (it.head || '').startsWith('?')).length : 0;
  const candidateBtnHtml = canFilterCandidates
    ? `<button class="filter-chip ${onlyQuestionCandidates ? 'active' : ''}" id="only-question-btn">только ?-кандидаты (${candidateTotal})</button>`
    : '';
  const sortMostFrequentBtnHtml = Array.isArray(conf.items) && conf.items.length > 1
    ? `<div class="filter-row"><button class="filter-chip ${sortMostFrequentFirst ? 'active' : ''}" id="sort-most-frequent-btn">наиболее частотные сверху</button></div>`
    : '';

  container.innerHTML = `
    <div class="panel active">
      <div class="list-card-layout${isReverseLexicon ? ' reverse-fullwidth' : ''}">
        <div class="left-pane">
          <div class="filters">
            <div class="filters-top-row">
              <div class="filters-search">
                <input type="text" id="search-input" placeholder="${currentEntity==='all'?'Поиск по всем указателям…':'Поиск…'}" value="${escapeHtml(searchQuery)}" autofocus />
              </div>
              <button class="filter-chip ${onlyDiscussed?'active':''}" id="only-discussed-btn">только обсуждаемые (≥2 стр.)</button>
            </div>
            ${sortMostFrequentBtnHtml}
            ${catChips}
            ${candidateBtnHtml ? `<div class="filter-row">${candidateBtnHtml}</div>` : ''}
          </div>
          <div class="name-list" id="name-list"></div>
        </div>
        <div class="right-pane${isReverseLexicon ? ' reverse-right-pane' : ''}">
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
      invalidateVisibleItemsCache();
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
    invalidateVisibleItemsCache();
    renderList();
    persistViewState();
  };
  const onlyQuestionBtn = document.getElementById('only-question-btn');
  if (onlyQuestionBtn) {
    onlyQuestionBtn.onclick = (e) => {
      onlyQuestionCandidates = !onlyQuestionCandidates;
      e.target.classList.toggle('active', onlyQuestionCandidates);
      invalidateVisibleItemsCache();
      renderList();
      persistViewState();
    };
  }
  const sortMostFrequentBtn = document.getElementById('sort-most-frequent-btn');
  if (sortMostFrequentBtn) {
    sortMostFrequentBtn.onclick = (e) => {
      sortMostFrequentFirst = !sortMostFrequentFirst;
      e.target.classList.toggle('active', sortMostFrequentFirst);
      invalidateVisibleItemsCache();
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
      invalidateVisibleItemsCache();
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
    sortMostFrequentFirst ? 'freq-desc' : 'alpha',
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
  filtered.sort((a, b) => {
    if (sortMostFrequentFirst) {
      const diff = getItemFrequencyScore(b, currentEntity) - getItemFrequencyScore(a, currentEntity);
      if (diff !== 0) return diff;
    }
    return compareItemsByHead(a, b);
  });
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

function getSubjectByLexiconIndex() {
  if (SUBJECT_BY_LEXICON_INDEX) return SUBJECT_BY_LEXICON_INDEX;
  const idx = {};
  const byPage = new Map();
  const subjects = Array.isArray(APP_DATA && APP_DATA.subject_index) ? APP_DATA.subject_index : [];
  for (const s of subjects) {
    const head = String(s && s.head ? s.head : '').trim();
    if (!head) continue;
    const key = normalizeHeadForMatch(head);
    if (!key) continue;
    if (!idx[key]) idx[key] = [];
    idx[key].push(head);
    const pages = sortUniquePages(s.page_list || []);
    for (const rawPage of pages) {
      const page = parseInt(rawPage, 10);
      if (!Number.isFinite(page)) continue;
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page).push(head);
    }
  }
  for (const key of Object.keys(idx)) {
    idx[key].sort(compareHeadsRu);
  }
  SUBJECT_BY_LEXICON_INDEX = { exact: idx, byPage };
  return SUBJECT_BY_LEXICON_INDEX;
}

function appendListItemContent(item, it, itemType, showTypeLabel) {
  if (!item || !it) return;
  const isNameItem = itemType === 'names' || (currentEntity === 'all' && itemType === 'names');
  if (isNameItem && it.subcategory) {
    const dot = document.createElement('span');
    dot.className = `cat-dot ${getCategoryColorClass(it.subcategory)}`;
    item.appendChild(dot);
  }

  const head = document.createElement('span');
  head.className = `head ${it.discussed ? 'discussed' : ''}${itemType === 'lexicon_reverse' ? ' reverse-head' : ''}`;
  head.innerHTML = renderAccentSafe(it.head);

  const typeLabel = document.createElement('span');
  typeLabel.className = 'entity-type-tag';
  typeLabel.textContent = it._entityLabel || '';

  const moderatorMark = document.createElement('span');
  moderatorMark.className = 'moderator-mark';
  moderatorMark.textContent = '· мод.';

  const pagesCount = document.createElement('span');
  pagesCount.className = `pages-count${itemType === 'lexicon_reverse' ? ' reverse-pages-count' : ''}`;
  pagesCount.textContent = String((it.page_list || []).length);

  if (itemType === 'lexicon_reverse') {
    item.appendChild(pagesCount);
    item.appendChild(head);
  } else {
    item.appendChild(head);
  }
  if (showTypeLabel && typeLabel.textContent) item.appendChild(typeLabel);
  if (it.is_moderator) item.appendChild(moderatorMark);
  if (itemType !== 'lexicon_reverse') item.appendChild(pagesCount);

  if (itemType === 'subject') {
    const links = buildSubjectCrosslinks(it.head);
    if (links.length) {
      const crosslinks = document.createElement('div');
      crosslinks.className = 'subject-crosslinks';
      const label = document.createElement('span');
      label.className = 'crosslinks-label';
      label.textContent = 'Смотрите также:';
      crosslinks.appendChild(label);
      for (const lnk of links) {
        const link = document.createElement('a');
        link.className = 'crosslink-badge';
        link.href = buildItemHash(lnk.type, lnk.head);
        link.dataset.type = String(lnk.type || '');
        link.dataset.head = String(lnk.head || '');
        link.textContent = `${lnk.label || ''}: ${lnk.head || ''}`;
        crosslinks.appendChild(link);
      }
      item.appendChild(crosslinks);
    }
  }
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
    const itemType = it && it._entityType ? it._entityType : currentEntity;
    const letter = itemType === 'lexicon_reverse' ? getLastLetter(it.head) : getFirstLetter(it.head);
    if (letter !== prevLetter) {
      rows.push({ kind: 'header', letter, itemType });
      prevLetter = letter;
    }
    rows.push({ kind: 'item', it });
  }
  return rows;
}

function appendListRow(list, row, fallbackType, reverseColumns) {
  if (row.kind === 'header') {
    const h = document.createElement('div');
    h.className = 'letter-header' + ((row.itemType || fallbackType || currentEntity) === 'lexicon_reverse' ? ' reverse-letter-header' : '');
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
  const itemType = it._entityType || fallbackType || currentEntity;
  item.className = 'name-item' + (isSelected ? ' selected' : '') + (itemType === 'lexicon_reverse' ? ' name-item-reverse' : '');
  safeSetAttr(item, 'role', 'button');
  item.tabIndex = 0;
  safeSetAttr(item, 'aria-label', `${it.head || ''} (${(it.page_list || []).length})`);
  item.dataset.head = it.head || '';
  item.dataset.type = itemType;
  appendListItemContent(item, it, itemType, currentEntity === 'all');
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
    if (w >= 1800) return 6;
    if (w >= 1600) return 5;
    if (w >= 1400) return 4;
    if (w >= 1180) return 3;
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
    list.style.columnGap = currentEntity === 'lexicon_reverse' ? '8px' : '12px';
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
    more.className = 'list-truncated-message';
    if (listColumns > 1) more.style.columnSpan = 'all';
    more.textContent = `Показано первые ${MAX_RESULTS} результатов. Уточните запрос для сужения.`;
    list.appendChild(more);
  }
  if (filtered.length === 0) {
    list.innerHTML = '<div class="list-empty-message">Ничего не найдено</div>';
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

function getFocusedHistogramItem(entityKey) {
  if (!selectedItem || !entityKey) return null;
  const type = selectedItemType || entityKey;
  if (type !== entityKey) return null;
  return findItemByHeadAndType(selectedItem, entityKey);
}

function getHistogramSubjectLabel(entityKey) {
  const map = {
    names: 'имён',
    toponyms: 'топонимов',
    ethnonyms: 'этнонимов',
    languages: 'языков',
    lexicon: 'лексем',
    lexicon_reverse: 'лексем (обратный список)',
    lexicon_tech: 'реконструированных форм',
    subject: 'понятий',
    all: 'элементов',
  };
  return map[entityKey] || 'элементов';
}

function buildHistogramIntroText(entityKey, focusedItem) {
  if (focusedItem && focusedItem.head) {
    return `Распределение упоминаний «${focusedItem.head}» по лекциям книги (по страницам внутри каждой лекции).`;
  }
  if (entityKey === 'lexicon_reverse') return '';
  return `Распределение ${getHistogramSubjectLabel(entityKey)} по лекциям книги: сколько элементов раздела встречается в каждой лекции. Кликните по столбцу — увидите элементы соответствующей лекции.`;
}

function getChapterHistogramStats(entityKey, focusedItem = null) {
  const focusKey = focusedItem && focusedItem.head ? normalizeHeadForMatch(focusedItem.head) : '*';
  const key = `${entityKey}::${focusKey}::${getDataSignature()}`;
  return getCachedAggregate('histogram', key, () => {
    const counts = {};
    const chapters = Array.isArray(APP_DATA?.chapters) ? APP_DATA.chapters : [];
    if (focusedItem && Array.isArray(focusedItem.page_list)) {
      const pages = sortUniquePages(focusedItem.page_list);
      for (const ch of chapters) {
        let c = 0;
        for (const p of pages) {
          if (p >= ch.start && p <= ch.end) c += 1;
        }
        counts[ch.name] = c;
      }
    } else {
      for (const ch of chapters) {
        const indexed = getChapterIndexedItems(entityKey, ch.name);
        counts[ch.name] = indexed ? indexed.length : 0;
      }
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
  list.innerHTML = `<div class="chapter-filter-banner"><strong>Лекция:</strong> ${escapeHtml(chapter.name)} <span class="chapter-filter-count">(${filtered.length})</span></div>`;
  appendItemsWithLetters(list, filtered, entityKey);
}

function renderChapterHistogramRows(host, entityKey, focusedItem = null) {
  const stats = getChapterHistogramStats(entityKey, focusedItem);
  const counts = stats.counts;
  const max = stats.max;
  let html = '';
  for (const ch of APP_DATA.chapters) {
    const c = counts[ch.name] || 0;
    const pct = c / max * 100;
    html += `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(ch.name)}<br><small>стр. ${ch.start}–${ch.end}</small></div>
        <div class="bar-bg"><div class="bar-fill" data-chapter="${escapeHtml(ch.name)}" style="width:${pct}%"></div></div>
        <div class="bar-count">${c}</div>
      </div>`;
  }
  host.innerHTML = html;
}

function renderHistogramInRight() {
  const right = getRightContentHost();
  if (!right) return;
  const focusedItem = getFocusedHistogramItem(currentEntity);
  const introText = buildHistogramIntroText(currentEntity, focusedItem);
  const introHtml = introText ? `<p class="chart-intro">${escapeHtml(introText)}</p>` : '';
  const html = `<div class="chart">
    ${introHtml}
    <div id="right-histogram"></div>
  </div>`;
  right.innerHTML = html;
  const root = document.getElementById('right-histogram');
  if (!root) return;
  renderChapterHistogramRows(root, currentEntity, focusedItem);
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
    right.innerHTML = '<div class="card"><div class="card-missing-message">Элемент не найден</div></div>';
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
  const hasMapCoords = Number.isFinite(Number(it.lat)) && Number.isFinite(Number(it.lon));
  const canOpenMapForCard = ['toponyms', 'ethnonyms', 'languages'].includes(eType) && hasMapCoords;
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
      return `<span class="card-source-pill">${link}<button type="button" class="related-link related-link-btn source-export-bib card-source-bib" data-source-idx="${sourceIdx}">BibTeX</button></span>`;
    }).join('');
    if (sourcePills) {
      headerSourcesHtml = `<div class="card-sources-inline"><span class="card-sources-label">Sources</span>${sourcePills}</div>`;
    }
  }
  const allPages = sortUniquePages(it.page_list || []);
  let pagesText = it.pages || it.head_pages || '';
  const pageLinksHtml = buildCardPageLinksHtml(allPages);
  const showLectureBreakdown = ['lexicon', 'lexicon_tech', 'lexicon_reverse'].includes(eType);
  const lectureBreakdownHtml = showLectureBreakdown ? buildLecturePageBreakdownHtml(allPages) : '';

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
          <div class="card-actions">
            <button type="button" class="related-link related-link-btn card-action-link" id="card-prev" aria-label="Предыдущая карточка">◀</button>
            <button type="button" class="related-link related-link-btn card-action-link" id="card-next" aria-label="Следующая карточка">▶</button>
            <button type="button" class="related-link related-link-btn card-action-link" id="back-to-histo">← вернуться к гистограмме</button>
            ${canOpenMapForCard ? '<button type="button" class="related-link related-link-btn card-action-link" id="open-on-map">📍 показать на карте</button>' : ''}
            <button type="button" class="related-link related-link-btn card-action-link" id="export-card-md">экспорт карточки .md</button>
            <button type="button" class="related-link related-link-btn card-action-link" id="copy-card-link">скопировать ссылку</button>
          </div>
        </div>
      </div>
      <div class="pages-info">
        <strong>Упоминается на ${allPages.length} ${pluralPages(allPages.length)}:</strong>
        <span class="pages-links">${pageLinksHtml || escapeHtml(pagesText)}</span>
        ${it.discussed ? ' · <em>обсуждается</em>' : ' · однократное упоминание'}
      </div>
      ${lectureBreakdownHtml}
  `;
  if (eType === 'lexicon' || eType === 'lexicon_tech') {
    html += `<div class="card-kwic-action">
      <button type="button" class="related-link related-link-btn kwic-jump-btn" data-term="${escapeHtml(it.head)}">\u041d\u0430\u0439\u0442\u0438 \u0432 KWIC</button>
    </div>`;
  }
  const flagBadges = [];
  if (editorial.verified) flagBadges.push('<span class="card-editorial-flag verified">verified</span>');
  if (editorial.suspect) flagBadges.push('<span class="card-editorial-flag suspect">suspect</span>');
  if (flagBadges.length) {
    html += `<div class="card-editorial-flags">${flagBadges.join('')}</div>`;
  }
  if (editorial.note) {
    html += `<div class="card-editorial-note">
      <strong>Editor note:</strong> ${escapeHtml(editorial.note)}
    </div>`;
  }
  if (it.is_moderator && it.moderator_note) {
    html += `<div class="card-moderator-note">
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
      const quote = (!isWikiSource && src.quote) ? `<div class="card-source-quote">“${escapeHtml(src.quote)}”</div>` : '';
      html += `<div class="card-source-row">
        ${link}
        <span class="card-source-page">${pageHint}</span>
        <button type="button" class="related-link related-link-btn source-export-bib card-source-row-bib" data-source-idx="${sourceIdx}">BibTeX</button>
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
    html += '<h3>Лекции</h3><ul class="card-lecture-list">';
    for (const ch of it.chapters) {
      const lectureIdx = findLectureIndexByName(ch);
      if (lectureIdx >= 0) {
        html += `<li><a class="related-link lecture-open-link" data-lecture-idx="${lectureIdx}" href="${escapeHtml(buildLecturePageHash(lectureIdx))}">${escapeHtml(ch)}</a></li>`;
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
        html += `<a class="glossary-backlink card-inline-row-link" data-term="${escapeHtml(g.term)}" href="${escapeHtml(buildGlossaryTermHash(g.term))}">
          <span>${escapeHtml(g.term)}</span>
          <span class="card-inline-row-meta">${escapeHtml(shortDef)}</span>
        </a>`;
      }
      html += '</div>';
    }
  }
  if (eType === 'lexicon') {
    const subjectIdx = getSubjectByLexiconIndex();
    let subjLinks = (subjectIdx && subjectIdx.exact && subjectIdx.exact[normalizeHeadForMatch(it.head)]) || [];
    if (!subjLinks.length) {
      const fallbackHead = pickBestCrosslinkByPageOverlap(sortUniquePages(it.page_list || []), subjectIdx && subjectIdx.byPage);
      if (fallbackHead) subjLinks = [fallbackHead];
    }
    if (subjLinks.length) {
      const linksHtml = subjLinks.map((h) => `<a href="${escapeHtml(buildItemHash('subject', h))}"
        class="crosslink-badge"
        data-type="subject"
        data-head="${escapeHtml(h)}">${escapeHtml(h)}</a>`).join('');
      html += `<div class="subject-crosslinks">
        <span class="crosslinks-label">В предметном указателе:</span>
        ${linksHtml}
      </div>`;
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
    html += `<a class="xlink card-inline-row-link" data-type="${escapeHtml(tgtType)}" data-head="${escapeHtml(lnk.head)}" href="${escapeHtml(buildItemHash(tgtType, lnk.head))}">
        <span>${escapeHtml(lnk.head)}</span>
        ${lnk.weight > 1 ? `<span class="card-inline-row-meta">· ${escapeHtml(lnk.weight)}</span>` : '<span></span>'}
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
  const openOnMapBtn = document.getElementById('open-on-map');
  if (openOnMapBtn) {
    openOnMapBtn.onclick = () => {
      selectedItem = it.head;
      selectedItemType = eType;
      rightPaneMode = 'card';
      switchTab('map');
    };
  }
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
      openKwicTerm(term);
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
  right.querySelectorAll('.ctx-link[data-type="glossary"][data-head]').forEach((el) => {
    bindActionWithKeyboard(el, () => {
      const term = clampUiInput((el.dataset && el.dataset.head) || '', MAX_LIST_QUERY_LENGTH);
      if (!term) return;
      if (typeof window !== 'undefined') window._pendingGlossaryTerm = term.toLowerCase();
      openGlossaryTerm(term);
    });
  });
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
  if (withEpoch.length === 0) { tl.innerHTML = '<p class="panel-muted-message">Нет данных.</p>'; return; }
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
      svg += `<g class="timeline-point" data-name="${escapeHtml(n.head)}">
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
      svg += `<g class="timeline-point" data-name="${escapeHtml(p.name.head)}">
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
    div.innerHTML = `<span class="legend-dot ${getCategoryColorClass(sub)}"></span>${LABELS[sub]}`;
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

  let html = '<div class="epochs-grid">';
  for (const ep of epochs) {
    const list = grouped[ep.key];
    const epochColor = safeColor(EPOCH_COLORS[ep.key], '#8a7050');
    html += `<div class="epoch-card">
      <div class="epoch-card-head" style="--epoch-color:${epochColor};">
        <div class="epoch-card-title">${ep.label}</div>
        <div class="epoch-card-meta">${ep.sub} · ${list.length}</div>
      </div>
      <div class="epoch-link-list">`;
    for (const t of list) {
      const discussedClass = t.discussed ? ' discussed' : '';
      html += `<a class="related-link epoch-link${discussedClass}" data-head="${escapeHtml(t.head)}" href="${escapeHtml(buildItemHash('toponyms', t.head))}">${escapeHtml(t.head)}</a>`;
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
    rememberBoundedCacheValue(aggregateCache, cacheKey, layout, AGGREGATE_CACHE_MAX);
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
    <div id="graph-status" class="graph-status">Calculating graph layout...</div>
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
    tooltip.textContent = '';
  }

  function showTooltip(event, item) {
    if (!tooltip || !stage || !item) return;
    const rect = stage.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(0, px)}px`;
    tooltip.style.top = `${Math.max(0, py)}px`;
    tooltip.textContent = '';
    const title = document.createElement('strong');
    title.textContent = String(item.name || '');
    tooltip.appendChild(title);
    tooltip.appendChild(document.createTextNode(`${item.subcat || 'uncategorized'} - mentions: ${Number(item.weight || 0)}`));
  }

  function renderLegend(rows) {
    if (!legend) return;
    legend.textContent = '';
    for (const row of rows) {
      const item = document.createElement('span');
      item.className = 'graph-legend-item';
      const swatch = document.createElement('span');
      swatch.className = `graph-legend-swatch ${getCategoryColorClass(row.label)}`;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(`${row.label} (${row.count})`));
      legend.appendChild(item);
    }
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
        .map(([label, count]) => ({ label, count }));
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
    rememberBoundedCacheValue(aggregateCache, cacheKey, layout, AGGREGATE_CACHE_MAX);
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
    <div class="graph-filter-row"><button class="filter-chip ${graphStrongOnly ? 'active' : ''}" id="lang-strong-btn">только сильные связи (вес ≥ 50)</button></div>
    <div id="families-status" class="graph-status">Рассчитываю расположение узлов…</div>
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
  return `<details id="home-howto-details" class="home-howto" open>
    <summary class="home-howto-summary">Как пользоваться «Зализнякиадой»</summary>
    <div class="home-howto-grid">
      <div class="home-howto-column">
      <p><strong>BookIndex</strong> — интерактивный указатель к книге А. А. Зализняка «Из жизни слов и языков». Он собран в один файл <code>aaz-index.html</code> и работает как навигационная надстройка над книгой: помогает быстрее находить темы, имена, термины и географию книги. Демо: <a href="${escapeHtml(demoHref)}" class="home-howto-link">${escapeHtml(demoHref)}</a>.</p>

      <h3 class="home-howto-h3">Что это дает читателю</h3>
      <ul class="home-howto-list">
        <li>Быстро находить нужные темы, имена и термины по странице: например, <a href="${escapeHtml(udarenieAllHash)}" class="home-howto-link">ударение</a>, <a href="${escapeHtml(globalBerestaHash)}" class="home-howto-link">берестяные грамоты</a>, <a href="${escapeHtml(globalAvanesovHash)}" class="home-howto-link">Аванесов Р. И.</a> или <a href="${escapeHtml(globalAngliaHash)}" class="home-howto-link">Англия</a>.</li>
        <li>Видеть, насколько тема важна: не по одному упоминанию, а по тому, сколько страниц она покрывает в <a href="${escapeHtml(subjectListHash)}" class="home-howto-link">предметном указателе</a>.</li>
        <li>Путешествовать по книге не только по оглавлению, но и по <a href="${escapeHtml(toponymsMapHash)}" class="home-howto-link">картам</a>, спискам <a href="${escapeHtml(languagesListHash)}" class="home-howto-link">языков</a> и <a href="${escapeHtml(ethnonymsListHash)}" class="home-howto-link">народов</a>.</li>
      </ul>

      <h3 class="home-howto-h3">Какие указатели там есть</h3>
      <p class="home-howto-p">Внутри BookIndex несколько разных указателей. Они выглядят как алфавитные списки, но отвечают на разные вопросы.</p>

      <h4 class="home-howto-h4">Имена</h4>
      <p class="home-howto-p">Раздел <a href="${escapeHtml(namesListHash)}" class="home-howto-link">«Имена»</a> — это указатель ученых, авторов и исторических фигур. Например, можно открыть <a href="${escapeHtml(avanesovItemHash)}" class="home-howto-link">Аванесов Р. И.</a> или найти <a href="${escapeHtml(avvakumHash)}" class="home-howto-link">Аввакум [Петров]</a>.</p>

      <h4 class="home-howto-h4">Топонимы</h4>
      <p class="home-howto-p">Раздел <a href="${escapeHtml(toponymsListHash)}" class="home-howto-link">«Топонимы»</a> — географический указатель: страны, города, регионы. Пример: <a href="${escapeHtml(angliaItemHash)}" class="home-howto-link">Англия</a> в списке и в <a href="${escapeHtml(toponymsMapHash)}" class="home-howto-link">режиме карты</a>. Еще пример для поиска — <a href="${escapeHtml(rossiyaHash)}" class="home-howto-link">Россия</a>.</p>

      <h4 class="home-howto-h4">Этнонимы</h4>
      <p class="home-howto-p">Раздел <a href="${escapeHtml(ethnonymsListHash)}" class="home-howto-link">«Этнонимы»</a> собирает названия народов и этнических групп. Удобно проверять страницы, где народ обсуждается как носитель языка, традиции или контактной зоны.</p>

      <h4 class="home-howto-h4">Языки</h4>
      <p class="home-howto-p">Раздел <a href="${escapeHtml(languagesListHash)}" class="home-howto-link">«Языки»</a> — указатель языков и языковых групп. Пример: <a href="${escapeHtml(austraItemHash)}" class="home-howto-link">австралийские</a> в списке и точка в <a href="${escapeHtml(languagesMapHash)}" class="home-howto-link">карте языков</a>.</p>

      <h4 class="home-howto-h4">Лексика</h4>
      <p class="home-howto-p">Раздел <a href="${escapeHtml(lexiconListHash)}" class="home-howto-link">«Лексика»</a> — словарный указатель к книге. <a href="${escapeHtml(lexiconReverseHash)}" class="home-howto-link">«Лексика (обратная)»</a> полезна, если хотите искать не по началу слова, а по окончанию, корню или модели.</p>

      <h4 class="home-howto-h4">Реконструкции</h4>
      <p class="home-howto-p"><a href="${escapeHtml(reconstructionsHash)}" class="home-howto-link">«Реконструкции»</a> — небольшой технический раздел для восстановленных форм и специальных обозначений.</p>

      <h4 class="home-howto-h4">Предметный указатель</h4>
      <p class="home-howto-p"><a href="${escapeHtml(subjectListHash)}" class="home-howto-link">«Предметный»</a> отвечает на вопрос не «где встречается слово», а «где в книге разбирается явление»: <a href="${escapeHtml(akanyeSubjectHash)}" class="home-howto-link">аканье</a>, <a href="${escapeHtml(birchSubjectHash)}" class="home-howto-link">берестяные грамоты</a>, <a href="${escapeHtml(articleSubjectHash)}" class="home-howto-link">артикль</a>, <a href="${escapeHtml(udarenieSubjectHash)}" class="home-howto-link">ударение</a>.</p>

      </div>
      <div class="home-howto-column">
      <h3 class="home-howto-h3">Как это помогает читать книгу</h3>
      <ul class="home-howto-list">
        <li>Если вы ищете конкретное имя, BookIndex ведет прямо к страницам и контексту: <a href="${escapeHtml(avanesovHash)}" class="home-howto-link">Аванесов Р. И.</a> или <a href="${escapeHtml(avvakumHash)}" class="home-howto-link">Аввакум</a>.</li>
        <li>Если нужна география, откройте <a href="${escapeHtml(toponymsListHash)}" class="home-howto-link">топонимы</a> и посмотрите <a href="${escapeHtml(toponymsMapHash)}" class="home-howto-link">карту</a>: например, <a href="${escapeHtml(angliaHash)}" class="home-howto-link">Англия</a>.</li>
        <li>Если нужны языки, используйте список + карту: пример <a href="${escapeHtml(austraHash)}" class="home-howto-link">австралийские</a>.</li>
        <li>Если нужна тема, <a href="${escapeHtml(subjectListHash)}" class="home-howto-link">предметный указатель</a> покажет, где она реально разбирается по страницам.</li>
      </ul>

      <h3 class="home-howto-h3">Два вида поиска</h3>
      <p class="home-howto-p"><strong>Глобальный поиск</strong> в шапке страницы: вводите имя, язык, топоним, термин или лекцию. Примеры: <a href="${escapeHtml(angliaHash)}" class="home-howto-link">Англия</a>, <a href="${escapeHtml(udarenieAllHash)}" class="home-howto-link">ударение</a>, <a href="${escapeHtml(globalLekciiHash)}" class="home-howto-link">лекция</a>.</p>
      <p class="home-howto-p"><strong>Локальный поиск</strong> внутри раздела: фильтрует только текущий список. Для контекстов по фрагментам используйте <a href="${escapeHtml(kwicHash)}" class="home-howto-link">KWIC</a> и, например, запрос <a href="${escapeHtml(sanskritHash)}" class="home-howto-link">санскрит</a>.</p>

      <h3 class="home-howto-h3">Карта и примеры</h3>
      <p class="home-howto-p">Карта работает в разделах <a href="${escapeHtml(toponymsMapHash)}" class="home-howto-link">«Топонимы»</a>, <a href="${escapeHtml(ethnonymsMapHash)}" class="home-howto-link">«Этнонимы»</a> и <a href="${escapeHtml(languagesMapHash)}" class="home-howto-link">«Языки»</a>.</p>
      <ul class="home-howto-list">
        <li><a href="${escapeHtml(angliaHash)}" class="home-howto-link">Англия</a> — точка над Британскими островами и связанная карточка.</li>
        <li><a href="${escapeHtml(austraHash)}" class="home-howto-link">австралийские</a> — языковая зона с привязкой к географии.</li>
        <li>Любой этноним — возможность увидеть, где живет группа, а не только как она названа.</li>
      </ul>

      <h3 class="home-howto-h3">Как сохранить и читать офлайн</h3>
      <p class="home-howto-p">Сайт можно открыть по ссылке или сохранить локально. Так как <code>aaz-index.html</code> автономен, списки, поиск, карточки и переходы между разделами остаются доступными без интернета; для тайлов карты может понадобиться сеть.</p>

      <h3 class="home-howto-h3">Как использовать в Obsidian</h3>
      <ul class="home-howto-list">
        <li>Сохраните <code>aaz-index.html</code> в vault.</li>
        <li>Сделайте заметку «Зализнякиада — навигация».</li>
        <li>Добавьте в нее ссылки на нужные разделы, например <a href="${escapeHtml(materialsPhoneticHash)}" class="home-howto-link">фонетические законы</a> и <a href="${escapeHtml(subjectListHash)}" class="home-howto-link">предметный</a>.</li>
        <li>Для важных тем заводите отдельные заметки и переносите диапазоны страниц из указателей.</li>
      </ul>
      <ol class="home-howto-list">
        <li>Откройте <a href="${escapeHtml(udarenieSubjectHash)}" class="home-howto-link">ударение</a> в предметном указателе.</li>
        <li>Добавьте страницы в заметку Obsidian.</li>
        <li>Затем откройте <a href="${escapeHtml(angliaHash)}" class="home-howto-link">Англия</a> в топонимах.</li>
        <li>После этого перейдите в <a href="${escapeHtml(languagesListHash)}" class="home-howto-link">языки</a> и свяжите материал с другими заметками.</li>
      </ol>

      <h3 class="home-howto-h3">С чего начать</h3>
      <ol class="home-howto-list">
        <li>Откройте <a href="${escapeHtml(demoHref)}" class="home-howto-link">главную страницу</a>.</li>
        <li>В шапке попробуйте глобальный поиск по слову <a href="${escapeHtml(udarenieAllHash)}" class="home-howto-link" id="home-howto-link-udarenie">ударение</a>.</li>
        <li>Откройте <a href="${escapeHtml(subjectListHash)}" class="home-howto-link">«Предметный»</a> и посмотрите охват темы по страницам.</li>
        <li>Перейдите в <a href="${escapeHtml(toponymsListHash)}" class="home-howto-link">«Топонимы»</a> и найдите <a href="${escapeHtml(angliaHash)}" class="home-howto-link">Англия</a>.</li>
        <li>Откройте <a href="${escapeHtml(languagesMapHash)}" class="home-howto-link">карту языков</a> и сравните с карточками.</li>
      </ol>

      <p class="home-howto-p">Так BookIndex превращается в живую карту книги, а не просто в список ссылок.</p>
      </div>
    </div>
  </details>`;
}

function buildHomeDeclarativeViewModel() {
  const stats = APP_DATA.book_stats || {};
  const routes = Array.isArray(APP_DATA.routes) ? APP_DATA.routes : [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const recentRaw = loadRecentItems().slice(0, 10);
  const vw = (typeof window !== 'undefined' && typeof window.innerWidth === 'number') ? window.innerWidth : 0;
  const vh = (typeof window !== 'undefined' && typeof window.innerHeight === 'number') ? window.innerHeight : 0;
  const isDesktop = vw >= 980;
  const compactHome = isDesktop && vh > 0 && vh <= 840;

  const homeInnerPadding = compactHome ? '10px 14px' : '14px 20px';
  const factPairClass = compactHome ? 'home-fact-pair home-fact-pair-compact' : 'home-fact-pair';
  const quoteClass = compactHome ? 'home-featured-quote home-featured-quote-compact' : 'home-featured-quote home-featured-quote-full';
  const quoteTextClass = compactHome ? 'home-featured-quote-clamp' : '';
  const routeGridClass = (compactHome || isDesktop) ? 'home-routes-grid home-routes-grid-compact' : 'home-routes-grid';

  const topFamilyName = Array.isArray(stats.top_family) ? String(stats.top_family[0] || '') : '';
  const topFamilyCount = Array.isArray(stats.top_family) ? Number(stats.top_family[1] || 0) : 0;
  const earliestEpochRaw = Number(stats?.earliest_person?.epoch);
  const earliestEpoch = Number.isFinite(earliestEpochRaw) ? earliestEpochRaw : 0;
  const earliestEpochLabel = earliestEpoch < 0 ? `${Math.abs(earliestEpoch)} до н. э.` : `${earliestEpoch} г.`;

  const statsCards = [
    { key: 'pages', num: String(stats.total_pages || 404), label: 'страницы' },
    {
      key: 'lectures',
      num: stats.has_preface ? '10 + 1' : String(stats.lectures || 10),
      label: stats.has_preface ? 'лекций + предисловие' : 'лекций',
    },
    { key: 'names', num: String(stats.names || 0), label: 'имён' },
    { key: 'languages', num: String(stats.languages || 0), label: 'языков' },
    { key: 'toponyms', num: String(stats.toponyms || 0), label: 'топонимов' },
    { key: 'ethnonyms', num: String(stats.ethnonyms || 0), label: 'этнонимов' },
    {
      key: 'lexicon',
      num: Number(stats.lexicon || 0).toLocaleString('ru'),
      label: 'лексем',
    },
    { key: 'subject', num: String(stats.subject_index || 0), label: 'понятий' },
  ];

  const facts = [
    `Самая длинная лекция — «${String(stats?.longest_lecture?.name || '')}» (${String(stats?.longest_lecture?.pages || 0)} страниц)`,
    `Самый часто упоминаемый язык — ${String(stats?.top_lang?.head || '')} (${String(stats?.top_lang?.count || 0)} упоминаний)`,
    `Самое часто упоминаемое место — ${String(stats?.top_topo?.head || '')} (${String(stats?.top_topo?.count || 0)} упоминаний)`,
    `Самый часто упоминаемый человек — ${String(stats?.top_name?.head || '')} (${String(stats?.top_name?.count || 0)} упоминаний)`,
    `Самое часто обсуждаемое слово — «${String(stats?.top_lex?.head || '')}» (${String(stats?.top_lex?.count || 0)} упоминаний)`,
    `Самый ранний из упомянутых — ${String(stats?.earliest_person?.head || '')} (${earliestEpochLabel})`,
    `Самая представленная семья — ${topFamilyName} (${topFamilyCount} языков)`,
  ];

  const normalizeRouteIcon = (value) => {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '•';
    return raw.replace(/[<>]/g, '').slice(0, 8) || '•';
  };

  const routeCards = routes.map((r, idx) => ({
    id: String(r?.id || `route-${idx}`),
    title: String(r?.title || ''),
    desc: String(r?.desc || ''),
    icon: normalizeRouteIcon(r?.icon),
    pages: String(r?.pages || ''),
    entities: Array.isArray(r?.entities)
      ? r.entities
        .map((e, eIdx) => ({
          key: `${idx}-${eIdx}-${String(e?.type || '')}-${String(e?.head || '')}`,
          type: String(e?.type || ''),
          head: String(e?.head || ''),
        }))
        .filter((e) => e.type && e.head)
      : [],
  }));

  const recentItems = recentRaw
    .map((r, idx) => {
      const conf = ENTITY_TYPES[r.type];
      return {
        key: `${idx}-${String(r.type || '')}-${String(r.head || '')}`,
        type: String(r.type || ''),
        head: String(r.head || ''),
        label: conf ? conf.title : String(r.type || ''),
      };
    })
    .filter((r) => r.type && r.head);

  return {
    compactHome,
    routeGridClass,
    homeInnerPadding,
    factPairClass,
    quoteClass,
    quoteTextClass,
    statsCards,
    facts,
    routes: routeCards,
    recentItems,
    featuredText: String(featured.text || ''),
    featuredPage: String(featured.page || ''),
    featuredLecture: String(featured.lecture || ''),
    guideHtml: buildHomeHowToGuideHtml(),
    longestLectureName: String(stats?.longest_lecture?.name || ''),
    topLangHead: String(stats?.top_lang?.head || ''),
    topTopoHead: String(stats?.top_topo?.head || ''),
    topNameHead: String(stats?.top_name?.head || ''),
    topLexHead: String(stats?.top_lex?.head || ''),
    earliestNameHead: String(stats?.earliest_person?.head || ''),
  };
}

function createHomeDeclarativeState(viewModel) {
  const vm = viewModel || buildHomeDeclarativeViewModel();
  return {
    ...vm,
    exportMarkdown() {
      exportWholeSiteMarkdown();
    },
    openFact(index) {
      const idx = Number(index);
      if (idx === 0) {
        const lectureIndex = findLectureIndexByName(vm.longestLectureName);
        openLecturePage(lectureIndex >= 0 ? lectureIndex : 1);
        return;
      }
      if (idx === 1) {
        navigateToItem('languages', vm.topLangHead);
        return;
      }
      if (idx === 2) {
        navigateToItem('toponyms', vm.topTopoHead);
        return;
      }
      if (idx === 3) {
        navigateToItem('names', vm.topNameHead);
        return;
      }
      if (idx === 4) {
        navigateToItem('lexicon', vm.topLexHead);
        return;
      }
      if (idx === 5) {
        navigateToItem('names', vm.earliestNameHead);
        return;
      }
      if (idx === 6) {
        currentEntity = 'languages';
        currentTab = 'families';
        selectedItem = null;
        selectedItemType = null;
        rightPaneMode = 'histogram';
        renderEntitySwitcher();
        renderTabs();
        renderContent();
        syncNavigationState();
      }
    },
    openRoute(type, head) {
      if (!type || !head) return;
      navigateToItem(type, head);
    },
    openRecent(type, head) {
      if (!type || !head) return;
      navigateToItem(type, head);
    },
  };
}

function renderHomePanelDeclarative(container) {
  const alpine = (typeof window !== 'undefined' && window.Alpine) ? window.Alpine : null;
  if (!alpine || typeof alpine.initTree !== 'function') {
    renderHomePanel(container);
    return;
  }

  const viewModel = buildHomeDeclarativeViewModel();
  const state = createHomeDeclarativeState(viewModel);
  if (typeof globalThis !== 'undefined') {
    globalThis[HOME_DECL_FACTORY_KEY] = () => state;
  }

  container.innerHTML = `<div class="panel active home-panel home-panel-declarative">
    <div id="home-declarative-root" class="home-declarative-root" x-data="${HOME_DECL_FACTORY_KEY}()" style="--home-decl-padding:${viewModel.homeInnerPadding};">
      <div class="home-stats-hero">
        <div class="home-stats-head">
          <h2 class="home-stats-title">Book stats (declarative mode)</h2>
          <button type="button" @click="exportMarkdown" class="home-export-btn">Export BookIndex to Markdown</button>
        </div>
        <div class="home-stats-subtitle">Experimental tab: KPI and route rendering via Alpine.js</div>

        <div id="home-stats-grid-decl" class="home-stats-grid">
          <template x-for="cell in statsCards" :key="cell.key">
            <div class="home-stat-cell">
              <div class="home-stat-num" x-text="cell.num"></div>
              <div class="home-stat-label" x-text="cell.label"></div>
            </div>
          </template>
        </div>

        <div class="home-facts" style="--home-facts-space:${viewModel.compactHome ? 10 : 14}px;--home-facts-line-height:${viewModel.compactHome ? 1.55 : 1.7};">
          <div id="home-fact-pair-decl" class="${viewModel.factPairClass}">
            <div>
              <template x-for="(fact, idx) in facts" :key="idx">
                <button type="button" @click="openFact(idx)" class="home-decl-fact-button">
                  <span x-text="fact"></span>
                </button>
              </template>
            </div>
            <div id="home-featured-quote-decl" class="${viewModel.quoteClass}" style="--home-featured-padding:${viewModel.compactHome ? 8 : 10}px;">
              <div class="${viewModel.quoteTextClass}" x-text="'&quot;' + featuredText + '&quot;'"></div>
              <div class="home-featured-meta" x-text="'page ' + featuredPage + ', lecture &quot;' + featuredLecture + '&quot;'"></div>
              <div class="home-featured-hint">Choose a path through the book and jump directly to cards.</div>
            </div>
          </div>
        </div>
      </div>

      <h2 class="home-routes-title">Choose a path through the book</h2>
      <div class="${viewModel.routeGridClass}">
        <template x-for="route in routes" :key="route.id">
          <div class="home-route-card">
            <div class="home-route-head">
              <div class="home-route-title" x-text="route.title"></div>
              <div class="home-route-meta">
                <div class="home-route-pages" x-text="'pages ' + route.pages"></div>
                <div class="home-route-icon" x-text="route.icon"></div>
              </div>
            </div>
            <div class="home-route-desc" x-text="route.desc"></div>
            <div class="home-route-links">
              <template x-for="entity in route.entities" :key="entity.key">
                <button type="button" @click="openRoute(entity.type, entity.head)" class="home-route-link home-decl-route-button">
                  <span x-text="entity.head"></span>
                </button>
              </template>
            </div>
          </div>
        </template>
      </div>

      <div class="home-recent-card">
        <div class="home-recent-title">Recently opened</div>
        <div id="home-recent-items-decl" class="home-recent-items">
          <template x-if="recentItems.length === 0">
            <span class="home-recent-empty">Nothing yet - open any card.</span>
          </template>
          <template x-for="item in recentItems" :key="item.key">
            <button type="button" @click="openRecent(item.type, item.head)" class="home-recent-link home-decl-recent-button">
              <span x-text="item.head"></span>
              <span class="home-recent-label" x-text="' - ' + item.label"></span>
            </button>
          </template>
        </div>
      </div>

      <div x-html="guideHtml"></div>
    </div>
  </div>`;

  alpine.initTree(container);
}

function renderHomePanel(container) {
  const stats = APP_DATA.book_stats;
  const routes = APP_DATA.routes || [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const vw = (typeof window !== 'undefined' && typeof window.innerWidth === 'number') ? window.innerWidth : 0;
  const vh = (typeof window !== 'undefined' && typeof window.innerHeight === 'number') ? window.innerHeight : 0;
  const isDesktop = vw >= 980;
  const compactHome = isDesktop && vh > 0 && vh <= 840;
  const homeInnerPadding = compactHome ? '10px 14px' : '14px 20px';
  const factPairClass = compactHome ? 'home-fact-pair home-fact-pair-compact' : 'home-fact-pair';
  const quoteClass = compactHome ? 'home-featured-quote home-featured-quote-compact' : 'home-featured-quote home-featured-quote-full';
  const quoteTextClass = compactHome ? 'home-featured-quote-clamp' : '';
  const routeGridClass = (compactHome || isDesktop) ? 'home-routes-grid home-routes-grid-compact' : 'home-routes-grid';

  let html = `<div class="panel active home-panel"><div class="home-panel-inner" style="--home-inner-padding:${homeInnerPadding};">`;

  // === БЛОК 1: КНИГА В ЦИФРАХ ===
  html += `<div class="home-stats-hero">
    <div class="home-stats-head">
      <h2 class="home-stats-title">Книга в цифрах</h2>
      <button id="export-site-md" class="home-export-btn">Экспорт всего BookIndex в Markdown</button>
    </div>
    <div class="home-stats-subtitle">Что внутри 404 страниц лекций А. А. Зализняка</div>
    <div id="home-stats-grid" class="home-stats-grid">`;

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
    html += `<div class="home-stat-cell">
      <div class="home-stat-num">${num}</div>
      <div class="home-stat-label">${label}</div>
    </div>`;
  }
  html += '</div>';

  // Изюминки
  html += `<div class="home-facts" style="--home-facts-space:${compactHome ? 10 : 14}px;--home-facts-line-height:${compactHome ? 1.55 : 1.7};">
    <div id="home-fact-pair" class="${factPairClass}">
      <div>
        <div class="home-fact-row">📖 Самая длинная лекция — <strong>«${escapeHtml(stats.longest_lecture.name)}»</strong> (${stats.longest_lecture.pages} страниц)</div>
        <div class="home-fact-row">🗣 Самый часто упоминаемый язык — <strong>${escapeHtml(stats.top_lang.head)}</strong> (${stats.top_lang.count} упоминаний)</div>
        <div class="home-fact-row">🌍 Самое часто упоминаемое место — <strong>${escapeHtml(stats.top_topo.head)}</strong> (${stats.top_topo.count} упоминаний)</div>
        <div class="home-fact-row">👤 Самый часто упоминаемый человек — <strong>${escapeHtml(stats.top_name.head)}</strong> (${stats.top_name.count} упоминаний)</div>
        <div class="home-fact-row">📜 Самое часто обсуждаемое слово — <strong>«${escapeHtml(stats.top_lex.head)}»</strong> (${stats.top_lex.count} упоминаний)</div>
        <div class="home-fact-row">⏳ Самый ранний из упомянутых — <strong>${escapeHtml(stats.earliest_person.head)}</strong> (${Math.abs(stats.earliest_person.epoch)} ${stats.earliest_person.epoch < 0 ? 'до н.&nbsp;э.' : 'г.'})</div>
        <div class="home-fact-row">🌐 Самая представленная семья — <strong>${escapeHtml(stats.top_family[0])}</strong> (${stats.top_family[1]} языков)</div>
      </div>
      <div id="home-featured-quote" class="${quoteClass}" style="--home-featured-padding:${compactHome ? 8 : 10}px;">
        <div id="home-featured-quote-text" class="${quoteTextClass}">«${escapeHtml(featured.text)}»</div>
        <div class="home-featured-meta">— ${renderTextWithPageLinks(`стр. ${featured.page}`, { className: 'material-page-link card-page-link related-link home-featured-page-link', rangeTarget: 'trends' })}, лекция «${escapeHtml(featured.lecture)}»</div>
        <div class="home-featured-hint">Выберите свой путь по книге — если не знаете, с чего начать, выберите тему, которая вас интересует.</div>
      </div>
    </div>
  </div></div>`;

  const recentItems = loadRecentItems().slice(0, 10);

  // === БЛОК 2: МАРШРУТЫ ===
  if (compactHome) {
    html += `<details id="home-routes-details" class="home-routes-details">
      <summary class="home-routes-summary">Выберите свой путь по книге (${routes.length})</summary>
      <div class="${routeGridClass}">`;
  } else {
    html += `<h2 class="home-routes-title">Выберите свой путь по книге</h2>
      <div class="${routeGridClass}">`;
  }
  for (const r of routes) {
    html += `<div class="home-route-card">
      <div class="home-route-head">
        <div class="home-route-title">${escapeHtml(r.title)}</div>
        <div class="home-route-meta">
          <div class="home-route-pages">📑 страницы ${escapeHtml(r.pages)}</div>
          <div class="home-route-icon">${safeIcon(r.icon)}</div>
        </div>
      </div>
      <div class="home-route-desc">${escapeHtml(r.desc)}</div>
      <div class="home-route-links">`;
    for (const e of r.entities) {
      html += `<a class="route-link home-route-link" data-type="${escapeHtml(e.type)}" data-head="${escapeHtml(e.head)}" href="${escapeHtml(buildItemHash(e.type, e.head))}">${escapeHtml(e.head)}</a>`;
    }
    html += '</div></div>';
  }
  html += '</div>';
  if (compactHome) html += '</details>';
  html += `<div class="home-recent-card">
    <div class="home-recent-title">Недавно открывали</div>
    <div id="home-recent-items" class="home-recent-items">${recentItems.length ? '' : '<span class="home-recent-empty">Пока пусто — откройте любую карточку.</span>'}</div>
  </div>`;
  html += buildHomeHowToGuideHtml();

  html += '</div></div>';

  container.innerHTML = html;
  const homeFactPair = document.getElementById('home-fact-pair');
  if (homeFactPair) {
    const pairChildren = homeFactPair.children || [];
    const factCol = pairChildren[0] || null;
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
      bindActionWithKeyboard(row, factActions[i]);
    }
  }

  const recentBox = document.getElementById('home-recent-items');
  if (recentBox && recentItems.length) {
    let recentHtml = '';
    for (const r of recentItems) {
      const conf = ENTITY_TYPES[r.type];
      const label = conf ? conf.title : r.type;
      recentHtml += `<a class="home-recent-link" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}">${escapeHtml(r.head)} <span class="home-recent-label">· ${escapeHtml(label)}</span></a>`;
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
    let htmlOut = `<div class="reading-now-page-title"><strong>Страница ${currentPage}</strong>${chapter ? ` · ${escapeHtml(chapter.name)}` : ''}</div>`;
    htmlOut += `<div class="reading-now-action-row">`;
    htmlOut += `<button class="reading-now-open-trends reading-now-pill-btn" data-page="${currentPage}">Динамика этой страницы</button>`;
    if (chapter) {
      htmlOut += `<button class="reading-now-open-lecture reading-now-pill-btn" data-idx="${chapterIdx}">Открыть лекцию</button>`;
    }
    htmlOut += `</div>`;
    if (!groups.length) {
      htmlOut += '<div class="reading-now-empty">На этой странице в базе не найдено размеченных сущностей.</div>';
      readingResults.innerHTML = htmlOut;
    } else {
      for (const g of groups) {
        htmlOut += `<div class="reading-now-group"><strong>${escapeHtml(g.label)}:</strong> `;
        for (const it of g.items) {
          htmlOut += `<a class="reading-now-link" data-type="${escapeHtml(g.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(g.type, it.head))}">${escapeHtml(it.head)}</a>`;
        }
        if (g.total > g.items.length) htmlOut += `<span class="reading-now-more">и ещё ${g.total - g.items.length}</span>`;
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
  let html = '<div class="panel active tasks-panel"><div class="tasks-panel-inner">';
  html += '<h2 class="tasks-title">\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0441\u0435\u0431\u044f</h2>';
  html += '<div class="tasks-toolbar">';
  html += `<div class="tasks-toolbar-note">${baseTasks.length} \u0431\u0430\u0437\u043e\u0432\u044b\u0445 + ${dynamicTasks.length} \u0434\u0438\u043d\u0430\u043c\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u0432\u043e\u043f\u0440\u043e\u0441\u043e\u0432. \u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043d\u0430 \u043e\u0442\u0432\u0435\u0442, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c.</div>`;
  html += '<div class="tasks-toolbar-actions">';
  html += '<button id="tasks-reset-progress" class="tasks-toolbar-btn danger">\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443</button>';
  html += '<button id="tasks-regen" class="tasks-toolbar-btn">\u041d\u043e\u0432\u0430\u044f \u043f\u043e\u0434\u0431\u043e\u0440\u043a\u0430</button>';
  html += '</div>';
  html += '</div>';
  html += '<div id="tasks-summary" class="tasks-summary-grid"></div>';
  html += `<details id="tasks-history-box" class="tasks-history-box"${collapseHistory ? '' : ' open'}>`;
  html += '<summary id="tasks-history-summary" class="tasks-history-summary">\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u0442\u0432\u0435\u0442\u043e\u0432</summary>';
  html += '<div class="tasks-history-body">';
  html += '<div id="tasks-history-list" class="tasks-history-list"></div>';
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
        <div class="tasks-summary-card">
          <strong>\u0412\u0441\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0438</strong><br>
          \u041e\u0442\u0432\u0435\u0442\u043e\u0432: <strong>${totalAnswered}</strong> \u00b7
          \u0432\u0435\u0440\u043d\u044b\u0445: <strong>${totalCorrect}</strong> \u00b7
          \u0442\u043e\u0447\u043d\u043e\u0441\u0442\u044c: <strong>${totalAccuracy}%</strong>
        </div>
        <div class="tasks-summary-card">
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
        historyListEl.innerHTML = '<div class="task-history-empty">\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0442\u0432\u0435\u0442\u043e\u0432. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u0432 \u043b\u044e\u0431\u043e\u043c \u0432\u043e\u043f\u0440\u043e\u0441\u0435, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u044e.</div>';
      } else {
        historyListEl.textContent = '';
        for (const row of rows) {
          const item = document.createElement('div');
          item.className = `task-history-row ${row.isCorrect ? 'correct' : 'incorrect'}`;
          const head = document.createElement('div');
          head.className = 'task-history-row-head';
          const status = document.createElement('strong');
          status.className = 'task-history-status';
          status.textContent = row.isCorrect ? '\u0412\u0435\u0440\u043d\u043e' : '\u041e\u0448\u0438\u0431\u043a\u0430';
          const date = document.createElement('span');
          date.className = 'task-history-date';
          date.textContent = formatHistoryDate(row.at);
          head.appendChild(status);
          head.appendChild(date);

          const question = document.createElement('div');
          question.className = 'task-history-question';
          question.textContent = String(row.question || '');

          const answer = document.createElement('div');
          answer.className = 'task-history-answer';
          answer.appendChild(document.createTextNode('\u0412\u0430\u0448 \u043e\u0442\u0432\u0435\u0442: '));
          const selected = document.createElement('strong');
          selected.textContent = String(row.selected || '\u2014');
          answer.appendChild(selected);
          if (row.correctAnswer) {
            answer.appendChild(document.createTextNode(' \u00b7 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e: '));
            const correct = document.createElement('strong');
            correct.textContent = String(row.correctAnswer);
            answer.appendChild(correct);
          }

          item.appendChild(head);
          item.appendChild(question);
          item.appendChild(answer);
          historyListEl.appendChild(item);
        }
      }
    }
  };

  for (let ti = 0; ti < tasksShuffled.length; ti++) {
    const t = tasksShuffled[ti];
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-card';
    taskDiv.innerHTML = `
      <div class="task-card-question">\u0412\u043e\u043f\u0440\u043e\u0441 ${ti+1}. ${escapeHtml(t.question)}</div>
      <div class="task-options" id="task-tab-${t._storageId}-opts"></div>
      <div class="task-result" id="task-tab-${t._storageId}-res"></div>
    `;
    tc.appendChild(taskDiv);
    const optsDiv = document.getElementById(`task-tab-${t._storageId}-opts`);
    const optionsShuffled = shuffleArray((t.options || []).map((text, idx) => ({ text, idx })));
    for (let oi = 0; oi < optionsShuffled.length; oi++) {
      const opt = optionsShuffled[oi];
      const btn = document.createElement('button');
      btn.className = 'task-option-btn';
      btn.dataset.sourceIndex = String(opt.idx);
      btn.textContent = String.fromCharCode(65 + oi) + '. ' + opt.text;
      btn.onclick = () => {
        if (optsDiv.dataset.locked === '1') return;
        optsDiv.dataset.locked = '1';
        const isCorrect = opt.idx === t.correct;
        optsDiv.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.add('locked'); });
        if (isCorrect) {
          btn.classList.add('correct');
        } else {
          btn.classList.add('incorrect');
          const correctBtn = optsDiv.querySelector(`button[data-source-index="${String(t.correct)}"]`);
          if (correctBtn) {
            correctBtn.classList.add('correct');
          }
        }
        const res = document.getElementById(`task-tab-${t._storageId}-res`);
        res.classList.add('visible', isCorrect ? 'correct' : 'incorrect');
        const linkHref = t.entity
          ? ((t.entity.type || '') === 'lecture'
            ? buildLecturePageHash(t.entity.index)
            : buildItemHash(t.entity.type || 'all', t.entity.head || ''))
          : '';
        const linkBtn = t.entity
          ? ` <a class="task-card-link" data-type="${escapeHtml(t.entity.type || '')}" data-head="${escapeHtml(t.entity.head || '')}" data-lecture-idx="${escapeHtml(t.entity.index != null ? String(t.entity.index) : '')}" href="${escapeHtml(linkHref)}">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u2192</a>`
          : '';
        res.innerHTML = (isCorrect ? '<strong>\u0412\u0435\u0440\u043d\u043e!</strong> ' : '<strong>\u041d\u0435 \u0443\u0433\u0430\u0434\u0430\u043b\u0438.</strong> ')
          + renderTextWithPageLinks(t.hint, {
            className: 'task-page-link card-page-link related-link',
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
  let html = '<div class="panel active lectures-panel"><div class="lectures-inner">';
  html += '<h2 class="lectures-title">Все лекции книги — за пять минут</h2>';
  html += '<div class="lectures-intro">Краткие резюме: 10 лекций + предисловие. Нажмите карточку, чтобы открыть отдельную мини-страницу.</div>';
  html += `<div class="reading-now-box">
    <div class="reading-now-title">Режим «Читаю сейчас»</div>
    <div class="reading-now-desc">Введите номер страницы, и мы покажем, кто и что на ней упоминается.</div>
    <div class="reading-now-controls">
      <button id="reading-page-prev" class="reading-now-btn">←</button>
      <input id="reading-page-input" class="reading-now-input" type="number" min="1" max="${escapeHtml(maxPage)}" step="1" />
      <button id="reading-page-next" class="reading-now-btn">→</button>
      <button id="reading-page-go" class="reading-now-btn">Показать</button>
      <button id="reading-page-trends" class="reading-now-btn">Динамика страницы</button>
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
      <div class="lecture-card-section">КЛЮЧЕВЫЕ ФАКТЫ</div>
      <ul class="lecture-card-facts">`;
    for (const f of l.key_facts) html += `<li>${escapeHtml(f)}</li>`;
    html += `</ul>
      <div class="lecture-card-section">ТЕРМИНЫ</div>
      <div class="lecture-term-list">`;
    for (const t of l.terms) html += `<a class="lecture-term-chip" data-term="${escapeHtml(t.toLowerCase())}" href="${escapeHtml(buildLectureTermHash(t))}">${escapeHtml(t)}</a>`;
    html += `</div>
      <div class="lecture-card-why">${escapeHtml(l.why_read)}</div>
    </div>`;
  }
  html += '</div></div></div>';
  container.innerHTML = html;
  wireReadingNowWidget(container, maxPage);
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
    container.innerHTML = '<div class="panel active"><div class="panel-empty-state">Недостаточно лекций для сравнения.</div></div>';
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
    if (!heads.length) return '<span class="lecture-compare-empty">—</span>';
    let out = '';
    for (const head of heads.slice(0, max)) {
      out += `<a class="lecture-compare-link" data-type="${escapeHtml(type)}" data-head="${escapeHtml(head)}" href="${escapeHtml(buildItemHash(type, head))}">${escapeHtml(head)}</a>`;
    }
    if (heads.length > max) out += `<span class="lecture-compare-more">+${heads.length - max}</span>`;
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

  let html = '<div class="panel active lecture-compare-panel"><div class="lecture-compare-inner">';
  html += '<h2 class="lecture-compare-title">Сравнение двух лекций</h2>';
  html += '<div class="lecture-compare-intro">Показываем пересечения и уникальные сущности по типам. Нажмите на элемент, чтобы открыть карточку.</div>';
  html += `<div class="lecture-compare-controls">
    <label class="lecture-compare-field">
      <div class="lecture-compare-label">Лекция A</div>
      <select id="lecture-compare-a" class="lecture-compare-select">
        ${chapters.map((ch, idx) => `<option value="${idx}" ${idx === lectureCompareA ? 'selected' : ''}>${escapeHtml(chapterLabel(idx, ch))} (стр. ${ch.start}-${ch.end})</option>`).join('')}
      </select>
    </label>
    <label class="lecture-compare-field">
      <div class="lecture-compare-label">Лекция B</div>
      <select id="lecture-compare-b" class="lecture-compare-select">
        ${chapters.map((ch, idx) => `<option value="${idx}" ${idx === lectureCompareB ? 'selected' : ''}>${escapeHtml(chapterLabel(idx, ch))} (стр. ${ch.start}-${ch.end})</option>`).join('')}
      </select>
    </label>
  </div>`;
  if (recommendedPairs.length) {
    html += '<div class="lecture-compare-suggestions">';
    html += '<div class="lecture-compare-suggestions-title">Осмысленные пары для сравнения</div>';
    html += '<div class="lecture-compare-pair-list">';
    for (const rec of recommendedPairs) {
      const selected =
        (rec.a === lectureCompareA && rec.b === lectureCompareB) ||
        (rec.a === lectureCompareB && rec.b === lectureCompareA);
      html += `<button type="button" class="lecture-compare-pair ${selected ? 'active' : ''}" data-a="${rec.a}" data-b="${rec.b}">
        ${escapeHtml(chapterLabel(rec.a, chapters[rec.a]))} ↔ ${escapeHtml(chapterLabel(rec.b, chapters[rec.b]))}
        <span>(${escapeHtml(rec.reason)})</span>
      </button>`;
    }
    html += '</div></div>';
  }

  html += `<div class="lecture-compare-current"><strong>A:</strong> ${escapeHtml(chapterA.name)} <span>(стр. ${chapterA.start}-${chapterA.end})</span><br><strong>B:</strong> ${escapeHtml(chapterB.name)} <span>(стр. ${chapterB.start}-${chapterB.end})</span></div>`;
  html += '<div class="lecture-compare-grid">';

  for (const t of types) {
    const setA = headsFor(t.key, chapterA);
    const setB = headsFor(t.key, chapterB);
    const inter = asSorted([...setA].filter(h => setB.has(h)));
    const onlyA = asSorted([...setA].filter(h => !setB.has(h)));
    const onlyB = asSorted([...setB].filter(h => !setA.has(h)));
    html += `<div class="lecture-compare-card">
      <div class="lecture-compare-card-title">${t.label}</div>
      <div class="lecture-compare-card-meta">Общие: <strong>${inter.length}</strong> · Только A: <strong>${onlyA.length}</strong> · Только B: <strong>${onlyB.length}</strong></div>
      <div class="lecture-compare-subhead">Пересечение</div>
      <div class="lecture-compare-link-row">${renderHeadLinks(t.key, inter, 10)}</div>
      <div class="lecture-compare-subhead">Только A</div>
      <div class="lecture-compare-link-row">${renderHeadLinks(t.key, onlyA, 8)}</div>
      <div class="lecture-compare-subhead">Только B</div>
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
    container.innerHTML = '<div class="panel active"><div class="panel-empty-state">Нет данных о лекциях.</div></div>';
    return;
  }
  if (currentLecture < 0) currentLecture = 0;
  if (currentLecture >= lectures.length) currentLecture = lectures.length - 1;
  const l = lectures[currentLecture];
  const title = currentLecture === 0 ? 'Предисловие' : `Лекция ${currentLecture}`;

  let html = '<div class="panel active lecture-page"><div class="lecture-page-inner">';
  html += `<div class="lecture-page-nav">
    <button id="lecture-prev" class="lecture-page-nav-btn">← Предыдущая</button>
    <button id="lecture-all" class="lecture-page-nav-btn">Ко всем лекциям</button>
    <button id="lecture-next" class="lecture-page-nav-btn">Следующая →</button>
  </div>`;
  html += `<div class="lecture-page-card">
    <div class="lecture-page-meta">${title} · стр. ${escapeHtml(l.pages || '')}</div>
    <h2 class="lecture-page-title">${escapeHtml(l.name || '')}</h2>
    <div class="lecture-page-idea">${escapeHtml(l.main_idea || '')}</div>
    <h3 class="lecture-page-section">Ключевые факты</h3>
    <ul class="lecture-page-facts">`;
  for (const fact of (l.key_facts || [])) html += `<li>${escapeHtml(fact)}</li>`;
  html += `</ul>
    <h3 class="lecture-page-section">Термины</h3>
    <div class="lecture-page-terms">`;
  for (const t of (l.terms || [])) html += `<a class="lecture-term-chip" data-term="${escapeHtml(t.toLowerCase())}" href="${escapeHtml(buildLectureTermHash(t))}">${escapeHtml(t)}</a>`;
  html += `</div>
    <div class="lecture-page-why">${escapeHtml(l.why_read || '')}</div>
  </div>`;
  if (currentLecture === 0 && Array.isArray(APP_DATA.further_reading) && APP_DATA.further_reading.length) {
    html += `<div class="lecture-page-further">
      <div class="lecture-page-further-head">
        <h3 class="lecture-page-further-title">Что почитать ещё</h3>
        <button id="go-further-reading" class="lecture-page-further-btn">Открыть весь раздел</button>
      </div>`;
    for (const sec of APP_DATA.further_reading) {
      html += `<div class="lecture-page-further-section">
        <div class="lecture-page-further-topic">${escapeHtml(sec.topic || '')}</div>`;
      for (const b of (sec.books || [])) {
        html += `<div class="lecture-page-further-book">• <strong>${escapeHtml(b.title || '')}</strong>: ${escapeHtml(b.why || '')}</div>`;
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
  let html = '<div class="panel active further-reading-panel"><div class="further-reading-inner">';
  html += '<div class="further-reading-head">';
  html += '<h2 class="further-reading-title">Что почитать ещё</h2>';
  html += '<button id="export-further-bib" class="further-reading-export-btn">Экспорт BibTeX (.bib)</button>';
  html += '</div>';
  html += '<div class="further-reading-intro">Небольшой школьный навигатор по научно-популярным и базовым лингвистическим книгам.</div>';
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
    bookId: String(opts.bookId || getActiveBook().book_id || ''),
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

function collectLexiconContextBundles(pageStart, pageEnd) {
  const out = [];
  const items = Array.isArray(APP_DATA?.lexicon) ? APP_DATA.lexicon : [];
  for (const it of items) {
    const itemHead = String(it?.head || '').trim();
    if (!itemHead) continue;
    const entries = iterateKwicContextEntries(it && it.contexts, pageStart, pageEnd);
    if (!entries.length) continue;
    out.push({ itemHead, entries });
  }
  return out;
}

function collectMatchingGlossaryTerms(qNorm) {
  const out = [];
  const seen = new Set();
  const glossary = Array.isArray(APP_DATA?.glossary) ? APP_DATA.glossary : [];
  for (const g of glossary) {
    const term = String(g?.term || '').trim();
    const definition = String(g?.definition || '').trim();
    const termNorm = normalizeHeadForMatch(term);
    const defNorm = normalizeHeadForMatch(definition);
    if (!termNorm) continue;
    if (!(termNorm.includes(qNorm) || defNorm.includes(qNorm) || qNorm.includes(termNorm))) continue;
    if (seen.has(termNorm)) continue;
    seen.add(termNorm);
    out.push(term);
  }
  return out;
}

function collectLexiconKwicRows(query, pageStart, pageEnd) {
  const q = clampUiInput(query, MAX_LIST_QUERY_LENGTH);
  const qNorm = normalizeHeadForMatch(q);
  if (qNorm.length < 2) return [];
  const rows = [];
  rows._truncated = false;
  const bundles = collectLexiconContextBundles(pageStart, pageEnd);
  for (const bundle of bundles) {
    for (const entry of bundle.entries) {
      const page = entry.page;
      const snippets = entry.snippets;
      for (const raw of snippets) {
        const snippetNorm = normalizeHeadForMatch(raw);
        if (!snippetNorm.includes(qNorm)) continue;
        const row = buildKwicContextRow({
          source: 'lexicon',
          term: bundle.itemHead,
          itemType: 'lexicon',
          itemHead: bundle.itemHead,
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
  const matchedTerms = collectMatchingGlossaryTerms(qNorm);
  const bundles = collectLexiconContextBundles(pageStart, pageEnd);
  for (const term of matchedTerms) {
    for (const bundle of bundles) {
      for (const entry of bundle.entries) {
        const page = entry.page;
        const snippets = entry.snippets;
        for (const raw of snippets) {
          const row = buildKwicContextRow({
            source: 'glossary',
            term,
            itemType: 'lexicon',
            itemHead: bundle.itemHead,
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
  const panelRange = normalizePageRangeInBook(currentKwicPageStart, currentKwicPageEnd, 1, totalPages);
  currentKwicPageStart = panelRange.start;
  currentKwicPageEnd = panelRange.end;
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

  container.innerHTML = `<div class="panel active kwic-panel">
    <div class="kwic-inner">
      <h2 class="kwic-title">KWIC-конкорданс</h2>
      <div class="kwic-intro">
        Key Word In Context: показывает ключевое слово в его ближайшем окружении.
      </div>
      <div class="kwic-controls">
        <label class="kwic-field">
          Запрос
          <input id="kwic-query" type="text" value="${escapeHtml(currentKwicQuery)}" placeholder="например: энклитика" class="kwic-input">
        </label>
        <label class="kwic-field">
          Источник
          <select id="kwic-source" class="kwic-input">
            <option value="lexicon"${currentKwicSource === 'lexicon' ? ' selected' : ''}>Лексика (статьи)</option>
            <option value="glossary"${currentKwicSource === 'glossary' ? ' selected' : ''}>Глоссарий (термины)</option>
          </select>
        </label>
        <label class="kwic-field">
          Сортировка
          <select id="kwic-sort" class="kwic-input">
            <option value="left"${currentKwicSort === 'left' ? ' selected' : ''}>по левому контексту</option>
            <option value="right"${currentKwicSort === 'right' ? ' selected' : ''}>по правому контексту</option>
            <option value="page"${currentKwicSort === 'page' ? ' selected' : ''}>по странице</option>
          </select>
        </label>
        <label class="kwic-field">
          Стр. от
          <input id="kwic-page-start" type="number" min="1" max="${totalPages}" value="${currentKwicPageStart}" class="kwic-input">
        </label>
        <label class="kwic-field">
          Стр. до
          <input id="kwic-page-end" type="number" min="1" max="${totalPages}" value="${currentKwicPageEnd}" class="kwic-input">
        </label>
        <button id="kwic-run" type="button" class="kwic-run-btn">Показать</button>
      </div>
      <div id="kwic-source-hint" class="kwic-source-hint"></div>
      <div id="kwic-meta" class="kwic-meta"></div>
      <div id="kwic-results" class="kwic-results"></div>
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
    const formRange = normalizePageRangeInBook(startInput.value, endInput.value, 1, totalPages);
    currentKwicPageStart = formRange.start;
    currentKwicPageEnd = formRange.end;
    startInput.value = String(currentKwicPageStart);
    endInput.value = String(currentKwicPageEnd);

    const qNorm = normalizeHeadForMatch(currentKwicQuery);
    if (qNorm.length < 2) {
      metaEl.textContent = 'Введите минимум 2 символа для KWIC-поиска.';
      resultsEl.innerHTML = '<div class="kwic-empty">Например: «энклитика», «санскрит», «закон».</div>';
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
      resultsEl.innerHTML = '<div class="kwic-empty">Попробуйте расширить диапазон страниц или изменить запрос.</div>';
      persistViewState();
      return;
    }

    const terms = new Set(rows.map(r => r.term));
    const truncText = kwicTruncated ? ` Показаны первые ${KWIC_MAX_ROWS}.` : '';
    metaEl.textContent = `Найдено ${rows.length} контекстов (${terms.size} терминов), источник: ${currentKwicSource === 'glossary' ? 'глоссарий' : 'лексика'}.${truncText}`;
    resultsEl.textContent = '';
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'kwic-row';
      const head = document.createElement('div');
      head.className = 'kwic-row-head';

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'kwic-open-card kwic-pill';
      cardBtn.dataset.type = String(r.itemType || '');
      cardBtn.dataset.head = String(r.itemHead || '');
      cardBtn.textContent = String(r.itemHead || '');
      head.appendChild(cardBtn);

      if (r.source === 'glossary') {
        const glossaryBtn = document.createElement('button');
        glossaryBtn.type = 'button';
        glossaryBtn.className = 'kwic-open-glossary kwic-pill';
        glossaryBtn.dataset.term = String(r.term || '');
        glossaryBtn.textContent = `термин: ${String(r.term || '')}`;
        head.appendChild(glossaryBtn);
      }

      const pageLink = document.createElement('a');
      pageLink.className = 'kwic-page-link card-page-link related-link';
      pageLink.dataset.page = String(r.page);
      pageLink.href = buildReadingNowHash(r.page);
      pageLink.textContent = `стр. ${r.page}`;
      head.appendChild(pageLink);

      const sourceChip = document.createElement('span');
      sourceChip.className = 'kwic-source-chip';
      sourceChip.textContent = getBookLabelForSearch(r.bookId);
      head.appendChild(sourceChip);

      const context = document.createElement('div');
      context.className = 'kwic-context';
      const left = document.createElement('span');
      left.className = 'kwic-muted';
      left.textContent = String(r.leftPrefix || '') + String(r.leftText || '');
      const mark = document.createElement('mark');
      mark.textContent = String(r.keyText || '');
      const right = document.createElement('span');
      right.textContent = String(r.rightText || '') + String(r.rightSuffix || '');
      context.appendChild(left);
      context.appendChild(mark);
      context.appendChild(right);

      row.appendChild(head);
      row.appendChild(context);
      resultsEl.appendChild(row);
    }

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
  let html = '<div class="panel active glossary-panel"><div class="glossary-inner">';
  html += '<h2 class="glossary-title">Глоссарий простыми словами</h2>';
  html += '<div class="glossary-intro">Лингвистические термины из книги, объяснённые так, чтобы понял школьник. У каждого термина — отдельная внешняя ссылка.</div>';
  // Простое поле поиска
  html += '<input type="text" id="glossary-search" class="glossary-search" placeholder="Поиск термина…" />';
  html += '<div id="glossary-list" class="glossary-list">';
  for (const g of glossary) {
    const termUrl = g.url || ('https://samskrtam.ru/sanskrit-lexicon/les-1990/?s=' + encodeURIComponent(String(g.term || '')));
    const related = findRelatedLexiconItems(g.term, g.definition || '', 4);
    let relatedHtml = '';
    if (related.length) {
      relatedHtml += '<div class="glossary-related-links">';
      relatedHtml += '<span class="glossary-related-label">Связанные лексемы:</span>';
      for (const r of related) {
        relatedHtml += `<a class="glossary-xlink" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}" title="${escapeHtml(r.hint || '')}">${escapeHtml(r.head)}</a>`;
      }
      relatedHtml += '</div>';
    }
    html += `<div class="glossary-entry" data-term="${escapeHtml(g.term.toLowerCase())}">
      <div class="glossary-entry-head">
        <span>${escapeHtml(g.term)}</span>
        <a class="glossary-les-link" href="${escapeHtml(safeUrl(termUrl))}" target="_blank" rel="noopener noreferrer">LES-1990 ↗</a>
      </div>
      <div class="glossary-definition">${escapeHtml(g.definition)}</div>
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
  const focusGlossaryEntry = (term) => {
    const q = String(term || '').trim().toLowerCase();
    if (!q) return;
    const entries = Array.from(container.querySelectorAll('.glossary-entry'));
    if (!entries.length) return;
    let target = entries.find((el) => String((el.dataset && el.dataset.term) || '') === q);
    if (!target) target = entries.find((el) => String((el.dataset && el.dataset.term) || '').includes(q));
    if (!target) return;
    entries.forEach((el) => el.classList.remove('glossary-pending-highlight'));
    target.classList.add('glossary-pending-highlight');
    if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' });
    setTimeout(() => {
      target.classList.remove('glossary-pending-highlight');
    }, 1800);
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
  const queuedGlossaryTerm = (() => {
    const localPending = clampUiInput(pendingGlossaryQuery || '', MAX_LIST_QUERY_LENGTH).toLowerCase();
    if (localPending) return localPending;
    if (typeof window === 'undefined') return '';
    return clampUiInput(window._pendingGlossaryTerm || '', MAX_LIST_QUERY_LENGTH).toLowerCase();
  })();
  if (queuedGlossaryTerm) {
    input.value = queuedGlossaryTerm;
    currentGlossaryTerm = queuedGlossaryTerm;
    applyGlossaryFilter(queuedGlossaryTerm);
    pendingGlossaryQuery = '';
    if (typeof window !== 'undefined') window._pendingGlossaryTerm = '';
    focusGlossaryEntry(queuedGlossaryTerm);
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
  let html = '<div class="panel active gallery-panel"><div class="gallery-inner">';
  html += '<h2 class="gallery-title">Галерея лингвистов</h2>';
  html += `<div class="gallery-intro">${names.length} лингвистов и литераторов, упомянутых в книге, с фотографиями. Расположены примерно в хронологическом порядке. Кликните по портрету, чтобы открыть карточку.</div>`;
  html += '<div class="gallery-grid">';
  for (const n of names) {
    const epochLabel = n.epoch ? (n.epoch < 0 ? Math.abs(n.epoch) + ' до н.э.' : n.epoch + ' г.') : '';
    html += `<a class="gallery-card" data-head="${escapeHtml(n.head)}" href="${escapeHtml(buildItemHash('names', n.head))}">
      <img class="gallery-card-img" src="${escapeHtml(safeImageUrl(n.img))}" alt="">
      <div class="gallery-card-title">${escapeHtml(n.head)}</div>
      <div class="gallery-card-meta">${epochLabel}</div>
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
  let html = '<div class="panel active russian-evolution-panel"><div class="russian-evolution-inner">';
  html += '<h2 class="russian-evolution-title">Русский язык во времени</h2>';
  html += '<div class="russian-evolution-intro">Семь срезов истории русского языка, от XI до XXI века. Видно, как менялся алфавит, лексика и грамматика.</div>';
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const isLast = i === samples.length - 1;
    const pageRaw = parseInt(String(s.page || ''), 10);
    const pageNum = clampPageInBook(Number.isFinite(pageRaw) ? pageRaw : 1);
    const pageLabel = escapeHtml(String(s.page || pageNum));
    const pageMetaHtml = s.page
      ? `<a class="russian-evolution-page-link card-page-link related-link" data-page="${pageNum}" href="${escapeHtml(buildReadingNowHash(pageNum))}">стр. ${pageLabel}</a>`
      : '';
    html += `<div class="russian-evolution-row${isLast ? ' russian-evolution-row-last' : ''}">
      <div class="russian-evolution-time">
        <div class="russian-evolution-epoch">${escapeHtml(s.epoch)}</div>
        <div class="russian-evolution-year">≈ ${s.year} г.</div>
      </div>
      <div class="russian-evolution-card">
        <div class="russian-evolution-sample">«${escapeHtml(s.sample)}»</div>
        <div class="russian-evolution-translation">${escapeHtml(s.translation)}</div>
        <div class="russian-evolution-note">${escapeHtml(s.note)}${pageMetaHtml ? ` · ${pageMetaHtml}` : ''}</div>
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
  let html = '<div class="panel active phonetic-panel"><div class="phonetic-inner">';
  html += '<h2 class="phonetic-title">Фонетические законы из лекций Зализняка</h2>';
  html += '<div class="phonetic-intro">Восемь ключевых фонетических законов, обсуждаемых в книге, с примерами из текста. Для каждого закона показан переход «было → стало» и пояснение.</div>';
  for (const law of laws) {
    const lawMetaText = law.page
      ? `${law.discoverer} · ${law.year} · стр. ${law.page}`
      : `${law.discoverer} · ${law.year}`;
    html += `<div class="phonetic-card">
      <div class="phonetic-card-head">
        <div class="phonetic-card-title">${escapeHtml(law.name)}</div>
        <div class="phonetic-card-meta">${renderTextWithPageLinks(lawMetaText, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })}</div>
      </div>
      <div class="phonetic-desc">${escapeHtml(law.description)}</div>
      <div class="phonetic-examples">
        <div class="phonetic-examples-title">Примеры</div>
        <table class="phonetic-table">
          <thead><tr>
            <th class="phonetic-col-before">было</th>
            <th class="phonetic-col-after">стало</th>
            <th class="phonetic-col-comment">комментарий</th>
          </tr></thead>
          <tbody>`;
    for (const ex of law.examples) {
      const fromHtml = escapeHtml(String(ex.from || '')).replace(/\s+/g, '&nbsp;');
      const toHtml = escapeHtml(String(ex.to || '')).replace(/\s+/g, '&nbsp;');
      const commentHtml = formatPhoneticCommentText(ex.comment || '');
      html += `<tr>
        <td class="phonetic-before">${fromHtml}</td>
        <td class="phonetic-after"><strong class="phonetic-arrow">\u2192</strong> <span class="phonetic-transition">${toHtml}</span></td>
        <td class="phonetic-comment">${commentHtml}</td>
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
        currentVizCleanup = typeof host.__vizCleanup === 'function' ? host.__vizCleanup : null;
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
  if (!validModuleIds.has(currentVizModule)) currentVizModule = 'viz03';
  const activeBook = getActiveBook();
  const activeBookLabel = activeBook.short_title || activeBook.title || activeBook.book_id || '\u0442\u0435\u043a\u0443\u0449\u0430\u044f \u043a\u043d\u0438\u0433\u0430';

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
      currentVizModule = item.id;
      currentVizQueryString = '';
      renderVizPanel(container);
      syncNavigationHashOnly();
    });
    tabs.appendChild(btn);
  }

  mountVizModule(host, catalog.find((m) => m.id === currentVizModule) || catalog[0]);
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

  container.innerHTML = `<div class="panel active chronology-panel">
    <div class="chronology-inner">
      <h2 class="chronology-title">Хронология лингвистических открытий</h2>
      <div class="chronology-intro">Отдельный интерактивный таб: фильтры по типам событий, диапазон лет (включая диапазоны/века), переходы к карточкам и экспорт в Markdown.</div>
      <div class="chronology-controls">
        <label class="chronology-label">Тип события
          <select id="chronology-type" class="chronology-select">
            ${Object.keys(typeLabels).map(k => `<option value="${escapeHtml(k)}">${escapeHtml(typeLabels[k])}</option>`).join('')}
          </select>
        </label>
        <label class="chronology-label">Zoom
          <select id="chronology-zoom" class="chronology-select">
            <option value="all">Весь диапазон</option>
            <option value="xix">XIX век</option>
            <option value="xx">XX век</option>
            <option value="xxi">XXI век</option>
            <option value="custom">Пользовательский</option>
          </select>
        </label>
        <label class="chronology-label">От
          <input id="chronology-start" class="chronology-number" type="number" value="${escapeHtml(String(minYear))}">
        </label>
        <label class="chronology-label">До
          <input id="chronology-end" class="chronology-number" type="number" value="${escapeHtml(String(maxYear))}">
        </label>
        <button id="chronology-export-md" type="button" class="related-link related-link-btn">Экспорт диапазона в Markdown</button>
      </div>
      <div id="chronology-stats" class="chronology-stats"></div>
      <div id="chronology-list" class="chronology-list"></div>
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
      listEl.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'chronology-empty';
      empty.textContent = 'Нет событий в текущем фильтре.';
      listEl.appendChild(empty);
      return;
    }
    listEl.textContent = '';
    for (const ev of rows) {
      const target = ev._target || {};
      const link = document.createElement('a');
      link.className = 'chronology-event-link';
      link.href = target.href || buildCanonicalHash(['scholar', 'chronology']);
      link.dataset.mode = String(target.mode || '');
      link.dataset.type = String(target.type || '');
      link.dataset.head = String(target.head || '');
      link.dataset.query = String(target.query || '');

      const year = document.createElement('div');
      year.className = 'chronology-event-year';
      year.textContent = String(ev._yearLabel || '—');

      const body = document.createElement('div');
      const text = document.createElement('div');
      text.className = 'chronology-event-text';
      text.textContent = String(ev.event || '');
      const meta = document.createElement('div');
      meta.className = 'chronology-event-meta';
      const type = document.createElement('span');
      type.textContent = String(typeLabels[ev._type] || ev._type || '');
      meta.appendChild(type);
      if (ev.page) {
        const page = document.createElement('span');
        page.className = 'chronology-event-page';
        page.textContent = `стр. ${String(ev.page)}`;
        meta.appendChild(page);
      }
      body.appendChild(text);
      body.appendChild(meta);
      link.appendChild(year);
      link.appendChild(body);
      listEl.appendChild(link);
    }
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
  html += '<div class="page-trends-head">';
  html += '<div><h2 class="page-trends-title">Динамика по страницам</h2>';
  html += '<div class="page-trends-intro">Выберите окно страниц и смотрите, как меняется плотность упоминаний и какие сущности усиливаются/ослабевают во второй половине диапазона.</div></div>';
  html += '<div class="page-trends-actions">';
  html += '<button id="trend-export-csv" class="page-trends-btn">Экспорт CSV</button>';
  html += '<button id="trend-export-md" class="page-trends-btn">Экспорт Markdown</button>';
  html += '<button id="trend-copy-link" class="page-trends-btn">Скопировать ссылку</button>';
  html += '</div></div>';

  const chapterOptions = chapters.map((ch, idx) => `<option value="${idx}">${escapeHtml(ch.name)} (${ch.start}-${ch.end})</option>`).join('');
  html += `<div class="page-trends-controls">
    <div class="page-trends-range-grid">
      <label class="page-trends-label">
        Начальная страница
        <input id="trend-start-range" class="page-trends-range" type="range" min="1" max="${totalPages}" value="${start}">
        <input id="trend-start-input" class="page-trends-number" type="number" min="1" max="${totalPages}" value="${start}">
      </label>
      <label class="page-trends-label">
        Конечная страница
        <input id="trend-end-range" class="page-trends-range" type="range" min="1" max="${totalPages}" value="${end}">
        <input id="trend-end-input" class="page-trends-number" type="number" min="1" max="${totalPages}" value="${end}">
      </label>
    </div>
    <div class="page-trends-quick-row">
      <label class="page-trends-label">Быстрый выбор главы:
        <select id="trend-chapter-select" class="page-trends-select">
          <option value="">—</option>${chapterOptions}
        </select>
      </label>
      <span class="page-trends-range-note">Диапазон: ${start}-${end} · ширина ${end - start + 1} стр.</span>
    </div>
  </div>`;

  html += '<div class="page-trends-summary-grid">';
  for (const s of stats) {
    html += `<div class="page-trends-summary-card">
      <div class="page-trends-summary-title">${s.label}</div>
      <div class="page-trends-summary-meta">Сущностей: <strong>${s.activeCount}</strong> · упоминаний: <strong>${s.mentionTotal}</strong></div>
      <div class="page-trends-summary-subtitle">Топ в выбранном окне</div>
      <div>${s.top.length ? s.top.map(it => `<a class="trend-link page-trend-chip" data-type="${escapeHtml(it.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(it.type, it.head))}">${escapeHtml(it.head)} · ${it.count}</a>`).join('') : '<span class="page-trends-empty-mark">—</span>'}</div>
    </div>`;
  }
  html += '</div>';

  const trendLinks = (rows, tone) => rows.length
    ? rows.map(r => `<a class="trend-link page-trend-row" data-type="${escapeHtml(r.type)}" data-head="${escapeHtml(r.head)}" href="${escapeHtml(buildItemHash(r.type, r.head))}">
        <span class="page-trend-head">${escapeHtml(r.head)}</span>
        <span class="page-trend-metrics ${tone === 'up' ? 'trend-up' : 'trend-down'}">${r.delta > 0 ? '+' : ''}${r.delta} (${r.leftCount}→${r.rightCount})</span>
      </a>`).join('')
    : '<div class="page-trends-empty-mark">—</div>';

  html += `<div class="page-trends-delta-grid">
    <div class="page-trends-delta-card">
      <div class="page-trends-delta-title">Растут во второй половине диапазона</div>
      ${trendLinks(trendUp, 'up')}
    </div>
    <div class="page-trends-delta-card">
      <div class="page-trends-delta-title">Слабеют во второй половине диапазона</div>
      ${trendLinks(trendDown, 'down')}
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
  const scholarViewportWidth = (typeof window !== 'undefined' && typeof window.innerWidth === 'number') ? window.innerWidth : 1280;
  const reconstructionColumns = scholarViewportWidth >= 1280 ? 4 : (scholarViewportWidth >= 980 ? 3 : (scholarViewportWidth >= 680 ? 2 : 1));
  let html = '<div class="panel active scholar-panel"><div class="scholar-inner">';
  html += '<h2 class="scholar-title">Профессиональный аппарат</h2>';
  html += '<div class="scholar-intro">Дополнительные материалы для взрослого читателя, студента-лингвиста, преподавателя и специалиста-русиста.</div>';

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
  html += '<div class="scholar-toc">';
  for (const [id, title] of sections) {
    html += `<a class="scholar-toc-link" href="#sch-${id}">${escapeHtml(title)}</a>`;
  }
  html += '</div>';

  // 1. Библиография
  html += '<h3 id="sch-biblio" class="scholar-section-title">1. Библиография работ Зализняка по темам лекций</h3>';
  html += '<div class="scholar-section-intro">Каждая лекция в книге — выжимка из академических работ Зализняка. Здесь — ключевые публикации, где темы изложены подробнее. PDF-подборка: <a class="related-link" href="https://inslav.ru/people/zaliznyak-andrey-anatolevich-1935-2017" target="_blank" rel="noopener noreferrer">страница ИСл РАН ↗</a>.</div>';
  html += '<div class="scholar-action-row"><button id="export-scholar-biblio-bib" class="scholar-action-button">Экспорт BibTeX (.bib)</button></div>';
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

  // 2. Расширенные сведения — отсылка к карточкам имён
  html += '<h3 id="sch-extended_cards" class="scholar-section-title scholar-section-title-spaced">2. Расширенные сведения о ключевых лингвистах</h3>';
  html += '<div class="scholar-section-intro">Подробные карточки лингвистов с биографией, библиографией и научно-исторической информацией доступны в разделе «Имена». Кликните по любому имени, чтобы открыть карточку.</div>';
  html += '<div>';
  const keyLinguists = ['Вакернагель Я.','Гримм Я.','Вернер К.','Раск Р. К.','Бопп Фр.','Мейе А.','Шампольон Ф.','Вентрис М.','Янин В. Л.','Гиппиус А. А.','Аванесов Р. И.','Дыбо В. А.','Иллич-Свитыч В. М.','Падучева Е. В.'];
  for (const name of keyLinguists) {
    html += `<a class="scholar-link scholar-chip-link" data-type="names" data-head="${escapeHtml(name)}" href="${escapeHtml(buildItemHash('names', name))}">${escapeHtml(name)}</a>`;
  }
  html += '</div>';

  // 3. Спорные вопросы
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

  // 4. Оригинальные формы по языкам
  html += '<h3 id="sch-original" class="scholar-section-title scholar-section-title-spaced">4. Оригинальные формы по языкам</h3>';
  html += '<div class="scholar-section-intro">Слова из лекций в авторских системах транслитерации и оригинальном письме.</div>';
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
  html += '<h3 id="sch-birch" class="scholar-section-title scholar-section-title-spaced">5. Конкорданс берестяных грамот</h3>';
  html += '<div class="scholar-section-intro">Берестяные грамоты, упоминаемые в лекции, по номерам. Полная база: <a class="related-link" href="https://gramoty.ru/birchbark" target="_blank" rel="noopener noreferrer">gramoty.ru/birchbark ↗</a>.</div>';
  html += `<div class="scholar-filter-bar">
    <label class="scholar-filter-label">Город
      <select id="birch-city-filter" class="scholar-filter-control">
        <option value="">Все</option>
        ${birchCities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>
    <label class="scholar-filter-label">Век
      <select id="birch-century-filter" class="scholar-filter-control">
        <option value="">Все</option>
        ${birchCenturies.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>
    <label class="scholar-filter-label">Номер грамоты
      <input id="birch-number-filter" class="scholar-filter-control scholar-filter-input" type="text" inputmode="numeric" placeholder="например, 776">
    </label>
  </div>`;
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

  // 6. Хронология
  html += '<h3 id="sch-chronology" class="scholar-section-title scholar-section-title-spaced">6. Хронология лингвистических открытий</h3>';
  html += '<div class="scholar-section-intro">События истории лингвистики, связанные с темами книги.</div>';
  for (const ev of (s.chronology || [])) {
    const chronologyPageMeta = ev.page
      ? renderTextWithPageLinks(`стр. ${ev.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-chronology-row">
      <div class="scholar-chronology-year">${escapeHtml(ev.year)}</div>
      <div class="scholar-chronology-event">${escapeHtml(ev.event)}${chronologyPageMeta ? `<span class="scholar-muted-meta"> · ${chronologyPageMeta}</span>` : ''}</div>
    </div>`;
  }
  // 7. Изоглоссы
  html += '<h3 id="sch-isoglosses" class="scholar-section-title scholar-section-title-spaced">7. Изоглоссы русских диалектов</h3>';
  html += '<div class="scholar-section-intro">Линии, разделяющие диалекты по конкретным фонетическим, морфологическим и лексическим признакам, обсуждаемым в книге.</div>';
  for (const i of (s.isoglosses || [])) {
    const isoglossPageMeta = i.page
      ? renderTextWithPageLinks(`стр. ${i.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-card scholar-isogloss-card">
      <div class="scholar-card-title">${escapeHtml(i.name)}${isoglossPageMeta ? ` <span class="scholar-muted-meta">· ${isoglossPageMeta}</span>` : ''}</div>
      <div class="scholar-body-text">${escapeHtml(i.description)}</div>
    </div>`;
  }

  // 8. Слово о полку Игореве
  html += '<h3 id="sch-slovo" class="scholar-section-title scholar-section-title-spaced">8. Аргументация Зализняка о подлинности «Слова о полку Игореве»</h3>';
  if (s.slovo) {
    html += `<div class="scholar-slovo-card">
      <div class="scholar-slovo-thesis">${escapeHtml(s.slovo.thesis)}</div>
      ${s.slovo.context ? `<div class="scholar-slovo-context">${escapeHtml(s.slovo.context)}</div>` : ''}`;
    html += `<div class="scholar-slovo-opponents"><strong>Оппоненты:</strong> ${escapeHtml(s.slovo.opponents)}</div>
      <div class="scholar-slovo-verdict">${escapeHtml(s.slovo.verdict)}</div>
    </div>`;
  }
  if (Array.isArray(s.slovo_links) && s.slovo_links.length) {
    html += '<div class="scholar-inline-links">';
    for (const link of s.slovo_links) {
      html += `<a class="related-link scholar-inline-source-link" href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)} ↗</a>`;
    }
    html += '</div>';
  }
  if (s.slovo) {
    const slovoArgs = Array.isArray(s.slovo.arguments) ? s.slovo.arguments : [];
    const slovoCounters = Array.isArray(s.slovo.counterarguments) ? s.slovo.counterarguments : [];
    html += '<div class="scholar-soft-panel">';
    html += '<div class="scholar-soft-title">Тезисы / контраргументы / контекст</div>';
    if (s.slovo.context) {
      html += `<div class="scholar-body-text scholar-body-text-spaced">${escapeHtml(s.slovo.context)}</div>`;
    }
    for (let i = 0; i < slovoArgs.length; i++) {
      const a = slovoArgs[i];
      const anchorId = `sch-slovo-arg-${i + 1}`;
      const pageMeta = a.page
        ? `<span class="scholar-muted-meta">${renderTextWithPageLinks(`стр. ${a.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })}</span>`
        : '';
      const sourceMeta = a.url ? `<a class="related-link scholar-meta-link" href="${escapeHtml(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">источник ↗</a>` : '';
      html += `<div id="${anchorId}" class="scholar-slovo-item">
        <div class="scholar-slovo-item-head">
          <div class="scholar-slovo-item-title">${escapeHtml(a.name)}</div>
          <a class="scholar-slovo-anchor" data-anchor="${anchorId}" href="${escapeHtml(buildScholarAnchorHash(anchorId))}">якорь #${i + 1}</a>
        </div>
        <div class="scholar-slovo-detail">${escapeHtml(a.detail)}</div>
        <div class="scholar-slovo-meta-row">${pageMeta}${sourceMeta}</div>
      </div>`;
    }
    if (slovoCounters.length) {
      html += '<div class="scholar-subsection-label">Контраргументы:</div>';
      for (const c of slovoCounters) {
        const pageMeta = c.page
          ? `<span class="scholar-muted-meta">${renderTextWithPageLinks(`стр. ${c.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })}</span>`
          : '';
        const sourceMeta = c.url ? `<a class="related-link scholar-meta-link" href="${escapeHtml(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">источник ↗</a>` : '';
        html += `<div class="scholar-slovo-item scholar-slovo-counter">
          <div class="scholar-slovo-item-title">${escapeHtml(c.name)}</div>
          <div class="scholar-body-text">${escapeHtml(c.detail)}</div>
          <div class="scholar-slovo-meta-row">${pageMeta}${sourceMeta}</div>
        </div>`;
      }
    }
    html += '</div>';
  }
  if (Array.isArray(s.slovo_reading) && s.slovo_reading.length) {
    html += '<div class="scholar-soft-panel">';
    html += '<div class="scholar-soft-title">Что читать дальше</div>';
    for (const item of s.slovo_reading) {
      html += `<div class="scholar-reading-item">
        <a class="related-link" href="${escapeHtml(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)} ↗</a>
        ${item.note ? `<div class="scholar-reading-note">${escapeHtml(item.note)}</div>` : ''}
      </div>`;
    }
    html += '</div>';
  }

  // 9. Акцентологические парадигмы
  html += '<h3 id="sch-accents" class="scholar-section-title scholar-section-title-spaced">9. Акцентологические парадигмы Зализняка</h3>';
  html += '<div class="scholar-section-intro">Базовые и расширенные типы русского ударения по классификации Зализняка («Грамматический словарь русского языка», 1977) с историко-диалектными комментариями.</div>';
  for (const ap of (s.accent_paradigms || [])) {
    html += `<div class="scholar-card scholar-accent-card">
      <div class="scholar-accent-card-title">Тип ${escapeHtml(ap.type)}</div>
      <div class="scholar-body-text scholar-body-text-spaced">${escapeHtml(ap.description)}</div>`;
    for (const ex of ap.examples) {
      html += `<div class="scholar-accent-example"><strong>${renderAccentSafe(ex.word)}</strong> — <span class="scholar-note">${renderAccentSafe(ex.forms)}</span></div>`;
    }
    html += '</div>';
  }
  const accentOptions = (s.accent_paradigms || []).map((ap, idx) => `<option value="${idx}">${escapeHtml(ap.type)}</option>`).join('');
  html += `<div class="scholar-soft-panel scholar-compare-panel">
    <div class="scholar-soft-title">Сравнение 2–3 парадигм</div>
    <div class="scholar-compare-controls">
      <label class="scholar-filter-label">Парадигма A
        <select id="accent-compare-a" class="scholar-filter-control">${accentOptions}</select>
      </label>
      <label class="scholar-filter-label">Парадигма B
        <select id="accent-compare-b" class="scholar-filter-control">${accentOptions}</select>
      </label>
      <label class="scholar-filter-label">Парадигма C (опц.)
        <select id="accent-compare-c" class="scholar-filter-control">
          <option value="-1">—</option>
          ${accentOptions}
        </select>
      </label>
      <button id="accent-compare-export-md" type="button" class="related-link related-link-btn">Экспорт сравнения в Markdown</button>
    </div>
    <div id="accent-compare-box"></div>
  </div>`;

  // 10. Сравнительная таблица
  html += '<h3 id="sch-correspondences" class="scholar-section-title scholar-section-title-spaced">10. Сравнительная таблица фонетических соответствий</h3>';
  html += '<div class="scholar-section-intro">Расширенный набор соответствий (ПИЕ → славянские, греческие, индоиранские и западноевропейские формы), который можно дальше наращивать на материале работ Зализняка.</div>';
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
  html += `<div class="scholar-filter-bar">
    <label class="scholar-filter-label">Семья
      <select id="corr-family-filter" class="scholar-filter-control">
        <option value="">Все</option>
        ${corrFamilies.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
      </select>
    </label>
    <label class="scholar-filter-label">Язык в строке
      <select id="corr-lang-filter" class="scholar-filter-control">
        <option value="">Любой</option>
        <option value="rus">Русский</option>
        <option value="lat">Латинский</option>
        <option value="gre">Древнегреческий</option>
        <option value="san">Санскрит</option>
        <option value="eng">Английский</option>
        <option value="ger">Немецкий</option>
      </select>
    </label>
    <label class="scholar-filter-label">Фонетический закон
      <select id="corr-law-filter" class="scholar-filter-control scholar-filter-wide">
        <option value="">Все</option>
        ${corrLaws.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('')}
      </select>
    </label>
  </div>`;
  html += '<div class="scholar-table-scroll"><table class="scholar-compact-table">';
  html += '<thead><tr class="scholar-table-head-row"><th>ПИЕ</th><th>Русск.</th><th>Лат.</th><th>Греч.</th><th>Санскр.</th><th>Англ.</th><th>Нем.</th><th>Значение</th><th>Закон/семья</th><th>Источник</th><th>Связи</th></tr></thead><tbody id="corr-table-body">';
  for (const r of corrRows) {
    const langHash = buildItemHash('languages', r._focusLang || 'санскрит');
    html += `<tr class="corr-row" role="button" tabindex="0" data-family="${escapeHtml(r._family)}" data-law="${escapeHtml(r._law)}" data-langs="${escapeHtml(r._langs)}" data-focus-lang="${escapeHtml(r._focusLang)}">
      <td class="corr-pie-cell">${renderAccentSafe(r.pie)}</td>
      <td class="corr-rus-cell">${renderAccentSafe(r.rus)}</td>
      <td>${renderAccentSafe(r.lat)}</td>
      <td class="corr-script-cell">${renderAccentSafe(r.gre)}</td>
      <td class="corr-script-cell">${renderAccentSafe(r.san)}</td>
      <td>${renderAccentSafe(r.eng)}</td>
      <td>${renderAccentSafe(r.ger)}</td>
      <td class="corr-meaning-cell">${escapeHtml(r.meaning)}</td>
      <td>
        <div class="corr-meta-main">${escapeHtml(r._law)}</div>
        <div class="corr-meta-sub">${escapeHtml(r._family)}</div>
      </td>
      <td class="corr-source-cell">${escapeHtml(r._source)}</td>
      <td class="corr-links-cell">
        <a class="corr-lang-link" data-type="languages" data-head="${escapeHtml(r._focusLang)}" href="${escapeHtml(langHash)}">язык ↗</a><br>
        <a class="corr-law-link" href="${escapeHtml(buildCanonicalHash(['materials', 'phonetic_laws']))}">закон ↗</a>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  // 11. Реконструкции
  const recon = APP_DATA.lexicon_tech || [];
  html += '<h3 id="sch-reconstructions" class="scholar-section-title scholar-section-title-spaced">11. Реконструкции</h3>';
  html += `<div class="scholar-section-intro">${recon.length} реконструированных и иноязычных форм, вынесенных в подраздел профессионального аппарата.</div>`;
  html += `<div class="scholar-recon-grid" style="--scholar-recon-columns:${reconstructionColumns};">`;
  for (const item of recon) {
    html += `<a class="scholar-link scholar-recon-link" data-type="lexicon_tech" data-head="${escapeHtml(item.head)}" href="${escapeHtml(buildItemHash('lexicon_tech', item.head))}">
      <span class="scholar-recon-head">${escapeHtml(item.head)}</span>
      <span class="scholar-muted-meta">${escapeHtml((item.page_list || []).length)} стр.</span>
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
        accentCompareBox.innerHTML = '<div class="scholar-compare-empty">Выберите минимум две разные парадигмы.</div>';
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
          return `<td class="scholar-compare-cell" style="${bg}">${cell ? renderAccentSafe(cell) : '<span class="scholar-compare-missing">—</span>'}</td>`;
        }).join('');
        htmlRows.push(`<tr><td class="scholar-compare-row-index">${i + 1}</td>${cellHtml}</tr>`);
        mdRows.push(`| ${i + 1} | ${cells.map(mdEscapeCell).join(' | ')} |`);
      }
      accentCompareBox.innerHTML = `<div class="scholar-table-scroll"><table class="scholar-compact-table">
        <thead><tr class="scholar-table-head-row"><th>№</th>${labels.map((l) => `<th>${escapeHtml(l)}</th>`).join('')}</tr></thead>
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
      tr.innerHTML = '<td class="scholar-table-empty" colspan="11">Нет строк под текущие фильтры.</td>';
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
      tr.innerHTML = '<td class="scholar-table-empty" colspan="5">Ничего не найдено: попробуйте ослабить фильтры.</td>';
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

  let svg = `<svg class="language-tree-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
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
        svg += `<g class="language-tree-node" data-lang="${escapeHtml(lang.name)}">
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
  const selectedHeadForMap = selectedItemType === type ? String(selectedItem || '').trim() : '';
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
      <div id="leaflet-map" class="leaflet-map-host"></div></div></div>`;

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
    let focusedMarker = null;
    let focusedLatLng = null;
    for (const it of items) {
      const isFocused = selectedHeadForMap && String(it.head || '') === selectedHeadForMap;
      const marker = L.circleMarker([it.lat, it.lon], {
        radius: radiusFn(it),
        color: isFocused ? '#1f2933' : 'white',
        weight: isFocused ? 2.5 : 1.5,
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
      if (isFocused) {
        focusedMarker = marker;
        focusedLatLng = [it.lat, it.lon];
      }
    }
    if (focusedMarker && focusedLatLng) {
      try {
        map.setView(focusedLatLng, Math.max(map.getZoom(), 5), { animate: false });
        setTimeout(() => {
          try { focusedMarker.openTooltip(); } catch (e) {}
        }, 80);
      } catch (e) {}
    }
  }, 50);
}

// Офлайн-заглушка карты: SVG с координатной сеткой и маркерами
function renderOfflineMap(type, items, colorFn, radiusFn) {
  const div = document.getElementById('leaflet-map');
  if (!div) return;
  const selectedHeadForMap = selectedItemType === type ? String(selectedItem || '').trim() : '';
  const W = 1100, H = 600;
  // Простая равноугольная проекция (Plate Carrée)
  function project(lat, lon) {
    const x = ((lon + 180) / 360) * W;
    const y = ((85 - lat) / 145) * H;
    return [x, y];
  }
  let svg = `<svg class="offline-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
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
  let hasFocusedMarker = false;
  for (const it of items) {
    const [x, y] = project(it.lat, it.lon);
    const isFocused = selectedHeadForMap && String(it.head || '') === selectedHeadForMap;
    if (isFocused) hasFocusedMarker = true;
    const r = radiusFn(it) + (isFocused ? 1 : 0);
    const color = colorFn(it);
    const strokeColor = isFocused ? '#1f2933' : 'white';
    const strokeWidth = isFocused ? 2 : 1;
    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.75" stroke="${strokeColor}" stroke-width="${strokeWidth}" data-head="${escapeHtml(it.head)}" data-type="${escapeHtml(type)}" class="offline-map-point"><title>${escapeHtml(it.head)} · стр. ${escapeHtml(it.pages || it.head_pages || '')}</title></circle>`;
  }
  // Заглушка-текст
  svg += `<text x="${W/2}" y="24" fill="#6a5040" font-size="13" text-anchor="middle" font-style="italic">Офлайн-режим: тайлы карты недоступны, показаны только точки</text>`;
  if (hasFocusedMarker) {
    svg += `<text x="${W/2}" y="42" fill="#1f2933" font-size="12" text-anchor="middle" font-style="italic">Выбранный объект выделен тёмным контуром</text>`;
  }
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
document.getElementById('content').innerHTML = '<div class="panel-empty-state">Загрузка указателей…</div>';

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
