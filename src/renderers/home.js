/**
 * @file home.js
 * @description Renderer for the Application Home Panel
 */

import { APP_DATA, getSavedReadingPage } from '../core/state.js';
import { 
  escapeHtml, 
  buildItemHash,
  buildCanonicalHash,
  buildListSearchHash,
  safeIcon,
  renderTextWithPageLinks
} from '../utils/dom.js';
import { getTotalBookPages } from '../utils/linguistics.js';
import { getCorpusBooks, getPlannedVideoCatalogSource } from '../core/data.js';

/**
 * Render the Home Panel.
 */
export function renderHomePanel(container) {
  const stats = APP_DATA.book_stats || {};
  const routes = APP_DATA.routes || [];
  const featured = APP_DATA.featured_quote || { text: '', page: '', lecture: '' };
  const totalPages = getTotalBookPages();
  
  let html = `<div class="panel active home-panel"><div class="home-panel-inner">`;

  // 1. Stats Hero
  html += `<div class="home-stats-hero">
    <h2 class="home-stats-title">Книга в цифрах</h2>
    <div class="home-stats-subtitle">Что внутри ${escapeHtml(totalPages)} страниц лекций А. А. Зализняка</div>
    <div id="home-stats-grid" class="home-stats-grid">`;

  const cells = [
    [String(totalPages), 'страницы'],
    [stats.has_preface ? '10 + 1' : String(stats.lectures || 10), 'лекций'],
    [stats.names, 'имён'],
    [stats.languages, 'языков'],
    [stats.toponyms, 'топонимов'],
    [stats.lexicon?.toLocaleString('ru') || '0', 'лексем'],
  ];
  for (const [num, label] of cells) {
    html += `<div class="home-stat-cell"><div class="home-stat-num">${num}</div><div class="home-stat-label">${label}</div></div>`;
  }
  html += '</div></div>';

  // 2. Featured Quote
  html += `<div class="home-facts">
    <div class="home-featured-quote">
      <div class="home-featured-quote-text">«${escapeHtml(featured.text)}»</div>
      <div class="home-featured-meta">— ${renderTextWithPageLinks(`стр. ${featured.page}`, { className: 'home-featured-page-link', rangeTarget: 'trends' })}, лекция «${escapeHtml(featured.lecture)}»</div>
    </div>
  </div>`;

  // 3. How-to Guide
  html += buildHomeHowToGuideHtml();

  html += '</div></div>';
  container.innerHTML = html;
}

function buildHomeHowToGuideHtml() {
  const udarenieAllHash = buildListSearchHash('all', 'ударение');
  const subjectListHash = buildListSearchHash('subject', '');
  const corpusBooks = getCorpusBooks();
  const videoCatalog = getPlannedVideoCatalogSource();
  const corpusBookCount = corpusBooks.length || 1;
  
  const videoCount = videoCatalog?.planned_count || 0;
  const corpusSummary = `Сейчас корпусная модель держит ${corpusBookCount} книг(у).`;

  return `<div class="home-howto">
    <h3 class="home-howto-h3">Как пользоваться «Зализнякиадой»</h3>
    <p>${escapeHtml(corpusSummary)}</p>
    <ul class="home-howto-list">
      <li>Начните с глобального поиска: попробуйте <a href="${escapeHtml(udarenieAllHash)}" class="home-howto-link">ударение</a>.</li>
      <li>Откройте <a href="${escapeHtml(subjectListHash)}" class="home-howto-link">предметный указатель</a>.</li>
    </ul>
  </div>`;
}
