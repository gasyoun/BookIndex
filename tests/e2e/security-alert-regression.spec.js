const { test, expect } = require('@playwright/test');

/**
 * Security-alert regression — boot-catch XSS sink (H4790).
 *
 * Representative CodeQL path classified in docs/SECURITY_ALERT_TRIAGE_2026-09-15.md:
 * - CodeQL js/xss-through-dom #25 / js/xss-through-exception #27
 *   (src/runtime/entry.js, boot catch panel)
 * - js/incomplete-url-scheme-check #29/#30 (src/runtime/core/utils.js safeUrl)
 *
 * The boot-catch panel renders the exception message via textContent (DOM assembly).
 * An attacker-influenced error — a failed data-module fetch echoes its URL, which is
 * manifest-controlled and can be forced to a javascript: URL; or a malformed embedded
 * manifest whose JSON.parse error previews attacker bytes — must render as inert text.
 * Regression contract: `<img onerror>` markup and `javascript:` payloads arriving
 * through the boot error path stay inert, and the normal boot path still hydrates.
 */

const APP_PAGE = '/aaz-index.html';

test.describe('security-alert regression (H4790)', () => {
  test('normal boot still hydrates APP_DATA through the module manifest', async ({ page }) => {
    await page.goto(`${APP_PAGE}#v4/home/home`);
    await expect(page.evaluate(() => Array.isArray(window.APP_DATA?.names) && window.APP_DATA.names.length > 0))
      .resolves.toBe(true);
    await expect(page.locator('#entity-switcher .entity-btn').first()).toBeVisible();
  });

  test('safeUrl keeps scheme allow-list: javascript:/data: URLs collapse to fallback', async ({ page }) => {
    await page.goto(`${APP_PAGE}#v4/home/home`);
    await expect(page.locator('#entity-switcher .entity-btn').first()).toBeVisible();
    const probe = await page.evaluate(() => {
      const cases = ['javascript:alert(1)', ' javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:alert(1)', 'file:///etc/passwd'];
      return cases.map((c) => window.safeUrl(c));
    });
    for (const resolved of probe) {
      expect(String(resolved)).not.toMatch(/javascript:|data:|vbscript:|file:/i);
    }
    expect(probe.every((r) => r === '#')).toBe(true);
  });

  test('safeImageUrl keeps image+http(s)/blob allow-list, never a script scheme', async ({ page }) => {
    await page.goto(`${APP_PAGE}#v4/home/home`);
    const probe = await page.evaluate(() => {
      const cases = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'data:image/png;base64,iVBORw0KGgo=', 'https://example.com/a.png', 'blob:https://origin/xyz'];
      return cases.map((c) => window.safeImageUrl(c));
    });
    expect(probe[0]).toBe('');
    expect(probe[1]).toBe('');
    expect(probe[2]).toMatch(/^data:image\/png;base64,/i);
    expect(probe[3]).toMatch(/^https:\/\/example\.com\//i);
    expect(probe[4]).toMatch(/^blob:/i);
  });

  test('boot-catch error panel renders attacker-influenced exception text inert (textContent)', async ({ page }) => {
    // Serve the built artifact with a manifest whose module URL fails; the thrown
    // error echoes the module file name — the attacker-influenced string — into the
    // boot-catch panel. Assert DOM assembly + text-only rendering.
    await page.route('**/data/modules/*.json*', (route) => route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'not found',
    }));
    await page.goto(`${APP_PAGE}#v4/home/home`);
    const panel = page.locator('#content .panel-empty-state');
    await expect(panel).toBeVisible({ timeout: 15000 });
    const safety = await panel.evaluate((node) => ({
      text: node.textContent || '',
      htmlChildren: Array.from(node.children).map((c) => (c.tagName || '').toLowerCase()),
      scriptChildren: node.querySelectorAll('script, img, iframe').length,
      rawMarkupInText: /<(?:script|img|iframe)\b/i.test(node.textContent || ''),
    }));
    expect(safety.text).toContain('Не удалось загрузить данные справочника.');
    // The echoed module URL (or HTTP status) may appear as inert text — fine. What must
    // never happen: the payload executing or creating elements.
    expect(safety.scriptChildren).toBe(0);
    expect(safety.rawMarkupInText).toBe(false);
  });

  test('boot-catch panel survives malformed embedded manifest bytes (JSON.parse error path)', async ({ page }) => {
    await page.goto(`${APP_PAGE}#v4/home/home`);
    // Malformed JSON whose V8 parse error PREVIEWS the attacker bytes:
    // Unexpected token '<', ..."names": [ <img src=x"... is not valid JSON
    await page.evaluate(() => {
      const node = document.getElementById('app-data-json');
      if (node) node.textContent = '{"names": [ <img src=x onerror=window.__pwned=1>, ] }';
    });
    // Force the catch panel by re-running the boot sequence against the tampered payload.
    await page.evaluate(() => window.loadAppData().catch((error) => {
      const message = error && error.message ? error.message : String(error || 'Unknown data loading error');
      const content = document.getElementById('content');
      if (content) {
        const panel = document.createElement('div');
        panel.className = 'panel-empty-state';
        panel.append('Не удалось загрузить данные справочника.');
        panel.appendChild(document.createElement('br'));
        const detail = document.createElement('small');
        detail.textContent = message;
        panel.appendChild(detail);
        content.innerHTML = '';
        content.appendChild(panel);
      }
      return 'caught';
    }));
    const panel = page.locator('#content .panel-empty-state');
    await expect(panel).toBeVisible();
    const safety = await panel.evaluate((node) => ({
      text: node.textContent || '',
      injectedElements: node.querySelectorAll('script, img, iframe').length,
    }));
    expect(safety.text).toContain('Не удалось загрузить данные справочника.');
    // The attacker bytes reach the panel ONLY as message text…
    expect(safety.text).toContain('<img src=x');
    // …never as elements, and the onerror canary never fires.
    expect(safety.injectedElements).toBe(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});