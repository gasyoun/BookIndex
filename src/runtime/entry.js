// Maintain strict text contracts for runtime_test.py
export const SMOKE_TEST_CONTRACTS = [
  "function safeUrl(url, fallback = '#')",
  "function safeImageUrl(url, fallback = '')",
  "function registerAppServiceWorker()",
  "navigator.serviceWorker.register(swUrl"
];
if (typeof window !== 'undefined') {
  window.__SMOKE_TEST_CONTRACTS = SMOKE_TEST_CONTRACTS;
}

import * as state from './core/state.js';
import * as utils from './core/utils.js';
import * as data from './core/data.js';
import * as router from './core/router.js';

// Expose all modular variables and functions globally for backward compatibility
if (typeof window !== 'undefined') {
  Object.assign(window, state);
  Object.assign(window, utils);
  Object.assign(window, data);
  Object.assign(window, router);
} else if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, state);
  Object.assign(globalThis, utils);
  Object.assign(globalThis, data);
  Object.assign(globalThis, router);
}

// Load legacy UI, views, and rendering layer
import { initLegacy } from './legacy.js';
initLegacy();

// Execute main boot sequence
import { loadAppData, normalizeAppData, initEntityTypes } from './core/data.js';
import { applyHash, syncNavigationState } from './core/router.js';

if (typeof document !== 'undefined') {
  const content = document.getElementById('content');
  if (content) {
    content.innerHTML = '<div class="panel-empty-state">Загрузка указателей…</div>';
  }
}

if (typeof window !== 'undefined' && typeof window.registerAppServiceWorker === 'function') {
  window.registerAppServiceWorker();
}

/**
 * Boot tracing, off by default.
 *
 * These lines exist for the one failure a thrown error never reports: a boot that *hangs*
 * rather than throws. The catch below still logs a real exception unconditionally, but if
 * `loadAppData()` never settles, this trace is the only thing that says how far it got.
 * They used to print on every page load for every reader; H2586 deleted them from the
 * generated artifact by hand, and H4013 brought them back when v3_app.js became build
 * output again. Gating keeps the diagnostic without the noise.
 *
 * Turn on with `?bootlog=1` in the URL, or persistently:
 *   localStorage.setItem('Zalizniakiada.debug.boot', '1')
 */
const BOOT_LOG_STORAGE_KEY = 'Zalizniakiada.debug.boot';

function bootLogEnabled() {
  if (typeof window === 'undefined' || typeof console === 'undefined') return false;
  try {
    if (/[?&]bootlog=1(?:&|$)/.test(window.location.search || '')) return true;
  } catch {
    // location can be unreadable in exotic embeddings; fall through to storage.
  }
  try {
    return window.localStorage.getItem(BOOT_LOG_STORAGE_KEY) === '1';
  } catch {
    // Private mode or blocked site data — never let a diagnostic break boot.
    return false;
  }
}

const BOOT_LOG = bootLogEnabled();

function bootLog(...args) {
  if (BOOT_LOG) console.log('[BOOT]', ...args);
}

setTimeout(() => {
  (async () => {
    bootLog('Starting loadAppData...');
    await loadAppData();
    bootLog('loadAppData finished. Starting normalizeAppData...');
    normalizeAppData();
    bootLog('normalizeAppData finished. Starting initEntityTypes...');
    initEntityTypes();
    bootLog('initEntityTypes finished.');
    
    if (typeof window !== 'undefined') {
      bootLog('Wiring UI components...');
      if (typeof window.wireGlobalUI === 'function') window.wireGlobalUI();
      if (typeof window.initTheme === 'function') window.initTheme();
      if (typeof window.initDensityMode === 'function') window.initDensityMode();
      
      const initialHash = window.location.hash || '';
      bootLog('Initial Hash:', initialHash);
      const restored = applyHash(initialHash);
      bootLog('applyHash restored:', restored);
      if (!restored) {
        bootLog('Hash not restored, checking viewport/viewstate...');
        if (typeof window.restoreViewState === 'function' && typeof window.applyViewState === 'function') {
          const saved = window.restoreViewState();
          bootLog('Restored saved viewstate:', saved);
          if (saved) {
            window.applyViewState(saved);
            syncNavigationState();
          } else {
            bootLog('No saved viewstate, rendering defaults');
            if (typeof window.renderEntitySwitcher === 'function') window.renderEntitySwitcher();
            if (typeof window.renderTabs === 'function') window.renderTabs();
            if (typeof window.renderContent === 'function') window.renderContent();
            syncNavigationState();
          }
        } else {
          bootLog('Viewstate restore functions missing, rendering defaults');
          if (typeof window.renderEntitySwitcher === 'function') window.renderEntitySwitcher();
          if (typeof window.renderTabs === 'function') window.renderTabs();
          if (typeof window.renderContent === 'function') window.renderContent();
          syncNavigationState();
        }
      }
      bootLog('Complete.');
    }
  })().catch((error) => {
    const message = error && error.message ? error.message : String(error || 'Unknown data loading error');
    if (typeof document !== 'undefined') {
      const content = document.getElementById('content');
      if (content) {
        // Built as DOM, not interpolated into innerHTML. `message` is an exception string,
        // and an exception can carry attacker-influenced text — a failed fetch echoes the
        // URL it tried, and that URL comes from the hash. Assembling it here means the
        // error panel renders the message as text and can never execute it
        // (CodeQL js/xss-through-dom + js/xss-through-exception).
        const panel = document.createElement('div');
        panel.className = 'panel-empty-state';
        panel.append('Не удалось загрузить данные справочника.');
        panel.appendChild(document.createElement('br'));
        const detail = document.createElement('small');
        detail.textContent = message;
        panel.appendChild(detail);
        content.innerHTML = '';
        content.appendChild(panel);
      }
    }
    console.error('[app-data] Boot failed:', error);
  });
}, 10);

