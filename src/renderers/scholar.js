/**
 * @file scholar.js
 * @description Renderer for the Professional Scholar Panel
 */

import { 
  APP_DATA, 
  trendsRangeStart, 
  trendsRangeEnd, 
  setTrendsRangeStart, 
  setTrendsRangeEnd 
} from '../core/state.js';
import { 
  escapeHtml, 
  safeUrl, 
  renderAccentSafe,
  perfDebug,
  nowMs,
  buildItemHash,
  buildScholarAnchorHash,
  buildListSearchHash,
  renderTextWithPageLinks
} from '../utils/dom.js';
import { navigateToItem, filterByChapter } from '../core/navigation.js';
import { compareHeadsRu } from '../utils/linguistics.js';

/**
 * Render the Scholar Panel.
 */
export function renderScholarPanel(container) {
  const s = APP_DATA.scholar || {};
  const scholarViewportWidth = (typeof window !== 'undefined' && typeof window.innerWidth === 'number') ? window.innerWidth : 1280;
  
  let html = '<div class="panel active scholar-panel"><div class="scholar-inner">';
  html += '<h2 class="scholar-title">Профессиональный аппарат</h2>';
  html += '<div class="scholar-intro">Дополнительные материалы для взрослого читателя, студента-лингвиста, преподавателя и специалиста-русиста.</div>';

  // 1. TOC
  const sections = [
    ['biblio', '1. Библиография работ Зализняка'],
    ['extended_cards', '2. Расширенные сведения о ключевых лингвистах'],
    ['controversies', '3. Спорные вопросы и дискуссионные места'],
    ['original', '4. Оригинальные формы по языкам'],
    ['birch', '5. Конкорданс берестяных грамот'],
    ['chronology', '6. Хронология лингвистических открытий'],
    ['isoglosses', '7. Изоглоссы русских диалектов'],
    ['slovo', '8. Аргументация о подлинности «Слова о полку Игореве»'],
    ['accents', '9. Акцентологические парадигмы Зализняка'],
    ['correspondences', '10. Сравнительная таблица фонетических соответствий'],
    ['reconstructions', '11. Реконструкции'],
  ];
  html += '<div class="scholar-toc">';
  for (const [id, title] of sections) {
    html += `<a class="scholar-toc-link" href="#sch-${id}">${escapeHtml(title)}</a>`;
  }
  html += '</div>';

  // 1. Bibliography
  html += '<h3 id="sch-biblio" class="scholar-section-title">1. Библиография работ Зализняка по темам лекций</h3>';
  html += '<div class="scholar-section-intro">Каждая лекция в книге — выжимка из академических работ Зализняка. Здесь — ключевые публикации, где темы изложены подробнее.</div>';
  for (const lec of (s.bibliography || [])) {
    html += `<div class="scholar-card">
      <div class="scholar-card-title">Лекция «${escapeHtml(lec.lecture)}»</div>`;
    for (const w of lec.works) {
      html += `<div class="scholar-work">
        <strong>${escapeHtml(w.title)}</strong> (${escapeHtml(String(w.year))})${w.url ? ` <a class="related-link" href="${escapeHtml(safeUrl(w.url))}" target="_blank" rel="noopener noreferrer">PDF/страница ↗</a>` : ''}<br>
        <span class="scholar-note">${escapeHtml(w.note)}</span>
      </div>`;
    }
    html += '</div>';
  }

  // 2. Extended Cards (Linguists)
  html += '<h3 id="sch-extended_cards" class="scholar-section-title scholar-section-title-spaced">2. Расширенные сведения о ключевых лингвистах</h3>';
  html += '<div class="scholar-section-intro">Подробные карточки лингвистов доступны в разделе «Имена».</div>';
  html += '<div>';
  const keyLinguists = ['Вакернагель Я.','Гримм Я.','Вернер К.','Раск Р. К.','Бопп Фр.','Мейе А.','Шампольон Ф.','Вентрис М.','Янин В. Л.','Гиппиус А. А.','Аванесов Р. И.','Дыбо В. А.','Иллич-Свитыч В. М.','Падучева Е. В.'];
  for (const name of keyLinguists) {
    html += `<a class="scholar-link scholar-chip-link" data-type="names" data-head="${escapeHtml(name)}" href="${escapeHtml(buildItemHash('names', name))}">${escapeHtml(name)}</a>`;
  }
  html += '</div>';

  // 3. Controversies
  html += '<h3 id="sch-controversies" class="scholar-section-title scholar-section-title-spaced">3. Спорные вопросы и дискуссионные места</h3>';
  for (const c of (s.controversies || [])) {
    const controversyPageMeta = c.page
      ? renderTextWithPageLinks(`стр. ${c.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-card scholar-controversy-card">
      <div class="scholar-controversy-title">${escapeHtml(c.topic)}${controversyPageMeta ? ` <span class="scholar-muted-meta">· ${controversyPageMeta}</span>` : ''}</div>
      <div class="scholar-controversy-desc">${escapeHtml(c.description)}</div>
      <div class="scholar-controversy-sides"><strong>Стороны:</strong> ${escapeHtml(c.sides)}</div>
    </div>`;
  }

  // 4. Original Forms
  html += '<h3 id="sch-original" class="scholar-section-title scholar-section-title-spaced">4. Оригинальные формы по языкам</h3>';
  const langLabels = {sanskrit:'Санскрит',greek:'Древнегреческий',latin:'Латинский',arabic:'Арабский',old_russian:'Древнерусский'};
  html += '<div class="scholar-grid">';
  for (const [key, label] of Object.entries(langLabels)) {
    const forms = (s.original_forms || {})[key] || [];
    html += `<div class="scholar-card">
      <div class="scholar-card-title">${label}</div>`;
    for (const f of forms) {
      const formPageMeta = f.page
        ? renderTextWithPageLinks(`стр. ${f.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
        : '';
      html += `<div class="scholar-original-form"><span class="scholar-original-word">${renderAccentSafe(f.form)}</span> — ${escapeHtml(f.translation)}${formPageMeta ? ` <span class="scholar-muted-meta">(${formPageMeta})</span>` : ''}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // 5. Birchbark Concordance
  const birchRows = (s.birch_grammar || []).map((g) => {
    const rawUrl = String(g.url || '');
    const cityMatch = rawUrl.match(/show\/([^/]+)\//i);
    const city = cityMatch ? cityMatch[1].toLowerCase() : 'unknown';
    const yearText = String(g.year || '');
    const centuryMatch = yearText.toUpperCase().match(/X{1,3}(?:I{0,3}|V?I{0,3})/);
    const century = centuryMatch ? `${centuryMatch[0]} в.` : 'не указано';
    return { ...g, city, century };
  });
  const birchCities = Array.from(new Set(birchRows.map(r => r.city))).sort(compareHeadsRu);
  const birchCenturies = Array.from(new Set(birchRows.map(r => r.century))).sort(compareHeadsRu);
  html += '<h3 id="sch-birch" class="scholar-section-title scholar-section-title-spaced">5. Конкорданс берестяных грамот</h3>';
  html += '<table class="scholar-table">';
  html += '<thead><tr class="scholar-table-head-row"><th>№</th><th>Город</th><th>Дата</th><th>Содержание</th><th>Стр.</th></tr></thead><tbody id="birch-concordance-body">';
  for (const g of birchRows) {
    const birchLink = g.url ? `<a class="related-link" href="${escapeHtml(safeUrl(g.url))}" target="_blank" rel="noopener noreferrer">№${escapeHtml(g.num)} ↗</a>` : `№${escapeHtml(g.num)}`;
    html += `<tr class="birch-row scholar-table-row" data-city="${escapeHtml(g.city)}" data-century="${escapeHtml(g.century)}" data-num="${escapeHtml(String(g.num || ''))}">
      <td class="scholar-table-key">${birchLink}</td>
      <td class="scholar-table-muted">${escapeHtml(g.city)}</td>
      <td class="scholar-table-muted">${escapeHtml(g.year)}</td>
      <td>${escapeHtml(g.content)}</td>
      <td class="scholar-table-page">${g.page ? renderTextWithPageLinks(`стр. ${g.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' }) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';

  // 6. Chronology
  html += '<h3 id="sch-chronology" class="scholar-section-title scholar-section-title-spaced">6. Хронология лингвистических открытий</h3>';
  for (const ev of (s.chronology || [])) {
    const chronologyPageMeta = ev.page
      ? renderTextWithPageLinks(`стр. ${ev.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-chronology-row">
      <div class="scholar-chronology-year">${escapeHtml(ev.year)}</div>
      <div class="scholar-chronology-event">${escapeHtml(ev.event)}${chronologyPageMeta ? `<span class="scholar-muted-meta"> · ${chronologyPageMeta}</span>` : ''}</div>
    </div>`;
  }

  // 7. Isoglosses
  html += '<h3 id="sch-isoglosses" class="scholar-section-title scholar-section-title-spaced">7. Изоглоссы русских диалектов</h3>';
  for (const i of (s.isoglosses || [])) {
    const isoglossPageMeta = i.page
      ? renderTextWithPageLinks(`стр. ${i.page}`, { className: 'material-page-link card-page-link related-link', rangeTarget: 'trends' })
      : '';
    html += `<div class="scholar-card scholar-isogloss-card">
      <div class="scholar-card-title">${escapeHtml(i.name)}${isoglossPageMeta ? ` <span class="scholar-muted-meta">· ${isoglossPageMeta}</span>` : ''}</div>
      <div class="scholar-body-text">${escapeHtml(i.description)}</div>
    </div>`;
  }

  // 8. Slovo o Polku Igoreve
  html += '<h3 id="sch-slovo" class="scholar-section-title scholar-section-title-spaced">8. Аргументация Зализняка о подлинности «Слова о полку Игореве»</h3>';
  if (s.slovo) {
    html += `<div class="scholar-slovo-card">
      <div class="scholar-slovo-thesis">${escapeHtml(s.slovo.thesis)}</div>
      ${s.slovo.context ? `<div class="scholar-slovo-context">${escapeHtml(s.slovo.context)}</div>` : ''}
      <div class="scholar-slovo-opponents"><strong>Оппоненты:</strong> ${escapeHtml(s.slovo.opponents)}</div>
      <div class="scholar-slovo-verdict">${escapeHtml(s.slovo.verdict)}</div>
    </div>`;
  }

  html += '</div></div>';
  container.innerHTML = html;
}

/**
 * Render the Chronology of Discoveries Panel.
 */
export function renderScholarChronologyPanel(container) {
  const events = APP_DATA.scholar?.chronology || [];
  let html = `<div class="panel active chronology-panel"><div class="chronology-inner">
    <h2 class="chronology-title">Хронология лингвистических событий</h2>
    <div class="chronology-list">`;
  
  events.forEach(ev => {
    html += `
      <div class="chronology-event">
        <div class="chronology-event-year">${escapeHtml(String(ev.year))}</div>
        <div class="chronology-event-text">${escapeHtml(ev.event)}</div>
      </div>`;
  });

  html += '</div></div></div>';
  container.innerHTML = html;
}

/**
 * Render the Page Trends Panel.
 */
export function renderPageTrendsPanel(container) {
  container.innerHTML = `<div class="panel active page-trends-panel"><div class="page-trends-inner">
    <h2 class="page-trends-title">Динамика упоминаний</h2>
    <p class="page-trends-intro">Распределение всех упоминаний по страницам книги.</p>
    <div id="page-trends-chart" class="page-trends-chart"></div>
  </div></div>`;
  
  const chart = container.querySelector('#page-trends-chart');
  if (!chart) return;
  
  // Simple sparkline-like representation
  chart.innerHTML = '<p class="panel-muted-message">График динамики загружается...</p>';
}
