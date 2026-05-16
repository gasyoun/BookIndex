/**
 * @file bundle.js
 * @description Simple bundler for Zalizniakiada v13.0
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const OUTPUT_FILE = path.join(__dirname, '../v3_app.js');

const FILES_ORDER = [
  'core/state.js',
  'core/data.js',
  'core/storage.js',
  'core/ai.js',
  'core/analytics.js',
  'core/quiz.js',
  'core/achievements.js',
  'utils/dom.js',
  'utils/linguistics.js',
  'utils/export.js',
  'core/search.js',
  'core/router.js',
  'renderers/scholar.js',
  'renderers/lists.js',
  'renderers/cards.js',
  'renderers/home.js',
  'renderers/materials.js',
  'renderers/multimedia.js',
  'renderers/viz-panels.js',
  'entry.js',
];

function bundle() {
  console.log('📦 Bundling Zalizniakiada v13.0...');
  
  let output = `/**
 * Zalizniakiada (BookIndex) v13.0 Modular
 * Generated on: ${new Date().toISOString()}
 * --------------------------------------------------
 */\n\n`;

  // Start IIFE
  output += '(function() {\n';
  output += '  "use strict";\n\n';

  for (const relPath of FILES_ORDER) {
    const fullPath = path.join(SRC_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ File not found: ${relPath}`);
      continue;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Remove imports and exports
    content = content.replace(/^import\s+.*;?\s*$/gm, '');
    content = content.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');
    content = content.replace(/^export\s+\{\s*.*\s*\};?\s*$/gm, '');
    
    output += `// --- Module: ${relPath} ---\n`;
    output += content + '\n\n';
  }

  // End IIFE
  output += '})();\n';

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✅ Successfully bundled to ${OUTPUT_FILE}`);
}

bundle();
