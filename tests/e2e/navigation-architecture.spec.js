const { test, expect } = require('@playwright/test');

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
    hash: '#v4/corpus/sources',
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
          expect(firstLevelNav.some((text) => /^Корпус\b/.test(text.trim()))).toBe(false);

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
});
