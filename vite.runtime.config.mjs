import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/runtime/entry.js'),
      name: 'BookIndex',
      formats: ['iife'],
      fileName: () => 'v3_app.js',
    },
    outDir: 'dist-runtime',
    emptyOutDir: true,
    minify: false, // Keep it highly readable and reviewable for the user
    sourcemap: false,
    rollupOptions: {
      treeshake: false // Prevent stripping of functions called in HTML template or inline scripts
    }
  }
});
