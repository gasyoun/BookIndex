import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const DEFAULT_BASE_URL = 'https://gasyoun.github.io/BookIndex/';

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  return url;
}

function scorePercent(score) {
  return `${Math.round(Number(score || 0) * 100)}`;
}

function thresholdFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const baseUrl = normalizeBaseUrl(
  getArgValue('--base-url') || process.env.BOOKINDEX_BASE_URL || DEFAULT_BASE_URL
);

const lighthouseTargets = [
  {
    label: 'landing',
    url: new URL('index.html', baseUrl),
    thresholds: {
      performance: thresholdFromEnv('BOOKINDEX_LH_LANDING_PERFORMANCE', 0.90),
      accessibility: thresholdFromEnv('BOOKINDEX_LH_LANDING_ACCESSIBILITY', 0.90),
      'best-practices': thresholdFromEnv('BOOKINDEX_LH_LANDING_BEST_PRACTICES', 0.90),
      seo: thresholdFromEnv('BOOKINDEX_LH_LANDING_SEO', 0.95),
    },
  },
  {
    label: 'app',
    url: new URL('aaz-index.html#v4/home/home', baseUrl),
    thresholds: {
      performance: thresholdFromEnv('BOOKINDEX_LH_APP_PERFORMANCE', 0.80),
      accessibility: thresholdFromEnv('BOOKINDEX_LH_APP_ACCESSIBILITY', 0.90),
      'best-practices': thresholdFromEnv('BOOKINDEX_LH_APP_BEST_PRACTICES', 0.90),
      seo: thresholdFromEnv('BOOKINDEX_LH_APP_SEO', 0.95),
    },
  },
];

const axeTargets = [
  { label: 'landing', url: new URL('index.html', baseUrl), waitFor: 'a[href="./aaz-index.html#v4/home/home"]' },
  { label: 'app-home', url: new URL('aaz-index.html#v4/home/home', baseUrl), waitFor: '#global-search' },
  { label: 'app-list', url: new URL('aaz-index.html#v4/all/list', baseUrl), waitFor: '#global-search' },
  { label: 'app-kwic', url: new URL('aaz-index.html#v4/materials/kwic', baseUrl), waitFor: '#content' },
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(message);
}

async function runLighthouse() {
  for (const target of lighthouseTargets) {
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const result = await lighthouse(target.url.href, {
        port: chrome.port,
        logLevel: 'error',
        output: 'json',
        onlyCategories: Object.keys(target.thresholds),
        formFactor: 'desktop',
        throttlingMethod: 'provided',
        screenEmulation: {
          mobile: false,
          width: 1365,
          height: 900,
          deviceScaleFactor: 1,
          disabled: false,
        },
      });

      const categories = result?.lhr?.categories || {};
      for (const [category, threshold] of Object.entries(target.thresholds)) {
        const score = categories[category]?.score;
        const readable = `${scorePercent(score)} >= ${scorePercent(threshold)}`;
        if (typeof score !== 'number' || score < threshold) {
          fail(`[lighthouse] ${target.label} ${category} ${readable}`);
        } else {
          console.log(`[lighthouse] OK ${target.label} ${category} ${readable}`);
        }
      }
    } finally {
      try {
        await chrome.kill();
      } catch (error) {
        console.warn(`[lighthouse] Chrome cleanup warning: ${error.message}`);
      }
    }
  }
}

async function runAxe() {
  const maxCritical = thresholdFromEnv('BOOKINDEX_A11Y_MAX_CRITICAL', 0);
  const maxSerious = thresholdFromEnv('BOOKINDEX_A11Y_MAX_SERIOUS', 0);
  const browser = await chromium.launch();

  try {
    for (const target of axeTargets) {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      const page = await context.newPage();
      await page.goto(target.url.href, { waitUntil: 'domcontentloaded' });
      await page.locator(target.waitFor).first().waitFor({ timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter((violation) => violation.impact === 'critical');
      const serious = results.violations.filter((violation) => violation.impact === 'serious');

      if (critical.length > maxCritical || serious.length > maxSerious) {
        fail(`[a11y] ${target.label} has ${critical.length} critical and ${serious.length} serious violations`);
        for (const violation of [...critical, ...serious].slice(0, 8)) {
          console.error(`[a11y] ${target.label} ${violation.impact}: ${violation.id} (${violation.nodes.length} nodes)`);
        }
      } else {
        console.log(`[a11y] OK ${target.label}: ${critical.length} critical, ${serious.length} serious`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

console.log(`[quality] Auditing ${baseUrl.href}`);
await runLighthouse();
await runAxe();

if (failed) {
  process.exit(1);
}

console.log('[quality] Lighthouse and accessibility budgets passed.');
