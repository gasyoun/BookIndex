import fs from 'node:fs';
import path from 'node:path';

// Helper function to recursively ensure directories exist
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// 1. Load data and templates
console.log('Loading app_data.json...');
const appData = JSON.parse(fs.readFileSync('app_data.json', 'utf8'));

// A2: frozen slug registry (data/slug_registry.json) keyed by canonical_id.
// Slugs here are authoritative and stable across releases. If missing, the
// builder below falls back to computing slugs on the fly (and warns).
const SLUG_REGISTRY = (() => {
  try { return JSON.parse(fs.readFileSync(path.join('data', 'slug_registry.json'), 'utf8')).types || {}; }
  catch { console.warn('[slugs] data/slug_registry.json missing — run `npm run slug:freeze`; using computed slugs'); return {}; }
})();
function registrySlugFor(type, it) {
  const reg = SLUG_REGISTRY[type];
  if (!reg) return null;
  const key = (typeof it.canonical_id === 'string' && it.canonical_id) ? it.canonical_id : `head:${it.head}`;
  return reg[key] ? reg[key].slug : null;
}

console.log('Loading aaz-index.html...');
const baseTemplate = fs.readFileSync('aaz-index.html', 'utf8');

// Helper to escape HTML characters
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  let text = String(s);
  return text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

// Pluralization for pages
function pluralPages(count) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'страницах';
  if (n1 > 1 && n1 < 5) return 'страницах';
  if (n1 === 1) return 'странице';
  return 'страницах';
}

// Transliteration Map for Cyrillic to Latin slugs
const CYRILLIC_TO_LATIN_MAP = Object.freeze({
  '\u0430': 'a', '\u0431': 'b', '\u0432': 'v', '\u0433': 'g', '\u0434': 'd', '\u0435': 'e', '\u0451': 'yo', '\u0436': 'zh',
  '\u0437': 'z', '\u0438': 'i', '\u0439': 'y', '\u043a': 'k', '\u043b': 'l', '\u043c': 'm', '\u043d': 'n', '\u043e': 'o',
  '\u043f': 'p', '\u0440': 'r', '\u0441': 's', '\u0442': 't', '\u0443': 'u', '\u0444': 'f', '\u0445': 'kh', '\u0446': 'ts',
  '\u0447': 'ch', '\u0448': 'sh', '\u0449': 'shch', '\u044a': '', '\u044b': 'y', '\u044c': '', '\u044d': 'e', '\u044e': 'yu',
  '\u044f': 'ya', '\u0456': 'i', '\u0457': 'yi', '\u0454': 'ye', '\u0491': 'g'
});

const MAX_HASH_SLUG_LENGTH = 60;

function normalizeHashSlug(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim().toLowerCase();
  if (!text) return '';
  if (typeof text.normalize === 'function') text = text.normalize('NFD');
  text = text.replace(/[\u0300-\u036f]/g, '');

  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isAsciiAlpha = code >= 97 && code <= 122;
    const isAsciiDigit = code >= 48 && code <= 57;
    if (isAsciiAlpha || isAsciiDigit) {
      out += ch;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(CYRILLIC_TO_LATIN_MAP, ch)) {
      out += CYRILLIC_TO_LATIN_MAP[ch];
      continue;
    }
    out += '-';
  }
  out = out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!out) return '';
  if (out.length > MAX_HASH_SLUG_LENGTH) {
    out = out.slice(0, MAX_HASH_SLUG_LENGTH).replace(/-+$/g, '');
  }
  return out;
}

function buildHashSlugIndexesForItems(items, type) {
  const byHead = new Map();
  const bySlug = new Map();
  if (!Array.isArray(items)) return { byHead, bySlug };

  for (const it of items) {
    const head = String(it && it.head ? it.head : '').trim();
    if (!head || byHead.has(head)) continue;

    // Prefer the frozen registry slug (URL stability); else compute on the fly.
    let slug = type ? registrySlugFor(type, it) : null;
    if (!slug) {
      const base = normalizeHashSlug(head) || 'item';
      slug = base;
      let suffix = 2;
      while (bySlug.has(slug) && bySlug.get(slug) !== head) {
        const suffixToken = `-${suffix}`;
        const keep = Math.max(1, MAX_HASH_SLUG_LENGTH - suffixToken.length);
        const trimmedBase = (base.slice(0, keep).replace(/-+$/g, '') || 'item');
        slug = `${trimmedBase}${suffixToken}`;
        suffix += 1;
      }
    }
    byHead.set(head, slug);
    if (!bySlug.has(slug)) bySlug.set(slug, head);
  }
  return { byHead, bySlug };
}

// 2. Build slug indexes for all categories
console.log('Building slug indexes...');
const names = appData.names || [];
const toponyms = appData.toponyms || [];
const ethnonyms = appData.ethnonyms || [];
const languages = appData.languages || [];
const lexicon = appData.lexicon || [];
const lexicon_reverse = appData.lexicon_reverse || [];
const lexicon_tech = appData.lexicon_tech || [];
const subject = appData.subject_index || [];

const slugIndexes = {
  names: buildHashSlugIndexesForItems(names, 'names'),
  toponyms: buildHashSlugIndexesForItems(toponyms, 'toponyms'),
  ethnonyms: buildHashSlugIndexesForItems(ethnonyms, 'ethnonyms'),
  languages: buildHashSlugIndexesForItems(languages, 'languages'),
  lexicon: buildHashSlugIndexesForItems(lexicon, 'lexicon'),
  lexicon_reverse: buildHashSlugIndexesForItems(lexicon_reverse, 'lexicon_reverse'),
  lexicon_tech: buildHashSlugIndexesForItems(lexicon_tech, 'lexicon_tech'),
  subject: buildHashSlugIndexesForItems(subject, 'subject')
};

function getItemsByType(type) {
  if (type === 'names') return names;
  if (type === 'toponyms') return toponyms;
  if (type === 'ethnonyms') return ethnonyms;
  if (type === 'languages') return languages;
  if (type === 'lexicon') return lexicon;
  if (type === 'lexicon_reverse') return lexicon_reverse;
  if (type === 'lexicon_tech') return lexicon_tech;
  if (type === 'subject') return subject;
  return [];
}

// 3. Path prefix adapter
function getRelativePrefix(filePath) {
  const depth = filePath.split('/').length - 1;
  return '../'.repeat(depth);
}

function adaptRelativePaths(htmlText, relativePrefix) {
  return htmlText.replace(/(href|src)="(\.\/)([^"]+)"/g, (match, attr, dotSlash, path) => {
    return `${attr}="${relativePrefix}${path}"`;
  });
}

// 4. Citation Widget pre-renderer
function renderCitationWidget(type, id, title, book, url) {
  const containerId = `citation-widget-${type}-${id || 'card'}`;
  const d = new Date();
  const day = d.getDate();
  const year = d.getFullYear();
  const dateFormatted = `${String(day).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${year}`;

  let gostText = '';
  if (type === 'lecture') {
    gostText = `Зализняк А. А. ${title} // Из жизни слов и языков. — BookIndex Digital Humanities Project, 2026. — URL: <a href="${url}" target="_blank">${url}</a> (дата обращения: ${dateFormatted}).`;
  } else {
    gostText = `Зализняк А. А. ${title} // Из жизни слов и языков: интерактивный академический справочник и корпус, 2026. — URL: <a href="${url}" target="_blank">${url}</a> (дата обращения: ${dateFormatted}).`;
  }

  return `
    <div class="citation-widget" id="${containerId}">
      <div class="citation-widget-title">Цитировать / Cite</div>
      <div class="citation-tabs">
        <button type="button" class="citation-tab-btn active" data-style="gost">ГОСТ</button>
        <button type="button" class="citation-tab-btn" data-style="apa">APA</button>
        <button type="button" class="citation-tab-btn" data-style="mla">MLA</button>
        <button type="button" class="citation-tab-btn" data-style="chicago">Chicago</button>
      </div>
      <div class="citation-box-container">
        <div class="citation-box" id="${containerId}-box" aria-live="polite">${gostText}</div>
        <button type="button" class="citation-copy-btn" id="${containerId}-copy-btn">Копировать</button>
      </div>
    </div>
  `;
}

// 5. Layout renderers
function renderLectureHtml(lectureId, l) {
  const title = lectureId === 0 ? 'Предисловие' : `Лекция ${lectureId}`;
  let html = `<div class="panel active lecture-page"><div class="lecture-page-inner">`;
  html += `<div class="lecture-page-nav">
    <button id="lecture-prev" class="lecture-page-nav-btn"${lectureId <= 0 ? ' disabled style="opacity:0.5"' : ''}>← Предыдущая</button>
    <button id="lecture-all" class="lecture-page-nav-btn">Ко всем лекциям</button>
    <button id="lecture-next" class="lecture-page-nav-btn"${lectureId >= 10 ? ' disabled style="opacity:0.5"' : ''}>Следующая →</button>
  </div>`;
  html += `<div class="lecture-page-card">
    <div class="lecture-page-meta">${title} · стр. ${escapeHtml(l.pages || '')}</div>
    <h2 class="lecture-page-title">${escapeHtml(l.name || '')}</h2>
    <div class="lecture-page-idea">${escapeHtml(l.main_idea || '')}</div>
    <h3 class="lecture-page-section">Ключевые факты</h3>
    <ul class="lecture-page-facts">`;
  for (const fact of (l.key_facts || [])) {
    html += `<li>${escapeHtml(fact)}</li>`;
  }
  html += `</ul>
    <h3 class="lecture-page-section">Термины</h3>
    <div class="lecture-page-terms">`;
  for (const t of (l.terms || [])) {
    const raw = String(t || '').trim();
    const q = raw.toLowerCase();
    const glossary = appData.glossary || [];
    const hasGlossaryHit = glossary.some(g => {
      const gt = String(g.term || '').toLowerCase();
      return gt.includes(q) || q.includes(gt);
    });
    const hash = hasGlossaryHit
      ? `#v4/materials/glossary/term/${encodeURIComponent(q)}`
      : `#v4/all/list/q/${encodeURIComponent(raw)}`;

    html += `<a class="lecture-term-chip" data-term="${escapeHtml(q)}" href="${escapeHtml(hash)}">${escapeHtml(raw)}</a>`;
  }
  html += `</div>
    <div class="lecture-page-why">${escapeHtml(l.why_read || '')}</div>
    ${renderCitationWidget(
      'lecture',
      lectureId,
      lectureId === 0 ? `Предисловие: ${l.name}` : `Лекция ${lectureId}. ${l.name}`,
      'Из жизни слов и языков',
      `https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lecture_pages/${lectureId}`
    )}
  </div>`;

  if (lectureId === 0 && Array.isArray(appData.further_reading) && appData.further_reading.length) {
    html += `<div class="lecture-page-further">
      <div class="lecture-page-further-head">
        <h3 class="lecture-page-further-title">Что почитать ещё</h3>
        <button id="go-further-reading" class="lecture-page-further-btn">Открыть весь раздел</button>
      </div>`;
    for (const sec of appData.further_reading) {
      html += `<div class="lecture-page-further-section">
        <div class="lecture-page-further-topic">${escapeHtml(sec.topic || '')}</div>`;
      for (const b of (sec.books || [])) {
        html += `<div class="lecture-page-further-book">• <strong>${escapeHtml(b.title || '')}</strong>: ${escapeHtml(b.why || '')}</div>`;
      }
      html += '</div>';
    }
    html += `</div>`;
  }

  html += `</div></div>`;
  return html;
}

function renderSectionListingHtml(type, title, items) {
  let html = `<div class="panel active index-list-page" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">`;
  html += `<h2 style="color: var(--title); margin-top: 0; margin-bottom: 12px;">${escapeHtml(title)}</h2>`;
  html += `<div class="index-list-intro" style="color: var(--muted); margin-bottom: 20px; line-height: 1.6;">В данном разделе представлено ${items.length} объектов справочника. Ниже перечислены наиболее важные из них, подробно описанные и обсужденные в книге. Выберите любой объект для просмотра детальной статьи.</div>`;
  html += `<ul class="index-list-items" style="list-style-type: none; padding-left: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px;">`;
  for (const it of items) {
    const slug = slugIndexes[type].byHead.get(it.head);
    const itemPath = `./item/${type}/${slug}/index.html`;
    html += `<li style="background: var(--panel); border: 1px solid var(--line-soft); border-radius: 8px; padding: 12px; transition: transform 0.2s;">
      <a href="${escapeHtml(itemPath)}" style="font-weight: 600; color: var(--color-primary); text-decoration: none;">${escapeHtml(it.head)}</a>
      ${it.discussed ? ' <span class="discussed-badge" style="display:inline-block; padding: 2px 6px; font-size: 0.75rem; background: var(--surface-soft-2); border-radius: 4px; color: var(--color-gold); font-weight: bold; margin-left: 6px;">обсуждается</span>' : ''}
    </li>`;
  }
  html += `</ul></div>`;
  return html;
}

function renderAllListingHtml() {
  let html = `<div class="panel active index-list-page" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">`;
  html += `<h2 style="color: var(--title); margin-top: 0; margin-bottom: 12px;">Сводный указатель терминов, имен и языков</h2>`;
  html += `<div class="index-list-intro" style="color: var(--muted); margin-bottom: 20px; line-height: 1.6;">Сводный указатель объединяет все структурированные лингвистические и исторические объекты книги А. А. Зализняка «Из жизни слов и языков». Ниже приведены категории и выборки из 3376 объектов указателя.</div>`;
  
  const categories = [
    { type: 'names', label: 'Имена' },
    { type: 'toponyms', label: 'Географические названия (топонимы)' },
    { type: 'ethnonyms', label: 'Этнонимы' },
    { type: 'languages', label: 'Языки мира и диалекты' },
    { type: 'lexicon', label: 'Сводный лексический указатель' },
    { type: 'subject', label: 'Предметный указатель' },
  ];

  for (const cat of categories) {
    const list = getItemsByType(cat.type).filter(it => it.discussed === true);
    html += `<h3 style="color: var(--title); font-size: 1.3rem; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid var(--line-soft); padding-bottom: 6px;">${escapeHtml(cat.label)}</h3>`;
    html += `<ul class="index-list-items inline-list" style="list-style-type: none; padding-left: 0; display: flex; flex-wrap: wrap; gap: 8px;">`;
    for (const it of list.slice(0, 80)) {
      const slug = slugIndexes[cat.type].byHead.get(it.head);
      const itemPath = `../../${cat.type}/list/item/${cat.type}/${slug}/index.html`;
      html += `<li style="background: var(--panel); border: 1px solid var(--line-soft); border-radius: 6px; padding: 6px 12px;">
        <a href="${escapeHtml(itemPath)}" style="color: var(--color-primary); text-decoration: none; font-weight: 500;">${escapeHtml(it.head)}</a>
      </li>`;
    }
    if (list.length > 80) {
      html += `<li style="padding: 6px 12px;">
        <a href="../../${cat.type}/list/index.html" style="color: var(--color-gold); text-decoration: none; font-weight: bold;">Посмотреть все (${list.length}) →</a>
      </li>`;
    }
    html += `</ul>`;
  }
  html += `</div>`;
  return html;
}

function renderLecturesLandingHtml() {
  let html = `<div class="panel active lectures-landing-page" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">`;
  html += `<h2 style="color: var(--title); margin-top: 0; margin-bottom: 12px;">Лекции А. А. Зализняка</h2>`;
  html += `<div class="lectures-landing-intro" style="color: var(--muted); margin-bottom: 24px; line-height: 1.6;">Цикл научно-популярных лекций по истории языка, этимологии и праславянской реконструкции, прочитанных выдающимся российским лингвистом, академиком А. А. Зализняком в московской школе «Муми-тролль» с 2005 по 2017 год.</div>`;
  html += `<div class="lectures-grid" style="display: grid; grid-template-columns: 1fr; gap: 16px;">`;
  const lectures = appData.lectures || [];
  for (let i = 0; i < lectures.length; i++) {
    const l = lectures[i];
    const lTitle = i === 0 ? 'Предисловие' : `Лекция ${i}`;
    const path = `../lecture_pages/${i}/index.html`;
    html += `<div class="lecture-card" style="background: var(--panel); border: 1px solid var(--line-soft); border-radius: 8px; padding: 16px;">
      <div class="lecture-card-meta" style="font-size: 0.85rem; color: var(--muted); font-weight: 600; margin-bottom: 6px;">${lTitle} · стр. ${escapeHtml(l.pages || '')}</div>
      <h3 class="lecture-card-title" style="margin: 0 0 8px 0; font-size: 1.25rem;"><a href="${escapeHtml(path)}" style="color: var(--color-primary); text-decoration: none; font-weight: bold;">${escapeHtml(l.name || '')}</a></h3>
      <p class="lecture-card-idea" style="margin: 0; color: var(--text); line-height: 1.5; font-style: italic;">${escapeHtml(l.main_idea || '')}</p>
    </div>`;
  }
  html += `</div></div>`;
  return html;
}

function renderSourcesHtml() {
  let html = `<div class="panel active sources-page" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">`;
  html += `<h2 style="color: var(--title); margin-top: 0; margin-bottom: 12px;">Корпус и источники</h2>`;
  html += `<div class="sources-intro" style="color: var(--muted); margin-bottom: 20px; line-height: 1.6;">Научный аппарат и источниковедческая база интерактивного академического справочника «Зализнякиада».</div>`;
  html += `<h3 style="color: var(--title); font-size: 1.3rem; margin-top: 24px; margin-bottom: 12px;">Книги и публикации А. А. Зализняка в корпусе:</h3>`;
  const books = appData.corpus?.books || [];
  for (const b of books) {
    html += `<div class="source-book-block" style="background: var(--panel); border: 1px solid var(--line-soft); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h4 style="margin: 0 0 10px 0; color: var(--color-primary); font-size: 1.1rem; font-weight: bold;">${escapeHtml(b.title)}</h4>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
        <li><strong>Автор:</strong> ${escapeHtml(b.author)}</li>
        <li><strong>Год:</strong> ${escapeHtml(String(b.year))}</li>
        <li><strong>Издание:</strong> ${escapeHtml(b.edition || '')}</li>
        <li><strong>Общий объем:</strong> ${escapeHtml(String(b.pages_total))} стр.</li>
      </ul>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderVizLandingHtml() {
  let html = `<div class="panel active viz-landing-page" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">`;
  html += `<h2 style="color: var(--title); margin-top: 0; margin-bottom: 12px;">Интерактивные визуализации</h2>`;
  html += `<div class="viz-intro" style="color: var(--muted); margin-bottom: 20px; line-height: 1.6;">В BookIndex интегрированы 7 динамических модулей визуализации, представляющих связи между лингвистическими и историческими данными в книге А. А. Зализняка «Из жизни слов и языков».</div>`;
  html += `<ul style="line-height: 1.8;">
    <li><strong>Карта мира:</strong> картографирование географического распространения топонимов, языков и этнонимов.</li>
    <li><strong>Графы связей:</strong> графы взаимодействия ученых и генеалогические древа языковых семей.</li>
    <li><strong>Хронология открытий:</strong> временные шкалы открытий и научных гипотез.</li>
    <li><strong>Динамика по страницам:</strong> тепловые карты упоминаемости.</li>
  </ul>`;
  html += `</div>`;
  return html;
}

function renderTasksHtml() {
  let html = `<div class="panel active tasks-page" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">`;
  html += `<h2 style="color: var(--title); margin-top: 0; margin-bottom: 12px;">Интерактивный практикум</h2>`;
  html += `<div class="tasks-intro" style="color: var(--muted); margin-bottom: 20px; line-height: 1.6;">Проверьте себя на знание материалов лекций, лингвистических законов и закономерностей, описанных в книге А. А. Зализняка «Из жизни слов и языков».</div>`;
  const tasks = appData.tasks || [];
  if (tasks.length > 0) {
    html += `<ul class="tasks-list" style="line-height: 1.8;">`;
    for (const t of tasks) {
      html += `<li><strong>Вопрос:</strong> ${escapeHtml(t.question)}</li>`;
    }
    html += `</ul>`;
  } else {
    html += `<div class="panel-empty-state" style="color: var(--muted); font-style: italic;">Вопросы и задания для самопроверки скоро появятся.</div>`;
  }
  html += `</div>`;
  return html;
}

function renderItemHtml(type, it) {
  const photo = it.img ? `<img class="card-photo" src="${escapeHtml(it.img)}" alt="" style="max-width:220px;border-radius:8px;margin-bottom:16px;">` : '';
  const wikiLink = it.wiki ? `<a class="wiki-link" href="${escapeHtml(it.wiki)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-orange); text-decoration: none; font-weight: bold;">Статья в Википедии →</a>` : '';
  
  let category = '';
  if (type === 'names') {
    const labels = appData.labels || {};
    category = labels[it.subcategory] || 'Имя';
  } else if (type === 'toponyms') {
    category = 'Топоним';
    if (it.epoch_class && it.epoch_class !== 'unknown') {
      const epochLabels = appData.epoch_labels || {};
      category += ' · ' + (epochLabels[it.epoch_class] || it.epoch_class);
    }
  } else if (type === 'ethnonyms') {
    category = 'Этноним';
  } else if (type === 'languages') {
    category = 'Язык';
    if (it.family) category += ' · ' + it.family + (it.group && it.group !== it.family ? ' / ' + it.group : '');
  } else if (type === 'lexicon') {
    category = 'Лексема';
  } else if (type === 'lexicon_tech') {
    category = 'Реконструированная или иноязычная форма';
  } else if (type === 'lexicon_reverse') {
    category = 'Лексема (обратный алфавит)';
  } else if (type === 'subject') {
    category = it.needs_review ? 'Понятие / термин (требует сверки)' : 'Понятие / термин';
  }

  const allPages = Array.isArray(it.page_list) ? it.page_list.sort((a,b) => a-b) : [];
  const itemSources = Array.isArray(it.sources) ? it.sources : [];
  
  let html = `
    <div class="card panel active" style="padding: 24px; background: var(--surface); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px;">
      <div class="card-header" style="display: flex; gap: 24px; flex-wrap: wrap;">
        ${photo}
        <div class="card-title-block" style="flex: 1; min-width: 250px;">
          <h2 style="font-size: 2rem; color: var(--title); margin-top: 0; margin-bottom: 8px;">${escapeHtml(it.head)}</h2>
          <div class="category" style="font-weight: 600; color: var(--muted); margin-bottom: 12px;">${escapeHtml(category)}</div>
          ${wikiLink ? `<div style="margin-bottom: 16px;">${wikiLink}</div>` : ''}
        </div>
      </div>
      <hr style="border: 0; border-top: 1px solid var(--line-soft); margin: 24px 0;">
      <div class="pages-info" style="margin-bottom: 20px;">
        <strong>Упоминается на ${allPages.length} ${pluralPages(allPages.length)}:</strong>
        <span class="pages-links" style="color: var(--color-gold); font-weight: 500;">${allPages.join(', ')}</span>
        ${it.discussed ? ' · <span style="color: var(--color-success); font-weight: 600;">обсуждается</span>' : ' · однократное упоминание'}
      </div>`;

  // Contexts (KWIC)
  if (it.contexts && typeof it.contexts === 'object') {
    html += `<h3 style="color: var(--title); font-size: 1.3rem; margin-top: 24px; margin-bottom: 12px;">Контексты упоминаний (KWIC)</h3>`;
    if (Array.isArray(it.contexts)) {
      for (const ctx of it.contexts.slice(0, 10)) {
        html += `
          <div class="context-item" style="padding: 12px; background: var(--panel); border-left: 4px solid var(--line-strong); margin-bottom: 12px; border-radius: 0 8px 8px 0;">
            <div class="context-text" style="font-style: italic; line-height: 1.6;">${escapeHtml(ctx)}</div>
          </div>`;
      }
    } else {
      const ctxKeys = Object.keys(it.contexts).sort((a, b) => parseInt(a) - parseInt(b));
      for (const pg of ctxKeys.slice(0, 10)) {
        const ctxs = it.contexts[pg];
        for (const ctx of ctxs.slice(0, 1)) {
          html += `
            <div class="context-item" style="padding: 12px; background: var(--panel); border-left: 4px solid var(--line-strong); margin-bottom: 12px; border-radius: 0 8px 8px 0;">
              <div class="context-page" style="font-weight: bold; font-size: 0.9rem; color: var(--muted); margin-bottom: 4px;">стр. ${pg}</div>
              <div class="context-text" style="font-style: italic; line-height: 1.6;">${escapeHtml(ctx)}</div>
            </div>`;
        }
      }
    }
  }

  // Sources
  if (itemSources.length > 0) {
    html += `<h3 style="color: var(--title); font-size: 1.3rem; margin-top: 24px; margin-bottom: 12px;">Библиографические ссылки</h3>`;
    html += `<div class="related" style="display: flex; flex-direction: column; gap: 8px;">`;
    for (const src of itemSources) {
      const label = escapeHtml(src.label || 'Источник');
      const pageHint = src.page ? ` · стр. ${escapeHtml(src.page)}` : '';
      const link = src.url
        ? `<a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-orange); font-weight: 500;">${label} ↗</a>`
        : `<span style="font-weight: 500;">${label}</span>`;
      const quote = src.quote ? `<div class="card-source-quote" style="font-size: 0.9rem; color: var(--muted); margin-top: 4px; font-style: italic;">“${escapeHtml(src.quote)}”</div>` : '';
      html += `<div class="card-source-row" style="background: var(--surface-soft); padding: 10px; border-radius: 6px; border: 1px solid var(--line-soft);">
        <div>${link}${pageHint}</div>
        ${quote}
      </div>`;
    }
    html += `</div>`;
  }

  // Connected entities (if any)
  if (it.chapters && it.chapters.length > 0) {
    html += `<h3 style="color: var(--title); font-size: 1.3rem; margin-top: 24px; margin-bottom: 12px;">Лекции</h3>`;
    html += `<ul class="card-lecture-list" style="padding-left: 20px; line-height: 1.8;">`;
    for (const ch of it.chapters) {
      html += `<li>${escapeHtml(ch)}</li>`;
    }
    html += `</ul>`;
  }

  // Citation
  const slug = slugIndexes[type].byHead.get(it.head);
  const itemUrl = `https://gasyoun.github.io/BookIndex/${type}/list/item/${type}/${slug}/`;
  html += `<hr style="border: 0; border-top: 1px solid var(--line-soft); margin: 24px 0;">`;
  html += renderCitationWidget(
    'card',
    slug,
    `Справочная статья «${it.head}»`,
    'Из жизни слов и языков: интерактивный академический справочник и корпус',
    itemUrl
  );

  html += `</div>`;
  return html;
}

// 6. JSON-LD Builder
function buildLectureSchema(lectureId, l) {
  const title = lectureId === 0 ? 'Предисловие' : `Лекция ${lectureId}`;
  const name = l.name ? `${title}: ${l.name}` : title;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": name,
    "description": l.main_idea || "Научно-популярная лекция академика А. А. Зализняка.",
    "provider": {
      "@type": "Person",
      "name": "А. А. Зализняк"
    },
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "Online",
      "isAccessibleForFree": true,
      "url": `https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lecture_pages/${lectureId}`
    }
  };
}

function buildItemSchema(type, it, canonicalUrl) {
  let category = 'Указатель';
  if (type === 'names') category = 'Имя';
  else if (type === 'toponyms') category = 'Топоним';
  else if (type === 'ethnonyms') category = 'Этноним';
  else if (type === 'languages') category = 'Язык';
  else if (type === 'lexicon') category = 'Лексема';
  else if (type === 'subject') category = 'Понятие / термин';

  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": canonicalUrl,
    "url": canonicalUrl,
    "name": it.head,
    "description": `Справочная статья об объекте «${it.head}» в интерактивном академическом справочнике по книге А. А. Зализняка «Из жизни слов и языков». Раздел: ${category}.`,
    "inDefinedTermSet": {
      "@type": "DefinedTermSet",
      "@id": "https://gasyoun.github.io/BookIndex/aaz-index.html#dataset",
      "name": "Сводный указатель терминов, имен, языков и лексем BookIndex"
    }
  };
  // A3: link to external authority records via schema.org sameAs.
  const a = it.authority;
  if (a && a.wikidata) {
    const sameAs = [`https://www.wikidata.org/wiki/${a.wikidata}`];
    if (a.viaf) sameAs.push(`https://viaf.org/viaf/${a.viaf}`);
    if (a.gnd) sameAs.push(`https://d-nb.info/gnd/${a.gnd}`);
    if (a.geonames) sameAs.push(`https://www.geonames.org/${a.geonames}`);
    schema.sameAs = sameAs;
  }
  return schema;
}

// Keep track of all pre-rendered paths for sitemap
const generatedUrls = [];

function generateFile(filePath, title, metaDesc, canonicalUrl, schemaObj, contentHtml, hydrationHash) {
  const prefix = getRelativePrefix(filePath);
  let pageHtml = baseTemplate;

  // Adapt relative asset paths
  pageHtml = adaptRelativePaths(pageHtml, prefix);

  // Set page titles & meta descriptions
  pageHtml = pageHtml.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)} | BookIndex</title>`);
  pageHtml = pageHtml.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${escapeHtml(metaDesc)}">`);
  
  // Set OpenGraph meta
  pageHtml = pageHtml.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${escapeHtml(title)}">`);
  pageHtml = pageHtml.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${escapeHtml(metaDesc)}">`);
  pageHtml = pageHtml.replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`);
  
  // Set Canonical link
  pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`);

  // Update Dynamic JSON-LD Schema
  const schemaStr = schemaObj ? JSON.stringify(schemaObj, null, 2) : '{}';
  pageHtml = pageHtml.replace('<script id="schema-seo-dynamic" type="application/ld+json">{}</script>', `<script id="schema-seo-dynamic" type="application/ld+json">\n${schemaStr}\n</script>`);

  // Inject content in <div id="content">
  pageHtml = pageHtml.replace('<div class="content" id="content"></div>', `<div class="content" id="content">\n${contentHtml}\n</div>`);

  // Inject inline hydration redirect script
  const redirectScript = `
<script>
  if (window.location && !window.location.hash) {
    window.location.hash = '${escapeHtml(hydrationHash)}';
  }
</script>
`;
  pageHtml = pageHtml.replace('<head>', `<head>${redirectScript}`);

  // Save page
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, '\uFEFF' + pageHtml, 'utf8');
  generatedUrls.push(`https://gasyoun.github.io/BookIndex/${filePath}`);
}

// 7. PRE-RENDER ALL PAGES
console.log('Pre-rendering 11 lectures...');
const lectures = appData.lectures || [];
for (let i = 0; i < lectures.length; i++) {
  const l = lectures[i];
  const lTitle = i === 0 ? 'Предисловие' : `Лекция ${i}`;
  const displayTitle = `${lTitle}: ${l.name}`;
  const filePath = `materials/lecture_pages/${i}/index.html`;
  const schema = buildLectureSchema(i, l);
  const content = renderLectureHtml(i, l);
  const hydrationHash = `#v4/materials/lecture_pages/${i}`;
  const canonical = `https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lecture_pages/${i}`;
  const desc = l.main_idea || "Научно-популярная лекция академика А. А. Зализняка.";

  generateFile(filePath, displayTitle, desc, canonical, schema, content, hydrationHash);
}

console.log('Pre-rendering 10 landing/section pages...');
const landings = [
  {
    path: 'materials/lectures/index.html',
    title: 'Лекции А. А. Зализняка — Читать онлайн',
    desc: '11 научно-популярных лекций академика А. А. Зализняка с интерактивными примечаниями.',
    content: renderLecturesLandingHtml(),
    hash: '#v4/materials/lectures'
  },
  {
    path: 'all/list/index.html',
    title: 'Сводный указатель терминов, имен и языков',
    desc: '3376 лингвистических и исторических объектов в интерактивном указателе.',
    content: renderAllListingHtml(),
    hash: '#v4/all/list'
  },
  {
    path: 'names/list/index.html',
    title: 'Указатель имен',
    desc: 'Персоналии, исследователи и упомянутые исторические лица в книге А. А. Зализняка.',
    content: renderSectionListingHtml('names', 'Указатель имен', names.filter(it => it.discussed === true)),
    hash: '#v4/names/list'
  },
  {
    path: 'toponyms/list/index.html',
    title: 'Указатель географических названий',
    desc: 'Географические объекты, топонимы, карты и исторические места.',
    content: renderSectionListingHtml('toponyms', 'Указатель географических названий', toponyms.filter(it => it.discussed === true)),
    hash: '#v4/toponyms/list'
  },
  {
    path: 'ethnonyms/list/index.html',
    title: 'Этнонимы и народы',
    desc: 'Племена, народы, языковые общности в исследованиях А. А. Зализняка.',
    content: renderSectionListingHtml('ethnonyms', 'Этнонимы и народы', ethnonyms.filter(it => it.discussed === true)),
    hash: '#v4/ethnonyms/list'
  },
  {
    path: 'languages/list/index.html',
    title: 'Языки мира и диалекты',
    desc: 'Языковые древа, языковые группы и диалектология в книге.',
    content: renderSectionListingHtml('languages', 'Языки мира и диалекты', languages.filter(it => it.discussed === true)),
    hash: '#v4/languages/list'
  },
  {
    path: 'lexicon/list/index.html',
    title: 'Сводный лексический указатель',
    desc: 'Слова, корни, праславянские реконструкции и этимологические связи.',
    content: renderSectionListingHtml('lexicon', 'Сводный лексический указатель', lexicon.filter(it => it.discussed === true)),
    hash: '#v4/lexicon/list'
  },
  {
    path: 'materials/sources/index.html',
    title: 'Корпус и источники',
    desc: 'Информационная база, редакторские очереди и планируемые видеоматериалы.',
    content: renderSourcesHtml(),
    hash: '#v4/materials/sources'
  },
  {
    path: 'scholar/viz/index.html',
    title: 'Визуализации и графики',
    desc: 'Интерактивные карты, тепловые матрицы, графы связей и шкала открытий.',
    content: renderVizLandingHtml(),
    hash: '#v4/scholar/viz'
  },
  {
    path: 'materials/tasks/index.html',
    title: 'Интерактивный практикум',
    desc: 'Проверьте свои знания по лекциям и справочным материалам.',
    content: renderTasksHtml(),
    hash: '#v4/materials/tasks'
  }
];

for (const lnd of landings) {
  const canonical = `https://gasyoun.github.io/BookIndex/aaz-index.html${lnd.hash}`;
  generateFile(lnd.path, lnd.title, lnd.desc, canonical, null, lnd.content, lnd.hash);
}

console.log('Pre-rendering discussed entities...');
const categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech', 'subject'];
let entityCount = 0;

for (const cat of categories) {
  const items = getItemsByType(cat);
  for (const it of items) {
    if (it.discussed === true) {
      const slug = slugIndexes[cat].byHead.get(it.head);
      const filePath = `${cat}/list/item/${cat}/${slug}/index.html`;
      
      let catLabel = 'Указатель';
      if (cat === 'names') catLabel = 'Имя';
      else if (cat === 'toponyms') catLabel = 'Топоним';
      else if (cat === 'ethnonyms') catLabel = 'Этноним';
      else if (cat === 'languages') catLabel = 'Язык';
      else if (cat === 'lexicon') catLabel = 'Лексема';
      else if (cat === 'subject') catLabel = 'Понятие / термин';

      const displayTitle = `${it.head} (${catLabel})`;
      const desc = `Справочная статья об объекте «${it.head}» в интерактивном академическом справочнике по книге А. А. Зализняка «Из жизни слов и языков». Раздел: ${catLabel}.`;
      const hydrationHash = `#v4/${cat}/list/item/${cat}/${slug}`;
      // A2: canonical is the clean prerendered path (not the app hash route).
      const canonical = `https://gasyoun.github.io/BookIndex/${cat}/list/item/${cat}/${slug}/`;
      const schema = buildItemSchema(cat, it, canonical);
      const content = renderItemHtml(cat, it);

      generateFile(filePath, displayTitle, desc, canonical, schema, content, hydrationHash);
      entityCount++;
    }
  }
}

console.log(`Pre-rendered ${entityCount} entities successfully.`);

// 8. COMPILE AND WRITE SITEMAP.XML
console.log('Writing sitemap.xml...');
let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://gasyoun.github.io/BookIndex/index.html</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://gasyoun.github.io/BookIndex/aaz-index.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;

for (const url of generatedUrls) {
  sitemap += `  <url>\n    <loc>${escapeHtml(url)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
}

sitemap += `</urlset>\n`;
fs.writeFileSync('sitemap.xml', sitemap, 'utf8');

console.log(`Sitemap compiled successfully with ${generatedUrls.length + 2} links.`);
console.log('STATIC PRE-RENDERING PIPELINE COMPLETE!');
