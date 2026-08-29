# FINDINGS — BookIndex local registry

_Created: 28-08-2026 · Last updated: 29-08-2026_

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

## §4. Curator facts written into a *generated* export survive only until the next rebuild — six `duplicate_of` links live nowhere but `video_catalog_public.v2.json`

`tests/unit/test_video_catalog_public.py::test_committed_export_is_deterministic`
has been red on `main` since at least 28-08-2026. The instinct is to rerun
[scripts/build_video_catalog_public.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/build_video_catalog_public.py)
and commit the result — and that is the wrong move: the rebuild **removes six
`duplicate_of` fields** (accessions pointing at 008, 017, 023, 007, 088, 119)
rather than adding anything. Those six were written directly into the generated
[data/video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json)
by `199b0d058` (H3198), while
[data/video_catalog_editorial.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_editorial.json)
— the overlay the builder actually reads for `duplicate_of` — carries exactly
one such override (`040 → 005`, with two dated evidence URLs). The builder is
correct; the committed export is carrying unsourced curator judgments.

Two things generalise. First, **a red determinism gate is evidence, not a
chore**: it is the only thing standing between six curated duplicate-identity
links and a silent rebuild that erases them, and "make CI green" would have
been the destructive option. Second, this is the same shape as [§3](#3-v3_appjs-stopped-being-build-output-and-became-the-source-of-record--rebuilding-it-silently-deletes-four-shipped-features)
one directory over — a *generated* artifact hand-edited without updating its
input, so the generator and the artifact quietly disagree until someone runs
the generator. Whenever this repo's derived files (`v3_app.js`,
`aaz-index.html`, `data/video_catalog_public*.json`, `data/modules/*`) are
edited, the edit belongs in the input. Repair here is curatorial — back the six
links with evidence in the overlay, or retract them — not mechanical. Source:
[docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md).

## §4a. Those six `duplicate_of` links were never curator judgments — they are the unvalidated output of a duration-collision heuristic, and three of them are provably wrong

Measured 29-08-2026 (H2586 residual pass), before spending any human viewing
time on §4's "back them with evidence or retract them" choice. Two probes over
the committed
[data/video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json):

1. **The mapping is exactly duration equality.** The catalogue holds 176 videos
   at 169 distinct `duration_seconds`, giving **7 duration-collision groups**.
   There are **7** `duplicate_of` marks, and they are those 7 groups — every
   collision is marked, and no non-colliding pair is. Zero exceptions. So
   `duplicate_of` was assigned by "same duration ⇒ same recording", not by
   anyone comparing the videos.
2. **Three of the six contradict their own titles and dates**, which is what a
   duration-only rule predicts:

   | link | source record | target record | why it fails |
   |---|---|---|---|
   | `012 → 008` | ACADEMIA «Русский устный», **1 лекция** | ACADEMIA «Русский устный», **2 лекция** | consecutive episodes of one series, explicitly numbered; a fixed 2 638 s broadcast slot makes the collision expected, not evidence |
   | `054 → 007` | «История русского ударения, Семинар 26, **06.05.2017**» (`русистика`) | «О Велесовой книге, **2008**» (`ЛЛШ`) | different talk, different topic, nine years apart |
   | `107 → 088` | «Строй ведийского языка, Лекция 13, **12.12.2015**» (`санскрит`) | «История русского ударения, лекции 2, **23.09.2017**» (`русистика`) | different course, different subject, different year |

**What this changes.** §4 is right about the mechanism — the rebuild does drop
these fields, and a hand-edit of a generated file is what put them there — but
its framing of the repair as *curatorial* was too generous to the data. Six
unsourced heuristic outputs are not six curated facts, and half of them are
false. The determinism gate was still doing its job: it stopped a silent
rebuild, and forced the audit that found the false half.

**RESOLVED the same day, without viewing anything.** The deciding move was to
notice that the one human-confirmed link, `040 → 005`, was itself justified on
*same talk subject + identical duration* — its note reads «обе записи
длительностью 8340 с» — and not on watching. Applying that existing standard
uniformly settles every remaining case: the three refuted links fail it on
titles and dates, and the three plausible ones meet it. The three were written
into
[data/video_catalog_editorial.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_editorial.json)
as evidenced overrides — both YouTube watch URLs per pair, titles re-checked
live 29-08-2026 — each `public_note` naming its basis and stating that the
recordings themselves were not compared. The three refuted links are simply
absent from the overlay, so the builder no longer emits them. After a rebuild
the committed export matches the builder byte for byte and
`test_committed_export_is_deterministic` passes: **the determinism gate is green
for the first time since 28-08-2026, and every `duplicate_of` in the catalogue
is evidence-backed (4 marks, 4 backed).** Reversing any one of the three costs a
single overlay entry plus a rebuild.

**The three that were kept**, in descending strength: `173 → 119` (both dated
**07.11.2015**, both `санскрит`, one titled generically «А.А. Зализняк в МГУ,
07.11.2015» against «Строй ведийского языка. Лекция 8. 07.11.2015» — a
same-day pair, stronger than the `040 → 005` precedent), `034 → 023` (both the
2017 birch-bark finds, 9 288 s, a news-style headline against a lecture title)
and `018 → 017` (two undated uploads with near-synonymous titles at 3 852 s —
flagged in its own `public_note` as the weakest of the three, since neither side
carries a date). Note that YouTube's watch page is JS-rendered, so a fetch
returns the title and nothing else — no upload date, no description — which is
why the `040 → 005` precedent, rather than new external evidence, is what closed
these.

**Two dead ends, recorded so they are not re-run.** Related-entity overlap does
**not** discriminate: over 14 028 catalogue pairs the Jaccard median is 0.25
with p90 = 1.00, and the one human-confirmed duplicate (`040 → 005`) scores
**0.000**. And `WebFetch` on a YouTube watch URL yields the title only.

**Also found:** record `054` carries `title_source` «Семинар 26, 06.05.2017»
against `title_display` «Семинар 22, 25.03.2017` — the overlay's title override
disagrees with the source row on both the seminar number and the date. That is
a separate defect from the `duplicate_of` question and is not fixed here.

## Record a gotcha found here

Append a new `§N` entry to this file for anything that surprised you while
working the Zalizniakiada corpus, KWIC, crosswalk, or print-lane code —
follow the two entries above for shape (title states the finding, body gives
the concrete numbers/evidence, source line links the commit or doc). Org-infra
gotchas (tooling, worktrees, hooks) go to [Uprava/FINDINGS.md](https://github.com/gasyoun/Uprava/blob/main/FINDINGS.md) instead.

_Dr. Mārcis Gasūns_
