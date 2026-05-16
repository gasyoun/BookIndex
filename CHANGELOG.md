# Changelog

All notable changes to this project will be documented in this file.

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
