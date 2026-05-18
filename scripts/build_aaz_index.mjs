import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function parseArgs(argv) {
  const args = {
    data: 'app_data.json',
    js: 'v3_app.js',
    template: 'v3_template.html',
    out: 'aaz-index.html',
    buildId: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1] || '';
    if (key === '--data') args.data = value;
    if (key === '--js') args.js = value;
    if (key === '--template') args.template = value;
    if (key === '--out') args.out = value;
    if (key === '--build-id') args.buildId = value;
    if (key.startsWith('--')) i += 1;
  }
  return args;
}

function canonicalJsonText(dataPath) {
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error(`JSON root must be object: ${dataPath}`);
  }
  return `${JSON.stringify(data, null, 2)}\n`;
}

function computeBuildId(dataText, jsText, templateText) {
  const normalizeLineEndings = (value) => String(value || '').replace(/\r\n?/g, '\n');
  return createHash('sha1')
    .update(normalizeLineEndings(dataText), 'utf8')
    .update('\0', 'utf8')
    .update(normalizeLineEndings(jsText), 'utf8')
    .update('\0', 'utf8')
    .update(normalizeLineEndings(templateText), 'utf8')
    .digest('hex')
    .slice(0, 12);
}

function escapeJsonForHtmlScript(jsonText) {
  return jsonText
    .replaceAll('</script', '<\\/script')
    .replaceAll('<!--', '<\\!--');
}

function cspSha256(text) {
  const browserScriptText = String(text || '').replace(/\r\n?/g, '\n');
  return `'sha256-${createHash('sha256').update(browserScriptText, 'utf8').digest('base64')}'`;
}

function inlineScriptHashes(html) {
  const hashes = [];
  const scriptRe = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    hashes.push(cspSha256(match[1]));
  }
  return hashes;
}

const args = parseArgs(process.argv.slice(2));
const dataText = canonicalJsonText(args.data);
const templateText = readFileSync(args.template, 'utf8');
let jsText = readFileSync(args.js, 'utf8');
const buildId = args.buildId.trim() || computeBuildId(dataText, jsText, templateText);
jsText = jsText.replaceAll('__APP_BUILD_ID__', buildId);
let html = templateText
  .split('__APP_DATA_JSON__').join(escapeJsonForHtmlScript(dataText))
  .split('__APP_SCRIPT__').join(jsText);
const scriptHashes = inlineScriptHashes(html);
html = html.split('__CSP_SCRIPT_HASHES__').join(scriptHashes.join(' '));

writeFileSync(args.out, `\uFEFF${html}`, 'utf8');
console.log(`OK: built ${join(process.cwd(), args.out)} (build_id=${buildId})`);
