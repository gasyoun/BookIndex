/**
 * @file state.js
 * @description Core application state and constants for BookIndex v13.0
 */

// --- Constants ---
export const APP_DATA_SCRIPT_TAG_ID = 'app-data-json';
export const APP_DATA_GLOBAL_FALLBACK_KEY = '__APP_DATA_STRING__';
export const APP_DATA_SCHEMA_CURRENT = 2;

export const KWIC_MAX_SNIPPETS_PER_PAGE = 24;
export const KWIC_MAX_SNIPPET_LENGTH = 420;
export const KWIC_MAX_ROWS = 1200;

export const DEFAULT_TOTAL_PAGES = 424;
export const APP_BUILD_ID = '__APP_BUILD_ID__';

export const DESCRIPTION_FIELDS_WITH_NORMALIZED_YO = new Set([
  'desc', 'about', 'why', 'why_read', 'description', 
  'definition', 'main_idea', 'tagline', 'event'
]);

export const LECTURE_WHY_READ_BROTHER_BRAT =
  'Чтобы понять, почему «brother» и «брат» — родственники, а не дети «санскрита», и как это узнают ученые.';

export const HOME_DECL_FACTORY_KEY = '__bookindexHomeDeclarativeFactory';

// --- Mutable State (Global References) ---
export let APP_DATA = null;
export let LABELS = null;
export let COLORS = null;
export let EPOCH_LABELS = null;
export let EPOCH_COLORS = null;
export let FAMILY_COLORS = null;

// --- UI State ---
export let currentTab = 'home';
export let currentEntity = 'all';
export let searchQuery = '';
export let selectedItem = null;
export let selectedItemType = null;
export let rightPaneMode = 'histogram'; // 'card' or 'histogram'

export let scholarPins = new Set();
export let dossierMetadata = { title: '', description: '' };

export let currentVizModule = 'viz03';
export let currentVizQueryString = '';
export let currentVizCleanup = null;
export let vizCacheWarmPromise = null;
export let vizScriptLoadPromises = new Map();

export let trendsRangeStart = 1;
export let trendsRangeEnd = 424;

// --- Shared Constants for Entity Types ---
export const TAB_LABELS = {
  home: 'Обзор',
  list: 'Список',
  materials: 'Материалы',
  scholar: 'Аппарат',
  viz: 'Визуализация',
  corpus: 'Корпус'
};

export const ENTITY_TYPES = {
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
export function setAppData(data) {
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
