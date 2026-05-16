/**
 * @file check_parity.js
 * @description Verify that v3_app.js maintains production logic and hasn't been accidentally shrunken.
 */

const fs = require('fs');
const path = require('path');

const V3_APP_PATH = path.join(__dirname, '../v3_app.js');
const MIN_EXPECTED_LINES = 3500;
const SIGNATURES = [
  'var KWIC_MAX_ROWS = 1200',
  'function loadScriptOnce(src, attrs = {})',
  'function updateDocumentSeo()',
  'function renderGraphPanel(container)',
  'function renderMapPanel(container)'
];

if (!fs.existsSync(V3_APP_PATH)) {
  console.error(`❌ Error: ${V3_APP_PATH} not found.`);
  process.exit(1);
}

const content = fs.readFileSync(V3_APP_PATH, 'utf8');
const lines = content.split('\n');

console.log(`🔍 Checking v3_app.js parity...`);
console.log(`   - Line count: ${lines.length} (minimum expected: ${MIN_EXPECTED_LINES})`);

let failed = false;

if (lines.length < MIN_EXPECTED_LINES) {
  console.error(`❌ FAIL: v3_app.js is too small! It might have been overwritten by a stale bundle.`);
  failed = true;
}

try {
  // Parse as a classic script because v3_app.js is the non-module fallback artifact.
  new Function(content);
} catch (err) {
  console.error(`вќЊ FAIL: v3_app.js is not valid classic JavaScript: ${err.message}`);
  failed = true;
}

if (/^\s*(?:import|export)\s/m.test(content)) {
  console.error(`вќЊ FAIL: v3_app.js still contains ESM import/export syntax.`);
  failed = true;
}

for (const sig of SIGNATURES) {
  if (!content.includes(sig)) {
    console.error(`❌ FAIL: Missing critical signature: "${sig}"`);
    failed = true;
  }
}

if (failed) {
  console.error(`\n⚠️  v3_app.js does NOT have parity with production. Do not publish!`);
  process.exit(1);
} else {
  console.log(`✅ Parity check passed.`);
}
