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
  searchQuery
} from './state.js';

export function parseHashRoute(hash) {
  if (!hash || typeof hash !== 'string') return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'v4') return null;
  return { parts: parts.slice(1), query };
}

export function buildHashFromState() {
  const parts = ['v4', currentEntity, currentTab];
  if (selectedItem && selectedItemType) {
    parts.push('item', selectedItemType, encodeURIComponent(selectedItem));
  } else if (searchQuery && currentTab === 'list') {
    parts.push('q', encodeURIComponent(searchQuery));
  }
  return '#' + parts.join('/');
}

export function syncNavigationState() {
  // Logic to sync internal state to window.location.hash
  if (typeof window === 'undefined') return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

export function applyHash(hash) {
  const parsed = parseHashRoute(hash);
  if (!parsed) return false;
  // Implementation of state application...
  // This will be expanded as we modularize more components.
  return true;
}
