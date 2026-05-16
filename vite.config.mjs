import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vite plugin to inject APP_DATA into index.html
 */
function injectAppDataPlugin() {
  return {
    name: 'inject-app-data',
    transformIndexHtml(html) {
      const dataPath = path.resolve(__dirname, 'app_data.json');
      let dataText = '{}';
      try {
        dataText = readFileSync(dataPath, 'utf8');
      } catch (e) {
        console.warn('⚠️ app_data.json not found, using empty object');
      }
      
      // Escape for script tag
      const escapedData = dataText
        .replaceAll('</script', '<\\/script')
        .replaceAll('<!--', '<\\!--');

      return html
        .replace('__APP_DATA_JSON__', escapedData)
        .replace('__APP_SCRIPT__', ''); 
    }
  };
}

export default {
  base: './',
  plugins: [
    injectAppDataPlugin(),
    viteSingleFile(),
  ],
  build: {
    outDir: 'dist-vite',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 10000,
  },
  server: {
    open: true,
    port: 3000
  }
};
