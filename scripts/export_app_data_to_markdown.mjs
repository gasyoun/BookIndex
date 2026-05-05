#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const TEXT_FIELD_PRIORITY = [
  'description',
  'desc',
  'definition',
  'about',
  'text',
  'main_idea',
  'event',
  'why',
  'why_read',
  'thesis',
  'verdict',
];

const DEFAULT_CORPUS_BOOK = {
  book_id: 'mumintroll',
  title: 'Из жизни слов и языков',
};

function parseArgs(argv) {
  const args = {
    input: './app_data.json',
    out: './src/content',
    clean: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--input' && argv[i + 1]) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--out' && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--clean') {
      args.clean = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }
  return args;
}

function printHelpAndExit(code) {
  console.log(
    [
      'Usage:',
      '  node scripts/export_app_data_to_markdown.mjs [--input app_data.json] [--out src/content] [--clean]',
      '',
      'Options:',
      '  --input <path>   Path to source JSON (default: ./app_data.json)',
      '  --out <path>     Output directory for .md files (default: ./src/content)',
      '  --clean          Remove output directory before export',
      '  --help           Show this help',
    ].join('\n')
  );
  process.exit(code);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const CYR_TO_LAT = new Map([
  ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'g'], ['д', 'd'], ['е', 'e'], ['ё', 'e'],
  ['ж', 'zh'], ['з', 'z'], ['и', 'i'], ['й', 'y'], ['к', 'k'], ['л', 'l'], ['м', 'm'],
  ['н', 'n'], ['о', 'o'], ['п', 'p'], ['р', 'r'], ['с', 's'], ['т', 't'], ['у', 'u'],
  ['ф', 'f'], ['х', 'h'], ['ц', 'ts'], ['ч', 'ch'], ['ш', 'sh'], ['щ', 'sch'],
  ['ъ', ''], ['ы', 'y'], ['ь', ''], ['э', 'e'], ['ю', 'yu'], ['я', 'ya'],
]);

function translitCyrToLat(value) {
  const input = String(value ?? '');
  let out = '';
  for (const ch of input) {
    const lower = ch.toLowerCase();
    if (CYR_TO_LAT.has(lower)) {
      out += CYR_TO_LAT.get(lower);
    } else {
      out += ch;
    }
  }
  return out;
}

function toFileSlug(value, fallback = 'item') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const slug = translitCyrToLat(raw)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);
  return slug || fallback;
}

function buildUniqueFileName(baseName, usedNames) {
  const base = toFileSlug(baseName, 'item');
  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return `${candidate}.md`;
}

function firstTextField(entity) {
  if (!entity || typeof entity !== 'object') return '';
  for (const key of TEXT_FIELD_PRIORITY) {
    const value = entity[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function formatFrontmatter(meta) {
  const lines = ['---'];
  lines.push(`id: ${JSON.stringify(meta.id)}`);
  lines.push(`title: ${JSON.stringify(meta.title)}`);
  lines.push(`source_key: ${JSON.stringify(meta.sourceKey)}`);
  if (meta.source) lines.push(`source: ${JSON.stringify(meta.source)}`);
  if (meta.bookId) lines.push(`book_id: ${JSON.stringify(meta.bookId)}`);
  if (Number.isFinite(meta.index)) lines.push(`source_index: ${meta.index}`);
  lines.push(`tags: ${JSON.stringify(meta.tags)}`);
  lines.push('---');
  return lines.join('\n');
}

function normalizeBodyText(text) {
  if (!text) return '';
  return String(text).replace(/\r\n/g, '\n').trim();
}

function formatListValue(value) {
  return Array.isArray(value) && value.length ? value.join(', ') : 'n/a';
}

function buildCorpusRegistryMarkdown({ data, value }) {
  const corpus = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const corpusMeta = getCorpusBookMeta(data, corpus);
  const frontmatter = formatFrontmatter({
    id: 'corpus',
    title: 'corpus',
    sourceKey: 'corpus',
    source: corpusMeta.source,
    bookId: corpusMeta.bookId,
    index: null,
    tags: ['corpus'],
  });
  const books = Array.isArray(corpus.books) ? corpus.books.filter((book) => book && typeof book === 'object') : [];
  const sourceTypes = Array.isArray(corpus.source_types)
    ? corpus.source_types.filter((sourceType) => sourceType && typeof sourceType === 'object')
    : [];
  const lines = [
    frontmatter,
    '',
    `Active book: ${corpusMeta.source} (${corpusMeta.bookId}).`,
    '',
    '## Books',
    '',
  ];

  if (books.length) {
    for (const book of books) {
      const title = String(book.title || book.short_title || book.book_id || 'Untitled');
      const author = book.author ? `, ${book.author}` : '';
      const year = book.year ? `, ${book.year}` : '';
      const pages = Number.isFinite(book.pages_total) ? `, ${book.pages_total} pages` : '';
      const modules = Array.isArray(book.content_modules) ? `; modules: ${book.content_modules.join(', ')}` : '';
      lines.push(`- ${title}${author}${year}${pages}${modules}`);
    }
  } else {
    lines.push('- n/a');
  }

  lines.push('', '## Source types', '');
  if (sourceTypes.length) {
    for (const sourceType of sourceTypes) {
      const label = String(sourceType.label || sourceType.title || sourceType.type || 'Untitled');
      const status = sourceType.status ? `; status: ${sourceType.status}` : '';
      const plannedCount = Number.isFinite(sourceType.planned_count) ? `; planned: ${sourceType.planned_count}` : '';
      lines.push(`- ${label} (${sourceType.type || 'source'}): ${formatListValue(sourceType.supports)}${status}${plannedCount}`);
    }
  } else {
    lines.push('- n/a');
  }

  const rawJson = JSON.stringify(corpus, null, 2);
  lines.push('', '## Source JSON', '', '```json', rawJson, '```', '');
  return lines.join('\n');
}

function getCorpusBookMeta(data, entity) {
  const corpus = data && typeof data === 'object' && data.corpus && typeof data.corpus === 'object'
    ? data.corpus
    : {};
  const books = Array.isArray(corpus.books) ? corpus.books.filter((book) => book && typeof book === 'object') : [];
  const explicitBookId = entity && typeof entity === 'object'
    ? String(entity.book_id || entity.bookId || '').trim()
    : '';
  const activeBookId = String(corpus.active_book_id || '').trim();
  const wantedBookId = explicitBookId || activeBookId;
  const book = books.find((item) => item.book_id === wantedBookId) || books[0] || DEFAULT_CORPUS_BOOK;
  const bookId = String(book.book_id || wantedBookId || DEFAULT_CORPUS_BOOK.book_id);
  const source = String(book.short_title || book.title || book.book_id || DEFAULT_CORPUS_BOOK.title);
  return { bookId, source };
}

function buildEntityMarkdown({ data, sourceKey, entity, index }) {
  const objectEntity = entity && typeof entity === 'object' ? entity : {};
  const id = String(objectEntity.id || objectEntity.head || `${sourceKey}_${index + 1}`);
  const title = String(objectEntity.title || objectEntity.head || objectEntity.name || id);
  const body = normalizeBodyText(firstTextField(objectEntity));
  const corpusMeta = getCorpusBookMeta(data, objectEntity);
  const frontmatter = formatFrontmatter({
    id,
    title,
    sourceKey,
    source: corpusMeta.source,
    bookId: corpusMeta.bookId,
    index,
    tags: [sourceKey],
  });

  const rawJson = JSON.stringify(objectEntity, null, 2);
  const bodyText = body || '_Основное текстовое поле не найдено; см. JSON ниже._';
  return `${frontmatter}\n\n${bodyText}\n\n## Source JSON\n\n\`\`\`json\n${rawJson}\n\`\`\`\n`;
}

function buildTopLevelMarkdown({ data, key, value }) {
  if (key === 'corpus') {
    return buildCorpusRegistryMarkdown({ data, value });
  }

  const body = normalizeBodyText(firstTextField(value));
  const corpusMeta = getCorpusBookMeta(data, value);
  const frontmatter = formatFrontmatter({
    id: key,
    title: key,
    sourceKey: key,
    source: corpusMeta.source,
    bookId: corpusMeta.bookId,
    index: null,
    tags: [key],
  });
  const rawJson = JSON.stringify(value, null, 2);
  const bodyText = body || '_Текстовое поле верхнего уровня не найдено; см. JSON ниже._';
  return `${frontmatter}\n\n${bodyText}\n\n## Source JSON\n\n\`\`\`json\n${rawJson}\n\`\`\`\n`;
}

function exportToMarkdown({ inputPath, outDir, clean }) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Root JSON must be an object');
  }

  if (clean && fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  ensureDir(outDir);

  const stats = {
    files: 0,
    sections: 0,
  };
  const usedFileNames = new Set();

  for (const [key, value] of Object.entries(data)) {
    stats.sections += 1;
    if (Array.isArray(value)) {
      if (!value.length) {
        const fileName = buildUniqueFileName(key, usedFileNames);
        const corpusMeta = getCorpusBookMeta(data, null);
        const emptyMd = `${formatFrontmatter({
          id: key,
          title: key,
          sourceKey: key,
          source: corpusMeta.source,
          bookId: corpusMeta.bookId,
          index: null,
          tags: [key],
        })}\n\n_Раздел пуст._\n`;
        fs.writeFileSync(path.join(outDir, fileName), emptyMd, 'utf-8');
        stats.files += 1;
        continue;
      }

      value.forEach((entity, index) => {
        const objectEntity = entity && typeof entity === 'object' ? entity : { value: entity };
        const identity =
          objectEntity.id
          || objectEntity.slug
          || objectEntity.head
          || objectEntity.title
          || objectEntity.name
          || `${key}_${index + 1}`;
        const fileName = buildUniqueFileName(identity, usedFileNames);
        const filePath = path.join(outDir, fileName);
        const content = buildEntityMarkdown({ data, sourceKey: key, entity: objectEntity, index });
        fs.writeFileSync(filePath, content, 'utf-8');
        stats.files += 1;
      });
      continue;
    }

    const fileName = buildUniqueFileName(key, usedFileNames);
    const filePath = path.join(outDir, fileName);
    const content = buildTopLevelMarkdown({ data, key, value });
    fs.writeFileSync(filePath, content, 'utf-8');
    stats.files += 1;
  }

  return stats;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const inputPath = path.resolve(cwd, args.input);
  const outDir = path.resolve(cwd, args.out);

  const stats = exportToMarkdown({
    inputPath,
    outDir,
    clean: args.clean,
  });

  console.log(`✅ Migration completed.`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outDir}`);
  console.log(`Sections: ${stats.sections}`);
  console.log(`Files:    ${stats.files}`);
}

main();
