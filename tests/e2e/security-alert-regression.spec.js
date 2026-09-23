const { test, expect } = require('@playwright/test');

/**
 * Security-alert regression — boot-catch XSS sink (H4790).
 *
 * Representative CodeQL path classified in docs/SECURITY_ALERT_TRIAGE_2026-09-15.md:
 * - CodeQL js/xss-through-dom #25 / js/xss-through-exception #27
 *   (src/runtime/entry.js, boot catch panel)
 * - js/incomplete-url-scheme-check #29/#30 (src/runtime/core/utils.js safeUrl/safeImageUrl)
 *
 * The boot-catch panel renders the exception message via textContent (DOM assembly).
 * An attacker-influenced error — a data-module fetch that returns a malformed body whose
 * JSON.parse error previews attacker bytes, or a tampered embedded manifest — must render
 * as inert text.
 *
 * NON-VACUOUSNESS CONTRACT (why these tests can fail on a revert):
 * every boot-failure test below installs its fault BEFORE `page.goto()`, so the panel is
 * built by the PRODUCTION catch in `src/runtime/entry.js` — the spec never re-implements
 * the panel. The load-bearing assertion is the element count: a panel assembled with
 * `innerHTML` parses `<img src=x …>` into a real node and fails `injectedElements === 0`.
 * (`window.__pwned` is a secondary canary only — CSP has no `unsafe-inline`, so an inline
 * `onerror` handler may not fire even in the vulnerable build; the injected ELEMENT is the
 * defect signal.) Verified by an independent GLM-family review pass, 2026-09-15.
 */

const APP_PAGE = '/aaz-index.html';

// Malformed JSON whose V8 parse error PREVIEWS the attacker bytes:
// Unexpected token '<', ..."names": [ <img src=x"... is not valid JSON
const MALFORMED_WITH_PAYLOAD = '{"names": [ <img src=x onerror=window.__pwned=1>, ] }';

test.describe('security-alert regression (H4790)', () => {
  test('normal boot still hydrates APP_DATA through the module manifest', async ({ page }) => {
    await page.goto(`${APP_PAGE}#v4/home/home`);
    // APP_DATA is hydrated asynchronously from the module manifest after the load
    // event, so a one-shot page.evaluate() races the fetches - poll instead.
    await expect.poll(() => page.evaluate(() => Array.isArray(window.APP_DATA?.names) && window.APP_DATA.names.length > 0))
      .toBe(true);
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

  test('production boot catch renders a malformed module body inert (fetch/JSON.parse path)', async ({ page }) => {
    // Fault installed BEFORE goto: the runtime's own loadAppData() → fetchAppDataModule()
    // → response.json() throws with the payload in the message, and the PRODUCTION catch
    // (entry.js:135) builds the panel. Nothing here re-implements that panel.
    await page.route('**/data/modules/*.json*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MALFORMED_WITH_PAYLOAD,
    }));
    await page.goto(`${APP_PAGE}#v4/home/home`);
    const panel = page.locator('#content .panel-empty-state');
    await expect(panel).toBeVisible({ timeout: 15000 });
    const safety = await panel.evaluate((node) => ({
      text: node.textContent || '',
      injectedElements: node.querySelectorAll('script, img, iframe').length,
    }));
    expect(safety.text).toContain('Не удалось загрузить данные справочника.');
    // The attacker bytes reached the panel as message text…
    expect(safety.text).toContain('<img src=x');
    // …and materialised as NOTHING. An innerHTML-assembled panel fails here.
    expect(safety.injectedElements).toBe(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });

  test('production boot catch renders a tampered embedded manifest inert (JSON.parse preview path)', async ({ page }) => {
    // Rewrite the embedded `#app-data-json` manifest in the served artifact, so the
    // runtime's own boot fails and the production catch builds the panel.
    let rewrote = false;
    await page.route('**/aaz-index.html*', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const tampered = body.replace(
        /(<script[^>]*id="app-data-json"[^>]*>)[\s\S]*?(<\/script>)/,
        `$1${MALFORMED_WITH_PAYLOAD}$2`,
      );
      rewrote = tampered !== body;
      await route.fulfill({ response, body: tampered });
    });
    await page.goto(`${APP_PAGE}#v4/home/home`);
    const panel = page.locator('#content .panel-empty-state');
    await expect(panel).toBeVisible({ timeout: 15000 });
    expect(rewrote).toBe(true); // fixture actually tampered — otherwise the test is vacuous
    const safety = await panel.evaluate((node) => ({
      text: node.textContent || '',
      injectedElements: node.querySelectorAll('script, img, iframe').length,
    }));
    expect(safety.text).toContain('Не удалось загрузить данные справочника.');
    expect(safety.text).toContain('<img src=x');
    expect(safety.injectedElements).toBe(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});