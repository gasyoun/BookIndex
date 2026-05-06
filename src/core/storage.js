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
