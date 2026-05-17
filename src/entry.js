/**
 * @file entry.js
 * @description Application entry point and initialization logic for BookIndex v13.0
 */

import { setAppData } from './core/state.js';
import { migrateAppDataSchema } from './core/data.js';
import { initSearchWorker } from './core/search.js';
import { applyHash } from './core/router.js';
import { renderEntitySwitcher, renderTabs, renderContent } from './renderers/lists.js';
import { checkAchievements } from './core/achievements.js';
import { announceAchievement } from './utils/dom.js';

/* global parseAppData, syncNavigationState, initScholarWorkspace, initCardNotes,
   initPremiumIntro, injectSemanticStyles */

function initApp() {
  console.log('🚀 Zalizniakiada v13.0 initializing...');

  try {
    // 1. Hydrate Data
    const data = typeof parseAppData === 'function' ? parseAppData() : null;
    if (data) {
      setAppData(data);
      migrateAppDataSchema(data);
    }

    // 2. Initialize Core Systems
    initSearchWorker();
    if (typeof initScholarWorkspace === 'function') initScholarWorkspace();
    if (typeof initCardNotes === 'function') initCardNotes();
    if (typeof initPremiumIntro === 'function') initPremiumIntro();
    if (typeof injectSemanticStyles === 'function') injectSemanticStyles();

    // 3. Routing & Gamification
    window.addEventListener('hashchange', () => {
      if (applyHash(window.location.hash)) {
        renderEntitySwitcher();
        renderTabs();
        renderContent();
      }
    });

    // Secret: App Opened
    checkAchievements('app_opened').then(newUnlocks => {
      newUnlocks.forEach(a => announceAchievement(a));
    });

    // Secret: Easter Egg
    const versionEl = document.querySelector('.footer-version');
    if (versionEl) {
      versionEl.onclick = () => {
        checkAchievements('easter_egg_clicked').then(newUnlocks => {
          newUnlocks.forEach(a => announceAchievement(a));
        });
      };
    }

    // 4. Initial Render
    applyHash(window.location.hash || '#v4/home/home');
    renderEntitySwitcher();
    renderTabs();
    renderContent();

    console.log('✅ Zalizniakiada v13.0 ready.');
  } catch (e) {
    console.error('❌ App initialization failed:', e);
  }
}

// Start the app
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
