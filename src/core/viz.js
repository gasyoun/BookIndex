/**
 * @file viz.js
 * @description Visualization lifecycle and shell management
 */

import { currentVizCleanup, setCurrentVizCleanup } from './state.js';

/**
 * Cleanup the currently active visualization module by calling its cleanup function.
 */
export function cleanupActiveVizModule() {
  if (typeof currentVizCleanup === 'function') {
    try {
      currentVizCleanup();
    } catch (e) {
      console.error('[viz] cleanup error:', e);
    }
  }
  setCurrentVizCleanup(null);
  
  if (typeof window !== 'undefined' && window.__vizCache) {
    // Optional: partial cache clear if needed in the future
  }
}
