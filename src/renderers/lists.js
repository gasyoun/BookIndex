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
import { navigateToEntity, navigateToTab } from '../core/navigation.js';
import { 
  renderScholarPanel,
  renderScholarChronologyPanel,
  renderPageTrendsPanel
} from './scholar.js';
import { 
  renderLecturesPanel, 
  renderGlossaryPanel, 
  renderKwicPanel,
  renderFurtherReadingPanel,
  renderLectureComparePanel,
  renderLecturePagePanel
} from './materials.js';
import { renderHomePanel } from './home.js';
import { 
  renderCardsPanel, 
  renderHistogramPanel, 
  renderTimelinePanel, 
  renderHeatmapPanel 
} from './specialized.js';
import { renderGraphPanel, renderFamiliesPanel } from './graph.js';
import { renderRightContent } from './card.js';
import { renderMapPanel } from './geo.js';
import { renderTreePanel } from './tree.js';
import { 
  renderGalleryPanel,
  renderRussianEvolutionPanel,
  renderPhoneticLawsPanel
} from './linguistics_tools.js';
import { renderTasksPanel } from './tasks.js';
import { renderCorpusSourcesPanel } from './corpus.js';

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
  const fragment = document.createDocumentFragment();
  const order = ['materials', 'scholar', 'all', 'subject', 'names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech'];
  
  for (const key of order) {
    const conf = ENTITY_TYPES[key];
    if (!conf) continue;
    const btn = document.createElement('button');
    btn.className = `entity-btn ${currentEntity === key ? 'active' : ''}`;
    btn.id = `entity-btn-${key}`;
    btn.setAttribute('type', 'button');
    const count = Array.isArray(conf.items) ? conf.items.length : 0;
    btn.innerHTML = `${escapeHtml(conf.title)}${count > 0 ? `<span class="count">${count}</span>` : ''}`;
    btn.onclick = () => navigateToEntity(key);
    fragment.appendChild(btn);
  }
  container.replaceChildren(fragment);
}

export function renderTabs() {
  const container = document.getElementById('tabs');
  if (!container) return;
  const fragment = document.createDocumentFragment();
  const conf = ENTITY_TYPES[currentEntity];
  if (!conf || !conf.tabs) return;
  
  for (const tab of conf.tabs) {
    const btn = document.createElement('button');
    btn.className = `tab ${tab === currentTab ? 'active' : ''}`;
    btn.id = `tab-${tab}`;
    btn.setAttribute('type', 'button');
    btn.textContent = TAB_LABELS[tab] || tab;
    btn.onclick = () => navigateToTab(tab);
    fragment.appendChild(btn);
  }
  container.replaceChildren(fragment);
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
          <div id="right-content"></div>
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

const CONTENT_RENDERERS = {
  home: renderHomePanel,
  list: renderListPanel,
  sources: renderCorpusSourcesPanel,
  lectures: renderLecturesPanel,
  lecture_compare: renderLectureComparePanel,
  lecture_pages: renderLecturePagePanel,
  tasks: renderTasksPanel,
  further_reading: renderFurtherReadingPanel,
  glossary: renderGlossaryPanel,
  kwic: renderKwicPanel,
  gallery: renderGalleryPanel,
  russian_evolution: renderRussianEvolutionPanel,
  phonetic_laws: renderPhoneticLawsPanel,
  scholar: renderScholarPanel,
  chronology: renderScholarChronologyPanel,
  page_trends: renderPageTrendsPanel,
  cards: renderCardsPanel,
  histogram: renderHistogramPanel,
  timeline: renderTimelinePanel,
  heatmap: renderHeatmapPanel,
  graph: renderGraphPanel,
  map: renderMapPanel,
  families: renderFamiliesPanel,
  tree: renderTreePanel
};

/**
 * Main content dispatcher.
 */
export function renderContent() {
  const container = document.getElementById('content');
  if (!container) return;
  
  // Choose renderer based on current tab or entity
  // In v4 architecture, the 'tab' is the primary key for the renderer
  const renderer = CONTENT_RENDERERS[currentTab];
  
  if (renderer) {
    renderer(container);
  } else {
    // Fallback for missing renderers
    container.innerHTML = `<div class="panel active">
      <h2>${escapeHtml(ENTITY_TYPES[currentEntity]?.title || currentEntity)} - ${escapeHtml(TAB_LABELS[currentTab] || currentTab)}</h2>
      <p class="panel-muted-message">Этот раздел находится в разработке или был перемещен.</p>
    </div>`;
  }
  
  // Update right pane
  renderRightContent();
}
