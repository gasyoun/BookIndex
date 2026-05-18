import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeJsonForHtmlScript(jsonText) {
  return String(jsonText || '')
    .replaceAll('</script', '<\\/script')
    .replaceAll('<!--', '<\\!--');
}

function computeBuildId(dataText, appJs, templateHtml) {
  const digest = createHash('sha256');
  digest.update(dataText, 'utf8');
  digest.update(appJs, 'utf8');
  digest.update(templateHtml, 'utf8');
  return digest.digest('hex').slice(0, 12);
}

function appDataModuleManifestText(modulesDir, buildId) {
  const manifest = JSON.parse(readFileSync(path.join(modulesDir, 'manifest.json'), 'utf8'));
  const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
  const enriched = modules.map((entry) => {
    const file = String(entry && entry.file || '').trim();
    const text = readFileSync(path.join(modulesDir, file), 'utf8').replace(/\r\n?/g, '\n');
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

function buildAppHtml() {
  const dataPath = path.resolve(__dirname, 'app_data.json');
  const modulesDir = path.resolve(__dirname, 'data', 'modules');
  const appPath = path.resolve(__dirname, 'v3_app.js');
  const templatePath = path.resolve(__dirname, 'v3_template.html');

  const dataText = readFileSync(dataPath, 'utf8');
  const appJs = readFileSync(appPath, 'utf8');
  const templateHtml = readFileSync(templatePath, 'utf8');
  const buildId = computeBuildId(dataText, appJs, templateHtml);
  const appDataPayload = appDataModuleManifestText(modulesDir, buildId);

  return templateHtml
    .replace('__APP_DATA_JSON__', escapeJsonForHtmlScript(appDataPayload))
    .replace('__APP_SCRIPT__', appJs.replace('__APP_BUILD_ID__', buildId));
}

function bookIndexTemplatePlugin() {
  return {
    name: 'bookindex-template-transform',
    transformIndexHtml() {
      return buildAppHtml();
    },
  };
}

export default defineConfig({
  plugins: [
    bookIndexTemplatePlugin(),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist-vite',
    emptyOutDir: true,
    target: 'es2019',
    sourcemap: false,
  },
  server: {
    host: '127.0.0.1',
    allowedHosts: ['localhost', '127.0.0.1'],
    cors: false,
  },
  preview: {
    host: '127.0.0.1',
    allowedHosts: ['localhost', '127.0.0.1'],
    cors: false,
  },
});
