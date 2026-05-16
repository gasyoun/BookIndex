/**
 * @file entry.js
 * @description Application entry point and initialization logic for BookIndex v13.0
 */

import { hydrateStateFromStorage } from './core/state.js';
import { parseAppData } from './core/data.js';
import { initSearchWorker } from './core/search.js';
import { applyHash } from './core/router.js';
import { updateDocumentSeo } from './core/seo.js';
import { renderEntitySwitcher, renderTabs, renderContent } from './renderers/lists.js';
import { checkAchievements } from './core/achievements.js';
import { announceAchievement } from './utils/dom.js';

/* global initScholarWorkspace, initCardNotes, initPremiumIntro, injectSemanticStyles */

/**
 * Main application initialization.
 */
function initApp() {
  console.log('🚀 Zalizniakiada v3.1.0 initializing (Modular + Vite)...');
  
  try {
    // 1. Hydrate Data & Initialize Registry
    const data = parseAppData();
    hydrateStateFromStorage();
    
    // 2. Initialize Core Systems
    initSearchWorker();
    
    // Legacy integrations (until modularized)
    if (typeof initScholarWorkspace === 'function') initScholarWorkspace();
    if (typeof initCardNotes === 'function') initCardNotes();
    if (typeof initPremiumIntro === 'function') initPremiumIntro();
    if (typeof injectSemanticStyles === 'function') injectSemanticStyles();
    
    // 3. Routing & Navigation
    window.addEventListener('hashchange', () => {
      if (applyHash(window.location.hash)) {
        renderEntitySwitcher();
        renderTabs();
        renderContent();
        updateDocumentSeo();
      }
    });

    // 4. Initial Render
    const initialHash = window.location.hash || '#v4/home/home';
    applyHash(initialHash);
    renderEntitySwitcher();
    renderTabs();
    renderContent();
    updateDocumentSeo();
    
    // 5. Gamification
    checkAchievements('app_opened').then(newUnlocks => {
      newUnlocks.forEach(a => announceAchievement(a));
    });

    const versionEl = document.querySelector('.footer-version');
    if (versionEl) {
      versionEl.onclick = () => {
        checkAchievements('easter_egg_clicked').then(newUnlocks => {
          newUnlocks.forEach(a => announceAchievement(a));
        });
      };
    }
    
    console.log('✅ Zalizniakiada v3.1.0 ready.');
  } catch (e) {
    console.error('❌ App initialization failed:', e);
  }
}

// Note: renderContent is imported from ./renderers/lists.js above.

// Start the app
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
