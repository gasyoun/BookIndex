(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusHtml(kind, title, message) {
    const safeKind = ['loading', 'empty', 'error'].indexOf(String(kind || '')) >= 0
      ? String(kind)
      : 'empty';
    const role = safeKind === 'error' ? 'alert' : 'status';
    const titleHtml = title
      ? `<strong class="viz-status-title">${escapeHtml(title)}</strong>`
      : '';
    const messageHtml = message
      ? `<span class="viz-status-message">${escapeHtml(message)}</span>`
      : '';
    return [
      `<div class="viz-status viz-status-${safeKind}" role="${role}">`,
      titleHtml,
      messageHtml,
      '</div>',
    ].join('');
  }

  function showStatus(host, kind, title, message) {
    if (!host) return;
    host.innerHTML = statusHtml(kind, title, message);
  }

  function emptyStateHtml(title, message) {
    const titleHtml = title
      ? `<strong>${escapeHtml(title)}</strong>`
      : '';
    const messageHtml = message
      ? `<br>${escapeHtml(message)}`
      : '';
    return `<div class="viz-empty-state" hidden>${titleHtml}${messageHtml}</div>`;
  }

  /**
   * Build a standard module card:
   * header (title + data-source chip + reset/copy/export) →
   * toolbar (filters left, view/export right) → body.
   */
  function buildModuleCard(options) {
    const opts = options || {};
    const className = String(opts.className || '').trim();
    const title = String(opts.title || 'Визуализация');
    const dataSource = String(opts.dataSource || '').trim();
    const filtersHtml = String(opts.filtersHtml || '');
    const viewHtml = String(opts.viewHtml || '');
    const bodyHtml = String(opts.bodyHtml || '');
    const emptyHtml = opts.emptyHtml == null ? '' : String(opts.emptyHtml);
    const exportSvg = opts.exportSvg !== false;
    const showExport = opts.showExport !== false && exportSvg;

    const chip = dataSource
      ? `<span class="viz-source-chip" title="Источник данных">${escapeHtml(dataSource)}</span>`
      : '';

    const exportBtn = showExport
      ? '<button type="button" class="viz-action-btn" data-viz-action="export" title="Скачать SVG">SVG</button>'
      : '';

    return [
      `<div class="viz-card${className ? ` ${escapeHtml(className)}` : ''}">`,
      '  <div class="viz-module-header">',
      '    <div class="viz-module-heading">',
      `      <h3 class="viz-module-title">${escapeHtml(title)}</h3>`,
      chip,
      '    </div>',
      '    <div class="viz-module-actions" role="group" aria-label="Действия модуля">',
      '      <button type="button" class="viz-action-btn" data-viz-action="reset" title="Сбросить фильтры">Сброс</button>',
      '      <button type="button" class="viz-action-btn" data-viz-action="copy-link" title="Скопировать ссылку">Ссылка</button>',
      exportBtn,
      '    </div>',
      '  </div>',
      '  <div class="viz-toolbar">',
      `    <div class="viz-toolbar-filters">${filtersHtml}</div>`,
      `    <div class="viz-toolbar-view">${viewHtml}</div>`,
      '  </div>',
      emptyHtml,
      bodyHtml,
      '</div>',
    ].join('');
  }

  function downloadSvg(svgNode, filename) {
    if (!svgNode || typeof XMLSerializer === 'undefined') return false;
    try {
      const serializer = new XMLSerializer();
      const src = serializer.serializeToString(svgNode);
      const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(filename || 'viz-export.svg');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  function copyText(text) {
    const value = String(text || '');
    if (!value) return Promise.resolve(false);
    if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
      return root.navigator.clipboard.writeText(value).then(() => true).catch(() => false);
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve(!!ok);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function flashButton(btn, okLabel) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = okLabel || 'Готово';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
    }, 1200);
  }

  /**
   * Wire standard chrome actions on a module card.
   * options.onReset — required for meaningful reset
   * options.exportFilename — default 'viz-export.svg'
   * options.exportSelector — default 'svg'
   * options.onExport — optional override
   */
  function wireModuleChrome(container, options) {
    const opts = options || {};
    if (!container) return;

    const resetBtn = container.querySelector('[data-viz-action="reset"]');
    const copyBtn = container.querySelector('[data-viz-action="copy-link"]');
    const exportBtn = container.querySelector('[data-viz-action="export"]');

    if (resetBtn && typeof opts.onReset === 'function') {
      resetBtn.onclick = () => {
        opts.onReset();
      };
    } else if (resetBtn) {
      resetBtn.disabled = true;
      resetBtn.title = 'Сброс недоступен для этого модуля';
    }

    if (copyBtn) {
      copyBtn.onclick = () => {
        const href = root.location && root.location.href ? String(root.location.href) : '';
        copyText(href).then((ok) => {
          flashButton(copyBtn, ok ? 'Скопировано' : 'Ошибка');
        });
      };
    }

    if (exportBtn) {
      exportBtn.onclick = () => {
        if (typeof opts.onExport === 'function') {
          opts.onExport();
          flashButton(exportBtn, 'Скачано');
          return;
        }
        const selector = String(opts.exportSelector || 'svg');
        const svgNode = container.querySelector(selector);
        const ok = downloadSvg(svgNode, opts.exportFilename || 'viz-export.svg');
        flashButton(exportBtn, ok ? 'Скачано' : 'Нет SVG');
      };
    }
  }

  root.VizShell = {
    escapeHtml,
    statusHtml,
    showStatus,
    emptyStateHtml,
    buildModuleCard,
    wireModuleChrome,
    downloadSvg,
    copyText,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
