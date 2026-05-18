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
    modulesDir: 'data/modules',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1] || '';
    if (key === '--data') args.data = value;
    if (key === '--js') args.js = value;
    if (key === '--template') args.template = value;
    if (key === '--out') args.out = value;
    if (key === '--build-id') args.buildId = value;
    if (key === '--modules-dir') args.modulesDir = value;
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

function appDataModuleManifestText(modulesDir, buildId) {
  const manifest = JSON.parse(readFileSync(join(modulesDir, 'manifest.json'), 'utf8'));
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
    throw new Error(`JSON root must be object: ${join(modulesDir, 'manifest.json')}`);
  }
  const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
  if (!modules.length) {
    throw new Error(`App data module manifest is empty: ${join(modulesDir, 'manifest.json')}`);
  }
  const enriched = modules.map((entry) => {
    const file = String(entry && entry.file || '').trim();
    if (!file) throw new Error('App data module entry is missing file');
    const text = readFileSync(join(modulesDir, file), 'utf8').replace(/\r\n?/g, '\n');
    const raw = Buffer.from(text, 'utf8');
    return {
      file,
      keys: Array.isArray(entry.keys) ? entry.keys : [],
      bytes: raw.length,
      sha256: createHash('sha256').update(raw).digest('base64'),
    };
  });
  return `${JSON.stringify({
    mode: 'modules',
    version: manifest.version || 1,
    build_id: buildId,
    base_url: './data/modules/',
    modules: enriched,
    key_order: Array.isArray(manifest.key_order) ? manifest.key_order : [],
  }, null, 2)}\n`;
}

function cspSha256(text) {
  const browserInlineText = String(text || '').replace(/\r\n?/g, '\n');
  return `'sha256-${createHash('sha256').update(browserInlineText, 'utf8').digest('base64')}'`;
}

function inlineScriptHashes(html) {
  const hashes = [];
  const scriptRe = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    hashes.push(cspSha256(match[1]));
  }
  return hashes;
}

function inlineStyleHashes(html) {
  const hashes = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const match of html.matchAll(styleRe)) {
    hashes.push(cspSha256(match[1]));
  }
  return hashes;
}

const args = parseArgs(process.argv.slice(2));
const dataText = canonicalJsonText(args.data);
const templateText = readFileSync(args.template, 'utf8');
let jsText = readFileSync(args.js, 'utf8');
const buildId = args.buildId.trim() || computeBuildId(dataText, jsText, templateText);
const appDataPayloadText = appDataModuleManifestText(args.modulesDir, buildId);
jsText = jsText.replaceAll('__APP_BUILD_ID__', buildId);
let html = templateText
  .split('__APP_DATA_JSON__').join(escapeJsonForHtmlScript(appDataPayloadText))
  .split('__APP_SCRIPT__').join(jsText);
const scriptHashes = inlineScriptHashes(html);
const styleHashes = inlineStyleHashes(html);
html = html.split('__CSP_SCRIPT_HASHES__').join(scriptHashes.join(' '));
html = html.split('__CSP_STYLE_HASHES__').join(styleHashes.join(' '));

writeFileSync(args.out, `\uFEFF${html}`, 'utf8');
console.log(`OK: built ${join(process.cwd(), args.out)} (build_id=${buildId})`);
