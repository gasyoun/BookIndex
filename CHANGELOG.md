# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Live GitHub Pages health checks plus Lighthouse and axe accessibility quality gates.
- Video-production pipeline tracker: `data/video_pipeline.json` (per-video proof-reading stage, transcription quality, assignees, dates, links) migrated from `video-archive.xlsx`, plus a self-contained volunteer dashboard at `pipeline/index.html` (`npm run pipeline:dashboard`).
- Reverse video links on entity cards: names, languages, ethnonyms, toponyms, lexicon and subject cards now list the lectures/talks that mention them (built from `video_catalog[].related_entities`), newest first, with duration and a total count.
- Lecture transcript corpus (`data/imports/lectures-v2/`): `scripts/ingest_transcripts.py` fetches edited transcripts from public Yandex.Disk links recorded in `data/video_pipeline.json`, extracts timecoded segments (`.docx`/`.srt`, stdlib only), and stores one reviewable JSON per lecture plus a corpus index. 27 lectures ingested (~240k words, ~3.7k timecoded segments) with proof-reading-stage provenance; feeds upcoming deep video links (B3.2), entity extraction (C3) and lecture KWIC.
- Deep video links by timecode (B3.2): `scripts/build_transcript_timecodes.py` matches each entity against the transcript corpus and writes the first-mention timecode onto `video_catalog[].related_entities[].t`; entity-card video links now jump straight to that minute (`&t=<sec>s`) and show a `▸ MM:SS` marker. 85 of 113 entity/video pairs on transcribed lectures are timecoded; the rest fall back to a plain link.
- Authority identifiers (A3): `scripts/align_authorities.py` aligns names/toponyms/ethnonyms to Wikidata (with VIAF/GND/GeoNames pulled from the matched item). 131 of 340 high-confidence matches auto-written to `authority` blocks in `app_data.json` (`src: wikidata-auto`); the rest are left in `data/authority_candidates.json` for manual review. Persons are verified by instance-of=human + surname + initials + a scholarly/historical domain filter (rejects off-domain same-name matches). Entity cards show an "Авторитетные записи" chip row; prerendered pages add schema.org `sameAs`. Schema extended with an `authority` property.
- Stable canonical entity URIs (A2): a frozen slug registry (`data/slug_registry.json`, keyed by each entity's `canonical_id`) makes URL slugs stable across releases — a head rename never changes the URL. `scripts/build_slug_registry.mjs` (`npm run slug:freeze`) maintains it; `scripts/prerender.mjs` consumes it. Entity pages now declare the clean prerendered path as `<link rel="canonical">`, `og:url` and JSON-LD `@id` (was the app hash route). Added a retired-slug redirect table (`data/slug_redirects.json`) consulted by `404.html`. URIs stay global (one merged entity = one URI), matching the by-head identity model; introduced with zero change to existing slugs.
- Citability / scholarly infrastructure (A1): `CITATION.cff` (CFF 1.2.0, GitHub "Cite this repository"), `.zenodo.json` for DOI minting on release, `LICENSE-DATA.md` separating code (Apache-2.0), index data (CC BY 4.0) and book quotes/transcripts (© rights holders, cited with permission), a "Как цитировать" + license section in the README, and `docs/ZENODO_RU.md` deposit guide.
- Entity↔lecture linking from the corpus (C3): `scripts/extract_entities_from_transcripts.py` links known index entities (names, toponyms, ethnonyms, languages, subject terms — lexicon excluded as too noisy) to the lectures that mention them, with first-mention timecodes. Adds 807 `src:"transcript"` edges to `video_catalog[].related_entities`, raising the number of entities with a video section from ~48 to ~239. Russian matching uses stemmed prefixes, strict multiword phrases, and surname anchoring with epithet/patronymic/collision guards.

### Changed
- Raised the axe accessibility gate to require zero critical and zero serious violations on audited routes.
- Switched the standalone app from embedding the full `app_data.json` payload to lazy-loaded `data/modules/*.json` chunks that are pre-cached for offline use.
- Darkened muted helper text in the app shell so route metadata, index summary chips, chapter labels and KWIC controls meet contrast requirements.
- Replaced script CSP `unsafe-inline` with build-generated SHA-256 hashes for the landing page and standalone app shell.
- Replaced broad style CSP `unsafe-inline` with build-generated SHA-256 hashes for inline style blocks.
- Removed the remaining `style-src-attr 'unsafe-inline'` exception by moving runtime style attributes to `data-*` driven DOM style updates.
- Opted GitHub workflows into the Node 24 JavaScript action runtime ahead of the June 2026 migration.

### Removed
- Retired `video-archive.xlsx` from the repository; the canonical production status now lives in `data/video_pipeline.json`.

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
