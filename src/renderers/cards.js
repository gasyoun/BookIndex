/**
 * @file cards.js
 * @description Renderers for individual entity cards and details
 */

import { 
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
import { 
  escapeHtml, 
  safeUrl, 
  safeImageUrl, 
  bindActionWithKeyboard,
  announceUiMessage 
} from '../utils/dom.js';
import { 
  sortUniquePages, 
  clampUiInput, 
  clampPageInBook 
} from '../utils/linguistics.js';
import { 
  getActiveBook, 
  getBookLabelForSearch 
} from '../core/data.js';
import { getNote, saveNote } from '../core/storage.js';
import { parseLeipzigGloss } from '../utils/linguistics.js';
import { getLinguisticInsight } from '../core/ai.js';
import { generateEntityJsonLd } from '../utils/export.js';

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

export function renderCardInRight() {
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

export function renderCardsPanel(container) {
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
