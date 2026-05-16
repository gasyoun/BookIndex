/**
 * @file linguistics_tools.js
 * @description Advanced linguistic tools: Russian Evolution, Phonetic Laws, and Gallery
 */

import { APP_DATA } from '../core/state.js';
import { escapeHtml, safeUrl } from '../utils/dom.js';

/**
 * Render the Gallery of Linguists Panel.
 */
export function renderGalleryPanel(container) {
  const gallery = APP_DATA.gallery || [];
  let html = `<div class="panel active gallery-panel"><div class="gallery-inner">
    <h2 class="gallery-title">Галерея лингвистов</h2>
    <p class="gallery-intro">Ученые, чьи труды и биографии обсуждаются в лекциях А. А. Зализняка.</p>
    <div class="gallery-grid">`;
  
  gallery.forEach(p => {
    const photoUrl = safeUrl(p.photo_url || '');
    html += `
      <div class="gallery-card">
        <img class="gallery-card-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(p.name || 'Лингвист')}" loading="lazy" decoding="async">
        <div class="gallery-info">
          <div class="gallery-name">${escapeHtml(p.name)}</div>
          <div class="gallery-years">${escapeHtml(p.years || '')}</div>
          <div class="gallery-desc">${escapeHtml(p.description || '')}</div>
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}

/**
 * Render the Russian Evolution Panel.
 */
export function renderRussianEvolutionPanel(container) {
  const evolution = APP_DATA.russian_evolution || [];
  let html = `<div class="panel active evolution-panel"><div class="evolution-inner">
    <h2 class="evolution-title">Эволюция русского языка</h2>
    <p class="evolution-intro">Основные этапы развития фонетики и грамматики от праславянского до современного русского.</p>
    <div class="evolution-timeline">`;

  evolution.forEach(stage => {
    html += `
      <div class="evolution-stage">
        <div class="evolution-stage-header">
          <div class="evolution-stage-title">${escapeHtml(stage.title)}</div>
          <div class="evolution-stage-period">${escapeHtml(stage.period || '')}</div>
        </div>
        <div class="evolution-stage-desc">${escapeHtml(stage.description || '')}</div>
        <div class="evolution-changes">
          ${(stage.changes || []).map(ch => `<div class="evolution-change">
            <span class="evolution-change-label">${escapeHtml(ch.label)}:</span> ${escapeHtml(ch.detail)}
          </div>`).join('')}
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}

/**
 * Render the Phonetic Laws Panel.
 */
export function renderPhoneticLawsPanel(container) {
  const laws = APP_DATA.phonetic_laws || [];
  let html = `<div class="panel active laws-panel"><div class="laws-inner">
    <h2 class="laws-title">Фонетические законы и переходы</h2>
    <p class="laws-intro">Систематизация регулярных звуковых соответствий, упоминаемых в книге.</p>
    <div class="laws-list">`;

  laws.forEach(law => {
    html += `
      <div class="law-entry">
        <div class="law-head">${escapeHtml(law.head)}</div>
        <div class="law-desc">${escapeHtml(law.description || '')}</div>
        <div class="law-examples">
          ${(law.examples || []).map(ex => `<div class="law-example">
            <span class="law-example-source">${escapeHtml(ex.source)}</span> → 
            <span class="law-example-target">${escapeHtml(ex.target)}</span> 
            <span class="law-example-comment">(${escapeHtml(ex.comment || '')})</span>
          </div>`).join('')}
        </div>
      </div>`;
  });

  html += `</div></div></div>`;
  container.innerHTML = html;
}
