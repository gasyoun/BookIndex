/**
 * @file linguistics.js
 * @description Linguistic utilities, stemming, and numerical clamping
 */

import { APP_DATA, DEFAULT_TOTAL_PAGES } from '../core/state.js';

export function getTotalBookPages() {
  const stats = APP_DATA && APP_DATA.book_stats ? APP_DATA.book_stats : {};
  return Number.isFinite(Number(stats.total_pages)) ? Number(stats.total_pages) : DEFAULT_TOTAL_PAGES;
}

export function clampUiInput(val, maxLen) {
  return String(val || '').slice(0, maxLen);
}

export function clampPageInBook(page) {
  const p = parseInt(String(page || '1'), 10);
  const total = getTotalBookPages();
  if (!Number.isFinite(p)) return 1;
  return Math.max(1, Math.min(total, p));
}
export function parseLeipzigGloss(text, gloss) {
  if (!text || !gloss) return null;
  const words = text.split(/\s+/);
  const glosses = gloss.split(/\s+/);
  
  return words.map((w, i) => ({
    text: w,
    gloss: glosses[i] || ''
  }));
}

export function stemRussian(word) {
  if (!word || typeof word !== 'string') return '';
  let w = word.toLowerCase().replace(/ё/g, 'е');
  // Simple suffix removal (Porter-like)
  const suffixes = /(иями|иями|ями|ия|ие|ии|ию|ей|ой|ий|ый|ов|ам|ах|и|ы|а|о|у|ь)$/;
  return w.replace(suffixes, '');
}

export function normalizeHeadForMatch(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/е\u0308/g, 'е')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compareHeadsRu(a, b) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true });
}

export function compareItemsByHead(a, b) {
  return compareHeadsRu(a.head || a.name || '', b.head || b.name || '');
}

export function sortUniquePages(pages) {
  if (!Array.isArray(pages)) return [];
  return Array.from(new Set(pages.map(p => parseInt(p, 10)).filter(p => Number.isFinite(p)))).sort((a, b) => a - b);
}
