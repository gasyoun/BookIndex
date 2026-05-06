/**
 * @file viz-panels.js
 * @description Renderers for complex visualizations and linguistic dashboards (KWIC, Heatmap, Maps)
 */

import { 
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
import { 
  escapeHtml, 
  safeUrl, 
  safeImageUrl, 
  bindActionWithKeyboard 
} from '../utils/dom.js';
import { 
  getBookLabelForSearch 
} from '../core/data.js';
import { 
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

export function collectLexiconKwicRows(query, pageStart, pageEnd) {
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

export function renderRetrogradeSuffixTree(container) {
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

export function renderEtymoFlow(container, itemHead) {
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

export function renderKwicPanel(container) {
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

export function renderIsoglossMap(container, featureId) {
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
