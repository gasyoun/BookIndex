# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Live GitHub Pages health checks plus Lighthouse and axe accessibility quality gates.

### Changed
- Raised the axe accessibility gate to require zero critical and zero serious violations on audited routes.
- Switched the standalone app from embedding the full `app_data.json` payload to lazy-loaded `data/modules/*.json` chunks that are pre-cached for offline use.
- Darkened muted helper text in the app shell so route metadata, index summary chips, chapter labels and KWIC controls meet contrast requirements.
- Replaced script CSP `unsafe-inline` with build-generated SHA-256 hashes for the landing page and standalone app shell.
- Replaced broad style CSP `unsafe-inline` with build-generated SHA-256 hashes for inline style blocks.
- Removed the remaining `style-src-attr 'unsafe-inline'` exception by moving runtime style attributes to `data-*` driven DOM style updates.
- Opted GitHub workflows into the Node 24 JavaScript action runtime ahead of the June 2026 migration.

## [2.3.0] - 2026-05-26
### Added
- **Sound Law Simulator**: Interactive po-shagovaya historical phonology engine showing the evolution of Proto-Slavic reconstructed roots to modern Slavic descendants (Russian, Polish, Czech).
- **Linguistic Database Interoperability (LOD)**: Direct Glottolog, WALS, Vasmer's Dictionary on Starling, and Russian National Corpus (RNC) connections integrated in Language and Lexicon SPA cards.
- **Old Russian Accentology Paradigm Simulator**: Dynamic reconstructor for Accent Paradigms A (baritone), B (oxytone), and C (mobile) tracing nominal declensions across three historical stages.
- **Old East Slavic Orthography Hydrator**: Real-time medieval grapheme processing engine translating modern Russian words to Old East Slavic spelling forms (`ѣ`, `ъ`/`ь`, `ѫ`/`Ѧ`, `ѡ`).
- Complete E2E and visual check suite passing all 104 Playwright tests cleanly.

## [2.2.0] - 2026-05-17
### Added
- Open Graph, Twitter Card and JSON-LD metadata for `index.html` and `aaz-index.html`.
- Local Leaflet CSS/JS assets so runtime scripts no longer depend on `unpkg.com`.
- Full Playwright CI gate, npm audit, static security policy guard, performance budget, Dependabot and CodeQL.
- `robots.txt`, `sitemap.xml`, PWA icons, manifest copies and portrait preview asset for GitHub Pages.

### Changed
- Restored the tested `v3_template.html` + `v3_app.js` standalone runtime after the temporary `src/entry.js` path failed full parity.
- Kept Vite as a standalone build smoke and deploy-asset copy path.
- Updated Vite to the current 8.x line and kept dependency audit at zero vulnerabilities.
- Normalized README, Codex workflow, Claude guidance, changelog and documentation archive notes.

### Removed
- Duplicate `landing.html` entry; `index.html` is the canonical public landing page.
