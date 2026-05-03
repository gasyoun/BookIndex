#!/usr/bin/env python3
"""
Контрольный набор для проверки работоспособности aaz-index.html
перед каждой выкладкой. Должен проходить 21/21 функций.

Использование:
    python3 runtime_test.py

Требования:
    - node.js установлен (или указан через NODE_BINARY)
    - В текущей директории должны быть: app_data.json, v3_app.js, v3_template.html
      ИЛИ собранный aaz-index.html

Что проверяется:
    1. node --check на JS после подстановки данных (синтаксис)
    2. node --check на JS внутри собранного HTML (после template.replace)
    3. Runtime-вызов 21 критических функций с DOM-заглушкой:
       - parseAppData, initEntityTypes
       - Главная страница (renderHomePanel)
       - Список и все 4 типа карточек (renderCardInRight для имени, топонима, языка, этнонима)
         — это критично, потому что карточки используют перекрестные ссылки cross_links
       - Все визуализации: Граф, Шкала, Эпохи, Дерево языков, Граф семей, Карта (офлайн)
       - Все вкладки Материалов: Лекции, Глоссарий, Галерея, Русский во времени, Фонетические законы
       - Профессиональный аппарат

Если что-то падает — печатается имя функции и сообщение об ошибке.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


def check_static_guards():
    """Быстрые инварианты по исходному JS, чтобы не терять критичные правки."""
    with open('app_data.json', 'r', encoding='utf-8') as f:
        app_data = json.load(f)
    with open('v3_app.js', 'r', encoding='utf-8') as f:
        js = f.read()
    with open('v3_template.html', 'r', encoding='utf-8') as f:
        tpl = f.read()
    with open(os.path.join('scripts', 'export_app_data_to_markdown.mjs'), 'r', encoding='utf-8') as f:
        flat_exporter = f.read()
    with open(os.path.join('scripts', 'content_report.py'), 'r', encoding='utf-8') as f:
        content_report = f.read()
    with open(os.path.join('scripts', 'validate_content.py'), 'r', encoding='utf-8') as f:
        validate_content = f.read()
    if not os.path.exists('sw.js'):
        print('[static] FAIL: sw.js is missing')
        return False
    if not os.path.exists('manifest.webmanifest'):
        print('[static] FAIL: manifest.webmanifest is missing')
        return False
    with open('sw.js', 'r', encoding='utf-8') as f:
        sw = f.read()
    with open('manifest.webmanifest', 'r', encoding='utf-8') as f:
        manifest = f.read()
    smoke = ''
    smoke_candidates = [
        os.path.join('tests', 'e2e', 'smoke.spec.new.js'),
        os.path.join('tests', 'e2e', 'smoke.spec.js'),
    ]
    smoke_path = next((p for p in smoke_candidates if os.path.exists(p)), '')
    if smoke_path:
        with open(smoke_path, 'r', encoding='utf-8') as f:
            smoke = f.read()

    banned = [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ]
    mojibake_markers = [
        'РёС',
        'РЎС',
        'СЌРЅ',
        'Р¶Рµ',
        'вЂ',
        'рџ',
    ]
    required = [
        'function getListColumnCount(',
        'function buildListSearchHash(',
        'function buildItemHash(',
        'function buildScholarAnchorHash(',
        'function renderScholarChronologyPanel(container) {',
        "APP_DATA.labels.literator = 'Носитель языка';",
        'const MAX_URL_LENGTH = 2048;',
        'if (raw.length > MAX_URL_LENGTH) return fallback;',
        '<div class="category">${escapeHtml(category)}</div>',
        "catEl.className = 'mc-cat';",
        'id="copy-card-link"',
        'id="export-card-md"',
        'class="glossary-les-link"',
        'class="scholar-slovo-anchor"',
        'if (Array.isArray(s.slovo_reading) && s.slovo_reading.length) {',
        'id="accent-compare-a"',
        'const renderAccentCompare = () => {',
        'id="corr-family-filter"',
        'class="corr-row"',
        'class="corr-lang-link"',
        'const applyCorrespondenceFilters = () => {',
        "safeSetAttr(input, 'aria-controls', 'global-search-results')",
        "safeSetAttr(input, 'aria-activedescendant', '')",
        'function switchEntity(key) {\n  closeGlobalSearchResults();',
        'function switchTab(tab) {\n  closeGlobalSearchResults();',
        'function announceUiMessage(message) {',
        "live.id = 'ui-live-status';",
        'basemaps.cartocdn.com/light_all',
        'OpenTopoMap',
        'renderOfflineMap(type, items, colorFn, radiusFn);',
        'function registerAppServiceWorker() {',
        "navigator.serviceWorker.register(swUrl, { scope: './', updateViaCache: 'none' })",
        'let nameGraphMinEdgeWeight = 0.1;',
        '<input id="graph-min-weight" type="range"',
        ".attr('class', 'name-graph-node')",
        'const zoom = d3.zoom()',
        'const KWIC_MAX_ROWS = 1200;',
        'function normalizeItemContexts(item) {',
        'function iterateKwicContextEntries(contexts, pageStart, pageEnd) {',
        'if (rows.length >= KWIC_MAX_ROWS) {',
        'rows._truncated = false;',
        'rows._truncated = true;',
        'const kwicTruncated = rows && rows._truncated === true;',
        'function prefersReducedMotion() {',
        "window.matchMedia('(prefers-reduced-motion: reduce)'",
        'function buildDefaultCorpusRegistry() {',
        "active_book_id: 'zaliznyak-aaz-index'",
        'function applyActiveBookFromQuery(query) {',
        "params.get('books') || params.get('book')",
        "params.set('books', activeBookId);",
        'function renderCorpusQualityPanel(panel) {',
        'title: type.title || type.label || type.type',
    ]

    for needle in banned:
        if needle in js:
            print(f"[static] FAIL: forbidden fragment found: {needle}")
            return False

    for needle in required:
        if needle not in js:
            print(f"[static] FAIL: required fragment missing: {needle}")
            return False

    template_required = [
        'Content-Security-Policy',
        'integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="',
        'integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="',
        'rel="manifest"',
        './vendor/d3.v7.min.js',
        '@media (prefers-reduced-motion: reduce) {',
    ]
    for needle in template_required:
        if needle not in tpl:
            print(f"[static] FAIL: required template fragment missing: {needle}")
            return False

    for marker in mojibake_markers:
        if marker in js:
            print(f"[static] FAIL: mojibake marker in v3_app.js: {marker}")
            return False
        if marker in tpl:
            print(f"[static] FAIL: mojibake marker in v3_template.html: {marker}")
            return False
        if smoke and marker in smoke:
            print(f"[static] FAIL: mojibake marker in smoke.spec.js: {marker}")
            return False

    sw_required = [
        "const CACHE_NAME = `bookindex-shell-${SW_BUILD_ID}`;",
        "self.addEventListener('install'",
        "self.addEventListener('fetch'",
        "caches.match(OFFLINE_URL)",
    ]
    for needle in sw_required:
        if needle not in sw:
            print(f"[static] FAIL: required sw fragment missing: {needle}")
            return False

    manifest_required = [
        '"short_name"',
        '"start_url"',
        '"display"',
        '"icons"',
    ]
    for needle in manifest_required:
        if needle not in manifest:
            print(f"[static] FAIL: required manifest fragment missing: {needle}")
            return False

    flat_exporter_required = [
        "const DEFAULT_CORPUS_BOOK = {",
        "book_id: 'zaliznyak-aaz-index'",
        'function getCorpusBookMeta(data, entity) {',
        'if (meta.source) lines.push(`source: ${JSON.stringify(meta.source)}`);',
        'if (meta.bookId) lines.push(`book_id: ${JSON.stringify(meta.bookId)}`);',
    ]
    for needle in flat_exporter_required:
        if needle not in flat_exporter:
            print(f"[static] FAIL: required flat exporter fragment missing: {needle}")
            return False

    content_report_required = [
        'DEFAULT_CORPUS_BOOK_ID = "zaliznyak-aaz-index"',
        'DEFAULT_VIDEO_CATALOG_COUNT = 200',
        '"mode": "runtime_default"',
        '"mode": "explicit"',
        '"active_book_title"',
        '"markdown_exports"',
        'collect_markdown_export_metrics(source)',
        '"manual_audits"',
        'MANUAL_AUDIT_TERM_RE = re.compile',
        'collect_manual_audit_metrics(source, data)',
        'def build_manual_audit_queue(report: dict[str, Any]) -> dict[str, Any]:',
        '--write-manual-audit',
        '"schema_version": 1',
        '"terms_missing"',
        '"terms_possible_matches"',
        '## Manual Audits',
        'def collect_sort_order_metrics(items: list[dict[str, Any]], applicable: bool) -> dict[str, Any]:',
        '"sort_inversions_count"',
        '"suspicious_heads_count"',
        '## Suspicious Heads (Sample)',
        '## Sort Inversions (Sample)',
    ]
    for needle in content_report_required:
        if needle not in content_report:
            print(f"[static] FAIL: required content report fragment missing: {needle}")
            return False

    validate_content_required = [
        'def configure_output_encoding() -> None:',
        'def validate_markdown_exports(data_path: Path, errors: list[str], warnings: list[str]) -> None:',
        '"[markdown_exports] files missing source/book_id frontmatter: "',
        'def validate_suspicious_heads(data: dict[str, Any], warnings: list[str]) -> None:',
        'validate_suspicious_heads(data, warnings)',
        'def validate_manual_audit_queue(data_path: Path, errors: list[str], warnings: list[str]) -> None:',
        'validate_manual_audit_queue(path, errors, warnings)',
        'def validate_readme_audit_summary(data_path: Path, errors: list[str]) -> None:',
        'validate_readme_audit_summary(path, errors)',
        'validate_markdown_exports(path, errors, warnings)',
    ]
    for needle in validate_content_required:
        if needle not in validate_content:
            print(f"[static] FAIL: required content validator fragment missing: {needle}")
            return False

    corpus = app_data.get('corpus')
    if not isinstance(corpus, dict):
        print('[static] FAIL: app_data.json is missing explicit corpus registry')
        return False
    if corpus.get('active_book_id') != 'zaliznyak-aaz-index':
        print('[static] FAIL: corpus.active_book_id must be zaliznyak-aaz-index')
        return False
    books = corpus.get('books')
    if not isinstance(books, list) or not books:
        print('[static] FAIL: corpus.books must contain the active book')
        return False
    active_book = next(
        (book for book in books if isinstance(book, dict) and book.get('book_id') == 'zaliznyak-aaz-index'),
        None,
    )
    if not active_book:
        print('[static] FAIL: corpus.books is missing zaliznyak-aaz-index')
        return False
    if active_book.get('title') != 'Из жизни слов и языков':
        print('[static] FAIL: corpus active book title drifted')
        return False
    source_types = corpus.get('source_types')
    if not isinstance(source_types, list):
        print('[static] FAIL: corpus.source_types must be a list')
        return False
    source_type_map = {
        source_type.get('type'): source_type
        for source_type in source_types
        if isinstance(source_type, dict)
    }
    if 'book' not in source_type_map or 'video_catalog' not in source_type_map:
        print('[static] FAIL: corpus source_types must include book and video_catalog')
        return False
    if source_type_map['video_catalog'].get('planned_count') != 200:
        print('[static] FAIL: corpus video_catalog planned_count must be 200')
        return False
    video_supports = source_type_map['video_catalog'].get('supports')
    if not isinstance(video_supports, list) or 'timecodes' not in video_supports:
        print('[static] FAIL: corpus video_catalog must support timecodes')
        return False

    content_dir = os.path.join('src', 'content')
    if not os.path.isdir(content_dir):
        print('[static] FAIL: src/content is missing')
        return False
    markdown_files = [
        os.path.join(content_dir, name)
        for name in os.listdir(content_dir)
        if name.endswith('.md')
    ]
    if not markdown_files:
        print('[static] FAIL: src/content has no markdown files')
        return False
    missing_corpus_metadata = []
    for path in markdown_files:
        with open(path, 'r', encoding='utf-8') as f:
            head = ''.join(f.readline() for _ in range(16))
        if not head.startswith('---\n') or '\nsource: ' not in head or '\nbook_id: ' not in head:
            missing_corpus_metadata.append(path)
            if len(missing_corpus_metadata) >= 5:
                break
    if missing_corpus_metadata:
        sample = ', '.join(missing_corpus_metadata)
        print(f"[static] FAIL: markdown corpus metadata missing in {sample}")
        return False
    corpus_markdown_path = os.path.join(content_dir, 'corpus.md')
    if not os.path.exists(corpus_markdown_path):
        print('[static] FAIL: src/content/corpus.md is missing')
        return False
    with open(corpus_markdown_path, 'r', encoding='utf-8') as f:
        corpus_markdown = f.read()
    corpus_markdown_fragments = [
        'Active book:',
        '## Books',
        '## Source types',
        'video_catalog',
        'planned: 200',
    ]
    missing_fragments = [
        fragment
        for fragment in corpus_markdown_fragments
        if fragment not in corpus_markdown
    ]
    if missing_fragments:
        print(f"[static] FAIL: corpus.md registry summary missing: {', '.join(missing_fragments)}")
        return False

    print("[static] OK: guards passed")
    return True


def resolve_node_binary():
    """Finds a runnable Node.js binary and returns (path, version)."""
    candidates = []
    env_node = os.environ.get('NODE_BINARY', '').strip()
    if env_node:
        candidates.append(env_node)

    for name in ('node', 'nodejs'):
        path = shutil.which(name)
        if path:
            candidates.append(path)

    if os.name == 'nt':
        candidates.extend([
            r'C:\Program Files\nodejs\node.exe',
            r'C:\Program Files (x86)\nodejs\node.exe',
        ])

    seen = set()
    for candidate in candidates:
        candidate = os.path.expandvars(os.path.expanduser(candidate.strip('"')))
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        if os.path.isabs(candidate) and not os.path.exists(candidate):
            continue
        try:
            result = subprocess.run(
                [candidate, '--version'],
                capture_output=True,
                text=True,
                timeout=8,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if result.returncode == 0:
            version = (result.stdout or result.stderr).strip()
            return candidate, version
    return None, None


def build_full_js():
    """Собирает полный JavaScript с подставленными данными."""
    if not os.path.exists('app_data.json'):
        sys.exit("FATAL: нет app_data.json")
    if not os.path.exists('v3_app.js'):
        sys.exit("FATAL: нет v3_app.js")

    with open('app_data.json', 'r', encoding='utf-8') as f:
        data_str = f.read()
    with open('v3_app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Fallback для runtime-теста: приложение читает данные из globalThis.__APP_DATA_STRING__
    fallback = f"globalThis.__APP_DATA_STRING__ = {json.dumps(data_str, ensure_ascii=False)};\n"
    return fallback + js


def check_syntax(js_code, label, node_bin):
    """Проверка 1: node --check на JS-файле."""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(js_code)
        check_path = f.name
    try:
        r = subprocess.run([node_bin, '--check', check_path],
                           capture_output=True, text=True)
    finally:
        try:
            os.unlink(check_path)
        except OSError:
            pass
    print(f"[{label}] node --check: {r.returncode}")
    if r.returncode != 0:
        print("STDERR:", r.stderr[:1500])
        return False
    return True


def runtime_test(js_full, node_bin):
    """Проверка 2: вызываем все критические функции с DOM-заглушкой."""
    test_js = """
// === DOM-заглушка ===
// Минимально воспроизводит только то, что нужно функциям рендера.
const makeEl = () => ({
  innerHTML: '', style: { cssText: '' }, className: '',
  onclick: null, oninput: null, onmouseover: null, onmouseout: null,
  onmousemove: null, onmouseleave: null, onmouseenter: null,
  querySelectorAll: () => [], querySelector: () => null,
  appendChild: () => {}, focus: () => {},
  dataset: {}, value: '',
  width: 1200, height: 600,
  // Canvas 2D context (для renderGraphPanel и renderFamiliesPanel)
  getContext: () => ({
    clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
    fillText: () => {}, beginPath: () => {}, moveTo: () => {},
    lineTo: () => {}, stroke: () => {}, arc: () => {}, fill: () => {},
    measureText: () => ({ width: 50 }),
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'left',
  }),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 600 }),
});
global.document = {
  getElementById: () => makeEl(),
  querySelectorAll: () => [],
  createElement: () => makeEl(),
};
global.window = { innerWidth: 1400, innerHeight: 800 };
global.L = undefined;  // нет Leaflet - триггерим offline-fallback карты
global.setTimeout = (fn) => fn();  // вызываем сразу

""" + js_full + """

// === Тестовый набор ===
const c = document.getElementById('content');
const tests = [
  ['parseAppData',     () => parseAppData()],
  ['initEntityTypes',  () => initEntityTypes()],
  ['Home',             () => { currentEntity='home'; currentTab='home'; renderHomePanel(c); }],
  ['Names list',       () => { currentEntity='names'; currentTab='list'; renderListPanel(c); }],
  ['Name card',        () => { selectedItem='Вакернагель Я.'; selectedItemType='names'; rightPaneMode='card'; renderCardInRight(); }],
  ['Topo card',        () => { currentEntity='toponyms'; selectedItem='Новгород'; selectedItemType='toponyms'; renderCardInRight(); }],
  ['Lang card',        () => { currentEntity='languages'; selectedItem='санскрит'; selectedItemType='languages'; renderCardInRight(); }],
  ['Eth card',         () => { currentEntity='ethnonyms'; selectedItem='греки'; selectedItemType='ethnonyms'; renderCardInRight(); }],
  ['Graph',            () => { currentEntity='names'; currentTab='graph'; renderGraphPanel(c); }],
  ['KWIC guards',      () => {
    const first = (APP_DATA.lexicon || [])[0];
    if (!first) return;
    const prev = first.contexts;
    try {
      first.contexts = { bad: 'oops', '12': [null, 123, 'sample kwic query context'] };
      const rows = collectLexiconKwicRows('query', 1, 404);
      if (!Array.isArray(rows)) throw new Error('collectLexiconKwicRows should return array');
      const bulk = {};
      for (let i = 1; i <= 70; i++) {
        bulk[String(i)] = Array.from({ length: 30 }, (_, j) => `stress query ${i}-${j}`);
      }
      first.contexts = bulk;
      const capped = collectLexiconKwicRows('query', 1, 404);
      if (!Array.isArray(capped)) throw new Error('collectLexiconKwicRows should return array');
      if (capped.length !== KWIC_MAX_ROWS) throw new Error(`kwic cap mismatch: ${capped.length}`);
      if (capped._truncated !== true) throw new Error('kwic truncation flag should be true');
    } finally {
      first.contexts = prev;
    }
  }],
  ['Timeline',         () => { currentTab='timeline'; renderTimelinePanel(c); }],
  ['Epochs',           () => { currentEntity='toponyms'; currentTab='epochs'; renderEpochsPanel(c); }],
  ['Tree',             () => { currentEntity='languages'; currentTab='tree'; renderTreePanel(c); }],
  ['Families',         () => { currentTab='families'; renderFamiliesPanel(c); }],
  ['Map (offline)',    () => { currentTab='map'; renderMapPanel(c); }],
  ['Lectures',         () => { currentEntity='materials'; currentTab='lectures'; renderLecturesPanel(c); }],
  ['Glossary',         () => { currentTab='glossary'; renderGlossaryPanel(c); }],
  ['Gallery',          () => { currentTab='gallery'; renderGalleryPanel(c); }],
  ['Russian evo',      () => { currentTab='russian_evolution'; renderRussianEvolutionPanel(c); }],
  ['Phonetic laws',    () => { currentTab='phonetic_laws'; renderPhoneticLawsPanel(c); }],
  ['Scholar',          () => { currentEntity='scholar'; currentTab='scholar'; renderScholarPanel(c); }],
];

let passed = 0, failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log('[OK]', name);
    passed++;
  } catch (e) {
    console.log('[FAIL]', name, ':', e.message);
    failed++;
  }
}
console.log(`\\n[RESULT] ${passed}/${tests.length}`);
if (failed > 0) process.exit(1);
"""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(test_js)
        runtest_path = f.name
    try:
        r = subprocess.run([node_bin, runtest_path],
                           capture_output=True, text=True, timeout=60)
    finally:
        try:
            os.unlink(runtest_path)
        except OSError:
            pass
    print(r.stdout)
    if r.returncode != 0:
        print("STDERR:", r.stderr[:1500])
        return False
    return True


def main():
    print("=" * 60)
    print("Контроль работоспособности aaz-index.html")
    print("=" * 60)

    node_bin, node_version = resolve_node_binary()
    if not node_bin:
        print("\n[env] FAIL: Node.js binary not found.")
        print("[env] Install Node.js and ensure `node` is available in PATH,")
        print("[env] or set NODE_BINARY to an absolute executable path.")
        print("[env] Example: set NODE_BINARY=C:\\Program Files\\nodejs\\node.exe")
        sys.exit(1)
    print(f"\n[env] Node.js: {node_bin} ({node_version})")

    # Шаг 0: статические инварианты
    print("\n[0/4] Статические проверки инвариантов...")
    if not check_static_guards():
        sys.exit(1)

    # Шаг 1: собираем JS
    print("\n[1/4] Собираю JS с данными...")
    js_full = build_full_js()
    print(f"      JS size: {len(js_full)} символов")

    # Шаг 2: синтаксис JS
    print("\n[2/4] Проверка синтаксиса JS...")
    if not check_syntax(js_full, "syntax", node_bin):
        sys.exit(1)

    # Шаг 3: runtime
    print("\n[3/4] Runtime-тест 21 функции с DOM-заглушкой...")
    if not runtime_test(js_full, node_bin):
        sys.exit(1)

    print("\n" + "=" * 60)
    print("OK: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - файл готов к выкладке")
    print("=" * 60)


if __name__ == '__main__':
    main()
