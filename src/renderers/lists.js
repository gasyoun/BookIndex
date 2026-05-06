/**
 * @file lists.js
 * @description Renderers for navigation switchers and entity lists
 */

import { 
  APP_DATA, 
  currentEntity, 
  currentTab,
  searchQuery,
  MAX_LIST_QUERY_LENGTH,
  LABELS,
  ENTITY_TYPES,
  TAB_LABELS
} from '../core/state.js';
import { 
  escapeHtml, 
  bindActionWithKeyboard,
  safeSetAttr 
} from '../utils/dom.js';
import { 
  normalizeHeadForMatch, 
  clampUiInput, 
  compareHeadsRu 
} from '../utils/linguistics.js';
import { intellectualSearch } from '../core/search.js';

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

export function renderEntitySwitcher() {
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

export function renderTabs() {
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

export function renderListPanel(container) {
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
