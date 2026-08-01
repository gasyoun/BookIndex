# ARCHITECTURE — BookIndex video gallery + modal player

_Created: 01-08-2026 · Last updated: 01-08-2026_

Parent: [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md)

---

## Runtime ownership

| Piece | Canonical | Not canonical |
| --- | --- | --- |
| UI + routes | `v3_app.js` (`renderVideoGalleryPanel`, `renderVideoDetailPanel`, `getDedupedVideoCatalog`) | `src/renderers/multimedia.js` (stale thumbs/modal experiment) |
| Shell CSS | `v3_template.html` (`.video-gallery-*`, `.vg-*`, `.video-detail-*`) | Inline styles (forbidden) |
| Data | `app_data.json` ↔ `data/modules/99-extra.json` (via manifest ownership) | Hand-edited only `aaz-index.html` |
| Pipeline status | `data/video_pipeline.json` → `pipeline/index.html` | Re-deriving stages in UI |
| Build | `npm run build` → `aaz-index.html` | `scripts/bundle.js` as publish |

## Data model

```text
video_catalog[]:
  id          // YouTube id; UNIQUE; must match url
  title
  url         // youtube.com/watch?v=… or youtu.be/…
  date?       // ISO; often missing today
  duration    // seconds
  timecodes?  // [{ time, label }] — currently empty; modal must tolerate []
  related_entities[]  // { head, type, t?, src? }
```

**Dedup policy (D8):** Source catalog must already be unique-id (H2122 collapsed 191→175). Runtime `getDedupedVideoCatalog` still keeps one row per `id` (richest `related_entities`) as defence-in-depth. Dropped titles → GitHub `area:data` issues, not silent loss forever. CI: `validate_video_catalog` in `validate_content.py`.

**Join to pipeline:** optional by YouTube id for theme/stage badges; never block gallery if pipeline file missing.

## UI structure

```text
#v4/materials/video
  header (existing app chrome)
  h2 Видеогалерея
  intro (honest counts)
  controls: search (labeled) | chapter | sort | [optional] theme | thumbs toggle
  #vg-meta role=status
  #vg-list
    dense row (default) | card+thumb (toggle)
      title → detail hash OR open modal (V1.5)
      meta date·duration
      chips → entity routes
      external YouTube link

#v4/materials/video/<id>
  detail panel (entities + chapter overlap honesty note)
  primary: «Смотреть» opens modal
  secondary: external YouTube

modal#video-player-modal (new or revived in v3_template)
  focus trap, Esc close, restore focus
  player host (iframe no-autoplay until user gesture, or YT API)
  timecode list (empty state if none)
  prefers-reduced-motion: no decorative motion
```

## Routes & state

- Hash: `buildCanonicalHash(['materials','video'])` and `… video, id`.
- `window.currentVideoId` / `setUiCurrentVideoId` already exist.
- Modal open is UI state, not a separate hash (deeplink remains detail page).

## CSP / security

- Existing CSP: `frame-src https:`; `img-src … https:` (thumbs OK).
- No `unsafe-inline` styles; new CSS in `v3_template.html` only.
- `rel="noopener noreferrer"` on external links (already).

## Prior art (reuse)

- Dedup, backlinks, chapter overlap scoring — already in `v3_app.js`.
- Home inline video search — mirror query UX, share clamp helpers.
- U4 harness pattern — extend ROUTES array only.
- Pipeline dashboard — link, do not reimplement.

---

_Dr. Mārcis Gasūns_
