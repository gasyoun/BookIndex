// Repeatable verification layer for the PR #213 / interface-review critical
// states (findings 2, 3, 5, 8): aria labels, :focus-visible ring, live
// #vg-meta, empty-filter reset, honest copy. Screenshots are review artifacts
// (gitignored under test-results/), not pixel baselines — same contract as
// redesign-baseline.spec.js. Keyboard Tab is required for :focus-visible;
// locator.focus() alone is not proof.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AxeBuilder = require('@axe-core/playwright').default;

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'ui-review-states');
const GALLERY = '/aaz-index.html#v4/materials/video';
const DETAIL = '/aaz-index.html#v4/materials/video/tv87ggs0yq4';
const OVERFLOW_TOLERANCE_PX = 8;

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

test.beforeAll(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
});

async function openGallery(page) {
  await page.goto(GALLERY);
  await expect(page.locator('#vg-list')).toBeVisible();
  await expect(page.locator('#vg-list .vg-card').first()).toBeVisible();
}

async function readOverflow(page) {
  return page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
  });
}

async function readActiveFocusRing(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { focused: false };
    const cs = getComputedStyle(el);
    return {
      focused: true,
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      outlineStyle: cs.outlineStyle,
      outlineWidth: parseFloat(cs.outlineWidth) || 0,
      outlineOffset: cs.outlineOffset,
    };
  });
}

async function tabOnto(page, selector, maxTabs = 24) {
  for (let i = 0; i < maxTabs; i += 1) {
    const onTarget = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return !!(el && document.activeElement === el);
    }, selector);
    if (onTarget) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab did not reach ${selector} within ${maxTabs} steps`);
}

async function keyboardFocus(page, selector) {
  // Programmatic focus is not :focus-visible. Step off with Shift+Tab and
  // back with Tab so the ring comes from a keyboard origin.
  await page.locator(selector).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator(selector)).toBeFocused();
}

function expectVisibleRing(ring, label) {
  expect(ring.focused, `${label}: nothing focused`).toBe(true);
  expect(ring.outlineStyle, `${label}: outline-style`).toBe('solid');
  expect(ring.outlineWidth, `${label}: outline-width`).toBeGreaterThanOrEqual(2);
}

test.describe('UI review states — video gallery (H2577 / PR #213)', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('labels, live region, honest copy, default sort, undated meta', async ({ page }) => {
        await openGallery(page);

        await expect(page.locator('#vg-search')).toHaveAttribute('aria-label', /.+/);
        await expect(page.locator('#vg-chapter')).toHaveAttribute('aria-label', /.+/);
        await expect(page.locator('#vg-sort')).toHaveAttribute('aria-label', /.+/);
        await expect(page.locator('#vg-meta')).toHaveAttribute('role', 'status');
        await expect(page.locator('#vg-meta')).toHaveAttribute('aria-live', 'polite');

        const intro = page.locator('.video-gallery-intro');
        await expect(intro).toContainText('дата известна не для всех');
        await expect(intro).not.toContainText('таймкоды на минуту');
        await expect(intro).not.toContainText('на карточках сущностей');

        await expect(page.locator('#vg-sort')).toHaveValue('title');
        await expect(page.locator('.vg-card-meta', { hasText: 'дата неизвестна' }).first()).toBeVisible();

        const cardCount = await page.locator('#vg-list .vg-card').count();
        await expect(page.locator('#vg-meta')).toHaveText(new RegExp(`Показано ${cardCount} из \\d+ видео`));

        await page.locator('.video-gallery-controls').screenshot({
          path: path.join(SHOT_DIR, `controls--${viewport.name}.png`),
        });
        await page.locator('.video-gallery-inner').screenshot({
          path: path.join(SHOT_DIR, `gallery-top--${viewport.name}.png`),
        });
      });

      test('live #vg-meta updates when the list shrinks', async ({ page }) => {
        await openGallery(page);
        const before = (await page.locator('#vg-meta').innerText()).trim();
        await page.locator('#vg-search').fill('араб');
        await expect.poll(async () => (await page.locator('#vg-meta').innerText()).trim())
          .not.toBe(before);
        await expect(page.locator('#vg-meta')).toHaveText(/Показано \d+ из \d+ видео/);
        const shown = await page.locator('#vg-list .vg-card').count();
        expect(shown).toBeGreaterThan(0);
        expect(shown).toBeLessThan(100);
      });

      test('empty-filter state, reset, and search refocus', async ({ page }) => {
        await openGallery(page);
        const all = await page.locator('#vg-list .vg-card').count();
        await page.locator('#vg-search').fill('zzzznonexistentquery');
        await expect(page.locator('.vg-empty')).toBeVisible();
        await expect(page.locator('.vg-empty')).toContainText('Ничего не найдено');
        await expect(page.locator('#vg-list .vg-card')).toHaveCount(0);
        await expect(page.locator('#vg-meta')).toHaveText(/Показано 0 из \d+ видео/);

        await page.locator('.vg-empty').screenshot({
          path: path.join(SHOT_DIR, `empty-filter--${viewport.name}.png`),
        });

        await page.locator('.vg-empty-reset').click();
        await expect.poll(async () => page.locator('#vg-list .vg-card').count()).toBe(all);
        await expect(page.locator('#vg-search')).toBeFocused();
        await expect(page.locator('#vg-search')).toHaveValue('');
        await expect(page.locator('#vg-sort')).toHaveValue('title');
      });

      test('no horizontal overflow', async ({ page }) => {
        await openGallery(page);
        const overflow = await readOverflow(page);
        expect(
          overflow.scrollWidth,
          `${viewport.name} gallery overflows (${overflow.scrollWidth} > ${overflow.clientWidth})`,
        ).toBeLessThanOrEqual(overflow.clientWidth + OVERFLOW_TOLERANCE_PX);
      });
    });
  }

  test('keyboard Tab shows a :focus-visible ring on gallery controls and first title', async ({ page }) => {
    await openGallery(page);

    const targets = ['#vg-search', '#vg-chapter', '#vg-sort', '#vg-thumbs-toggle', '#vg-list .vg-card-title'];
    await keyboardFocus(page, '#vg-search');

    for (const selector of targets) {
      await tabOnto(page, selector);
      const ring = await readActiveFocusRing(page);
      expectVisibleRing(ring, selector);
      const shotName = selector.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await page.locator(selector).first().screenshot({
        path: path.join(SHOT_DIR, `focus-${shotName}--desktop.png`),
      });
    }
  });

  test('keyboard Tab shows a :focus-visible ring on detail back and YouTube link', async ({ page }) => {
    await page.goto(DETAIL);
    await expect(page.locator('.video-detail')).toBeVisible();
    await expect(page.locator('.video-detail-back')).toBeVisible();
    await expect(page.locator('.video-detail-yt')).toBeVisible();

    await keyboardFocus(page, '.video-detail-back');
    expectVisibleRing(await readActiveFocusRing(page), '.video-detail-back');
    await page.locator('.video-detail-back').screenshot({
      path: path.join(SHOT_DIR, 'focus-video-detail-back--desktop.png'),
    });

    await keyboardFocus(page, '.video-detail-yt');
    expectVisibleRing(await readActiveFocusRing(page), '.video-detail-yt');
    await page.locator('.video-detail-yt').screenshot({
      path: path.join(SHOT_DIR, 'focus-video-detail-yt--desktop.png'),
    });
  });

  test('axe label/name rules on the gallery panel', async ({ page }) => {
    await openGallery(page);
    const results = await new AxeBuilder({ page })
      .include('.video-gallery')
      .withRules(['label', 'select-name', 'button-name', 'link-name', 'aria-allowed-attr', 'aria-valid-attr'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('gallery has no async loading/error chrome (catalog is inlined)', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.vg-loading, .vg-error, [data-vg-status]')).toHaveCount(0);
    await expect(page.locator('#vg-list .vg-card').first()).toBeVisible();
  });
});
