# Toponym map lane — H4051 audit: measured baselines and MG-facing metrics

_Created: 04-09-2026 · Last updated: 04-09-2026_

H4051 (MG rev 11: «алгоритм распределяет надписи равномерно по площади и уносит их далеко от точек привязки») arrived as a build order for two new variants. The audit below found the proposed B9a **geometrically unsatisfiable as gated** and the lane's gates blind to the criteria MG actually judges. MG ruled 04-09-2026: amend, measure first, then build one variant on real metrics. This doc is the measurement record; the numbers live on in `print/toponyms-map-report.json` (`mg_metrics`) and as green rows on [toponyms-map-versions.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-versions.html).

## Why four variants in a row were rejected despite green gates

B5, B6, B7 shipped all gates green and were rejected; B8 awaited review with the same property. The gates measure the **placer's own bookkeeping** (did my collision loop report a collision?). MG judges **leader-line count, distance from dot, names silently missing, crowding at print size** — none of which was measured anywhere in the pipeline until this pass.

## Measured baselines (before this pass)

- **Leader/stub lines on the shipped B8 map SVG**: 93 line elements (64 chip-displacement stubs + ~29 label leaders) + 1 inset refLine. First counted by scraping `toponyms-map-b8-map.svg`; the new `links_drawn` counter reports 94 for B8map (the difference is the refLine, previously uncounted). MG's «выносные линии» are real and now a first-class number.
- **True-dot geometry** (83 groups re-projected on the B-frame, 129×186 mm): **46 pairs sit closer than 2 mm**, tightest Италия↔Рим at **0.08 mm**; 20 chips inside a 7 mm radius around «Русь [древняя]». A minimum-removal estimate says **22 of 83 groups must leave the frame** to reach 2 mm separation — 8 of them `discussed`, so they cannot be dropped. This is why B9a's «касание допустимо + d >= 2 mm + все точки на местах» was over-determined: no placement satisfies all three.
- **B8's own stats decomposed**: 63 name candidates → **38 drawn, 25 silently not drawn**; only **13 within the 10 mm true-place budget**. The variant named for atlas accuracy achieves it for 21% of its labels. The old gate `labels_deferred > 55` could not fail (63 candidates max).
- **Scale of the data, not the solver, is the root cause**: the dataset carries no feature-scale field, so «Италия», «Апеннинский полуостров», «Рим» or «Ростово-Суздальская земля», «Ростов», «Суздаль», «Владимир» are indistinguishable point classes at world scale. Cartography's standard answer is scale-dependent selection (world sheet draws regions; the existing Rus inset draws cities) — needs a `scale_rank` column, human-reviewed.
- **The relaxer is MG's complaint in code**: 500 iterations of pure repulsion (no attraction term), then the *total* displacement vector is capped afterwards — «распределяет равномерно, потом притягивает обратно». The fix (flag-gated, next unit) is clamping inside the loop: converge to «as near true as separation allows».

## What this pass changed (all additive; every frozen `.svg` byte-identical)

1. **MG-facing metrics on every sheet** (`links_drawn` by kind, `max_link_mm`, `names_requested/drawn/not_drawn`, `names_at_true_place`, `label_offset_p50/p90/max_mm`, `chip_ink_overlap_*`), centralised link accounting behind `countLink()` at all seven line-emitting sites, and the same numbers rendered as green rows on the versions page.
2. **Gates now measure the rectangle the placer reserved** (`rect` handed back from `placeLabel`/`placeLabelTrue` instead of a re-derived one-line formula that was wrong for upward multi-line labels — the two-line stacks B8 introduced). Verified: on the shipped sheets the corrected measurement reproduces the old verdicts exactly (0 escapes / 0 violations everywhere) — the bug was latent, not active.
3. **NaN guard**: a sheet whose output contains `NaN`/`Infinity` now refuses to write, instead of shipping the literal string (the file-level fail criterion finally has a mechanism).
4. **Name-order ruling applied where it was broken**: the rule is **oldest attested form first** (MG 04-09-2026). The map stacks («Варанаси» over «Бенарес», «Шри-Ланка» over «Цейлон») were already correct; the *rule comment* and the *legend* were wrong (legend joined alphabetically). Legend rows now follow `NAME_ORDER_OLDEST_FIRST` on sheets that opt in; frozen legends keep their bytes; `display_order_conflicts: 2` tracks the residue.
5. **Weight fix**: wrapper pages (`*-print.html`, review pages, versions page) reference sheets via `<img src>` instead of inlining them — 99.1% of a map SVG is the Natural Earth land path, previously stored 4× per variant. `print/` **237.9 → 80.6 MB**; `toponyms-map-versions.html` **63.8 MB (GitHub warns >50 MB) → 9.2 KB**; published Pages site **~836 → ~678 MB** against the 1 GB limit. D1 is extracted once from tag `v4.17.7` into frozen `d1-*.svg`. Cost: HTML is no longer a detached single file — MG reviews via gasyoun.github.io URLs, so nothing is lost here.
6. **CI**: `npm run print:toponyms:check` (regenerate + `git diff --exit-code -- print/*.svg`, with the generator's own hardFail gates inside) wired as a CI step, matching the repo's five existing regenerate-and-diff gates; both print scripts in `check:js`.
7. **Collation pin**: group order (hence the 1..83 numbering, hence every byte) is owned by `localeCompare(…, "ru")`, which is ICU-version dependent. A drifted order now fails loudly against `RU_COLLATION_SHA = 42b3a8abe09d1ac8` instead of silently renumbering the book on another box.

## The variant scorecard this buys MG

From `mg_metrics` (map sheets; «в бюджете 10 мм» = labels within the true-place budget):

| sheet | выносных линий | подписей | не нарисовано | в бюджете 10 мм | p50/p90 отступ, мм |
|---|---|---|---|---|---|
| A (v4.17.5) | 53 | 37/37 | 0 | 17 | 18.5 / 49.4 |
| B (v4.17.5) | 51 | 28/28 | 0 | 16 | 24.0 / 58.3 |
| B2 (v4.17.10) ★ | 39 | 28/28 | 0 | 22 | 2.0 / 15.9 |
| B3 (v4.17.16) | 32 | 22/22 | 0 | 16 | 6.6 / 17.1 |
| B4 (v4.17.19) | 39 | 20/20 | 0 | 13 | 6.9 / 17.1 |
| B5 (v4.17.21) | 96 | 37/37 | 0 | 17 | 13.2 / 28.0 |
| B6 (v4.17.22) | 79 | 23/23 | 0 | 11 | 13.2 / 25.2 |
| B7 (v4.17.23) | 92 | 43/65 | 22 | 19 | 12.2 / 21.5 |
| B8 (v4.17.24) | 94 | 38/63 | 25 | 13 | 13.2 / 23.8 |

Caveat for honesty: B2/B3 label only discussed names (22–28), B7/B8 attempt 63–65 including mentioned ones — the offset comparison is not apples-to-apples on coverage. What **is** clean: B7/B8 draw ~2.5× more lines than B2/B3 while naming less of the map per unit of ink, and the lane's median label offset has moved *away* from dots since B2 — the drift MG has been feeling since rev 8.

## Residuals / next units (amended H4051 scope)

- Relaxer fix: clamp displacement inside the loop + free-space tie-break (flag-gated).
- `scale_rank` on `data/modules/11-toponyms.json` (98 mechanical classifications, human-reviewed): world sheet draws regions, Rus inset draws cities.
- Then ONE B9 variant, gated on `links_drawn` + offset percentiles, not on `chip_close_pairs`.
- `@DECIDE` for MG: unfreeze `b8-legend` to apply oldest-first order (2 rows), and delete the orphaned D2 wrappers `toponyms-map-d.html` / `toponyms-map-d-print.html` (stale committed output, no longer regenerated; the versions page covers №5 from the frozen `d-*.svg`).

_Dr. Mārcis Gasūns_
