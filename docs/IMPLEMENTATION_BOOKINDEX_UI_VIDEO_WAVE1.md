# IMPLEMENTATION — BookIndex UI video wave-1

_Created: 01-08-2026 · Last updated: 01-08-2026_

Parent: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)

Ordered steps. Each handoff takes a contiguous block. Do not invent URLs (D8).

---

## Step 0 — Environment

1. Work from a BookIndex worktree if concurrent sessions are likely; otherwise main tree is unguarded.
2. `npm ci` when running Playwright; without `node_modules`, rely on CI for e2e.
3. After any `app_data.json` edit: `npm run data:split` (or assemble if modules edited) and commit both.

## Step 1 — V0 catalog integrity

1. Script or one-off: list ids with `count > 1`; emit table of dropped titles after dedup.
2. Open one GitHub issue per dropped title (or one issue with checklist if >15) labeled per BookIndex conventions (`priority`, `area`, `type:bug` or data, `phase`).
3. Add validation in `scripts/validate_content.py` (or sibling guard called from `npm run check`):
   - unique `id` among rows with non-empty `url`
   - `id` equals extracted YouTube id from `url`
4. Fix any **known** correct URLs only from pipeline / prior sheets with evidence; otherwise leave survivor + issue.
5. Rebuild: `npm run build`; commit data + script + issues links in PR body.

## Step 2 — V1a a11y + honest copy

1. In `renderVideoGalleryPanel` markup: visible labels or `aria-label` for search/chapter/sort.
2. In `v3_template.html`: `:focus-visible` for `.vg-input`, `.vg-card-title`, `.vg-chip`, detail links (match viz toolbar pattern).
3. `#vg-meta` → `role="status"` `aria-live="polite"`.
4. When `vids.length === 0`: empty state + button to reset filters.
5. Rewrite intro to match reality (dates sparse; timecodes not on cards yet).
6. Default sort: prefer `title` or `dur-desc` until dated share ≥ threshold (log choice in RESULTS_LOG if threshold not specified → use title).
7. Undated meta: show «дата неизвестна» instead of blank.
8. Tests: extend `session-features` video gallery test for empty state + label presence.

## Step 3 — V1b dense list + thumbs toggle

1. CSS: `.vg-list-dense` rows (full-width, compact); keep grid as `.vg-list-thumbs`.
2. Toggle control persisted in existing storage helper if available, else `localStorage` key `bookindex.vg.thumbs`.
3. Thumbs: `https://img.youtube.com/vi/<id>/mqdefault.jpg` on `<img alt="">` decorative (title is adjacent text).
4. No stagger animations; no `transition: all`.

## Step 4 — V1c modal player

1. Add modal shell to `v3_template.html` if missing: `#video-player-modal`, player host, `#video-modal-tc-list`, close button with accessible name.
2. Implement open/close in `v3_app.js` (do **not** depend on `src/renderers/multimedia.js` unless parity-ported into `v3_app.js`).
3. Focus: move focus to close or player; Esc closes; restore trigger; background inert/aria-hidden.
4. Load iframe **without** autoplay, or YT API with `autoplay: 0` until explicit play.
5. Timecode list from `video.timecodes || []`; empty copy: «Разметка глав пока не загружена».
6. Seek only if player API available; else deep-link `?t=` external.
7. Wire gallery title click and detail primary CTA to modal; keep external link.
8. Mark `multimedia.js` as non-runtime in its file header + CLAUDE note if needed.

## Step 5 — V1d U4 harness

1. Add routes to `tests/e2e/redesign-baseline.spec.js`:
   - `#v4/materials/video` ready `#vg-list` controls including `#vg-search`
   - `#v4/materials/video/tv87ggs0yq4` ready `.video-detail`
2. Update CLEANUP roadmap U4 list **or** keep contract test reading from that section — if contract is roadmap-driven, add rows there.
3. `npm run check:redesign` when node_modules present.

## Step 6 — Publish checklist (each PR)

```text
npm run build
python runtime_test.py
python scripts/validate_content.py app_data.json
npm run check:security:static
npm run check:perf
npm run check:ui
# when deps installed:
npm run check
```

---

_Dr. Mārcis Gasūns_
