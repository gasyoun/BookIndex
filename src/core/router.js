/**
 * @file router.js
 * @description Routing and hash management for BookIndex v13.0
 */

import { 
  currentTab, 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  rightPaneMode,
  searchQuery,
  ENTITY_TYPES,
  HASH_ROUTE_PREFIX,
  MAX_LIST_QUERY_LENGTH,
  setCurrentTab,
  setCurrentEntity,
  setSearchQuery,
  setSelectedItem,
  setSelectedItemType,
  setRightPaneMode,
  trendsRangeStart,
  trendsRangeEnd,
  setTrendsRangeStart,
  setTrendsRangeEnd,
  currentVizModule,
  vizScriptLoadPromises // for reset if needed
} from './state.js';
import { encodeItemHeadForHash, decodeItemHeadFromHash } from './registry.js';
import { clampUiInput, clampPageInBook } from '../utils/linguistics.js';
import { getActiveBook } from './data.js';

/**
 * Parse hash into parts and query string.
 */
export function parseHashRoute(hash) {
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
export function buildHashFromState() {
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
export function applyHash(hash) {
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
export function syncNavigationState() {
  if (typeof window === 'undefined' || !window.location) return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}
