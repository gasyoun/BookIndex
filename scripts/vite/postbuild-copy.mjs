import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const source = path.resolve(rootDir, 'dist-vite', 'index.html');
const targetDir = rootDir;
const target = path.resolve(targetDir, 'aaz-index.html');

if (!existsSync(source)) {
  throw new Error(`Vite output file not found: ${source}`);
}

if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
