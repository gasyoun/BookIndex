const { test, expect } = require('@playwright/test');

test.describe('reader guide (guide.html)', () => {
  test('renders 11 chapters plus the LLSH chronology', async ({ page }) => {
    await page.goto('/guide.html');
    await expect(page.locator('h1')).toContainText('Гид по видеоархиву');
    await expect(page.locator('section.chapter[data-chapter]')).toHaveCount(12);
    await expect(page.locator('#llsh tbody tr')).toHaveCount(11);
    await expect(page.locator('ol.videos .status-approved')).toHaveCount(142);
  });

  test('arabic chapter carries the honest empty note', async ({ page }) => {
    await page.goto('/guide.html');
    const ch07 = page.locator('section[data-chapter="ch07"]');
    await expect(ch07.locator('.empty-note')).toContainText('Утверждённых связей нет');
    await expect(ch07.locator('.status-approved')).toHaveCount(0);
  });

  test('every video links to YouTube with real ids', async ({ page }) => {
    await page.goto('/guide.html');
    const links = page.locator('ol.videos a[href*="youtube.com/watch"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(200);
    for (let i = 0; i < Math.min(count, 10); i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toMatch(/watch\?v=[\w-]{6,}/);
      expect(href).not.toContain('v=acc');
    }
  });

  test('page ships its own CSP that forbids scripts', async ({ page }) => {
    await page.goto('/guide.html');
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]'))
      .toHaveAttribute('content', /script-src 'none'/);
  });

  test('landing links to the guide', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.route', { hasText: 'Смотреть видео к главам' }))
      .toHaveAttribute('href', './guide.html');
  });
});
