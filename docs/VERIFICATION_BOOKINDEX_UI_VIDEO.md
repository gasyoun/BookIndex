# VERIFICATION — BookIndex UI video waves

_Created: 01-08-2026 · Last updated: 01-08-2026_

Parent: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)

---

## Acceptance criteria

| Deliverable | Proof |
| --- | --- |
| V0 unique ids | `validate_content` (or new guard) fails if duplicate id or id≠url; fixture covers both |
| V0 lost titles | Open GitHub issues exist for titles dropped by survivor policy; PR links them |
| V1a labels | Playwright: `#vg-search` has accessible name; keyboard Tab shows focus ring (manual or axe) |
| V1a empty | Search nonsense string → empty state visible; reset restores cards |
| V1a live region | `#vg-meta` has `role=status` (DOM assert) |
| V1b thumbs | Default dense; toggle shows `img` thumbs without layout crash at mobile 390 |
| V1c modal | Open from gallery; Esc closes; focus returns; no autoplay on open |
| V1c empty TC | Video without timecodes shows empty message, not blank crash |
| V1d U4 | `npm run check:redesign` includes video routes; overflow/control checks pass |
| Perf/CSP | `check:perf` + `check:security:static` green after modal CSS/JS |

## Risks & spikes

| Risk | Mitigation |
| --- | --- |
| Correct URLs unknown for collision clusters | Issues only; no invented URLs (D8) |
| YT API load vs iframe | Prefer iframe first (no extra script); API only if seek required |
| Gzip budget for aaz-index | Measure `check:perf`; trim intro copy before raising ceiling |
| Dual multimedia.js confusion | Header banner + PLAN fence |
| Date-less sort | Default title (IMPLEMENTATION step 2.6) |

## Manual smoke (human, 5 min)

1. Open `#v4/materials/video` — count meta matches visible cards.
2. Filter chapter «Арабский» — list shrinks; contains арабск.
3. Open detail of known good id `tv87ggs0yq4` — modal + external link work.
4. Keyboard-only: Tab through controls, open a card, Esc modal.
5. Mobile width 390 — no horizontal scroll.

---

_Dr. Mārcis Gasūns_
