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
  return createHash('sha1')
    .update(dataText, 'utf8')
    .update('\0', 'utf8')
    .update(jsText, 'utf8')
    .update('\0', 'utf8')
    .update(templateText, 'utf8')
    .digest('hex')
    .slice(0, 12);
}

function escapeJsonForHtmlScript(jsonText) {
  return jsonText
    .replaceAll('</script', '<\\/script')
    .replaceAll('<!--', '<\\!--');
}

const args = parseArgs(process.argv.slice(2));
const dataText = canonicalJsonText(args.data);
const templateText = readFileSync(args.template, 'utf8');
let jsText = readFileSync(args.js, 'utf8');
const buildId = args.buildId.trim() || computeBuildId(dataText, jsText, templateText);
jsText = jsText.replaceAll('__APP_BUILD_ID__', buildId);
const html = templateText
  .split('__APP_DATA_JSON__').join(escapeJsonForHtmlScript(dataText))
  .split('__APP_SCRIPT__').join(jsText);

writeFileSync(args.out, `\uFEFF${html}`, 'utf8');
console.log(`OK: built ${join(process.cwd(), args.out)} (build_id=${buildId})`);
