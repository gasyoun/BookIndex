/**
 * @file specialized.js
 * @description Specialized visualizations (Cards grid, Histogram, Timeline, etc.)
 */

import { 
  currentEntity, 
  ENTITY_TYPES, 
  COLORS, 
  LABELS, 
  APP_DATA,
  getDataSignature,
  getCachedAggregate,
  selectedItem,
  selectedItemType
} from '../core/state.js';
import { 
  safeColor, 
  escapeHtml, 
  nowMs, 
  perfDebug 
} from '../utils/dom.js';
import { 
  compareItemsByHead, 
  normalizeHeadForMatch, 
  sortUniquePages 
} from '../utils/linguistics.js';
import { navigateToItem, filterByChapter } from '../core/navigation.js';
import { findItemByHeadAndType as findRegistryItem } from '../core/registry.js';

/**
 * Render the Cards Grid Panel.
 */
export function renderCardsPanel(container) {
  container.innerHTML = '<div class="panel active"><div class="cards-grid-container"><div class="cards-grid" id="cards-grid"></div></div></div>';
  const grid = document.getElementById('cards-grid');
  if (!grid) return;
  const items = ENTITY_TYPES[currentEntity]?.items || [];
  const sorted = [...items].sort(compareItemsByHead);
  for (const it of sorted) {
    const card = document.createElement('div');
    card.className = 'mini-card';
    if (currentEntity === 'names') card.style.borderTopColor = safeColor(COLORS[it.subcategory], '#8a7050');
    let cat = '';
    if (currentEntity === 'names') cat = LABELS[it.subcategory] || '';
    else if (currentEntity === 'toponyms') cat = 'Топоним';
    else if (currentEntity === 'ethnonyms') cat = 'Этноним';
    else if (currentEntity === 'languages') cat = it.family || 'Язык';
    const pages = it.pages || it.head_pages || '';
    const head = document.createElement('div');
    head.className = 'mc-head';
    head.textContent = String(it.head || '');
    if (it.discussed) {
      const discussed = document.createElement('span');
      discussed.className = 'mc-discussed';
      discussed.textContent = 'обсуждается';
      head.appendChild(discussed);
    }
    const catEl = document.createElement('div');
    catEl.className = 'mc-cat';
    catEl.textContent = String(cat || '');
    const pagesEl = document.createElement('div');
    pagesEl.className = 'mc-pages';
    pagesEl.textContent = `стр. ${String(pages || '')}`;
    card.appendChild(head);
    card.appendChild(catEl);
    card.appendChild(pagesEl);
    card.onclick = () => navigateToItem(currentEntity, it.head);
    grid.appendChild(card);
  }
}

/**
 * Render the Histogram Panel.
 */
export function renderHistogramPanel(container) {
  const t0 = nowMs();
  const focusedItem = getFocusedHistogramItem(currentEntity);
  const introText = buildHistogramIntroText(currentEntity, focusedItem);
  const introHtml = introText ? `<p class="chart-intro">${escapeHtml(introText)}</p>` : '';
  
  container.innerHTML = `<div class="panel active"><div class="chart">
    ${introHtml}
    <div id="histogram"></div></div></div>`;
  
  const chart = document.getElementById('histogram');
  if (!chart) return;
  
  renderChapterHistogramRows(chart, currentEntity, focusedItem);
  
  chart.querySelectorAll('.bar-fill').forEach(bar => {
    bar.onclick = () => filterByChapter(bar.dataset.chapter);
  });
  
  perfDebug('render-histogram', nowMs() - t0, currentEntity);
}

function getFocusedHistogramItem(entityKey) {
  if (!selectedItem || !entityKey) return null;
  const type = selectedItemType || entityKey;
  if (type !== entityKey) return null;
  return findRegistryItem(selectedItem, entityKey);
}

function buildHistogramIntroText(entityKey, focusedItem) {
  if (focusedItem && focusedItem.head) {
    return `Распределение упоминаний «${focusedItem.head}» по лекциям книги.`;
  }
  return `Распределение элементов раздела по лекциям книги.`;
}

function renderChapterHistogramRows(host, entityKey, focusedItem = null) {
  const stats = getChapterHistogramStats(entityKey, focusedItem);
  const counts = stats.counts;
  const max = stats.max || 1;
  let html = '';
  const chapters = APP_DATA?.chapters || [];
  for (const ch of chapters) {
    const c = counts[ch.name] || 0;
    const pct = (c / max) * 100;
    html += `
      <div class="bar-row">
        <div class="bar-label">${escapeHtml(ch.name)}<br><small>стр. ${ch.start}–${ch.end}</small></div>
        <div class="bar-bg"><div class="bar-fill" data-chapter="${escapeHtml(ch.name)}" style="width:${pct}%"></div></div>
        <div class="bar-count">${c}</div>
      </div>`;
  }
  host.innerHTML = html;
}

function getChapterHistogramStats(entityKey, focusedItem = null) {
  const focusKey = focusedItem && focusedItem.head ? normalizeHeadForMatch(focusedItem.head) : '*';
  const key = `${entityKey}::${focusKey}::${getDataSignature()}`;
  
  return getCachedAggregate('histogram', key, () => {
    const counts = {};
    const chapters = APP_DATA?.chapters || [];
    let max = 0;
    
    if (focusedItem && Array.isArray(focusedItem.page_list)) {
      const pages = sortUniquePages(focusedItem.page_list);
      for (const ch of chapters) {
        let hit = 0;
        for (const p of pages) {
          if (p >= ch.start && p <= ch.end) hit++;
        }
        counts[ch.name] = hit;
        if (hit > max) max = hit;
      }
    } else {
      const items = ENTITY_TYPES[entityKey]?.items || [];
      for (const it of items) {
        const pages = sortUniquePages(it.page_list || []);
        const itemChapters = new Set();
        for (const p of pages) {
          const ch = chapters.find(c => p >= c.start && p <= c.end);
          if (ch) itemChapters.add(ch.name);
        }
        for (const chName of itemChapters) {
          counts[chName] = (counts[chName] || 0) + 1;
          if (counts[chName] > max) max = counts[chName];
        }
      }
    }
    return { counts, max };
  });
}

/**
 * Render the Timeline Panel.
 */
export function renderTimelinePanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Имена на оси времени по векам. Каждая точка — одно имя; цвет показывает категорию. Кликните, чтобы открыть карточку.</p>
    <div id="timeline"></div>
    <div class="legend" id="timeline-legend"></div></div></div>`;
  
  const tl = document.getElementById('timeline');
  if (!tl) return;
  
  const items = ENTITY_TYPES[currentEntity]?.items || [];
  const withEpoch = items.filter(n => n.epoch !== null && n.epoch !== undefined);
  if (withEpoch.length === 0) { 
    tl.innerHTML = '<p class="panel-muted-message">Нет данных для временной шкалы.</p>'; 
    return; 
  }
  withEpoch.sort((a, b) => a.epoch - b.epoch);

  const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
  const isNarrow = vw < 1000;
  const ticks = [-1500, -500, 0, 500, 1000, 1500, 1700, 1850, 1900, 1950, 2000, 2025];
  
  if (isNarrow) {
    // Vertical timeline
    const padL = 100, padR = 20, padT = 20, rowH = 28;
    const W = Math.max(480, vw - 80);
    const H = padT + withEpoch.length * rowH + 20;
    let svg = `<svg class="timeline-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - 20}" stroke="#8a7050" stroke-width="2"/>`;
    
    for (let i = 0; i < withEpoch.length; i++) {
      const n = withEpoch[i];
      const y = padT + 10 + i * rowH;
      const color = safeColor(COLORS[n.subcategory], '#888');
      const epochLabel = n.epoch < 0 ? (-n.epoch) + ' до н.э.' : String(n.epoch);
      svg += `<text x="${padL - 8}" y="${y + 4}" fill="#888" font-size="10" text-anchor="end">${epochLabel}</text>`;
      svg += `<g class="timeline-point" data-head="${escapeHtml(n.head)}">
        <circle cx="${padL}" cy="${y}" r="5" fill="${color}" stroke="white" stroke-width="1.5"></circle>
        <text x="${padL + 10}" y="${y + 4}" fill="#1a1a1a" font-size="12">${escapeHtml(n.head)}</text>
      </g>`;
    }
    svg += '</svg>';
    tl.innerHTML = svg;
  } else {
    // Horizontal timeline
    const W = Math.max(1200, vw - 100);
    const padL = 80, padR = 60, padT = 40, rowH = 22;
    const epochToX = (e) => {
      for (let i = 0; i < ticks.length - 1; i++) {
        if (e >= ticks[i] && e <= ticks[i+1]) {
          const t = (e - ticks[i]) / (ticks[i+1] - ticks[i]);
          return padL + (i + t) / (ticks.length - 1) * (W - padL - padR);
        }
      }
      return e < ticks[0] ? padL : W - padR;
    };

    const placed = [];
    let maxRow = 0;
    for (const n of withEpoch) {
      const x = epochToX(n.epoch);
      let row = 0;
      while (placed.some(p => p.row === row && Math.abs(p.x - x) < 80)) row++;
      placed.push({ n, x, row });
      if (row > maxRow) maxRow = row;
    }

    const H = padT + (maxRow + 1) * rowH + 40;
    let svg = `<svg class="timeline-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
    
    for (const t of ticks) {
      const x = epochToX(t);
      svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - 30}" stroke="#eee" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${H - 10}" fill="#aaa" font-size="10" text-anchor="middle">${t < 0 ? (-t)+' до н.э.' : t}</text>`;
    }

    for (const p of placed) {
      const y = padT + p.row * rowH;
      const color = safeColor(COLORS[p.n.subcategory], '#888');
      svg += `<g class="timeline-point" data-head="${escapeHtml(p.n.head)}">
        <circle cx="${p.x}" cy="${y}" r="4" fill="${color}" stroke="white" stroke-width="1"></circle>
        <text x="${p.x + 6}" y="${y + 4}" fill="#333" font-size="11">${escapeHtml(p.n.head)}</text>
      </g>`;
    }
    svg += '</svg>';
    tl.innerHTML = svg;
  }
  
  tl.querySelectorAll('.timeline-point').forEach(g => {
    g.onclick = () => navigateToItem(currentEntity, g.dataset.head);
  });
}

/**
 * Render the Heatmap Panel.
 */
export function renderHeatmapPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="heatmap-container">
    <p class="chart-intro">Сетка «элемент × страница книги» (только обсуждаемые, топ-50). Цветные ячейки — упоминания.</p>
    <div id="heatmap"></div></div></div>`;
  
  const hm = document.getElementById('heatmap');
  if (!hm) return;
  
  const top = getHeatmapTopItems(currentEntity, 50);
  const totalPages = getTotalBookPages();
  
  const cellW = 2.2, cellH = 14, labelW = 220;
  const W = labelW + totalPages * cellW + 30;
  const H = top.length * cellH + 40;

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  const chapters = APP_DATA?.chapters || [];
  
  for (const ch of chapters) {
    const x1 = labelW + (ch.start - 1) * cellW;
    const x2 = labelW + ch.end * cellW;
    svg += `<rect x="${x1}" y="0" width="${x2-x1}" height="${H - 20}" fill="#fbf6e8" />`;
    svg += `<line x1="${x2}" y1="0" x2="${x2}" y2="${H - 20}" stroke="#e8dfc5" stroke-width="1"/>`;
  }
  
  let chIdx = 0;
  for (const ch of chapters) {
    const xMid = labelW + ((ch.start + ch.end) / 2) * cellW;
    const shortName = ch.name.length > 18 ? ch.name.slice(0, 16) + '…' : ch.name;
    const yLabel = (chIdx % 2 === 0) ? H - 12 : H - 2;
    svg += `<text x="${xMid}" y="${yLabel}" fill="#888" font-size="9" text-anchor="middle">${escapeHtml(shortName)}</text>`;
    chIdx++;
  }
  
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    const y = i * cellH + 8;
    const label = it.head.length > 30 ? it.head.slice(0, 28) + '…' : it.head;
    svg += `<text x="${labelW - 6}" y="${y + 4}" fill="#1a1a1a" font-size="10" text-anchor="end">${escapeHtml(label)}</text>`;
    const color = currentEntity === 'names' ? safeColor(COLORS[it.subcategory], '#888') : '#5a3818';
    for (const p of (it.page_list || [])) {
      const x = labelW + (p - 1) * cellW;
      svg += `<rect x="${x}" y="${y - 4}" width="${Math.max(2.5, cellW)}" height="${cellH - 4}" fill="${color}" opacity="0.85"><title>${escapeHtml(it.head)} · стр. ${p}</title></rect>`;
    }
  }
  svg += '</svg>';
  hm.innerHTML = svg;
  
  perfDebug('render-heatmap', nowMs() - t0, currentEntity);
}

function getHeatmapTopItems(entityKey, limit = 50) {
  const key = `${entityKey}:${limit}:${getDataSignature()}`;
  return getCachedAggregate('heatmap', key, () => {
    const items = ENTITY_TYPES[entityKey]?.items || [];
    const sorted = [...items].sort((a, b) => {
      if (!!b.discussed !== !!a.discussed) return (b.discussed ? 1 : 0) - (a.discussed ? 1 : 0);
      return (b.page_list || []).length - (a.page_list || []).length;
    });
    return sorted.slice(0, limit);
  });
}
