/**
 * @file data.js
 * @description Data hydration, schema migration, and normalization
 */

import { 
  APP_DATA, 
  APP_DATA_GLOBAL_FALLBACK_KEY,
  APP_DATA_SCRIPT_TAG_ID,
  APP_DATA_SCHEMA_CURRENT,
  setAppData, 
  setVizCacheWarmPromise, 
  setVizScriptLoadPromises,
  KWIC_MAX_SNIPPETS_PER_PAGE,
  KWIC_MAX_SNIPPET_LENGTH,
  DESCRIPTION_FIELDS_WITH_NORMALIZED_YO,
  LECTURE_WHY_READ_BROTHER_BRAT,
  DEFAULT_TOTAL_PAGES
} from './state.js';
import { clearGlobalSearchCaches } from './search.js';
import { cleanupActiveVizModule } from './viz.js';
import { initEntityTypes } from './registry.js';
import { normalizeHeadForMatch, compareHeadsRu } from '../utils/linguistics.js';

/**
 * Extract raw JSON string from the DOM or global fallback.
 */
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

/**
 * Parse embedded APP_DATA payload and hydrate global references.
 */
export function parseAppData() {
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

/**
 * Normalize application data after parsing.
 */
export function normalizeAppData(data) {
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

export function normalizeCorpusRegistry(data) {
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

export function applyDescriptionEditorialConventions(data) {
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

export function getCorpusRegistry() {
  return APP_DATA.corpus_registry || { books: [], sources: [] };
}

export function getPlannedVideoCatalogSource() {
  const sources = getCorpusRegistry().sources || [];
  return sources.find(s => s.is_video_catalog) || null;
}

export function getCorpusBooks() {
  const books = getCorpusRegistry().books;
  return Array.isArray(books) ? books.filter(book => book && typeof book.book_id === 'string') : [];
}

export function getActiveBook() {
  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  return books.find(book => book.book_id === registry.active_book_id) || books[0] || { book_id: 'unknown' };
}

export function getBookLabelForSearch(bookId) {
  const id = String(bookId || '').trim();
  const book = getCorpusBooks().find(item => item.book_id === id) || getActiveBook();
  return String(book.short_title || book.title || book.book_id || 'текущая книга');
}

/**
 * Collect entities mentioned on a specific page.
 */
export function collectReadingNow(page, limitPerType = 8) {
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
