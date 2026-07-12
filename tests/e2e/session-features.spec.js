const { test, expect } = require('@playwright/test');

// Regression coverage for the features added this session: home task dashboard
// (B4), chapter ribbon (B1), KWIC over lectures, video gallery (B3.5), entity
// card order/dedup/actions (B5 + review fix), page citations (B2), and the
// lecture↔video link (B3.4).

test.describe('home task dashboard (B4)', () => {
  test('three task tiles, video search is inline, page tile navigates', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    await expect(page.locator('.home-tasks')).toBeVisible();
    await expect(page.locator('.home-task')).toHaveCount(3);

    // inline video search over the catalog
    await page.locator('#home-task-video-input').fill('берестян');
    await expect(page.locator('#home-task-video-results .home-task-video-row').first()).toBeVisible();

    // page tile -> reading-now view for that page
    await page.locator('#home-task-page-input').fill('272');
    await page.locator('#home-task-page button[type="submit"]').click();
    await expect(page).toHaveURL(/reading\/272$/);
    await expect(page.locator('.reading-now-page-title')).toContainText('272');
  });
});

test.describe('chapter ribbon (B1)', () => {
  test('reading-now shows an 11-segment chapter density ribbon', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/lectures');
    const ribbon = page.locator('#reading-chapter-ribbon');
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator('.reading-chapter-seg')).toHaveCount(11);
    // clicking a segment moves the page view into that chapter
    await ribbon.locator('.reading-chapter-seg').nth(8).click();
    await expect(page.locator('.reading-now-page-title')).toContainText('Берестяные грамоты');
  });
});

test.describe('KWIC over the lecture corpus', () => {
  test('lectures source returns timecoded deep links', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/kwic');
    await expect(page.locator('#kwic-source')).toBeVisible();
    await page.locator('#kwic-source').selectOption('lectures');
    await page.locator('#kwic-query').fill('ударение');
    const firstLink = page.locator('.kwic-row .kwic-video-link').first();
    await expect(firstLink).toBeVisible({ timeout: 20000 });
    await expect(firstLink).toHaveAttribute('href', /[?&]t=\d+s$/);
    await expect(page.locator('#kwic-meta')).toContainText('лекци');
  });
});

test.describe('video gallery (B3.5)', () => {
  test('lists deduped videos with working chapter filter', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/video');
    await expect(page.locator('#vg-list')).toBeVisible();
    const all = await page.locator('#vg-list .vg-card').count();
    expect(all).toBeGreaterThan(100); // ~175 deduped
    // chapter filter narrows the set
    await page.locator('#vg-chapter').selectOption('6'); // Арабский язык
    await expect.poll(async () => page.locator('#vg-list .vg-card').count()).toBeLessThan(all);
    await expect(page.locator('#vg-list')).toContainText('арабск', { ignoreCase: true });
  });
});

test.describe('entity card (B5 order, dedup, actions, B2 citation)', () => {
  test('video chips are unique and ordered before cross-links; actions collapsed; citation canonical', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/languages/list/item/languages/russkii');
    // wait for the card to fully settle (video heading present)
    await expect(page.locator('.card h3', { hasText: 'Видео' })).toBeVisible();
    await expect(page.locator('.card-video-link').first()).toBeVisible();

    // dedup: no duplicate video href (ignoring the &t= suffix)
    const hrefs = await page.locator('.card-video-link').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href').replace(/[?&]t=.*/, '')));
    expect(new Set(hrefs).size).toBe(hrefs.length);

    // B5 order: the «Видео» section comes before the cross-link sections
    const headings = await page.locator('.card h3').evaluateAll((els) => els.map((e) => (e.textContent || '').trim()));
    const videoIdx = headings.findIndex((h) => h.includes('Видео'));
    const crossIdx = headings.findIndex((h) => /Связанные/.test(h));
    expect(videoIdx).toBeGreaterThanOrEqual(0);
    if (crossIdx >= 0) expect(videoIdx).toBeLessThan(crossIdx);

    // B5 actions menu: secondary actions collapsed into a details menu, still wired
    await expect(page.locator('.card-actions-more')).toBeVisible();
    await expect(page.locator('.card-actions-more #copy-card-link')).toHaveCount(1);
    await expect(page.locator('.card-actions-more #export-card-md')).toHaveCount(1);
  });

  test('citation cites the clean canonical URL with a page reference (B2)', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/toponyms/list/item/toponyms/angliya');
    const box = page.locator('.citation-box').first();
    await expect(box).toContainText('https://gasyoun.github.io/BookIndex/toponyms/list/item/toponyms/angliya/');
    await expect(box).toContainText('С. ');
    await expect(box).not.toContainText('aaz-index.html#');
  });

  test('authority chips are grouped with cross-links (A3)', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/toponyms/list/item/toponyms/angliya');
    await expect(page.locator('.card-lod-section', { hasText: 'Авторитетные записи' })).toBeVisible();
    await expect(page.locator('.lod-link.wikidata').first()).toHaveAttribute('href', /wikidata\.org\/wiki\/Q\d+/);
  });

  test('copy link carries the entity\'s own book scope now that the corpus spans several books (A2.4)', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/toponyms/list/item/toponyms/angliya');
    await page.evaluate(() => {
      window.__copiedCardUrl = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (value) => { window.__copiedCardUrl = String(value || ''); } },
      });
    });

    // production corpus already merges mumintroll/zametki/slovo — the copied
    // link for a mumintroll-only head carries that book's scope.
    await page.locator('.card-actions-more > summary').click();
    await page.locator('#copy-card-link').click();
    await expect.poll(() => page.evaluate(() => window.__copiedCardUrl || ''))
      .toBe('https://gasyoun.github.io/BookIndex/toponyms/list/item/toponyms/angliya/?book=mumintroll');

    // with a single-book corpus the scope is redundant and stays off the link.
    await page.evaluate(() => {
      window.APP_DATA.corpus.books = window.APP_DATA.corpus.books.filter((b) => b.book_id === 'mumintroll');
      window.renderCardInRight();
    });
    await page.locator('.card-actions-more > summary').click();
    await page.locator('#copy-card-link').click();
    await expect.poll(() => page.evaluate(() => window.__copiedCardUrl || ''))
      .toBe('https://gasyoun.github.io/BookIndex/toponyms/list/item/toponyms/angliya/');
  });
});

test.describe('lecture ↔ video link (B3.4)', () => {
  test('lecture page lists topically related videos with an honest note', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/lecture_pages/6'); // Арабский язык
    await expect(page.locator('.lecture-page-meta')).toContainText('стр.');
    await expect(page.locator('.lecture-page-video-note')).toContainText('не записи');
    await expect(page.locator('.lecture-page-video').first()).toBeVisible();
  });
});
