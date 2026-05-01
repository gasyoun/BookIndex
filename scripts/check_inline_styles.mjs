import { readFileSync } from 'node:fs';

const file = 'v3_app.js';
const maxInlineStyles = 11;
const allowedInlineStylePatterns = [
  /class="bar-fill"[^`]*style="width:\$\{pct\}%"/,
  /class="epoch-card-head" style="--epoch-color:\$\{epochColor\};"/,
  /class="legend-dot" style="background:\$\{safeColor\(FAMILY_COLORS\[fam\], '#888'\)\}"/,
  /id="home-declarative-root"[^`]*style="--home-decl-padding:\$\{viewModel\.homeInnerPadding\};"/,
  /class="home-facts" style="--home-facts-space:\$\{viewModel\.compactHome \? 10 : 14\}px;--home-facts-line-height:\$\{viewModel\.compactHome \? 1\.55 : 1\.7\};"/,
  /id="home-featured-quote-decl"[^`]*style="--home-featured-padding:\$\{viewModel\.compactHome \? 8 : 10\}px;"/,
  /class="home-panel-inner" style="--home-inner-padding:\$\{homeInnerPadding\};"/,
  /class="home-facts" style="--home-facts-space:\$\{compactHome \? 10 : 14\}px;--home-facts-line-height:\$\{compactHome \? 1\.55 : 1\.7\};/,
  /id="home-featured-quote"[^`]*style="--home-featured-padding:\$\{compactHome \? 8 : 10\}px;"/,
  /class="scholar-recon-grid" style="--scholar-recon-columns:\$\{reconstructionColumns\};"/,
  /class="scholar-compare-cell" style="\$\{bg\}"/,
];
const source = readFileSync(file, 'utf8');
const lines = source.split(/\r?\n/);
const matches = [];

for (let i = 0; i < lines.length; i += 1) {
  if (/\sstyle="/.test(lines[i])) {
    matches.push({ line: i + 1, text: lines[i].trim() });
  }
}

if (matches.length > maxInlineStyles) {
  console.error(`[inline-styles] FAIL: ${file} has ${matches.length} inline style attributes; max is ${maxInlineStyles}.`);
  for (const match of matches) {
    console.error(`  ${match.line}: ${match.text}`);
  }
  process.exit(1);
}

const unexpected = matches.filter((match) => (
  !allowedInlineStylePatterns.some((pattern) => pattern.test(match.text))
));

if (unexpected.length) {
  console.error(`[inline-styles] FAIL: ${file} has unexpected inline style attributes.`);
  for (const match of unexpected) {
    console.error(`  ${match.line}: ${match.text}`);
  }
  process.exit(1);
}

console.log(`[inline-styles] OK: ${file} has ${matches.length}/${maxInlineStyles} inline style attributes.`);
