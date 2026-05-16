/**
 * @file registry.js
 * @description Global entity registry and item indexing
 */

import { APP_DATA, ENTITY_TYPES } from './state.js';
import { normalizeHeadForMatch } from '../utils/linguistics.js';

export const ITEM_INDEX_EXACT = new Map();      // type -> Map(head -> item)
export const ITEM_INDEX_NORMALIZED = new Map(); // type -> Map(normalizedHead -> item)
export const ITEM_HASH_SLUG_BY_HEAD = new Map(); // type -> Map(head -> slug)
export const ITEM_HASH_HEAD_BY_SLUG = new Map(); // type -> Map(slug -> head)

/**
 * Initialize all entity type indexes.
 */
export function initEntityTypes() {
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

export function encodeItemHeadForHash(type, head) {
  if (!head) return '';
  const map = ITEM_HASH_SLUG_BY_HEAD.get(type);
  if (map && map.has(head)) return map.get(head);
  return encodeURIComponent(head);
}

export function decodeItemHeadFromHash(type, slug) {
  if (!slug) return '';
  const map = ITEM_HASH_HEAD_BY_SLUG.get(type);
  if (map && map.has(slug)) return map.get(slug);
  return decodeURIComponent(slug.replace(/_/g, '%'));
}

export function findItemByHeadAndType(head, type) {
  const exact = ITEM_INDEX_EXACT.get(type);
  if (exact && exact.has(head)) return exact.get(head);
  const normMap = ITEM_INDEX_NORMALIZED.get(type);
  if (normMap) {
    const nh = normalizeHeadForMatch(head);
    if (normMap.has(nh)) return normMap.get(nh);
  }
  return null;
}
