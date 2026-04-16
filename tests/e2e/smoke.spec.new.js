const { test, expect } = require('@playwright/test');

test.describe('aaz-index smoke', () => {
  test('loads home and renders navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await expect(page.locator('#home-link')).toBeVisible();
    await expect(page.locator('#entity-switcher .entity-btn')).toHaveCount(10);
    await expect(page.locator('#tabs .tab')).toHaveCount(1);
  });

  test('desktop header keeps title, search and back button on the same row', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/aaz-index.html#home/home');
    await page.locator('.entity-btn[data-entity="names"]').click();
    const backBtn = page.locator('#back-btn');
    await expect(backBtn).toBeVisible();
    const spread = await page.evaluate(() => {
      const home = document.getElementById('home-link');
      const search = document.getElementById('global-search');
      const back = document.getElementById('back-btn');
      const meta = document.querySelector('header h1 .meta-inline');
      const nodes = [home, search, back, meta].filter(Boolean);
      const tops = nodes.map((n) => n.getBoundingClientRect().top);
      return Math.max(...tops) - Math.min(...tops);
    });
    expect(spread).toBeLessThan(16);
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

  test('home KPI rows are clickable and navigate to target sections', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const rows = page.locator('#home-fact-pair > div').first().locator('div');
    await expect(rows.nth(0)).toBeVisible();

    await rows.nth(0).click();
    await expect(page).toHaveURL(/#materials\/lecture_pages\//);

    await page.goto('/aaz-index.html#home/home');
    await rows.nth(1).click();
    await expect(page).toHaveURL(/#languages\/list\/item\/languages\//);

    await page.goto('/aaz-index.html#home/home');
    await rows.nth(2).click();
    await expect(page).toHaveURL(/#toponyms\/list\/item\/toponyms\//);
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

  test('global search fuzzy-matches typo query', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('\u0441\u0430\u043d\u0441\u0440\u043a\u0438\u0442');
    const fuzzyHit = page
      .locator('#global-search-results.open .header-search-item')
      .filter({ hasText: /\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442/i })
      .first();
    await expect(fuzzyHit).toBeVisible();
    await fuzzyHit.click();
    await expect(page).toHaveURL(/#languages\/list\/item\/languages\//);
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442/i);
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

  test('glossary renders per-term LES links (not one shared URL)', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/glossary');
    const links = page.locator('#glossary-list .glossary-les-link');
    await expect(links.first()).toBeVisible();
    const href1 = await links.nth(0).getAttribute('href');
    const href2 = await links.nth(1).getAttribute('href');
    expect(href1).toBeTruthy();
    expect(href2).toBeTruthy();
    expect(String(href1)).toContain('samskrtam.ru/sanskrit-lexicon/les-1990/');
    expect(String(href2)).toContain('samskrtam.ru/sanskrit-lexicon/les-1990/');
    expect(String(href1)).toContain('?s=');
    expect(String(href2)).toContain('?s=');
    expect(href1).not.toBe(href2);
  });

  test('list hash query restores list search input', async ({ page }) => {
    await page.goto('/aaz-index.html#all/list/q/%D0%B6%D0%B5');
    await expect(page).toHaveURL(/#all\/list\/q\//);
    await expect(page.locator('#search-input')).toHaveValue('\u0436\u0435');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
  });

  test('reverse lexicon and combined index render in multiple columns on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    await page.goto('/aaz-index.html#lexicon_reverse/list');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
    const reverseColumns = await page.locator('#name-list').evaluate((el) => {
      const count = parseInt(window.getComputedStyle(el).columnCount || '1', 10);
      return Number.isFinite(count) ? count : 1;
    });
    expect(reverseColumns).toBeGreaterThan(1);

    await page.goto('/aaz-index.html#all/list');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
    const allColumns = await page.locator('#name-list').evaluate((el) => {
      const count = parseInt(window.getComputedStyle(el).columnCount || '1', 10);
      return Number.isFinite(count) ? count : 1;
    });
    expect(allColumns).toBeGreaterThan(1);
    await expect(page.locator('#name-list .letter-header').first()).toBeVisible();
  });

  test('materials lecture compare tab renders', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await page.locator('.entity-btn[data-entity="materials"]').click();
    await page.locator('.tab[data-tab="lecture_compare"]').click();
    await expect(page.locator('#lecture-compare-a')).toBeVisible();
    await expect(page.locator('#lecture-compare-b')).toBeVisible();
  });

  test('lectures panel keeps preface separate and lectures paired', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/lectures');
    const cards = page.locator('#lectures-grid .lecture-card');
    await expect(cards).toHaveCount(11);
    await expect(cards.first()).toContainText('\u041f\u0440\u0435\u0434\u0438\u0441\u043b\u043e\u0432\u0438\u0435');
    await expect(cards.nth(1)).toContainText('\u041b\u0435\u043a\u0446\u0438\u044f 1');
    const firstStyle = await cards.first().getAttribute('style');
    expect(String(firstStyle || '')).toContain('grid-column:1 / -1');
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

  test('map tab survives tile provider failures with working fallback', async ({ page }) => {
    await page.goto('/aaz-index.html#toponyms/map');
    const mapHost = page.locator('#leaflet-map');
    await expect(mapHost).toBeVisible();
    await expect
      .poll(async () => mapHost.evaluate((el) => {
        const hasLeafletTiles = !!el.querySelector('.leaflet-pane, .leaflet-tile-pane, .leaflet-layer');
        const hasOfflineSvg = !!el.querySelector('svg circle[data-head]');
        const text = (el.textContent || '').toLowerCase();
        const hasOfflineText = text.includes('\u043e\u0444\u043b\u0430\u0439\u043d-\u0440\u0435\u0436\u0438\u043c');
        const hasStatus = text.includes('\u043a\u0430\u0440\u0442\u0430:');
        return hasLeafletTiles || hasOfflineSvg || hasOfflineText || hasStatus;
      }), { timeout: 12000 })
      .toBeTruthy();
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

  test('scholar chronology tab supports filters and event navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#scholar/chronology');
    await expect(page.locator('#chronology-type')).toBeVisible();
    await expect(page.locator('#chronology-zoom')).toBeVisible();
    await expect(page.locator('#chronology-export-md')).toBeVisible();
    await page.selectOption('#chronology-type', 'publication');
    await page.selectOption('#chronology-zoom', 'xx');
    const row = page.locator('.chronology-event-link').first();
    await expect(row).toBeVisible();
    const before = page.url();
    await row.click();
    await expect(page).not.toHaveURL(before);
  });

  test('scholar accent paradigms compare renders and reacts to selection', async ({ page }) => {
    await page.goto('/aaz-index.html#scholar/scholar');
    await expect(page.locator('#accent-compare-a')).toBeVisible();
    await expect(page.locator('#accent-compare-b')).toBeVisible();
    await expect(page.locator('#accent-compare-c')).toBeVisible();
    await expect(page.locator('#accent-compare-export-md')).toBeVisible();
    await page.selectOption('#accent-compare-a', '0');
    await page.selectOption('#accent-compare-b', '2');
    await page.selectOption('#accent-compare-c', '4');
    await expect(page.locator('#accent-compare-box table')).toBeVisible();
    await expect(page.locator('#accent-compare-box td').first()).toBeVisible();
  });

  test('phonetic correspondences table supports filters and links', async ({ page }) => {
    await page.goto('/aaz-index.html#scholar/scholar');
    await expect(page.locator('#corr-family-filter')).toBeVisible();
    await expect(page.locator('#corr-lang-filter')).toBeVisible();
    await expect(page.locator('#corr-law-filter')).toBeVisible();
    await page.selectOption('#corr-lang-filter', 'san');
    const row = page.locator('.corr-row').first();
    await expect(row).toBeVisible();
    await row.locator('.corr-lang-link').first().click();
    await expect(page).toHaveURL(/#languages\/list\/item\/languages\//);
    await page.goto('/aaz-index.html#scholar/scholar');
    await page.locator('.corr-law-link').first().click();
    await expect(page).toHaveURL(/#materials\/phonetic_laws/);
  });

  test('scholar slovo section supports thesis anchors and further reading links', async ({ page }) => {
    await page.goto('/aaz-index.html#scholar/scholar/anchor/sch-slovo-arg-2');
    const arg = page.locator('#sch-slovo-arg-2');
    await expect(arg).toBeVisible();
    await expect(page.locator('.scholar-slovo-anchor[data-anchor="sch-slovo-arg-2"]')).toBeVisible();
    await expect(page.locator('#sch-slovo')).toBeVisible();
    await expect(page.locator('text=Что читать дальше')).toBeVisible();
    await expect(page.locator('#content a[href*="inslav.ru/people/zaliznyak-andrey-anatolevich-1935-2017"]').first()).toBeVisible();
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
