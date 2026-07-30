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

  test('центр-сущность: первый круг связей, метрики и состояние в URL', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));

    await openMap(page, '?mode=entity&entity=%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9');
    await expect(page.locator('.rmap-detail-title')).toHaveText('русский');
    await expect(page.locator('.rmap-node-domain')).toHaveCount(0);
    const first = await page.locator('.rmap-node-entity:not(.rmap-node-second)').count();
    expect(first).toBeGreaterThan(0);
    await expect(page.locator('.rmap-node-second')).toHaveCount(0);
    await expect(page.locator('.rmap-detail-note')).toContainText('круг: 1');

    expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
  });

  test('второй круг раскрывается по требованию и держится в URL', async ({ page }) => {
    await openMap(page, '?mode=entity&entity=%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9');
    await expect(page.locator('.rmap-node-second')).toHaveCount(0);
    await page.locator('[data-role="rmap-depth"]').check();
    await expect(page).toHaveURL(/depth=2/);
    expect(await page.locator('.rmap-node-second').count()).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('.viz-research-map')).toBeVisible({ timeout: 30000 });
    expect(await page.locator('.rmap-node-second').count()).toBeGreaterThan(0);
    await expect(page.locator('.rmap-detail-note')).toContainText('круг: 2');
  });

  test('тип связей переключается между cross_links и semantic_links', async ({ page }) => {
    await openMap(page, '?mode=entity&entity=%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9');
    await page.locator('[data-role="rmap-rel"]').selectOption('cross');
    await expect(page).toHaveURL(/rel=cross/);
    await expect(page.locator('.rmap-detail-note')).toContainText('cross_links');
    const crossCount = await page.locator('.rmap-node-entity').count();
    expect(crossCount).toBeGreaterThan(0);
    await expect(page.locator('.rmap-spoke-semantic')).toHaveCount(0);

    await page.locator('[data-role="rmap-rel"]').selectOption('semantic');
    await expect(page).toHaveURL(/rel=semantic/);
    expect(await page.locator('.rmap-spoke-semantic').count()).toBeGreaterThan(0);
  });

  test('клик по узлу переносит центр карты (обход графа через URL)', async ({ page }) => {
    await openMap(page, '?mode=entity&entity=%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9');
    const chip = page.locator('.rmap-chips [data-recentre]').first();
    const nextHead = String(await chip.getAttribute('data-recentre') || '');
    expect(nextHead.length).toBeGreaterThan(0);
    await chip.click();
    await expect(page.locator('.rmap-detail-title')).toHaveText(nextHead);
    await expect(page).toHaveURL(/entity=/);
    // Centre still opens the card rather than recentring on itself.
    await page.locator('.rmap-detail [data-entity-head]').first().click();
    await expect(page.locator('#content .card').first()).toBeVisible();
  });

  test('переключатель центра прячет и показывает свои поля', async ({ page }) => {
    await openMap(page);
    await expect(page.locator('[data-role="rmap-domain-field"]')).toBeVisible();
    await expect(page.locator('[data-role="rmap-entity-field"]')).toBeHidden();
    await page.locator('[data-role="rmap-mode"]').selectOption('entity');
    await expect(page.locator('[data-role="rmap-entity-field"]')).toBeVisible();
    await expect(page.locator('[data-role="rmap-rel-field"]')).toBeVisible();
    await expect(page.locator('[data-role="rmap-domain-field"]')).toBeHidden();
    await expect(page).toHaveURL(/mode=entity/);
    await page.locator('.viz-module-actions [data-viz-action="reset"]').click();
    await expect(page.locator('[data-role="rmap-domain-field"]')).toBeVisible();
    await expect(page.locator('.rmap-node-domain')).toHaveCount(7);
  });

  test('таблица обзора раскрывает направление по клику', async ({ page }) => {
    await openMap(page);
    await page.locator('.rmap-table tbody tr').first().locator('.rmap-link').click();
    await expect(page.locator('.rmap-node-entity').first()).toBeVisible();
    await expect(page.locator('.rmap-detail-title')).not.toHaveText('Все направления');
  });
});
