const { test, expect } = require('@playwright/test');

/**
 * C3 / H1607: priority paths must render untrusted text via textContent/DOM APIs,
 * not data-bearing innerHTML. Markup in heads/snippets/contexts must stay text.
 */

test.describe('DOM render harden (C3 / H1607)', () => {
  test('global search marks query hits without interpreting HTML in heads', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/home/home');
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

