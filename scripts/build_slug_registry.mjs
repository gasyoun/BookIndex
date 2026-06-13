#!/usr/bin/env node
// A2: freeze entity URL slugs so canonical URIs stay stable across releases.
//
// Slugs are keyed by the entity's stable `canonical_id` (UUID). Once a slug is
// assigned it never changes — even if the head is later renamed — so existing
// citations never break. New entities get a fresh, collision-resolved slug
// appended deterministically without perturbing existing ones.
//
// The registry (data/slug_registry.json) is the source of truth consumed by
// scripts/prerender.mjs. On the FIRST run against an empty registry it
// reproduces exactly the slugs the prerenderer computes today, so no existing
// URL changes when the freeze is introduced.
//
// Usage:
//   node scripts/build_slug_registry.mjs            # update registry in place
//   node scripts/build_slug_registry.mjs --check    # report drift, write nothing
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP_DATA = path.join(ROOT, 'app_data.json');
const REGISTRY = path.join(ROOT, 'data', 'slug_registry.json');

// type key -> app_data key (prerender uses 'subject' for subject_index)
const TYPES = {
  names: 'names', toponyms: 'toponyms', ethnonyms: 'ethnonyms', languages: 'languages',
  lexicon: 'lexicon', lexicon_reverse: 'lexicon_reverse', lexicon_tech: 'lexicon_tech',
  subject: 'subject_index',
};

const MAX_HASH_SLUG_LENGTH = 60;
const CYRILLIC_TO_LATIN_MAP = Object.freeze({
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
  'я': 'ya', 'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g',
});

// EXACT copy of prerender.mjs normalizeHashSlug — keep in sync.
function normalizeHashSlug(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim().toLowerCase();
  if (!text) return '';
  if (typeof text.normalize === 'function') text = text.normalize('NFD');
  text = text.replace(/[̀-ͯ]/g, '');
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isAsciiAlpha = code >= 97 && code <= 122;
    const isAsciiDigit = code >= 48 && code <= 57;
    if (isAsciiAlpha || isAsciiDigit) { out += ch; continue; }
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN_MAP, ch)) { out += CYRILLIC_TO_LATIN_MAP[ch]; continue; }
    out += '-';
  }
  out = out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  if (!out) return '';
  if (out.length > MAX_HASH_SLUG_LENGTH) out = out.slice(0, MAX_HASH_SLUG_LENGTH).replace(/-+$/g, '');
  return out;
}

// EXACT collision resolution matching prerender.mjs buildHashSlugIndexesForItems.
function assignSlug(head, used) {
  const base = normalizeHashSlug(head) || 'item';
  let slug = base;
  let suffix = 2;
  while (used.has(slug)) {
    const suffixToken = `-${suffix}`;
    const keep = Math.max(1, MAX_HASH_SLUG_LENGTH - suffixToken.length);
    const trimmedBase = (base.slice(0, keep).replace(/-+$/g, '') || 'item');
    slug = `${trimmedBase}${suffixToken}`;
    suffix += 1;
  }
  return slug;
}

function entityKey(it) {
  return (typeof it.canonical_id === 'string' && it.canonical_id) ? it.canonical_id : `head:${it.head}`;
}

function main() {
  const check = process.argv.includes('--check');
  const app = JSON.parse(readFileSync(APP_DATA, 'utf-8'));
  const prev = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf-8')) : { version: 1, types: {} };
  const prevTypes = prev.types || {};

  const out = { version: 1, types: {} };
  let kept = 0, added = 0, renamed = 0;
  const renames = [];

  for (const [type, dataKey] of Object.entries(TYPES)) {
    const items = Array.isArray(app[dataKey]) ? app[dataKey] : [];
    const frozen = prevTypes[type] || {};
    const used = new Set(Object.values(frozen).map((e) => e.slug));
    const reg = {};
    // pass 1: keep frozen slugs (URL stability), refresh head, note renames
    for (const it of items) {
      const key = entityKey(it);
      if (frozen[key]) {
        reg[key] = { slug: frozen[key].slug, head: it.head };
        kept += 1;
        if (frozen[key].head !== it.head) { renamed += 1; renames.push(`${type}: "${frozen[key].head}" -> "${it.head}" (slug ${frozen[key].slug} kept)`); }
      }
    }
    // pass 2: assign new entities in array order (reproduces current slugs on first run)
    for (const it of items) {
      const key = entityKey(it);
      if (reg[key]) continue;
      const slug = assignSlug(it.head, used);
      used.add(slug);
      reg[key] = { slug, head: it.head };
      added += 1;
    }
    out.types[type] = reg;
  }

  console.log(`slug registry: kept ${kept}, added ${added}, renamed ${renamed}`);
  for (const r of renames.slice(0, 20)) console.log('  rename:', r);
  if (renamed > 20) console.log(`  …and ${renamed - 20} more renames`);

  if (check) {
    const drift = added + renamed;
    console.log(drift ? `--check: ${drift} entities would change the registry` : '--check: registry in sync');
    process.exit(0);
  }

  const text = JSON.stringify(out, null, 2) + '\n';
  writeFileSync(REGISTRY, text, 'utf-8');
  if (Buffer.from(text, 'utf-8').slice(0, 3).toString('hex') === 'efbbbf') throw new Error('BOM');
  console.log(`wrote ${path.relative(ROOT, REGISTRY)}`);
}

main();
