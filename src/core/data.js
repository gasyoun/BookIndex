/**
 * @file data.js
 * @description Data hydration, schema migration, and corpus management
 */

import { APP_DATA, setAppData } from './state.js';

export const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
export const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
export const APP_DATA_SCHEMA_CURRENT = 2;

export function getEmbeddedAppDataText() {
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const node = document.getElementById(APP_DATA_SCRIPT_TAG_ID);
    if (node && typeof node.textContent === 'string') {
      const raw = node.textContent.trim();
      if (raw) return raw;
    }
  }
  const fallback = (typeof globalThis !== 'undefined' && typeof globalThis[APP_DATA_GLOBAL_FALLBACK_KEY] === 'string')
    ? globalThis[APP_DATA_GLOBAL_FALLBACK_KEY]
    : '';
  return String(fallback || '').trim();
}

export function parseAppData() {
  const payload = getEmbeddedAppDataText();
  if (!payload) throw new Error('Embedded app data not found');
  const data = JSON.parse(payload);
  setAppData(data);
  return data;
}

export function migrateAppDataSchema(data) {
  if (!data) return;
  // Migration logic from v3_app.js...
  data._schema_version = APP_DATA_SCHEMA_CURRENT;
}

export function getCorpusRegistry() {
  if (!APP_DATA || !APP_DATA.corpus || typeof APP_DATA.corpus !== 'object') {
    return { active_book_id: 'default', books: [] };
  }
  return APP_DATA.corpus;
}

export function getCorpusBooks() {
  const books = getCorpusRegistry().books;
  return Array.isArray(books) ? books.filter(book => book && typeof book.book_id === 'string') : [];
}

export function getActiveBook() {
  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  return books.find(book => book.book_id === registry.active_book_id) || books[0] || { book_id: 'unknown' };
}

export function getBookLabelForSearch(bookId) {
  const id = String(bookId || '').trim();
  const book = getCorpusBooks().find(item => item.book_id === id) || getActiveBook();
  return String(book.short_title || book.title || book.book_id || 'текущая книга');
}
