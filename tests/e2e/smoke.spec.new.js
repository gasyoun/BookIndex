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
    await expect(page.locator('#right-content button#copy-card-link')).toBeVisible();
    await expect(page.locator('#right-content button#export-card-md')).toBeVisible();
    await page.locator('#right-content button#copy-card-link').click();
    await expect(page.locator('#ui-live-status')).toHaveCount(1);
    await expect(page).toHaveURL(/#names\/list/);
  });

  test('global search returns navigable results', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('\u0438\u0442\u043a\u0438\u043d');
    const results = page.locator('#global-search-results.open .header-search-item');
    await expect(results.first()).toBeVisible();
    const before = page.url();
    await results.first().click();
    await expect(page).not.toHaveURL(before);
    await expect(page.locator('#content .panel.active')).toBeVisible();
  });

  test('global search supports keyboard navigation (down/up/enter)', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('iv');
    const results = page.locator('#global-search-results.open .header-search-item');
    await input.press('ArrowDown');
    await expect(results.first()).toBeVisible();
    await expect(results.first()).toHaveClass(/active/);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', /global-search-item-/);
    await input.press('Enter');
    await expect(page.locator('#content .panel.active')).toBeVisible();
    await expect(page).not.toHaveURL(/#home\/home$/);
  });

  test('global search enter opens first match without explicit dropdown navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('iv');
    await input.press('Enter');
    await expect(page.locator('#content .panel.active')).toBeVisible();
    await expect(page).not.toHaveURL(/#home\/home$/);
  });

  test('global search dropdown closes when switching entity', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('iv');
    await expect(page.locator('#global-search-results.open .header-search-item').first()).toBeVisible();
    await page.locator('.entity-btn[data-entity="names"]').click();
    await expect(page.locator('#global-search-results')).not.toHaveClass(/open/);
  });

  test('global search dropdown closes on Escape without input focus', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('iv');
    await expect(page.locator('#global-search-results.open .header-search-item').first()).toBeVisible();
    await page.locator('#home-link').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#global-search-results')).not.toHaveClass(/open/);
  });

  test('global search opens glossary term results', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('\u044d\u043d\u043a\u043b\u0438\u0442');
    const glossaryResult = page
      .locator('#global-search-results.open .header-search-item')
      .filter({ has: page.locator('.kind', { hasText: '\u0442\u0435\u0440\u043c\u0438\u043d' }) })
      .first();
    await expect(glossaryResult).toBeVisible();
    await glossaryResult.click();
    await expect(page).toHaveURL(/#materials\/glossary\/term\//);
    await expect(page.locator('#glossary-search')).toBeVisible();
    await expect(page.locator('#glossary-search')).toHaveValue(/\u044d\u043d\u043a\u043b\u0438\u0442/i);
  });

  test('list hash query restores list search input', async ({ page }) => {
    await page.goto('/aaz-index.html#all/list/q/%D0%B6%D0%B5');
    await expect(page).toHaveURL(/#all\/list\/q\//);
    await expect(page.locator('#search-input')).toHaveValue('\u0436\u0435');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
  });

  test('materials lecture compare tab renders', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await page.locator('.entity-btn[data-entity="materials"]').click();
    await page.locator('.tab[data-tab="lecture_compare"]').click();
    await expect(page.locator('#lecture-compare-a')).toBeVisible();
    await expect(page.locator('#lecture-compare-b')).toBeVisible();
  });

  test('toponym epochs links navigate via hash item links', async ({ page }) => {
    await page.goto('/aaz-index.html#toponyms/epochs');
    const firstLink = page.locator('#epochs-grid .related-link[data-head]').first();
    await expect(firstLink).toBeVisible();
    await expect(firstLink).toHaveAttribute('href', /#toponyms\/list\/item\/toponyms\//);
    await firstLink.click();
    await expect(page).toHaveURL(/#toponyms\/list\/item\/toponyms\//);
    await expect(page.locator('#right-content .card h2')).toBeVisible();
  });

  test('gallery cards navigate via hash item links', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/gallery');
    const firstCard = page.locator('.gallery-card[data-head]').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toHaveAttribute('href', /#names\/list\/item\/names\//);
    await firstCard.click();
    await expect(page).toHaveURL(/#names\/list\/item\/names\//);
    await expect(page.locator('#right-content .card h2')).toBeVisible();
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

  test('reading-now pager and quick trends navigation works', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#reading-page-input');
    const go = page.locator('#reading-page-go');
    const prev = page.locator('#reading-page-prev');
    const next = page.locator('#reading-page-next');
    const openTrends = page.locator('#reading-page-trends');
    const results = page.locator('#reading-now-results');

    await input.fill('120');
    await go.click();
    await expect(results).toContainText('\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 120');

    await next.click();
    await expect(results).toContainText('\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 121');

    await prev.click();
    await expect(results).toContainText('\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 120');

    await openTrends.click();
    await expect(page).toHaveURL(/#scholar\/page_trends/);
    await expect(page.locator('#trend-start-range')).toHaveValue('120');
    await expect(page.locator('#trend-end-range')).toHaveValue('120');
  });

  test('lexicon card links to glossary deep-link', async ({ page }) => {
    await page.goto('/aaz-index.html#lexicon/list/item/lexicon/%D0%B6%D0%B5');
    await expect(page.locator('#right-content .card h2')).toHaveText(/\u0436\u0435/i);
    const glossaryBacklink = page.locator('#right-content .glossary-backlink[data-term]').first();
    await expect(glossaryBacklink).toBeVisible();
    await glossaryBacklink.click();
    await expect(page).toHaveURL(/#materials\/glossary\/term\//);
    await expect(page.locator('#glossary-search')).toBeVisible();
  });

  test('related card links are clickable and keyboard reachable', async ({ page }) => {
    await page.goto('/aaz-index.html#names/list/item/names/%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.');
    const firstRelated = page.locator('#right-content .xlink[data-head]').first();
    await expect(firstRelated).toBeVisible();
    const before = page.url();
    await firstRelated.focus();
    await page.keyboard.press('Enter');
    await expect(page).not.toHaveURL(before);
    await expect(page.locator('#right-content .card h2')).toBeVisible();
  });
});
