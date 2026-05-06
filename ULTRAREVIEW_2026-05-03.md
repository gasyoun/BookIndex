# BookIndex - Ultrareview & Roadmap Refresh

- Original audit date: 2026-05-03
- Refresh date: 2026-05-06
- Original auditor: Antigravity (Claude Opus 4.6)
- Refresh author: Codex
- Current base: `origin/main` @ `3e0eb931` (`Merge pull request #90`)
- Primary metric source: `python scripts/content_report.py`

---

## 1. Executive Status

BookIndex is no longer just a single-book index. It is now a small corpus platform around A. A. Zalizniak materials, with a standalone SPA, corpus metadata, cross-book occurrences, normalized entity IDs, regenerated Markdown exports, and a 424-page first-book baseline.

The active roadmap has shifted:

1. **v4.5 import pipeline is complete enough for production use.** The repository now has 3 books in the corpus, import fixtures/status files, and import tooling.
2. **v4.6 normalization is partially implemented.** `canonical_id` and `occurrences` exist for almost all entities; `aliases` remain open and cross-book duplicate candidates are now surfaced as a quality queue.
3. **v4.7 context quality is the next high-value phase.** Current progress estimate is roughly 53.7%: quality-queue workflow is done, direct context coverage remains 17.8%, and effective context coverage is 23.7% after applying `lexicon_reverse` inheritance.
4. **v4.8 video catalog remains future work.** The corpus model already reserves planned video catalog capacity, but video schema/import/search is not implemented yet.

---

## 2. Current Metrics

| Metric | Current value |
|---|---:|
| Active first book pages | 424 |
| Corpus books | 3 |
| Source types | 2 |
| Planned videos | 200 |
| Items | 3381 |
| Items with pages | 3344 (98.9%) |
| Items with contexts | 603 (17.8%) |
| Items with effective contexts | 801 (23.7%) |
| Inherited context items | 198 |
| v4.7 progress estimate | ~53.7% |
| v4.7 queue workflow | 100% |
| Items with sources | 3380 (100.0%) |
| Context snippets | 2556 |
| Markdown exports | 5525 |
| Markdown with source/book/corpus metadata | 5525 (100.0%) |
| Duplicate-head groups | 1 |
| Suspicious heads | 23 |
| Reviewed suspicious heads | 23 |
| Unreviewed suspicious heads | 0 |
| Sort inversions | 22 |
| Playwright smoke tests | 71 |
| Runtime smoke tests | 21 |

Approximate artifact sizes:

| Artifact | Current size |
|---|---:|
| `v3_app.js` | 472 KB |
| `v3_template.html` | 99 KB |
| `app_data.json` | 3.8 MB |
| `aaz-index.html` | 4.4 MB |

---

## 3. What Is Solid

### 3.1 Product Surface

- Standalone `aaz-index.html` remains the main deployable artifact.
- Hash routing has stable `#v4/...` compatibility and canonical item routes.
- Corpus pages, source panels, current-book routing, search, cards, KWIC, exports, and VIZ modules work together.
- Reading mode, scholar panels, glossary, materials, BibTeX export, PWA/offline behavior, dark theme, and responsive smoke coverage are all guarded by tests.

### 3.2 Data Pipeline

- `app_data.json` is split into modules under `data/modules/`.
- Import lifecycle exists under `data/imports/`.
- `scripts/import_source.py` provides validate/merge/status tooling.
- `scripts/normalize_entities.py` creates cross-book occurrence structure and now preserves presentation fields that the UI needs.
- `scripts/content_report.py` is the best source of truth for quality metrics.
- `scripts/validate_content.py` catches structural/content issues and is aligned with the 424-page book baseline.

### 3.3 Test And Quality Guarding

- `npm run typecheck`
- `npm run check:js`
- `npm run check:ui`
- `python runtime_test.py`
- `python scripts/validate_content.py app_data.json`
- `npm run check:e2e`

Latest known full validation before this document refresh: all major checks passed; Playwright passed 71/71. `validate_content.py` still reports known warnings: missing optional `jsonschema`, duplicate `Зализняк А. А.`, and reviewed suspicious heads in `lexicon_reverse`/`lexicon_tech`.

---

## 4. Current Issues

### 4.1 Monolithic Runtime

`v3_app.js` is still a large monolith. It is stable and well-tested, but future work would be safer if small domains are extracted gradually:

- routing/hash helpers;
- search and KWIC helpers;
- list/card rendering;
- corpus quality metrics;
- VIZ shell helpers;
- export helpers.

This remains a maintainability issue, not the highest product-value task.

### 4.2 Editorial Queue

Current report:

- 1 duplicate-head group: `names` -> `Зализняк А. А.` x2.
- 8 cross-book duplicate candidates surfaced for canonical/alias review.
- 6 page-verification candidates where `page_list` differs from occurrence/context evidence.
- 23 suspicious heads, all reviewed.
- 22 sort inversions across names, toponyms, ethnonyms, languages, and subject index.
- `lexicon_reverse` has 0.0% direct context coverage, because it is mostly a reverse/index view and needs either inherited context display or an explicit quality rule.

### 4.3 v4.6 Gaps

Implemented:

- `canonical_id`: 3380 / 3381 entities.
- `occurrences`: 3380 / 3381 entities.
- multi-source occurrence examples exist.
- source-aware cards/search/export paths are working.

Still open:

- `aliases` are not populated yet.
- cross-book duplicate candidates are now a validation/report/UI queue with 8 current candidates.
- occurrence matrix UI can be clearer and more actionable.

---

## 5. Roadmap

### Phase 0: Keep Current Main Stable

Status: active discipline.

- Keep `aaz-index.html` committed and buildable.
- Keep `#v4/...` routes backward-compatible.
- Keep the first book baseline at 424 pages.
- Keep README, UltraReview, content report, and live UI metrics aligned.
- Keep GitHub as the source of published truth: work should be pushed as branches/PRs unless explicitly local-only.

### Phase 1: v4.4 Editorial Cleanup

Status: mostly cleanup, not architecture.

- [ ] Close or reframe issue #85 as completed first corpus layer.
- [ ] Create a dedicated issue for the 23 reviewed suspicious heads.
- [ ] Resolve or explicitly accept the `Зализняк А. А.` duplicate.
- [ ] Decide whether the 22 sort inversions are true data errors or intentional grouped ordering.
- [x] Align README/content report/live metrics after the 424-page update.
- [x] Consolidate the main Playwright smoke suite at 71 tests.

### Phase 2: v4.5 Import Pipeline

Status: complete enough; now maintenance.

- [x] Import lifecycle docs and template under `data/imports/`.
- [x] `scripts/import_source.py` validate/merge/status workflow.
- [x] Corpus has more than one source; current count is 3 books.
- [x] New sources are visible in corpus source UI.
- [x] Markdown exports include source/book/corpus metadata.

Next work here should be only hardening:

- [ ] Add fixtures for import failure modes.
- [ ] Document when a draft source is allowed to become published.
- [ ] Keep import and normalization scripts preserving UI-facing fields.

### Phase 3: v4.6 Cross-Book Normalization

Status: partially implemented.

- [x] `canonical_id` generated for almost all entities.
- [x] `occurrences` generated for almost all entities.
- [x] Card/source/export paths understand occurrence-shaped data.
- [ ] Populate `aliases` for spelling variants.
- [x] Add a report section for cross-book duplicate candidates.
- [ ] Improve occurrence matrix display in cards.
- [ ] Add validation for inconsistent `head`, `display_name`, and `source_head`.

Completion criterion: a user opens one entity and can clearly see where it appears across books, with pages, source labels, and contexts where available.

### Phase 4: v4.7 Context Quality

Status: queue workflow implemented and measurable; `lexicon_reverse` inheritance policy implemented; direct data cleanup/context expansion still pending.

Current direct context coverage is 17.8%; effective context coverage is 23.7%. The next target is 35-40%.

Progress estimate: roughly 53.7%. This treats the queue workflow as complete and counts `lexicon_reverse` inherited contexts as effective coverage without copying context text into the data.

Implemented first slice:

- enriched schema 2 quality queue JSON in `tests/index-audit-queue.json`;
- `--write-quality-queue` in `scripts/content_report.py`;
- expandable actionable queues in `#v4/corpus/sources`;
- cross-book duplicate-candidate queue with 8 current candidates;
- page-verification queue with 6 current candidates;
- v4.7 progress metrics in `scripts/content_report.py`, queue JSON, and `#v4/corpus/sources`;
- effective-context policy for `lexicon_reverse` inheriting from matching `lexicon` entries;
- priority-scored `missing_context` queue and top targets for manual context entry;
- generated `tests/context-entry-pack.json` and `tests/context-entry-pack.md` with the first 25 priority targets for source-based context entry;
- smoke coverage for queue counts, expansion, navigation, and compact viewport overflow.

Priorities:

1. Start with top `missing_context` targets by priority score: `двойственное число`, `заимствование, заимствованные слова`, `иероглиф, иероглифический знак`, `калька, калькирование`, `разговорный язык, разговорная речь`.
2. Refresh `tests/index-audit-queue.json`, `tests/context-entry-pack.json`, and `tests/context-entry-pack.md` together with `npm run content:audit` before editing contexts.
3. `lexicon`: 1368 items, 12.9% with contexts.
4. `subject_index`: 92 items, 4.3% with contexts.
5. `lexicon_reverse`: inherited effective context now applies where a matching `lexicon` context exists.
6. `lexicon_tech`: 36 items, 11.1% with contexts.

Build actionable queues:

- [x] no context;
- [x] no usable source/citation;
- [x] suspicious head;
- [x] possible duplicate;
- [x] sort inversion;
- [x] needs page verification;
- [x] cross-book duplicate candidate.

Completion criterion: `#v4/corpus/sources` or a related quality view shows totals plus clickable editorial queues, so warnings can be handled without reading CI logs.

### Phase 5: v4.8 Zalizniak Video Catalog

Status: not started beyond planned count.

- [ ] Define `video_catalog` schema.
- [ ] Import CSV/JSON for roughly 200 videos.
- [ ] Store URL, title, date, duration, transcript/timecodes, linked entities, and citation.
- [ ] Link timecodes to entity cards.
- [ ] Add video hits to corpus search next to book/page hits.

Completion criterion: searching a term returns book pages and video timestamps in one corpus interface.

### Phase 6: v5 Corpus Visualizations

Status: future.

- [ ] Add book/source filters to VIZ modules.
- [ ] Add a first compare mode: term frequency by source.
- [ ] Preserve selected books/sources in URL query params.
- [ ] Show source/book labels in legends, tooltips, exports.

Completion criterion: at least one VIZ module can compare two corpus sources while viewport smoke tests remain green.

---

---

## 6. Current Progress (v5.x: Visual Mastery)

1. [DONE] **v5.0: Corpus Timeline** - Interactive vertical timeline of lectures (2005–2017).
2. [DONE] **v5.1: Lecture Analyst** - Comparison mode with overlap gauges and thematic grid.
3. [DONE] **v5.2: Zalizniak Intro** - Cinematic splash screen with stylized portrait.
4. [DONE] **v5.x Transliteration**: Standardized "Zaliznyak" -> "Zalizniak" across all modules.

---

## 7. Next Phase: v6.0 - Semantic Connectivity & Predictive Search

1. [DONE] **v6.1: Thematic Proximity Engine** - Automated cross-linking based on page co-occurrence.
2. [DONE] **v6.2: Predictive Search** - Intelligent suggestions based on semantic relationship between terms.
3. [DONE] **v6.3: Advanced Graph** - High-performance semantic network of linguistic concepts.
4. [DONE] **v6.4: Interactive Phonetic Laws** - Live demonstration of phonetic transitions.

---

## 8. Final Frontier: v7.0 - Scholarly Synthesis & AI Insights

1. [DONE] **v7.1: Scholar's Workspace** - Persistent collections and pinning for research projects.
2. [ ] **v7.2: Comparative Timelines** - Overlaying linguistic shifts with historical world events.
3. [ ] **v7.3: Semantic Search v2** - Advanced natural language query handling across the corpus.

---

## 9. Bottom Line

The project has achieved **Visual Excellence**. The foundation is audited, normalized, and stunningly represented. The next frontier is **Depth**: moving from a high-fidelity index to a true **Semantic Knowledge Base** where terms are linked by meaning and historical context, not just page numbers.
