# Metadoc — PLAN_BOOKINDEX_UI_CLEANUP_VIDEO_2026Q3

_Created: 01-08-2026 · Last updated: 12-08-2026_

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
| 10-08-2026 | Wave-1 complete: H2123 (V1a), H2124 (V1b), H2125 (V1c modal + timecodes, PR [#250](https://github.com/gasyoun/BookIndex/pull/250), [v4.11.5](https://github.com/gasyoun/BookIndex/releases/tag/v4.11.5)), H2126 (V1d U4 routes) all shipped. Next front is wave-2 (U1–U3). |
| 12-08-2026 | Wave-2 U1 shipped (H2127, Opus 5): 4th home task tile «Смотрю указатель целиком» + showcase demoted below routes/recents + `#home-tasks-grid` in the U4 home gate. Prior art found mid-execution: B4 (13-06-2026, commit [3014d6b8](https://github.com/gasyoun/BookIndex/commit/3014d6b8347ad83576b51ea611edb48eede5f7f2)) had already delivered three of the four task tiles, and H2125 had already routed home video search in-app — so U1 was a **gap-fill**, not a build-from-zero. Remaining wave-2: H2128 (U2/U3 shared chrome). |

_Dr. Mārcis Gasūns_
