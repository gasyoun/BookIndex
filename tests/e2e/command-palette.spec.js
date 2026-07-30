const { test, expect } = require('@playwright/test');

const PALETTE = '#command-palette';
const INPUT = '#command-palette-input';
const ITEM = '#command-palette-list .command-palette-item';

async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await expect(page.locator(PALETTE)).toHaveClass(/open/);
  await expect(page.locator(INPUT)).toBeFocused();
}

test.describe('палитра команд (Ctrl+K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch (e) {}
    });
    await page.goto('/aaz-index.html#v4/home/home');
    await expect(page.locator('#entity-switcher .entity-btn').first()).toBeVisible();
  });

  test('скрыта до вызова и открывается по Ctrl+K', async ({ page }) => {
    await expect(page.locator(PALETTE)).toBeHidden();
    await openPalette(page);
    const count = await page.locator(ITEM).count();
    expect(count).toBeGreaterThan(5);
  });

  test('открывается кнопкой в шапке', async ({ page }) => {
    await page.click('#command-palette-btn');
    await expect(page.locator(PALETTE)).toHaveClass(/open/);
    await expect(page.locator(INPUT)).toBeFocused();
  });

  test('закрывается по Escape, по повторному Ctrl+K и по клику вне панели', async ({ page }) => {
    await openPalette(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(PALETTE)).toBeHidden();

    await openPalette(page);
    await page.keyboard.press('Control+k');
    await expect(page.locator(PALETTE)).toBeHidden();

    await openPalette(page);
    await page.click('#command-palette-backdrop', { position: { x: 5, y: 5 } });
    await expect(page.locator(PALETTE)).toBeHidden();
  });

  test('фильтрует команды и переходит по Enter', async ({ page }) => {
    await openPalette(page);
    await page.fill(INPUT, 'глосс');
    await expect(page.locator(ITEM).first()).toContainText(/глоссарий/i);
    await page.keyboard.press('Enter');
    await expect(page.locator(PALETTE)).toBeHidden();
    await expect(page).toHaveURL(/#v4\/materials\/glossary/);
  });

  test('стрелки перемещают выделение', async ({ page }) => {
    await openPalette(page);
    await page.fill(INPUT, 'указат');
    const rows = page.locator(ITEM);
    await expect(rows.first()).toHaveClass(/active/);
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toHaveClass(/active/);
    await expect(rows.first()).not.toHaveClass(/active/);
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toHaveClass(/active/);
  });

  test('клик по строке выполняет команду', async ({ page }) => {
    await openPalette(page);
    await page.fill(INPUT, 'лекции');
    await expect(page.locator(ITEM).first()).toContainText(/лекции/i);
    await page.locator(ITEM).first().click();
    await expect(page.locator(PALETTE)).toBeHidden();
    await expect(page).toHaveURL(/#v4\/materials\/lectures/);
  });

  test('находит содержание указателя, а не только команды', async ({ page }) => {
    await openPalette(page);
    await page.fill(INPUT, 'аванесов');
    const contentRow = page.locator('#command-palette-list .command-palette-item[data-kind="content"]').first();
    await expect(contentRow).toBeVisible();
    await contentRow.click();
    await expect(page.locator(PALETTE)).toBeHidden();
    await expect(page.locator('.card')).toBeVisible();
  });

  test('открывается поверх фокуса в поле поиска', async ({ page }) => {
    await page.click('#global-search');
    await expect(page.locator('#global-search')).toBeFocused();
    await page.keyboard.press('Control+k');
    await expect(page.locator(PALETTE)).toHaveClass(/open/);
    await expect(page.locator(INPUT)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#global-search')).toBeFocused();
  });

  test('без запроса показывает недавние записи', async ({ page }) => {
    await page.goto('/aaz-index.html#v4/names/list');
    await page.locator('.name-item[data-head]').first().click();
    await expect(page.locator('.card')).toBeVisible();
    await openPalette(page);
    const recent = page.locator('#command-palette-list .command-palette-item[data-kind="recent"]');
    await expect(recent.first()).toBeVisible();
    await expect(page.locator('#command-palette-list .command-palette-group').first()).toContainText('Недавние');
  });

  test('меняет плотность интерфейса', async ({ page }) => {
    await openPalette(page);
    await page.fill(INPUT, 'плотность: плотно');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveClass(/density-compact/);
    await expect(page.locator('#density-select')).toHaveValue('compact');
  });

  test('сообщает об отсутствии результатов', async ({ page }) => {
    await openPalette(page);
    await page.fill(INPUT, 'zzzqqqxxx');
    await expect(page.locator('#command-palette-list .command-palette-empty')).toContainText('Ничего не найдено');
  });

  test('диалог помечен как модальный и снимает aria-hidden при открытии', async ({ page }) => {
    const palette = page.locator(PALETTE);
    await expect(palette).toHaveAttribute('role', 'dialog');
    await expect(palette).toHaveAttribute('aria-modal', 'true');
    await expect(palette).toHaveAttribute('aria-hidden', 'true');
    await openPalette(page);
    await expect(palette).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator(INPUT)).toHaveAttribute('aria-activedescendant', /command-palette-item-\d+/);
  });
});
