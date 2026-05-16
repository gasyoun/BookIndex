/**
 * @file storage.js
 * @description Persistent storage management using IndexedDB for Zalizniakiada v13.0
 */

const DB_NAME = 'ZalizniakiadaDB';
const DB_VERSION = 1;
const STORE_NOTES = 'notes';

let dbInstance = null;

/**
 * Open the database and ensure the object store exists.
 */
export async function initStorage() {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Save a researcher note.
 */
export async function saveNote(id, text) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES], 'readwrite');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.put({ id, text, updatedAt: new Date().toISOString() });
    
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieve a researcher note.
 */
export async function getNote(id) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES], 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.get(id);
    
    request.onsuccess = (event) => resolve(event.target.result ? event.target.result.text : '');
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Retrieve all researcher notes for export.
 */
export async function getAllNotes() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NOTES], 'readonly');
    const store = transaction.objectStore(STORE_NOTES);
    const request = store.getAll();
    
    request.onsuccess = (event) => resolve(event.target.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

// --- Settings & Preferences ---

const SETTINGS_KEY = 'v13_settings';

/**
 * Get all saved settings.
 */
export function getAllSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to parse settings from localStorage', e);
    return {};
  }
}

/**
 * Get a specific setting.
 */
export function getSetting(key, defaultValue = null) {
  const settings = getAllSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Save a specific setting.
 */
export function setSetting(key, value) {
  try {
    const settings = getAllSettings();
    settings[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save setting to localStorage', e);
  }
}

/**
 * Clear all settings.
 */
export function clearAllSettings() {
  localStorage.removeItem(SETTINGS_KEY);
}
