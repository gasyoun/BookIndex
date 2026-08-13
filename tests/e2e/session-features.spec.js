const { test, expect } = require('@playwright/test');

// Regression coverage for the features added this session: home task dashboard
// (B4), chapter ribbon (B1), KWIC over lectures, video gallery (B3.5), entity
// card order/dedup/actions (B5 + review fix), page citations (B2), and the
// lecture↔video link (B3.4).

test.describe('home task dashboard (B4 + U1)', () => {
  test('four task tiles, video search is inline, page tile navigates', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    await expect(page.locator('.home-tasks')).toBeVisible();
    // U1 (H2127): reading, video, term search, and the index browse entry.
    await expect(page.locator('.home-task')).toHaveCount(4);

    // inline video search over the catalog
    await page.locator('#home-task-video-input').fill('берестян');
    await expect(page.locator('#home-task-video-results .home-task-video-row').first()).toBeVisible();

    // page tile -> reading-now view for that page
    await page.locator('#home-task-page-input').fill('272');
    await page.locator('#home-task-page button[type="submit"]').click();
    await expect(page).toHaveURL(/reading\/272$/);
    await expect(page.locator('.reading-now-page-title')).toContainText('272');
  });

  // U1 (H2127): the fourth entry — browse a whole index — and task-first ordering.
  test('index tile opens the chosen index list', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    const select = page.locator('#home-task-index-select');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveCount(8);
    await select.selectOption('toponyms');
    await page.locator('#home-task-index button[type="submit"]').click();
    await expect(page).toHaveURL(/#v4\/toponyms\/list$/);
    await expect(page.locator('#name-list')).toBeVisible();
  });

  test('tasks precede the «Книга в цифрах» showcase on home', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    await expect(page.locator('.home-tasks')).toBeVisible();
    await expect(page.locator('.home-stats-hero')).toBeVisible();
    const order = await page.evaluate(() => {
      const panel = document.querySelector('.home-panel');
      const tasks = panel && panel.querySelector('.home-tasks');
      const hero = panel && panel.querySelector('.home-stats-hero');
      const recents = panel && panel.querySelector('.home-recent-card');
      if (!tasks || !hero || !recents) return null;
      return {
        tasksBeforeHero: !!(tasks.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING),
        recentsBeforeHero: !!(recents.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });
    expect(order).toBeTruthy();
    expect(order.tasksBeforeHero).toBeTruthy();
    expect(order.recentsBeforeHero).toBeTruthy();
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

  test('controls carry accessible names and the result count is a live region', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/video');
    await expect(page.locator('#vg-search')).toHaveAttribute('aria-label', /.+/);
    await expect(page.locator('#vg-chapter')).toHaveAttribute('aria-label', /.+/);
    await expect(page.locator('#vg-sort')).toHaveAttribute('aria-label', /.+/);
    await expect(page.locator('#vg-meta')).toHaveAttribute('role', 'status');
    await expect(page.locator('#vg-meta')).toHaveAttribute('aria-live', 'polite');
  });

  test('empty search shows an empty state with a working reset', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/video');
    // Cards are painted after APP_DATA hydrates; counting immediately races to 0
    // and then reset "fails" because `all` was 0 (CI flake on #259, 2 workers).
    await expect(page.locator('#vg-list .vg-card').first()).toBeVisible();
    const all = await page.locator('#vg-list .vg-card').count();
    await page.locator('#vg-search').fill('zzzznonexistentquery');
    await expect(page.locator('.vg-empty')).toBeVisible();
    await expect(page.locator('#vg-list .vg-card')).toHaveCount(0);
    await page.locator('.vg-empty-reset').click();
    await expect.poll(async () => page.locator('#vg-list .vg-card').count()).toBe(all);
    await expect(page.locator('#vg-search')).toBeFocused();
  });

  test('defaults to dense rows and the "Превью" toggle switches to thumbs, persisting across reload', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/video');
    await expect(page.locator('#vg-list')).toHaveClass(/vg-list-dense/);
    await expect(page.locator('#vg-list .vg-card-thumb')).toHaveCount(0);

    const toggle = page.locator('#vg-thumbs-toggle');
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(page.locator('#vg-list')).toHaveClass(/vg-list-thumbs/);
    const firstThumb = page.locator('#vg-list .vg-card-thumb').first();
    await expect(firstThumb).toBeVisible();
    await expect(firstThumb).toHaveAttribute('alt', '');
    await expect(firstThumb).toHaveAttribute('loading', 'lazy');
    await expect(firstThumb).toHaveAttribute('src', /img\.youtube\.com\/vi\/.+\/mqdefault\.jpg/);

    await page.reload();
    await expect(page.locator('#vg-list')).toHaveClass(/vg-list-thumbs/);
    await expect(page.locator('#vg-thumbs-toggle')).toBeChecked();
  });

  test('no horizontal overflow at mobile width (390) in dense or thumbs mode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/aaz-index.html#v4/materials/video');
    await expect(page.locator('#vg-list')).toHaveClass(/vg-list-dense/);
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.locator('#vg-thumbs-toggle').check();
    await expect(page.locator('#vg-list')).toHaveClass(/vg-list-thumbs/);
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('video detail card (H1604 / B4 residual)', () => {
  test('hash route shows metadata, entity chips, and honesty note', async ({ page }) => {
    // known catalog id: А.А. Зализняк. Коротко об арабском языке
    await page.goto('/aaz-index.html#v4/materials/video/tv87ggs0yq4');
    await expect(page.locator('.video-detail')).toBeVisible();
    await expect(page.locator('.video-detail-title')).toContainText('арабск', { ignoreCase: true });
    await expect(page.locator('.video-detail-meta')).toBeVisible();
    await expect(page.locator('.video-detail-yt')).toHaveAttribute('href', /youtube\.com\/watch\?v=tv87ggs0yq4/);
    await expect(page.locator('.video-detail-chip').first()).toBeVisible();
    await expect(page.locator('.video-detail-chapter-note')).toContainText('не запись');

    // entity chip navigates into the index
    await page.locator('.video-detail-chip').first().click();
    await expect(page).toHaveURL(/#v4\/.+\/list\/item\//);
  });

  test('gallery title and home search open the detail route', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/video');
    await expect(page.locator('#vg-list .vg-card-title').first()).toBeVisible();
    await page.locator('#vg-list .vg-card-title').first().click();
    await expect(page).toHaveURL(/#v4\/materials\/video\/[A-Za-z0-9_-]{6,}/);
    await expect(page.locator('.video-detail')).toBeVisible();
    await page.locator('.video-detail-back').click();
    await expect(page).toHaveURL(/#v4\/materials\/video$/);
    await expect(page.locator('#vg-list')).toBeVisible();

    await page.goto('/aaz-index.html#v4/home/home');
    await page.locator('#home-task-video-input').fill('берестян');
    await expect(page.locator('#home-task-video-results .home-task-video-row').first()).toBeVisible();
    await page.locator('#home-task-video-results .home-task-video-row').first().click();
    await expect(page).toHaveURL(/#v4\/materials\/video\/[A-Za-z0-9_-]{6,}/);
    await expect(page.locator('.video-detail')).toBeVisible();
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
