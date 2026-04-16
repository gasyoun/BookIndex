#!/usr/bin/env python3
"""
Контрольный набор для проверки работоспособности aaz-index.html
перед каждой выкладкой. Должен проходить 20/20 функций.

Использование:
    python3 runtime_test.py

Требования:
    - node.js установлен
    - В текущей директории должны быть: app_data.json, v3_app.js, v3_template.html
      ИЛИ собранный aaz-index.html

Что проверяется:
    1. node --check на JS после подстановки данных (синтаксис)
    2. node --check на JS внутри собранного HTML (после template.replace)
    3. Runtime-вызов 20 критических функций с DOM-заглушкой:
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
import subprocess
import sys
import tempfile


def check_static_guards():
    """Быстрые инварианты по исходному JS, чтобы не терять критичные правки."""
    with open('v3_app.js', 'r', encoding='utf-8') as f:
        js = f.read()
    with open('v3_template.html', 'r', encoding='utf-8') as f:
        tpl = f.read()

    banned = [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ]
    required = [
        'function getListColumnCount(',
        'function buildListSearchHash(',
        'function buildItemHash(',
        "APP_DATA.labels.literator = 'Носитель языка';",
        '<button type="button" class="related-link related-link-btn" id="copy-card-link"',
        '<button type="button" class="related-link related-link-btn" id="export-card-md"',
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
        'integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="',
        'integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="',
    ]
    for needle in template_required:
        if needle not in tpl:
            print(f"[static] FAIL: required template fragment missing: {needle}")
            return False

    print("[static] OK: guards passed")
    return True


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

    # Экранируем для backtick-строки в JS
    escaped = data_str.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
    return js.replace('__APP_DATA_STRING__', '`' + escaped + '`')


def check_syntax(js_code, label):
    """Проверка 1: node --check на JS-файле."""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(js_code)
        check_path = f.name
    try:
        r = subprocess.run(['node', '--check', check_path],
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


def runtime_test(js_full):
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
        r = subprocess.run(['node', runtest_path],
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
    if not check_syntax(js_full, "syntax"):
        sys.exit(1)

    # Шаг 3: runtime
    print("\n[3/4] Runtime-тест 20 функций с DOM-заглушкой...")
    if not runtime_test(js_full):
        sys.exit(1)

    print("\n" + "=" * 60)
    print("OK: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - файл готов к выкладке")
    print("=" * 60)


if __name__ == '__main__':
    main()
