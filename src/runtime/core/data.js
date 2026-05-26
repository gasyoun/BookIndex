import {
  APP_DATA,
  APP_BUILD_ID,
  APP_DATA_SCHEMA_CURRENT,
  APP_DATA_SCRIPT_TAG_ID,
  APP_DATA_GLOBAL_FALLBACK_KEY,
  APP_DATA_MODULES_BASE_URL,
  KWIC_MAX_SNIPPETS_PER_PAGE,
  KWIC_MAX_SNIPPET_LENGTH,
  DEFAULT_TOTAL_PAGES,
  MAX_HASH_PART_LENGTH,
  setAppData,
  setLabels,
  setColors,
  setEpochLabels,
  setEpochColors,
  setFamilyColors,
  setEntityTypes,
  setItemIndexExact,
  setItemIndexNormalized,
  setChapterItemIndex,
  setItemHashSlugByHead,
  setItemHashHeadBySlug,
  setPageToChapter,
  ENTITY_TYPES
} from './state.js';

import {
  clampUiInput,
  normalizeHeadForMatch,
  buildHashSlugIndexesForItems,
  getIndexedItem,
  resolveExistingHead,
  resolveItemHeadFromHash,
  invalidateAggregateCache
} from './utils.js';

export const DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
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

export const LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

export function getEmbeddedAppDataText() {
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

export function hydrateAppData(data) {
  setAppData(data);
  if (typeof window !== 'undefined') {
    window.__vizCache = {};
    window.VIZ_MODULES = window.VIZ_MODULES || {};
  } else if (typeof globalThis !== 'undefined') {
    globalThis.__vizCache = {};
  }
  migrateAppDataSchema(data);
  setLabels(data.labels || {});
  setColors(data.colors || {});
  setEpochLabels(data.epoch_labels || {});
  setEpochColors(data.epoch_colors || {});
  setFamilyColors(data.family_colors || {});
  return data;
}

export function isAppDataModuleManifest(value) {
  return !!(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.mode === 'modules'
    && Array.isArray(value.modules)
  );
}

export function appDataModuleUrl(manifest, file) {
  const base = String((manifest && manifest.base_url) || APP_DATA_MODULES_BASE_URL);
  const rootUrl = (typeof document !== 'undefined' && document.baseURI)
    ? document.baseURI
    : (typeof location !== 'undefined' && location.href ? location.href : 'http://localhost/');
  const url = new URL(String(file || ''), new URL(base, rootUrl));
  const buildId = String((manifest && manifest.build_id) || APP_BUILD_ID || '').trim();
  const unresolvedBuildId = '__APP_' + 'BUILD_ID__';
  if (buildId && buildId !== unresolvedBuildId) url.searchParams.set('v', buildId);
  return url.href;
}

export async function fetchAppDataModule(manifest, file) {
  const url = appDataModuleUrl(manifest, file);
  const response = await fetch(url, { cache: 'default' });
  if (!response.ok) {
    throw new Error(`Failed to load app data module ${file}: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error(`App data module must be a JSON object: ${file}`);
  }
  return payload;
}

export async function loadAppDataFromModules(manifest) {
  const modules = (manifest.modules || []).filter((entry) => entry && entry.file);
  if (!modules.length) throw new Error('App data module manifest is empty');
  const payloads = await Promise.all(modules.map((entry) => fetchAppDataModule(manifest, entry.file)));
  const merged = {};
  const seen = new Set();
  for (const payload of payloads) {
    for (const [key, value] of Object.entries(payload)) {
      if (seen.has(key)) throw new Error(`Duplicate app data key in modules: ${key}`);
      seen.add(key);
      merged[key] = value;
    }
  }
  const keyOrder = Array.isArray(manifest.key_order) ? manifest.key_order : [];
  if (!keyOrder.length) return merged;
  const ordered = {};
  for (const key of keyOrder) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) ordered[key] = merged[key];
  }
  for (const [key, value] of Object.entries(merged)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) ordered[key] = value;
  }
  return ordered;
}

export function parseAppData() {
  const payload = getEmbeddedAppDataText();
  if (!payload) throw new Error('Embedded app data not found');
  const data = JSON.parse(payload);
  if (isAppDataModuleManifest(data)) {
    throw new Error('Embedded app data contains a module manifest; use loadAppData() instead');
  }
  return hydrateAppData(data);
}

export async function loadAppData() {
  const payload = getEmbeddedAppDataText();
  if (!payload) throw new Error('Embedded app data not found');
  const parsed = JSON.parse(payload);
  const data = isAppDataModuleManifest(parsed)
    ? await loadAppDataFromModules(parsed)
    : parsed;
  return hydrateAppData(data);
}

export function migrateAppDataSchema(data) {
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

export function buildDefaultCorpusRegistry() {
  const stats = APP_DATA && APP_DATA.book_stats && typeof APP_DATA.book_stats === 'object'
    ? APP_DATA.book_stats
    : {};
  const pages = Number.isFinite(Number(stats.total_pages)) ? Number(stats.total_pages) : DEFAULT_TOTAL_PAGES;
  return {
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

export function getCorpusRegistry() {
  if (!APP_DATA || !APP_DATA.corpus || typeof APP_DATA.corpus !== 'object') {
    return buildDefaultCorpusRegistry();
  }
  return APP_DATA.corpus;
}

export function getCorpusBooks() {
  const books = getCorpusRegistry().books;
  return Array.isArray(books) ? books.filter(book => book && typeof book.book_id === 'string') : [];
}

export function getActiveBook() {
  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  return books.find(book => book.book_id === registry.active_book_id) || books[0] || buildDefaultCorpusRegistry().books[0];
}

export function applyActiveBookFromQuery(query) {
  const rawQuery = String(query || '').trim();
  if (!rawQuery) return;
  const params = new URLSearchParams(rawQuery);
  const bookId = String(params.get('books') || params.get('book') || '').trim();
  if (!bookId) return;
  const registry = getCorpusRegistry();
  if (!getCorpusBooks().some(book => book.book_id === bookId)) return;
  registry.active_book_id = bookId;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('Zalizniakiada.corpus.activeBook', bookId);
  }
}

export function normalizeCorpusRegistry() {
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

  if (typeof window !== 'undefined' && typeof window.inflateOccurrences === 'function') {
    window.inflateOccurrences(APP_DATA.corpus.active_book_id);
  }
}

export function normalizeAppData() {
  if (!APP_DATA) return;

  APP_DATA.labels = APP_DATA.labels || {};
  APP_DATA.colors = APP_DATA.colors || {};
  normalizeCorpusRegistry();

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

export function normalizeEditorialFlags(item) {
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

export function getFirstContextQuote(item) {
  const entries = getContextEntries(item, 1, 5000);
  for (const entry of entries) {
    const snippets = Array.isArray(entry.snippets) ? entry.snippets : [];
    for (const raw of snippets) {
      const text = String(raw || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
  }
  return '';
}

export function normalizeItemSources(item) {
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

export function normalizeContextSnippet(raw) {
  const text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= KWIC_MAX_SNIPPET_LENGTH) return text;
  return text.slice(0, KWIC_MAX_SNIPPET_LENGTH).trim();
}

export function normalizeItemContexts(item) {
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

export function getContextEntries(itemOrContexts, pageStart = 1, pageEnd = 5000, explicitPageList = null) {
  const source = itemOrContexts && typeof itemOrContexts === 'object' && Object.prototype.hasOwnProperty.call(itemOrContexts, 'contexts')
    ? itemOrContexts.contexts
    : itemOrContexts;
  const pageSource = Array.isArray(explicitPageList)
    ? explicitPageList
    : (itemOrContexts && Array.isArray(itemOrContexts.page_list) ? itemOrContexts.page_list : []);
  if (Array.isArray(source)) {
    const snippets = [];
    for (const raw of source) {
      const snippet = normalizeContextSnippet(raw);
      if (!snippet) continue;
      snippets.push(snippet);
      if (snippets.length >= KWIC_MAX_SNIPPETS_PER_PAGE) break;
    }
    if (!snippets.length) return [];
    const pages = pageSource
      .map((page) => parseInt(String(page || ''), 10))
      .filter((page) => Number.isFinite(page) && page >= 1);
    const page = pages.find((candidate) => candidate >= pageStart && candidate <= pageEnd);
    if (pages.length && !page) return [];
    return [{ page: page || Math.max(1, pageStart), snippets }];
  }
  const safe = source && typeof source === 'object' ? source : {};
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

export function normalizeDescriptionYoText(value) {
  return String(value == null ? '' : value)
    .replace(/е\u0308/g, 'е')
    .replace(/Е\u0308/g, 'Е')
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е');
}

export function normalizeDescriptionYoInNode(node) {
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

export function applyDescriptionEditorialConventions() {
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

export function initEntityTypes() {
  const entityTypesConf = {
    home: {
      title: 'Главная',
      items: [],
      tabs: ['home'],
    },
    materials: {
      title: 'Материалы',
      items: [],
      tabs: ['lectures','lecture_compare','lecture_pages','further_reading','glossary','kwic','gallery','russian_evolution','phonetic_laws','tasks','sources'],
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
  setEntityTypes(entityTypesConf);
  ENTITY_TYPES.all.items = buildAllItems();
  for (const key of Object.keys(ENTITY_TYPES)) {
    indexItems(ENTITY_TYPES[key].items);
  }
  buildDataIndexes();
  invalidateAggregateCache('entity-types-init');
}

export const TAB_LABELS = {
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
  sources: 'Корпус',
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

export function buildAllItems() {
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

export function indexItems(items) {
  if (!items) return;
  for (const it of items) {
    if (!it._search) {
      const raw = String(it.head || '');
      it._search = raw.toLowerCase();
      it._searchNorm = normalizeHeadForMatch(raw);
    }
  }
}

export function buildDataIndexes() {
  const exactIndexes = new Map();
  const normalizedIndexes = new Map();
  const chapterIndexes = new Map();
  const slugIndexesByHead = new Map();
  const slugIndexesBySlug = new Map();
  const pageToChapterMap = new Map();

  const chapters = Array.isArray(APP_DATA?.chapters) ? APP_DATA.chapters : [];
  const localPageToChapter = new Map();
  for (const ch of chapters) {
    for (let p = ch.start; p <= ch.end; p++) {
      localPageToChapter.set(p, ch.name);
      pageToChapterMap.set(p, ch);
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
          const chName = localPageToChapter.get(p);
          if (!chName || seenChapters.has(chName)) continue;
          seenChapters.add(chName);
          byChapter.get(chName).push(it);
        }
      }
    }
    exactIndexes.set(type, exact);
    normalizedIndexes.set(type, normalized);
    chapterIndexes.set(type, byChapter);
    const slugIndexes = buildHashSlugIndexesForItems(conf.items);
    slugIndexesByHead.set(type, slugIndexes.byHead);
    slugIndexesBySlug.set(type, slugIndexes.bySlug);
  }

  setItemIndexExact(exactIndexes);
  setItemIndexNormalized(normalizedIndexes);
  setChapterItemIndex(chapterIndexes);
  setItemHashSlugByHead(slugIndexesByHead);
  setItemHashHeadBySlug(slugIndexesBySlug);
  setPageToChapter(pageToChapterMap);
}

if (typeof window !== 'undefined') {
  window.DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = DESCRIPTION_FIELDS_WITH_NORMALIZED_YO;
  window.LECTURE_WHY_READ_BROTHER_BRAT = LECTURE_WHY_READ_BROTHER_BRAT;
  window.getEmbeddedAppDataText = getEmbeddedAppDataText;
  window.hydrateAppData = hydrateAppData;
  window.isAppDataModuleManifest = isAppDataModuleManifest;
  window.appDataModuleUrl = appDataModuleUrl;
  window.fetchAppDataModule = fetchAppDataModule;
  window.loadAppDataFromModules = loadAppDataFromModules;
  window.parseAppData = parseAppData;
  window.loadAppData = loadAppData;
  window.migrateAppDataSchema = migrateAppDataSchema;
  window.buildDefaultCorpusRegistry = buildDefaultCorpusRegistry;
  window.getCorpusRegistry = getCorpusRegistry;
  window.getCorpusBooks = getCorpusBooks;
  window.getActiveBook = getActiveBook;
  window.applyActiveBookFromQuery = applyActiveBookFromQuery;
  window.normalizeCorpusRegistry = normalizeCorpusRegistry;
  window.normalizeAppData = normalizeAppData;
  window.normalizeEditorialFlags = normalizeEditorialFlags;
  window.getFirstContextQuote = getFirstContextQuote;
  window.normalizeItemSources = normalizeItemSources;
  window.normalizeContextSnippet = normalizeContextSnippet;
  window.normalizeItemContexts = normalizeItemContexts;
  window.getContextEntries = getContextEntries;
  window.normalizeDescriptionYoText = normalizeDescriptionYoText;
  window.normalizeDescriptionYoInNode = normalizeDescriptionYoInNode;
  window.applyDescriptionEditorialConventions = applyDescriptionEditorialConventions;
  window.initEntityTypes = initEntityTypes;
  window.TAB_LABELS = TAB_LABELS;
  window.buildAllItems = buildAllItems;
  window.indexItems = indexItems;
  window.buildDataIndexes = buildDataIndexes;
}

