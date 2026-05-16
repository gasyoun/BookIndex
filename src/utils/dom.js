/**
 * @file dom.js
 * @description DOM manipulation and event binding helpers
 */

import { clampPageInBook } from './linguistics.js';
import { ENTITY_TYPES, HASH_ROUTE_PREFIX } from '../core/state.js';
import { encodeItemHeadForHash } from '../core/registry.js';

export function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

export function nowMs() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

export function perfDebug(label, ms, meta = '') {
  if (typeof window !== 'undefined' && window.location && window.location.search.includes('perf=1')) {
    console.log(`[perf] ${label}: ${ms.toFixed(1)}ms ${meta ? `(${meta})` : ''}`);
  }
}

const scriptLoadPromises = new Map();

export function loadScriptOnce(src, attrs = {}) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Document is not available.'));
  }
  const url = String(src || '').trim();
  if (!url) return Promise.reject(new Error('Script URL is required.'));
  if (scriptLoadPromises.has(url)) return scriptLoadPromises.get(url);

  const promise = new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find(script => script.getAttribute('src') === url || script.src === url);
    if (existing && existing.dataset.loaded === 'true') {
      resolve(existing);
      return;
    }

    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = url;
      script.async = true;
    }
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === false || value == null) return;
      if (key === 'crossOrigin') script.crossOrigin = String(value);
      else if (key === 'integrity') script.integrity = String(value);
      else script.setAttribute(key, String(value));
    });
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(script);
    }, { once: true });
    script.addEventListener('error', () => {
      scriptLoadPromises.delete(url);
      reject(new Error(`Failed to load script: ${url}`));
    }, { once: true });
    if (!existing) document.head.appendChild(script);
  });

  scriptLoadPromises.set(url, promise);
  return promise;
}

export function isMobileViewport() {
  return typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 900;
}

export function getRightContentHost() {
  if (isMobileViewport()) {
    const mobile = document.getElementById('mobile-sheet-content');
    if (mobile) return mobile;
  }
  return document.getElementById('right-content');
}

export function setMobileSheetOpen(open) {
  const backdrop = document.getElementById('mobile-card-backdrop');
  const sheet = document.getElementById('mobile-card-sheet');
  if (!backdrop || !sheet || typeof document === 'undefined') return;
  
  backdrop.classList.toggle('open', !!open);
  sheet.classList.toggle('open', !!open);
  
  if (document.body) {
    document.body.classList.toggle('mobile-sheet-lock', !!open);
  }
}

export function renderAccentSafe(s) {
  if (!s || typeof s !== 'string') return '';
  return escapeHtml(s).replace(/`/g, '&#x301;');
}

export function buildCanonicalHash(parts) {
  return `#${HASH_ROUTE_PREFIX}/${parts.filter(Boolean).join('/')}`;
}

export function buildItemHash(type, head) {
  const t = type || 'all';
  const encodedHead = encodeItemHeadForHash(t, head);
  const defaultTab = ENTITY_TYPES[t] ? ENTITY_TYPES[t].tabs[0] : 'list';
  return buildCanonicalHash([t, defaultTab, 'item', t, encodedHead]);
}

export function buildScholarAnchorHash(anchorId) {
  return buildCanonicalHash(['scholar', 'scholar', 'anchor', String(anchorId || '').replace(/[^a-z0-9_-]/gi, '')]);
}

export function buildListSearchHash(entity, query) {
  const e = entity || 'all';
  const q = String(query || '').trim();
  if (!q) return buildCanonicalHash([e, 'list']);
  return buildCanonicalHash([e, 'list', 'q', encodeURIComponent(q)]);
}

export function safeIcon(icon, fallback = '•') {
  if (!icon) return fallback;
  const text = String(icon);
  if (text.length > 2) return fallback;
  return text;
}

export function renderTextWithPageLinks(text, options = {}) {
  if (!text || typeof text !== 'string') return '';
  const className = options.className || 'material-page-link card-page-link related-link';
  const rangeTarget = options.rangeTarget || 'trends';
  
  return text.replace(/(?:стр\.|с\.|[Pp]\.)\s*(\d+(?:\s*[-–]\s*\d+)?)/g, (match, p1) => {
    const range = p1.split(/[-–]/).map(s => s.trim());
    const startRaw = parseInt(range[0], 10);
    const endRaw = range[1] ? parseInt(range[1], 10) : startRaw;
    const start = clampPageInBook(Number.isFinite(startRaw) ? startRaw : 1);
    const end = clampPageInBook(Number.isFinite(endRaw) ? endRaw : start);
    
    let href = '';
    if (rangeTarget === 'trends') {
      href = buildCanonicalHash(['scholar', 'page_trends', 'range', String(Math.min(start, end)), String(Math.max(start, end))]);
    } else {
      href = buildCanonicalHash(['materials', 'lectures', 'reading', String(start)]);
    }
    
    return `<a href="${escapeHtml(href)}" class="${escapeHtml(className)}" data-start="${start}" data-end="${end}">${escapeHtml(match)}</a>`;
  });
}

export function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('./')) return url;
  return '#';
}

export function safeColor(value, fallback = '#888') {
  if (!value || typeof value !== 'string') return fallback;
  return value;
}

export function safeImageUrl(url) {
  return safeUrl(url);
}

export function safeSetAttr(el, attr, val) {
  if (el && typeof el.setAttribute === 'function') {
    el.setAttribute(attr, val);
  }
}

export function bindActionWithKeyboard(el, callback) {
  if (!el) return;
  el.onclick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    callback(e);
  };
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      callback(e);
    }
  };
}

export function announceUiMessage(msg, type = 'info') {
  if (typeof window === 'undefined') return;
  const el = document.getElementById('ui-message-toast');
  if (!el) {
    const toast = document.createElement('div');
    toast.id = 'ui-message-toast';
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: #fff; padding: 0.5rem 1.5rem;
      border-radius: 20px; z-index: 10000; font-size: 0.9rem; pointer-events: none;
      transition: opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  const toast = document.getElementById('ui-message-toast');
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

export function announceAchievement(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="ach-icon">${achievement.icon}</div>
    <div class="ach-info">
      <div class="ach-title">Достижение разблокировано!</div>
      <div class="ach-name">${escapeHtml(achievement.title)}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 100);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}
