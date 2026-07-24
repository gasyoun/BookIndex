const { test, expect } = require('@playwright/test');

const MODULES = [
  'viz01',
  'viz02',
  'viz03',
  'viz04',
  'viz05',
  'viz06',
  'viz07',
];

async function noPageOverflow(page) {
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('VIZ shell (H1605)', () => {
  for (const moduleId of MODULES) {
    test(`${moduleId} renders shell chrome and keeps module in URL`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));

      await page.goto(`/aaz-index.html#v4/scholar/viz/module/${moduleId}`);
      await expect(page.locator('.viz-shell')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.viz-module-btn.active')).toBeVisible();
      await expect(page.locator(`#viz-module-tabs [data-module="${moduleId}"]`)).toHaveClass(/active/);

      // Module card chrome (after lazy load)
      await expect(page.locator('.viz-module-header .viz-module-title')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.viz-module-actions [data-viz-action="reset"]')).toBeVisible();
      await expect(page.locator('.viz-module-actions [data-viz-action="copy-link"]')).toBeVisible();
      await expect(page.locator('.viz-toolbar-filters')).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(new RegExp(`#v4/scholar/viz/module/${moduleId}`));
      await expect(page.locator('.viz-shell')).toBeVisible({ timeout: 30000 });
      await expect(page.locator(`#viz-module-tabs [data-module="${moduleId}"]`)).toHaveClass(/active/);

      expect(pageErrors, `console/page errors on ${moduleId}: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  }

  test('module switch does not throw and no overflow at 390/900/1366', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));

    for (const width of [1366, 900, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/aaz-index.html#v4/scholar/viz/module/viz03');
      await expect(page.locator('.viz-shell')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.viz-module-header')).toBeVisible({ timeout: 30000 });
      await noPageOverflow(page);

      await page.locator('#viz-module-tabs [data-module="viz04"]').click();
      await expect(page).toHaveURL(/#v4\/scholar\/viz\/module\/viz04/);
      await expect(page.locator('.viz-module-header .viz-module-title')).toContainText(/VIZ-04/);
      await noPageOverflow(page);
    }

    expect(pageErrors).toEqual([]);
  });
});
