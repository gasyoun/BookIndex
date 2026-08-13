# VERIFICATION — BookIndex UI video waves

_Created: 01-08-2026 · Last updated: 14-08-2026_

Parent: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)

---

## Acceptance criteria

| Deliverable | Proof |
| --- | --- |
| V0 unique ids | `validate_content` (or new guard) fails if duplicate id or id≠url; fixture covers both |
| V0 lost titles | Open GitHub issues exist for titles dropped by survivor policy; PR links them |
| V1a labels | `npm run check:ui-review-states` — `#vg-search` / `#vg-chapter` / `#vg-sort` have `aria-label`; axe `label`/`select-name` on `.video-gallery` |
| V1a focus ring | Same command — keyboard Tab (not `locator.focus()`) yields `outline-style: solid` and width ≥ 2px on gallery controls, first `.vg-card-title`, `.video-detail-back`, `.video-detail-yt` |
| V1a empty | Search nonsense string → `.vg-empty` visible; reset restores cards and refocuses search |
| V1a live region | `#vg-meta` has `role=status` `aria-live=polite`; text updates when the list shrinks |
| V1a honest copy | Intro keeps the sparse-date claim and does not mention in-card timecodes; default `#vg-sort` is `title`; undated cards show «дата неизвестна» |
| V1b thumbs | Default dense; toggle shows `img` thumbs without layout crash at mobile 390 |
| V1c modal | Open from gallery; Esc closes; focus returns; no autoplay on open |
| V1c empty TC | Video without timecodes shows empty message, not blank crash |
| V1d U4 | `npm run check:redesign` includes video routes; overflow/control checks pass |
| Perf/CSP | `check:perf` + `check:security:static` green after modal CSS/JS |

## Repeatable command

```text
npm run check:ui-review-states
```

Spec: [tests/e2e/ui-review-states.spec.js](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/ui-review-states.spec.js). Review screenshots land in gitignored `test-results/ui-review-states/` (same artifact contract as [tests/e2e/redesign-baseline.spec.js](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/redesign-baseline.spec.js) — not pixel baselines).

---

## H2577 — critical UI-state pass (13-08-2026)

**Route:** `#v4/materials/video` and `#v4/materials/video/tv87ggs0yq4`  
**Runtime:** `aaz-index.html` ← `v3_template.html` + `v3_app.js` `renderVideoGalleryPanel` / `renderVideoDetailPanel`  
**Prior shipping:** PR [#213](https://github.com/gasyoun/BookIndex/pull/213) (H2123 V1a); shared `:focus-visible` token later unified in H2128.

### Automated checklist (Playwright, desktop 1366×900 and mobile 390×844)

| State | What is proved | How | Result |
| --- | --- | --- | --- |
| Aria labels | Search / chapter / sort have accessible names | DOM `aria-label` + axe `label`/`select-name`/`button-name`/`link-name` | **PASS** (desktop + mobile + axe 0 violations) |
| Live status | `#vg-meta` is a polite live region and its text tracks the list | attributes + text change after search `араб` | **PASS** (desktop + mobile) |
| Live region on the AX tree | Chromium exposes `#vg-meta` as `role=status` `live=polite` `atomic` with a `StaticText` child that tracks the filter | CDP `Accessibility.getPartialAXTree` | **PASS** 14-08-2026: 176→4 on `араб` |
| Empty filter | Zero-hit search shows reset; reset restores cards and focus | `.vg-empty` / `.vg-empty-reset` | **PASS** (desktop + mobile) |
| Honest copy | Intro, default sort `title`, «дата неизвестна» | text / `select` value | **PASS** (desktop + mobile) |
| Keyboard focus ring | Tab origin produces the H2128 ring token | computed `outline` after Shift+Tab / Tab | **PASS** (search, chapter, sort, thumbs, first title, detail back, YouTube link) |
| Mobile overflow | No horizontal scroll at 390 | `scrollWidth ≤ clientWidth + 8` | **PASS** |
| Detail focus | `.video-detail-back` and `.video-detail-yt` ring | same keyboard dance | **PASS** |
| Inlined catalog | No `.vg-loading` / `.vg-error` chrome on this route | DOM count 0 + first card visible | **PASS** (named N/A, not a missing feature) |

### Manual / residual (automation cannot prove)

| Gap | Why it stays residual | What a live browser still adds |
| --- | --- | --- |
| Screen-reader *audio* of `#vg-meta` | NVDA/JAWS are not installed on this box. Narrator.exe exists but was not started (it takes over the desktop and this session cannot capture speech). The API those engines read **was** checked 14-08-2026 | A human ear on NVDA/Narrator is the only remaining speech check; engineering no longer blocks on it |
| Visible ring *colour* against the archival cream | Computed style proves width/style; contrast of `--focus-ring-color` vs card surface is a headed-eyeball check | Tab through controls on a real display (and, if desired, Windows High Contrast) |
| Print | There is **no** `@media print` rule in [v3_template.html](https://github.com/gasyoun/BookIndex/blob/main/v3_template.html). Print is not a V1a deliverable | Not applicable until a print stylesheet exists |
| Gallery loading / error chrome | Catalog is inlined in `aaz-index.html` (`APP_DATA`). The gallery has no `.vg-loading` / `.vg-error` path to exercise | Not applicable on this route. App-boot failure is a different surface (`[app-data] Boot failed`) |
| Modal keyboard (V1c) | Out of H2577 / PR #213 scope; owned by H2125 | Still the 5-minute smoke item 4 below |

### Browser notes (this pass)

`npx playwright test tests/e2e/ui-review-states.spec.js` — **12 passed** in 33.2 s (chromium, headed-off). Review clips in gitignored `test-results/ui-review-states/` were opened and read in this session; static HTML snapshots were **not** treated as proof of focus or responsive behavior.

- Desktop controls: search, «все главы книги», **«по названию»**, unchecked «Превью» in one row.
- Mobile 390 controls wrap (search full-width, then chapter, then sort + preview). No clipped control and no horizontal scroll in the clip.
- Empty state (desktop and 390): «Ничего не найдено по заданным фильтрам.» + «Сбросить фильтры» button, no leftover cards.
- Keyboard ring is a 2px solid brown outline on `#vg-search`, the first `.vg-card-title` («21.07.2010, Новгород, берестяная грамота № 1000»), and «← К видеогалерее». The ring is visible against the cream field; colour-contrast vs every chip surface was not measured.
- Dense list default is intact (no thumbs in the gallery-top clips).

### Live-region AX pass (14-08-2026)

`npx playwright test tests/e2e/ui-review-states.spec.js -g "Chromium AX tree"` — **1 passed**. Chromium CDP `Accessibility.getPartialAXTree` (what Narrator / NVDA / JAWS consume via the platform API):

| Moment | role | live | relevant | atomic | ignored | Accessible name | Spoken child (`StaticText`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| After load | `status` | `polite` | `additions text` | true | false | empty (normal for `status`) | Показано 176 из 176 видео. |
| After search `араб` | `status` | `polite` | `additions text` | true | false | empty | Показано 4 из 176 видео. |

Empty accessible **name** is expected: `role=status` is named from contents. The spoken payload is the `StaticText` child, which changed with the filter. That is the live-region contract. NVDA was not on PATH; Narrator was not launched.

---

## Risks & spikes

| Risk | Mitigation |
| --- | --- |
| Correct URLs unknown for collision clusters | Issues only; no invented URLs (D8) |
| YT API load vs iframe | Prefer iframe first (no extra script); API only if seek required |
| Gzip budget for aaz-index | Measure `check:perf`; trim intro copy before raising ceiling |
| Dual multimedia.js confusion | Header banner + PLAN fence |
| Date-less sort | Default title (IMPLEMENTATION step 2.6) |
| `locator.focus()` false-pass on the ring | Spec uses keyboard Tab; documented in the spec header |

## Manual smoke (human, 5 min)

1. Open `#v4/materials/video` — count meta matches visible cards.
2. Filter chapter «Арабский» — list shrinks; contains арабск.
3. Open detail of known good id `tv87ggs0yq4` — modal + external link work.
4. Keyboard-only: Tab through controls, open a card, Esc modal.
5. Mobile width 390 — no horizontal scroll.

---

_Dr. Mārcis Gasūns_
