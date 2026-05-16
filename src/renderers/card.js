/**
 * @file card.js
 * @description Detailed entity card renderer and right pane management.
 */

import { 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  rightPaneMode,
  APP_DATA,
  COLORS,
  LABELS,
  getActiveBook
} from '../core/state.js';
import { 
  getRightContentHost, 
  isMobileViewport, 
  setMobileSheetOpen,
  escapeHtml,
  renderAccentSafe,
  safeUrl,
  safeColor
} from '../utils/dom.js';
import { sortUniquePages } from '../utils/linguistics.js';
import { findItemByHeadAndType as findRegistryItem } from '../core/registry.js';
import { renderHistogramPanel } from './specialized.js';

/**
 * Main dispatcher for the right pane content.
 */
export function renderRightContent() {
  const host = getRightContentHost();
  if (!host) return;
  
  if (rightPaneMode === 'card' && selectedItem) {
    renderCardInRight(host);
  } else {
    renderHistogramInRight(host);
  }
  
  if (isMobileViewport()) {
    setMobileSheetOpen(rightPaneMode === 'card' && !!selectedItem);
  } else {
    setMobileSheetOpen(false);
  }
}

/**
 * Render the detailed item card in the specified host.
 */
function renderCardInRight(container) {
  const it = findRegistryItem(selectedItem, selectedItemType || currentEntity);
  if (!it) {
    container.innerHTML = '<div class="panel-muted-message">Элемент не найден.</div>';
    return;
  }
  
  const eType = selectedItemType || currentEntity;
  let category = LABELS[it.subcategory] || it.subcategory || '';
  if (eType === 'toponyms') category = 'Топоним';
  else if (eType === 'ethnonyms') category = 'Этноним';
  else if (eType === 'languages') category = it.family || 'Язык';
  
  const allPages = sortUniquePages(it.page_list || []);
  const pageLinksHtml = buildCardPageLinksHtml(allPages);
  
  let html = `
    <div class="card">
      <div class="card-header">
        <div class="card-title-block">
          <h2>${renderAccentSafe(it.head)}</h2>
          <div class="card-meta-row">
            <div class="category">${escapeHtml(category)}</div>
          </div>
        </div>
      </div>
      
      <div class="card-body">
        <div class="card-pages-section">
          <div class="card-section-title">Упоминания (стр. ${allPages.length})</div>
          <div class="card-page-links">
            ${pageLinksHtml}
          </div>
        </div>
        
        ${it.description ? `<div class="card-desc">${it.description}</div>` : ''}
        
        <div class="card-stats-strip">
          <span><strong>${allPages.length}</strong> <em>pages</em></span>
          <span><strong>${countItemContexts(it)}</strong> <em>contexts</em></span>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Wire up page links
  container.querySelectorAll('.card-page-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        // Handle page navigation
        console.log('Navigate to page', page);
      }
    };
  });
}

function buildCardPageLinksHtml(pages, maxLinks = 40) {
  if (!pages || !pages.length) return '<span class="panel-muted-text">нет страниц</span>';
  const display = pages.slice(0, maxLinks);
  let html = display.map(p => `<span class="card-page-link" data-page="${p}">${p}</span>`).join(' ');
  if (pages.length > maxLinks) {
    html += ` <span class="card-page-more">... и ещё ${pages.length - maxLinks}</span>`;
  }
  return html;
}

function countItemContexts(it) {
  let count = 0;
  if (it.context) count++;
  if (Array.isArray(it.contexts)) count += it.contexts.length;
  if (it.extra_contexts) count += it.extra_contexts.length;
  return count;
}

/**
 * Render the histogram in the right pane context.
 */
function renderHistogramInRight(container) {
  renderHistogramPanel(container);
}
