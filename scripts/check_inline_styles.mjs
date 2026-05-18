import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const files = [
  'v3_app.js',
  ...readdirSync(path.join(process.cwd(), 'scripts', 'viz'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join('scripts', 'viz', name)),
];
const maxInlineStyles = 0;
const matches = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (/\sstyle=["']/.test(lines[i])) {
      matches.push({ file, line: i + 1, text: lines[i].trim() });
    }
  }
}

if (matches.length > maxInlineStyles) {
  console.error(`[inline-styles] FAIL: checked files have ${matches.length} inline style attributes; max is ${maxInlineStyles}.`);
  for (const match of matches) {
    console.error(`  ${match.file}:${match.line}: ${match.text}`);
  }
  process.exit(1);
}

console.log(`[inline-styles] OK: checked ${files.length} files with ${matches.length}/${maxInlineStyles} inline style attributes.`);
