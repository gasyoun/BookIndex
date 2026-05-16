/**
 * @file navigation.js
 * @description Navigation actions and state synchronization
 */

import { 
  APP_DATA,
  currentEntity,
  setCurrentEntity, 
  setCurrentTab, 
  setSelectedItem, 
  setSearchQuery, 
  ENTITY_TYPES,
  setCurrentLecture,
  setSelectedItemType,
  setRightPaneMode
} from './state.js';
import { syncNavigationState } from './router.js';
import { cleanupActiveVizModule } from './viz.js';

/**
 * Navigate to a specific entity category.
 */
export function navigateToEntity(entity) {
  if (!ENTITY_TYPES[entity]) return;
  setCurrentEntity(entity);
  const defaultTab = ENTITY_TYPES[entity].tabs[0];
  setCurrentTab(defaultTab);
  setSelectedItem(null);
  setSearchQuery('');
  
  cleanupActiveVizModule();
  syncNavigationState();
  
  // Note: render functions are called by the hashchange listener in entry.js
}

/**
 * Navigate to a specific tab within the current entity.
 */
export function navigateToTab(tab) {
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !conf.tabs.includes(tab)) return;
  
  setCurrentTab(tab);
  syncNavigationState();
}

/**
 * Global back button handler.
 */
export function navigateBack() {
  if (typeof window !== 'undefined' && window.history) {
    window.history.back();
  }
}

/**
 * Open a specific lecture page.
 */
export function openLecturePage(index) {
  const idx = Math.max(0, index);
  setCurrentEntity('materials');
  setCurrentTab('lecture_pages');
  setCurrentLecture(idx);
  
  syncNavigationState();
}

/**
 * Open a specific glossary term.
 */
export function openLectureTerm(term) {
  setCurrentEntity('materials');
  setCurrentTab('glossary');
  setSearchQuery(term.toLowerCase());
  
  syncNavigationState();
}

/**
 * Navigate to a specific item and show its card.
 */
export function navigateToItem(type, head) {
  setSelectedItem(head);
  setSelectedItemType(type);
  setRightPaneMode('card');
  setCurrentTab('list'); // Usually cards are viewed in the list tab's right pane
  
  syncNavigationState();
}

/**
 * Filter the list by a specific chapter.
 */
export function filterByChapter(chapterName) {
  const ch = (APP_DATA.chapters || []).find(c => c.name === chapterName);
  if (!ch) return;
  const query = `@ch:"${chapterName}"`;
  setSearchQuery(query);
  
  syncNavigationState();
}

/**
 * Get items for a specific chapter/lecture.
 */
export function getItemsForChapter(type, chapter) {
  const items = ENTITY_TYPES[type]?.items || [];
  if (!chapter) return [];
  return items.filter(it => {
    const pages = it.page_list || [];
    return pages.some(p => p >= chapter.start && p <= chapter.end);
  });
}
