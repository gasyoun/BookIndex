# FINDINGS — BookIndex local registry

_Created: 28-08-2026 · Last updated: 28-08-2026_

Repo-local gotchas from the Zalizniakiada corpus, KWIC concordance, and
video↔chapter crosswalk pipelines — neither org-infra (→ [Uprava/FINDINGS.md](https://github.com/gasyoun/Uprava/blob/main/FINDINGS.md))
nor Sanskrit-data (→ [SanskritLexicography/FINDINGS.md](https://github.com/gasyoun/SanskritLexicography/blob/master/FINDINGS.md)).
Ruling: [ASK_BATCH_STAGING_REPO_INTERCONNECTION_2026-08.md](https://github.com/gasyoun/Uprava/blob/main/ASK_BATCH_STAGING_REPO_INTERCONNECTION_2026-08.md) F1.

## §1. A book-frequency filter alone cannot fence high-frequency noise in the video↔chapter crosswalk — a head rare on the page but ubiquitous in speech swamps one chapter

The first KWIC pass linking video transcripts to book chapters filtered out
heads shorter than 4 characters and heads appearing in more than 6 chapters —
a book-side frequency filter. `говор` sits on a single book page (p. 261,
chapter 8) but is uttered in almost every transcript, so that pass alone gave
chapter 8 **144 of 263 edges**, and the lecture on Arabic drifted into
"Историческая лингвистика / ударение" instead — the same failure that had
already discredited the entity-based (`related_entities`) crosswalk, only
from the opposite direction (a head absent from a chapter's book text but
present in its speech, vs. present in speech everywhere). Fix: weight each
head by IDF over the transcript corpus (not the book), drop 41 heads that are
ubiquitous across transcripts, and derive confidence from the margin to the
second-ranked chapter. Result: chapter 8's edge share fell to 32%, chapters
carrying at least one edge went 8 → 10, and `acc001` re-assigned to `ch07`
("Арабский язык"). Fixed in the same wave that first attached any timecode to
the video catalogue. Source: [CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md) `[4.14.0]`
"Fixed"; builder: [scripts/crosswalk/](https://github.com/gasyoun/BookIndex/tree/main/scripts/crosswalk).

## §2. A curator screen that runs only on `disputed` edges lets a confident false substring match through as `auto` — the fence has to cover every status, not just the contested tier

R1 (the rule-based auto-rejector) and the DeepSeek KWIC screen both ran only
over edges the builder had already marked `disputed`. A false substring match
— Крит ⊂ санскритская ("Crete" inside "sanskritskaya") — surfaced instead as
`status: auto` with confidence 0.777 (`acc050`), so it led the candidate list
untouched by either screen. Fix: the builder itself now downgrades this class
of match to `disputed` + rank `false_match` at build time, rather than
depending on a downstream screen that never sees `auto` edges. The fix was
deliberately narrow — a broader auto-reject rule was tried against the full
v4 gold set and rejected because it would also kill a genuine curator-approved
edge, `ворог ⊂ творог` (`acc161`), which is the same substring shape with the
opposite verdict. Source: [CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md) `[4.15.0]` "Fixed".

## §3. `v3_app.js` stopped being build output and became the source of record — rebuilding it silently deletes four shipped features

[vite.runtime.config.mjs](https://github.com/gasyoun/BookIndex/blob/main/vite.runtime.config.mjs)
builds `v3_app.js` from `src/runtime/entry.js`, and the config's own comments
explain why it keeps `minify: false` and `treeshake: false`. Running that build
on 28-08-2026 produced **565.56 kB against a committed 677 875 B — 61 top-level
functions missing**: the Ctrl+K command palette (H1824), the video
gallery/detail/modal trio (H2123–H2125), the home task tile (H2127) and the
KWIC lecture rows. `src/runtime/legacy.js` was last written by `e30dc3f34`
(H1821, 30-07-2026); every feature after it went straight into the generated
artifact instead. So the generated file is now the only place those features
exist, and `src/runtime/` is a stale fork carrying 62 `legacy_*` functions
(38 KB) that no longer reach the artifact at all.

The trap this sets: every bundler-level size lever — enabling `treeshake`,
enabling `minify`, rolldown code-splitting — reads as an obvious win and would
quietly drop four features, because the size assertion in CI is the only gate
that would notice and it would read the loss as a *success*. Related: a
595-line dead-code census over the artifact itself found **0 unreferenced
top-level functions out of 489**, so there is no trim available either — the
handoff's premise was falsified by measurement, not by effort. Source:
[docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md),
[CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md) `[Unreleased]`.

## Record a gotcha found here

Append a new `§N` entry to this file for anything that surprised you while
working the Zalizniakiada corpus, KWIC, crosswalk, or print-lane code —
follow the two entries above for shape (title states the finding, body gives
the concrete numbers/evidence, source line links the commit or doc). Org-infra
gotchas (tooling, worktrees, hooks) go to [Uprava/FINDINGS.md](https://github.com/gasyoun/Uprava/blob/main/FINDINGS.md) instead.

_Dr. Mārcis Gasūns_
