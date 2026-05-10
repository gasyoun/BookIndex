const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'tablet', width: 900, height: 700 },
  { name: 'mobile', width: 390, height: 844 },
];

const ROUTES = [
  {
    name: 'home',
    hash: '#v4/home/home',
    activeSection: /Главная/i,
    tabs: 0,
    viewTabs: 0,
  },
  {
    name: 'all index',
    hash: '#v4/all/list',
    activeSection: /Указатели/i,
    activeTab: /Сводный указатель/i,
    tabs: 8,
    viewTabs: 0,
    summary: /Указатели/,
    absentText: 'Смотрите также:',
  },
  {
    name: 'names index',
    hash: '#v4/names/list',
    activeSection: /Указатели/i,
    activeTab: /Имена/i,
    tabs: 8,
    viewTabs: 6,
    summary: /Указатели/,
  },
  {
    name: 'materials lectures',
    hash: '#v4/materials/lectures',
    activeSection: /Материалы/i,
    activeTab: /Лекции/i,
    tabs: 5,
    viewTabs: 0,
  },
  {
    name: 'corpus sources',
    hash: '#v4/materials/sources',
    activeSection: /Материалы/i,
    activeTab: /Корпус/i,
    tabs: 5,
    viewTabs: 0,
    presentText: 'Редакторские очереди',
  },
  {
    name: 'scholar viz',
    hash: '#v4/scholar/viz/module/viz01?century=21',
    activeSection: /Аппарат/i,
    activeTab: /Визуализации/i,
    tabs: 4,
    viewTabs: 0,
  },
  {
    name: 'practice tasks',
    hash: '#v4/materials/tasks',
    activeSection: /Практикум/i,
    tabs: 0,
    viewTabs: 0,
  },
];

const FIRST_LEVEL_LABELS = ['Главная', 'Указатели', 'Материалы', 'Аппарат', 'Инструменты', 'Практикум'];
const MATERIALS_TAB_LABELS = ['Лекции', 'Страница лекции', 'Сравнение лекций', 'Что почитать ещё', 'Корпус'];
const DENSITY_OPTIONS = [
  { label: 'плотно', value: 'compact', bodyClass: 'density-compact' },
  { label: 'чтение', value: 'reader', bodyClass: 'density-reader' },
  { label: 'исследование', value: 'research', bodyClass: 'density-research' },
];
const VIEW_TAB_CONTRACT_ROUTES = [
  { hash: '#v4/all/list', viewTabs: 0 },
  { hash: '#v4/names/list', viewTabs: 6 },
  { hash: '#v4/lexicon/list', viewTabs: 2 },
  { hash: '#v4/lexicon_reverse/list', viewTabs: 0 },
  { hash: '#v4/materials/lectures', viewTabs: 0 },
  { hash: '#v4/scholar/viz/module/viz01', viewTabs: 0 },
];

const RUNTIME_NAV_SOURCES = ['v3_app.js', 'v3_template.html'];
const FORBIDDEN_RUNTIME_NAV_TOKENS = [
  'breadcrumb-nav',
  'renderBreadcrumb',
  'theme-btn',
  'header-search-scope',
  'ENTITY_TYPES.corpus',
];

async function expectNoPageOverflow(page) {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyClass: document.body.className,
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 8);
  expect(metrics.bodyClass).not.toContain('theme-dark');
}

test.describe('navigation architecture contract', () => {
  test('runtime sources do not keep removed navigation hooks', () => {
    const runtimeText = RUNTIME_NAV_SOURCES
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n');

    for (const token of FORBIDDEN_RUNTIME_NAV_TOKENS) {
      expect(runtimeText, `removed navigation hook leaked back into runtime: ${token}`).not.toContain(token);
    }
  });

  test('density control keeps Russian labels with stable internal values', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    const density = page.locator('#density-select');
    await expect(density).toHaveAttribute('aria-label', 'Плотность интерфейса');

    const options = await density.locator('option').evaluateAll((nodes) => nodes.map((node) => ({
      label: node.textContent.trim(),
      value: node.value,
    })));
    expect(options).toEqual(DENSITY_OPTIONS.map(({ label, value }) => ({ label, value })));

    for (const option of DENSITY_OPTIONS) {
      await density.selectOption(option.value);
      await expect(page.locator('body')).toHaveClass(new RegExp(`\\b${option.bodyClass}\\b`));
    }
  });

  test('view tabs render only for multi-mode index routes', async ({ page }) => {
    for (const route of VIEW_TAB_CONTRACT_ROUTES) {
      await page.goto(`/aaz-index.html${route.hash}`);
      await expect(page.locator('#view-tabs .view-tab')).toHaveCount(route.viewTabs);
    }
  });

  test('desktop first-level navigation stays on one row', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/aaz-index.html#v4/home/home');
    await expect(page.locator('#entity-switcher .entity-btn')).toHaveCount(FIRST_LEVEL_LABELS.length);

    const rowTops = await page.locator('#entity-switcher .entity-btn').evaluateAll((nodes) => (
      [...new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().top)))]
    ));
    expect(rowTops).toHaveLength(1);
  });

  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route.name} keeps documented navigation rows`, async ({ page }) => {
          await page.goto(`/aaz-index.html${route.hash}`);
          await expect(page.locator('#entity-switcher .entity-btn')).toHaveCount(6);
          await expect(page.locator('#entity-switcher .entity-btn.active')).toContainText(route.activeSection);
          await expect(page.locator('#tabs .tab')).toHaveCount(route.tabs);
          await expect(page.locator('#view-tabs .view-tab')).toHaveCount(route.viewTabs);
          await expect(page.locator('#breadcrumb-nav')).toHaveCount(0);
          await expect(page.locator('#theme-btn')).toHaveCount(0);
          await expect(page.locator('#global-search-scope')).toHaveCount(0);

          const firstLevelNav = await page.locator('#entity-switcher .entity-btn').allInnerTexts();
          expect(firstLevelNav.map((text) => text.trim())).toEqual(FIRST_LEVEL_LABELS);
          expect(firstLevelNav.some((text) => /^Корпус\b/.test(text.trim()))).toBe(false);
          expect(firstLevelNav.join(' ')).not.toMatch(/\d/);

          if (route.activeTab) {
            await expect(page.locator('#tabs .tab.active')).toContainText(route.activeTab);
          }
          if (route.summary) {
            await expect(page.locator('.index-section-summary')).toContainText(route.summary);
          } else {
            await expect(page.locator('.index-section-summary')).toHaveCount(0);
          }
          if (route.presentText) {
            await expect(page.locator('body')).toContainText(route.presentText);
          }
          if (route.absentText) {
            await expect(page.locator('body')).not.toContainText(route.absentText);
          }

          await expectNoPageOverflow(page);
        });
      }
    });
  }

  test('stale saved corpus section state falls back to the new first-level hierarchy', async ({ page }) => {
    await page.goto('/aaz-index.html');
    await page.evaluate(() => {
      localStorage.setItem('Zalizniakiada.ui.v1', JSON.stringify({
        version: 3,
        currentEntity: 'corpus',
        currentTab: 'sources',
        selectedItem: null,
        selectedItemType: null,
        rightPaneMode: 'histogram',
        currentLecture: 0,
        lectureCompareA: 1,
        lectureCompareB: 2,
        trendsRangeStart: 1,
        trendsRangeEnd: 424,
        searchQuery: '',
        sortMostFrequentFirst: false,
        onlyDiscussed: false,
        onlyQuestionCandidates: false,
        currentGlossaryTerm: '',
        currentScholarAnchor: '',
        currentKwicSource: 'lexicon',
        currentKwicQuery: '',
        currentKwicSort: 'left',
        currentKwicPageStart: 1,
        currentKwicPageEnd: 424,
        activeFilters: [],
        globalSearchQuery: '',
        globalSearchScope: 'corpus',
      }));
    });

    await page.goto('/aaz-index.html');
    await expect(page).toHaveURL(/#v4\/home\/home$/);
    await expect(page.locator('#entity-switcher .entity-btn')).toHaveCount(6);
    await expect(page.locator('#entity-switcher .entity-btn.active')).toContainText(/Главная/i);
    await expect(page.locator('#tabs .tab')).toHaveCount(0);

    const firstLevelNav = await page.locator('#entity-switcher .entity-btn').allInnerTexts();
    expect(firstLevelNav.some((text) => /^Корпус\b/.test(text.trim()))).toBe(false);
  });

  test('materials keeps corpus as the final local tab only', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/lectures');
    const tabs = await page.locator('#tabs .tab').allInnerTexts();
    expect(tabs.map((text) => text.trim())).toEqual(MATERIALS_TAB_LABELS);
    await expect(page.locator('#tabs .tab').last()).toContainText('Корпус');
    await expect(page.locator('#entity-switcher .entity-btn')).toHaveText(FIRST_LEVEL_LABELS);
  });

  test('legacy corpus sources hash opens the canonical materials route', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/corpus/sources');
    await expect(page).toHaveURL(/#v4\/materials\/sources$/);
    await expect(page.locator('#entity-switcher .entity-btn.active')).toContainText(/Материалы/i);
    await expect(page.locator('#tabs .tab.active')).toContainText(/Корпус/i);
  });

  test('navigation rows expose Russian accessibility labels', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/names/list');
    await expect(page.locator('#entity-switcher')).toHaveAttribute('aria-label', 'Основные разделы');
    await expect(page.locator('#tabs')).toHaveAttribute('aria-label', 'Раздел');
    await expect(page.locator('#view-tabs')).toHaveAttribute('aria-label', 'Режимы просмотра');
    await expect(page.locator('.index-section-summary')).toHaveAttribute('aria-label', 'Сводка указателей');
    await expect(page.locator('#search-input')).toHaveAttribute('aria-label', 'Поиск по списку');
  });
});
