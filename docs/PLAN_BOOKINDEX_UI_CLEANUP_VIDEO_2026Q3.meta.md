# Metadoc — PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3

_Created: 01-08-2026 · Last updated: 01-08-2026_

| Field | Value |
| --- | --- |
| Purpose | Execution index for BookIndex UI cleanup + ~200-video gallery improvement (ask-batch 01-08-2026) |
| Audience | Agents executing wave handoffs; human reviewing autonomy contract |
| Provenance | `/ask-batch` scoped to BookIndex; jakubkrehel better-interface audit; interview rulings D1–D10 |
| Model | Grok 4.5 (`grok-4.5`) |
| Sibling | [PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3.md) |

## Improvement backlog

1. After V1 lands, re-run better-interface on live gallery (headed) for visual-only polish.
2. Join pipeline themes into facets when id coverage is solid.
3. Populate real `timecodes` from volunteer pipeline; re-test modal seek.
4. Fold U1–U3 cleanup phases into separate PRs once video is green.

## Limitations

- E2E not run in authoring environment (no `@playwright/test` install).
- Collision URL recovery may need human sheet for residual seminars.
- Full CLEANUP U1–U3 is staged, not fully specified at file-step depth in wave-1 IMPLEMENTATION.

## Revision history

| Date | Change |
| --- | --- |
| 01-08-2026 | Initial metadoc + plan suite from ask-batch interview |

_Dr. Mārcis Gasūns_
