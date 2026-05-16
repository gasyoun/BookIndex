/**
 * @file tasks.js
 * @description Interactive linguistics practice and self-verification tasks
 */

import { APP_DATA } from '../core/state.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * Render the Tasks Panel.
 */
export function renderTasksPanel(container, options = {}) {
  const baseTasks = Array.isArray(APP_DATA.tasks) ? APP_DATA.tasks : [];
  let html = '<div class="panel active tasks-panel"><div class="tasks-panel-inner">';
  html += '<h2 class="tasks-title">Проверьте себя</h2>';
  html += `<div class="tasks-toolbar-note">${baseTasks.length} базовых вопросов.</div>`;
  html += '<div id="tasks-container"></div></div></div>';
  container.innerHTML = html;

  const tc = document.getElementById('tasks-container');
  if (!tc) return;

  baseTasks.forEach((t, ti) => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-card';
    taskDiv.innerHTML = `
      <div class="task-card-question">Вопрос ${ti + 1}. ${escapeHtml(t.question)}</div>
      <div class="task-options" id="task-${ti}-opts"></div>
      <div class="task-result" id="task-${ti}-res"></div>
    `;
    tc.appendChild(taskDiv);
    
    const optsDiv = taskDiv.querySelector(`#task-${ti}-opts`);
    (t.options || []).forEach((opt, oi) => {
      const btn = document.createElement('button');
      btn.className = 'task-option-btn';
      btn.textContent = String.fromCharCode(65 + oi) + '. ' + opt;
      btn.onclick = () => {
        if (optsDiv.dataset.locked === '1') return;
        optsDiv.dataset.locked = '1';
        const isCorrect = oi === t.correct;
        optsDiv.querySelectorAll('button').forEach(b => {
          b.disabled = true;
          b.classList.add('locked');
        });
        if (isCorrect) {
          btn.classList.add('correct');
        } else {
          btn.classList.add('incorrect');
          const correctBtn = optsDiv.querySelectorAll('button')[t.correct];
          if (correctBtn) correctBtn.classList.add('correct');
        }
        const res = taskDiv.querySelector(`#task-${ti}-res`);
        res.classList.add('visible', isCorrect ? 'correct' : 'incorrect');
        res.textContent = isCorrect ? 'Верно!' : 'Неверно. Правильный ответ выделен.';
      };
      optsDiv.appendChild(btn);
    });
  });
}
