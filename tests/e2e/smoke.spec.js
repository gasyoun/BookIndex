const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.describe('aaz-index smoke', () => {
  test('loads home and renders navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await expect(page.locator('#home-link')).toBeVisible();
    await expect(page.locator('#entity-switcher .entity-btn')).toHaveCount(11);
    await expect(page.locator('#tabs .tab')).toHaveCount(1);
    await expect(page.locator('#tabs .tab')).toHaveText(/Главная|Home/);
    await expect(page.locator('.home-stats-hero')).toBeVisible();
    await expect(page.locator('#home-stats-grid .home-stat-cell')).toHaveCount(8);
    const siteDownloadPromise = page.waitForEvent('download');
    await page.locator('#export-site-md').click();
    const siteDownload = await siteDownloadPromise;
    const sitePath = await siteDownload.path();
    const siteMarkdown = sitePath ? await fs.readFile(sitePath, 'utf8') : '';
    expect(siteMarkdown).toContain('Источник: **Из жизни слов и языков**');
    expect(siteMarkdown).toContain('book_id: mumintroll');
  });

  test('corpus shell registers current book and accepts book route aliases', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/books/mumintroll/home/home');
    await expect(page.locator('.home-panel')).toBeVisible();
    await expect(page.locator('#corpus-status .corpus-chip.active')).toContainText('Из жизни слов и языков');
    await expect(page.locator('#corpus-status')).toContainText('Видео: 200');
    await expect(page.locator('#global-search-scope')).toHaveValue('current');

    const corpus = await page.evaluate(() => window.APP_DATA && window.APP_DATA.corpus);
    expect(corpus.active_book_id).toBe('mumintroll');
    expect(corpus.books[0].source_type).toBe('book');
    expect(corpus.source_types.some((source) => source.type === 'video_catalog' && source.planned_count === 200)).toBe(true);

    await page.goto('/aaz-index.html#v4/scholar/page_trends?books=mumintroll');
    await expect(page.locator('.page-trends-source-chip')).toContainText('Из жизни слов и языков');
    const queryBookId = await page.evaluate(() => window.APP_DATA.corpus.active_book_id);
    expect(queryBookId).toBe('mumintroll');

    await page.goto('/aaz-index.html#v4/books/mumintroll/names/list');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
    await expect(page).toHaveURL(/#v4\/names\/list$/);
  });

  test('global search scope can switch between current book and corpus', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    const input = page.locator('#global-search');
    const scope = page.locator('#global-search-scope');
    await expect(scope).toHaveValue('current');

    await input.fill('иткин');
    const firstResult = page.locator('#global-search-results.open .header-search-item').first();
    await expect(firstResult).toBeVisible();
    await expect(firstResult.locator('.search-meta')).toContainText('Из жизни слов и языков');

    await scope.selectOption('corpus');
    await expect(scope).toHaveValue('corpus');
    await expect(firstResult).toBeVisible();
    await expect(page.locator('#global-search-results.open .header-search-group').first()).toContainText('\u0418\u0437 \u0436\u0438\u0437\u043d\u0438 \u0441\u043b\u043e\u0432 \u0438 \u044f\u0437\u044b\u043a\u043e\u0432');

    const savedScope = await page.evaluate(() => {
      const raw = localStorage.getItem('zaliznyakiada.ui.v1');
      return raw ? JSON.parse(raw).globalSearchScope : '';
    });
    expect(savedScope).toBe('corpus');
  });

  test('corpus sources panel shows books and planned video catalog', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/corpus/sources');
    await expect(page.locator('.corpus-panel')).toBeVisible();
    await expect(page.locator('.corpus-panel-header h2')).toContainText('Источники корпуса');
    await expect(page.locator('.corpus-source-card').filter({ hasText: 'Из жизни слов и языков' })).toBeVisible();
    await expect(page.locator('.corpus-source-card').filter({ hasText: 'Видеокаталог' })).toContainText('тайм-кодами');
    await expect(page.locator('.corpus-metrics-row').first()).toContainText('200');
    await expect(page.locator('.corpus-quality-panel')).toContainText('source coverage');
    await expect(page.locator('.corpus-quality-panel')).toContainText('duplicate head groups');
  });

  test('PWA manifest and service worker are available', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', /manifest\.webmanifest/);

    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
      if (!href) return null;
      const res = await fetch(new URL(href, location.href).toString());
      if (!res.ok) return null;
      return res.json();
    });
    expect(manifest).toBeTruthy();
    expect(manifest.start_url).toContain('aaz-index.html');
    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);

    await expect.poll(() => page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return '';
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return '';
      if (reg.active && reg.active.scriptURL) return reg.active.scriptURL;
      if (reg.waiting && reg.waiting.scriptURL) return reg.waiting.scriptURL;
      if (reg.installing && reg.installing.scriptURL) return reg.installing.scriptURL;
      return '';
    }), { timeout: 20000 }).toContain('/sw.js');
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

  test('compact viewport smoke has no page-level horizontal overflow', async ({ page }) => {
    const assertNoPageOverflow = async () => {
      const metrics = await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
        };
      });
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 8);
    };

    for (const viewport of [
      { width: 900, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);

      await page.goto('/aaz-index.html#v4/home/home');
      await expect(page.locator('.home-panel')).toBeVisible();
      await assertNoPageOverflow();

      await page.goto('/aaz-index.html#v4/names/list');
      await page.locator('#name-list .name-item').first().click();
      await expect(page.locator('.card')).toBeVisible();
      await assertNoPageOverflow();

      await page.goto('/aaz-index.html#v4/scholar/viz/module/viz03');
      await expect(page.locator('.viz-shell')).toBeVisible();
      await assertNoPageOverflow();
    }
  });

  test('theme toggle persists after reload', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const themeButton = page.locator('#theme-btn');
    await expect(themeButton).toBeVisible();

    const initial = await page.evaluate(() => ({
      dark: document.body.classList.contains('theme-dark'),
      saved: localStorage.getItem('zaliznyakiada.theme.v1'),
    }));
    await themeButton.click();

    const expectedDark = !initial.dark;
    const expectedSaved = expectedDark ? 'dark' : 'light';
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('theme-dark'))).toBe(expectedDark);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('zaliznyakiada.theme.v1'))).toBe(expectedSaved);

    await page.reload();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('theme-dark'))).toBe(expectedDark);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('zaliznyakiada.theme.v1'))).toBe(expectedSaved);
  });

  test('dark theme keeps readable contrast on key panels', async ({ page }) => {
    const contrastFor = async (selector) => page.evaluate((sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;

      const parse = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return null;
        if (raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

        const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
        const parseByte = (token) => {
          const t = String(token || '').trim();
          if (!t) return null;
          const n = t.endsWith('%') ? (parseFloat(t) * 255) / 100 : parseFloat(t);
          return Number.isFinite(n) ? clamp(Math.round(n), 0, 255) : null;
        };
        const parseAlpha = (token) => {
          const t = String(token || '').trim();
          if (!t) return null;
          const n = t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t);
          return Number.isFinite(n) ? clamp(n, 0, 1) : null;
        };

        const rgb = raw.match(/^rgba?\((.+)\)$/i);
        if (rgb) {
          const tokens = rgb[1].replace(/\s*\/\s*/g, ',').split(/[\s,]+/).filter(Boolean);
          if (tokens.length < 3) return null;
          const r = parseByte(tokens[0]);
          const g = parseByte(tokens[1]);
          const b = parseByte(tokens[2]);
          if (r == null || g == null || b == null) return null;
          const alpha = tokens[3] == null ? 1 : parseAlpha(tokens[3]);
          if (alpha == null) return null;
          return { r, g, b, a: alpha };
        }

        const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
        if (!hex) return null;
        const body = hex[1];
        const expand = body.length === 3 ? body.split('').map((ch) => ch + ch).join('') : body;
        const r = parseInt(expand.slice(0, 2), 16);
        const g = parseInt(expand.slice(2, 4), 16);
        const b = parseInt(expand.slice(4, 6), 16);
        const a = expand.length === 8 ? parseInt(expand.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
      };
      const lum = ({ r, g, b }) => {
        const f = (x) => {
          const v = x / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (fg, bg) => {
        const l1 = lum(fg);
        const l2 = lum(bg);
        const top = Math.max(l1, l2);
        const bottom = Math.min(l1, l2);
        return (top + 0.05) / (bottom + 0.05);
      };
      const background = (el) => {
        let cur = el;
        while (cur) {
          const color = parse(getComputedStyle(cur).backgroundColor);
          if (color && color.a > 0.01) return color;
          cur = cur.parentElement;
        }
        return { r: 28, g: 27, b: 24, a: 1 };
      };

      const fg = parse(getComputedStyle(node).color);
      if (!fg) return null;
      const bg = background(node);
      return ratio(fg, bg);
    }, selector);

    await page.goto('/aaz-index.html#home/home');
    await page.locator('#theme-btn').click();
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('theme-dark'))).toBe(true);

    await page.goto('/aaz-index.html#names/list');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
    await expect(page.locator('#name-list .name-item .list-book-chip').first()).toContainText('Из жизни слов и языков');
    await page.locator('#name-list .name-item').first().click();
    await expect(page.locator('#right-content .card h2')).toBeVisible();
    expect(await contrastFor('#name-list .name-item')).toBeGreaterThan(3);
    expect(await contrastFor('#right-content .card h2')).toBeGreaterThan(4);

    await page.goto('/aaz-index.html#scholar/scholar');
    await expect(page.locator('#corr-family-filter')).toBeVisible();
    await expect(page.locator('.corr-row').first()).toBeVisible();
    expect(await contrastFor('.corr-row td')).toBeGreaterThan(3);

    await page.goto('/aaz-index.html#names/graph');
    await expect(page.locator('.graph-container .chart-intro')).toBeVisible();
    expect(await contrastFor('.graph-container .chart-intro')).toBeGreaterThan(3);

    await page.goto('/aaz-index.html#toponyms/map');
    await expect(page.locator('.map-container .chart-intro')).toBeVisible();
    expect(await contrastFor('.map-container .chart-intro')).toBeGreaterThan(3);
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
    const cardDownloadPromise = page.waitForEvent('download');
    await page.locator('#right-content button#export-card-md').click();
    const cardDownload = await cardDownloadPromise;
    const cardPath = await cardDownload.path();
    const cardMarkdown = cardPath ? await fs.readFile(cardPath, 'utf8') : '';
    expect(cardMarkdown).toContain('source: "Из жизни слов и языков"');
    expect(cardMarkdown).toContain('book_id: "mumintroll"');
    await page.locator('#right-content button#copy-card-link').click();
    await expect(page.locator('#ui-live-status')).toHaveCount(1);
    await expect(page).toHaveURL(/#(?:v4\/)?names\/list/);
  });

  test('breadcrumbs render route hierarchy with live links', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    const nav = page.locator('#breadcrumb-nav');
    await expect(nav).toContainText(/\u0413\u043b\u0430\u0432\u043d\u0430\u044f/i);
    await expect(nav.locator('a')).toHaveCount(0);

    await page.goto('/aaz-index.html#v4/names/list');
    await expect(nav.locator('a').first()).toContainText(/\u0413\u043b\u0430\u0432\u043d\u0430\u044f/i);
    await expect(nav.locator('.breadcrumb-current')).toContainText(/\u0418\u043c\u0435\u043d\u0430/i);

    await page.goto('/aaz-index.html#v4/materials/kwic');
    await expect(nav).toContainText(/\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b/i);
    await expect(nav.locator('.breadcrumb-current')).toContainText(/KWIC/);

    await page.goto('/aaz-index.html#v4/names/list/item/names/' + encodeURIComponent('\u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440 \u041c\u0430\u043a\u0435\u0434\u043e\u043d\u0441\u043a\u0438\u0439'));
    await expect(nav.locator('a')).toHaveCount(2);
    await expect(nav.locator('.breadcrumb-current')).toContainText(/\u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440/i);
  });

  test('context autolink renders clickable entity references', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/names/list/item/names/%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80%20%D0%9C%D0%B0%D0%BA%D0%B5%D0%B4%D0%BE%D0%BD%D1%81%D0%BA%D0%B8%D0%B9');
    const links = page.locator('#right-content .context-text .ctx-link');
    await expect(links.first()).toBeVisible();
    const prevUrl = page.url();
    const count = await links.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const dataType = String((await link.getAttribute('data-type')) || '');
      if (!['names', 'toponyms', 'ethnonyms', 'languages'].includes(dataType)) continue;
      const href = String((await link.getAttribute('href')) || '');
      if (!href || prevUrl.endsWith(href)) continue;
      await link.click();
      clicked = true;
      break;
    }
    if (clicked) {
      await expect(page).not.toHaveURL(prevUrl);
      await expect(page).toHaveURL(/#v4\/(names|toponyms|ethnonyms|languages)\//);
    } else {
      const href = await links.first().getAttribute('href');
      expect(String(href || '')).toMatch(/^#v4\/(names|toponyms|ethnonyms|languages)\//);
    }
  });

  test('glossary terms are autolinked in context texts', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/languages/list/item/languages/' + encodeURIComponent('\u043f\u0440\u0430\u0438\u043d\u0434\u043e\u0435\u0432\u0440\u043e\u043f\u0435\u0439\u0441\u043a\u0438\u0439'));
    const glossaryLink = page.locator('.ctx-link[data-type="glossary"]').first();
    const count = await glossaryLink.count();
    if (count > 0) {
      await glossaryLink.click();
      await expect(page).toHaveURL(/#v4\/materials\/glossary/);
    }
  });

  test('subject_index item shows crosslinks to lexicon or names or languages', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/subject/list');
    const badge = page.locator('#name-list .crosslink-badge').first();
    await expect(badge).toBeVisible();
    await badge.click();
    await expect(page).toHaveURL(/#v4\/(lexicon|names|languages)\//);
  });

  test('name card shows bidirectional relations', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/names/list/item/names/' + encodeURIComponent('\u0413\u0440\u0438\u043c\u043c \u042f.'));
    const chips = page.locator('#right-content .relation-chip');
    await expect(chips.first()).toBeVisible();
    await expect.poll(async () => chips.count()).toBeGreaterThan(0);
  });

  test('lexicon card KWIC jump navigates and filters', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/lexicon/list/item/lexicon/' + encodeURIComponent('\u0430'));
    const jumpBtn = page.locator('#right-content .kwic-jump-btn').first();
    await expect(jumpBtn).toBeVisible();
    await jumpBtn.click();
    await expect(page).toHaveURL(/#v4\/materials\/kwic/);
    await expect(page.locator('#kwic-query')).toHaveValue('\u0430');
  });

  test('lexicon card links back to subject_index', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/lexicon/list/item/lexicon/' + encodeURIComponent('\u0430'));
    const badge = page.locator('.subject-crosslinks .crosslink-badge').first();
    await expect(badge).toBeVisible();
    await badge.click();
    await expect(page).toHaveURL(/#v4\/subject\//);
  });

  test('name card keeps source confirmed in header row and avoids duplicate wikipedia quote', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/names/list/item/names/%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80%20%D0%9C%D0%B0%D0%BA%D0%B5%D0%B4%D0%BE%D0%BD%D1%81%D0%BA%D0%B8%D0%B9');
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440/i);

    const metaRow = page.locator('#right-content .card .card-meta-row');
    const sourceConfirmed = metaRow.locator('.card-status-inline');
    await expect(metaRow).toBeVisible();
    await expect(metaRow.locator('.card-book-chip')).toContainText('Из жизни слов и языков');
    await expect(sourceConfirmed).toHaveText(/source confirmed/i);
    await expect(page.locator('#right-content .card .card-occurrence-strip')).toContainText('contexts');
    await expect(page.locator('#right-content .card .card-occurrence-strip')).toContainText('refs');

    const rowTopSpread = await page.evaluate(() => {
      const row = document.querySelector('#right-content .card .card-meta-row');
      const cat = row ? row.querySelector('.category') : null;
      const badge = row ? row.querySelector('.card-status-inline') : null;
      if (!cat || !badge) return 999;
      return Math.abs(cat.getBoundingClientRect().top - badge.getBoundingClientRect().top);
    });
    expect(rowTopSpread).toBeLessThan(10);

    const wikiSourceLink = page.locator('#right-content .card a[href*="wikipedia.org"]').first();
    await expect(wikiSourceLink).toBeVisible();
    const wikiRowHtml = await wikiSourceLink.evaluate((el) => {
      const host = el.closest('.card-source-pill') || el.closest('div') || el;
      return host.innerHTML || '';
    });
    expect(wikiRowHtml).not.toContain('\u201c');
    expect(wikiRowHtml).not.toContain('\u201d');
    expect(wikiRowHtml).not.toContain('“');
    expect(wikiRowHtml).not.toContain('”');
  });

  test('toponym card uses two-column layout on desktop to reduce extra scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/aaz-index.html#v4/toponyms/list');
    const firstToponym = page.locator('#name-list .name-item').first();
    await expect(firstToponym).toBeVisible();
    await firstToponym.click();
    await expect(page).toHaveURL(/#(?:v4\/)?toponyms\/list\/item\/toponyms\//);
    await expect(page.locator('#right-content .card h2')).toBeVisible();

    const layout = page.locator('#right-content .card .card-two-col-layout');
    await expect(layout).toBeVisible();
    const columnCount = await layout.evaluate((el) => Number.parseInt(getComputedStyle(el).columnCount || '1', 10) || 1);
    expect(columnCount).toBeGreaterThanOrEqual(2);
  });

  test('item hash uses transliterated slugs and keeps backward compatibility with encoded cyrillic', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/languages/list/item/languages/sanskrit');
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442/i);
    await expect(page).toHaveURL(/#v4\/languages\/list\/item\/languages\/sanskrit$/);
    const inlinePadding = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('#right-content .card .pages-info .card-page-link')).slice(0, 3);
      if (!links.length) return null;
      return links.map((el) => {
        const st = window.getComputedStyle(el);
        return {
          left: parseFloat(st.paddingLeft || '0'),
          right: parseFloat(st.paddingRight || '0'),
          display: st.display,
        };
      });
    });
    expect(Array.isArray(inlinePadding)).toBeTruthy();
    for (const row of inlinePadding || []) {
      expect(row.left).toBeLessThanOrEqual(0.5);
      expect(row.right).toBeLessThanOrEqual(0.5);
      expect(row.display).toBe('inline');
    }

    const generatedHash = await page.evaluate(() => {
      if (typeof buildItemHash !== 'function') return '';
      return buildItemHash('languages', '\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442');
    });
    expect(generatedHash).toBe('#v4/languages/list/item/languages/sanskrit');

    await page.goto('/aaz-index.html#v4/languages/list/item/languages/%D1%81%D0%B0%D0%BD%D1%81%D0%BA%D1%80%D0%B8%D1%82');
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442/i);
    await expect(page).toHaveURL(/#v4\/languages\/list\/item\/languages\/sanskrit$/);
  });

  test('names graph supports weight filter, tooltip and navigation to card', async ({ page }) => {
    await page.goto('/aaz-index.html#names/graph');
    const slider = page.locator('#graph-min-weight');
    await expect(slider).toBeVisible();
    await expect(page.locator('#graph-min-weight-value')).toBeVisible();

    await expect
      .poll(() => page.locator('svg .name-graph-node').count(), { timeout: 20000 })
      .toBeGreaterThan(0);

    const summary = page.locator('#graph-summary');
    await expect(summary).toBeVisible();
    const beforeSummary = (await summary.innerText()).trim();

    await page.evaluate(() => {
      const input = document.getElementById('graph-min-weight');
      if (!input) return;
      const max = Number(input.max || '0');
      const next = Math.max(0.1, Math.min(max, 2));
      input.value = next.toFixed(1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('#graph-min-weight-value')).toHaveText('2.0');
    await expect.poll(async () => (await summary.innerText()).trim()).not.toBe(beforeSummary);
    await expect
      .poll(() => page.locator('svg .name-graph-node').count(), { timeout: 20000 })
      .toBeGreaterThan(0);

    const firstNode = page.locator('svg .name-graph-node').first();
    await firstNode.hover();
    await expect(page.locator('#graph-tooltip')).toBeVisible();
    await firstNode.click({ force: true });
    await expect(page).toHaveURL(/#(?:v4\/)?names\/list/);
    await expect(page.locator('#right-content .card h2')).toBeVisible();
  });

  test('home KPI rows are clickable and navigate to target sections', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const rows = page.locator('#home-fact-pair > div').first().locator('div');
    await expect(rows.nth(0)).toBeVisible();

    await rows.nth(0).click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/lecture_pages\//);

    await page.goto('/aaz-index.html#home/home');
    await rows.nth(1).click();
    await expect(page).toHaveURL(/#(?:v4\/)?languages\/list\/item\/languages\//);

    await page.goto('/aaz-index.html#home/home');
    await rows.nth(2).click();
    await expect(page).toHaveURL(/#(?:v4\/)?toponyms\/list\/item\/toponyms\//);
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

  test('global search shows scope-aware empty state', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    const scope = page.locator('#global-search-scope');

    await input.fill('bookindex-no-such-term');
    await expect(page.locator('#global-search-results.open .header-search-empty')).toContainText('текущей книге');

    await scope.selectOption('corpus');
    await expect(page.locator('#global-search-results.open .header-search-empty')).toContainText('корпусе');
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
    await expect(page).toHaveURL(/#(?:v4\/)?languages\/list\/item\/languages\//);
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442/i);
  });

  test('global search supports keyboard navigation (down/up/enter)', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('iv');
    const results = page.locator('#global-search-results.open .header-search-item');
    await expect(results.first()).toBeVisible();
    await input.press('ArrowDown');
    await expect.poll(() => input.getAttribute('aria-activedescendant')).toMatch(/global-search-item-/);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', /global-search-item-/);
    await input.press('Enter');
    await expect(page.locator('#content .panel.active')).toBeVisible();
    await expect(page).not.toHaveURL(/#(?:v4\/)?home\/home$/);
  });

  test('global search enter opens first match without explicit dropdown navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('iv');
    await input.press('Enter');
    await expect(page.locator('#content .panel.active')).toBeVisible();
    await expect(page).not.toHaveURL(/#(?:v4\/)?home\/home$/);
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
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/glossary\/term\//);
    await expect(page.locator('#glossary-search')).toBeVisible();
    await expect(page.locator('#glossary-search')).toHaveValue(/\u044d\u043d\u043a\u043b\u0438\u0442/i);
  });

  test('global search opens scholar accent paradigms section by route', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    const input = page.locator('#global-search');
    await input.fill('\u0430\u043a\u0446\u0435\u043d\u0442\u043d\u044b\u0435 \u043f\u0430\u0440\u0430\u0434\u0438\u0433\u043c\u044b');
    const routeHit = page
      .locator('#global-search-results.open .header-search-item')
      .filter({ hasText: /\u0430\u043a\u0446\u0435\u043d\u0442/i })
      .first();
    await expect(routeHit).toBeVisible();
    await routeHit.click();
    await expect(page).toHaveURL(/#(?:v4\/)?scholar\/scholar\/anchor\/sch-accents/);
    await expect(page.locator('#sch-accents')).toBeVisible();
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

  test('materials KWIC panel filters contexts and supports navigation actions', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/kwic');
    await expect(page.locator('#kwic-query')).toBeVisible();
    await expect(page.locator('#kwic-source')).toBeVisible();
    await expect(page.locator('#kwic-sort')).toBeVisible();

    const lexSeed = await page.evaluate(() => {
      const maxPage = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
      const items = Array.isArray(APP_DATA?.lexicon) ? APP_DATA.lexicon : [];
      for (const it of items) {
        const contexts = it && typeof it.contexts === 'object' ? it.contexts : {};
        for (const snippets of Object.values(contexts)) {
          if (!Array.isArray(snippets)) continue;
          for (const raw of snippets) {
            const text = String(raw || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const words = text
              .split(/[^A-Za-zА-Яа-яЁё0-9-]+/)
              .map((x) => x.trim())
              .filter((x) => x.length >= 4);
            for (const word of words) {
              const rows = typeof collectLexiconKwicRows === 'function'
                ? collectLexiconKwicRows(word, 1, maxPage)
                : [];
              if (rows.length) return word;
            }
          }
        }
      }
      return 'санск';
    });

    await page.locator('#kwic-source').selectOption('lexicon');
    await page.locator('#kwic-sort').selectOption('right');
    await page.locator('#kwic-page-start').fill('1');
    await page.locator('#kwic-page-end').fill('424');
    await page.locator('#kwic-query').fill(lexSeed);
    await page.locator('#kwic-run').click();
    await expect(page.locator('#kwic-source-hint')).toContainText('словарные карточки');

    const firstLexRow = page.locator('#kwic-results .kwic-row').first();
    await expect(firstLexRow).toBeVisible();
    await expect(firstLexRow.locator('.kwic-source-chip')).toContainText('Из жизни слов и языков');
    await firstLexRow.locator('.kwic-page-link').first().click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/lectures\/reading\/\d+/);

    await page.goto('/aaz-index.html#materials/kwic');
    await page.locator('#kwic-source').selectOption('lexicon');
    await page.locator('#kwic-sort').selectOption('right');
    await page.locator('#kwic-page-start').fill('1');
    await page.locator('#kwic-page-end').fill('424');
    await page.locator('#kwic-query').fill(lexSeed);
    await page.locator('#kwic-run').click();
    await expect(page.locator('#kwic-results .kwic-row').first()).toBeVisible();
    await firstLexRow.locator('.kwic-open-card').first().click();
    await expect(page).toHaveURL(/#(?:v4\/)?lexicon\/list\/item\/lexicon\//);
    await expect(page.locator('#right-content .card h2')).toBeVisible();

    await page.goto('/aaz-index.html#materials/kwic');
    const glossarySeed = await page.evaluate(() => {
      const maxPage = typeof getTotalBookPages === 'function' ? getTotalBookPages() : 424;
      const glossary = Array.isArray(APP_DATA?.glossary) ? APP_DATA.glossary : [];
      for (const g of glossary) {
        const term = String(g?.term || '').trim();
        if (!term) continue;
        const seed = term.slice(0, Math.min(term.length, 7));
        const rows = typeof collectGlossaryKwicRows === 'function'
          ? collectGlossaryKwicRows(seed, 1, maxPage)
          : [];
        if (rows.length) return seed;
      }
      return 'энклит';
    });

    await page.locator('#kwic-source').selectOption('glossary');
    await page.locator('#kwic-query').fill(glossarySeed);
    await page.locator('#kwic-run').click();
    await expect(page.locator('#kwic-source-hint')).toContainText('учебные определения');
    const firstGlossaryRow = page.locator('#kwic-results .kwic-row').first();
    await expect(firstGlossaryRow).toBeVisible();
    await firstGlossaryRow.locator('.kwic-open-glossary').first().click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/glossary\/term\//);
    await expect(page.locator('#glossary-search')).toBeVisible();
  });

  test('list hash query restores list search input', async ({ page }) => {
    await page.goto('/aaz-index.html#all/list/q/%D0%B6%D0%B5');
    await expect(page).toHaveURL(/#(?:v4\/)?all\/list\/q\//);
    await expect(page.locator('#search-input')).toHaveValue('\u0436\u0435');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();

    await page.goto('/aaz-index.html#all/list/q/bookindex-no-match');
    await expect(page.locator('#name-list .list-empty-message')).toBeVisible();
  });

  test('list toolbar keeps search and discussed filter on one row, export stays above right pane content', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/aaz-index.html#v4/lexicon_reverse/list');
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('#only-discussed-btn')).toBeVisible();

    const topSpread = await page.evaluate(() => {
      const search = document.getElementById('search-input');
      const discussed = document.getElementById('only-discussed-btn');
      if (!search || !discussed) return 999;
      return Math.abs(search.getBoundingClientRect().top - discussed.getBoundingClientRect().top);
    });
    expect(topSpread).toBeLessThan(10);

    const exportButton = page.locator('.right-pane-tools #export-section-md');
    await expect(exportButton).toBeVisible();
    await expect(page.locator('.filters #export-section-md')).toHaveCount(0);

    const exportAboveContent = await page.evaluate(() => {
      const btn = document.querySelector('.right-pane-tools #export-section-md');
      const content = document.getElementById('right-content');
      if (!btn || !content) return false;
      return btn.getBoundingClientRect().bottom <= content.getBoundingClientRect().top + 2;
    });
    expect(exportAboveContent).toBeTruthy();

    const sectionDownloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const sectionDownload = await sectionDownloadPromise;
    const sectionPath = await sectionDownload.path();
    const sectionMarkdown = sectionPath ? await fs.readFile(sectionPath, 'utf8') : '';
    expect(sectionMarkdown).toContain('Источник: **Из жизни слов и языков**');
    expect(sectionMarkdown).toContain('- book_id: mumintroll');
  });

  test('accented heads render as accent-safe spans in list and card', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/aaz-index.html#v4/toponyms/list');

    const target = await page.evaluate(() => {
      const hasAccent = (text) => /[\u0300-\u036f]/.test(String(text || ''));
      const kinds = ['toponyms', 'languages', 'lexicon', 'lexicon_reverse', 'subject', 'names'];
      for (const type of kinds) {
        const list = Array.isArray(APP_DATA?.[type]) ? APP_DATA[type] : [];
        for (const item of list) {
          const head = String(item && item.head ? item.head : '');
          if (!hasAccent(head)) continue;
          const hash = typeof buildItemHash === 'function' ? buildItemHash(type, head) : '';
          if (!hash) continue;
          return { type, head, hash };
        }
      }
      return null;
    });
    expect(target).toBeTruthy();

    await page.goto(`/aaz-index.html${target.hash}`);
    await expect(page.locator('#right-content .card h2')).toBeVisible();

    const wrappedInCard = await page.locator('#right-content .card h2 .accent-safe').count();
    expect(wrappedInCard).toBeGreaterThan(0);

    const wrappedInList = await page.locator('#name-list .name-item.selected .head .accent-safe').count();
    expect(wrappedInList).toBeGreaterThan(0);
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
    await expect(page.locator('.lecture-compare-pair[data-a][data-b]').first()).toBeVisible();
  });

  test('lecture compare suggested pairs are clickable and update selected lectures', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/lecture_compare');
    const firstPair = page.locator('.lecture-compare-pair[data-a][data-b]').first();
    await expect(firstPair).toBeVisible();
    const a = await firstPair.getAttribute('data-a');
    const b = await firstPair.getAttribute('data-b');
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();

    await firstPair.click();
    await expect(page.locator('#lecture-compare-a')).toHaveValue(String(a));
    await expect(page.locator('#lecture-compare-b')).toHaveValue(String(b));
    await expect(page.locator(`.lecture-compare-pair[data-a="${a}"][data-b="${b}"]`)).toHaveClass(/active/);
  });

  test('lectures panel keeps preface separate and lectures paired', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/lectures');
    const cards = page.locator('#lectures-grid .lecture-card');
    await expect(cards).toHaveCount(11);
    await expect(cards.first()).toContainText('\u041f\u0440\u0435\u0434\u0438\u0441\u043b\u043e\u0432\u0438\u0435');
    await expect(cards.nth(1)).toContainText('\u041b\u0435\u043a\u0446\u0438\u044f 1');
    await expect(cards.first()).toHaveClass(/preface/);
    await expect(cards.first()).toHaveCSS('grid-column-start', '1');
    await expect(cards.first()).toHaveCSS('grid-column-end', '-1');

    const brotherCard = page.locator('#lectures-grid .lecture-card', { hasText: 'brother' }).first();
    await expect(brotherCard).toBeVisible();
    await expect(brotherCard).toContainText('\u0430 \u043d\u0435 \u0434\u0435\u0442\u0438 \xab\u0441\u0430\u043d\u0441\u043a\u0440\u0438\u0442\u0430\xbb');
    await expect(brotherCard).not.toContainText('\u0443\u0447\u0451\u043d\u044b\u0435');

    await brotherCard.click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/lecture_pages\/\d+/);
    await expect(page.locator('.lecture-page-card')).toBeVisible();
    await expect(page.locator('#lecture-all')).toBeVisible();
    await expect(page.locator('.lecture-page-card .lecture-term-chip').first()).toHaveCSS('background-color', 'rgb(240, 232, 216)');

    await page.goto('/aaz-index.html#materials/lecture_pages/0');
    await expect(page.locator('.lecture-page-further')).toBeVisible();
    await expect(page.locator('#go-further-reading')).toBeVisible();
  });

  test('toponym epochs links navigate via hash item links', async ({ page }) => {
    await page.goto('/aaz-index.html#toponyms/epochs');
    const firstLink = page.locator('#epochs-grid .related-link[data-head]').first();
    await expect(firstLink).toBeVisible();
    await expect(firstLink).toHaveAttribute('href', /#(?:v4\/)?toponyms\/list\/item\/toponyms\//);
    await firstLink.click();
    await expect(page).toHaveURL(/#(?:v4\/)?toponyms\/list\/item\/toponyms\//);
    await expect(page.locator('#right-content .card h2')).toBeVisible();
  });

  test('gallery cards navigate via hash item links', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/gallery');
    const firstCard = page.locator('.gallery-card[data-head]').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toHaveAttribute('href', /#(?:v4\/)?names\/list\/item\/names\//);
    await firstCard.click();
    await expect(page).toHaveURL(/#(?:v4\/)?names\/list\/item\/names\//);
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
    await expect(page.locator('.page-trends-source-chip')).toContainText('Из жизни слов и языков');
    await expect(page.locator('#trend-export-csv')).toBeVisible();
    await expect(page.locator('#trend-export-md')).toBeVisible();
    const csvDownloadPromise = page.waitForEvent('download');
    await page.locator('#trend-export-csv').click();
    const csvDownload = await csvDownloadPromise;
    const csvPath = await csvDownload.path();
    const csvText = csvPath ? await fs.readFile(csvPath, 'utf8') : '';
    expect(csvText.split('\n')[0]).toContain('book_id');
    expect(csvText).toContain('mumintroll');
    const mdDownloadPromise = page.waitForEvent('download');
    await page.locator('#trend-export-md').click();
    const mdDownload = await mdDownloadPromise;
    const mdPath = await mdDownload.path();
    const mdText = mdPath ? await fs.readFile(mdPath, 'utf8') : '';
    expect(mdText).toContain('book_id: mumintroll');
  });

  test('scholar page trends keeps selected range in hash route', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/scholar/page_trends');
    const startInput = page.locator('#trend-start-input');
    const endInput = page.locator('#trend-end-input');
    const copyBtn = page.locator('#trend-copy-link');
    await expect(startInput).toBeVisible();
    await expect(endInput).toBeVisible();
    await expect(copyBtn).toBeVisible();

    await page.evaluate(() => {
      const start = document.getElementById('trend-start-input');
      const end = document.getElementById('trend-end-input');
      if (!start || !end) return;
      start.value = '120';
      end.value = '140';
      start.dispatchEvent(new Event('change', { bubbles: true }));
      end.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page).toHaveURL(/#v4\/scholar\/page_trends\/range\/120\/140$/);
    await page.evaluate(() => {
      window.__copiedShareUrl = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__copiedShareUrl = String(value || '');
          },
        },
      });
    });
    await copyBtn.click();
    await expect.poll(() => page.evaluate(() => window.__copiedShareUrl || '')).toContain('books=mumintroll');
    await page.goto('/aaz-index.html#v4/scholar/page_trends/range/120/140');
    await expect(page.locator('#trend-start-range')).toHaveValue('120');
    await expect(page.locator('#trend-end-range')).toHaveValue('140');
  });

  test('scholar chronology tab supports filters and event navigation', async ({ page }) => {
    await page.goto('/aaz-index.html#scholar/chronology');
    await expect(page.locator('#chronology-type')).toBeVisible();
    await expect(page.locator('#chronology-zoom')).toBeVisible();
    await expect(page.locator('#chronology-export-md')).toBeVisible();
    await page.selectOption('#chronology-type', 'publication');
    await page.selectOption('#chronology-zoom', 'xx');
    const chronologyDownloadPromise = page.waitForEvent('download');
    await page.locator('#chronology-export-md').click();
    const chronologyDownload = await chronologyDownloadPromise;
    const chronologyPath = await chronologyDownload.path();
    const chronologyMarkdown = chronologyPath ? await fs.readFile(chronologyPath, 'utf8') : '';
    expect(chronologyMarkdown).toContain('Источник: **Из жизни слов и языков**');
    expect(chronologyMarkdown).toContain('book_id: mumintroll');
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
    const accentDownloadPromise = page.waitForEvent('download');
    await page.locator('#accent-compare-export-md').click();
    const accentDownload = await accentDownloadPromise;
    const accentPath = await accentDownload.path();
    const accentMarkdown = accentPath ? await fs.readFile(accentPath, 'utf8') : '';
    expect(accentMarkdown).toContain('Источник: **Из жизни слов и языков**');
    expect(accentMarkdown).toContain('book_id: mumintroll');
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
    await expect(page).toHaveURL(/#(?:v4\/)?languages\/list\/item\/languages\//);
    await page.goto('/aaz-index.html#scholar/scholar');
    await page.locator('.corr-law-link').first().click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/phonetic_laws/);
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

  test('BibTeX export works for scholar bibliography, further reading and card source', async ({ page }) => {
    const readBib = async (download) => {
      const filePath = await download.path();
      expect(filePath).toBeTruthy();
      return fs.readFile(filePath, 'utf-8');
    };

    await page.goto('/aaz-index.html#scholar/scholar');
    const scholarBtn = page.locator('#export-scholar-biblio-bib');
    await expect(scholarBtn).toBeVisible();
    const scholarDownloadPromise = page.waitForEvent('download');
    await scholarBtn.click();
    const scholarDownload = await scholarDownloadPromise;
    expect(scholarDownload.suggestedFilename()).toBe('scholar-bibliography.bib');
    const scholarBib = await readBib(scholarDownload);
    expect(scholarBib).toContain('@misc{');
    expect(scholarBib).toContain('author = {');
    expect(scholarBib).toContain('title = {');
    expect(scholarBib).toContain('year = {');
    expect(scholarBib).toContain('book_id: mumintroll');
    expect(scholarBib).toContain('keywords = {bookindex,scholar,bibliography,corpus,mumintroll}');

    await page.goto('/aaz-index.html#materials/further_reading');
    const furtherBtn = page.locator('#export-further-bib');
    await expect(furtherBtn).toBeVisible();
    const furtherDownloadPromise = page.waitForEvent('download');
    await furtherBtn.click();
    const furtherDownload = await furtherDownloadPromise;
    expect(furtherDownload.suggestedFilename()).toBe('further-reading.bib');
    const furtherBib = await readBib(furtherDownload);
    expect(furtherBib).toContain('@misc{');
    expect(furtherBib).toContain('book_id: mumintroll');
    expect(furtherBib).toContain('keywords = {bookindex,further_reading,corpus,mumintroll}');

    await page.goto('/aaz-index.html#names/list');
    await expect(page.locator('#name-list .name-item').first()).toBeVisible();
    await page.locator('#name-list .name-item').first().click();
    const sourceBtn = page.locator('.source-export-bib').first();
    await expect(sourceBtn).toBeVisible();
    const sourceDownloadPromise = page.waitForEvent('download');
    await sourceBtn.click();
    const sourceDownload = await sourceDownloadPromise;
    expect(sourceDownload.suggestedFilename()).toContain('.bib');
    const sourceBib = await readBib(sourceDownload);
    expect(sourceBib).toContain('howpublished = {BookIndex card source}');
    expect(sourceBib).toContain('book_id: mumintroll');
    expect(sourceBib).toContain('corpus,mumintroll');
  });
  test('reading-now pager and quick trends navigation works', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/lectures');
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/lectures/);
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
    await expect(page).toHaveURL(/#(?:v4\/)?scholar\/page_trends/);
    await expect(page.locator('#trend-start-range')).toHaveValue('120');
    await expect(page.locator('#trend-end-range')).toHaveValue('120');
  });

  test('lexicon list supports most-frequent sorting toggle', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/lexicon/list');
    const sortBtn = page.locator('#sort-most-frequent-btn');
    await expect(sortBtn).toBeVisible();
    await sortBtn.click();
    await expect(sortBtn).toHaveClass(/active/);

    const visibleCounts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#name-list .name-item .pages-count'))
        .slice(0, 20)
        .map((el) => parseInt((el.textContent || '').trim(), 10))
        .filter((n) => Number.isFinite(n));
    });
    expect(visibleCounts.length).toBeGreaterThan(3);
    for (let i = 1; i < visibleCounts.length; i++) {
      expect(visibleCounts[i - 1]).toBeGreaterThanOrEqual(visibleCounts[i]);
    }
  });

  test('card page links open reading-now mode on that page', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/lexicon/list/item/lexicon/arbuz');
    await expect(page.locator('#right-content .card h2')).toContainText(/арбуз/i);
    const pageLink = page.locator('#right-content .card .card-page-link[data-page="187"]').first();
    await expect(pageLink).toBeVisible();
    await pageLink.click();
    await expect(page).toHaveURL(/#v4\/materials\/lectures\/reading\/187$/);
    await expect(page.locator('#reading-page-input')).toHaveValue('187');
    await expect(page.locator('#reading-now-results')).toContainText('Страница 187');
  });

  test('home panel no longer renders reading-now widget', async ({ page }) => {
    await page.goto('/aaz-index.html#home/home');
    await expect(page.locator('#reading-page-input')).toHaveCount(0);
    await expect(page.locator('#reading-now-results')).toHaveCount(0);
  });

  test('home panel shows usage guide and navigates via quick-start links', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    const guide = page.locator('#home-howto-details');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('Как пользоваться «Зализнякиадой»');
    const startLink = page.locator('#home-howto-link-udarenie');
    await expect(startLink).toBeVisible();
    await startLink.click();
    await expect(page).toHaveURL(/#(?:v4\/)?all\/list\/q\//);
    await expect(page.locator('#search-input')).toHaveValue('ударение');
  });

  test('home panel keeps routes above recents and supports inner scroll on compact desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    await page.goto('/aaz-index.html#v4/home/home');
    const panel = page.locator('.home-panel');
    await expect(panel).toBeVisible();

    const info = await page.evaluate(() => {
      const panelEl = document.querySelector('.home-panel');
      if (!panelEl) return null;
      const routesHost = panelEl.querySelector('#home-routes-details')
        || panelEl.querySelector('.home-route-card');
      const recentsHost = panelEl.querySelector('.home-recent-card');
      const before = panelEl.scrollTop;
      panelEl.scrollTop = panelEl.scrollHeight;
      const after = panelEl.scrollTop;
      return {
        hasRoutesHost: !!routesHost,
        hasRecentsHost: !!recentsHost,
        routeBeforeRecents: !!(routesHost && recentsHost && (routesHost.compareDocumentPosition(recentsHost) & Node.DOCUMENT_POSITION_FOLLOWING)),
        clientHeight: panelEl.clientHeight,
        scrollHeight: panelEl.scrollHeight,
        scrollTopBefore: before,
        scrollTopAfter: after,
      };
    });

    expect(info).toBeTruthy();
    expect(info.hasRoutesHost).toBeTruthy();
    expect(info.hasRecentsHost).toBeTruthy();
    expect(info.routeBeforeRecents).toBeTruthy();
    expect(info.scrollHeight).toBeGreaterThan(info.clientHeight);
    expect(info.scrollTopAfter).toBeGreaterThan(info.scrollTopBefore);
  });

  test('lexicon card links to glossary deep-link', async ({ page }) => {
    await page.goto('/aaz-index.html#lexicon/list/item/lexicon/%D0%B6%D0%B5');
    await expect(page.locator('#right-content .card h2')).toHaveText(/\u0436\u0435/i);
    const glossaryBacklink = page.locator('#right-content .glossary-backlink[data-term]').first();
    await expect(glossaryBacklink).toBeVisible();
    await glossaryBacklink.click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/glossary\/term\//);
    await expect(page.locator('#glossary-search')).toBeVisible();
  });

  test('materials KWIC lexicon query keeps only relevant snippets for sanskrit', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/kwic');
    await page.locator('#kwic-source').selectOption('lexicon');
    await page.locator('#kwic-page-start').fill('1');
    await page.locator('#kwic-page-end').fill('424');
    await page.locator('#kwic-query').fill('санскрит');
    await page.locator('#kwic-run').click();
    await expect(page.locator('#kwic-results .kwic-row').first()).toBeVisible();

    const mismatch = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#kwic-results .kwic-row'));
      const qNorm = typeof normalizeHeadForMatch === 'function'
        ? normalizeHeadForMatch('санскрит')
        : 'санскрит';
      for (const row of rows.slice(0, 80)) {
        const txt = String(row.textContent || '');
        const norm = typeof normalizeHeadForMatch === 'function'
          ? normalizeHeadForMatch(txt)
          : txt.toLowerCase();
        if (!norm.includes(qNorm)) return txt.slice(0, 220);
      }
      return '';
    });
    expect(mismatch).toBe('');
  });

  test('materials tasks panel stores progress and answer history after reload', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/tasks');
    await page.evaluate(() => {
      localStorage.removeItem('zaliznyakiada.tasksProgress.v1');
    });
    await page.reload();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/tasks/);

    const firstOption = page.locator('#tasks-container .task-options button').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    const summary = page.locator('#tasks-summary');
    await expect(summary).toContainText('\u041e\u0442\u0432\u0435\u0442\u043e\u0432:');
    await expect(summary).toContainText('1');
    const historyRows = page.locator('#tasks-history-list .task-history-row');
    await expect(historyRows.first()).toBeVisible();

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('zaliznyakiada.tasksProgress.v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored).toBeTruthy();
    expect(Number(stored.totalAnswered || 0)).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(stored.history)).toBeTruthy();
    expect(stored.history.length).toBeGreaterThanOrEqual(1);

    await page.reload();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/tasks/);
    await expect(page.locator('#tasks-summary')).toContainText('\u041e\u0442\u0432\u0435\u0442\u043e\u0432:');
    await expect(page.locator('#tasks-history-list .task-history-row').first()).toBeVisible();
  });

  test('materials tasks new pack collapses answer history to single-line summary', async ({ page }) => {
    await page.goto('/aaz-index.html#materials/tasks');
    await page.evaluate(() => {
      localStorage.removeItem('zaliznyakiada.tasksProgress.v1');
    });
    await page.reload();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/tasks/);

    const firstOption = page.locator('#tasks-container .task-options button').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();
    await expect(page.locator('#tasks-history-list .task-history-row').first()).toBeVisible();

    await page.locator('#tasks-regen').click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/tasks/);
    await expect(page.locator('#tasks-history-summary')).toBeVisible();
    await expect(page.locator('#tasks-history-list')).not.toBeVisible();

    const isExpanded = await page.evaluate(() => {
      const box = document.getElementById('tasks-history-box');
      return !!(box && box.hasAttribute('open'));
    });
    expect(isExpanded).toBeFalsy();
  });

  test('russian evolution page references are clickable and open reading mode', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/russian_evolution');
    const firstPageLink = page.locator('.russian-evolution-page-link').first();
    await expect(firstPageLink).toBeVisible();
    const href = await firstPageLink.getAttribute('href');
    expect(String(href || '')).toMatch(/#(?:v4\/)?materials\/lectures\/reading\/\d+/);

    await firstPageLink.click();
    await expect(page).toHaveURL(/#(?:v4\/)?materials\/lectures\/reading\/\d+/);
    await expect(page.locator('#reading-page-input')).toBeVisible();
  });

  test('phonetic laws keep transition chunks around arrow for t to th example', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/phonetic_laws');
    const targetComment = page.locator('tr', { hasText: '\u00ab\u0442\u0440\u0438\u00bb' }).locator('td').nth(2);
    await expect(targetComment).toBeVisible();
    const html = await targetComment.innerHTML();
    expect(html).toContain('phonetic-arrow');
    expect(html).toContain('\u043b\u0430\u0442\u0438\u043d\u0441\u043a\u043e\u0435&nbsp;t');
    expect(html).toContain('\u0433\u0435\u0440\u043c\u0430\u043d\u0441\u043a\u043e\u0435&nbsp;\u00fe&nbsp;(th)');
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

  test('canonical deep-link reload keeps card state and legacy hash stays compatible', async ({ page }) => {
    const encoded = '%D0%98%D1%82%D0%BA%D0%B8%D0%BD%20%D0%98.%20%D0%91.';
    await page.goto(`/aaz-index.html#v4/names/list/item/names/${encoded}`);
    await expect(page).toHaveURL(/#v4\/names\/list\/item\/names\//);
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0438\u0442\u043a\u0438\u043d/i);

    await page.reload();
    await expect(page).toHaveURL(/#v4\/names\/list\/item\/names\//);
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0438\u0442\u043a\u0438\u043d/i);

    await page.goto(`/aaz-index.html#names/list/item/names/${encoded}`);
    await expect(page.locator('#right-content .card h2')).toContainText(/\u0438\u0442\u043a\u0438\u043d/i);
  });

  test('viz alias hash opens scholar visualization tab and module list', async ({ page }) => {
    await page.goto('/aaz-index.html#viz');
    await expect(page).toHaveURL(/#v4\/scholar\/viz/);
    await expect(page.locator('.viz-shell')).toBeVisible();
    await expect(page.locator('.viz-module-btn')).toHaveCount(7);
  });

  test('corpus viz hash opens current-book visualization shell', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/corpus/viz/module/viz03?books=mumintroll');
    await expect(page).toHaveURL(/#v4\/scholar\/viz\/module\/viz03\?books=mumintroll/);
    await expect(page.locator('.viz-shell')).toBeVisible();
    await expect(page.locator('.viz-source-chip')).toContainText('Из жизни слов и языков');
    await expect(page.locator('.viz-corpus-link')).toHaveAttribute('href', /#v4\/corpus\/viz\/module\/viz03\?books=mumintroll/);
  });

  test('viz modules switch and render timeline + heatmap', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/scholar/viz/module/viz03');
    await expect(page.locator('.tl-wrap')).toBeVisible();

    await page.locator('.viz-module-btn[data-module="viz04"]').click();
    await expect(page).toHaveURL(/module\/viz04/);
    await expect(page.locator('#viz-heatmap-svg')).toBeVisible();
  });

  test('viz map restores century and toggles autoplay query params', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/scholar/viz/module/viz01?century=12&autoplay=1');
    await expect(page.locator('#viz-century-range')).toHaveValue('12');
    await expect(page.locator('#viz-century-play')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/module\/viz01\?century=12&autoplay=1/);

    await page.locator('#viz-century-play').click();
    await expect(page.locator('#viz-century-play')).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/module\/viz01\?century=12(?!.*autoplay=1)/);

    await page.locator('#viz-century-range').evaluate((el) => {
      el.value = '13';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#viz-century-label')).toHaveText('13');
    await expect(page).toHaveURL(/module\/viz01\?century=13/);
  });

  test('viz discovery timeline restores and writes filter query param', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/scholar/viz/module/viz03?filter=discovery');
    await expect(page.locator('.tl-wrap.tl-grid')).toBeVisible();
    await expect(page.locator('input[data-type="discovery"]')).toBeChecked();
    await expect(page.locator('input[data-type="linguist"]')).not.toBeChecked();
    await expect(page.locator('input[data-type="historical"]')).not.toBeChecked();

    await page.locator('input[data-type="linguist"]').check();
    await expect(page).toHaveURL(/module\/viz03\?filter=discovery%2Clinguist/);
  });

  test('viz cooccurrence graph restores and writes lecture query param', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/scholar/viz/module/viz02?lecture=missing');
    const lectureSelect = page.locator('#viz-cograph-lecture');
    await expect(lectureSelect).toHaveValue('all');

    const lectureValue = await lectureSelect.evaluate((select) => {
      const options = Array.from(select.options);
      return options.find((option) => option.value && option.value !== 'all')?.value || 'all';
    });
    test.skip(lectureValue === 'all', 'No lecture-specific cooccurrence options in fixture data');

    await lectureSelect.selectOption(lectureValue);
    await expect(page).toHaveURL(new RegExp(`module/viz02\\?lecture=${lectureValue}`));
  });

  test('viz bump chart restores and writes top/filter query params', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/scholar/viz/module/viz07?top=12');
    await expect(page.locator('#viz-bump-top')).toHaveValue('12');
    await expect(page.locator('#viz-bump-top-label')).toHaveText('12');

    await page.locator('#viz-bump-top').evaluate((el) => {
      el.value = '18';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#viz-bump-top-label')).toHaveText('18');
    await expect(page).toHaveURL(/module\/viz07\?top=18/);

    await page.locator('#viz-bump-search').fill('глагол');
    await expect(page).toHaveURL(/module\/viz07\?top=18&filter=/);
  });
});
