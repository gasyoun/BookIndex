import {
  APP_DATA,
  DEFAULT_TOTAL_PAGES,
  NORMALIZE_CACHE_LIMIT,
  AGGREGATE_CACHE_MAX,
  MAX_HASH_SLUG_LENGTH,
  MAX_HASH_PART_LENGTH,
  normalizeHeadCache,
  aggregateCache,
  nameGraphLayoutPromiseCache,
  familiesGraphLayoutPromiseCache,
  ITEM_INDEX_EXACT,
  ITEM_INDEX_NORMALIZED,
  ITEM_HASH_SLUG_BY_HEAD,
  ITEM_HASH_HEAD_BY_SLUG,
  ENTITY_TYPES
} from './state.js';

export const ACCENT_SAFE_TOKEN_RE = /([^\s,;()[\]{}<>]*[\u0300-\u036f][^\s,;()[\]{}<>]*)/g;

export const CYRILLIC_TO_LATIN_MAP = Object.freeze({
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

export function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

export function safeSetAttr(el, name, value) {
  if (!el || typeof el.setAttribute !== 'function') return;
  el.setAttribute(name, value);
}

export function perfDebug(label, ms, meta = '') {
  if (typeof console === 'undefined' || typeof console.debug !== 'function') return;
  const extra = meta ? ` · ${meta}` : '';
  console.debug(`[perf] ${label}: ${ms.toFixed(1)}ms${extra}`);
}

export function deterministicUnitFromString(text, salt = 0) {
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

export function getDataSignature() {
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

export function rememberBoundedCacheValue(cache, key, value, maxSize, options = {}) {
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

export function getCachedAggregate(kind, key, computeFn) {
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

export function invalidateAggregateCache(reason = '') {
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

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  let text = String(s);
  if (typeof text.normalize === 'function') text = text.normalize('NFC');
  return text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

export function escapeYamlDoubleQuoted(value) {
  return normalizeBibtexText(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

export function escapeMarkdownTableCell(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

export function clampUiInput(value, maxLen) {
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 80;
  return String(value || '').trim().slice(0, limit);
}

export function getTotalBookPages() {
  return Math.max(1, parseInt(APP_DATA?.book_stats?.total_pages || DEFAULT_TOTAL_PAGES, 10) || DEFAULT_TOTAL_PAGES);
}

export function normalizeKwicSource(source) {
  if (source === "glossary") return "glossary";
  if (source === "lectures") return "lectures";
  return "lexicon";
}

export function normalizeKwicSort(mode) {
  return ['left', 'right', 'page'].includes(mode) ? mode : 'left';
}

export function clampPageInBook(value) {
  const total = getTotalBookPages();
  const raw = Number.isFinite(value) ? value : parseInt(String(value || ''), 10);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(total, raw));
}

export function normalizePageRangeInBook(startValue, endValue, fallbackStart = 1, fallbackEnd = null) {
  const resolvedFallbackEnd = fallbackEnd == null ? getTotalBookPages() : fallbackEnd;
  const start = startValue == null ? clampPageInBook(fallbackStart) : clampPageInBook(startValue);
  const end = endValue == null ? clampPageInBook(resolvedFallbackEnd) : clampPageInBook(endValue);
  return start <= end ? { start, end } : { start: end, end: start };
}

export function announceUiMessage(message) {
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

export function shuffleArray(input) {
  const arr = Array.isArray(input) ? [...input] : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function normalizeHeadForMatch(value) {
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

export function compareHeadsRu(aHead, bHead) {
  const aRaw = String(aHead || '');
  const bRaw = String(bHead || '');
  const aNorm = normalizeHeadForMatch(aRaw);
  const bNorm = normalizeHeadForMatch(bRaw);
  const primary = aNorm.localeCompare(bNorm, 'ru', { sensitivity: 'base', numeric: true });
  if (primary !== 0) return primary;
  return aRaw.localeCompare(bRaw, 'ru', { sensitivity: 'base', numeric: true });
}

export function compareItemsByHead(a, b) {
  return compareHeadsRu(a?.head, b?.head);
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

export function normalizeHashSlug(value) {
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

export function buildHashSlugIndexesForItems(items) {
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

export function getIndexedItem(type, head) {
  if (!type || !head) return null;
  const exact = ITEM_INDEX_EXACT.get(type);
  if (exact && exact.has(head)) return exact.get(head);
  const nHead = normalizeHeadForMatch(head);
  const normalized = ITEM_INDEX_NORMALIZED.get(type);
  if (nHead && normalized && normalized.has(nHead)) return normalized.get(nHead);
  return null;
}

export function resolveExistingHead(type, head) {
  const item = getIndexedItem(type, head);
  return item ? item.head : head;
}

export function encodeItemHeadForHash(type, head) {
  const resolved = resolveExistingHead(type, head);
  const byHead = ITEM_HASH_SLUG_BY_HEAD.get(type);
  if (byHead && byHead.has(resolved)) return byHead.get(resolved);
  const fallbackSlug = normalizeHashSlug(resolved);
  return fallbackSlug || resolved;
}

export function resolveItemHeadFromHash(type, encodedHead) {
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

export function normalizeBibtexText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

if (typeof window !== 'undefined') {
  window.nowMs = nowMs;
  window.safeSetAttr = safeSetAttr;
  window.perfDebug = perfDebug;
  window.deterministicUnitFromString = deterministicUnitFromString;
  window.getDataSignature = getDataSignature;
  window.getCachedAggregate = getCachedAggregate;
  window.invalidateAggregateCache = invalidateAggregateCache;
  window.escapeHtml = escapeHtml;
  window.escapeYamlDoubleQuoted = escapeYamlDoubleQuoted;
  window.escapeMarkdownTableCell = escapeMarkdownTableCell;
  window.clampUiInput = clampUiInput;
  window.getTotalBookPages = getTotalBookPages;
  window.normalizeKwicSource = normalizeKwicSource;
  window.normalizeKwicSort = normalizeKwicSort;
  window.clampPageInBook = clampPageInBook;
  window.normalizePageRangeInBook = normalizePageRangeInBook;
  window.announceUiMessage = announceUiMessage;
  window.shuffleArray = shuffleArray;
  window.normalizeHeadForMatch = normalizeHeadForMatch;
  window.compareHeadsRu = compareHeadsRu;
  window.compareItemsByHead = compareItemsByHead;
  window.slugify = slugify;
  window.normalizeHashSlug = normalizeHashSlug;
  window.buildHashSlugIndexesForItems = buildHashSlugIndexesForItems;
  window.getIndexedItem = getIndexedItem;
  window.resolveExistingHead = resolveExistingHead;
  window.encodeItemHeadForHash = encodeItemHeadForHash;
  window.resolveItemHeadFromHash = resolveItemHeadFromHash;
  window.normalizeBibtexText = normalizeBibtexText;
  window.safeUrl = (url, fallback = '#') => {
    const clean = String(url || '').trim();
    if (!clean || clean.toLowerCase().startsWith('javascript:')) return fallback;
    return clean;
  };
  window.safeImageUrl = (url, fallback = '') => {
    const clean = String(url || '').trim();
    if (!clean || clean.toLowerCase().startsWith('javascript:')) return fallback;
    return clean;
  };
}

