import { chromium } from '@playwright/test';

const DEFAULT_BASE_URL = 'https://gasyoun.github.io/BookIndex/';
const DEFAULT_BASE = new URL(DEFAULT_BASE_URL);
const DENIED_REMOTE_ASSETS = ['unpkg.com', 'cdn.jsdelivr.net'];

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

const baseUrl = normalizeBaseUrl(
  getArgValue('--base-url') || process.env.BOOKINDEX_BASE_URL || DEFAULT_BASE_URL
);

function cacheBustedUrl(pathname) {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set('bookindex_health', String(Date.now()));
  return url;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoDeniedRemoteAssets(pathname, text) {
  for (const host of DENIED_REMOTE_ASSETS) {
    assert(!text.includes(host), `${pathname} contains denied remote asset host: ${host}`);
  }
}

async function fetchText(pathname) {
  const url = cacheBustedUrl(pathname);
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();
  assert(response.ok, `${pathname} returned HTTP ${response.status}`);
  return { response, text };
}

async function checkText(pathname, validate) {
  const { response, text } = await fetchText(pathname);
  assertNoDeniedRemoteAssets(pathname, text);
  await validate(text, response);
  console.log(`[deploy] OK ${pathname} (${response.status}, ${text.length} bytes)`);
}

async function runStaticChecks() {
  const expectedSitemap = new URL('sitemap.xml', baseUrl).href;
  const productionSitemap = new URL('sitemap.xml', DEFAULT_BASE).href;
  const expectedIndex = new URL('index.html', baseUrl).href;
  const expectedApp = new URL('aaz-index.html', baseUrl).href;
  const productionIndex = new URL('index.html', DEFAULT_BASE).href;
  const productionApp = new URL('aaz-index.html', DEFAULT_BASE).href;

  await checkText('index.html', (text) => {
    assert(text.includes('application/ld+json'), 'index.html is missing JSON-LD');
    assert(text.includes('rel="canonical"'), 'index.html is missing canonical link');
    assert(text.includes('href="./aaz-index.html#v4/home/home"'), 'index.html is missing app entry route');
  });

  await checkText('aaz-index.html', (text) => {
    assert(text.includes('id="app-data-json"'), 'aaz-index.html is missing embedded app data');
    assert(text.includes('href="./vendor/leaflet.css"'), 'aaz-index.html is missing local Leaflet CSS');
    assert(text.includes('src="./vendor/leaflet.js"'), 'aaz-index.html is missing local Leaflet JS');
    assert(text.includes('navigator.serviceWorker.register(swUrl'), 'aaz-index.html is missing service-worker registration');
    assert(!text.includes('__APP_DATA_JSON__'), 'aaz-index.html still contains an app data placeholder');
  });

  await checkText('manifest.webmanifest', (text) => {
    const manifest = JSON.parse(text);
    assert(manifest.start_url === './aaz-index.html#v4/home/home', 'manifest start_url drifted');
    assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest is missing icons');
    for (const icon of manifest.icons) {
      assert(String(icon.src || '').startsWith('./'), `manifest icon is not same-origin relative: ${icon.src}`);
    }
  });

  await checkText('robots.txt', (text) => {
    assert(
      text.includes(`Sitemap: ${expectedSitemap}`) || text.includes(`Sitemap: ${productionSitemap}`),
      'robots.txt points at the wrong sitemap'
    );
  });

  await checkText('sitemap.xml', (text) => {
    assert(
      text.includes(expectedIndex) || text.includes(productionIndex),
      'sitemap.xml is missing index.html'
    );
    assert(
      text.includes(expectedApp) || text.includes(productionApp),
      'sitemap.xml is missing aaz-index.html'
    );
  });

  await checkText('sw.js', (text) => {
    assert(text.includes('./aaz-index.html'), 'sw.js is missing the standalone app shell');
    assert(text.includes('./vendor/leaflet.css'), 'sw.js is missing local Leaflet CSS');
  });

  await checkText('service-worker.js', (text) => {
    assert(text.includes('./aaz-index.html'), 'service-worker.js is missing the standalone app shell');
    assert(text.includes('./vendor/leaflet.css'), 'service-worker.js is missing local Leaflet CSS');
  });

  await checkText('vendor/leaflet.css', (text) => {
    assert(text.includes('.leaflet-container'), 'vendor/leaflet.css does not look like Leaflet CSS');
  });
}

async function runBrowserSmoke() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const failures = [];

  page.on('pageerror', (error) => failures.push(`[pageerror] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`[console:error] ${message.text()}`);
    }
  });

  try {
    await page.goto(new URL('index.html', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.locator('a[href="./aaz-index.html#v4/home/home"]').first().waitFor({ timeout: 15000 });

    await page.goto(new URL('aaz-index.html#v4/home/home', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.locator('#content').waitFor({ timeout: 30000 });
    await page.locator('#global-search').waitFor({ timeout: 30000 });

    await page.goto(new URL('aaz-index.html#v4/all/list', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.locator('#global-search').fill('санскрит');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.goto(new URL('aaz-index.html#v4/scholar/viz', baseUrl).href, { waitUntil: 'domcontentloaded' });
    await page.locator('#content').waitFor({ timeout: 30000 });

    assert(failures.length === 0, failures.join('\n'));
    console.log(`[deploy] OK browser smoke (${await page.title()})`);
  } finally {
    await browser.close();
  }
}

try {
  console.log(`[deploy] Checking ${baseUrl.href}`);
  await runStaticChecks();
  await runBrowserSmoke();
} catch (error) {
  console.error(`[deploy] ${error.message}`);
  process.exit(1);
}
