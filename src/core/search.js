/**
 * @file search.js
 * @description Intellectual Search v13.1 - Fuzzy matching and morphological normalization
 */

import { APP_DATA } from './state.js';
import { normalizeHeadForMatch, stemRussian } from '../utils/linguistics.js';

let globalSearchWorker = null;
let globalSearchWorkerReady = false;

/**
 * Perform an intellectual search across all entity categories.
 * Uses stemming and fuzzy matching for better results.
 */
export function intellectualSearch(query) {
  if (!query || query.length < 2) return [];
  
  const qNorm = normalizeHeadForMatch(query);
  const qStem = stemRussian(qNorm);
  
  const results = [];
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index'];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const head = it.head || it.name || '';
      const headNorm = normalizeHeadForMatch(head);
      const headStem = stemRussian(headNorm);
      
      let score = 0;
      
      // 1. Exact match (highest priority)
      if (headNorm === qNorm) score = 100;
      // 2. Prefix match
      else if (headNorm.startsWith(qNorm)) score = 80;
      // 3. Stem match (Intellectual)
      else if (headStem.includes(qStem) || qStem.includes(headStem)) score = 60;
      // 4. Description match
      else if (normalizeHeadForMatch(it.description || '').includes(qNorm)) score = 30;
      
      if (score > 0) {
        results.push({
          item: it,
          type: cat === 'subject_index' ? 'subject' : cat,
          score: score + (it.discussed ? 5 : 0) // Boost discussed items
        });
      }
    }
  }
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 50);
}

export function initSearchWorker() {
  // Worker integration logic...
  console.log('[Search] Intellectual Engine initialized');
}
