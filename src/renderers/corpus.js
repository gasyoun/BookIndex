/**
 * @file corpus.js
 * @description Corpus metadata, source management, and quality reporting
 */

import { APP_DATA } from '../core/state.js';
import { getCorpusBooks, getActiveBook, getCorpusRegistry, getPlannedVideoCatalogSource } from '../core/data.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * Render the Corpus Sources Panel.
 */
export function renderCorpusSourcesPanel(container) {
  const panel = document.createElement('div');
  panel.className = 'panel corpus-panel active';

  const registry = getCorpusRegistry();
  const books = getCorpusBooks();
  const sourceTypes = Array.isArray(registry.source_types) ? registry.source_types : [];
  const plannedVideo = getPlannedVideoCatalogSource();

  panel.innerHTML = `
    <div class="corpus-panel-header">
      <h2>Источники корпуса</h2>
      <p>Текущая книга, будущие книги и видеокаталог используют один корпусный слой навигации, поиска и цитирования.</p>
    </div>
    <div class="corpus-metrics-row">
      <div class="corpus-metric"><strong>${books.length}</strong><span>книг сейчас</span></div>
      <div class="corpus-metric"><strong>${getActiveBook().title || getActiveBook().book_id}</strong><span>активный источник</span></div>
      <div class="corpus-metric"><strong>${sourceTypes.length}</strong><span>типов источников</span></div>
      <div class="corpus-metric"><strong>${plannedVideo?.planned_count || 0}</strong><span>план видео</span></div>
    </div>
    <h3 class="corpus-section-title">Книги</h3>
    <div class="corpus-sources-grid" id="books-grid"></div>
    <h3 class="corpus-section-title">Типы источников</h3>
    <div class="corpus-sources-grid corpus-source-types-grid" id="types-grid"></div>
  `;

  const booksGrid = panel.querySelector('#books-grid');
  books.forEach(book => {
    booksGrid.appendChild(createCorpusSourceCard(book));
  });

  const typesGrid = panel.querySelector('#types-grid');
  sourceTypes.forEach(type => {
    const source = {
      ...type,
      title: type.title || type.label || type.type,
      description: type.type === 'video_catalog' 
        ? 'Будущий каталог видео Зализняка с тайм-кодами и стенограммами.' 
        : (type.description || ''),
    };
    typesGrid.appendChild(createCorpusSourceCard(source, 'тип источника'));
  });

  container.appendChild(panel);
}

function createCorpusSourceCard(source, kindLabel = 'книга') {
  const card = document.createElement('div');
  card.className = 'corpus-source-card';
  if (source.status === 'active') card.classList.add('active');
  
  card.innerHTML = `
    <div class="csc-kind">${escapeHtml(kindLabel)}</div>
    <div class="csc-title">${escapeHtml(source.title)}</div>
    <div class="csc-desc">${escapeHtml(source.description || '')}</div>
    <div class="csc-meta">
      ${source.author ? `<span>${escapeHtml(source.author)}</span>` : ''}
      ${source.year ? `<span>${escapeHtml(String(source.year))}</span>` : ''}
    </div>
    <div class="csc-status-tag">${escapeHtml(source.status || 'active')}</div>
  `;
  return card;
}
