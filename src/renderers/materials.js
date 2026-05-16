/**
 * @file materials.js
 * @description Renderer for the Materials and Lectures Panel
 */

import { 
  APP_DATA, 
  getSavedReadingPage, 
  saveReadingPage,
  currentKwicQuery,
  setCurrentKwicQuery,
  lectureCompareA,
  lectureCompareB,
} from '../core/state.js';
import { 
  escapeHtml, 
  buildItemHash
} from '../utils/dom.js';
import { getTotalBookPages, compareHeadsRu } from '../utils/linguistics.js';
import { collectReadingNow } from '../core/data.js';
import { 
  openLecturePage, 
  getItemsForChapter
} from '../core/navigation.js';

/**
 * Render the Lectures Panel.
 */
export function renderLecturesPanel(container) {
  const lectures = APP_DATA.lectures || [];
  const stats = APP_DATA.book_stats || {};
  const maxPage = Number(stats.total_pages) || getTotalBookPages();
  
  let html = '<div class="panel active lectures-panel"><div class="lectures-inner">';
  html += '<h2 class="lectures-title">Все лекции книги — за пять минут</h2>';
  html += '<div class="lectures-intro">Краткие резюме: 10 лекций + предисловие.</div>';
  
  html += `<div class="reading-now-box">
    <div class="reading-now-title">Режим «Читаю сейчас»</div>
    <div class="reading-now-desc">Введите номер страницы, и мы покажем, кто и что на ней упоминается.</div>
    <div class="reading-now-controls">
      <button id="reading-page-prev" class="reading-now-btn">←</button>
      <input id="reading-page-input" class="reading-now-input" type="number" min="1" max="${escapeHtml(maxPage)}" step="1" />
      <button id="reading-page-next" class="reading-now-btn">→</button>
      <button id="reading-page-go" class="reading-now-btn">Показать</button>
    </div>
    <div id="reading-now-results" class="reading-now-results"></div>
  </div>`;

  html += '<div id="lectures-grid" class="lectures-grid">';
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i];
    const title = i === 0 ? 'Предисловие' : `Лекция ${i}`;
    const cardClass = i === 0 ? 'lecture-card preface' : 'lecture-card';
    html += `<div class="${cardClass}" data-idx="${i}">
      <div class="lecture-card-meta">${title} · стр. ${escapeHtml(l.pages)}</div>
      <div class="lecture-card-title">${escapeHtml(l.name)}</div>
      <div class="lecture-card-idea">${escapeHtml(l.main_idea)}</div>
    </div>`;
  }
  html += '</div></div></div>';
  
  container.innerHTML = html;
  wireReadingNowWidget(container, maxPage);
  
  container.querySelectorAll('.lecture-card').forEach(card => {
    card.onclick = () => openLecturePage(parseInt(card.dataset.idx || '0', 10));
  });
}

function wireReadingNowWidget(root, totalPages) {
  const readingInput = root.querySelector('#reading-page-input');
  const readingGo = root.querySelector('#reading-page-go');
  const readingPrev = root.querySelector('#reading-page-prev');
  const readingNext = root.querySelector('#reading-page-next');
  const readingResults = root.querySelector('#reading-now-results');
  
  if (!readingInput || !readingGo || !readingResults) return;
  
  const clamp = (p) => Math.max(1, Math.min(totalPages, parseInt(String(p || '1'), 10) || 1));
  
  const renderResults = (page) => {
    const p = clamp(page);
    saveReadingPage(p);
    readingInput.value = String(p);
    
    const groups = collectReadingNow(p, 7);
    let out = `<div class="reading-now-page-title"><strong>Страница ${p}</strong></div>`;
    
    if (!groups.length) {
      out += '<div class="reading-now-empty">Ничего не найдено.</div>';
    } else {
      for (const g of groups) {
        out += `<div class="reading-now-group"><strong>${escapeHtml(g.label)}:</strong> `;
        for (const it of g.items) {
          out += `<a class="reading-now-link" data-type="${escapeHtml(g.type)}" data-head="${escapeHtml(it.head)}" href="${escapeHtml(buildItemHash(g.type, it.head))}">${escapeHtml(it.head)}</a> `;
        }
        out += `</div>`;
      }
    }
    readingResults.innerHTML = out;
  };
  
  const saved = getSavedReadingPage();
  const startPage = saved ? clamp(saved) : 1;
  renderResults(startPage);
  
  readingGo.onclick = () => renderResults(readingInput.value);
  if (readingPrev) readingPrev.onclick = () => renderResults(parseInt(readingInput.value, 10) - 1);
  if (readingNext) readingNext.onclick = () => renderResults(parseInt(readingInput.value, 10) + 1);
}

/**
 * Render the Glossary Panel.
 */
export function renderGlossaryPanel(container) {
  const glossary = APP_DATA.glossary || [];
  let html = '<div class="panel active glossary-panel"><div class="glossary-inner">';
  html += '<h2 class="glossary-title">Глоссарий терминов</h2>';
  html += '<div class="glossary-intro">Учебные определения лингвистических терминов, используемых в книге.</div>';
  
  for (const g of glossary) {
    html += `<div class="glossary-entry">
      <div class="glossary-entry-head">${escapeHtml(g.term)}</div>
      <div class="glossary-definition">${g.definition}</div>
    </div>`;
  }
  
  html += '</div></div>';
  container.innerHTML = html;
}

/**
 * Render the KWIC Panel.
 */
export function renderKwicPanel(container) {
  const totalPages = getTotalBookPages();
  
  container.innerHTML = `<div class="panel active kwic-panel">
    <div class="kwic-inner">
      <h2 class="kwic-title">KWIC-конкорданс</h2>
      <div class="kwic-intro">Key Word In Context: ключевое слово в окружении.</div>
      <div class="kwic-controls">
        <label class="kwic-field">Запрос <input id="kwic-query" type="text" value="${escapeHtml(currentKwicQuery)}" class="kwic-input"></label>
        <button id="kwic-run" class="kwic-run-btn">Показать</button>
      </div>
      <div id="kwic-results" class="kwic-results"></div>
    </div>
  </div>`;
  
  const resultsEl = container.querySelector('#kwic-results');
  const runBtn = container.querySelector('#kwic-run');
  const queryInput = container.querySelector('#kwic-query');
  
  runBtn.onclick = () => {
    setCurrentKwicQuery(queryInput.value);
    // Logic for KWIC results collection would go here
    resultsEl.innerHTML = '<p class="panel-muted-message">Результаты поиска...</p>';
  };
}

/**
 * Render the Further Reading Panel.
 */
export function renderFurtherReadingPanel(container) {
  const sections = APP_DATA.further_reading || [];
  let html = '<div class="panel active further-reading-panel"><div class="further-reading-inner">';
  html += '<h2 class="further-reading-title">Что почитать ещё</h2>';
  html += '<div class="further-reading-intro">Навигатор по научно-популярным и базовым лингвистическим книгам.</div>';
  html += '<div class="further-reading-grid">';
  
  for (const sec of sections) {
    html += `<div class="further-reading-card">
      <div class="further-reading-topic">${escapeHtml(sec.topic || '')}</div>`;
    for (const b of (sec.books || [])) {
      html += `<div class="further-reading-book">
        <div class="further-reading-book-title">${escapeHtml(b.title || '')}</div>
        <div class="further-reading-book-why">${escapeHtml(b.why || '')}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div></div></div>';
  container.innerHTML = html;
}

/**
 * Render the Lecture Comparison Panel.
 */
export function renderLectureComparePanel(container) {
  const chapters = APP_DATA.chapters || [];
  if (chapters.length < 2) {
    container.innerHTML = '<div class="panel active"><div class="panel-empty-state">Недостаточно лекций для сравнения.</div></div>';
    return;
  }

  const chapterA = chapters[lectureCompareA] || chapters[0];
  const chapterB = chapters[lectureCompareB] || chapters[1];
  
  const types = [
    { key: 'names', label: 'Имена' },
    { key: 'toponyms', label: 'Топонимы' },
    { key: 'ethnonyms', label: 'Этнонимы' },
    { key: 'languages', label: 'Языки' },
    { key: 'lexicon', label: 'Лексика' },
    { key: 'subject', label: 'Предметный' },
  ];

  let html = '<div class="panel active lecture-compare-panel"><div class="lecture-compare-inner">';
  html += '<h2 class="lecture-compare-title">Сравнение двух лекций</h2>';
  html += '<div class="lecture-compare-grid">';

  for (const t of types) {
    const itemsA = getItemsForChapter(t.key, chapterA);
    const itemsB = getItemsForChapter(t.key, chapterB);
    const setA = new Set(itemsA.map(it => it.head));
    const setB = new Set(itemsB.map(it => it.head));
    const inter = [...setA].filter(h => setB.has(h)).sort(compareHeadsRu);
    
    html += `<div class="lecture-compare-card">
      <div class="lecture-compare-card-title">${t.label}</div>
      <div class="lecture-compare-card-meta">Общие: <strong>${inter.length}</strong></div>
      <div class="lecture-compare-link-row">
        ${inter.slice(0, 10).map(h => `<a class="lecture-compare-link" href="${buildItemHash(t.key, h)}">${escapeHtml(h)}</a>`).join('')}
        ${inter.length > 10 ? `<span class="lecture-compare-more">+${inter.length - 10}</span>` : ''}
      </div>
    </div>`;
  }

  html += '</div></div></div>';
  container.innerHTML = html;
}

/**
 * Render an individual Lecture Page Panel.
 */
export function renderLecturePagePanel(container) {
  container.innerHTML = '<div class="panel active"><p class="panel-muted-message">Раздел в разработке.</p></div>';
}
