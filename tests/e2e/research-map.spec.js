const { test, expect } = require('@playwright/test');

const ROUTE = '/aaz-index.html#v4/scholar/viz/module/viz08';

async function openMap(page, suffix = '') {
  await page.goto(`${ROUTE}${suffix}`);
  await expect(page.locator('.viz-research-map')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.rmap-svg')).toBeVisible();
}

test.describe('VIZ-08 · исследовательская карта (H1821)', () => {
  test('обзор: концентратор, узлы направлений и сводная таблица', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));

    await openMap(page);

    await expect(page.locator('.rmap-node-hub .rmap-hub-label')).toHaveText('А. А. Зализняк');
    const domainNodes = page.locator('.rmap-node-domain');
    await expect(domainNodes).toHaveCount(7);

    // Every domain node carries a non-zero evidence count.
    const counts = await page.locator('.rmap-node-domain .rmap-dot-count').allTextContents();
    expect(counts).toHaveLength(7);
    for (const value of counts) {
      expect(Number(value)).toBeGreaterThan(0);
    }

    await expect(page.locator('.rmap-table tbody tr')).toHaveCount(7);
    await expect(page.locator('[data-role="rmap-summary"]')).toContainText('7 направлений');

    // Cross-domain bridges are the integrative layer — at least one must exist.
    expect(await page.locator('.rmap-bridge').count()).toBeGreaterThan(0);

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('переключатель связей скрывает мостики между направлениями', async ({ page }) => {
    await openMap(page);
    const before = await page.locator('.rmap-bridge').count();
    expect(before).toBeGreaterThan(0);
    await page.locator('[data-role="rmap-bridges"]').uncheck();
    await expect(page.locator('.rmap-bridge')).toHaveCount(0);
    await page.locator('[data-role="rmap-bridges"]').check();
    await expect(page.locator('.rmap-bridge')).toHaveCount(before);
  });

  test('раскрытие направления: спутники, метрики и состояние в URL', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));

    await openMap(page);
    await page.locator('[data-role="rmap-domain"]').selectOption('birchbark');

    await expect(page).toHaveURL(/filter=birchbark/);
    await expect(page.locator('.rmap-detail-title')).toContainText('Берестяные грамоты');
    await expect(page.locator('.rmap-node-entity')).toHaveCount(8);
    await expect(page.locator('.rmap-metrics')).toContainText('свидетельств');
    await expect(page.locator('.rmap-viz-link a')).toHaveAttribute('href', /viz01/);

    await page.locator('[data-role="rmap-top"]').fill('5');
    await page.locator('[data-role="rmap-top"]').dispatchEvent('change');
    await expect(page.locator('.rmap-node-entity')).toHaveCount(5);
    await expect(page).toHaveURL(/top=5/);

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('глубокая ссылка восстанавливает выбранное направление', async ({ page }) => {
    await openMap(page, '?filter=slovo');
    await expect(page.locator('.rmap-detail-title')).toContainText('Слово о полку Игореве');
    await expect(page.locator('.rmap-node-hub')).toBeVisible();
    await expect(page.locator('.rmap-node-domain')).toHaveCount(0);
  });

  test('сброс возвращает обзор всех направлений', async ({ page }) => {
    await openMap(page, '?filter=accent');
    await expect(page.locator('.rmap-detail-title')).toContainText('Акцентология');
    await page.locator('.viz-module-actions [data-viz-action="reset"]').click();
    await expect(page.locator('.rmap-node-domain')).toHaveCount(7);
    await expect(page).not.toHaveURL(/filter=accent/);
  });

  test('чип сущности ведёт на карточку', async ({ page }) => {
    await openMap(page, '?filter=comparative');
    const chip = page.locator('.rmap-chips [data-entity-head]').first();
    await expect(chip).toBeVisible();
    const head = String(await chip.getAttribute('data-entity-head') || '');
    expect(head.length).toBeGreaterThan(0);
    await chip.click();
    await expect(page.locator('#content .card').first()).toBeVisible();
    await expect(page).not.toHaveURL(/module\/viz08/);
  });

  test('таблица обзора раскрывает направление по клику', async ({ page }) => {
    await openMap(page);
    await page.locator('.rmap-table tbody tr').first().locator('.rmap-link').click();
    await expect(page.locator('.rmap-node-entity').first()).toBeVisible();
    await expect(page.locator('.rmap-detail-title')).not.toHaveText('Все направления');
  });
});
