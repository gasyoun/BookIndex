# Results log

_Created: 24-07-2026 · Last updated: 24-07-2026_

## H1602 — context-coverage pack drain (2026-07-24)

One stratified batch of **88** missing-context items received direct `contexts` glosses in `data/modules/*` (assembled into `app_data.json`). Editorial glosses only (house style of prior `inject_mega_pack*`); no invented page numbers; pages already present on each item.

**Model:** Grok 4.5 (`grok-4.5`) — handoff filename locked to Sonnet; user override «run».

### Before / after (`npm run content:audit` / `scripts/content_report.py`)

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Items total | 3376 | 3376 | 0 |
| With direct contexts | 816 (24.2%) | 904 (26.8%) | **+88** (+2.6 pp) |
| With effective contexts | 1091 (32.3%) | 1227 (36.3%) | **+136** (+4.0 pp) |
| Inherited effective | 275 | 323 | +48 |
| Context snippets | 2962 | 3050 | +88 |
| missing_context queue | 2285 | 2149 | −136 |
| v4.7 phase estimate | 73.7% | 80.0% | +6.3 pp |
| Effective target ≥35% | below | **met (36.3%)** | — |

### Stratified batch composition

| Entity | n | Contexts % after |
|---|---:|---:|
| lexicon | 50 | 23.9% |
| names | 12 | 85.2% |
| languages | 6 | 100.0% |
| toponyms | 6 | 92.9% |
| ethnonyms | 5 | 100.0% |
| lexicon_tech | 5 | 25.7% |
| lexicon_reverse | 4 | 2.1% |
| **total** | **88** | **26.8% direct** |

### Validation

- `python scripts/validate_content.py app_data.json` → **OK** (0 errors, 0 warnings)

### Caveats

- Snippets are editorial book-grounded glosses, not verbatim OCR quotes (full page text not in-repo for most loci).
- Technical/OCR heads (`RgH`, `Tj`, `UJ`, `ˀи`…) marked as needing source-table verification.
- Direct coverage still below the 35% *direct* aspirational band; effective coverage now clears 35%.

_Dr. Mārcis Gasūns_
