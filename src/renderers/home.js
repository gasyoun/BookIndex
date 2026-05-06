/**
 * @file home.js
 * @description Renderers for the landing page and welcome dashboards
 */

import { APP_DATA, currentTab, currentEntity, selectedItem, selectedItemType, rightPaneMode } from '../core/state.js';
import { escapeHtml, safeIcon, bindActionWithKeyboard } from '../utils/dom.js';
import { getActiveBook, getBookLabelForSearch } from '../core/data.js';

// --- External References ---
/* global buildHomeHowToGuideHtml, getTotalBookPages, renderTextWithPageLinks,
   loadRecentItems, buildItemHash, findLectureIndexByName, openLecturePage,
   navigateToItem, renderEntitySwitcher, renderTabs, renderContent,
   syncNavigationState, exportWholeSiteMarkdown, HOME_DECL_FACTORY_KEY,
   syncNavigationHashOnly, bindNavigateLinks */

export function renderHomePanel(container) {
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

export function renderHomePanelDeclarative(container) {
  // Logic for Alpine.js based home page
  // (Will be implemented in the bundle or as a separate module if needed)
}
