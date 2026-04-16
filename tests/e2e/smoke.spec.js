const { test, expect } = require('@playwright/test');

test.describe('aaz-index smoke', () => {
  test('loads home and renders navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await expect(page.locator('#home-link')).toBeVisible();
    await expect(page.locator('#entity-switcher .entity-btn')).toHaveCount(10);
    await expect(page.locator('#tabs .tab')).toHaveCount(1);
  });

  test('opens name card from list', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await page.locator('.entity-btn[data-entity="names"]').click();
    await page.locator('.tab[data-tab="list"]').click();
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
    await page.locator('#name-list .name-item').first().click();
    await expect(page.locator('#right-content .card h2')).toBeVisible();
    await expect(page).toHaveURL(/#names\/list/);
  });

  test('global search returns navigable results', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('иткин');
    const results = page.locator('#global-search-results.open .header-search-item');
    await expect(results.first()).toBeVisible();
    const before = page.url();
    await results.first().click();
    await expect(page).not.toHaveURL(before);
    await expect(page.locator('#content .panel.active')).toBeVisible();
  });

  test('materials lecture compare tab renders', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await page.locator('.entity-btn[data-entity="materials"]').click();
    await page.locator('.tab[data-tab="lecture_compare"]').click();
    await expect(page.locator('#lecture-compare-a')).toBeVisible();
    await expect(page.locator('#lecture-compare-b')).toBeVisible();
  });

  test('scholar page trends renders export controls', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await page.locator('.entity-btn[data-entity="scholar"]').click();
    await page.locator('.tab[data-tab="page_trends"]').click();
    await expect(page.locator('#trend-start-range')).toBeVisible();
    await expect(page.locator('#trend-end-range')).toBeVisible();
    await expect(page.locator('#trend-export-csv')).toBeVisible();
    await expect(page.locator('#trend-export-md')).toBeVisible();
  });
});
