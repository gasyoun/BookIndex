// Phase U4 — verification harness for the UI redesign (H1823).
// Spec: docs/CLEANUP_AND_UI_ROADMAP.md § "Phase U4 - Verification harness for redesign".
//
// For each of the 8 documented routes, at desktop and mobile widths:
//   1. screenshot (written to test-results/redesign-baseline/, gitignored artifacts)
//   2. no horizontal overflow
//   3. main controls visible and non-overlapping
//   4. no empty chart surface when the route has data
//   5. zero unexpected console/page errors
//
// Screenshots are review ARTIFACTS, not pixel baselines: font rasterisation differs
// between local Windows and CI Linux, so a committed `toHaveScreenshot` baseline would
// fail everywhere except the machine that produced it. The regression gates here are the
// structural ones (2-5); the images exist so a human can eyeball a redesign diff.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'redesign-baseline');

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// Overflow tolerance matches navigation-architecture.spec.js (sub-pixel layout rounding).
const OVERFLOW_TOLERANCE_PX = 8;
// Two controls may share up to this many pixels of edge before it counts as an overlap.
const OVERLAP_TOLERANCE_PX = 2;

const ROUTES = [
  {
    id: 'home',
    hash: '#v4/home/home',
    ready: '#home-stats-grid',
    controls: ['#entity-switcher', '#density-select', '#global-search', '#home-stats-grid'],
  },
  {
    id: 'all-list',
    hash: '#v4/all/list',
    ready: '#name-list',
    controls: ['#tabs', '#search-input', '#sort-most-frequent-btn', '#name-list'],
  },
  {
    id: 'names-list',
    hash: '#v4/names/list',
    ready: '#name-list',
    controls: ['#tabs', '#view-tabs', '#search-input', '#name-list'],
  },
  {
    id: 'materials-lectures',
    hash: '#v4/materials/lectures',
    ready: '#lectures-grid',
    controls: ['#tabs', '#reading-page-input', '#reading-page-go', '#lectures-grid'],
  },
  {
    id: 'materials-sources',
    hash: '#v4/materials/sources',
    ready: '.corpus-sources-grid',
    controls: ['#tabs', '.corpus-sources-grid'],
  },
  {
    id: 'scholar',
    hash: '#v4/scholar/scholar',
    ready: '.scholar-toc',
    controls: ['#tabs', '.scholar-toc', '#birch-city-filter', '#birch-century-filter'],
  },
  {
    id: 'scholar-viz03',
    hash: '#v4/scholar/viz/module/viz03',
    ready: '.viz-module-header',
    controls: [
      '#viz-module-tabs',
      '.viz-module-actions [data-viz-action="reset"]',
      '.viz-module-actions [data-viz-action="copy-link"]',
      '.viz-toolbar-filters',
    ],
    // VIZ-03 draws DOM cards, not SVG; the populated surface is the timeline wrap
    // inside the shell's module card (see scripts/viz/viz-shell.js buildModuleCard).
    dataSurfaces: ['.viz-card', '.tl-wrap'],
    // The shell's empty state must stay collapsed while the module has data.
    collapsedWhenPopulated: ['.viz-empty-state'],
  },
  {
    id: 'materials-tasks',
    hash: '#v4/materials/tasks',
    ready: '#tasks-container',
    controls: ['#entity-switcher', '#tasks-regen', '#tasks-reset-progress', '#tasks-container'],
  },
  {
    id: 'materials-video',
    hash: '#v4/materials/video',
    ready: '#vg-list',
    controls: ['#vg-search', '#vg-list'],
  },
  {
    id: 'materials-video-detail',
    hash: '#v4/materials/video/tv87ggs0yq4',
    ready: '.video-detail',
    controls: ['.video-detail'],
  },
];

// Errors that are environmental rather than route defects (offline SW/PWA plumbing under
// the static test server). Anything else counts against the zero-error budget.
const IGNORED_ERROR_PATTERNS = [
  /ServiceWorker/i,
  /Failed to register a ServiceWorker/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
];

function isIgnorableError(message) {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message));
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => {
    const message = String(err && err.message ? err.message : err);
    if (!isIgnorableError(message)) errors.push(`pageerror: ${message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const message = msg.text();
    if (!isIgnorableError(message)) errors.push(`console: ${message}`);
  });
  return errors;
}

async function readOverflow(page) {
  return page.evaluate(() => {
    const root = document.scrollingElement || document.documentElement;
    return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
  });
}

async function readControlBoxes(page, selectors) {
  return page.evaluate((sels) => sels.map((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { sel, found: false };
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      sel,
      found: true,
      hidden: style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  }), selectors);
}

async function readNesting(page, selectors) {
  return page.evaluate((sels) => {
    const nested = [];
    for (let i = 0; i < sels.length; i += 1) {
      for (let j = i + 1; j < sels.length; j += 1) {
        const a = document.querySelector(sels[i]);
        const b = document.querySelector(sels[j]);
        if (!a || !b) continue;
        if (a.contains(b) || b.contains(a)) nested.push(`${sels[i]}|${sels[j]}`);
      }
    }
    return nested;
  }, selectors);
}

async function readEmptySurfaces(page, extraSurfaces, collapsedSurfaces) {
  return page.evaluate(({ extra, collapsed }) => {
    const empty = [];
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return rect.width > 1 && rect.height > 1;
    };
    // Any drawn chart surface that is visibly sized must actually contain marks.
    for (const el of document.querySelectorAll('svg, canvas')) {
      if (!visible(el)) continue;
      if (el.tagName.toLowerCase() === 'canvas') {
        const ctx = el.getContext && el.getContext('2d');
        if (!ctx) continue;
        let painted = false;
        try {
          const data = ctx.getImageData(0, 0, el.width, el.height).data;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 0) { painted = true; break; }
          }
        } catch (e) {
          painted = true; // tainted canvas (map tiles) — cannot inspect, do not fail
        }
        if (!painted) empty.push(`canvas.${el.getAttribute('class') || '(no class)'}`);
        continue;
      }
      if (el.childElementCount === 0) empty.push(`svg.${el.getAttribute('class') || '(no class)'}`);
    }
    // Declared surfaces are STRICT: a missing or invisible one is a failure, not a skip,
    // so a stale selector in this spec cannot silently turn the check into a no-op.
    for (const sel of extra || []) {
      const el = document.querySelector(sel);
      if (!el) { empty.push(`${sel} (declared data surface absent)`); continue; }
      if (!visible(el)) { empty.push(`${sel} (declared data surface not visible)`); continue; }
      if (el.childElementCount === 0) empty.push(`${sel} (no children)`);
    }
    for (const sel of collapsed || []) {
      const el = document.querySelector(sel);
      if (!el) { empty.push(`${sel} (declared empty-state element absent)`); continue; }
      if (visible(el)) empty.push(`${sel} (empty state shown while data is present)`);
    }
    return empty;
  }, { extra: extraSurfaces || [], collapsed: collapsedSurfaces || [] });
}

test.beforeAll(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
});

test.describe('redesign verification harness (Phase U4)', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of ROUTES) {
        test(`${route.id} passes the U4 checks`, async ({ page }) => {
          const errors = collectErrors(page);

          await page.goto(`/aaz-index.html${route.hash}`);
          await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 30000 });
          // Let lazy VIZ modules and deferred hydrators settle before measuring.
          await page.waitForTimeout(1500);

          // 1. screenshot artifact
          await page.screenshot({
            path: path.join(SHOT_DIR, `${route.id}--${viewport.name}.png`),
            fullPage: true,
          });

          // 2. no horizontal overflow
          const overflow = await readOverflow(page);
          expect(
            overflow.scrollWidth,
            `${route.id} @${viewport.name} overflows horizontally (${overflow.scrollWidth} > ${overflow.clientWidth})`,
          ).toBeLessThanOrEqual(overflow.clientWidth + OVERFLOW_TOLERANCE_PX);

          // 3a. main controls present and visible
          const boxes = await readControlBoxes(page, route.controls);
          for (const box of boxes) {
            expect(box.found, `${route.id} @${viewport.name}: control not in DOM: ${box.sel}`).toBe(true);
            expect(box.hidden, `${route.id} @${viewport.name}: control hidden: ${box.sel}`).toBe(false);
            expect(
              box.width > 0 && box.height > 0,
              `${route.id} @${viewport.name}: control has zero box: ${box.sel}`,
            ).toBe(true);
          }

          // 3b. controls do not overlap each other (nested pairs excluded)
          const nested = new Set(await readNesting(page, route.controls));
          const overlaps = [];
          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i];
              const b = boxes[j];
              if (nested.has(`${a.sel}|${b.sel}`)) continue;
              const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (dx > OVERLAP_TOLERANCE_PX && dy > OVERLAP_TOLERANCE_PX) {
                overlaps.push(`${a.sel} ∩ ${b.sel} (${Math.round(dx)}×${Math.round(dy)}px)`);
              }
            }
          }
          expect(overlaps, `${route.id} @${viewport.name}: overlapping controls`).toEqual([]);

          // 4. no empty chart surface where data exists
          const emptySurfaces = await readEmptySurfaces(
            page,
            route.dataSurfaces,
            route.collapsedWhenPopulated,
          );
          expect(emptySurfaces, `${route.id} @${viewport.name}: empty chart surfaces`).toEqual([]);

          // 5. console-error budget
          expect(errors, `${route.id} @${viewport.name}: unexpected errors`).toEqual([]);
        });
      }
    });
  }

  test('harness covers exactly the routes documented in the U4 roadmap section', () => {
    const roadmap = fs.readFileSync(
      path.join(process.cwd(), 'docs', 'CLEANUP_AND_UI_ROADMAP.md'),
      'utf8',
    );
    const section = roadmap.split('### Phase U4')[1];
    expect(section, 'Phase U4 section missing from docs/CLEANUP_AND_UI_ROADMAP.md').toBeTruthy();
    const body = section.split('\n## ')[0];
    const documented = [...body.matchAll(/`(#v4\/[^`]+)`/g)].map((m) => m[1]);
    expect(documented.length, 'expected 10 documented U4 routes').toBe(10);
    expect(ROUTES.map((r) => r.hash)).toEqual(documented);
  });
});
