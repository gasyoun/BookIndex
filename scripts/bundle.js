/**
 * @file bundle.js
 * @description Bundler for BookIndex v13.0 Modular Architecture.
 * Transitions from monolithic v3_app.js to ES module-based source tree.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const OUTPUT_FILE = path.join(__dirname, '../v3_app.js');

// Order of execution for the bundled IIFE
const FILES_ORDER = [
  'core/state.js',
  'core/data.js',
  'core/registry.js',
  'core/storage.js',
  'core/ai.js',
  'core/analytics.js',
  'core/quiz.js',
  'core/achievements.js',
  'core/bibliography.js',
  'utils/dom.js',
  'utils/linguistics.js',
  'utils/export.js',
  'core/search.js',
  'core/router.js',
  'core/seo.js',
  'core/navigation.js',
  'core/viz.js',
  'renderers/scholar.js',
  'renderers/materials.js',
  'renderers/home.js',
  'renderers/specialized.js',
  'renderers/graph.js',
  'renderers/card.js',
  'renderers/geo.js',
  'renderers/tree.js',
  'renderers/linguistics_tools.js',
  'renderers/tasks.js',
  'renderers/corpus.js',
  'renderers/lists.js',
  'entry.js',
];

function bundle() {
  console.log('📦 Bundling BookIndex v1.0.0 (Modular)...');
  
  let output = `/**
 * BookIndex (Zalizniakiada) v1.0.0
 * --------------------------------------------------
 * Modular architecture bundle.
 * Generated on: ${new Date().toISOString()}
 */\n\n`;

  // Start IIFE to simulate module scope in browser without type="module"
  // Note: aaz-index.html currently expects a global v3_app.js script
  output += '(function() {\n';
  output += '  "use strict";\n\n';

  for (const relPath of FILES_ORDER) {
    const fullPath = path.join(SRC_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Warning: Module not found: ${relPath}`);
      continue;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Transform ES modules to browser-safe global-ish scope for the IIFE.
    // 1. Remove single-line and multiline import statements.
    content = content.replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*/gm, '');
    content = content.replace(/^\s*import\s+['"][^'"]+['"];?\s*/gm, '');
    
    // 2. Convert exports to shared declarations inside the IIFE.
    // Use var for exported state/constants so duplicate legacy names from
    // independent ESM modules do not make the fallback bundle unparsable.
    content = content.replace(/^export\s+(const|let|var)\s+/gm, 'var ');
    content = content.replace(/^export\s+(function|class|async\s+function)\s+/gm, '$1 ');
    
    // 3. Remove named exports like 'export { ... }'
    content = content.replace(/^export\s+\{\s*.*\s*\};?\s*$/gm, '');
    
    output += `// --- Module: ${relPath} ---\n`;
    output += content + '\n\n';
  }

  output += '})();\n';

  // Backup existing file if it's the legacy monolith
  if (fs.existsSync(OUTPUT_FILE)) {
    const backupFile = OUTPUT_FILE + '.bak';
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(OUTPUT_FILE, backupFile);
      console.log(`💾 Legacy monolith backed up to ${path.basename(backupFile)}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✅ Successfully bundled to ${OUTPUT_FILE}`);
  console.log('🚀 Build Guard retired. Production pipeline active.');
}

bundle();
