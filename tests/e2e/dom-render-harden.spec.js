const { test, expect } = require('@playwright/test');

/**
 * C3 / H1607: priority paths must render untrusted text via textContent/DOM APIs,
 * not data-bearing innerHTML. Markup in heads/snippets/contexts must stay text.
 * C3 viz wave (A06): VIZ legends, tabs, detail panels and timeline cards must
 * mount knowledge-base data via DOM APIs too (search/list/KWIC/card rows are
 * covered above; VIZ modules are lazy-loaded scripts under scripts/viz/).
 */

test.describe('DOM render harden (C3 / H1607)', () => {
  test('global search marks query hits without interpreting HTML in heads', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
    // Wait for wireGlobalUI(): filling the input before the app booted leaves
    // oninput unwired and no results ever open (H1824 — full-suite flake).
    await expect(page.locator('#entity-switcher .entity-btn').first()).toBeVisible();
    const input = page.locator('#global-search');
    await input.fill('санскрит');
    const first = page.locator('#global-search-results.open .header-search-item').first();
    await expect(first).toBeVisible();

    const safety = await first.evaluate((row) => {
      const head = row.querySelector('span:not(.kind)');
      const marks = Array.from(row.querySelectorAll('mark')).map((m) => m.textContent || '');
      return {
        hasScriptTag: !!row.querySelector('script'),
        markCount: marks.length,
        markHasAngle: marks.some((t) => t.includes('<') || t.includes('>')),
        headText: (head && head.textContent) || '',
        usedInnerHtmlForHead: head ? /innerHTML|highlightSearchMatch/.test(String(head.outerHTML)) && head.childNodes.length === 0 : true,
      };
    });
    expect(safety.hasScriptTag).toBe(false);
    expect(safety.markCount).toBeGreaterThan(0);
    expect(safety.headText.toLowerCase()).toContain('санскрит');
  });

  test('entity list heads use accent-safe text nodes, not raw HTML injection', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/names/list');
    await expect(page.locator('#name-list .name-item .head').first()).toBeVisible();
    const probe = await page.evaluate(() => {
      const heads = Array.from(document.querySelectorAll('#name-list .name-item .head')).slice(0, 40);
      let scriptChildren = 0;
      let textOnlyOk = 0;
      for (const head of heads) {
        if (head.querySelector('script')) scriptChildren += 1;
        const bad = Array.from(head.querySelectorAll('*')).some((el) => {
          const tag = (el.tagName || '').toLowerCase();
          return tag === 'script' || tag === 'img' || tag === 'iframe';
        });
        if (!bad) textOnlyOk += 1;
      }
      return { count: heads.length, scriptChildren, textOnlyOk };
    });
    expect(probe.count).toBeGreaterThan(5);
    expect(probe.scriptChildren).toBe(0);
    expect(probe.textOnlyOk).toBe(probe.count);
  });

  test('KWIC rows keep context as textContent and empty state has no markup injection surface', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/materials/kwic');
    await page.locator('#kwic-source').selectOption('lexicon');
    await page.locator('#kwic-query').fill('санскрит');
    await page.locator('#kwic-run').click();
    const firstRow = page.locator('#kwic-results .kwic-row').first();
    await expect(firstRow).toBeVisible();

    const rowSafety = await firstRow.evaluate((row) => {
      const ctx = row.querySelector('.kwic-context');
      return {
        hasScript: !!row.querySelector('script'),
        hasMark: !!row.querySelector('mark'),
        contextHtmlHasRawTags: ctx ? /<(?:script|img|iframe)\b/i.test(ctx.innerHTML) : true,
        markText: (row.querySelector('mark') && row.querySelector('mark').textContent) || '',
      };
    });
    expect(rowSafety.hasScript).toBe(false);
    expect(rowSafety.hasMark).toBe(true);
    expect(rowSafety.contextHtmlHasRawTags).toBe(false);
    expect(rowSafety.markText.toLowerCase()).toContain('санскрит');

    await page.locator('#kwic-query').fill('x');
    await page.locator('#kwic-run').click();
    const empty = page.locator('#kwic-results .kwic-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/символ|энклитика/i);
    // Empty state is a leaf .kwic-empty node filled via textContent (no nested HTML from the query).
    expect(await empty.evaluate((el) => el.childElementCount)).toBe(0);
  });

  test('card contexts mount via DOM and treat angle brackets as text', async ({ page }) => {
    // Known lexicon head with book contexts (from smoke suite seeds).
    await page.goto('/aaz-index.html#v4/lexicon/list/item/lexicon/%D0%B0');
    await expect(page.locator('#right-content .card')).toBeVisible({ timeout: 15000 });

    const contextsMount = page.locator('#right-content [data-card-contexts-mount]');
    if (await contextsMount.count()) {
      await expect(contextsMount.locator('h3')).toContainText('Контексты');
      const ctxText = contextsMount.locator('.context-text').first();
      await expect(ctxText).toBeVisible();
      const safety = await ctxText.evaluate((el) => ({
        hasScript: !!el.querySelector('script'),
        hasIframe: !!el.querySelector('iframe'),
        textLen: (el.textContent || '').length,
      }));
      expect(safety.hasScript).toBe(false);
      expect(safety.hasIframe).toBe(false);
      expect(safety.textLen).toBeGreaterThan(0);
    }

    const helperOk = await page.evaluate(() => {
      if (typeof window.appendHighlightedSearchText !== 'function') return { ok: false, reason: 'missing helper' };
      const host = document.createElement('div');
      window.appendHighlightedSearchText(host, '<img src=x onerror=alert(1)>sanskrit', 'sanskrit');
      return {
        ok: true,
        hasImg: !!host.querySelector('img'),
        hasScript: !!host.querySelector('script'),
        text: host.textContent || '',
        markText: (host.querySelector('mark') && host.querySelector('mark').textContent) || '',
      };
    });
    expect(helperOk.ok).toBe(true);
    expect(helperOk.hasImg).toBe(false);
    expect(helperOk.hasScript).toBe(false);
    expect(helperOk.text).toContain('<img');
    expect(helperOk.markText).toBe('sanskrit');
  });
});

test.describe('VIZ data mounts (C3 viz wave / A06)', () => {
  async function openVizModule(page, moduleId) {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
    await page.goto(`/aaz-index.html#v4/scholar/viz/module/${moduleId}`);
    await expect(page.locator('.viz-shell')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.viz-module-header .viz-module-title')).toBeVisible({ timeout: 30000 });
    return pageErrors;
  }

  test('viz02 cooccurrence lecture select is option elements, no injected markup', async ({ page }) => {
    await openVizModule(page, 'viz02');
    const select = page.locator('#viz-cograph-lecture');
    await expect(select).toBeVisible({ timeout: 30000 });
    const probe = await select.evaluate((el) => ({
      optionCount: el.querySelectorAll('option').length,
      firstText: el.querySelector('option') && el.querySelector('option').textContent,
      badTags: Array.from(el.querySelectorAll('script,img,iframe')).length,
      emptyTexts: Array.from(el.querySelectorAll('option')).filter((o) => !(o.textContent || '').trim()).length,
    }));
    expect(probe.optionCount).toBeGreaterThan(1);
    expect(probe.firstText).toBe('Все лекции');
    expect(probe.badTags).toBe(0);
    expect(probe.emptyTexts).toBe(0);
  });

  test('viz03 discovery timeline cards mount label/sub as text nodes', async ({ page }) => {
    await openVizModule(page, 'viz03');
    const labels = page.locator('.tl-item .tl-label');
    await expect(labels.first()).toBeVisible({ timeout: 30000 });
    const probe = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.tl-item')).slice(0, 40);
      let badInCards = 0;
      let labelsWithChildren = 0;
      let subsWithChildren = 0;
      for (const card of cards) {
        if (card.querySelector('script,iframe')) badInCards += 1;
        const label = card.querySelector('.tl-label');
        if (label && label.childElementCount > 0) labelsWithChildren += 1;
        const sub = card.querySelector('.tl-sub');
        if (sub && sub.childElementCount > 0) subsWithChildren += 1;
      }
      return { cards: cards.length, badInCards, labelsWithChildren, subsWithChildren };
    });
    expect(probe.cards).toBeGreaterThan(0);
    expect(probe.badInCards).toBe(0);
    expect(probe.labelsWithChildren).toBe(0);
    expect(probe.subsWithChildren).toBe(0);
  });

  test('viz05 sankey tabs are text buttons and detail panel never injects markup', async ({ page }) => {
    const pageErrors = await openVizModule(page, 'viz05');
    const tabs = page.locator('#viz-sankey-tabs .viz-module-btn');
    await expect(tabs.first()).toBeVisible({ timeout: 30000 });
    const probe = await page.evaluate(() => {
      const tabHost = document.querySelector('#viz-sankey-tabs');
      const detail = document.querySelector('#viz-sankey-detail');
      const badTabs = tabHost ? tabHost.querySelectorAll('script,img,iframe').length : -1;
      const tabButtons = tabHost ? Array.from(tabHost.querySelectorAll('button[data-id]')) : [];
      const badDetail = detail ? detail.querySelectorAll('script,img,iframe').length : 0;
      return {
        badTabs,
        tabCount: tabButtons.length,
        emptyTabs: tabButtons.filter((b) => !(b.textContent || '').trim()).length,
        badDetail,
      };
    });
    expect(pageErrors).toEqual([]);
    expect(probe.badTabs).toBe(0);
    expect(probe.tabCount).toBeGreaterThan(0);
    expect(probe.emptyTabs).toBe(0);
    expect(probe.badDetail).toBe(0);
  });

  test('viz06 lang-chord legend items are DOM-mounted and still toggle', async ({ page }) => {
    await openVizModule(page, 'viz06');
    const items = page.locator('#viz-chord-legend .viz-legend-item.toggleable');
    await expect(items.first()).toBeVisible({ timeout: 30000 });
    const before = await page.evaluate(() => {
      const legend = document.querySelector('#viz-chord-legend');
      const items = Array.from(legend.querySelectorAll('.viz-legend-item.toggleable'));
      return {
        count: items.length,
        badTags: legend.querySelectorAll('script,img,iframe').length,
        noLangAttr: items.filter((el) => !(el.dataset.lang || '').length).length,
        firstInactive: items[0].classList.contains('inactive'),
        firstLang: items[0].dataset.lang || '',
      };
    });
    expect(before.count).toBeGreaterThan(0);
    expect(before.badTags).toBe(0);
    expect(before.noLangAttr).toBe(0);
    expect(before.firstLang.length).toBeGreaterThan(0);

    // Toggle behaviour survives the DOM rewrite: clicking the first item
    // flips its inactive state (hidden-set toggle → redraw → renderLegend).
    await items.first().click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#viz-chord-legend .viz-legend-item.toggleable'));
      return items.length ? items[0].classList.contains('inactive') : null;
    });
    expect(after).toBe(!before.firstInactive);
  });
});

test.describe('world-map tooltip escape (H5623)', () => {
  // world-map.js registers VIZ_MODULES.renderWorldMap but is not in the viz
  // catalog tabs, so the harness loads viz-shell.js (escapeHtml source) and
  // the module directly, then mounts into a fixed host above the app chrome.
  async function mountWorldMap(page) {
    await page.addScriptTag({ url: '/scripts/viz/viz-shell.js' });
    await page.addScriptTag({ url: '/scripts/viz/world-map.js' });
    return page.evaluate(() => {
      const host = document.createElement('div');
      host.className = 'viz-host';
      host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:600px;background:#fff;z-index:99999;';
      document.body.appendChild(host);
      window.VIZ_MODULES.renderWorldMap(host);
      return !!host.querySelector('.viz-world-map-leaflet');
    });
  }

  async function hoverFirstMarker(page) {
    const marker = page.locator('.viz-world-map-leaflet path.leaflet-interactive').first();
    await expect(marker).toBeVisible({ timeout: 15000 });
    await marker.hover();
    await expect(page.locator('.leaflet-tooltip')).toBeVisible({ timeout: 10000 });
  }

  async function tooltipProbe(page) {
    return page.evaluate(() => {
      const tip = document.querySelector('.leaflet-tooltip');
      if (!tip) return null;
      return {
        text: tip.textContent || '',
        html: tip.innerHTML || '',
        badTags: tip.querySelectorAll('script,img,iframe').length,
        strongText: tip.querySelector('strong') ? tip.querySelector('strong').textContent : '',
        smallText: tip.querySelector('small') ? tip.querySelector('small').textContent : '',
      };
    });
  }

  test('poisoned tooltip head renders as text, img/onerror never mount', async ({ page }) => {
    await page.goto('/aaz-index.html');
    await page.waitForFunction(() => window.APP_DATA && Array.isArray(window.APP_DATA.toponyms) && window.APP_DATA.toponyms.length > 0);
    await page.evaluate(() => {
      window.APP_DATA = {
        toponyms: [{ head: '<img src=x onerror=window.__worldMapPwned=1>', lat: '50.45', lng: '30.52', description: '' }],
        languages: [],
        names: [],
        ethnonyms: [],
      };
    });
    expect(await mountWorldMap(page)).toBe(true);
    await hoverFirstMarker(page);
    const probe = await tooltipProbe(page);
    expect(probe).not.toBeNull();
    expect(probe.badTags).toBe(0);
    expect(probe.strongText).toBe('<img src=x onerror=window.__worldMapPwned=1>');
    expect(probe.text).toContain('<img');
    expect(probe.html).not.toMatch(/<img\b/i);
    expect(await page.evaluate(() => window.__worldMapPwned)).toBeUndefined();
  });

  test('real app_data entity tooltip renders unchanged (text equals data head)', async ({ page }) => {
    await page.goto('/aaz-index.html');
    await page.waitForFunction(() => window.APP_DATA && Array.isArray(window.APP_DATA.toponyms) && window.APP_DATA.toponyms.length > 0);
    expect(await mountWorldMap(page)).toBe(true);
    const marker = page.locator('.viz-world-map-leaflet path.leaflet-interactive').first();
    await expect(marker).toBeVisible({ timeout: 15000 });
    // Real data clusters entities tightly, so the first marker is often
    // covered by a sibling circle; drive the mouse directly (no hover()
    // actionability checks) and verify whichever real entity the tooltip names.
    const box = await marker.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    await expect(page.locator('.leaflet-tooltip')).toBeVisible({ timeout: 10000 });
    const probe = await tooltipProbe(page);
    expect(probe).not.toBeNull();
    expect(probe.badTags).toBe(0);
    expect(probe.strongText.length).toBeGreaterThan(0);
    const matched = await page.evaluate(({ type, head }) => {
      const types = ['toponyms', 'languages', 'names', 'ethnonyms'];
      return types.includes(type) &&
        (window.APP_DATA[type] || []).some((x) => x && x.head === head && x.lat && (x.lng || x.lon));
    }, { type: probe.smallText, head: probe.strongText });
    expect(matched).toBe(true);
    expect(probe.html).not.toMatch(/<img\b/i);
  });
});

