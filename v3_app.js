/**
 * Zalizniakiada (BookIndex) v13.0 Modular
 * Generated on: 2026-05-06T20:08:54.113Z
 * --------------------------------------------------
 */

(function() {
  "use strict";

// --- Module: core/state.js ---
/**
 * @file state.js
 * @description Core application state and constants for BookIndex v13.0
 */

// --- Constants ---
const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
const APP_DATA_SCHEMA_CURRENT = 2;

const KWIC_MAX_SNIPPETS_PER_PAGE = 24;
const KWIC_MAX_SNIPPET_LENGTH = 420;
const KWIC_MAX_ROWS = 1200;

const DEFAULT_TOTAL_PAGES = 424;
const APP_BUILD_ID = '__APP_BUILD_ID__';

const DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
  'desc', 'about', 'why', 'why_read', 'description', 
  'definition', 'main_idea', 'tagline', 'event'
]);

const LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

const HOME_DECL_FACTORY_KEY = '__bookindexHomeDeclarativeFactory';

// --- Mutable State (Global References) ---
let APP_DATA = null;
let LABELS = null;
let COLORS = null;
let EPOCH_LABELS = null;
let EPOCH_COLORS = null;
let FAMILY_COLORS = null;

// --- UI State ---
let currentTab = 'home';
let currentEntity = 'all';
let searchQuery = '';
let selectedItem = null;
let selectedItemType = null;
let rightPaneMode = 'histogram'; // 'card' or 'histogram'

let scholarPins = new Set();
let dossierMetadata = { title: '', description: '' };

let currentVizModule = 'viz03';
let currentVizQueryString = '';
let currentVizCleanup = null;
let vizCacheWarmPromise = null;
let vizScriptLoadPromises = new Map();

let trendsRangeStart = 1;
let trendsRangeEnd = 424;

// --- Shared Constants for Entity Types ---
const TAB_LABELS = {
  home: 'Обзор',
  list: 'Список',
  materials: 'Материалы',
  scholar: 'Аппарат',
  viz: 'Визуализация',
  corpus: 'Корпус'
};

const ENTITY_TYPES = {
  home: { title: 'Главная', tabs: ['home'], items: [] },
  corpus: { title: 'Библиотека', tabs: ['corpus'], items: [] },
  materials: { title: 'Материалы', tabs: ['materials'], items: [] },
  scholar: { title: 'Аппарат', tabs: ['scholar', 'viz'], items: [] },
  all: { title: 'Все связи', tabs: ['list'], items: [] },
  names: { title: 'Имена', tabs: ['list'], items: [] },
  toponyms: { title: 'Топонимы', tabs: ['list'], items: [] },
  ethnonyms: { title: 'Этнонимы', tabs: ['list'], items: [] },
  languages: { title: 'Языки', tabs: ['list'], items: [] },
  lexicon: { title: 'Лексика (А-Я)', tabs: ['list'], items: [] },
  lexicon_reverse: { title: 'Лексика (Я-А)', tabs: ['list'], items: [] },
  subject: { title: 'Предметы', tabs: ['list'], items: [] }
};

/**
 * Update global state reference (used by hydrators)
 */
function setAppData(data) {
  APP_DATA = data;
  if (data) {
    LABELS = data.labels || {};
    COLORS = data.colors || {};
    EPOCH_LABELS = data.epoch_labels || {};
    EPOCH_COLORS = data.epoch_colors || {};
    FAMILY_COLORS = data.family_colors || {};
    
    // Refresh ENTITY_TYPES counts
    Object.keys(ENTITY_TYPES).forEach(key => {
      if (data[key] && Array.isArray(data[key])) {
        ENTITY_TYPES[key].items = data[key];
      }
    });
  }
}


// --- Module: core/data.js ---
/**
 * @file data.js
 * @description Data hydration, schema migration, and corpus management
 */


const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
const APP_DATA_SCHEMA_CURRENT = 2;

function getEmbeddedAppDataText() {
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

function parseAppData() {
  const payload = getEmbeddedAppDataText();
  if (!payload) throw new Error('Embedded app data not found');
  const data = JSON.parse(payload);
  setAppData(data);
  return data;
}

function migrateAppDataSchema(data) {
  if (!data) return;
  // Migration logic from v3_app.js...
  data._schema_version = APP_DATA_SCHEMA_CURRENT;
}

function getCorpusRegistry() {
  if (!APP_DATA || !APP_DATA.corpus || typeof APP_DATA.corpus !== 'object') {
    return { active_book_id: 'default', books: [] };
  }
  return APP_DATA.corpus;
}

function getCorpusBooks() {
  const books = getCorpusRegistry().books;
  return Array.isArray(books) ? books.filter(book => book && typeof book.book_id === 'string') : [];
}

function getActiveBook() {
  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  return books.find(book => book.book_id === registry.active_book_id) || books[0] || { book_id: 'unknown' };
}

function getBookLabelForSearch(bookId) {
  const id = String(bookId || '').trim();
  const book = getCorpusBooks().find(item => item.book_id === id) || getActiveBook();
  return String(book.short_title || book.title || book.book_id || 'текущая книга');
}


// --- Module: core/storage.js ---
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


// --- Module: core/ai.js ---
/**
 * @file ai.js
 * @description Linguistic AI Copilot for Zalizniakiada v15.0
 * Provides smart insights, etymological hypotheses, and cross-corpus connections.
 */



/**
 * Generate an "Insight" for a specific entity.
 * This simulates an AI assistant by performing deep cross-category analysis.
 */
function getLinguisticInsight(head, type) {
  const qStem = stemRussian(normalizeHeadForMatch(head));
  const insights = [];
  
  // 1. Semantic Proximity Insight
  const semantic = (APP_DATA.semantic_links || {})[head] || [];
  if (semantic.length > 0) {
    insights.push(`Обнаружена высокая семантическая близость с термином "${semantic[0].head}" (${Math.round(semantic[0].score * 100)}%).`);
  }
  
  // 2. Cross-Category Morphological Connection
  const categories = ['lexicon', 'names', 'toponyms'];
  for (const cat of categories) {
    if (cat === type) continue;
    const items = APP_DATA[cat] || [];
    const match = items.find(it => stemRussian(normalizeHeadForMatch(it.head || '')) === qStem);
    if (match) {
      insights.push(`Замечена морфологическая связь с ${cat === 'names' ? 'личностью' : 'топонимом'} "${match.head}". Возможно общее происхождение.`);
    }
  }
  
  // 3. Frequency Analysis
  const item = (APP_DATA[type] || []).find(it => it.head === head);
  if (item && (item.page_list || []).length > 5) {
    insights.push(`Данный термин является высокочастотным для этого корпуса. Рекомендуется проверить его роль в ключевых лингвистических законах Зализняка.`);
  }

  return insights.length > 0 ? insights : ["Инсайтов пока нет, продолжайте исследование."];
}

/**
 * Bridge for external LLM API integration.
 */
export async function askLinguisticAI(prompt) {
  // Placeholder for future OpenAI/Anthropic integration
  return "Этот запрос будет передан языковой модели в будущих версиях v15.x";
}


// --- Module: core/analytics.js ---
/**
 * @file analytics.js
 * @description Advanced DH Analytics: Distant Reading, TF-IDF, and Topic Clustering for v16.0
 */



/**
 * Perform Distant Reading analysis: 
 * Group items into thematic clusters based on description text.
 */
function buildTopicClusters() {
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
function calculateCentrality() {
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


// --- Module: core/quiz.js ---
/**
 * @file quiz.js
 * @description Interactive Linguistics Quiz based on A.A. Zaliznyak's works
 */

const QUIZ_LEVELS = [
  {
    id: 1,
    title: "Уровень 1: Историческая лингвистика (Начинающий)",
    questions: [
      {
        text: "Какое слово является этимологическим родственником русского 'глаз' в немецком языке (через значение 'шар')?",
        options: ["Glass", "Kugel", "Glanz"],
        answer: 1
      },
      {
        text: "С каким латинским словом родственно русское 'солнце'?",
        options: ["Luna", "Sol", "Stella"],
        answer: 1
      }
    ]
  },
  {
    id: 2,
    title: "Уровень 2: Берестяные грамоты и новгородский диалект (Средний)",
    questions: [
      {
        text: "Отсутствие какого процесса является уникальной чертой древненовгородского диалекта?",
        options: ["Первая палатализация", "Вторая палатализация", "Третья палатализация"],
        answer: 1
      },
      {
        text: "Согласно закону Вакернагеля, где в предложении должны стоять краткие формы местоимений (энклитики)?",
        options: ["В самом конце", "В самом начале", "После первого ударного слова"],
        answer: 2
      }
    ]
  },
  {
    id: 3,
    title: "Уровень 3: Текстология и 'Слово о полку Игореве' (Продвинутый)",
    questions: [
      {
        text: "Почему 'Слово...' не могло быть подделкой XVIII века с лингвистической точки зрения?",
        options: ["Слишком длинный текст", "Точное соблюдение правил постановки энклитик, неизвестных в XVIII веке", "Упоминание реальных князей"],
        answer: 1
      }
    ]
  },
  {
    id: 4,
    title: "Уровень 4: Грамматика и Акцентология (Эксперт)",
    questions: [
      {
        text: "Что означает индекс в Грамматическом словаре Зализняка?",
        options: ["Год издания слова", "Тип склонения и схема ударения", "Частота употребления"],
        answer: 1
      }
    ]
  }
];

let currentScore = 0;

function checkAnswer(levelId, questionIdx, optionIdx) {
  const level = QUIZ_LEVELS.find(l => l.id === levelId);
  const q = level.questions[questionIdx];
  const isCorrect = q.answer === optionIdx;
  if (isCorrect) currentScore += 10;
  return isCorrect;
}


// --- Module: core/achievements.js ---
/**
 * @file achievements.js
 * @description Gamification and Achievement system for Zalizniakiada v17.5
 */


const ACHIEVEMENTS = [
  { id: 'first_note', title: 'Первое открытие', desc: 'Напишите свою первую заметку к термину', icon: '📝' },
  { id: 'quiz_master', title: 'Магистр лингвистики', desc: 'Пройдите все уровни теста без ошибок', icon: '🎓' },
  { id: 'polyglot', title: 'Полиглот', desc: 'Посетите карточки 10 разных языков', icon: '🌍' },
  { id: 'beresto_fan', title: 'Берестолог', desc: 'Изучите 5 берестяных грамот', icon: '📜' },
  { id: 'navigator', title: 'Великий навигатор', desc: 'Воспользуйтесь перекрестной ссылкой 20 раз', icon: '⚓' },
  { id: 'night_watch', title: 'Ночной дозор', desc: 'Занимались лингвистикой глубокой ночью', icon: '🌙', secret: true },
  { id: 'easter_egg', title: 'Искатель секретов', desc: 'Нашли скрытую кнопку в подвале', icon: '🥚', secret: true }
];

/**
 * Check and unlock achievements based on user actions.
 */
export async function checkAchievements(actionType, data) {
  const unlocked = JSON.parse(localStorage.getItem('unlocked_achievements') || '[]');
  const newUnlocks = [];
  
  if (actionType === 'note_saved' && !unlocked.includes('first_note')) {
    newUnlocks.push('first_note');
  }
  
  if (actionType === 'app_opened') {
    const hour = new Date().getHours();
    if ((hour >= 0 && hour <= 4) && !unlocked.includes('night_watch')) {
      newUnlocks.push('night_watch');
    }
  }
  
  if (actionType === 'easter_egg_clicked' && !unlocked.includes('easter_egg')) {
    newUnlocks.push('easter_egg');
  }
  
  if (actionType === 'language_visited') {
    const visited = JSON.parse(localStorage.getItem('visited_languages') || '[]');
    if (!visited.includes(data.id)) visited.push(data.id);
    localStorage.setItem('visited_languages', JSON.stringify(visited));
    if (visited.length >= 10 && !unlocked.includes('polyglot')) {
      newUnlocks.push('polyglot');
    }
  }

  if (newUnlocks.length > 0) {
    const total = [...unlocked, ...newUnlocks];
    localStorage.setItem('unlocked_achievements', JSON.stringify(total));
    return newUnlocks.map(id => ACHIEVEMENTS.find(a => a.id === id));
  }
  
  return [];
}


// --- Module: utils/dom.js ---
/**
 * @file dom.js
 * @description DOM manipulation and event binding helpers
 */

function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('./')) return url;
  return '#';
}

function bindActionWithKeyboard(el, callback) {
  if (!el) return;
  el.onclick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    callback(e);
  };
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      callback(e);
    }
  };
}

function announceUiMessage(msg, type = 'info') {
  if (typeof window === 'undefined') return;
  const el = document.getElementById('ui-message-toast');
  if (!el) {
    const toast = document.createElement('div');
    toast.id = 'ui-message-toast';
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: #fff; padding: 0.5rem 1.5rem;
      border-radius: 20px; z-index: 10000; font-size: 0.9rem; pointer-events: none;
      transition: opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  const toast = document.getElementById('ui-message-toast');
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function announceAchievement(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="ach-icon">${achievement.icon}</div>
    <div class="ach-info">
      <div class="ach-title">Достижение разблокировано!</div>
      <div class="ach-name">${escapeHtml(achievement.title)}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 100);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}


// --- Module: utils/linguistics.js ---
/**
 * Parse a string into Leipzig-style gloss objects.
 * Format: "word1 word2" + "gloss1 gloss2"
 */
function parseLeipzigGloss(text, gloss) {
  if (!text || !gloss) return null;
  const words = text.split(/\s+/);
  const glosses = gloss.split(/\s+/);
  
  return words.map((w, i) => ({
    text: w,
    gloss: glosses[i] || ''
  }));
}

function stemRussian(word) {
  if (!word || typeof word !== 'string') return '';
  let w = word.toLowerCase().replace(/ё/g, 'е');
  // Simple suffix removal (Porter-like)
  const suffixes = /(иями|иями|ями|ия|ие|ии|ию|ей|ой|ий|ый|ов|ам|ах|и|ы|а|о|у|ь)$/;
  return w.replace(suffixes, '');
}

function normalizeHeadForMatch(value) {
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

function compareHeadsRu(a, b) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'ru', { sensitivity: 'base', numeric: true });
}

function clampPageInBook(page, totalPages = 424) {
  const p = parseInt(String(page || '1'), 10);
  if (!Number.isFinite(p)) return 1;
  return Math.max(1, Math.min(totalPages, p));
}

function normalizePageRangeInBook(start, end, min = 1, max = 424) {
  let s = parseInt(String(start || min), 10);
  let e = parseInt(String(end || max), 10);
  if (!Number.isFinite(s)) s = min;
  if (!Number.isFinite(e)) e = max;
  s = Math.max(min, Math.min(max, s));
  e = Math.max(min, Math.min(max, e));
  if (s > e) [s, e] = [e, s];
  return { start: s, end: e };
}


// --- Module: utils/export.js ---
/**
 * @file export.js
 * @description Export utilities for researcher data (Markdown, BibTeX)
 */


/**
 * Export all researcher notes as a single Markdown file.
 */
function generateEntityJsonLd(item, type) {
  if (!item) return '';
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "name": item.head || item.name,
    "description": item.description,
    "inDefinedTermSet": "https://zaliznyak.philology.ru/corpus",
    "termCode": `${type}:${item.head}`
  };
  return JSON.stringify(ld, null, 2);
}

export async function exportAllNotesMarkdown() {
  const notes = await getAllNotes();
  if (!notes || notes.length === 0) {
    alert('Нет заметок для экспорта.');
    return;
  }
  
  let md = `# Исследовательские заметки: Zalizniakiada\n\n`;
  md += `Дата экспорта: ${new Date().toLocaleDateString()}\n\n---\n\n`;
  
  notes.forEach(note => {
    const [type, head] = note.id.split(':');
    md += `## [${type}] ${head}\n\n`;
    md += `${note.text}\n\n`;
    md += `*Обновлено: ${new Date(note.updatedAt).toLocaleString()}*\n\n---\n\n`;
  });
  
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zalizniakiada_research_notes_${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCurrentCardMarkdown() {
  // logic to export single card...
}


// --- Module: core/search.js ---
/**
 * @file search.js
 * @description Intellectual Search v13.1 - Fuzzy matching and morphological normalization
 */



let globalSearchWorker = null;
let globalSearchWorkerReady = false;

/**
 * Perform an intellectual search across all entity categories.
 * Uses stemming and fuzzy matching for better results.
 */
function intellectualSearch(query) {
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

function initSearchWorker() {
  // Worker integration logic...
  console.log('[Search] Intellectual Engine initialized');
}


// --- Module: core/router.js ---
/**
 * @file router.js
 * @description Routing and hash management for BookIndex v13.0
 */


  currentTab, 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  rightPaneMode,
  searchQuery
} from './state.js';

function parseHashRoute(hash) {
  if (!hash || typeof hash !== 'string') return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return null;
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'v4') return null;
  return { parts: parts.slice(1), query };
}

function buildHashFromState() {
  const parts = ['v4', currentEntity, currentTab];
  if (selectedItem && selectedItemType) {
    parts.push('item', selectedItemType, encodeURIComponent(selectedItem));
  } else if (searchQuery && currentTab === 'list') {
    parts.push('q', encodeURIComponent(searchQuery));
  }
  return '#' + parts.join('/');
}

function syncNavigationState() {
  // Logic to sync internal state to window.location.hash
  if (typeof window === 'undefined') return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

function applyHash(hash) {
  const parsed = parseHashRoute(hash);
  if (!parsed) return false;
  // Implementation of state application...
  // This will be expanded as we modularize more components.
  return true;
}


// --- Module: renderers/scholar.js ---
/**
 * @file scholar.js
 * @description Renderers for the Professional Apparatus (Scholar) section
 */







  APP_DATA, 
  currentVizModule, 
  ensureVizStateLoaded, 
  ensureVizModuleLoaded, 
  warmupVizCacheInWorker, 
  cleanupActiveVizModule,
  getVizRegistry,
  buildVizHash,
  buildCorpusVizHash,
  getActiveBook,
  syncNavigationHashOnly
} from '../core/state.js';

function renderScholarDashboard(container) {
  container.innerHTML = `
    <div class="panel active scholar-dashboard">
      <h2 class="scholar-title">Аппарат исследователя</h2>
      <div class="scholar-grid">
        <div class="scholar-card">
          <h3>Дневник исследователя (v13.1)</h3>
          <p>Все ваши заметки сохраняются локально в базе данных IndexedDB. Вы можете выгрузить их в единый Markdown-файл для дальнейшей работы.</p>
          <button id="export-all-notes" class="intro-btn" style="width:100%; padding:1rem;">📂 Скачать дневник исследования (.md)</button>
        </div>
        <div class="scholar-card">
          <h3>Профессиональные инструменты</h3>
          <ul class="scholar-tools-list">
            <li><a href="#v4/scholar/chronology" class="related-link">Лента открытий</a></li>
            <li><a href="#v4/scholar/trends" class="related-link">Тренды упоминаний</a></li>
            <li><a href="#v4/scholar/bib" class="related-link">Указатель источников</a></li>
            <li><a href="#v4/scholar/topics" class="related-link">Тематические кластеры</a></li>
            <li><a href="#v4/scholar/hubs" class="related-link">Хабы знаний</a></li>
            <li><a href="#v4/scholar/quiz" class="related-link">Квиз и тренажер</a></li>
          </ul>
        </div>
      </div>
    </div>
  `;
  
  const exportBtn = container.querySelector('#export-all-notes');
  if (exportBtn) {
    exportBtn.onclick = () => exportAllNotesMarkdown();
  }
}

function renderBibliographyIndex(container) {
  const index = buildBibliographyIndex();
  
  container.innerHTML = `
    <div class="panel active bibliography-panel">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 class="scholar-title">Указатель источников</h2>
        <button id="export-bibtex" class="viz-btn">Экспорт BibTeX</button>
      </div>
      <div class="bib-grid">
        ${Array.from(index.entries()).map(([cite, data]) => `
          <div class="bib-item">
            <div class="bib-cite">${escapeHtml(cite)}</div>
            <div class="bib-meta">Упоминаний: ${data.citing_items.length}</div>
            <div class="bib-citing-list">
              ${data.citing_items.slice(0, 5).map(it => `
                <a href="#v4/list/${it.type}/${it.head}" class="bib-link">${escapeHtml(it.head)}</a>
              `).join(', ')}
              ${data.citing_items.length > 5 ? '...' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const exportBtn = container.querySelector('#export-bibtex');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const bibtex = exportBibliographyBibTeX();
      alert('BibTeX сформирован (проверьте консоль)');
      console.log(bibtex);
    };
  }
}

function renderTopicClusters(container) {
  const clusters = buildTopicClusters();
  
  container.innerHTML = `
    <div class="panel active analytics-panel">
      <h2 class="scholar-title">Дальнее чтение: тематические кластеры (v16.0)</h2>
      <p class="panel-desc">Алгоритм автоматически сгруппировал термины на основе лексического сходства их описаний.</p>
      <div class="cluster-grid">
        ${clusters.map(([stem, items]) => `
          <div class="cluster-card">
            <div class="cluster-tag">Тема: #${escapeHtml(stem)}</div>
            <div class="cluster-items">
              ${items.map(it => `<span class="cluster-item">${escapeHtml(it)}</span>`).join(', ')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderKnowledgeHubs(container) {
  const hubs = calculateCentrality();
  
  container.innerHTML = `
    <div class="panel active analytics-panel">
      <h2 class="scholar-title">Хабы знаний: сетевой анализ (v16.1)</h2>
      <p class="panel-desc">Рейтинг терминов по количеству их перекрестных связей в корпусе. Это «узловые» понятия, связывающие разные разделы книги.</p>
      <div class="hubs-list">
        ${hubs.map(([head, score], i) => `
          <div class="hub-item">
            <span class="hub-rank">#${i + 1}</span>
            <span class="hub-name">${escapeHtml(head)}</span>
            <div class="hub-bar-container">
              <div class="hub-bar" style="width: ${Math.min(100, score * 10)}%"></div>
            </div>
            <span class="hub-score">${score} связей</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderQuiz(container, levelId = 1) {
  const level = QUIZ_LEVELS.find(l => l.id === levelId);
  
  container.innerHTML = `
    <div class="panel active quiz-panel">
      <h2 class="scholar-title">Лингвистический тренажер: ${escapeHtml(level.title)}</h2>
      <div class="quiz-progress">Уровень ${levelId} из ${QUIZ_LEVELS.length}</div>
      <div class="quiz-question-list">
        ${level.questions.map((q, qIdx) => `
          <div class="quiz-card" id="q-${qIdx}">
            <p class="quiz-text">${escapeHtml(q.text)}</p>
            <div class="quiz-options">
              ${q.options.map((opt, oIdx) => `
                <button class="viz-btn quiz-opt" onclick="handleQuizAnswer(${levelId}, ${qIdx}, ${oIdx})">${escapeHtml(opt)}</button>
              `).join('')}
            </div>
            <div class="quiz-feedback" id="feedback-${qIdx}"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}


// --- Module: renderers/lists.js ---
/**
 * @file lists.js
 * @description Renderers for navigation switchers and entity lists
 */


  APP_DATA, 
  currentEntity, 
  currentTab,
  searchQuery,
  MAX_LIST_QUERY_LENGTH,
  LABELS,
  ENTITY_TYPES,
  TAB_LABELS
} from '../core/state.js';

  escapeHtml, 
  bindActionWithKeyboard,
  safeSetAttr 
} from '../utils/dom.js';

  normalizeHeadForMatch, 
  clampUiInput, 
  compareHeadsRu 
} from '../utils/linguistics.js';

// --- External References ---
/* global cleanupActiveVizModule, setMobileSheetOpen, renderHomePanel, 
   renderCorpusSourcesPanel, renderLecturesPanel, renderScholarPanel, 
   renderListPanel, renderCardsPanel, syncNavigationState, selectListItem,
   renderList, renderRightContent, getVisibleItemsForCurrentEntity,
   persistViewState, invalidateVisibleItemsCache, navigateToItem,
   getIndexedItem, exportCurrentSectionMarkdown, closeMobileSheet,
   getCategoryColorClass, activeFilters, onlyDiscussed, onlyQuestionCandidates,
   sortMostFrequentFirst, getItemFrequencyScore, compareItemsByHead,
   renderAccentSafe */

function renderEntitySwitcher() {
  const container = document.getElementById('entity-switcher');
  if (!container) return;
  container.innerHTML = '';
  
  const order = ['corpus', 'materials', 'scholar', 'all', 'subject', 'names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse'];
  order.forEach(key => {
    const conf = ENTITY_TYPES[key];
    if (!conf) return;
    const btn = document.createElement('button');
    btn.className = 'entity-btn' + (key === currentEntity ? ' active' : '');
    btn.dataset.entity = key;
    btn.textContent = conf.title;
    container.appendChild(btn);
  });
}

function renderTabs() {
  const container = document.getElementById('tabs');
  if (!container) return;
  container.innerHTML = '';
  
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !conf.tabs) return;
  
  conf.tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (tab === currentTab ? ' active' : '');
    btn.dataset.tab = tab;
    btn.textContent = TAB_LABELS[tab] || tab;
    container.appendChild(btn);
  });
}

function renderListPanel(container) {
  container.innerHTML = `
    <div class="panel active">
      <div class="list-card-layout">
        <div class="left-pane">
          <div class="filters">
            <input type="text" id="search-input" value="${escapeHtml(searchQuery)}" placeholder="Поиск...">
          </div>
          <div class="name-list" id="name-list"></div>
        </div>
        <div class="right-pane">
          <div id="right-pane-content"></div>
        </div>
      </div>
    </div>
  `;
  
  const searchInput = container.querySelector('#search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const results = intellectualSearch(e.target.value);
      const listEl = container.querySelector('#name-list');
      if (listEl) {
        listEl.innerHTML = results.map(r => `
          <div class="name-item" data-head="${escapeHtml(r.item.head)}" data-type="${r.type}">
            <div class="head">${escapeHtml(r.item.head)}</div>
            <div class="entity-type-tag">${r.type}</div>
          </div>
        `).join('');
      }
    };
  }
}


// --- Module: renderers/cards.js ---
/**
 * @file cards.js
 * @description Renderers for individual entity cards and details
 */


  APP_DATA, 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  scholarPins,
  LABELS,
  COLORS,
  EPOCH_LABELS,
  MAX_LIST_QUERY_LENGTH
} from '../core/state.js';

  escapeHtml, 
  safeUrl, 
  safeImageUrl, 
  bindActionWithKeyboard,
  announceUiMessage 
} from '../utils/dom.js';

  sortUniquePages, 
  clampUiInput, 
  clampPageInBook 
} from '../utils/linguistics.js';

  getActiveBook, 
  getBookLabelForSearch 
} from '../core/data.js';




function renderGloss(text, gloss) {

function renderGloss(text, gloss) {
  const pairs = parseLeipzigGloss(text, gloss);
  if (!pairs) return '';
  return `
    <div class="interlinear-gloss">
      ${pairs.map(p => `
        <div class="gloss-pair">
          <div class="gloss-word">${escapeHtml(p.text)}</div>
          <div class="gloss-label">${escapeHtml(p.gloss)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// --- External References ---
/* global findItemByHeadAndType, getRightContentHost, getFirstContextQuote,
   buildCardPageLinksHtml, countItemContexts, buildLecturePageBreakdownHtml,
   renderAccentSafe, togglePin, navigateCardByDelta, exportCurrentCardMarkdown,
   copyCurrentUrl, openReadingNowPage, openKwicTerm, buildCardSourceBibEntry,
   slugify, downloadBibtexFile, openGlossaryTerm, openLecturePage,
   findLectureIndexByName, buildLecturePageHash, findRelatedGlossaryTerms,
   buildGlossaryTermHash, getSubjectByLexiconIndex, buildItemHash,
   openVideoPlayer, seekVideo, findEntityTypeByHead, collectNameRelationLinks,
   getCardNavigationState, renderList, renderRightContent, syncNavigationState,
   switchTab, getCardNote, saveCardNote, renderContextTextWithLinks,
   wireSafeImageFallback, bindNavigateLinks, pluralPages */

function renderCardInRight() {
  const right = typeof getRightContentHost === 'function' ? getRightContentHost() : document.getElementById('right-pane-content');
  if (!right) return;
  
  const it = typeof findItemByHeadAndType === 'function' 
    ? findItemByHeadAndType(selectedItem, selectedItemType)
    : (APP_DATA[selectedItemType] || []).find(x => x.head === selectedItem);

  if (!it) {
    right.innerHTML = '<div class="card"><div class="card-missing-message">Элемент не найден</div></div>';
    return;
  }

  const photo = it.img ? `<img class="card-photo" src="${escapeHtml(safeImageUrl(it.img))}" alt="">` : '';
  const wikiLink = it.wiki ? `<a class="wiki-link" href="${escapeHtml(safeUrl(it.wiki))}" target="_blank" rel="noopener noreferrer">Статья в Википедии →</a>` : '';
  const eType = it._entityType || currentEntity;
  const editorial = (it.editorial_flags && typeof it.editorial_flags === 'object') ? it.editorial_flags : {};
  
  let category = '';
  if (eType === 'names') category = LABELS[it.subcategory] || 'Имя';
  else if (eType === 'toponyms') category = 'Топоним';
  else if (eType === 'languages') category = 'Язык';
  else category = LABELS[eType] || eType;

  const itemBookId = String(it.book_id || it.bookId || getActiveBook().book_id || '');
  const itemBookLabel = getBookLabelForSearch(itemBookId);
  const allPages = sortUniquePages(it.page_list || []);
  
  let html = `
    <div class="card">
      <div class="card-header">
        ${photo}
        <div class="card-title-block">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h2>${escapeHtml(it.head)}</h2>
            <button id="card-pin-btn" class="pin-btn${scholarPins.has(`${eType}:${it.head}`) ? ' active' : ''}" 
                    onclick="togglePin('${escapeHtml(it.head)}', '${eType}')">📌</button>
          </div>
          <div class="category">${escapeHtml(category)}</div>
          <div class="card-meta-chips">
            <span class="card-book-chip">${escapeHtml(itemBookLabel)}</span>
          </div>
          ${wikiLink}
        </div>
      </div>
      <div class="pages-info">
        <strong>Упоминается на ${allPages.length} страницах:</strong>
        <span class="pages-links">${allPages.join(', ')}</span>
      </div>
      <div id="card-dynamic-content"></div>
    </div>
  `;
  
  right.innerHTML = html;
  
  // RESEARCHER NOTE (Async)
  const noteId = `${eType}:${it.head}`;
  const dynamicContent = right.querySelector('#card-dynamic-content');
  getNote(noteId).then(noteText => {
    if (dynamicContent) {
      dynamicContent.innerHTML = `
        <div class="card-note-section">
          <div class="card-note-header">Исследовательские заметки</div>
          <textarea class="card-note-textarea" placeholder="Ваши мысли об этом элементе...">${escapeHtml(noteText)}</textarea>
        </div>
      `;
      const textarea = dynamicContent.querySelector('.card-note-textarea');
      textarea.oninput = (e) => saveNote(noteId, e.target.value);
      
      // AI INSIGHT (v15.0)
      const insights = getLinguisticInsight(it.head, eType);
      const aiDiv = document.createElement('div');
      aiDiv.className = 'ai-insight-box';
      aiDiv.innerHTML = `
        <div class="ai-insight-header">✨ AI Insight (v15.0)</div>
        <ul class="ai-insight-list">
          ${insights.map(ins => `<li>${escapeHtml(ins)}</li>`).join('')}
        </ul>
      `;
      dynamicContent.appendChild(aiDiv);
      
      // JSON-LD (v16.2 Semantic Web)
      let ldScript = document.getElementById('entity-jsonld');
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.id = 'entity-jsonld';
        ldScript.type = 'application/ld+json';
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = generateEntityJsonLd(it, eType);
    }
  });
  
  // Wire up actions
  const pinBtn = right.querySelector('#card-pin-btn');
  if (pinBtn) {
    pinBtn.onclick = () => {
      if (typeof togglePin === 'function') togglePin(it.head, eType);
    };
  }
}

function renderCardsPanel(container) {
  const items = (APP_DATA[currentEntity] || []);
  container.innerHTML = '<div class="panel active"><div class="cards-grid" id="cards-grid"></div></div>';
  const grid = container.querySelector('#cards-grid');
  
  items.slice(0, 100).forEach(it => {
    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <div class="mc-head">${escapeHtml(it.head)}</div>
      <div class="mc-pages">стр. ${it.page_list ? it.page_list[0] : '—'}</div>
    `;
    card.onclick = () => {
      // Navigation logic
    };
    grid.appendChild(card);
  });
}


// --- Module: renderers/home.js ---
/**
 * @file home.js
 * @description Renderers for the landing page and welcome dashboards
 */




// --- External References ---
/* global buildHomeHowToGuideHtml, getTotalBookPages, renderTextWithPageLinks,
   loadRecentItems, buildItemHash, findLectureIndexByName, openLecturePage,
   navigateToItem, renderEntitySwitcher, renderTabs, renderContent,
   syncNavigationState, exportWholeSiteMarkdown, HOME_DECL_FACTORY_KEY,
   syncNavigationHashOnly, bindNavigateLinks */

function renderHomePanel(container) {
  const stats = APP_DATA.book_stats || {};
  const routes = APP_DATA.routes || [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const totalPages = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
  
  let html = `<div class="panel active home-panel"><div class="home-panel-inner">`;

  // Stats Hero
  html += `<div class="home-stats-hero">
    <div class="home-stats-head">
      <h2 class="home-stats-title">Книга в цифрах</h2>
      <button id="export-site-md" class="home-export-btn">Экспорт всего BookIndex в Markdown</button>
    </div>
    <div class="home-stats-subtitle">Что внутри ${escapeHtml(String(totalPages))} страниц лекций А. А. Зализняка</div>
    <div id="home-stats-grid" class="home-stats-grid">`;

  const statsList = [
    [String(totalPages), 'страницы'],
    [stats.lectures || '10', 'лекций'],
    [stats.names || '0', 'имён'],
    [stats.languages || '0', 'языков'],
    [stats.toponyms || '0', 'топонимов'],
    [stats.lexicon ? stats.lexicon.toLocaleString('ru') : '0', 'лексем'],
  ];

  for (const [num, label] of statsList) {
    html += `<div class="home-stat-cell">
      <div class="home-stat-num">${num}</div>
      <div class="home-stat-label">${label}</div>
    </div>`;
  }
  html += '</div></div>';

  // Routes
  html += `<h2 class="home-routes-title">Выберите свой путь по книге</h2>
    <div class="home-routes-grid">`;
  for (const r of routes) {
    html += `<div class="home-route-card">
      <div class="home-route-head">
        <div class="home-route-title">${escapeHtml(r.title)}</div>
        <div class="home-route-icon">${safeIcon(r.icon)}</div>
      </div>
      <div class="home-route-desc">${escapeHtml(r.desc)}</div>
      <div class="home-route-links">`;
    for (const e of r.entities || []) {
      html += `<a class="route-link home-route-link" data-type="${escapeHtml(e.type)}" data-head="${escapeHtml(e.head)}" href="${escapeHtml(buildItemHash(e.type, e.head))}">${escapeHtml(e.head)}</a>`;
    }
    html += '</div></div>';
  }
  html += '</div>';

  html += '</div></div>';
  container.innerHTML = html;
  
  if (typeof bindNavigateLinks === 'function') {
    bindNavigateLinks(container, '.route-link', 'all');
  }
  
  const exportBtn = document.getElementById('export-site-md');
  if (exportBtn && typeof exportWholeSiteMarkdown === 'function') {
    exportBtn.onclick = () => exportWholeSiteMarkdown();
  }
}

function renderHomePanelDeclarative(container) {
  // Logic for Alpine.js based home page
  // (Will be implemented in the bundle or as a separate module if needed)
}


// --- Module: renderers/materials.js ---
/**
 * @file materials.js
 * @description Renderers for the core book materials (Lectures, Glossary, Reading)
 */


  APP_DATA, 
  currentTab, 
  currentEntity, 
  currentLecture, 
  currentGlossaryTerm,
  trendsRangeStart,
  trendsRangeEnd 
} from '../core/state.js';


// --- External References ---
/* global getTotalBookPages, wireReadingNowWidget, openLecturePage, 
   buildLectureTermHash, openLectureTerm, openGlossaryTerm, buildItemHash,
   buildLecturePageHash, switchTab, collectFurtherReadingBibEntries,
   downloadBibtexFile, announceUiMessage, persistViewState, getItemsForChapter,
   compareHeadsRu, buildReadingNowHash, saveReadingPage, syncNavigationState,
   renderEntitySwitcher, renderTabs, renderContent, navigateToItem */

function renderLecturesPanel(container) {
  const lectures = APP_DATA.lectures || [];
  const totalPages = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
  
  let html = '<div class="panel active lectures-panel"><div class="lectures-inner">';
  html += '<h2 class="lectures-title">Все лекции книги — за пять минут</h2>';
  html += '<div class="lectures-intro">Краткие резюме лекций. Нажмите карточку для подробностей.</div>';
  
  // Reading Now Widget
  html += `<div class="reading-now-box">
    <div class="reading-now-title">Режим «Читаю сейчас»</div>
    <div class="reading-now-controls">
      <button id="reading-page-prev" class="reading-now-btn">←</button>
      <input id="reading-page-input" class="reading-now-input" type="number" min="1" max="${totalPages}" value="1" />
      <button id="reading-page-next" class="reading-now-btn">→</button>
      <button id="reading-page-go" class="reading-now-btn">Показать</button>
    </div>
    <div id="reading-now-results" class="reading-now-results"></div>
  </div>`;

  html += '<div id="lectures-grid" class="lectures-grid">';
  lectures.forEach((l, i) => {
    html += `<div class="lecture-card" data-idx="${i}">
      <div class="lecture-card-meta">Лекция ${i} · стр. ${escapeHtml(l.pages)}</div>
      <div class="lecture-card-title">${escapeHtml(l.name)}</div>
      <div class="lecture-card-idea">${escapeHtml(l.main_idea)}</div>
    </div>`;
  });
  html += '</div></div></div>';
  
  container.innerHTML = html;
  
  if (typeof wireReadingNowWidget === 'function') {
    wireReadingNowWidget(container, totalPages);
  }
  
  container.querySelectorAll('.lecture-card').forEach(card => {
    card.onclick = () => {
      if (typeof openLecturePage === 'function') {
        openLecturePage(parseInt(card.dataset.idx || '0', 10));
      }
    };
  });
}

function renderGlossaryPanel(container) {
  const glossary = APP_DATA.glossary || [];
  let html = '<div class="panel active glossary-panel"><div class="glossary-inner">';
  html += '<h2 class="glossary-title">Глоссарий</h2>';
  html += '<div id="glossary-list" class="glossary-list">';
  glossary.forEach(g => {
    html += `<div class="glossary-entry" data-term="${escapeHtml(g.term.toLowerCase())}">
      <div class="glossary-entry-head">${escapeHtml(g.term)}</div>
      <div class="glossary-definition">${escapeHtml(g.definition)}</div>
    </div>`;
  });
  html += '</div></div></div>';
  container.innerHTML = html;
}


// --- Module: renderers/multimedia.js ---
/**
 * @file multimedia.js
 * @description Renderers for the Video Archive and YouTube player integration
 */



let ytPlayer = null;

function openVideoPlayer(videoId) {
  const v = (APP_DATA.video_catalog || []).find(x => x.id === videoId);
  if (!v) return;
  
  const modal = document.getElementById('video-player-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  
  const ytId = v.url.split('v=')[1];
  const tcList = document.getElementById('video-modal-tc-list');
  if (tcList) {
    tcList.innerHTML = v.timecodes.map(tc => {
      const minutes = Math.floor(tc.time / 60);
      const seconds = String(tc.time % 60).padStart(2, '0');
      return `<div class="video-modal-tc-item" onclick="seekVideo(${tc.time})">
        <div style="font-weight:700; color:#80deea;">${minutes}:${seconds}</div>
        <div style="font-size:0.85rem; color:#ccc;">${escapeHtml(tc.label)}</div>
      </div>`;
    }).join('');
  }

  if (typeof YT !== 'undefined' && YT.Player) {
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      ytPlayer.loadVideoById(ytId);
    } else {
      ytPlayer = new YT.Player('yt-player-container', {
        height: '100%',
        width: '100%',
        videoId: ytId,
        playerVars: { 'autoplay': 1, 'modestbranding': 1 }
      });
    }
  } else {
    const container = document.getElementById('yt-player-container');
    if (container) {
      container.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${ytId}?autoplay=1" frameborder="0" allowfullscreen></iframe>`;
    }
  }
}

function seekVideo(seconds) {
  if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(seconds, true);
  }
}

function renderVideoArchivePanel(container) {
  const videos = APP_DATA.video_catalog || [];
  let html = `<div class="panel active video-panel"><div class="video-inner">
    <h2 class="video-title">Видеоархив лекций А. А. Зализняка</h2>
    <div class="video-grid">`;
  
  videos.forEach(v => {
    const ytId = v.url.split('v=')[1];
    html += `
      <div class="video-card" onclick="openVideoPlayer('${v.id}')">
        <div class="video-thumb" style="background-image:url(https://img.youtube.com/vi/${ytId}/mqdefault.jpg);"></div>
        <div class="video-info">
          <div class="video-title">${escapeHtml(v.title)}</div>
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}


// --- Module: renderers/viz-panels.js ---
/**
 * @file viz-panels.js
 * @description Renderers for complex visualizations and linguistic dashboards (KWIC, Heatmap, Maps)
 */


  APP_DATA, 
  currentTab, 
  currentEntity, 
  currentVizModule,
  currentKwicQuery,
  currentKwicSource,
  currentKwicSort,
  currentKwicPageStart,
  currentKwicPageEnd,
  MAX_LIST_QUERY_LENGTH,
  KWIC_MAX_ROWS
} from '../core/state.js';

  escapeHtml, 
  safeUrl, 
  safeImageUrl, 
  bindActionWithKeyboard 
} from '../utils/dom.js';

  getBookLabelForSearch 
} from '../core/data.js';

  normalizeHeadForMatch, 
  compareHeadsRu, 
  clampUiInput, 
  normalizePageRangeInBook 
} from '../utils/linguistics.js';

// --- External References ---
/* global getTotalBookPages, normalizeKwicSource, normalizeKwicSort, 
   buildReadingNowHash, collectLexiconContextBundles, buildKwicContextRow,
   collectMatchingGlossaryTerms, navigateToItem, openGlossaryTerm, openReadingNowPage,
   persistViewState, getVizModuleCatalog, cleanupActiveVizModule,
   buildVizHash, buildCorpusVizHash, mountVizModule, syncNavigationHashOnly,
   buildItemHash, wireSafeImageFallback, clampPageInBook */

function collectLexiconKwicRows(query, pageStart, pageEnd) {
  const q = clampUiInput(query, MAX_LIST_QUERY_LENGTH);
  const qNorm = normalizeHeadForMatch(q);
  if (qNorm.length < 2) return [];
  const rows = [];
  rows._truncated = false;
  
  // Logic from v3_app.js
  const bundles = typeof collectLexiconContextBundles === 'function' ? collectLexiconContextBundles(pageStart, pageEnd) : [];
  for (const bundle of bundles) {
    for (const entry of bundle.entries) {
      for (const raw of entry.snippets) {
        const snippetNorm = normalizeHeadForMatch(raw);
        if (!snippetNorm.includes(qNorm)) continue;
        const row = typeof buildKwicContextRow === 'function' ? buildKwicContextRow({
          source: 'lexicon',
          term: bundle.itemHead,
          itemType: 'lexicon',
          itemHead: bundle.itemHead,
          page: entry.page,
          snippet: raw,
          query: q,
        }) : null;
        if (row) rows.push(row);
        if (rows.length >= KWIC_MAX_ROWS) {
          rows._truncated = true;
          return rows;
        }
      }
    }
  }
  return rows;
}

function renderRetrogradeSuffixTree(container) {
  const lexicon = APP_DATA.lexicon || [];
  const suffixMap = new Map();
  
  // Group words by last 3 characters
  lexicon.forEach(it => {
    const head = it.head || '';
    const suffix = head.slice(-3).toLowerCase();
    if (suffix.length < 2) return;
    if (!suffixMap.has(suffix)) suffixMap.set(suffix, []);
    suffixMap.get(suffix).push(head);
  });
  
  const sorted = Array.from(suffixMap.entries())
    .filter(e => e[1].length > 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);
    
  container.innerHTML = `
    <div class="viz-card">
      <h3>Ретроградный анализ суффиксов (v14.0)</h3>
      <div class="suffix-grid">
        ${sorted.map(([suf, words]) => `
          <div class="suffix-group">
            <div class="suffix-label">-${escapeHtml(suf)} (${words.length})</div>
            <div class="suffix-words">${words.slice(0, 5).join(', ')}...</div>
          </div>
      </div>
    </div>
  `;
}

function renderEtymoFlow(container, itemHead) {
  const item = (APP_DATA.lexicon || []).find(it => it.head === itemHead);
  if (!item || !item.etymology_chain) {
    container.innerHTML = '<div class="panel-muted-message">Этимологическая цепочка для данного элемента не найдена.</div>';
    return;
  }
  
  const chain = item.etymology_chain;
  
  container.innerHTML = `
    <div class="etymo-flow">
      <h3>Развитие формы: ${escapeHtml(itemHead)}</h3>
      <div class="etymo-timeline">
        ${chain.map((step, i) => `
          <div class="etymo-step">
            <div class="etymo-stage">${escapeHtml(step.stage)}</div>
            <div class="etymo-arrow">↓</div>
            <div class="etymo-form">${escapeHtml(step.form)}</div>
            <div class="etymo-desc">${escapeHtml(step.desc || '')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderKwicPanel(container) {
  const totalPages = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
  
  container.innerHTML = `<div class="panel active kwic-panel">
    <div class="kwic-inner">
      <h2 class="kwic-title">KWIC-конкорданс</h2>
      <div class="kwic-controls">
        <label class="kwic-field">Запрос
          <input id="kwic-query" type="text" value="${escapeHtml(currentKwicQuery || '')}" class="kwic-input">
        </label>
        <button id="kwic-run" type="button" class="kwic-run-btn">Показать</button>
      </div>
      <div id="kwic-results" class="kwic-results"></div>
    </div>
  </div>`;
  
  const resultsEl = container.querySelector('#kwic-results');
  const runBtn = container.querySelector('#kwic-run');
  
  const renderRows = () => {
    const query = container.querySelector('#kwic-query').value;
    const sortBy = container.querySelector('#kwic-sort').value; // "left" or "right"
    let rows = collectLexiconKwicRows(query, currentKwicPageStart, currentKwicPageEnd);
    
    // N-Gram Sorting (v16.3)
    if (sortBy === 'left') {
      rows.sort((a, b) => (a.leftText.split(' ').pop() || '').localeCompare(b.leftText.split(' ').pop() || ''));
    } else if (sortBy === 'right') {
      rows.sort((a, b) => (a.rightText.split(' ')[0] || '').localeCompare(b.rightText.split(' ')[0] || ''));
    }

    resultsEl.innerHTML = rows.map(r => `
      <div class="kwic-row">
        <div class="kwic-row-head"><strong>${escapeHtml(r.itemHead)}</strong> (стр. ${r.page})</div>
        <div class="kwic-context">${escapeHtml(r.leftText)}<mark>${escapeHtml(r.keyText)}</mark>${escapeHtml(r.rightText)}</div>
      </div>
    `).join('');
  };
  
  container.querySelector('.kwic-controls').innerHTML += `
    <select id="kwic-sort" class="kwic-select">
      <option value="none">Без сортировки</option>
      <option value="left">Сортировка по слову СЛЕВА</option>
      <option value="right">Сортировка по слову СПРАВА</option>
    </select>
  `;
  
  if (runBtn) runBtn.onclick = renderRows;
}

function renderIsoglossMap(container, featureId) {
  container.innerHTML = `
    <div class="viz-card map-viz">
      <h3>Ареальная карта изоглосс (v14.0)</h3>
      <div class="map-placeholder" style="background:#e0f2f1; height:400px; position:relative; border-radius:12px; overflow:hidden;">
        <svg width="100%" height="100%" viewBox="0 0 800 400">
          <path d="M100,100 Q200,50 400,100 T700,100 L700,300 Q400,350 100,300 Z" fill="#b2dfdb" />
          <path d="M200,150 Q300,120 400,150 T500,200 L450,250 Q300,280 200,250 Z" 
                fill="rgba(255,82,82,0.3)" stroke="#ff5252" stroke-width="2" stroke-dasharray="4 2" />
          <text x="350" y="200" fill="#d32f2f" font-weight="700">Зона распространения: ${escapeHtml(featureId)}</text>
        </svg>
      </div>
      <p style="font-size:0.85rem; color:#666; margin-top:1rem;">Пунктирная линия обозначает границу (изоглоссу) лингвистического явления.</p>
    </div>
  `;
}


// --- Module: entry.js ---
/**
 * @file entry.js
 * @description Application entry point and initialization logic for BookIndex v13.0
 */








/* global parseAppData, syncNavigationState, initScholarWorkspace, initCardNotes,
   initPremiumIntro, injectSemanticStyles */

function initApp() {
  console.log('🚀 Zalizniakiada v13.0 initializing...');
  
  try {
    // 1. Hydrate Data
    const data = typeof parseAppData === 'function' ? parseAppData() : null;
    if (data) {
      setAppData(data);
      migrateAppDataSchema(data);
    }
    
    // 2. Initialize Core Systems
    initSearchWorker();
    if (typeof initScholarWorkspace === 'function') initScholarWorkspace();
    if (typeof initCardNotes === 'function') initCardNotes();
    if (typeof initPremiumIntro === 'function') initPremiumIntro();
    if (typeof injectSemanticStyles === 'function') injectSemanticStyles();
    
    // 3. Routing & Gamification
    window.addEventListener('hashchange', () => {
      if (applyHash(window.location.hash)) {
        renderEntitySwitcher();
        renderTabs();
        renderContent();
      }
    });

    // Secret: App Opened
    checkAchievements('app_opened').then(newUnlocks => {
      newUnlocks.forEach(a => announceAchievement(a));
    });

    // Secret: Easter Egg
    const versionEl = document.querySelector('.footer-version');
    if (versionEl) {
      versionEl.onclick = () => {
        checkAchievements('easter_egg_clicked').then(newUnlocks => {
          newUnlocks.forEach(a => announceAchievement(a));
        });
      };
    }
    
    // 4. Initial Render
    applyHash(window.location.hash || '#v4/home/home');
    renderEntitySwitcher();
    renderTabs();
    renderContent();
    
    console.log('✅ Zalizniakiada v13.0 ready.');
  } catch (e) {
    console.error('❌ App initialization failed:', e);
  }
}

// Start the app
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}


})();
