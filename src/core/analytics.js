/**
 * @file analytics.js
 * @description Advanced DH Analytics: Distant Reading, TF-IDF, and Topic Clustering for v16.0
 */

import { APP_DATA } from './state.js';
import { normalizeHeadForMatch, stemRussian } from '../utils/linguistics.js';

/**
 * Perform Distant Reading analysis: 
 * Group items into thematic clusters based on description text.
 */
export function buildTopicClusters() {
  const corpus = [];
  const categories = ['lexicon', 'names', 'toponyms', 'languages'];
  
  // 1. Prepare Documents
  categories.forEach(cat => {
    const items = APP_DATA[cat] || [];
    items.forEach(it => {
      if (!it.description && !it.head) return;
      corpus.push({
        id: `${cat}:${it.head}`,
        head: it.head,
        text: (it.head + ' ' + (it.description || '')).toLowerCase()
      });
    });
  });

  // 2. Simple TF-IDF / Keyword Extraction
  const clusters = new Map();
  const stopwords = new Set(['в', 'и', 'на', 'что', 'с', 'по', 'из', 'к', 'для']);

  corpus.forEach(doc => {
    const words = doc.text.split(/[^а-яёa-z]+/i)
      .map(w => stemRussian(w))
      .filter(w => w.length > 3 && !stopwords.has(w));
      
    // Assign to clusters based on top stems
    words.slice(0, 3).forEach(stem => {
      if (!clusters.has(stem)) clusters.set(stem, []);
      if (clusters.get(stem).length < 20) {
        clusters.get(stem).push(doc.head);
      }
    });
  });

  // 3. Filter and Rank Clusters
  const ranked = Array.from(clusters.entries())
    .filter(([stem, docs]) => docs.length > 5 && docs.length < 50)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);

  return ranked;
}

/**
 * Calculate Network Centrality (Hubs) based on cross-links.
 */
export function calculateCentrality() {
  const scores = new Map();
  const cross = APP_DATA.cross_links || {};
  
  Object.values(cross).forEach(sourceTypeMap => {
    Object.values(sourceTypeMap).forEach(links => {
      links.forEach(lnk => {
        scores.set(lnk.head, (scores.get(lnk.head) || 0) + (lnk.weight || 1));
      });
    });
  });
  
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
}
