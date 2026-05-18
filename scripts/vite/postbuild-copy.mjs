import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
const stableHtml = readFileSync(target, 'utf8')
  .replace(/\.\/manifest-[^"']+\.webmanifest/g, './manifest.webmanifest')
  .replace(/\.\/icon-192-[^"']+\.svg/g, './icon-192.svg');
writeFileSync(target, stableHtml);
console.log(`Copied ${source} -> ${target}`);

function copyRecursive(sourcePath, targetPath) {
  const stat = statSync(sourcePath);
  if (stat.isDirectory()) {
    if (!existsSync(targetPath)) mkdirSync(targetPath, { recursive: true });
    for (const entry of readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }
  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}

for (const relPath of ['data/modules']) {
  const assetSource = path.resolve(rootDir, relPath);
  const assetTarget = path.resolve(rootDir, 'dist-vite', relPath);
  if (!existsSync(assetSource)) continue;
  if (assetSource === assetTarget) continue;
  copyRecursive(assetSource, assetTarget);
  console.log(`Copied ${assetSource} -> ${assetTarget}`);
}

const deployAssets = [
  'manifest.webmanifest',
  'manifest.json',
  'sw.js',
  'service-worker.js',
  'robots.txt',
  'sitemap.xml',
  'icon-192.svg',
  'icon-512.svg',
  'zaliznyak_portrait.png',
  'vendor',
];

for (const relPath of deployAssets) {
  const assetSource = path.resolve(rootDir, 'dist-vite', relPath);
  if (!existsSync(assetSource)) continue;
  const assetTarget = path.resolve(targetDir, relPath);
  copyRecursive(assetSource, assetTarget);
  console.log(`Copied ${assetSource} -> ${assetTarget}`);
}
