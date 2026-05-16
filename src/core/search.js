/**
 * @file search.js
 * @description Search engine integration (Fuse.js + Intellectual Stemming)
 */

import Fuse from 'fuse.js';
import { 
  APP_DATA,
  globalSearchCache,
  globalSearchFuse,
  globalSearchFuseSignature,
  globalSearchFuseDisabled,
  setGlobalSearchFuse,
  setGlobalSearchFuseSignature,
  setGlobalSearchFuseDisabled
} from './state.js';
import { normalizeHeadForMatch, stemRussian, compareHeadsRu, clampUiInput } from '../utils/linguistics.js';

const GLOBAL_SEARCH_CACHE_MAX = 120;
const GLOBAL_SEARCH_FUSE_LIMIT = 80;
const MAX_GLOBAL_QUERY_LENGTH = 80;

/**
 * Reset the Fuse.js search engine state.
 */
export function resetGlobalSearchFuseState() {
  setGlobalSearchFuse(null);
  setGlobalSearchFuseSignature('');
  setGlobalSearchFuseDisabled(false);
}

/**
 * Clear search results and normalization caches.
 */
export function clearGlobalSearchCaches() {
  if (globalSearchCache && typeof globalSearchCache.clear === 'function') {
    globalSearchCache.clear();
  }
  resetGlobalSearchFuseState();
}

/**
 * Initialize or retrieve the Fuse instance.
 */
function ensureGlobalSearchFuse() {
  if (globalSearchFuseDisabled) return false;
  
  const signature = `${APP_DATA ? APP_DATA.schema_version : 0}::${(APP_DATA && APP_DATA.lexicon ? APP_DATA.lexicon.length : 0)}`;
  if (globalSearchFuse && globalSearchFuseSignature === signature) return true;
  
  try {
    const records = buildGlobalSearchFuseRecords();
    if (!records.length) return false;
    
    const fuse = new Fuse(records, {
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
    
    setGlobalSearchFuse(fuse);
    setGlobalSearchFuseSignature(signature);
    return true;
  } catch (e) {
    resetGlobalSearchFuseState();
    setGlobalSearchFuseDisabled(true);
    return false;
  }
}

function buildGlobalSearchFuseRecords() {
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'lexicon_reverse', 'subject_index'];
  const records = [];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const head = it.head || it.name || '';
      records.push({
        head,
        searchHead: normalizeHeadForMatch(head),
        searchSecondary: normalizeHeadForMatch(it.description || ''),
        type: cat === 'subject_index' ? 'subject' : cat,
        item: it
      });
    }
  }
  return records;
}

/**
 * Perform a global search across all categories.
 */
export function getGlobalSearchMatches(query) {
  const qRaw = clampUiInput(query, MAX_GLOBAL_QUERY_LENGTH).toLowerCase();
  const qNorm = normalizeHeadForMatch(qRaw);
  if (qNorm.length < 2) return [];
  
  const searchKey = `global::${qNorm}`;
  const cached = globalSearchCache.get(searchKey);
  if (cached) return cached;
  
  let results = [];
  if (ensureGlobalSearchFuse()) {
    const fuseResults = globalSearchFuse.search(qNorm, { limit: GLOBAL_SEARCH_FUSE_LIMIT });
    results = fuseResults.map(r => ({
      item: r.item.item,
      type: r.item.type,
      score: r.score
    }));
  } else {
    // Fallback to intellectual search if Fuse is disabled
    results = intellectualSearch(query);
  }
  
  globalSearchCache.set(searchKey, results);
  // Simple cache eviction
  if (globalSearchCache.size > GLOBAL_SEARCH_CACHE_MAX) {
    const firstKey = globalSearchCache.keys().next().value;
    globalSearchCache.delete(firstKey);
  }
  
  return results;
}

/**
 * Legacy/Intellectual search (stemming based).
 */
export function intellectualSearch(query) {
  if (!query || query.length < 2) return [];
  
  const qNorm = normalizeHeadForMatch(query);
  const qStem = stemRussian(qNorm);
  
  const results = [];
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'lexicon_reverse', 'subject_index'];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const head = it.head || it.name || '';
      const headNorm = normalizeHeadForMatch(head);
      const headStem = stemRussian(headNorm);
      
      let score = 1.0;
      
      if (headNorm === qNorm) score = 0.1;
      else if (headNorm.startsWith(qNorm)) score = 0.3;
      else if (headStem.includes(qStem) || qStem.includes(headStem)) score = 0.5;
      else if (normalizeHeadForMatch(it.description || '').includes(qNorm)) score = 0.8;
      else continue;
      
      results.push({
        item: it,
        type: cat === 'subject_index' ? 'subject' : cat,
        score
      });
    }
  }
  
  return results.sort((a, b) => a.score - b.score).slice(0, 50);
}

export function initSearchWorker() {
  console.log('[Search] Engine initialized (Fuse.js + Stemming)');
}
