/**
 * @file bibliography.js
 * @description Bibliographic management system for Zalizniakiada v14.0
 */

import { APP_DATA } from './state.js';

/**
 * Registry of all bibliographic sources found in the corpus data.
 * Key: Short citation (e.g., "Зализняк 1967")
 * Value: Metadata and list of items citing it.
 */
let bibRegistry = null;

/**
 * Build the bibliography index by scanning all items.
 */
export function buildBibliographyIndex() {
  const index = new Map();
  const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index'];
  
  for (const cat of categories) {
    const items = APP_DATA[cat] || [];
    for (const it of items) {
      const sources = Array.isArray(it.sources) ? it.sources : [];
      for (const src of sources) {
        if (!src.label) continue;
        
        // Extract canonical citation (e.g., from "Зализняк 1967, стр. 12" -> "Зализняк 1967")
        const citation = src.label.split(',')[0].trim();
        if (!index.has(citation)) {
          index.set(citation, {
            label: citation,
            full_refs: new Set(),
            citing_items: []
          });
        }
        
        const entry = index.get(citation);
        if (src.full_reference) entry.full_refs.add(src.full_reference);
        entry.citing_items.push({
          head: it.head,
          type: cat,
          page: src.page
        });
      }
    }
  }
  
  bibRegistry = index;
  console.log(`[Bib] Index built: ${index.size} citations found.`);
  return index;
}

/**
 * Get citation details.
 */
export function getCitationDetails(citation) {
  if (!bibRegistry) buildBibliographyIndex();
  return bibRegistry.get(citation);
}

/**
 * Export all bibliography as BibTeX.
 */
export function exportBibliographyBibTeX() {
  if (!bibRegistry) buildBibliographyIndex();
  let bibtex = '';
  for (const [cite, data] of bibRegistry) {
    const key = cite.replace(/\s+/g, '_').toLowerCase();
    bibtex += `@misc{${key},\n  title = {${cite}},\n  note = {Citations in corpus: ${data.citing_items.length}}\n}\n\n`;
  }
  return bibtex;
}
