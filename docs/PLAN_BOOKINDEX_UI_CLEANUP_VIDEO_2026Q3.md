# PLAN — BookIndex UI cleanup + video gallery (2026Q3)

_Created: 01-08-2026 · Last updated: 01-08-2026_

**Goal:** Ship a trustworthy ~200-video materials surface and finish the staged [CLEANUP_AND_UI_ROADMAP](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) chrome work without a framework rewrite, using jakubkrehel interface craft (a11y → layout → writing → type → color → polish).

**Index for execution.** Wave-1 handoffs start here.

| Layer | Doc |
| --- | --- |
| Roadmap | [ROADMAP_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/ROADMAP_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md) |
| Architecture | [ARCHITECTURE_BOOKINDEX_VIDEO_GALLERY.md](https://github.com/gasyoun/BookIndex/blob/main/docs/ARCHITECTURE_BOOKINDEX_VIDEO_GALLERY.md) |
| Implementation | [IMPLEMENTATION_BOOKINDEX_UI_VIDEO_WAVE1.md](https://github.com/gasyoun/BookIndex/blob/main/docs/IMPLEMENTATION_BOOKINDEX_UI_VIDEO_WAVE1.md) |
| Verification | [VERIFICATION_BOOKINDEX_UI_VIDEO.md](https://github.com/gasyoun/BookIndex/blob/main/docs/VERIFICATION_BOOKINDEX_UI_VIDEO.md) |
| Interface audit | [INTERFACE_REVIEW_VIDEO_GALLERY_JAKUB_SKILLS_01.08.2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/INTERFACE_REVIEW_VIDEO_GALLERY_JAKUB_SKILLS_01.08.2026.md) |
| Prior cleanup roadmap | [CLEANUP_AND_UI_ROADMAP.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) |

**Demo:** [gasyoun.github.io/BookIndex — #v4/materials/video](https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/video)

---

## Decisions taken (interview 01-08-2026)

| # | Fork | Ruling | Rationale |
| --- | --- | --- | --- |
| D1 | Wave-1 priority | **V0 catalog truth first** | 3 YouTube ids hold many distinct seminar titles; dedup drops lectures. UI on a wrong catalog is wasted. |
| D2 | Gallery visual model | **Dense research list + optional thumbs** | Scholars scan titles/meta; thumbs are a toggle, not the default. |
| D3 | Detail player | **Full modal player + timecode list** | Primary CTA becomes in-app watch; external YouTube remains fallback. |
| D4 | Timecode emptiness | **Modal shell now; timecodes when data exists** | Do not invent markers. Empty-state OK; fill from real `timecodes` / pipeline later. |
| D5 | Wave order after V0 | **V1 gallery a11y/UX → modal → U4 video routes** | Special care for the ~200 page before broader home chrome. |
| D6 | Batch scope | **Full CLEANUP roadmap staged** | Video is wave-1; U1–U3 chrome and remaining cleanup phases are wave-2+ queued handoffs. |
| D7 | Ambiguity policy | **Pick recommended default + log in RESULTS_LOG** | Unattended builds do not stall. |
| D8 | Unknown correct URL | **Keep one survivor title; open data-error GitHub issues for lost titles** | No invented URLs; human residual via Issues. |
| D9 | Palette / stack | **Keep archival brown + `v3_app.js` contract** | CLEANUP non-goals; jakub skills preserve project tokens. |
| D10 | Stale multimedia.js | **Not production source** | Production = `v3_app.js` `renderVideoGalleryPanel` / new modal; quarantine or doc-block `src/renderers/multimedia.js`. |

---

## Autonomy contract

| Topic | Rule |
| --- | --- |
| On ambiguity | Apply the recommended default in this PLAN; append one RESULTS_LOG row with the choice. |
| Stop conditions | Halt only on: publish-safety fail, secret leak, or `check:perf` / CSP regression that cannot be fixed within the handoff. |
| Commit authority | Handoff-scoped: commit → PR → merge on BookIndex when CI green. No force-push. |
| Fence | Do not rewrite to a framework; do not run `scripts/bundle.js` as publish; do not hand-edit `aaz-index.html`; do not invent YouTube URLs; do not couple H1603 landing `@DECIDE` into these PRs. |
| Data edits | `app_data.json` + `data/modules/*` must stay byte-synced (`data:split` / `data:assemble`). |
| Language | UI strings and issue bodies in Russian; code identifiers English. |

---

## Wave-1 deliverables (queued handoffs)

1. **V0** — unique video id integrity + collision survivor policy + CI guard + GH issues for lost titles.
2. **V1a** — gallery labels, focus-visible, live result count, empty state, honest intro/sort defaults.
3. **V1b** — dense list default + optional thumbs toggle.
4. **V1c** — modal player shell + timecode panel (empty-capable).
5. **V1d** — U4 redesign harness routes for gallery + detail.

Wave-2+ (staged, not wave-1 blocking): U1 home dashboard, U2 visual system tokens, U3 layout cleanup, pipeline transcript depth, materials IA labeling.

---

## Metadoc

Sibling: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.meta.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.meta.md)

_Dr. Mārcis Gasūns_
