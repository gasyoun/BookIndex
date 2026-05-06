/**
 * @file materials.js
 * @description Renderers for the core book materials (Lectures, Glossary, Reading)
 */

import { 
  APP_DATA, 
  currentTab, 
  currentEntity, 
  currentLecture, 
  currentGlossaryTerm,
  trendsRangeStart,
  trendsRangeEnd 
} from '../core/state.js';
import { escapeHtml, bindActionWithKeyboard } from '../utils/dom.js';
import { clampPageInBook } from '../utils/linguistics.js';

// --- External References ---
/* global getTotalBookPages, wireReadingNowWidget, openLecturePage, 
   buildLectureTermHash, openLectureTerm, openGlossaryTerm, buildItemHash,
   buildLecturePageHash, switchTab, collectFurtherReadingBibEntries,
   downloadBibtexFile, announceUiMessage, persistViewState, getItemsForChapter,
   compareHeadsRu, buildReadingNowHash, saveReadingPage, syncNavigationState,
   renderEntitySwitcher, renderTabs, renderContent, navigateToItem */

export function renderLecturesPanel(container) {
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

export function renderGlossaryPanel(container) {
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
