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

function buildAppHtml() {
  const dataPath = path.resolve(__dirname, 'app_data.json');
  const appPath = path.resolve(__dirname, 'v3_app.js');
  const templatePath = path.resolve(__dirname, 'v3_template.html');

  const dataText = readFileSync(dataPath, 'utf8');
  const appJs = readFileSync(appPath, 'utf8');
  const templateHtml = readFileSync(templatePath, 'utf8');
  const buildId = computeBuildId(dataText, appJs, templateHtml);

  return templateHtml
    .replace('__APP_DATA_JSON__', escapeJsonForHtmlScript(dataText))
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
