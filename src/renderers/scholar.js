/**
 * @file scholar.js
 * @description Renderers for the Professional Apparatus (Scholar) section
 */

import { escapeHtml, bindActionWithKeyboard, safeUrl } from '../utils/dom.js';
import { exportAllNotesMarkdown } from '../utils/export.js';
import { buildBibliographyIndex, exportBibliographyBibTeX } from '../core/bibliography.js';
import { buildTopicClusters, calculateCentrality } from '../core/analytics.js';
import { QUIZ_LEVELS, checkAnswer } from '../core/quiz.js';
import {
  APP_DATA,
  currentVizModule,
  ensureVizStateLoaded,
  ensureVizModuleLoaded,
  warmupVizCacheInWorker,
  cleanupActiveVizModule,
  getVizRegistry,
  buildVizHash,
  buildCorpusVizHash,
  getActiveBook,
  syncNavigationHashOnly
} from '../core/state.js';

export function renderScholarDashboard(container) {
  container.innerHTML = `
    <div class="panel active scholar-dashboard">
      <h2 class="scholar-title">Аппарат исследователя</h2>
      <div class="scholar-grid">
        <div class="scholar-card">
          <h3>Дневник исследователя (v13.1)</h3>
          <p>Все ваши заметки сохраняются локально в базе данных IndexedDB. Вы можете выгрузить их в единый Markdown-файл для дальнейшей работы.</p>
          <button id="export-all-notes" class="intro-btn" style="width:100%; padding:1rem;">📂 Скачать дневник исследования (.md)</button>
        </div>
        <div class="scholar-card">
          <h3>Профессиональные инструменты</h3>
          <ul class="scholar-tools-list">
            <li><a href="#v4/scholar/chronology" class="related-link">Лента открытий</a></li>
            <li><a href="#v4/scholar/trends" class="related-link">Тренды упоминаний</a></li>
            <li><a href="#v4/scholar/bib" class="related-link">Указатель источников</a></li>
            <li><a href="#v4/scholar/topics" class="related-link">Тематические кластеры</a></li>
            <li><a href="#v4/scholar/hubs" class="related-link">Хабы знаний</a></li>
            <li><a href="#v4/scholar/quiz" class="related-link">Квиз и тренажер</a></li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const exportBtn = container.querySelector('#export-all-notes');
  if (exportBtn) {
    exportBtn.onclick = () => exportAllNotesMarkdown();
  }
}

export function renderBibliographyIndex(container) {
  const index = buildBibliographyIndex();

  container.innerHTML = `
    <div class="panel active bibliography-panel">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 class="scholar-title">Указатель источников</h2>
        <button id="export-bibtex" class="viz-btn">Экспорт BibTeX</button>
      </div>
      <div class="bib-grid">
        ${Array.from(index.entries()).map(([cite, data]) => `
          <div class="bib-item">
            <div class="bib-cite">${escapeHtml(cite)}</div>
            <div class="bib-meta">Упоминаний: ${data.citing_items.length}</div>
            <div class="bib-citing-list">
              ${data.citing_items.slice(0, 5).map(it => `
                <a href="#v4/list/${it.type}/${it.head}" class="bib-link">${escapeHtml(it.head)}</a>
              `).join(', ')}
              ${data.citing_items.length > 5 ? '...' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const exportBtn = container.querySelector('#export-bibtex');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const bibtex = exportBibliographyBibTeX();
      alert('BibTeX сформирован (проверьте консоль)');
      console.log(bibtex);
    };
  }
}

export function renderTopicClusters(container) {
  const clusters = buildTopicClusters();

  container.innerHTML = `
    <div class="panel active analytics-panel">
      <h2 class="scholar-title">Дальнее чтение: тематические кластеры (v16.0)</h2>
      <p class="panel-desc">Алгоритм автоматически сгруппировал термины на основе лексического сходства их описаний.</p>
      <div class="cluster-grid">
        ${clusters.map(([stem, items]) => `
          <div class="cluster-card">
            <div class="cluster-tag">Тема: #${escapeHtml(stem)}</div>
            <div class="cluster-items">
              ${items.map(it => `<span class="cluster-item">${escapeHtml(it)}</span>`).join(', ')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderKnowledgeHubs(container) {
  const hubs = calculateCentrality();

  container.innerHTML = `
    <div class="panel active analytics-panel">
      <h2 class="scholar-title">Хабы знаний: сетевой анализ (v16.1)</h2>
      <p class="panel-desc">Рейтинг терминов по количеству их перекрестных связей в корпусе. Это «узловые» понятия, связывающие разные разделы книги.</p>
      <div class="hubs-list">
        ${hubs.map(([head, score], i) => `
          <div class="hub-item">
            <span class="hub-rank">#${i + 1}</span>
            <span class="hub-name">${escapeHtml(head)}</span>
            <div class="hub-bar-container">
              <div class="hub-bar" style="width: ${Math.min(100, score * 10)}%"></div>
            </div>
            <span class="hub-score">${score} связей</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderQuiz(container, levelId = 1) {
  const level = QUIZ_LEVELS.find(l => l.id === levelId);

  container.innerHTML = `
    <div class="panel active quiz-panel">
      <h2 class="scholar-title">Лингвистический тренажер: ${escapeHtml(level.title)}</h2>
      <div class="quiz-progress">Уровень ${levelId} из ${QUIZ_LEVELS.length}</div>
      <div class="quiz-question-list">
        ${level.questions.map((q, qIdx) => `
          <div class="quiz-card" id="q-${qIdx}">
            <p class="quiz-text">${escapeHtml(q.text)}</p>
            <div class="quiz-options">
              ${q.options.map((opt, oIdx) => `
                <button class="viz-btn quiz-opt" onclick="handleQuizAnswer(${levelId}, ${qIdx}, ${oIdx})">${escapeHtml(opt)}</button>
              `).join('')}
            </div>
            <div class="quiz-feedback" id="feedback-${qIdx}"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
