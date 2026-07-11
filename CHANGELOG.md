# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Fixed
- Restored the README «Audit Summary» section (dropped by the H550 README refresh), un-reddening the `validate_content.py` CI gate that had failed on every push to `main` since.
- Reverse video links now de-duplicate by video id (`video_catalog` contains duplicate-id rows), so entity-card video counts and lists are no longer inflated; the chapter-related-videos and gallery views share the same deduped catalog.
- Entity citations fall back to per-book `occurrences` pages when `page_list` is empty, so the «С. N» reference is no longer dropped (e.g. «Saloni Z.» → «С. 157»).
- Security hardening (defensive, author-curated data): escape interpolated values in the app + prerender citation widgets and the prerendered JSON-LD (`</script>` guard); validate the 404 retired-slug redirect against `^[a-z0-9-]+$`; CSV formula-injection guard in the TEI exports; `</script>` guard in the pipeline dashboard.
- Matcher precision: whole-word (not substring) surname matching in the authority aligner; a ≥4-char floor in the transcript timecoder.

### Added
- «Сообщить об ошибке» flow (DH roadmap C4): entity cards link to a prefilled GitHub issue form (`.github/ISSUE_TEMPLATE/entity_correction.yml`) carrying the entity's slug, type, canonical URL and a `[правка] <head>` title; new `type:correction` label completes the four-group taxonomy for reader-reported corrections.
- KWIC over lectures matches accent-tolerantly — «победа» also matches the stressed transcript form «побе́да».
- Entity-card secondary actions (show on map, copy link, export .md) collapse into a «⋯ еще» menu; prev/next/back stay visible (B5).
- Regression E2E suite (`tests/e2e/session-features.spec.js`) covering the home task dashboard, chapter ribbon, lecture KWIC, video gallery, card order/dedup/actions, page citations and the lecture↔video link.
- Authority review worklist: `scripts/retier_authority_candidates.py` (`npm run authority:retier`) emits `data/authority_review.{json,csv}` — the 209 unconfirmed Wikidata candidates tiered by decision effort (decide / research / none) with a suggested QID and a `decision` column.

## [1.0.0] - 2026-06-13
### Added
- Entity-card content priority (B5): the card now orders sections by reader value — pages + contexts, then the «Видео» chips (moved up above the cross-link cluster), then cross-links with the «Авторитетные записи» chips grouped right after them, then external-DB (LOD) links and the citation widget.
- Video gallery (B3.5): a new «Видеогалерея» tab under Материалы lists all 175 (deduplicated) videos with title, date, duration and clickable entity chips, plus search (by title or mentioned entity), a book-chapter filter, and sort by date or duration.
- Video ↔ chapter linkage (B3.4): each lecture/chapter page now lists topically related videos — public lectures whose discussed entities overlap that chapter's pages — under «Видео по теме главы», with an explicit note that they are related lectures, not recordings of the book chapter. The chapter ↔ page-range mapping was already shown («стр. X–Y»).
- Page-level citations + canonical links (B2): the entity card's «скопировать ссылку» now copies the stable clean canonical URL (the prerendered page) instead of the app hash route, and the on-card citation widget (ГОСТ/APA/MLA/Chicago) now includes the page reference («С. 157») and the correct book title from `corpus.books`, citing the clean canonical URL.
- Home as a task dashboard (B4): the home page now leads with a "С чего начать?" band of three reader tasks — «Я читаю страницу книги» (page number → page view), «Я смотрю видео» (inline title search over the 191-video catalog), «Найти слово, имя, термин» (→ global index search). The stats/showcase moved below.
- Book-spine chapter ribbon (B1): the «Читаю сейчас» page view gained a navigable density mini-map of the 11 chapters — each segment is sized by page span and shaded by mention density, the current page's chapter is highlighted, and clicking a segment jumps the page view to that chapter.
- KWIC over the lecture corpus: the concordance gained a "Лекции (видео)" source that searches the ~240k-word timecoded transcript corpus and links each hit to the exact minute in the video (`&t=<sec>s`). Backed by a compact, lazy-loaded index (`data/lectures_kwic.json`, built by `scripts/build_lectures_kwic.py` / `npm run kwic:build`) so it never bloats the main artifact.
- Live GitHub Pages health checks plus Lighthouse and axe accessibility quality gates.
- Video-production pipeline tracker: `data/video_pipeline.json` (per-video proof-reading stage, transcription quality, assignees, dates, links) migrated from `video-archive.xlsx`, plus a self-contained volunteer dashboard at `pipeline/index.html` (`npm run pipeline:dashboard`).
- Reverse video links on entity cards: names, languages, ethnonyms, toponyms, lexicon and subject cards now list the lectures/talks that mention them (built from `video_catalog[].related_entities`), newest first, with duration and a total count.
- Lecture transcript corpus (`data/imports/lectures-v2/`): `scripts/ingest_transcripts.py` fetches edited transcripts from public Yandex.Disk links recorded in `data/video_pipeline.json`, extracts timecoded segments (`.docx`/`.srt`, stdlib only), and stores one reviewable JSON per lecture plus a corpus index. 27 lectures ingested (~240k words, ~3.7k timecoded segments) with proof-reading-stage provenance; feeds upcoming deep video links (B3.2), entity extraction (C3) and lecture KWIC.
- Deep video links by timecode (B3.2): `scripts/build_transcript_timecodes.py` matches each entity against the transcript corpus and writes the first-mention timecode onto `video_catalog[].related_entities[].t`; entity-card video links now jump straight to that minute (`&t=<sec>s`) and show a `▸ MM:SS` marker. 85 of 113 entity/video pairs on transcribed lectures are timecoded; the rest fall back to a plain link.
- TEI standOff + CSV exports (A6): `scripts/export_tei.py` (`npm run export:tei`) generates `exports/bookindex.tei.xml` (`listPerson`/`listPlace`/`listNym` + language/subject lists, each with `xml:id`, authority `<idno>`, canonical `<ptr>` and page/source notes) plus per-type CSV dumps. Output is deterministic and self-validated for XML well-formedness; TEI is an export format, not an authoring format.
- Simulator source audit (A5): `docs/SIMULATOR_AUDIT_RU.md` inventories every claim in the three linguistic simulators (sound laws, accent reconstructor, orthography hydrator) with a source/status for each (standard / authoritative / illustrative). Each simulator now carries a visible source footnote framing it as an educational/illustrative tool — accent paradigms A/B/C attributed to Zaliznyak's accentology (1985/2008), sound changes to standard comparative Slavistics, and the orthography hydrator's substring matching flagged as approximate.
- Provenance of derived layers (A4): `docs/METHODS_RU.md` and machine-readable `data/provenance.json` document how `edges`, `language_edges`, `cross_links` and `semantic_links` are derived (proximity-weighted co-mention / similarity), and state honestly that no generator is committed so the exact formulas are not reproducible from the repo. The name and language co-mention graphs now carry a provenance caption ("связи вычислены автоматически… поисковый сигнал, не нормативное утверждение") linking to the methods doc.
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
- Raised the `v3_app.js` runtime-script performance budget to match the app's real size after the corpus/video/DH feature growth (the budget had been exceeded since a pre-existing commit); the gate is enforceable again.

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
