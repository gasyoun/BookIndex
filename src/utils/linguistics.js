/**
 * Parse a string into Leipzig-style gloss objects.
 * Format: "word1 word2" + "gloss1 gloss2"
 */
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

export function clampPageInBook(page, totalPages = 424) {
  const p = parseInt(String(page || '1'), 10);
  if (!Number.isFinite(p)) return 1;
  return Math.max(1, Math.min(totalPages, p));
}

export function normalizePageRangeInBook(start, end, min = 1, max = 424) {
  let s = parseInt(String(start || min), 10);
  let e = parseInt(String(end || max), 10);
  if (!Number.isFinite(s)) s = min;
  if (!Number.isFinite(e)) e = max;
  s = Math.max(min, Math.min(max, s));
  e = Math.max(min, Math.min(max, e));
  if (s > e) [s, e] = [e, s];
  return { start: s, end: e };
}
