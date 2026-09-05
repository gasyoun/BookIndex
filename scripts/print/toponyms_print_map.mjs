// Print-ready vector toponym map for the Zaliznyak book companion.
// H3996 - renders THREE print sheets from data/modules/11-toponyms.json
// + vendored Natural Earth land TopoJSON:
//   A  print/toponyms-map.svg            spread 290x215, map + full-height side legend column
//   B  print/toponyms-map-b-map.svg      page 145x215, map only
//      print/toponyms-map-b-legend.svg   page 145x215, legend only (facing page)
//   C  print/toponyms-map-c.svg          spread 290x215, east main map + West-Europe inset
//   D  print/toponyms-map-d-map.svg      page 145x215, TWO-PANEL chips-only page
//      (D2, MG 03-09-2026 rev 2): dense zoom "Русь и Западная Евразия" on top,
//      world overview locator at the bottom; every group numbered, chips live
//      on exactly ONE panel;
//      print/toponyms-map-d-legend.svg   page 145x215, compact 2-column legend (all groups).
//      Every D sheet carries a visible version stamp (D_STAMP) - MG refers to
//      versions in feedback; removed before print.
// Offline, deterministic, no npm deps (d3 + topojson-client are vendored UMD bundles).

import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const d3 = require("../../vendor/d3.v7.min.js");
const topojson = require("../../vendor/topojson-client.min.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "print");

const U = 4;
// H4051: sha256(first 16) of the ru-collated group order (see loadGroups).
// Pinned on Node v24.15.0 / full ICU, 04-09-2026, 83 groups.
const RU_COLLATION_SHA = "42b3a8abe09d1ac8";
const SPREAD_W_MM = 290;
const SPREAD_H_MM = 215;
const PAGE_W_MM = 145;
const PAGE_H_MM = 215;

const MAP_BOX_A = { x0: 8, y0: 15, x1: 208, y1: 195 };
const MAP_BOX_B = { x0: 8, y0: 20, x1: 137, y1: 198 };
const INSET_BOX_C = { x0: 8, y0: 16, x1: 64, y1: 78 };

// full-height side legend column (sheets A and C): the whole numbered legend
const SIDE_X0 = 212;
const SIDE_X1 = 283;
const SIDE_TITLE_Y = 19;
const SIDE_NOTE1_Y = 25;
const SIDE_NOTE2_Y = 30;
const SIDE_ROWS_Y = 34;
const SIDE_ROWS_Y1 = 206;
const SIDE_FONT_U = 10;
const SIDE_PITCH_U = 11.5;
// full-page legend (sheet B right page): 2 columns, large type, fills the page
const PLEG_HEADER_Y = 20;
const PLEG_NOTE_Y = 27;
const PLEG_ROWS_Y = 34;
const PLEG_Y1 = 196;
const PLEG_X0 = 8;
const PLEG_X1 = 137;
const PLEG_COLS = 2;
const PLEG_FONT_U = 11;
const PLEG_PITCH_U = 17;

// sheet D3 (MG 03-09-2026 rev 3): two-panel chips-only page. The dense zoom
// grows to North Africa + Murmansk/Kola (lat 25-68, lon -10-55); Центральная
// Африка stays on the overview and the zoom shows its chip at the frame's
// south edge with a leader-arrow running to the true (off-frame) spot. Every
// group is numbered and lives on EXACTLY ONE panel (the pointer chip excepted,
// it mirrors the overview). Versioned URLs: this revision writes d3-* files,
// older URLs stay frozen. D_STAMP = visible version stamp, removed before print.
const D_DENSE_BOX = { x0: 8, y0: 20, x1: 137, y1: 150 };
const D_DENSE_GEO = { lat0: 25, lat1: 68, lon0: -10, lon1: 55 };
const D_OVER_BOX = { x0: 8, y0: 154, x1: 137, y1: 196 };
const D_DENSE_CAPTION = "Русь, Европа и Северная Африка · крупный план";
const D_OVER_CAPTION = "Обзор: Африка, Азия и Атлантика";
const D_STAMP = "вариант D3 · v4.17.9 · 03-09-2026";
const DLEG_HEADER_Y = 20;
const DLEG_NOTE_Y = 26;
const DLEG_ROWS_Y = 32;
const DLEG_Y1 = 190;
const DLEG_X0 = 8;
const DLEG_X1 = 137;
const DLEG_COLS = 2;
const DLEG_FONT_U = 8.4;

// sheet B2 (MG 03-09-2026 rev 4): variant B with labels at their true places -
// name-only labels (pages moved to the legend), CIS anchors retired, label
// displacement capped at ~10 mm with a last-resort diagonal at ~14 mm, frame
// grows to 206 mm; the legend page carries ALL 83 entries at compact density
// (discussed marked ●, chip numbers 1..46 unchanged). Versioned URL: writes
// b2-* files, older URLs stay frozen. Stamp removed before print.
const B2_MAP_BOX = { x0: 8, y0: 20, x1: 137, y1: 206 };
const B2_INSET_BOX = { x0: 73, y0: 128, x1: 137, y1: 196 };
const B2_STAMP = "вариант B2 · v4.17.10 · 03-09-2026";
const B2_LABEL_RINGS = [0, 8, 16, 24, 32, 40, 48];

const PAD_FRACTION = 0.09;const LABEL_FONT_U = 11.2;
const INSET_LABEL_FONT_U = 8.5;
const LEGEND_FONT_U = 9.9;
const LEGEND_ROW_H = 11.6;
const CHAR_W = 0.64;
const MAX_LABEL_LINES = 5;
const RELAX_GAP = 4.5;
const RELAX_ITERATIONS = 500;
const DISPLACE_CAP = 88;

const LINE_DASH = { west: null, east: "4.4 2.6" };
const WEST_CAPTION = "Западная Европа · врезка";

// sheet B3 (MG 03-09-2026 rev 5): B2 with the DENSEST cluster (Rus core)
// pulled into a FULL-WIDTH magnifier strip below the main map - every legend
// number reads without overlap. Inset members render ONLY in the strip
// (west-style); main map keeps the sparse rest; chip circles and dots are
// registered as obstacles so name labels can never cover numbers (gate:
// label-chip gap >= 1.5 mm). The dense zone is marked on the main map with a
// thin "см. врезку" rectangle. Versioned URL: writes b3-* files, older URLs
// stay frozen. Stamp removed before print.
const B3_MAP_BOX = { x0: 8, y0: 20, x1: 137, y1: 144 };
const B3_INSET_BOX = { x0: 8, y0: 146, x1: 137, y1: 196 };
const B3_INSET_GEO = { lat0: 50, lat1: 60.5, lon0: 12, lon1: 68 };
const B3_INSET_PAD = 0.06;
const B3_INSET_CHIP_R = 6.5;
const B3_INSET_CHIP_FONT = 6.8;
const B3_INSET_CAPTION = "Русь · крупный план";
const B3_STAMP = "вариант B3 · v4.17.16 · 04-09-2026";

// sheet B4 (MG 04-09-2026 rev 6): the Rus-core magnifier becomes an OVERLAY
// inset above Africa's right edge, over India (covering India is accepted) -
// full-height main map restored. Inset = NUMBERS ONLY (the core's numbered
// chips magnified); core discussed names stay at their true places on the
// main map. Chips/labels covered by the overlay relocate below its edge with
// stub leaders toward the covered true spots. Versioned URL: writes b4-*
// files, older URLs stay frozen. Stamp removed before print.
const B4_MAP_BOX = { x0: 8, y0: 20, x1: 137, y1: 206 };
const B4_INSET_BOX = { x0: 84, y0: 98, x1: 136, y1: 142 };
const B4_INSET_GEO = { lat0: 50, lat1: 60.5, lon0: 12, lon1: 41 };
const B4_INSET_PAD = 0.06;
const B4_INSET_CHIP_R = 6.5;
const B4_INSET_CHIP_FONT = 6.8;
const B4_INSET_CAPTION = "Русь · крупный план";
const B4_STAMP = "вариант B4 · v4.17.19 · 04-09-2026";

// sheet B5 (MG 04-09-2026 rev 7): ZOOM IN - the main map crops everything
// south of lat 26 (only the very top of Africa stays: Morocco, Egypt); main
// scale grows so every number reads on the map itself. ALL groups are
// numbered chips now (filled = discussed, outline = mentioned; naked dots
// abolished). The 5 southern groups sit in an edge row at the frame bottom
// with arrows toward their true directions. A Kiev-triangle loupe (~14x) sits
// in the empty NE corner. Versioned URL: writes b5-* files, older URLs stay
// frozen. Stamp removed before print.
const B5_FIT_LAT_MIN = 26;
const B5_LOUPE_BOX = { x0: 98, y0: 20, x1: 137, y1: 49 };
const B5_LOUPE_GEO = { lat0: 49.8, lat1: 51.8, lon0: 29, lon1: 33.5 };
const B5_LOUPE_PAD = 0.06;
const B5_LOUPE_CAPTION = "Киев и окрестности · лупа";
const B5_STAMP = "вариант B5 · v4.17.21 · 04-09-2026";

// sheet B6 (MG 04-09-2026 rev 8): the 3-element Kiev-triangle loupe DIES; the
// inset instead magnifies the REAL dense core - «Русь · Киев → Новгород»
// (lat 50-60.5, lon 27-41, ~10 discussed groups), over the empty NE corner.
// Core groups stay on the main map as numbered chips (mirror) and gain
// readable NAMES inside the inset. Every other discussed name renders ONLY in
// a clean slot - last-resort placement is abolished for this sheet (B5's 19
// forced overlaps were the defect MG flagged), groups without a clean slot
// stay numbered chips (the legend decodes them). Southern groups render ONLY
// in the edge row (no more leaked in-frame names + double chips). All new
// behavior is flag-gated (insetMirror / insetChipDiscussed / cleanSlotsOnly /
// southernEdgeOnly) so the frozen b5-* outputs stay byte-identical.
// Versioned URL: writes b6-* files, older URLs stay frozen.
const B6_CORE_GEO = { lat0: 50, lat1: 60.5, lon0: 27, lon1: 41 };
const B6_CORE_BOX = { x0: 82, y0: 20, x1: 137, y1: 66 };
const B6_CORE_PAD = 0.06;
const B6_CORE_CAPTION = "Русь · Киев → Новгород";
const B6_STAMP = "вариант B6 · v4.17.22 · 04-09-2026";

// sheet B7 (MG 04-09-2026 rev 9): ATLAS-ACCURACY pass on the FULL WORLD (the
// B5/B6 crop is dead - Africa and India render properly, no edge row, no
// callout stubs). Principles MG asked to adopt from lingtypology (HSE): one
// point = one object, the label lives AT the feature, print-grade static
// render. Mechanics (all flag-gated, frozen sheets byte-identical):
//   - truePlace: name labels are sampled on a fine 1 mm ring around the TRUE
//     dot (not the relaxed one) with a HARD 10 mm cap - a label either sits in
//     the dot's neighborhood or not at all (the numbered chip + unified legend
//     carry it). This is why Украина/Пруссия/Марокко/Пелопоннес/Балканы/etc.
//     now sit at home "at no cost".
//   - nameMentioned: mentioned groups get names too where a clean slot exists
//     (Китай, Индия, Цейлон... - free-space regions).
//   - pairMerge: Литва (55.17,23.88) + Великое княжество Литовское (55,25) are
//     1 deg apart - ONE combined label anchored between the two true dots
//     (render-level pairing, data untouched).
//   - displaceCap 8 mm: chips stay close to their true spots (was 22 mm).
//   - unified numbering: map AND legend use the same 1..83 row (legendNumberAll),
//     discussed rows keep the ● marker - «13» на карте = «13» в легенде.
//   - inset in the SE corner (over the empty Indian Ocean, MG choice) with
//     insetRelax: chips spread with leader stubs (no more 82-over-67), the
//     caption lives in a FRAMED title bar on the inset frame
//     (insetCaptionFramed), and refRect + refLine show WHERE the zoom comes
//     from (dashed box around lat 50-60.5 / lon 27-41 + a connecting line).
// Fallback documented (MG): moving the inset to the legend page was rejected -
// the legend is already dense and its fonts would shrink.
const B7_INSET_GEO = { lat0: 50, lat1: 60.5, lon0: 27, lon1: 41 };
const B7_INSET_BOX = { x0: 58, y0: 152, x1: 104, y1: 200 };
const B7_INSET_PAD = 0.06;
const B7_INSET_CAPTION = "Русь · Киев → Новгород";
const B7_STAMP = "вариант B7 · v4.17.23 · 04-09-2026";
const B7_LABEL_CAP_U = 40; // 10 mm hard neighborhood for name labels
const B7_TRUE_RING_STEP = 4; // 1 mm sampling step
const B7_PAIR_MERGE = [
  ["Литва", "Литовское княжество Великое"],
];

// sheet B8 (MG 04-09-2026 rev 10): AIR + reading-order pass on B7 (11 points).
// All flag-gated, frozen b7-* byte-identical:
//   - air: label-label pad 2.5 -> 3.2, chip-obstacle pad 9 -> 10, chip relax
//     gap 4.5 -> 5.5, inset pad 6% -> 14% and the inset box grows wider and
//     higher - «воздуха везде надо больше, особенно там, где это дёшево»;
//   - historical name FIRST, modern in the tail (points 2, 5, 6): merged pair
//     reads «Литовское княжество Великое · Литва», stacks render «Шри-Ланка»
//     over «Цейлон» and «Варанаси» over «Бенарес»;
//   - explicit two-line stacks (points 5, 6, 8, 9): арабские/страны,
//     Центральная/Африка stay on their land instead of spilling into the sea;
//   - per-name direction biases tried first (points 1, 4, 7, 8):
//     Архангельская область -> right of Кольский, РФ · Россия -> lower and
//     further right, Украина -> NE (above Кавказ), арабские страны -> west;
//   - pairs kept together (points 3, 10): «Британия · Англия»,
//     «Германия · ГДР» join the merge list, historical name first.
const B8_INSET_BOX = { x0: 54, y0: 148, x1: 106, y1: 202 };
const B8_INSET_PAD = 0.14;
const B8_STAMP = "вариант B8 · v4.17.24 · 04-09-2026";
// sheet B9 (MG 04-09-2026, «строим B9 по новой метрике»): the lines-free pass
// measured, not guessed. Chips may TOUCH (relax gap 0) instead of B8's 4.6 mm
// air - probe: median drift 3.7u vs 10.8u, only 3 chips drift past the 16u
// stub threshold (B8: 58 stubs). Leaders follow MG's tier rule: none within
// 10 mm of the true dot, second tier (10-25 mm) tied. The inset source is a
// HATCHED square with an arrow from the inset frame; the framed caption bar
// is reserved before chip fitting. Legend opts into oldest-first name order.
const B9_STAMP = "вариант B9 · v4.17.29 · 05-09-2026";
// sheet B10 (H4051 Unit B, the draft scale_rank applied): identical to B9
// except city-rank groups outside the Rus inset render as numbered chips
// WITHOUT names - the mixed-scale co-location (Рим 0.08 mm from Италия, Фест
// 0.23 mm from Крит) leaves the name-placement arithmetic entirely. The
// classification (8 macro / 56 region / 19 city) is the DEFAULT MG will
// review visually; the table lives in
// docs/TOPONYM_SCALE_RANK_DRAFT_2026-09-04.md.
const B10_STAMP = "вариант B10 · v4.17.29 · 05-09-2026";
const B8_LABEL_PAD_U = 3.2;
const B8_CHIP_OBSTACLE_PAD_U = 10;
const B8_RELAX_GAP_U = 5.5;
// display = OLDEST ATTESTED FORM first (MG ruling 04-09-2026, restated at
// H4051 audit). The rev-10 comment called this "historical first, modern
// tail", which reads as a contradiction of the stacks below - Варанаси and
// Шри-Ланка look "modern" but are the older names: Бенарес is the colonial
// derivative of Vārāṇasī, Цейлон the Portuguese-Dutch form beside the
// Rāmāyaṇa-era Laṅkā. Under "oldest first" the shipped stacks and pairs are
// all correct; it is the rule statement that was wrong.
const B8_PAIR_MERGE = [
  ["Литовское княжество Великое", "Литва"],
  ["Британия", "Англия"],
  ["Германия", "ГДР"],
];
const B8_LABEL_STACKS = new Map([
  ["Цейлон · Шри-Ланка", ["Шри-Ланка", "Цейлон"]],
  ["Бенарес · Варанаси", ["Варанаси", "Бенарес"]],
  ["арабские страны", ["арабские", "страны"]],
  ["Центральная Африка", ["Центральная", "Африка"]],
]);
// H4051: the LEGEND joins a group's names alphabetically, so it prints
// «Бенарес · Варанаси» while the map stack above prints «Варанаси / Бенарес» -
// map and legend disagree on name order for the same row. This map is the
// oldest-first ruling in legend form; sheets opt in with cfg.displayOrder so
// the eleven frozen legends stay byte-identical. `display_order_conflicts` in
// the report counts the rows still disagreeing, so the defect is a tracked
// number rather than prose.
const NAME_ORDER_OLDEST_FIRST = new Map([
  ["Бенарес · Варанаси", "Варанаси · Бенарес"],
  ["Цейлон · Шри-Ланка", "Шри-Ланка · Цейлон"],
]);
// exact label offsets from the TRUE dot in units (tried first) - the spots
// MG named in rev 10 points 1, 4, 7, 8
const B8_LABEL_BIAS = new Map([
  ["Архангельская область", [144, 12]],
  ["Российская Федерация · Россия", [48, 32]],
  // Украина: the «именно над Кавказом» spot sits behind a wall of chips -
  // shortest honest leader is ~32+ mm (a вынос MG rejects), so the label
  // keeps its nearest clean slot; flagged in the rev 10 report
  ["арабские страны", [-24, 0]],
]);

// B10 rev 12 (MG 04-09-2026, six points): label biases CLONED from B8's so
// the frozen sheets keep their bytes. Measured fixes: Архангельская область
// vanished on B10 (the B8 bias [144,12] landed on an occupied slot and the
// label deferred - that is why MG repeated the request); it now sits RIGHT of
// Кольский полуостров. Швеция moves right toward Scandinavia. Шри-Ланка ·
// Цейлон goes BELOW the island, clear of physical India. Германия · ГДР goes
// LEFT near Франция instead of east toward РФ.
const B10_LABEL_BIAS = new Map(B8_LABEL_BIAS);
// H4110 (MG 05-09-2026, fourth ask): the rev-12 note above declared the
// «справа от Кольского» spot impossible and left the wish as a residual -
// that is exactly why it kept returning every render. MG ruled the
// arrangement explicitly (Кольский right, Архангельская next to it right,
// Финляндия below Кольский), so the three north-Russia labels are PINNED
// (NORTH_LABEL_PINS) instead of re-derived; the [144,12] bias row is
// superseded and deleted in the B9/B10 clones.
B10_LABEL_BIAS.delete("Архангельская область");
// H4110 v2: same RF-bias supersede as B9 (see there) - the label is pinned.
B10_LABEL_BIAS.delete("Российская Федерация · Россия");
B10_LABEL_BIAS.set("Швеция", [81, -73]);
B10_LABEL_BIAS.set("Цейлон · Шри-Ланка", [6, 24]);
B10_LABEL_BIAS.set("Германия · ГДР", [-92, -54]);
// H4109: B9 does not carry B10's scaleRankedNames/tightUpwardBoxes, so its
// obstacle field differs - offsets are re-derived per-label with
// H4051_DEBUG=1, NOT copied blindly from B10 (MG scope ruling).
const B9_LABEL_BIAS = new Map(B8_LABEL_BIAS);
B9_LABEL_BIAS.delete("Архангельская область"); // H4110: superseded by NORTH_LABEL_PINS
// H4110 v2: РФ's 2-line bias box [48,32] hung over the corridor the
// Архангельская pin now occupies; the label is PINNED instead
// (NORTH_LABEL_PINS) and the bias row is superseded here.
B9_LABEL_BIAS.delete("Российская Федерация · Россия");
B9_LABEL_BIAS.set("Швеция", [81, -95]);
B9_LABEL_BIAS.set("Цейлон · Шри-Ланка", [6, 24]);
B9_LABEL_BIAS.set("Германия · ГДР", [-92, -54]);
// H4110 (MG 05-09-2026, fourth ask): the north-Russia arrangement is PINNED.
// Кольский returns right of the peninsula (the B8-approved slot, box
// 315..451 × 338..352), Архангельская область sits next to it to the right
// as a two-line stack (fits the frame where the 37.5 mm one-liner never
// could), Финляндия goes below Кольский. Offsets are from the TRUE dot in
// bias units; slots measured chip-free and identical on B9/B10. Pins are
// RESERVED before the label walk (fail-loud on frame/clash), so no re-flow
// can silently re-derive them - the «Кольский переехал левее» regression
// class dies here.
// H4144 (MG 05-09-2026, ruling verbatim: «Глобальный решатель»): the
// fifth-round cluster IS pinned and the new globalPlace pass hill-climbs
// every other label so the greedy cascade never happens. Pin values derive
// from the LABELDOT dump: text_y = dot_y + dy + 0.34*lineH (lineH 13.664).
// Кольский/Финляндия back at the v1 heights (spec-exact), РФ frozen at its
// chip-obstacle boundary, Арх moved north of РФ (its old slot is walled by
// Северный Урал's dot 299.13,321.16; the arrow is EXACTLY 25.0 mm),
// Литовское keeps spec x (249.45) right of BOTH pair dots, Крым pinned in
// the Чёрное море - the only chip-clear pocket (the western sea is walled).
const NORTH_LABEL_PINS = new Map([
  ["Кольский полуостров", { dx: 126, dy: 41, noLeader: true }],
  ["Архангельская область", { dx: 39.66, dy: -91.92 }],
  ["Финляндия", { dx: 104, dy: 35, noLeader: true }],
  ["Российская Федерация · Россия", { dx: 78, dy: 20 }],
  ["Литовское княжество Великое · Литва", { dx: 32.34, dy: -97.53 }],
  ["Крым", { dx: 33.25, dy: 29.5 }],
]);
// B9/B10-only stacks: the stack map is shared with the frozen B8 config, so
// the Архангельская two-line stack goes into a clone - B8 keeps its bytes.
const B9_NORTH_STACKS = new Map(B8_LABEL_STACKS);
B9_NORTH_STACKS.set("Архангельская область", ["Архангельская", "область"]);
// MG rev 12 point 1: the filled (discussed) marker reads fine in dark gray -
// softer than the near-black #111111, on B10 only
const B10_FILLED_U = "#444444";

function markerRadU(g) {
  return g.discussed ? 2.8 : 7;
}

function relaxAll(groups, box, radiusOverride, capU, gapU, displacedMinU) {
  const pts = groups.map((g) => ({ g, x: g.px, y: g.py, ox: g.px, oy: g.py, r: radiusOverride || markerRadU(g) }));
  const x0 = box.x0 + 6;
  const x1 = box.x1 - 6;
  const y0 = box.y0 + 6;
  const y1 = box.y1 - 6;
  for (let it = 0; it < RELAX_ITERATIONS; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        // ?? not ||: B9 passes gapU = 0 (chips may touch) and must not fall
        // back to the default gap
        const minD = a.r + b.r + (gapU ?? RELAX_GAP);
        if (d === 0) {
          dx = 0.5;
          dy = 0.5;
          d = Math.hypot(dx, dy);
        }
        if (d < minD) {
          const push = ((minD - d) / d) * 0.3;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
    for (const p of pts) {
      p.x = Math.min(Math.max(p.x, x0), x1);
      p.y = Math.min(Math.max(p.y, y0), y1);
    }
  }
  for (const p of pts) {
    let dx = p.x - p.ox;
    let dy = p.y - p.oy;
    const d = Math.hypot(dx, dy);
    const cap = capU || DISPLACE_CAP;
    if (d > cap) {
      dx *= cap / d;
      dy *= cap / d;
    }
    p.g.px2 = p.ox + dx;
    p.g.py2 = p.oy + dy;
    // B9: the displaced threshold is configurable - a chip nudged 1-4 mm
    // toward its neighbours does NOT draw a stub (MG rev 11: the lines are the
    // complaint); only real drift does. Default 5u keeps every frozen sheet.
    p.g.displaced = Math.hypot(p.g.px2 - p.ox, p.g.py2 - p.oy) > (displacedMinU ?? 5);
  }
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f = (n) => Number(n).toFixed(2);

// italicize the word «стр.» (MG ruling H3996) — «стр.» is always followed by a space in our strings
function lineHtml(line) {
  const parts = String(line).split(/(^|[\s·])(стр\.)(?=\s)/g);
  if (parts.length === 1) return esc(line);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 2) out += `<tspan font-style="italic">${esc(parts[i])}</tspan>`;
    else out += esc(parts[i]);
  }
  return out;
}

function compressPages(sortedUniq) {
  const out = [];
  let i = 0;
  while (i < sortedUniq.length) {
    let j = i;
    while (j + 1 < sortedUniq.length && sortedUniq[j + 1] - sortedUniq[j] === 1) j++;
    out.push(i === j ? `${sortedUniq[i]}` : `${sortedUniq[i]}-${sortedUniq[j]}`);
    i = j + 1;
  }
  return out;
}

function fmtPages(pages) {
  const uniq = [...new Set(pages.filter((p) => Number.isFinite(p)))].sort((a, b) => a - b);
  return uniq.length ? compressPages(uniq).join(", ") : "";
}

function loadGroups() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/modules/11-toponyms.json"), "utf-8"));
  const items = raw.toponyms;
  const byKey = new Map();
  for (const it of items) {
    if (it.lat === undefined || it.lon === undefined) throw new Error(`no coords: ${it.head}`);
    const key = `${it.lat.toFixed(3)},${it.lon.toFixed(3)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(it);
  }
  const groups = [];
  for (const members of byKey.values()) {
    const pages = fmtPages(members.flatMap((m) => m.page_list || []));
    const primary =
      members.find((m) => m.discussed) ||
      [...members].sort((a, b) => (b.head || "").length - (a.head || "").length)[0];
    const names = [...members].sort((a, b) => a.head.localeCompare(b.head, "ru")).map((m) => m.head);
    const shortest = [...names].sort((a, b) => a.length - b.length)[0];
    const anchor = members.map((m) => m.label_anchor).find((a) => a) || null;
    const areal = members.map((m) => m.areal).find((a) => a) || null;
    const lineClass = members.map((m) => m.line_class).find((c) => c) || "east";
    groups.push({
      members,
      names,
      primary,
      // H4051 Unit B: feature scale of the group (= its primary's rank) -
      // city names stop competing for world-sheet slots under scaleRankedNames
      scaleRank: primary.scale_rank || null,
      display: names.join(" · "),
      mapName: names.length > 2 ? `${shortest} и др.` : names.join(" · "),
      pages,
      discussed: members.some((m) => m.discussed),
      conditional: members.some((m) => m.coords_conditional),
      epoch: members.map((m) => m.epoch_class).find((e) => e) || null,
      lat: members[0].lat,
      lon: members[0].lon,
      lineClass,
      anchor,
      areal,
    });
  }
  groups.sort((a, b) => a.primary.head.localeCompare(b.primary.head, "ru"));
  // H4051 collation pin. Group order decides the 1..83 numbering, and the
  // numbering decides every byte of every sheet - so `localeCompare(…, "ru")`
  // silently owns the "frozen sheets are byte-identical" invariant. It is
  // ICU-version dependent: a Node built against a different ICU (or the other
  // box) renumbers the whole book without a word of warning. Fail loudly
  // instead. If this trips, the ICU changed - do NOT bump the hash without
  // re-checking every frozen sheet.
  const collationHash = crypto
    .createHash("sha256")
    .update(groups.map((g) => g.primary.head).join("|"), "utf8")
    .digest("hex")
    .slice(0, 16);
  if (collationHash !== RU_COLLATION_SHA) {
    throw new Error(
      `FAIL: ru collation drift - group order hash ${collationHash} != pinned ${RU_COLLATION_SHA}. ` +
        `Node ${process.version} sorts data/modules/11-toponyms.json differently, so the 1..83 numbering ` +
        `and every frozen sheet would change. Investigate ICU before touching the pin (H4051).`
    );
  }
  let num = 0;
  for (const g of groups) if (!g.discussed) g.number = ++num;
  return { groups, total: items.length };
}

function wrapText(text, maxChars, maxLines) {
  const lines = [];
  let cur = text;
  while (cur.length > maxChars && lines.length < maxLines - 1) {
    let cut = cur.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.5) cut = maxChars;
    lines.push(cur.slice(0, cut).trim());
    cur = cur.slice(cut).trim();
  }
  lines.push(cur);
  return lines;
}

function buildProjection(boxMm, points, padFraction) {
  const box = { x0: boxMm.x0 * U, y0: boxMm.y0 * U, x1: boxMm.x1 * U, y1: boxMm.y1 * U };
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const inner = [
    [box.x0 + w * padFraction, box.y0 + h * padFraction],
    [box.x1 - w * padFraction, box.y1 - h * padFraction],
  ];
  const multipoint = { type: "MultiPoint", coordinates: points };
  const projection = d3.geoConicConformal().parallels([40, 65]).rotate([-35, 0]);
  projection.fitExtent(inner, multipoint);
  return { projection, geopath: d3.geoPath(projection), box };
}

const textW = (t, fontU) => t.length * fontU * CHAR_W;

function placeLabel(g, px, py, lines, placed, box, fontU, clipBox, ringDeltas, padU) {
  const widest = Math.max(...lines.map((l) => textW(l, fontU)));
  const lineH = fontU * 1.22;
  const blockH = lines.length * lineH;
  const startR = markerRadU(g) + 5;
  const dirs = [
    [1, 0, "start"],
    [-1, 0, "end"],
    [0, -1, "middle"],
    [0, 1, "middle"],
    [1, -1, "start"],
    [-1, -1, "end"],
    [1, 1, "start"],
    [-1, 1, "end"],
    [1, -0.45, "start"],
    [-1, -0.45, "end"],
    [1, 0.45, "start"],
    [-1, 0.45, "end"],
    [0.45, -1, "middle"],
    [-0.45, -1, "middle"],
    [0.45, 1, "middle"],
    [-0.45, 1, "middle"],
  ];
  const cb = clipBox || box;
  const deltas = ringDeltas || [0, 12, 26, 42, 60, 85, 115, 150];
  for (const d of deltas) {
    const r = startR + d;
    for (const [dx, dy, anchor] of dirs) {
      // B2: normalize diagonal dirs so the ring radius is the TRUE distance
      // (raw dirs put diagonal placements at r*sqrt2, breaking the mm budget)
      let ux = dx;
      let uy = dy;
      if (ringDeltas) {
        const len = Math.hypot(dx, dy) || 1;
        ux = dx / len;
        uy = dy / len;
      }
      const lx2 = ux !== 0 ? px + ux * r : px;
      const ly2 = uy !== 0 ? py + uy * r : py;
      let bx0, bx1, by0, by1, ly;
      if (anchor === "start") {
        bx0 = lx2;
        bx1 = lx2 + widest;
      } else if (anchor === "end") {
        bx0 = lx2 - widest;
        bx1 = lx2;
      } else {
        bx0 = lx2 - widest / 2;
        bx1 = lx2 + widest / 2;
      }
      if (dy < 0) {
        ly = ly2 - blockH * 0.1;
        by0 = ly - blockH + lineH * 0.25;
        by1 = ly + lineH * 0.25;
      } else if (dy > 0) {
        ly = ly2 + lineH * 0.8;
        by0 = ly - lineH * 0.8;
        by1 = by0 + blockH;
      } else {
        ly = ly2 + lineH * 0.34;
        by0 = ly - lineH * 0.8;
        by1 = by0 + blockH;
      }
      if (bx0 < cb.x0 + 2 || bx1 > cb.x1 - 2 || by0 < cb.y0 + 2 || by1 > cb.y1 - 2) continue;
      const P = padU ?? 2.5;
      let clash = false;
      for (const b of placed) {
        if (bx0 - P < b.x1 && bx1 + P > b.x0 && by0 - P < b.y1 && by1 + P > b.y0) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      placed.push({ x0: bx0 - P, x1: bx1 + P, y0: by0 - P, y1: by1 + P });
      const dist = Math.hypot(lx2 - px, ly2 - py);
      const leader = dist > startR + 6 ? { x: px, y: py, tx: lx2, ty: ly2 } : null;
      // H4051: hand back the EXACT ink rect the collision test used. The
      // escapes / label_chip_violations gates used to re-derive it with a
      // one-line formula that is wrong for upward multi-line placements (the
      // two-line stacks B8 introduced) - they measured a box the placer never
      // reserved. Measuring the placer's own rect is the whole point.
      return { x: lx2, y: ly, anchor, lines, lineH, leader, dist, rect: { x0: bx0, x1: bx1, y0: by0, y1: by1 } };
    }
  }
  return null;
}

// B7 truePlace: fine 1 mm rings around the TRUE anchor, all 16 directions,
// first clash-free slot wins (ascending radius = nearest wins); hard cap - a
// label that does not fit within maxDistU of its dot is not drawn at all.
// H4144: the direction set is shared with the global solver (TRUE_DIRS).
const TRUE_DIRS = [
  [1, 0, "start"],
  [-1, 0, "end"],
  [0, -1, "middle"],
  [0, 1, "middle"],
  [1, -1, "start"],
  [-1, -1, "end"],
  [1, 1, "start"],
  [-1, 1, "end"],
  [1, -0.45, "start"],
  [-1, -0.45, "end"],
  [1, 0.45, "start"],
  [-1, 0.45, "end"],
  [0.45, -1, "middle"],
  [-0.45, -1, "middle"],
  [0.45, 1, "middle"],
  [-0.45, 1, "middle"],
];
function placeLabelTrue(g, px, py, lines, placed, box, fontU, clipBox, maxDistU, padU, biasDir, tightUp) {
  const widest = Math.max(...lines.map((l) => textW(l, fontU)));
  const lineH = fontU * 1.22;
  const blockH = lines.length * lineH;
  const startR = markerRadU(g) + 4;
  const dirs = TRUE_DIRS;
  // B8 LABEL_BIAS: the requested spots are tried BEFORE the ring walk (see
  // biasList below) - the ring walk itself always uses the standard dirs
  const cb = clipBox || box;
  const P = padU ?? 2.5;
  // B8 LABEL_BIAS as an exact offset (units from the true dot) - the one
  // spot MG asked for is tried before the ring walk; a LIST of offsets is
  // walked in order (Ukraine's north-east steppe candidates)
  const biasList = Array.isArray(biasDir && biasDir[0]) ? biasDir : biasDir ? [biasDir] : [];
  for (const [bdx, bdy] of biasList) {
    if (!Number.isFinite(bdx) || !Number.isFinite(bdy)) continue;
    const lx2 = px + bdx;
    const ly2 = py + bdy;
    const bx0 = lx2 - widest / 2;
    const bx1 = lx2 + widest / 2;
    const ly = ly2 + lineH * 0.34;
    const by0 = ly - lineH * 0.8;
    const by1 = by0 + blockH;
    if (process.env.H4051_DEBUG && (g.primary.head.includes("Архангельская") || g.primary.head === "Швеция" || g.primary.head === "Германия+ГДР" || g.mapName === "Цейлон · Шри-Ланка")) {
      console.error(`FIELD ${g.primary.head}: bias target (${(bx0 / 4).toFixed(1)}-${(bx1 / 4).toFixed(1)}, ${(by0 / 4).toFixed(1)}-${(by1 / 4).toFixed(1)})mm; placed boxes:`);
      for (const b of placed) console.error(`  (${(b.x0 / 4).toFixed(1)},${(b.y0 / 4).toFixed(1)})-(${(b.x1 / 4).toFixed(1)},${(b.y1 / 4).toFixed(1)})`);
    }
    if (bx0 < cb.x0 + 2 || bx1 > cb.x1 - 2 || by0 < cb.y0 + 2 || by1 > cb.y1 - 2) {
      if (process.env.H4051_DEBUG) console.error(`BIAS ${g.primary.head}: frame reject at (${lx2.toFixed(0)},${ly2.toFixed(0)})`);
      continue;
    }
    let clash = false;
    for (const b of placed) {
      if (bx0 - P < b.x1 && bx1 + P > b.x0 && by0 - P < b.y1 && by1 + P > b.y0) {
        clash = true;
        if (process.env.H4051_DEBUG) console.error(`BIAS ${g.primary.head}: clash at (${lx2.toFixed(0)},${ly2.toFixed(0)}) with box (${b.x0.toFixed(0)},${b.y0.toFixed(0)})-(${b.x1.toFixed(0)},${b.y1.toFixed(0)})`);
        break;
      }
    }
    if (clash) continue;
    placed.push({ x0: bx0 - P, x1: bx1 + P, y0: by0 - P, y1: by1 + P });
    return { x: lx2, y: ly, anchor: "middle", lines, lineH, leader: null, dist: Math.hypot(bdx, bdy), rect: { x0: bx0, x1: bx1, y0: by0, y1: by1 } };
  }
  for (let r = startR; r <= maxDistU; r += B7_TRUE_RING_STEP) {
    for (const [dx, dy, anchor] of dirs) {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const lx2 = ux !== 0 ? px + ux * r : px;
      const ly2 = uy !== 0 ? py + uy * r : py;
      let bx0, bx1, by0, by1, ly;
      if (anchor === "start") {
        bx0 = lx2;
        bx1 = lx2 + widest;
      } else if (anchor === "end") {
        bx0 = lx2 - widest;
        bx1 = lx2;
      } else {
        bx0 = lx2 - widest / 2;
        bx1 = lx2 + widest / 2;
      }
      if (dy < 0) {
        ly = ly2 - blockH * 0.1;
        // B10 rev 12: the upward multi-line placed box reserved a full extra
        // line above the ink (by0 = ly - n*LH + 0.25*LH vs drawn top at
        // ly - 0.8*LH) - a phantom band that blocked three of MG's rev-12
        // label spots. tightUp = ink-true box; frozen sheets keep the old one.
        by0 = tightUp ? ly - lineH * 0.8 : ly - blockH + lineH * 0.25;
        by1 = ly + lineH * 0.25;
      } else if (dy > 0) {
        ly = ly2 + lineH * 0.8;
        by0 = ly - lineH * 0.8;
        by1 = by0 + blockH;
      } else {
        ly = ly2 + lineH * 0.34;
        by0 = ly - lineH * 0.8;
        by1 = by0 + blockH;
      }
      if (bx0 < cb.x0 + 2 || bx1 > cb.x1 - 2 || by0 < cb.y0 + 2 || by1 > cb.y1 - 2) continue;
      let clash = false;
      for (const b of placed) {
        if (bx0 - P < b.x1 && bx1 + P > b.x0 && by0 - P < b.y1 && by1 + P > b.y0) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      placed.push({ x0: bx0 - P, x1: bx1 + P, y0: by0 - P, y1: by1 + P });
      if (!Number.isFinite(ly) && process.env.H4051_DEBUG) console.error(`NANPOS ${g.primary.head}: ly2=${ly2} blockH=${blockH} n=${lines.length} r=${r} px=${px} py=${py}`);
      return { x: lx2, y: ly, anchor, lines, lineH, leader: null, dist: r, rect: { x0: bx0, x1: bx1, y0: by0, y1: by1 } };
    }
  }
  return null;
}

function textBlockSvg(l, fontU) {
  return (
    `<text x="${f(l.x)}" y="${f(l.y)}" text-anchor="${l.anchor}" font-size="${fontU}" fill="#111111" stroke="#ffffff" stroke-width="1.8" paint-order="stroke" stroke-linejoin="round">` +
    l.lines.map((line, i) => `<tspan x="${f(l.x)}" dy="${i === 0 ? 0 : f(l.lineH)}">${lineHtml(line)}</tspan>`).join("") +
    `</text>`
  );
}

function legendRowSvg(x, y, fontU, maxChars, g, maxLines = 2, pitchU = LEGEND_ROW_H, lineDy = 11, displayName = null) {
  const expect = g.pages ? `стр. ${g.pages}` : "—";
  const rowText = `${g.number}. ${displayName || g.display} — ${expect}`;
  const lines = wrapText(rowText, maxChars, maxLines);
  const rowH = pitchU + (lines.length - 1) * lineDy;
  const svg =
    `<text x="${f(x)}" y="${f(y)}" font-size="${fontU}" fill="#111111">` +
    lines.map((line, li) => `<tspan x="${f(x)}" dy="${li === 0 ? 0 : lineDy}">${lineHtml(line)}</tspan>`).join("") +
    `</text>`;
  return { svg, rowH, parity: !g.pages || expect === `стр. ${g.pages}` };
}

// ---------------------------------------------------------------------------
// H4051 measurement helpers (MG rev 11 audit): the gates up to B8 measured the
// placer's own bookkeeping - "did my collision loop report a collision?" - and
// four variants in a row shipped all-green and were rejected. These compute
// what MG actually judges: how many lines the sheet draws, how far a name sits
// from its dot, how many names are silently not drawn, how much chip ink is
// covered. Accounting only - no glyph moves, no byte change to any sheet.
// ---------------------------------------------------------------------------

// The ink rect for labels pushed outside the placers (fallback / last-resort /
// no-slot paths). Mirrors the placers' dy === 0 branch, which is the geometry
// those pushes use, so the number is exact rather than approximated.
function labelRectFallback(x, y, anchor, lines, lineH, fontU) {
  const widest = Math.max(...lines.map((line) => textW(line, fontU)));
  const x0 = anchor === "end" ? x - widest : anchor === "middle" ? x - widest / 2 : x;
  const y0 = y - lineH * 0.8;
  return { x0, x1: x0 + widest, y0, y1: y0 + lines.length * lineH };
}

const rectGap = (r, px, py) => Math.hypot(Math.max(r.x0 - px, px - r.x1, 0), Math.max(r.y0 - py, py - r.y1, 0));

function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i];
}

// fraction of the smaller chip's area hidden under the other chip - the honest
// form of "no full number-on-number cover"
function circleOverlapFraction(d, r1, r2) {
  if (d >= r1 + r2) return 0;
  const rMin = Math.min(r1, r2);
  if (d <= Math.abs(r1 - r2)) return 1;
  const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const a3 = 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return (a1 + a2 - a3) / (Math.PI * rMin * rMin);
}

// ---------------------------------------------------------------------------
// sheet renderer
// ---------------------------------------------------------------------------

function renderSheet(cfg, world, landObj, groups, total) {
  const stats = {
    sheet: cfg.key,
    labels_without_slot: 0,
    labels_in_fallback_slots: 0,
    labels_last_resort: 0,
    labels_deferred: 0,
    labels_squeezed: 0,
    covered_relocated: 0,
    max_leader_mm: 0,
    label_chip_violations: 0,
    escapes: 0,
    chip_close_pairs: 0,
    legend_rows_drawn: 0,
    legend_capacity: 0,
    legend_overflow: 0,
    legend_parity_ok: true,
    cis_anchored_ok: 0,
    areals_drawn: 0,
    // H4051 MG-facing metrics
    links_drawn: 0,
    links_by_kind: {},
    max_link_mm: 0,
    names_requested: 0,
    names_drawn: 0,
    names_not_drawn: 0,
    names_at_true_place: 0,
    label_offset_p50_mm: 0,
    label_offset_p90_mm: 0,
    label_offset_max_mm: 0,
    chip_ink_overlap_max: 0,
    chip_ink_overlap_pairs: 0,
    names_policy_unnamed: 0,
  };

  // every drawn leader / stub / connector is counted here. Accounting is
  // centralised even though emission stays inline per site: the seven sites
  // differ in stroke width and dash, and rewriting them through one emitter
  // would drift the bytes of eleven frozen sheets. `links_drawn` is the stat
  // MG's «уменьшение количества выносных линий» is judged on.
  const countLink = (kind, x1, y1, x2, y2) => {
    stats.links_drawn += 1;
    stats.links_by_kind[kind] = (stats.links_by_kind[kind] || 0) + 1;
    stats.max_link_mm = Math.max(stats.max_link_mm, Math.hypot(x2 - x1, y2 - y1) / U);
  };

  const pageWU = cfg.pageW * U;
  const pageHU = cfg.pageH * U;
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWU} ${pageHU}" font-family="Georgia, 'Times New Roman', serif">`);
  s.push(`<rect width="${pageWU}" height="${pageHU}" fill="#ffffff"/>`);
  s.push(
    `<defs><clipPath id="map-clip-${cfg.key}"><rect x="${f(cfg.mapBox.x0 * U)}" y="${f(cfg.mapBox.y0 * U)}" width="${f((cfg.mapBox.x1 - cfg.mapBox.x0) * U)}" height="${f((cfg.mapBox.y1 - cfg.mapBox.y0) * U)}"/></clipPath>` +
      (cfg.inset
        ? `<clipPath id="inset-clip-${cfg.key}"><rect x="${f(cfg.inset.box.x0 * U)}" y="${f(cfg.inset.box.y0 * U)}" width="${f((cfg.inset.box.x1 - cfg.inset.box.x0) * U)}" height="${f((cfg.inset.box.y1 - cfg.inset.box.y0) * U)}"/></clipPath>`
        : "") +
      (cfg.loupeGeo
        ? `<clipPath id="loupe-clip-${cfg.key}"><rect x="${f(cfg.loupeBox.x0 * U)}" y="${f(cfg.loupeBox.y0 * U)}" width="${f((cfg.loupeBox.x1 - cfg.loupeBox.x0) * U)}" height="${f((cfg.loupeBox.y1 - cfg.loupeBox.y0) * U)}"/></clipPath>`
        : "") +
      `<pattern id="hatch-${cfg.key}" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="#6a655c" stroke-width="0.7"/></pattern></defs>`
  );

  // H4051 rev 12: filled (discussed) markers in soft dark gray on B10
  const FILLED = cfg.softFill ? B10_FILLED_U : "#111111";

  const inInset = (g) =>
    cfg.insetGeo
      ? g.lat >= cfg.insetGeo.lat0 && g.lat <= cfg.insetGeo.lat1 && g.lon >= cfg.insetGeo.lon0 && g.lon <= cfg.insetGeo.lon1
      : g.lineClass === "west";
  // B6 insetMirror: core groups stay on the main map (numbered chips) while
  // also living in the inset with names - a magnifier, not an extraction
  const inMain = groups.filter((g) => (cfg.inset && !cfg.insetMirror ? !inInset(g) : true));
  // B5: groups south of the cropped frame - drawn in an edge row, not fitted
  const southern = cfg.fitLatMin ? groups.filter((g) => g.lat < cfg.fitLatMin) : [];
  const southernSet = new Set(southern);
  const inCrop = groups.filter((g) => !southernSet.has(g));
  // B6 southernEdgeOnly: the edge row is the ONLY rendering for southern
  // groups (B5 leaked their names + chips into the frame at clamped spots)
  const onMap = cfg.southernEdgeOnly && cfg.fitLatMin ? inCrop : inMain;
  // the frame is always fitted to ALL points so every sheet shares the same geography;
  // on inset sheets the west points simply do not render on the main map
  const { projection, geopath, box } = buildProjection(cfg.mapBox, (cfg.fitLatMin ? inCrop : groups).map((g) => [g.lon, g.lat]), PAD_FRACTION);
  for (const g of groups) {
    [g.px, g.py] = projection([g.lon, g.lat]);
    g.anchorPx = !cfg.ignoreAnchors && g.anchor ? projection([g.anchor.lon, g.anchor.lat]) : null;
  }

  const mapClip = `url(#map-clip-${cfg.key})`;
  const frame = { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
  const graticule = d3.geoGraticule().step([10, 10])();

  if (cfg.noMap) {
    s.push(
      `<rect x="${f(6 * U)}" y="${f(6 * U)}" width="${f((cfg.pageW - 12) * U)}" height="${f((cfg.pageH - 12) * U)}" fill="none" stroke="#111111" stroke-width="1.6"/>` +
        `<rect x="${f(6 * U + 5)}" y="${f(6 * U + 5)}" width="${f((cfg.pageW - 12) * U - 10)}" height="${f((cfg.pageH - 12) * U - 10)}" fill="none" stroke="#111111" stroke-width="0.45"/>`
    );
  } else {
  s.push(`<g clip-path="${mapClip}">`);
  s.push(`<path d="${geopath(landObj)}" fill="#e9e5dc" stroke="#4a4640" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"/>`);
  s.push(`<path d="${geopath(graticule)}" fill="none" stroke="#cdc8be" stroke-width="0.45"/>`);

  // OLA-style areals: dashed outline + light hatching, under everything else
  for (const g of onMap) {
    if (!g.areal) continue;
    const pts = g.areal.map(([lon, lat]) => projection([lon, lat]));
    if (pts.some((p) => !p || Number.isNaN(p[0]))) continue;
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${f(p[0])},${f(p[1])}`).join("") + "Z";
    s.push(`<path d="${d}" fill="url(#hatch-${cfg.key})" fill-opacity="0.30" stroke="#3d3a34" stroke-width="0.9" stroke-dasharray="5 3"/>`);
    stats.areals_drawn += 1;
  }

  relaxAll(onMap, box, cfg.numberAll ? 7 : undefined, cfg.displaceCap, cfg.relaxGap, cfg.displacedMinU);

  const placed = [];
  const labels = [];
  const leaders = [];

  // B5: groups south of the cropped frame sit in an edge row at the frame
  // bottom, arrows pointing toward their true (off-frame) directions
  if (cfg.fitLatMin && southern.length) {
    const yEdge = box.y1 - 14;
    let lastX = -1e9;
    const sorted = southern.slice().sort((a, b) => a.lon - b.lon);
    // B6 southernEdgeOnly: even west->east spacing - raw projected x bunches
    // the low-lat chips against the right frame edge (chip 13 was half-clipped)
    const sMin = 240;
    const sMax = box.x1 - 14;
    const sStep = sorted.length > 1 ? (sMax - sMin) / (sorted.length - 1) : 0;
    let sIdx = 0;
    for (const g of sorted) {
      const [ex] = projection([g.lon, g.lat]);
      const x = cfg.southernEdgeOnly ? sMin + sIdx * sStep : Math.max(ex, lastX + 14);
      sIdx += 1;
      lastX = x;
      const dash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
      const fill = g.discussed ? FILLED : "#ffffff";
      const tf = g.discussed ? "#ffffff" : "#111111";
      s.push(`<line x1="${f(x)}" y1="${f(yEdge + 7)}" x2="${f(x)}" y2="${f(box.y1 - 2)}" stroke="#55524c" stroke-width="0.4"${dash}/>`);
      countLink("southern_edge", x, yEdge + 7, x, box.y1 - 2);
      s.push(`<circle cx="${f(x)}" cy="${f(yEdge)}" r="7" fill="${fill}" stroke="#111111" stroke-width="0.6"${dash}/><text x="${f(x)}" y="${f(yEdge + 2.5)}" text-anchor="middle" font-size="7.2" fill="${tf}">${g.number}</text>`);
    }
  }

  // displaced chips keep a thin link to the true spot
  for (const g of onMap) {
    if (g.displaced) {
      const dash = LINE_DASH[g.lineClass];
      s.push(`<line x1="${f(g.px)}" y1="${f(g.py)}" x2="${f(g.px2)}" y2="${f(g.py2)}" stroke="#55524c" stroke-width="0.4"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
      s.push(`<circle cx="${f(g.px)}" cy="${f(g.py)}" r="1.7" fill="none" stroke="#111111" stroke-width="0.5"/>`);
      countLink("chip_displacement", g.px, g.py, g.px2, g.py2);
    }
  }

  // B3: chips and dots are obstacles - name labels may never cover numbers
  if (cfg.chipObstacles) {
    for (const g of onMap) {
      // B7 truePlace: chip obstacle pad tightens to r + 0.5 mm (white halo
      // keeps both readable) - frees slots in the dense Baltic fringe
      // B8: back out to r + 1 mm - «воздуха надо больше»
      const pad = cfg.labelAir ? 10 : cfg.truePlace ? 9 : cfg.numberAll ? 11 : g.discussed ? 4 : 11;
      placed.push({ x0: g.px2 - pad, x1: g.px2 + pad, y0: g.py2 - pad, y1: g.py2 + pad });
    }
  }

  let chipClosePairs = 0;
  for (let i = 0; i < onMap.length; i++) {
    for (let j = i + 1; j < onMap.length; j++) {
      const a = onMap[i];
      const b = onMap[j];
      const d = Math.hypot(a.px2 - b.px2, a.py2 - b.py2);
      const rrA = cfg.numberAll ? 7 : markerRadU(a);
      const rrB = cfg.numberAll ? 7 : markerRadU(b);
      if (d < rrA + rrB - 1) {
        chipClosePairs += 1;
        stats.chip_close_pair = `${a.primary.head} (${a.px.toFixed(0)},${a.py.toFixed(0)}) <-> ${b.primary.head} (${b.px.toFixed(0)},${b.py.toFixed(0)}) d=${d.toFixed(1)}`;
      }
      // H4051: «no full number-on-number cover» as a measured quantity. The
      // shipped chip_close_pairs rule is a yes/no at d < r1+r2-1; this says
      // HOW MUCH ink is hidden, which is what decides whether a digit reads.
      const frac = circleOverlapFraction(d, rrA, rrB);
      if (frac > 0) {
        stats.chip_ink_overlap_pairs += 1;
        if (frac > stats.chip_ink_overlap_max) {
          stats.chip_ink_overlap_max = Number(frac.toFixed(4));
          stats.chip_ink_overlap_worst = `${a.primary.head} <-> ${b.primary.head} d=${d.toFixed(2)}u frac=${frac.toFixed(3)}`;
        }
      }
    }
  }
  stats.chip_close_pairs = chipClosePairs;

  // inset (sheet C): west points live here at a larger scale
  let insetCtx = null;
  if (cfg.inset) {
    const west = groups.filter(inInset);
    const ib = {
      x0: cfg.inset.box.x0 * U,
      y0: cfg.inset.box.y0 * U,
      x1: cfg.inset.box.x1 * U,
      y1: cfg.inset.box.y1 * U,
    };
    // B9 (MG rev 11): the framed title bar is RESERVED BEFORE fitting - the
    // projection (hence chips, stubs and labels) lives below the bar, so the
    // top row never touches or clips under the frame caption.
    const insetBarU = cfg.insetReserveBar ? 30 : 0;
    const insetFitBoxMm = insetBarU ? { ...cfg.inset.box, y0: cfg.inset.box.y0 + insetBarU / U } : cfg.inset.box;
    const insetFitBoxU = insetBarU ? { x0: ib.x0, y0: ib.y0 + insetBarU, x1: ib.x1, y1: ib.y1 } : ib;
    const inset = buildProjection(insetFitBoxMm, west.map((g) => [g.lon, g.lat]), cfg.insetPad || 0.12);
    for (const g of west) {
      [g.ipx, g.ipy] = inset.projection([g.lon, g.lat]);
    }
    insetCtx = { west, inset, ib, fitBox: insetFitBoxU };
    placed.push({ x0: ib.x0 - 3, x1: ib.x1 + 3, y0: ib.y0 - 3, y1: ib.y1 + 3 });
  }

  // discussed labels on the main map (east classes; west live in the inset on sheet C)
  // B6 insetMirror: the core's names live in the inset only - on the main map
  // the core stays chips-only (MG rev 8 ruling)
  // B7 nameMentioned: mentioned groups get true-place names too where a clean
  // slot exists (free-space regions - Китай, Индия, Цейлон...)
  // H4051 Unit B: city-rank groups outside the inset keep their chips but
  // stop competing for world-sheet name slots (the legend decodes them; the
  // Rus core's cities are named in the inset). count what the policy drops.
  stats.names_policy_unnamed = onMap.filter(
    (x) => cfg.scaleRankedNames && x.scaleRank === "city" && !inInset(x) && (x.discussed || cfg.nameMentioned)
  ).length;
  const mainLabeled = onMap
    .filter((x) => x.discussed || cfg.nameMentioned)
    .filter((x) => !(cfg.insetMirror && cfg.insetGeo && inInset(x)))
    .filter((x) => !(cfg.scaleRankedNames && x.scaleRank === "city" && !inInset(x)))
    .map((g) => ({
      g,
      width: Math.max(
        ...wrapText(g.mapName, 26, 2).map((l) => textW(l, LABEL_FONT_U)),
        ...wrapText(g.pages || "", 32, 2).map((l) => textW(l, LABEL_FONT_U))
      ),
    }))
    .sort((a, b) => {
      // B7 truePlace: discussed labels compete first - mentioned names defer
      // to chips before a discussed name loses its true-place slot
      const dd = cfg.truePlace ? (b.g.discussed ? 1 : 0) - (a.g.discussed ? 1 : 0) : 0;
      return dd || b.width - a.width || a.g.primary.head.localeCompare(b.g.primary.head, "ru");
    });

  // B7 pairMerge: near-twin groups share ONE label anchored between their
  // true dots (render-level pairing, data untouched)
  // B8: pair list from cfg (historical name FIRST, modern in the tail) and
  // extended to Британия·Англия / Германия·ГДР (MG rev 10 points 3, 10)
  if (cfg.pairMerge) {
    for (const [ha, hb] of cfg.pairMergeList || B7_PAIR_MERGE) {
      const ia = mainLabeled.findIndex((e) => e.g.primary.head === ha);
      const ib = mainLabeled.findIndex((e) => e.g.primary.head === hb);
      if (ia < 0 || ib < 0) continue;
      const ea = mainLabeled[ia];
      const eb = mainLabeled[ib];
      const mid = { x: (ea.g.px + eb.g.px) / 2, y: (ea.g.py + eb.g.py) / 2 };
      const mg = {
        ...ea.g,
        primary: { head: `${ha}+${hb}` },
        mapName: `${ha} · ${hb}`,
        px: mid.x,
        py: mid.y,
        px2: mid.x,
        py2: mid.y,
        displaced: false,
        anchorPx: null,
      };
      mainLabeled.splice(Math.max(ia, ib), 1);
      mainLabeled.splice(Math.min(ia, ib), 1, { g: mg, width: ea.width + eb.width });
    }
  }

  // H4120: measurement hook (same H4051_DEBUG convention as NANLEADER) - the
  // pin offsets are derived from these TRUE dots, never guessed
  if (process.env.H4051_DEBUG) {
    for (const { g } of mainLabeled) {
      console.error(`LABELDOT ${cfg.key} ${g.mapName} px=${g.px.toFixed(2)} py=${g.py.toFixed(2)}`);
    }
  }

  const buildLines = (g) => {
    // B2: name-only labels - pages live in the legend, not on the map
    if (cfg.nameOnlyLabels) {
      // B8 LABEL_STACKS: explicit line order/stacking (historical first,
      // two-line country pairs) - beats arbitrary word wrap
      const stack = cfg.labelStacks && cfg.labelStacks.get(g.mapName);
      if (stack) return [...stack];
      return wrapText(g.mapName, 26, 2);
    }
    const lines = wrapText(g.mapName, 26, 2);
    if (g.pages) {
      lines.push(...wrapText(g.pages, 34, 3).map((l, i) => (i === 0 ? `стр. ${l}` : l)));
    } else if (g.conditional) {
      lines.push("условная координата");
    }
    if (lines.length > MAX_LABEL_LINES) {
      lines.length = MAX_LABEL_LINES;
      lines[MAX_LABEL_LINES - 1] += ":";
    }
    return lines;
  };

  const pushLeader = (g, x2, y2) => {
    if (!Number.isFinite(y2) && process.env.H4051_DEBUG) console.error(`NANLEADER ${cfg.key} ${g.primary.head}: px2=${g.px2} py2=${g.py2}`);
    const dash = LINE_DASH[g.lineClass];
    if (cfg.nameOnlyLabels) {
      const d = Math.hypot(x2 - g.px2, y2 - g.py2) / 4;
      stats.max_leader_mm = Math.max(stats.max_leader_mm || 0, d);
    }
    const obj = { x1: g.px2, y1: g.py2, x2, y2, dash };
    leaders.push(obj);
    return obj; // H4144: the solver re-targets moved labels' leaders
  };

  // B4: main-map chips/labels whose dots fall under the inset overlay
  // relocate below its edge (numbers stay visible - the legend decodes them)
  const covered = [];
  const coveredSet = new Set();
  if (cfg.coverRelocate && insetCtx) {
    const bx = cfg.inset.box;
    for (const g of onMap) {
      if (g.px2 >= bx.x0 * U && g.px2 <= bx.x1 * U && g.py2 >= bx.y0 * U && g.py2 <= bx.y1 * U) {
        covered.push(g);
        coveredSet.add(g);
      }
    }
  }
  stats.covered_relocated = covered.length;

  // H4110 label pins: MG-ruled placements reserved BEFORE the walk - other
  // labels route around them, re-flows cannot re-derive them. Geometry is
  // the bias-branch box exactly; a pin that does not fit is a build error,
  // never a silent fallback (that fallback is the bug being fixed).
  const pinned = new Map();
  // H4144 global solver: per-label walk context (leader object + squeeze
  // flags) so the pass can re-target leaders after moving a label
  const leaderTags = cfg.globalPlace ? new Map() : null;
  if (cfg.labelPins) {
    for (const [name, pin] of cfg.labelPins) {
      const entry = mainLabeled.find(({ g }) => g.mapName === name);
      if (!entry) continue;
      const g = entry.g;
      const lines = buildLines(g);
      const widest = Math.max(...lines.map((l) => textW(l, LABEL_FONT_U)));
      const lineH = LABEL_FONT_U * 1.22;
      const blockH = lines.length * lineH;
      const lx2 = g.px + pin.dx;
      const ly2 = g.py + pin.dy;
      const bx0 = lx2 - widest / 2;
      const bx1 = lx2 + widest / 2;
      const ly = ly2 + lineH * 0.34;
      const by0 = ly - lineH * 0.8;
      const by1 = by0 + blockH;
      if (bx0 < box.x0 + 2 || bx1 > box.x1 - 2 || by0 < box.y0 + 2 || by1 > box.y1 - 2) {
        throw new Error(`LABEL_PIN ${cfg.key} ${name}: box (${bx0.toFixed(1)},${by0.toFixed(1)})-(${bx1.toFixed(1)},${by1.toFixed(1)}) outside the map frame - re-derive the offsets`);
      }
      const P = cfg.labelAir ? B8_LABEL_PAD_U : 2.5;
      for (const b of placed) {
        if (bx0 - P < b.x1 && bx1 + P > b.x0 && by0 - P < b.y1 && by1 + P > b.y0) {
          throw new Error(`LABEL_PIN ${cfg.key} ${name}: box clashes reserved box (${b.x0.toFixed(1)},${b.y0.toFixed(1)})-(${b.x1.toFixed(1)},${b.y1.toFixed(1)}) - re-derive the offsets`);
        }
      }
      placed.push({ x0: bx0 - P, x1: bx1 + P, y0: by0 - P, y1: by1 + P });
      pinned.set(g, { x: lx2, y: ly, anchor: "middle", lines, lineH, leader: null, noLeader: pin.noLeader === true, dist: Math.hypot(pin.dx, pin.dy), rect: { x0: bx0, x1: bx1, y0: by0, y1: by1 } });
    }
  }

  for (const { g } of mainLabeled) {
    if (coveredSet.has(g)) continue;
    const lines = buildLines(g);
    // B7 truePlace: the label hunts around the TRUE dot, not the relaxed one
    const origin = cfg.truePlace
      ? { x: g.px, y: g.py }
      : !cfg.ignoreAnchors && g.anchorPx
        ? { x: g.anchorPx[0], y: g.anchorPx[1] }
        : { x: g.px2, y: g.py2 };
    let pos = pinned.get(g) ?? (cfg.truePlace
      ? placeLabelTrue(
          g,
          origin.x,
          origin.y,
          lines,
          placed,
          box,
          LABEL_FONT_U,
          null,
          // two-tier budget: 10 mm tight rings for everyone; a clean second
          // tier out to 25 mm (empty sea/steppe slots - Пруссия under Sweden,
          // Украина in the N-Black-Sea steppe, Литва+ВКЛ in the Baltic,
          // Балканы over Greece) with an explicit leader line (B2's budget);
          // merged pair labels get 40 mm - «держать рядом» is one label for
          // two dots, the leader ties them (B8 points 3, 10)
          g.primary.head.includes("+") ? 160 : cfg.truePlaceSecondTier ? 100 : g.discussed ? 100 : B7_LABEL_CAP_U,
          cfg.labelAir ? B8_LABEL_PAD_U : undefined,
          // B8 LABEL_BIAS: requested direction tried first at every radius
          cfg.labelBias ? cfg.labelBias.get(g.mapName) : null,
          // B10 rev 12: ink-true upward boxes (see placeLabelTrue)
          cfg.tightUpwardBoxes
        )
      : placeLabel(g, origin.x, origin.y, lines, placed, box, LABEL_FONT_U, null, cfg.labelRingDeltas));
    let squeezed = false;
    if (!pos && cfg.noWholeFrameFallback && !cfg.truePlace) {
      // second pass: wider radius - overlaps stay forbidden (frozen B2 keeps
      // its exact v4.17.10 squeeze semantics via cfg)
      pos = placeLabel(g, origin.x, origin.y, lines, placed, box, LABEL_FONT_U, null, cfg.squeezeRings, cfg.squeezePad);
      squeezed = pos != null;
    }
    let squeezed3 = false;
    if (!pos && cfg.thirdPassPad && !cfg.truePlace) {
      // third pass: same rings, minimal padding - labels may sit 1 mm from
      // chips/neighbors (white halo keeps both readable)
      pos = placeLabel(g, origin.x, origin.y, lines, placed, box, LABEL_FONT_U, null, [64, 72, 80, 88, 100, 112], cfg.thirdPassPad);
      squeezed3 = pos != null;
    }
    if (!pos) {
      if (cfg.noWholeFrameFallback) {
        if (cfg.cleanSlotsOnly) {
          // B6: forced overlaps abolished - the number chip stays and the
          // legend page decodes it; the name is simply not drawn here
          stats.labels_deferred += 1;
        } else {
        // B2 last resort: rings up to +55U failed - place the label right at
        // the (relax-adjusted) dot, overlaps permitted and reported
        stats.labels_last_resort += 1;
        labels.push({ g, x: origin.x, y: origin.y + LABEL_FONT_U * 0.34, anchor: "middle", lines, lineH: LABEL_FONT_U * 1.22, rect: labelRectFallback(origin.x, origin.y + LABEL_FONT_U * 0.34, "middle", lines, LABEL_FONT_U * 1.22, LABEL_FONT_U) });
        pushLeader(g, origin.x, origin.y - 2);
        }
      } else {
      const widest = Math.max(...lines.map((l) => textW(l, LABEL_FONT_U)));
      const blockH = lines.length * LABEL_FONT_U * 1.22;
      const step = 6;
      let best = null;
      for (let gy = box.y0 + 8; gy < box.y1 - 8 - blockH; gy += step) {
        for (let gx = box.x0 + 8; gx < box.x1 - 8 - widest; gx += step) {
          const bb = { x0: gx, x1: gx + widest, y0: gy, y1: gy + blockH };
          const P = 2.5;
          let clash = false;
          for (const b of placed) {
            if (bb.x0 - P < b.x1 && bb.x1 + P > b.x0 && bb.y0 - P < b.y1 && bb.y1 + P > b.y0) {
              clash = true;
              break;
            }
          }
          if (clash) continue;
          const dist = Math.hypot(gx - origin.x, gy - origin.y);
          if (!best || dist < best.dist) best = { ...bb, dist };
        }
      }
      if (best) {
        placed.push({ x0: best.x0, x1: best.x1, y0: best.y0, y1: best.y1 });
        labels.push({ g, x: best.x0, y: best.y0 + LABEL_FONT_U * 0.85, anchor: "start", lines, lineH: LABEL_FONT_U * 1.22, rect: { x0: best.x0, x1: best.x1, y0: best.y0, y1: best.y1 } });
        pushLeader(g, best.x0 - 2, best.y0 + LABEL_FONT_U * 0.4);
        stats.labels_in_fallback_slots += 1;
      } else {
        stats.labels_without_slot += 1;
        const lx = Math.min(Math.max(origin.x + 12, box.x0 + 60), box.x1 - 60);
        const ly = Math.min(Math.max(origin.y - 12, box.y0 + 16), box.y1 - 8);
        labels.push({ g, x: lx, y: ly, anchor: "middle", lines, lineH: LABEL_FONT_U * 1.22, rect: labelRectFallback(lx, ly, "middle", lines, LABEL_FONT_U * 1.22, LABEL_FONT_U) });
        pushLeader(g, lx, ly - 4);
      }
      }
    } else {
      labels.push({ g, ...pos });
      // leader meets the label's NEAR edge; for name-only labels the anchor
      // point is that edge, don't run the line under the text to its far side
      const lx = cfg.nameOnlyLabels ? pos.x : pos.anchor === "end" ? pos.x - textW(lines[0], LABEL_FONT_U) : pos.anchor === "middle" ? pos.x - textW(lines[0], LABEL_FONT_U) / 2 : pos.x;
      // B9 (MG rev 11 tiers): a label within 10 mm of its dot needs NO leader;
      // only the second tier (10-25 mm) is tied. Default 24u keeps frozen sheets.
      // H4110 pins: noLeader skips the tie - the long leaders are the вынос
      // MG rejects and the straight lines would run through neighbor chips.
      const pinSkipLeader = pos.noLeader === true && !squeezed && !squeezed3 && !g.anchorPx && !g.displaced;
      const leaderDist = cfg.leaderDistThresholdU ?? 24;
      let leaderObj = null;
      if (!pinSkipLeader && (squeezed || squeezed3 || g.anchorPx || Math.hypot(lx - g.px2, pos.y - g.py2) > leaderDist || g.displaced)) {
        leaderObj = pushLeader(g, lx, pos.y - 2);
      }
      if (leaderTags) leaderTags.set(g, { leaderObj, pinSkipLeader, squeezed, squeezed3 });
      if (squeezed3 || (squeezed && !cfg.cleanSlotsOnly)) stats.labels_last_resort += 1;
      else if (squeezed) stats.labels_squeezed += 1;
      else if (cfg.truePlace && pos && pos.dist > B7_LABEL_CAP_U) stats.labels_squeezed += 1;
    }
  }

  // H4144 global label solver: the greedy walk places each label into the
  // FIRST clean slot it sees, so moving one label re-rolls every later one
  // (the H4120 bisection measured 12-14-label cascades reaching the Indian
  // Ocean). This pass keeps the walk's result only as an INITIALIZATION and
  // then hill-climbs: each label (fixed width-desc order, pinned excluded)
  // is re-evaluated against ALL other boxes at once and moves only on a
  // strict total-cost improvement. Deterministic: no randomness, fixed
  // iteration order, ties keep the current slot; two runs render byte-ident
  // SVGs. Far labels keep their slots (their cost is already ~0), so the
  // cascade dies at the root instead of being frozen pin by pin.
  if (cfg.globalPlace) {
    const P = cfg.labelAir ? B8_LABEL_PAD_U : 2.5;
    const movable = labels.filter((l) => !pinned.has(l.g));
    const ownPlaced = new Map();
    for (const l of movable) {
      ownPlaced.set(l, placed.find((b) => Math.abs(b.x0 - (l.rect.x0 - P)) < 1e-6 && Math.abs(b.x1 - (l.rect.x1 + P)) < 1e-6 && Math.abs(b.y0 - (l.rect.y0 - P)) < 1e-6 && Math.abs(b.y1 - (l.rect.y1 + P)) < 1e-6) || null);
    }
    // chip obstacle boxes are HARD: the label_chip_violations gate is binary,
    // so a candidate overlapping a chip's ±10 box costs a prohibitive penalty
    const chipBoxSet = new Set();
    if (cfg.chipObstacles) {
      const pad = cfg.labelAir ? 10 : cfg.truePlace ? 9 : cfg.numberAll ? 11 : 11;
      for (const g of onMap) {
        const b = placed.find((q) => Math.abs(q.x0 - (g.px2 - pad)) < 1e-6 && Math.abs(q.x1 - (g.px2 + pad)) < 1e-6 && Math.abs(q.y0 - (g.py2 - pad)) < 1e-6 && Math.abs(q.y1 - (g.py2 + pad)) < 1e-6);
        if (b) chipBoxSet.add(b);
      }
    }
    const geomOf = (l, anchor, lx2, ly2, dy, tightUp, widest, lineH, blockH) => {
      let bx0, bx1, by0, by1, ly;
      if (anchor === "start") { bx0 = lx2; bx1 = lx2 + widest; }
      else if (anchor === "end") { bx0 = lx2 - widest; bx1 = lx2; }
      else { bx0 = lx2 - widest / 2; bx1 = lx2 + widest / 2; }
      if (dy < 0) { ly = ly2 - blockH * 0.1; by0 = tightUp ? ly - lineH * 0.8 : ly - blockH + lineH * 0.25; by1 = ly + lineH * 0.25; }
      else if (dy > 0) { ly = ly2 + lineH * 0.8; by0 = ly - lineH * 0.8; by1 = by0 + blockH; }
      else { ly = ly2 + lineH * 0.34; by0 = ly - lineH * 0.8; by1 = by0 + blockH; }
      return { x: lx2, y: ly, anchor, bx0, bx1, by0, by1 };
    };
    const costOf = (rect, others) => {
      let c = 0;
      for (const b of others) {
        const ox = Math.min(rect.x1 + P, b.x1) - Math.max(rect.x0 - P, b.x0);
        const oy = Math.min(rect.y1 + P, b.y1) - Math.max(rect.y0 - P, b.y0);
        if (ox > 0 && oy > 0) c += chipBoxSet.has(b) ? 1e6 + ox * oy : (ox * oy) / 10000;
      }
      return c;
    };
    const distCost = (l, x, y) => {
      const d = Math.hypot(x - l.g.px, y - l.g.py);
      return d > B7_LABEL_CAP_U ? (d - B7_LABEL_CAP_U) * 0.05 : 0;
    };
    let stats_solver_moves = 0;
    for (let sweep = 0; sweep < 10; sweep++) {
      let moved = 0;
      for (const l of movable) {
        const own = ownPlaced.get(l);
        const others = own ? placed.filter((b) => b !== own) : placed;
        const widest = Math.max(...l.lines.map((t) => textW(t, LABEL_FONT_U)));
        const lineH = l.lineH;
        const blockH = l.lines.length * lineH;
        const tightUp = !!cfg.tightUpwardBoxes;
        const startR = markerRadU(l.g) + 4;
        const maxDist = l.g.primary.head.includes("+") ? 160 : cfg.truePlaceSecondTier ? 100 : B7_LABEL_CAP_U;
        const cands = [{ x: l.x, y: l.y, anchor: l.anchor, rect: { ...l.rect }, dy: 0 }];
        for (let r = startR; r <= maxDist; r += B7_TRUE_RING_STEP) {
          for (const [dx, dy, anchor] of TRUE_DIRS) {
            const len = Math.hypot(dx, dy) || 1;
            const lx2 = dx !== 0 ? l.g.px + (dx / len) * r : l.g.px;
            const ly2 = dy !== 0 ? l.g.py + (dy / len) * r : l.g.py;
            const gm = geomOf(l, anchor, lx2, ly2, dy, tightUp, widest, lineH, blockH);
            if (gm.bx0 < box.x0 + 2 || gm.bx1 > box.x1 - 2 || gm.by0 < box.y0 + 2 || gm.by1 > box.y1 - 2) continue;
            cands.push({ x: gm.x, y: gm.y, anchor, rect: { x0: gm.bx0, x1: gm.bx1, y0: gm.by0, y1: gm.by1 }, dy });
          }
        }
        const baseCost = costOf(l.rect, others) + distCost(l, l.x, l.y);
        let best = null;
        for (const c of cands) {
          const cost = costOf(c.rect, others) + distCost(l, c.x, c.y);
          if (cost < baseCost - 1e-9 && (!best || cost < best.cost)) best = { ...c, cost };
        }
        if (best) {
          l.x = best.x; l.y = best.y; l.anchor = best.anchor;
          l.rect = best.rect;
          l.dist = Math.hypot(best.x - l.g.px, best.y - l.g.py);
          if (own) { own.x0 = best.rect.x0 - P; own.x1 = best.rect.x1 + P; own.y0 = best.rect.y0 - P; own.y1 = best.rect.y1 + P; }
          moved += 1; stats_solver_moves += 1;
        }
      }
      if (!moved) break;
    }
    stats.solver_moves = stats_solver_moves;
    // leaders re-targeted to the FINAL anchor edges; the tier rule re-applied
    for (const l of labels) {
      const tag = leaderTags && leaderTags.get(l.g);
      if (!tag) continue; // pinned labels keep their reserved leader state
      const lx = cfg.nameOnlyLabels ? l.x : l.anchor === "end" ? l.x - textW(l.lines[0], LABEL_FONT_U) : l.anchor === "middle" ? l.x - textW(l.lines[0], LABEL_FONT_U) / 2 : l.x;
      const leaderDist = cfg.leaderDistThresholdU ?? 24;
      const want = !tag.pinSkipLeader && (tag.squeezed || tag.squeezed3 || l.g.anchorPx || Math.hypot(lx - l.g.px2, l.y - l.g.py2) > leaderDist || l.g.displaced);
      if (tag.leaderObj && want) { tag.leaderObj.x2 = lx; tag.leaderObj.y2 = l.y - 2; }
      else if (tag.leaderObj && !want) { leaders.splice(leaders.indexOf(tag.leaderObj), 1); tag.leaderObj = null; }
      else if (!tag.leaderObj && want) { tag.leaderObj = pushLeader(l.g, lx, l.y - 2); }
    }
    // max_leader honest recompute from the FINAL leader geometry
    stats.max_leader_mm = 0;
    for (const l of labels) {
      const tag = leaderTags && leaderTags.get(l.g);
      if (tag && tag.leaderObj) {
        const d = Math.hypot(tag.leaderObj.x2 - l.g.px2, tag.leaderObj.y2 - l.g.py2) / 4;
        stats.max_leader_mm = Math.max(stats.max_leader_mm, d);
      }
    }
  }

  // H4051: how far the names actually landed from their dots, and how many
  // were never drawn. MG rev 11: «алгоритм ... уносит их далеко от точек
  // привязки» - until now nothing measured that, so eleven revisions argued
  // about it in prose.
  {
    const offsets = labels.map((l) => (l.rect ? rectGap(l.rect, l.g.px, l.g.py) / U : 0)).sort((a, b) => a - b);
    stats.names_requested = mainLabeled.filter((e) => !coveredSet.has(e.g)).length;
    stats.names_drawn = labels.length;
    stats.names_not_drawn = Math.max(0, stats.names_requested - stats.names_drawn);
    stats.names_at_true_place = labels.filter((l) => l.dist == null || l.dist <= B7_LABEL_CAP_U).length;
    stats.label_offset_p50_mm = Number(percentile(offsets, 0.5).toFixed(2));
    stats.label_offset_p90_mm = Number(percentile(offsets, 0.9).toFixed(2));
    stats.label_offset_max_mm = Number((offsets.length ? offsets[offsets.length - 1] : 0).toFixed(2));
  }

  // markers + chips on the main map
  for (const g of onMap) {
    if (coveredSet.has(g)) continue;
    if (cfg.numberAll) {
      // B5: every group is a numbered chip - filled = discussed, outline =
      // mentioned; naked dots abolished
      if (g.conditional) {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="10.5" fill="none" stroke="#111111" stroke-width="0.55" stroke-dasharray="2.2 1.8"/>`);
      }
      const chipDash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
      const chipFill = g.discussed ? FILLED : "#ffffff";
      const chipTextFill = g.discussed ? "#ffffff" : "#111111";
      s.push(
        `<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="7" fill="${chipFill}" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(g.px2)}" y="${f(g.py2 + 2.5)}" text-anchor="middle" font-size="7.2" fill="${chipTextFill}">${g.number}</text>`
      );
    } else if (g.discussed) {
      if (g.lineClass === "west") {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="2.8" fill="#ffffff" stroke="#111111" stroke-width="1.1"/>`);
      } else {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="2.8" fill="${FILLED}" stroke="#ffffff" stroke-width="0.7"/>`);
      }
      if (g.conditional) {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="6" fill="none" stroke="#111111" stroke-width="0.55" stroke-dasharray="2.2 1.8"/>`);
      }
    } else {
      if (g.conditional) {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="10.5" fill="none" stroke="#111111" stroke-width="0.55" stroke-dasharray="2.2 1.8"/>`);
      }
      const chipDash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
      s.push(
        `<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="7" fill="#ffffff" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(g.px2)}" y="${f(g.py2 + 2.5)}" text-anchor="middle" font-size="7.2" fill="#111111">${g.number}</text>`
      );
    }
  }
  for (const l of leaders) {
    s.push(`<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}" stroke="#55524c" stroke-width="0.4"${l.dash ? ` stroke-dasharray="${l.dash}"` : ""}/>`);
    countLink("label_leader", l.x1, l.y1, l.x2, l.y2);
  }
  for (const l of labels) {
    s.push(textBlockSvg(l, LABEL_FONT_U));
  }

  // inset content above everything in its box; for B3 the strip sits BELOW
  // the map frame, so it must be drawn OUTSIDE the map clip group
  const drawInset = () => {
    if (!insetCtx) return;
    const { west, inset, ib, fitBox } = insetCtx;
    s.push(`<rect x="${f(ib.x0)}" y="${f(ib.y0)}" width="${f(ib.x1 - ib.x0)}" height="${f(ib.y1 - ib.y0)}" fill="#ffffff"/>`);
    s.push(`<g clip-path="url(#inset-clip-${cfg.key})">`);
    s.push(`<path d="${inset.geopath(landObj)}" fill="#e9e5dc" stroke="#4a4640" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"/>`);
    s.push(`<path d="${inset.geopath(graticule)}" fill="none" stroke="#cdc8be" stroke-width="0.45"/>`);
    for (const g of west) {
      if (!g.areal) continue;
      const pts = g.areal.map(([lon, lat]) => inset.projection([lon, lat]));
      if (pts.some((p) => !p || Number.isNaN(p[0]))) continue;
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${f(p[0])},${f(p[1])}`).join("") + "Z";
      s.push(`<path d="${d}" fill="url(#hatch-${cfg.key})" fill-opacity="0.30" stroke="#3d3a34" stroke-width="0.9" stroke-dasharray="5 3"/>`);
      stats.areals_drawn += 1;
    }
    const iPlaced = [];
    const insetChipR = cfg.insetChipR || 7;
    const insetChipFont = cfg.insetChipFont || 7.2;
    const insetChipPad = insetChipR + 1;
    // B7 insetRelax: chips spread inside the inset with leader stubs to their
    // true spots (fixes chip-over-chip merges like 82 over 67 / blind 79-70)
    let iPos = null;
    if (cfg.insetRelax) {
      const clones = west.map((g) => ({ ...g, px: g.ipx, py: g.ipy }));
      relaxD(clones, fitBox, insetChipR, cfg.insetRelaxGap);
      iPos = new Map(west.map((g, i) => [g, clones[i]]));
    }
    const icx = (g) => (iPos ? iPos.get(g).px2 : g.ipx);
    const icy = (g) => (iPos ? iPos.get(g).py2 : g.ipy);
    if (iPos) {
      for (const g of west) {
        const c = iPos.get(g);
        if (!c.displaced) continue;
        s.push(`<line x1="${f(g.ipx)}" y1="${f(g.ipy)}" x2="${f(c.px2)}" y2="${f(c.py2)}" stroke="#55524c" stroke-width="0.4"/>`);
        s.push(`<circle cx="${f(g.ipx)}" cy="${f(g.ipy)}" r="1.7" fill="none" stroke="#111111" stroke-width="0.5"/>`);
        countLink("inset_stub", g.ipx, g.ipy, c.px2, c.py2);
      }
    }
    for (const g of west) {
      if (!g.discussed) {
        const chipDash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
        if (!cfg.insetChipR) {
          s.push(
            `<circle cx="${f(icx(g))}" cy="${f(icy(g))}" r="7" fill="#ffffff" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(icx(g))}" y="${f(icy(g) + 2.5)}" text-anchor="middle" font-size="7.2" fill="#111111">${g.number}</text>`
          );
        } else {
          s.push(
            `<circle cx="${f(icx(g))}" cy="${f(icy(g))}" r="${f(insetChipR)}" fill="#ffffff" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(icx(g))}" y="${f(icy(g) + insetChipFont * 0.35)}" text-anchor="middle" font-size="${insetChipFont}" fill="#111111">${g.number}</text>`
          );
        }
        iPlaced.push({ x0: icx(g) - insetChipPad, x1: icx(g) + insetChipPad, y0: icy(g) - insetChipPad, y1: icy(g) + insetChipPad });
      } else {
        if (cfg.insetChipDiscussed) {
          // B6: every point is a numbered chip, even inside the inset - the
          // name label goes next to it (fill marks «обсуждается» as on the map)
          const chipDash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
          s.push(
            `<circle cx="${f(icx(g))}" cy="${f(icy(g))}" r="${f(insetChipR)}" fill="${FILLED}" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(icx(g))}" y="${f(icy(g) + insetChipFont * 0.35)}" text-anchor="middle" font-size="${insetChipFont}" fill="#ffffff">${g.number}</text>`
          );
          iPlaced.push({ x0: icx(g) - insetChipPad, x1: icx(g) + insetChipPad, y0: icy(g) - insetChipPad, y1: icy(g) + insetChipPad });
        } else {
        const g2 = { ...g, px2: g.ipx, py2: g.ipy, anchor: null };
        if (g2.lineClass === "west") {
          s.push(`<circle cx="${f(g.ipx)}" cy="${f(g.ipy)}" r="2.8" fill="#ffffff" stroke="#111111" stroke-width="1.1"/>`);
        } else {
          s.push(`<circle cx="${f(g.ipx)}" cy="${f(g.ipy)}" r="2.8" fill="${FILLED}" stroke="#ffffff" stroke-width="0.7"/>`);
        }
        iPlaced.push({ x0: g.ipx - 4, x1: g.ipx + 4, y0: g.ipy - 4, y1: g.ipy + 4 });
        }
      }
    }
    const iLabeled = west
      .filter((g) => g.discussed)
      .map((g) => ({ g, width: Math.max(...wrapText(g.mapName, 20, 2).map((l) => textW(l, INSET_LABEL_FONT_U))) }))
      .sort((a, b) => b.width - a.width);
    for (const { g } of iLabeled) {
      const lines = wrapText(g.mapName, 20, 2);
      const pos = placeLabel(g, icx(g), icy(g), lines, iPlaced, fitBox, INSET_LABEL_FONT_U, fitBox);
      if (pos) {
        s.push(textBlockSvg({ g, ...pos }, INSET_LABEL_FONT_U));
      } else {
        if (!cfg.insetLabelsSoft) stats.labels_without_slot += 1;
        // fallback: right-aligned into the inset's top-right corner - always
        // inside the box, stacked if several fail (below the framed title bar)
        if (!drawInset._fb) drawInset._fb = 0;
        s.push(
          textBlockSvg(
            { g, x: ib.x1 - 4, y: ib.y0 + (cfg.insetCaptionFramed ? 46 : 12) + drawInset._fb * 10, anchor: "end", lines, lineH: INSET_LABEL_FONT_U * 1.22 },
            INSET_LABEL_FONT_U
          )
        );
        drawInset._fb += 1;
      }
    }
    s.push(`</g>`);
    s.push(
      `<rect x="${f(ib.x0)}" y="${f(ib.y0)}" width="${f(ib.x1 - ib.x0)}" height="${f(ib.y1 - ib.y0)}" fill="none" stroke="#111111" stroke-width="1.2"/>` +
        (() => {
          // B7 insetCaptionFramed: the caption is a framed title bar ON the
          // inset frame - «в рамочку и ближе» (MG rev 9), never floating
          // H4120: insetCaptionItalic - the caption goes italic, B9/B10 only
          // (cfg-gated, B7/B8 keep their upright bytes)
          if (cfg.insetCaptionFramed) {
            const barH = 30;
            const italic = cfg.insetCaptionItalic ? ' font-style="italic"' : "";
            return `<rect x="${f(ib.x0)}" y="${f(ib.y0)}" width="${f(ib.x1 - ib.x0)}" height="${f(barH)}" fill="#ffffff" stroke="#111111" stroke-width="0.7"/><text x="${f((ib.x0 + ib.x1) / 2)}" y="${f(ib.y0 + 20)}" text-anchor="middle" font-size="10" font-weight="bold"${italic} fill="#33302b">${esc(cfg.insetCaption || WEST_CAPTION)}</text>`;
          }
          // B6 insetCaptionBelow: the core fills the box to its south edge -
          // an inside-bottom caption ran over chips 37/38; it moves below the
          // box with a white halo (safe: the band under the NE inset is empty)
          if (!cfg.insetCaptionBelow) {
            return `<text x="${f((ib.x0 + ib.x1) / 2)}" y="${f(ib.y1 - 6)}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#33302b">${esc(cfg.insetCaption || WEST_CAPTION)}</text>`;
          }
          return `<text x="${f((ib.x0 + ib.x1) / 2)}" y="${f(ib.y1 + 44)}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#33302b" stroke="#ffffff" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round">${esc(cfg.insetCaption || WEST_CAPTION)}</text>`;
        })()
    );
  };

  if (insetCtx && !cfg.insetGeo) drawInset();

  s.push(`</g>`);

  // B3: mark the dense zone on the main map - thin reference rectangle
  if (cfg.refRect && cfg.insetGeo) {
    const cs = [
      projection([cfg.insetGeo.lon0, cfg.insetGeo.lat0]),
      projection([cfg.insetGeo.lon1, cfg.insetGeo.lat0]),
      projection([cfg.insetGeo.lon1, cfg.insetGeo.lat1]),
      projection([cfg.insetGeo.lon0, cfg.insetGeo.lat1]),
    ];
    const xs = cs.map((c) => c[0]);
    const ys = cs.map((c) => c[1]);
    const rx0 = Math.min(...xs);
    const rx1 = Math.max(...xs);
    const ry0 = Math.min(...ys);
    const ry1 = Math.max(...ys);
    // H4110 v2 (MG 05-09-2026: «убрать см. врезку — мешает, закрывает видимость»):
    // the caption text is gone on every sheet - B9/B10 dropped it in rev 12,
    // the refRect sheets (B3/B7/B8) lose it here; the dashed source box + the
    // ref line still say what is magnified.
    s.push(
      `<rect x="${f(rx0)}" y="${f(ry0)}" width="${f(rx1 - rx0)}" height="${f(ry1 - ry0)}" fill="none" stroke="#111111" stroke-width="0.7" stroke-dasharray="3 2"/>`
    );
  }

  // B7 refLine: a thin dashed connector from the inset frame to its dashed
  // source box - the reader sees exactly WHAT is magnified and WHERE it sits
  if (cfg.refLine && cfg.insetGeo && insetCtx && cfg.refRect) {
    const cs = [
      projection([cfg.insetGeo.lon1, cfg.insetGeo.lat0]),
      projection([cfg.insetGeo.lon1, cfg.insetGeo.lat1]),
    ];
    const srcX = Math.max(...cs.map((c) => c[0]));
    const srcY = Math.max(...cs.map((c) => c[1]));
    const sx = (cfg.inset.box.x0 + 12) * U;
    const sy = cfg.inset.box.y0 * U;
    s.push(`<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(srcX)}" y2="${f(srcY)}" stroke="#55524c" stroke-width="0.45" stroke-dasharray="4 3"/>`);
    countLink("inset_ref_line", sx, sy, srcX, srcY);
  }

  // B9 (MG 04-09-2026): the inset source is a HATCHED square on the map with
  // an ARROW from the inset frame - «чтобы понять какое именно место на карте
  // она увеличивает». The hatch fill is the same pattern as areals, but the
  // dashed frame + arrow make it a pointer, not a language zone.
  if (cfg.insetSourceArrow && cfg.insetGeo && insetCtx) {
    const cs = [
      projection([cfg.insetGeo.lon0, cfg.insetGeo.lat0]),
      projection([cfg.insetGeo.lon1, cfg.insetGeo.lat0]),
      projection([cfg.insetGeo.lon1, cfg.insetGeo.lat1]),
      projection([cfg.insetGeo.lon0, cfg.insetGeo.lat1]),
    ];
    const rx0 = Math.min(...cs.map((c) => c[0]));
    const rx1 = Math.max(...cs.map((c) => c[0]));
    const ry0 = Math.min(...cs.map((c) => c[1]));
    const ry1 = Math.max(...cs.map((c) => c[1]));
    s.push(
      // MG rev 12 point 2: no «см. врезку» caption - it overlapped and got in
      // the way; the hatched square + arrow say it on their own.
      // H4110 v2 (MG 05-09-2026: only the bottom-right edge read over the
      // Rus-core chip wall): white casing + border 0.7 -> 1.6 so the square
      // reads as a square at a glance.
      `<rect x="${f(rx0)}" y="${f(ry0)}" width="${f(rx1 - rx0)}" height="${f(ry1 - ry0)}" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-dasharray="3 2"/>`,
      `<rect x="${f(rx0)}" y="${f(ry0)}" width="${f(rx1 - rx0)}" height="${f(ry1 - ry0)}" fill="url(#hatch-${cfg.key})" fill-opacity="0.35" stroke="#111111" stroke-width="1.6" stroke-dasharray="3 2"/>`
    );
    // arrow: inset frame's top-left corner region -> centre of the source
    // square, arrowhead at the square
    const sx = (cfg.inset.box.x0 + 12) * U;
    const sy = cfg.inset.box.y0 * U;
    const cx = (rx0 + rx1) / 2;
    const cy = (ry0 + ry1) / 2;
    const len = Math.hypot(cx - sx, cy - sy) || 1;
    const head = 9;
    // stop the shaft short of the head so the tip lands on the centre
    const bx = cx - ((cx - sx) / len) * head;
    const by = cy - ((cy - sy) / len) * head;
    // H4110 v2: white casing + thicker shaft - the arrow crosses the chip wall.
    s.push(`<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(bx)}" y2="${f(by)}" stroke="#ffffff" stroke-width="3"/>`);
    s.push(`<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(bx)}" y2="${f(by)}" stroke="#33302b" stroke-width="1.3"/>`);
    const ux = (cx - sx) / len;
    const uy = (cy - sy) / len;
    const px = -uy;
    const py = ux;
    s.push(
      `<path d="M ${f(cx)} ${f(cy)} L ${f(bx + px * head * 0.42)} ${f(by + py * head * 0.42)} L ${f(bx - px * head * 0.42)} ${f(by - py * head * 0.42)} Z" fill="#33302b"/>`
    );
    countLink("inset_ref_line", sx, sy, cx, cy);
  }

  if (insetCtx && cfg.insetGeo) drawInset();

  // B5: Kiev-triangle loupe in the empty NE corner - chips + names at ~14x
  if (cfg.loupeGeo && cfg.numberAll) {
    const lm = groups.filter(
      (g) => g.lat >= cfg.loupeGeo.lat0 && g.lat <= cfg.loupeGeo.lat1 && g.lon >= cfg.loupeGeo.lon0 && g.lon <= cfg.loupeGeo.lon1
    );
    const lp = buildProjection(cfg.loupeBox, lm.map((g) => [g.lon, g.lat]), B5_LOUPE_PAD);
    s.push(`<rect x="${f(cfg.loupeBox.x0 * U)}" y="${f(cfg.loupeBox.y0 * U)}" width="${f((cfg.loupeBox.x1 - cfg.loupeBox.x0) * U)}" height="${f((cfg.loupeBox.y1 - cfg.loupeBox.y0) * U)}" fill="#ffffff"/>`);
    s.push(`<g clip-path="url(#loupe-clip-${cfg.key})">`);
    s.push(`<path d="${lp.geopath(landObj)}" fill="#e9e5dc" stroke="#4a4640" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"/>`);
    s.push(`<path d="${lp.geopath(graticule)}" fill="none" stroke="#cdc8be" stroke-width="0.45"/>`);
    const lPlaced = [];
    for (const g of lm) {
      const [cx, cy] = lp.projection([g.lon, g.lat]);
      const chipDash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
      const chipFill = g.discussed ? "#111111" : "#ffffff";
      const chipTextFill = g.discussed ? "#ffffff" : "#111111";
      s.push(
        `<circle cx="${f(cx)}" cy="${f(cy)}" r="7" fill="${chipFill}" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(cx)}" y="${f(cy + 2.5)}" text-anchor="middle" font-size="7.2" fill="${chipTextFill}">${g.number}</text>`
      );
      lPlaced.push({ x0: cx - 8, x1: cx + 8, y0: cy - 8, y1: cy + 8 });
    }
    for (const g of lm) {
      if (!g.discussed) continue;
      const lines = wrapText(g.mapName, 20, 2);
      const pos = placeLabel(g, ...lp.projection([g.lon, g.lat]), lines, lPlaced, lp.box, 8.5, lp.box);
      s.push(textBlockSvg({ g, ...(pos || { x: lp.box.x1 - 4, y: lp.box.y0 + 12, anchor: "end" }), lines, lineH: 8.5 * 1.22 }, 8.5));
    }
    s.push(`</g>`);
    s.push(
      `<rect x="${f(cfg.loupeBox.x0 * U)}" y="${f(cfg.loupeBox.y0 * U)}" width="${f((cfg.loupeBox.x1 - cfg.loupeBox.x0) * U)}" height="${f((cfg.loupeBox.y1 - cfg.loupeBox.y0) * U)}" fill="none" stroke="#111111" stroke-width="1.2"/>` +
        `<text x="${f((cfg.loupeBox.x0 + cfg.loupeBox.x1) / 2 * U)}" y="${f(cfg.loupeBox.y1 * U - 6)}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#33302b">${esc(B5_LOUPE_CAPTION)}</text>`
    );
    // thin reference line: loupe corner -> the triangle on the main map
    const [tx, ty] = projection([30.8, 50.8]);
    s.push(`<line x1="${f(cfg.loupeBox.x0 * U)}" y1="${f(cfg.loupeBox.y1 * U - 2)}" x2="${f(tx)}" y2="${f(ty)}" stroke="#55524c" stroke-width="0.4" stroke-dasharray="3 2"/>`);
    countLink("loupe_ref_line", cfg.loupeBox.x0 * U, cfg.loupeBox.y1 * U - 2, tx, ty);
    if (cfg.loupeRefRect) {
      const cs = [
        projection([cfg.loupeGeo.lon0, cfg.loupeGeo.lat0]),
        projection([cfg.loupeGeo.lon1, cfg.loupeGeo.lat0]),
        projection([cfg.loupeGeo.lon1, cfg.loupeGeo.lat1]),
        projection([cfg.loupeGeo.lon0, cfg.loupeGeo.lat1]),
      ];
      const xs = cs.map((c) => c[0]);
      const ys = cs.map((c) => c[1]);
      s.push(
        `<rect x="${f(Math.min(...xs))}" y="${f(Math.min(...ys))}" width="${f(Math.max(...xs) - Math.min(...xs))}" height="${f(Math.max(...ys) - Math.min(...ys))}" fill="none" stroke="#111111" stroke-width="0.7" stroke-dasharray="3 2"/>` +
          `<text x="${f(Math.min(...xs) + 6)}" y="${f(Math.min(...ys) - 4)}" font-size="7.5" fill="#33302b" stroke="#ffffff" stroke-width="1.4" paint-order="stroke" stroke-linejoin="round">см. лупу</text>`
      );
    }
  }

  // B4: covered chips/labels relocate below the inset edge, stub leaders
  // point up toward the covered true spots
  if (covered.length) {
    const byEdge = cfg.inset.box.y1 * U;
    const sorted = covered.slice().sort((a, b) => a.px2 - b.px2);
    sorted.forEach((g, i) => {
      const y = byEdge + 10 + i * 16;
      const dash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
      s.push(`<line x1="${f(g.px2)}" y1="${f(byEdge + 2)}" x2="${f(g.px2)}" y2="${f(y - (g.discussed ? 4 : 9))}" stroke="#55524c" stroke-width="0.4"${dash}/>`);
      countLink("covered_relocate_stub", g.px2, byEdge + 2, g.px2, y - (g.discussed ? 4 : 9));
      if (g.discussed) {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(y)}" r="2.8" fill="${FILLED}" stroke="#ffffff" stroke-width="0.7"/>`);
        // B6 coveredLabelFlip: near the right frame edge the name flips to the
        // left of the dot (frozen b4 keeps its exact v4.17.19 output)
        const covLines = wrapText(g.mapName, 26, 2);
        const covW = Math.max(...covLines.map((l) => textW(l, LABEL_FONT_U)));
        const covRight = cfg.coveredLabelFlip && g.px2 + 10 + covW > box.x1 - 6;
        s.push(textBlockSvg({ g, x: covRight ? g.px2 - 10 : g.px2 + 10, y: y + 4, anchor: covRight ? "end" : "start", lines: covLines, lineH: LABEL_FONT_U * 1.22 }, LABEL_FONT_U));
      } else {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(y)}" r="7" fill="#ffffff" stroke="#111111" stroke-width="0.6"${dash}/><text x="${f(g.px2)}" y="${f(y + 2.5)}" text-anchor="middle" font-size="7.2" fill="#111111">${g.number}</text>`);
      }
    });
  }

  // escapes: every label rect must sit inside its frame
  // H4051: measured on the rect the PLACER reserved (l.rect), not on a
  // re-derived one. The old formula assumed the dy === 0 geometry for every
  // label, so an upward two-line stack was checked against a box shifted a
  // whole line down - it could not see a real escape and could invent one.
  for (const l of labels) {
    const r = l.rect || labelRectFallback(l.x, l.y, l.anchor, l.lines, l.lineH, LABEL_FONT_U);
    if (r.x0 < box.x0 || r.x1 > box.x1 || r.y0 < box.y0 || r.y1 > box.y1) stats.escapes += 1;
  }

  // B3 gate: every legend number keeps >= 1.5 mm of clear space from name labels
  if (cfg.chipObstacles) {
    let viol = 0;
    for (const l of labels) {
      const r = l.rect || labelRectFallback(l.x, l.y, l.anchor, l.lines, l.lineH, LABEL_FONT_U);
      for (const g of onMap) {
        if ((g.discussed && !cfg.numberAll) || coveredSet.has(g) || g === l.g) continue;
        if (rectGap(r, g.px2, g.py2) < 11) viol += 1;
      }
    }
    stats.label_chip_violations = viol;
  }

  // frame
  s.push(
    `<rect x="${f(frame.x)}" y="${f(frame.y)}" width="${f(frame.w)}" height="${f(frame.h)}" fill="none" stroke="#111111" stroke-width="1.6"/>` +
      `<rect x="${f(frame.x + 5)}" y="${f(frame.y + 5)}" width="${f(frame.w - 10)}" height="${f(frame.h - 10)}" fill="none" stroke="#111111" stroke-width="0.45"/>`
  );
  }

  // scale bar
  if (cfg.scaleBar) {
    const refLat = 45;
    const c0 = projection([30, refLat]);
    const c1 = projection([31, refLat]);
    const kmPerUnit = (111.32 * Math.cos((refLat * Math.PI) / 180)) / Math.abs(c1[0] - c0[0]);
    const barKm = 1000;
    const barU = barKm / kmPerUnit;
    const barX = frame.x + 12;
    const barY = frame.y + frame.h - 12;
    s.push(
      `<rect x="${f(barX)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#111111"/>` +
        `<rect x="${f(barX + barU / 4)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#ffffff" stroke="#111111" stroke-width="0.5"/>` +
        `<rect x="${f(barX + barU / 2)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#111111"/>` +
        `<rect x="${f(barX + (barU * 3) / 4)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#ffffff" stroke="#111111" stroke-width="0.5"/>` +
        `<text x="${f(barX)}" y="${f(barY + 6.5)}" font-size="7" fill="#111111">0</text>` +
        `<text x="${f(barX + barU / 2)}" y="${f(barY + 6.5)}" text-anchor="middle" font-size="7" fill="#111111">${barKm / 2}</text>` +
        `<text x="${f(barX + barU)}" y="${f(barY + 6.5)}" text-anchor="middle" font-size="7" fill="#111111">${barKm}</text>` +
        `<text x="${f(barX + barU + 8)}" y="${f(barY + 6.5)}" font-size="7" fill="#111111">км</text>`
    );
  }

  // CIS anchors must sit east of 55E (MG: former-CIS labels move onto RF territory);
  // sheets that retire anchors (B2) still gate the data property
  for (const g of inMain) {
    if (g.anchor && (g.anchorPx || cfg.ignoreAnchors) && g.anchor.lon >= 55) stats.cis_anchored_ok += 1;
  }

  // legend
  const numbered = groups.filter((g) => !g.discussed);
  // H4051: legend rows follow the oldest-first ruling on sheets that opt in;
  // frozen legends keep their alphabetical join, so their bytes do not move.
  const legendName = (g) => (cfg.displayOrder ? NAME_ORDER_OLDEST_FIRST.get(g.display) || g.display : g.display);
  if (cfg.legend === "spread") {
    // MG visa fix: the whole numbered legend lives in ONE full-height side
    // column (was: 3 short strip columns + a 7-row side column), and the map
    // grows down into the freed strip area (MAP_BOX_A y1 154 -> 195).
    s.push(
      `<text x="${SIDE_X0 * U}" y="${f(SIDE_TITLE_Y * U)}" font-size="11.5" font-weight="bold" fill="#111111">Легенда: топонимы</text>` +
        `<text x="${SIDE_X0 * U}" y="${f(SIDE_NOTE1_Y * U)}" font-size="7.8" fill="#33302b">номер у точки на карте ·</text>` +
        `<text x="${SIDE_X0 * U}" y="${f(SIDE_NOTE2_Y * U)}" font-size="7.8" fill="#33302b">страницы книги, где встречается название</text>`
    );
    const sideColW = (SIDE_X1 - SIDE_X0) * U;
    const maxChars = Math.floor((sideColW - 12) / (SIDE_FONT_U * CHAR_W));
    let cursor = SIDE_ROWS_Y * U;
    const cursorY1 = SIDE_ROWS_Y1 * U;
    for (const g of numbered) {
      const row = legendRowSvg(SIDE_X0 * U, cursor, SIDE_FONT_U, maxChars, g, 2, LEGEND_ROW_H, 11, legendName(g));
      if (!row.parity) stats.legend_parity_ok = false;
      if (cursor + row.rowH > cursorY1) {
        stats.legend_overflow += 1;
        continue;
      }
      s.push(row.svg);
      stats.legend_rows_drawn += 1;
      cursor += row.rowH;
    }
    stats.legend_capacity = Math.floor((cursorY1 - SIDE_ROWS_Y * U) / SIDE_PITCH_U);
    const keyY = 200.5 * U;
    s.push(
      `<text x="${cfg.mapBox.x0 * U}" y="${f(keyY)}" font-size="9" fill="#33302b">Заливка маркера · сплошная выноска — Западная Европа; контур · штриховая выноска — Русь, Византия, Восток; штриховой ареал — языковая зона</text>` +
        `<text x="${SIDE_X1 * U}" y="${f(keyY)}" text-anchor="end" font-size="8.2" fill="#55524c">Основа: Natural Earth (public domain) · коническая конформная проекция</text>`
    );
    s.push(
      `<text x="${cfg.mapBox.x0 * U}" y="${f(keyY + 11)}" font-size="9" fill="#33302b">Пунктирное кольцо — условное расположение («Велесова книга») · «—» — без страниц</text>`
    );
  } else if (cfg.legend === "page") {
    // MG visa fix: legend page filled edge to edge - two-pass layout wraps all
    // rows first, then stretches the row pitch so the columns end at the page
    // bottom instead of half-way down.
    s.push(
      `<text x="${PLEG_X0 * U}" y="${f(PLEG_HEADER_Y * U)}" font-size="15" font-weight="bold" fill="#111111">Легенда: топонимы по номерам</text>` +
        `<text x="${PLEG_X1 * U}" y="${f(PLEG_NOTE_Y * U)}" text-anchor="end" font-size="9" fill="#33302b">номер у точки на карте · страницы книги, где встречается название</text>`
    );
    const colW = ((PLEG_X1 - PLEG_X0) * U) / PLEG_COLS;
    const maxChars = Math.floor((colW - 12) / (PLEG_FONT_U * CHAR_W));
    const wrapped = numbered.map((g) => {
      const expect = g.pages ? `стр. ${g.pages}` : "—";
      const lines = wrapText(`${g.number}. ${legendName(g)} — ${expect}`, maxChars, 3);
      return { g, lines, parity: !g.pages || expect === `стр. ${g.pages}` };
    });
    const totalLines = wrapped.reduce((acc, w) => acc + w.lines.length, 0);
    const rowsAreaU = (PLEG_Y1 - PLEG_ROWS_Y) * U;
    const perColLines = Math.ceil(totalLines / PLEG_COLS);
    const pitch = Math.max(PLEG_FONT_U * 1.25, Math.min(rowsAreaU / perColLines, PLEG_FONT_U * 2.2));
    const lineDy = Math.max(PLEG_FONT_U * 1.18, Math.min(pitch - PLEG_FONT_U * 0.25, PLEG_FONT_U * 1.6));
    const colCap = Math.ceil(totalLines / PLEG_COLS);
    let wi = 0;
    let lineBudget = colCap;
    for (let col = 0; col < PLEG_COLS; col++) {
      let cursor = PLEG_ROWS_Y * U;
      const x = PLEG_X0 * U + col * colW;
      while (wi < wrapped.length) {
        const w = wrapped[wi];
        if (!w.parity) stats.legend_parity_ok = false;
        const rowH = (w.lines.length - 1) * lineDy + PLEG_FONT_U * 1.1;
        if (col < PLEG_COLS - 1 && cursor + rowH > PLEG_ROWS_Y * U + lineBudget * pitch) break;
        if (cursor + rowH > PLEG_Y1 * U) {
          stats.legend_overflow += 1;
          wi += 1;
          continue;
        }
        s.push(
          `<text x="${f(x)}" y="${f(cursor)}" font-size="${PLEG_FONT_U}" fill="#111111">` +
            w.lines.map((line, li) => `<tspan x="${f(x)}" dy="${li === 0 ? 0 : f(lineDy)}">${lineHtml(line)}</tspan>`).join("") +
            `</text>`
        );
        stats.legend_rows_drawn += 1;
        cursor += w.lines.length * pitch;
        wi += 1;
      }
      lineBudget += colCap;
    }
    stats.legend_capacity = PLEG_COLS * colCap;
    const keyY = (PLEG_Y1 + 5) * U;
    s.push(
      `<text x="${PLEG_X0 * U}" y="${f(keyY)}" font-size="8.2" fill="#33302b">Заливка маркера · сплошная выноска — Западная Европа; контур маркера · штриховая выноска — Русь, Византия, Восток</text>` +
        `<text x="${PLEG_X0 * U}" y="${f(keyY + 10)}" font-size="8.2" fill="#33302b">Штриховой ареал — языковая зона · пунктирное кольцо — условное расположение («Велесова книга») · «—» — без страниц</text>` +
        `<text x="${PLEG_X0 * U}" y="${f(keyY + 20)}" font-size="8" fill="#55524c">Основа: Natural Earth (public domain) · коническая конформная проекция</text>`
    );
  } else if (cfg.legend === "page-compact") {
    // MG 03-09-2026: every group numbered - the compact legend carries ALL groups
    // (twice the rows of sheet B) with a fixed content-driven pitch, no stretch air.
    s.push(
      `<text x="${DLEG_X0 * U}" y="${f(DLEG_HEADER_Y * U)}" font-size="13.5" font-weight="bold" fill="#111111">Легенда: топонимы по номерам</text>` +
        `<text x="${DLEG_X1 * U}" y="${f(DLEG_NOTE_Y * U)}" text-anchor="end" font-size="8.2" fill="#33302b">залитый номер — обсуждается в книге · контурный — упоминается</text>`
    );
    if (cfg.stamp) {
      s.push(`<text x="${DLEG_X1 * U}" y="${f(DLEG_HEADER_Y * U)}" text-anchor="end" font-size="7.2" fill="#55524c">${esc(cfg.stamp)}</text>`);
    }
    const colW = ((DLEG_X1 - DLEG_X0) * U) / DLEG_COLS;
    const maxChars = Math.floor((colW - 10) / (DLEG_FONT_U * CHAR_W));
    const wrapped = groups.map((g) => {
      const expect = g.pages ? `стр. ${g.pages}` : "—";
      // B7 legendNumberAll: ONE numbering across map and legend - every row
      // carries its map number, discussed rows keep the ● marker
      const prefix = cfg.legendNumberAll
        ? `${g.number}. ${g.discussed ? "● " : ""}`
        : g.number
          ? `${g.number}. `
          : "● ";
      const lines = wrapText(`${prefix}${legendName(g)} — ${expect}`, maxChars, 3);
      return { g, lines, parity: !g.pages || expect === `стр. ${g.pages}` };
    });
    const totalLines = wrapped.reduce((acc, w) => acc + w.lines.length, 0);
    const rowsAreaU = (DLEG_Y1 - DLEG_ROWS_Y) * U;
    // split entries into columns by line count, closest to half
    const cols = [[], []];
    let acc = 0;
    for (const w of wrapped) {
      if (acc < totalLines / 2) {
        cols[0].push(w);
        acc += w.lines.length;
      } else {
        cols[1].push(w);
      }
    }
    const colLines = cols.map((c) => c.reduce((a, w) => a + w.lines.length, 0));
    const maxColLines = Math.max(...colLines);
    const pitch = Math.max(DLEG_FONT_U * 1.3, Math.min(rowsAreaU / maxColLines, DLEG_FONT_U * 1.62));
    const lineDy = Math.max(DLEG_FONT_U * 1.2, Math.min(pitch - DLEG_FONT_U * 0.15, DLEG_FONT_U * 1.42));
    for (let col = 0; col < DLEG_COLS; col++) {
      let cursor = DLEG_ROWS_Y * U;
      const x = DLEG_X0 * U + col * colW;
      for (const w of cols[col]) {
        if (!w.parity) stats.legend_parity_ok = false;
        const rowH = (w.lines.length - 1) * lineDy + DLEG_FONT_U * 1.05;
        if (cursor + rowH > DLEG_Y1 * U) {
          stats.legend_overflow += 1;
          continue;
        }
        s.push(
          `<text x="${f(x)}" y="${f(cursor)}" font-size="${DLEG_FONT_U}" fill="#111111">` +
            w.lines.map((line, li) => `<tspan x="${f(x)}" dy="${li === 0 ? 0 : f(lineDy)}">${lineHtml(line)}</tspan>`).join("") +
            `</text>`
        );
        stats.legend_rows_drawn += 1;
        cursor += (w.lines.length - 1) * lineDy + pitch;
      }
    }
    stats.legend_capacity = DLEG_COLS * Math.floor(rowsAreaU / pitch);
    const keyY = (DLEG_Y1 + 5) * U;
    const numNote = cfg.legendNumberAll ? " · номер строки = номер на карте" : "";
    s.push(
      `<text x="${DLEG_X0 * U}" y="${f(keyY)}" font-size="7.6" fill="#33302b">Залитый маркер — обсуждается в книге, контурный — упоминается; штриховой контур — Русь, Византия, Восток${numNote}</text>` +
        `<text x="${DLEG_X0 * U}" y="${f(keyY + 9)}" font-size="7.6" fill="#33302b">Штриховой ареал — языковая зона · пунктирное кольцо — условное расположение («Велесова книга») · «—» — без страниц</text>` +
        `<text x="${DLEG_X0 * U}" y="${f(keyY + 18)}" font-size="7.4" fill="#55524c">Основа: Natural Earth (public domain) · коническая конформная проекция${cfg.legendTail || ""}</text>`
    );
  }

  // title + subtitle
  if (cfg.title) {
    s.push(`<text x="${8 * U}" y="${8.4 * U}" font-size="23" font-weight="bold" fill="#111111">Карта топонимов книги</text>`);
    const sub = cfg.subtitleOverride || `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые в книге подписаны с номерами страниц${cfg.legend ? ", остальные раскрывает легенда" : ", номера раскрывает легенда на соседней странице"}`;
    if (cfg.pageW < 200) {
      const subLines = wrapText(sub, 66, 2);
      s.push(
        `<text x="${8 * U}" y="${(8.4 * U + 11).toFixed(1)}" font-size="10" fill="#33302b">` +
          subLines.map((l, i) => `<tspan x="${8 * U}" dy="${i === 0 ? 0 : 12.5}">${esc(l)}</tspan>`).join("") +
          `</text>`
      );
    } else {
      s.push(`<text x="${8 * U}" y="${(8.4 * U + 13).toFixed(1)}" font-size="11" fill="#33302b">${esc(sub)}</text>`);
    }
    if (cfg.stamp) {
      s.push(`<text x="${137 * U}" y="${8.4 * U}" text-anchor="end" font-size="7.2" fill="#55524c">${esc(cfg.stamp)}</text>`);
    }
  }

  s.push("</svg>");
  return { svg: s.join("\n"), stats };
}

// ---------------------------------------------------------------------------
// sheet D2 renderer: two-panel chips-only page (dense zoom + world overview)
// ---------------------------------------------------------------------------

function chipSvgD(x, y, g, r, font) {
  const dash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
  const fill = g.discussed ? "#111111" : "#ffffff";
  const textFill = g.discussed ? "#ffffff" : "#111111";
  const ring = g.conditional
    ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.5)}" fill="none" stroke="#111111" stroke-width="0.55" stroke-dasharray="2.2 1.8"/>`
    : "";
  return (
    ring +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${fill}" stroke="#111111" stroke-width="0.6"${dash}/><text x="${f(x)}" y="${f(y + font * 0.35)}" text-anchor="middle" font-size="${font}" fill="${textFill}">${g.number}</text>`
  );
}

function relaxD(members, box, r, gapU) {
  const pts = members.map((g) => ({ g, x: g.px, y: g.py, ox: g.px, oy: g.py }));
  const x0 = box.x0 + 6;
  const x1 = box.x1 - 6;
  const y0 = box.y0 + 6;
  const y1 = box.y1 - 6;
  for (let it = 0; it < RELAX_ITERATIONS; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        // gapU ?? default: B9 passes 0 - inset chips may touch, same policy as
    // the main map (fewer stubs, no ink overlap)
    const minD = r * 2 + (gapU ?? RELAX_GAP);
        if (d === 0) {
          dx = 0.5;
          dy = 0.5;
          d = Math.hypot(dx, dy);
        }
        if (d < minD) {
          const push = ((minD - d) / d) * 0.3;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
    for (const p of pts) {
      p.x = Math.min(Math.max(p.x, x0), x1);
      p.y = Math.min(Math.max(p.y, y0), y1);
    }
  }
  for (const p of pts) {
    let dx = p.x - p.ox;
    let dy = p.y - p.oy;
    const d = Math.hypot(dx, dy);
    if (d > DISPLACE_CAP) {
      dx *= DISPLACE_CAP / d;
      dy *= DISPLACE_CAP / d;
    }
    p.g.px2 = p.ox + dx;
    p.g.py2 = p.oy + dy;
    p.g.displaced = Math.hypot(p.g.px2 - p.ox, p.g.py2 - p.oy) > 5;
  }
}

function renderSheetD(cfg, world, landObj, groups, total) {
  const stats = {
    sheet: cfg.key,
    labels_without_slot: 0,
    labels_in_fallback_slots: 0,
    escapes: 0,
    chip_close_pairs: 0,
    legend_rows_drawn: 0,
    legend_capacity: 0,
    legend_overflow: 0,
    legend_parity_ok: true,
    cis_anchored_ok: 0,
    areals_drawn: 0,
    links_drawn: 0,
    links_by_kind: {},
    max_link_mm: 0,
    chip_ink_overlap_max: 0,
    chip_ink_overlap_pairs: 0,
  };
  const countLink = (kind, x1, y1, x2, y2) => {
    stats.links_drawn += 1;
    stats.links_by_kind[kind] = (stats.links_by_kind[kind] || 0) + 1;
    stats.max_link_mm = Math.max(stats.max_link_mm, Math.hypot(x2 - x1, y2 - y1) / U);
  };
  const pageWU = cfg.pageW * U;
  const pageHU = cfg.pageH * U;
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWU} ${pageHU}" font-family="Georgia, 'Times New Roman', serif">`);
  s.push(`<rect width="${pageWU}" height="${pageHU}" fill="#ffffff"/>`);
  s.push(
    `<defs>` +
      `<clipPath id="map-clip-${cfg.key}-d"><rect x="${f(D_DENSE_BOX.x0 * U)}" y="${f(D_DENSE_BOX.y0 * U)}" width="${f((D_DENSE_BOX.x1 - D_DENSE_BOX.x0) * U)}" height="${f((D_DENSE_BOX.y1 - D_DENSE_BOX.y0) * U)}"/></clipPath>` +
      `<clipPath id="map-clip-${cfg.key}-o"><rect x="${f(D_OVER_BOX.x0 * U)}" y="${f(D_OVER_BOX.y0 * U)}" width="${f((D_OVER_BOX.x1 - D_OVER_BOX.x0) * U)}" height="${f((D_OVER_BOX.y1 - D_OVER_BOX.y0) * U)}"/></clipPath>` +
      `<pattern id="hatch-${cfg.key}" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="#6a655c" stroke-width="0.7"/></pattern>` +
      `</defs>`
  );

  const inDense = (g) =>
    g.lat >= D_DENSE_GEO.lat0 && g.lat <= D_DENSE_GEO.lat1 && g.lon >= D_DENSE_GEO.lon0 && g.lon <= D_DENSE_GEO.lon1;
  // Центральная Африка stays on the overview; the zoom shows a pointer chip
  // with a leader-arrow (MG: «с верхней части Африки стрелочку»)
  const isCentralAfrica = (g) => g.primary.head === "Центральная Африка";
  const dense = groups.filter(inDense);
  const far = groups.filter((g) => !inDense(g) && !isCentralAfrica(g));
  const graticule = d3.geoGraticule().step([10, 10])();

  const drawPanel = (panelKey, boxMm, members, opts) => {
    const { projection, geopath, box } = buildProjection(boxMm, members.map((g) => [g.lon, g.lat]), PAD_FRACTION);
    for (const g of members) {
      [g.px, g.py] = projection([g.lon, g.lat]);
    }
    s.push(`<g clip-path="url(#map-clip-${cfg.key}-${panelKey})">`);
    s.push(`<path d="${geopath(landObj)}" fill="#e9e5dc" stroke="#4a4640" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"/>`);
    s.push(`<path d="${geopath(graticule)}" fill="none" stroke="#cdc8be" stroke-width="0.45"/>`);
    for (const g of members) {
      if (!g.areal) continue;
      const pts = g.areal.map(([lon, lat]) => projection([lon, lat]));
      if (pts.some((p) => !p || Number.isNaN(p[0]))) continue;
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${f(p[0])},${f(p[1])}`).join("") + "Z";
      s.push(`<path d="${d}" fill="url(#hatch-${cfg.key})" fill-opacity="0.30" stroke="#3d3a34" stroke-width="0.9" stroke-dasharray="5 3"/>`);
      stats.areals_drawn += 1;
    }
    relaxD(members, box, opts.chipR);
    for (const g of members) {
      if (g.displaced) {
        const dash = LINE_DASH[g.lineClass];
        s.push(`<line x1="${f(g.px)}" y1="${f(g.py)}" x2="${f(g.px2)}" y2="${f(g.py2)}" stroke="#55524c" stroke-width="0.4"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
        s.push(`<circle cx="${f(g.px)}" cy="${f(g.py)}" r="1.7" fill="none" stroke="#111111" stroke-width="0.5"/>`);
        countLink("chip_displacement", g.px, g.py, g.px2, g.py2);
      }
    }
    let closePairs = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        const d = Math.hypot(a.px2 - b.px2, a.py2 - b.py2);
        if (d < opts.chipR * 2 - 1) {
          closePairs += 1;
          stats.chip_close_pair = `${a.primary.head} <-> ${b.primary.head} d=${d.toFixed(1)}`;
        }
        const frac = circleOverlapFraction(d, opts.chipR, opts.chipR);
        if (frac > 0) {
          stats.chip_ink_overlap_pairs += 1;
          if (frac > stats.chip_ink_overlap_max) {
            stats.chip_ink_overlap_max = Number(frac.toFixed(4));
            stats.chip_ink_overlap_worst = `${a.primary.head} <-> ${b.primary.head} d=${d.toFixed(2)}u frac=${frac.toFixed(3)}`;
          }
        }
      }
    }
    stats.chip_close_pairs += closePairs;
    for (const g of members) {
      s.push(chipSvgD(g.px2, g.py2, g, opts.chipR, opts.chipFont));
    }
    if (opts.scaleBarKm) {
      const refLat = 50;
      const c0 = projection([30, refLat]);
      const c1 = projection([31, refLat]);
      const kmPerUnit = (111.32 * Math.cos((refLat * Math.PI) / 180)) / Math.abs(c1[0] - c0[0]);
      const barKm = opts.scaleBarKm;
      const barU = barKm / kmPerUnit;
      const barX = box.x0 + 12;
      const barY = box.y0 + (box.y1 - box.y0) - 12;
      s.push(
        `<rect x="${f(barX)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#111111"/>` +
          `<rect x="${f(barX + barU / 4)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#ffffff" stroke="#111111" stroke-width="0.5"/>` +
          `<rect x="${f(barX + barU / 2)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#111111"/>` +
          `<rect x="${f(barX + (barU * 3) / 4)}" y="${f(barY - 4.4)}" width="${f(barU / 4)}" height="3" fill="#ffffff" stroke="#111111" stroke-width="0.5"/>` +
          `<text x="${f(barX)}" y="${f(barY + 6.5)}" font-size="7" fill="#111111">0</text>` +
          `<text x="${f(barX + barU / 2)}" y="${f(barY + 6.5)}" text-anchor="middle" font-size="7" fill="#111111">${barKm / 2}</text>` +
          `<text x="${f(barX + barU)}" y="${f(barY + 6.5)}" text-anchor="middle" font-size="7" fill="#111111">${barKm}</text>` +
          `<text x="${f(barX + barU + 8)}" y="${f(barY + 6.5)}" font-size="7" fill="#111111">км</text>`
      );
    }
    s.push(`</g>`);
    s.push(
      `<rect x="${f(box.x0)}" y="${f(box.y0)}" width="${f(box.x1 - box.x0)}" height="${f(box.y1 - box.y0)}" fill="none" stroke="#111111" stroke-width="1.6"/>` +
        `<rect x="${f(box.x0 + 5)}" y="${f(box.y0 + 5)}" width="${f(box.x1 - box.x0 - 10)}" height="${f(box.y1 - box.y0 - 10)}" fill="none" stroke="#111111" stroke-width="0.45"/>`
    );
    if (opts.captionTop) {
      s.push(
        `<text x="${f(box.x0 + 32)}" y="${f(box.y0 + 36)}" font-size="9.5" font-weight="bold" fill="#33302b" stroke="#ffffff" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round">${esc(opts.caption)}</text>`
      );
    } else {
      s.push(
        `<text x="${f(box.x0 + (box.x1 - box.x0) / 2)}" y="${f(box.y1 - 6)}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#33302b" stroke="#ffffff" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round">${esc(opts.caption)}</text>`
      );
    }
    return { projection, box };
  };

  const denseCtx = drawPanel("d", D_DENSE_BOX, dense, { caption: D_DENSE_CAPTION, captionTop: true, scaleBarKm: 500, chipR: 7, chipFont: 7.2 });

  // pointer chip: Центральная Африка sits south of the zoom frame; its chip is
  // drawn just inside the frame's south edge with a leader running to the true
  // (off-frame) spot, exiting at the frame as an arrowhead
  const gCA = groups.find(isCentralAfrica);
  if (gCA) {
    const { projection, box } = denseCtx;
    const [tx, ty] = projection([gCA.lon, gCA.lat]);
    const r = 7;
    const cx = Math.min(Math.max(tx, box.x0 + r + 4), box.x1 - r - 4);
    const cy = box.y1 - 16;
    s.push(`<g clip-path="url(#map-clip-${cfg.key}-d)">`);
    s.push(`<line x1="${f(cx)}" y1="${f(cy + r)}" x2="${f(tx)}" y2="${f(ty)}" stroke="#55524c" stroke-width="0.6" stroke-dasharray="3 2"/>`);
    s.push(`</g>`);
    countLink("offframe_pointer", cx, cy + r, tx, ty);
    const exitT = (box.y1 - (cy + r)) / (ty - (cy + r));
    const exX = cx + (tx - cx) * exitT;
    s.push(`<path d="M ${f(exX - 3)} ${f(box.y1 - 5)} L ${f(exX + 3)} ${f(box.y1 - 5)} L ${f(exX)} ${f(box.y1 - 0.5)} Z" fill="#33302b"/>`);
    s.push(chipSvgD(cx, cy, gCA, r, 7.2));
  }

  drawPanel("o", D_OVER_BOX, far, { caption: D_OVER_CAPTION, captionTop: true, scaleBarKm: 0, chipR: 5, chipFont: 5.5 });

  // CIS anchors must sit east of 55E (MG ruling); chips do not use anchors,
  // the data property is still gated
  for (const g of groups) {
    if (g.anchor && g.anchor.lon >= 55) stats.cis_anchored_ok += 1;
  }

  // title + subtitle + version stamp
  s.push(`<text x="${8 * U}" y="${8.4 * U}" font-size="23" font-weight="bold" fill="#111111">Карта топонимов книги</text>`);
  const subLines = wrapText(cfg.subtitle, 66, 2);
  s.push(
    `<text x="${8 * U}" y="${(8.4 * U + 11).toFixed(1)}" font-size="10" fill="#33302b">` +
      subLines.map((l, i) => `<tspan x="${8 * U}" dy="${i === 0 ? 0 : 12.5}">${esc(l)}</tspan>`).join("") +
      `</text>`
  );
  s.push(`<text x="${137 * U}" y="${8.4 * U}" text-anchor="end" font-size="7.2" fill="#55524c">${esc(cfg.stamp)}</text>`);

  // key
  const keyY = 199 * U;
  s.push(
    `<text x="${8 * U}" y="${f(keyY)}" font-size="7.6" fill="#33302b">Заливка чипа — обсуждается в книге, контур — упоминается; «—» — без страниц</text>`
  );
  s.push(
    `<text x="${8 * U}" y="${f(keyY + 7)}" font-size="7.6" fill="#33302b">Штриховой контур — Русь, Византия, Восток; пунктирное кольцо — условное расположение («Велесова книга»)</text>`
  );
  s.push(
    `<text x="${8 * U}" y="${f(keyY + 14)}" font-size="7.6" fill="#33302b">Штриховой ареал — языковая зона; стрелка у нижней рамки — точка южнее (обзор); тонкая линия — чип сдвинут</text>`
  );

  s.push("</svg>");
  return { svg: s.join("\n"), stats };
}

// ---------------------------------------------------------------------------

// H4051 weight fix (MG ruling 04-09-2026): the wrapper pages REFERENCE their
// sheets instead of inlining them. 99.1% of a map SVG is the Natural Earth
// land path (5,517,849 of 5,568,705 chars on b8), and every variant used to
// store that path four times - the .svg, *-print.html, *.html and again inside
// toponyms-map-versions.html, which had grown to a 63.8 MB tracked blob
// (GitHub warns above 50 MB, refuses above 100 MB) on an 835.7 MB Pages site
// against a 1 GB limit. <img> keeps the vector on print (Chrome rasterises
// nothing) and keeps every URL and every .svg byte unchanged. Cost: the HTML
// is no longer a detached single file - it needs its sibling .svg. MG reviews
// via gasyoun.github.io URLs, so that costs nothing here.
function pageHtml(title, pageW, pageH, svgFiles) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #888; }
  img { display: block; width: ${pageW}mm; height: ${pageH}mm; background: #fff; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  @media print { html, body { background: #fff; } }
</style>
</head>
<body>
${svgFiles.map((file) => `<div class="sheet"><img src="${esc(file)}" alt=""></div>`).join("\n")}
</body>
</html>
`;
}

function reviewHtml(title, sheets) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  body { margin: 0; padding: 16px; background: #55524c; font-family: Georgia, serif; }
  h2 { color: #fff; font-size: 15px; margin: 18px 0 6px; }
  .wrap { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.5); margin-bottom: 8px; }
  .w-spread { width: 1100px; }
  .w-page { width: 550px; }
  img { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
${sheets
  .map(
    (sh) => `<h2>${esc(sh.title)}</h2><div class="wrap ${sh.pageW > 200 ? "w-spread" : "w-page"}"><img src="${esc(sh.file)}" alt="" loading="lazy"></div>`
  )
  .join("\n")}
</body>
</html>
`;
}

function render() {
  const { groups, total } = loadGroups();
  const world = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor/land-50m.json"), "utf-8"));
  const land = topojson.feature(world, world.objects.land);
  const numbered = groups.filter((g) => !g.discussed);

  const sheets = [
    {
      key: "A",
      pageW: SPREAD_W_MM,
      pageH: SPREAD_H_MM,
      mapBox: MAP_BOX_A,
      fit: "all",
      inset: null,
      legend: "spread",
      title: true,
      scaleBar: true,
      svgFile: "toponyms-map.svg",
    },
    {
      key: "Bmap",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: MAP_BOX_B,
      fit: "all",
      inset: { box: { x0: 73, y0: 128, x1: 137, y1: 196 } },
      legend: null,
      title: true,
      scaleBar: true,
      svgFile: "toponyms-map-b-map.svg",
    },
    {
      key: "Blegend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page",
      noMap: true,
      title: false,
      scaleBar: false,
      svgFile: "toponyms-map-b-legend.svg",
    },
    {
      key: "C",
      pageW: SPREAD_W_MM,
      pageH: SPREAD_H_MM,
      mapBox: MAP_BOX_A,
      fit: "all",
      inset: { box: INSET_BOX_C },
      legend: "spread",
      title: true,
      scaleBar: true,
      svgFile: "toponyms-map-c.svg",
    },
    {
      key: "Dmap",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: D_DENSE_BOX,
      fit: "all",
      inset: null,
      legend: null,
      renderer: "d2",
      title: true,
      subtitle: `«Из жизни слов и языков» · ${total} названий мест: у каждой точки номер — его раскрывает легенда на соседней странице`,
      stamp: D_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-d3-map.svg",
    },
    {
      key: "Dlegend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      legendTail: " · крупный план — верхняя панель карты",
      noMap: true,
      title: false,
      stamp: D_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-d3-legend.svg",
    },
    {
      key: "B2map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: { box: B2_INSET_BOX },
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      labelRingDeltas: B2_LABEL_RINGS,
      noWholeFrameFallback: true,
      squeezeRings: [64, 72, 80, 88],
      squeezePad: 1,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые подписаны названием, страницы — в легенде на соседней странице, у остальных номер`,
      stamp: B2_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b2-map.svg",
    },
    {
      key: "B2legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      noMap: true,
      title: false,
      stamp: B2_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b2-legend.svg",
    },
    {
      key: "B3map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B3_MAP_BOX,
      fit: "all",
      inset: { box: B3_INSET_BOX },
      insetGeo: B3_INSET_GEO,
      insetCaption: B3_INSET_CAPTION,
      refRect: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      labelRingDeltas: B2_LABEL_RINGS,
      noWholeFrameFallback: true,
      squeezeRings: [64, 72, 80, 88, 100, 112],
      squeezePad: 2.5,
      chipObstacles: true,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые подписаны названием, страницы — в легенде на соседней странице, у остальных номер`,
      stamp: B3_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b3-map.svg",
    },
    {
      key: "B3legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      noMap: true,
      title: false,
      stamp: B3_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b3-legend.svg",
    },
    {
      key: "B4map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B4_MAP_BOX,
      fit: "all",
      inset: { box: B4_INSET_BOX },
      insetGeo: B4_INSET_GEO,
      insetPad: B4_INSET_PAD,
      insetChipR: B4_INSET_CHIP_R,
      insetChipFont: B4_INSET_CHIP_FONT,
      insetCaption: B4_INSET_CAPTION,
      insetLabelsSoft: true,
      coverRelocate: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      labelRingDeltas: B2_LABEL_RINGS,
      noWholeFrameFallback: true,
      squeezeRings: [64, 72, 80, 88, 100, 112],
      squeezePad: 2.5,
      thirdPassPad: 1,
      chipObstacles: true,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые подписаны названием, страницы — в легенде на соседней странице, у остальных номер`,
      stamp: B4_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b4-map.svg",
    },
    {
      key: "B4legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      noMap: true,
      title: false,
      stamp: B4_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b4-legend.svg",
    },
    {
      key: "B5map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: null,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      labelRingDeltas: B2_LABEL_RINGS,
      noWholeFrameFallback: true,
      squeezeRings: [64, 72, 80, 88, 100, 112],
      squeezePad: 2.5,
      thirdPassPad: 1,
      chipObstacles: true,
      numberAll: true,
      fitLatMin: B5_FIT_LAT_MIN,
      loupeBox: B5_LOUPE_BOX,
      loupeGeo: B5_LOUPE_GEO,
      loupeRefRect: true,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые подписаны названием, страницы — в легенде на соседней странице, у остальных номер`,
      stamp: B5_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b5-map.svg",
    },
    {
      key: "B5legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      noMap: true,
      title: false,
      stamp: B5_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b5-legend.svg",
    },
    {
      key: "B6map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: { box: B6_CORE_BOX },
      insetGeo: B6_CORE_GEO,
      insetPad: B6_CORE_PAD,
      insetChipR: 7,
      insetChipFont: 7.2,
      insetCaption: B6_CORE_CAPTION,
      insetCaptionBelow: true,
      coveredLabelFlip: true,
      insetLabelsSoft: true,
      insetMirror: true,
      insetChipDiscussed: true,
      coverRelocate: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      labelRingDeltas: B2_LABEL_RINGS,
      noWholeFrameFallback: true,
      squeezeRings: [64, 72, 80, 88, 100, 112],
      squeezePad: 1,
      chipObstacles: true,
      numberAll: true,
      cleanSlotsOnly: true,
      southernEdgeOnly: true,
      fitLatMin: B5_FIT_LAT_MIN,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые подписаны названием, страницы — в легенде на соседней странице, у остальных номер`,
      stamp: B6_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b6-map.svg",
    },
    {
      key: "B6legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      noMap: true,
      title: false,
      stamp: B6_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b6-legend.svg",
    },
    {
      key: "B7map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: { box: B7_INSET_BOX },
      insetGeo: B7_INSET_GEO,
      insetPad: B7_INSET_PAD,
      insetChipR: 6.5,
      insetChipFont: 6.8,
      insetCaption: B7_INSET_CAPTION,
      insetCaptionFramed: true,
      insetLabelsSoft: true,
      insetMirror: true,
      insetChipDiscussed: true,
      insetRelax: true,
      coverRelocate: true,
      refRect: true,
      refLine: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      chipObstacles: true,
      numberAll: true,
      numberingAll: true,
      truePlace: true,
      truePlaceSecondTier: true,
      cleanSlotsOnly: true,
      noWholeFrameFallback: true,
      nameMentioned: true,
      pairMerge: true,
      displaceCap: 32,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: все точки на истинных местах, у каждой номер; ядро «Русь» крупно во врезке`,
      stamp: B7_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b7-map.svg",
    },
    {
      key: "B7legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      legendNumberAll: true,
      numberingAll: true,
      noMap: true,
      title: false,
      stamp: B7_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b7-legend.svg",
    },
    {
      key: "B8map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: { box: B8_INSET_BOX },
      insetGeo: B7_INSET_GEO,
      insetPad: B8_INSET_PAD,
      insetChipR: 6.5,
      insetChipFont: 6.8,
      insetCaption: B7_INSET_CAPTION,
      insetCaptionFramed: true,
      insetLabelsSoft: true,
      insetMirror: true,
      insetChipDiscussed: true,
      insetRelax: true,
      coverRelocate: true,
      refRect: true,
      refLine: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      chipObstacles: true,
      numberAll: true,
      numberingAll: true,
      truePlace: true,
      truePlaceSecondTier: true,
      cleanSlotsOnly: true,
      noWholeFrameFallback: true,
      nameMentioned: true,
      pairMerge: true,
      pairMergeList: B8_PAIR_MERGE,
      labelStacks: B8_LABEL_STACKS,
      labelBias: B8_LABEL_BIAS,
      labelAir: true,
      displaceCap: 32,
      relaxGap: B8_RELAX_GAP_U,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: все точки на истинных местах, у каждой номер; ядро «Русь» крупно во врезке`,
      stamp: B8_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b8-map.svg",
    },
    {
      key: "B8legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      legendNumberAll: true,
      numberingAll: true,
      // MG 04-09-2026 «исправь»: the legend follows the oldest-first name
      // order the map stacks already use - the 2 rows («Бенарес · Варанаси»,
      // «Цейлон · Шри-Ланка») now read the same on map and legend
      displayOrder: true,
      noMap: true,
      title: false,
      stamp: B8_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b8-legend.svg",
    },
    {
      key: "B9map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: { box: B8_INSET_BOX },
      insetGeo: B7_INSET_GEO,
      insetPad: B8_INSET_PAD,
      insetChipR: 6.5,
      insetChipFont: 6.8,
      insetCaption: B7_INSET_CAPTION,
      insetCaptionFramed: true,
      // H4120 (MG fifth round): «Русь · Киев → Новгород» bar goes italic
      insetCaptionItalic: true,
      // MG rev 11: the framed bar is RESERVED before chip fitting - the top
      // row of chips never touches or clips under the caption
      insetReserveBar: true,
      insetLabelsSoft: true,
      insetMirror: true,
      insetChipDiscussed: true,
      insetRelax: true,
      // inset chips may touch too - the reserved-bar fit box is tighter, and
      // the stub gate (<= 8) needs the drift low
      insetRelaxGap: 0,
      coverRelocate: true,
      // MG 04-09-2026: the magnified place is a HATCHED square on the map
      // with an arrow from the inset frame (replaces refRect+refLine)
      insetSourceArrow: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      chipObstacles: true,
      numberAll: true,
      numberingAll: true,
      truePlace: true,
      truePlaceSecondTier: true,
      cleanSlotsOnly: true,
      noWholeFrameFallback: true,
      nameMentioned: true,
      pairMerge: true,
      pairMergeList: B8_PAIR_MERGE,
      labelStacks: B9_NORTH_STACKS,
      labelBias: B9_LABEL_BIAS,
      labelPins: NORTH_LABEL_PINS,
      labelAir: true,
      // H4144 (MG ruling «Глобальный решатель»): the post-walk hill-climb -
      // every drawn label re-evaluated against all boxes, strict-improve
      // moves only; kills the greedy cascade at the root
      globalPlace: true,
      // MG rev 12 point 1 ported to B9 (live accepted variant, not just B10)
      softFill: true,
      // B9 leader policy (MG tiers): no leader within 10 mm of the dot;
      // the second tier (10-25 mm) is tied
      leaderDistThresholdU: 40,
      // B9 chip policy (probe-measured 04-09-2026): chips may TOUCH (gap 0 =
      // exact contact, no ink overlap) which halves the drift vs B8's gap 5.5
      // (median 3.7u vs 10.8u); a stub is drawn only for real drift > 16u
      // (4 mm) - probe says 3 chips qualify (B8 drew 58)
      relaxGap: 0,
      displaceCap: 32,
      displacedMinU: 16,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: все точки на истинных местах, у каждой номер; ядро «Русь» крупно во врезке`,
      stamp: B9_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b9-map.svg",
    },
    {
      key: "B9legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      legendNumberAll: true,
      numberingAll: true,
      // oldest-attested-first legend order (MG 04-09-2026) - new sheet, so it
      // opts in; frozen legends keep their bytes
      displayOrder: true,
      noMap: true,
      title: false,
      stamp: B9_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b9-legend.svg",
    },
    {
      key: "B10map",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: B2_MAP_BOX,
      fit: "all",
      inset: { box: B8_INSET_BOX },
      insetGeo: B7_INSET_GEO,
      insetPad: B8_INSET_PAD,
      insetChipR: 6.5,
      insetChipFont: 6.8,
      insetCaption: B7_INSET_CAPTION,
      insetCaptionFramed: true,
      // H4120 (MG fifth round): «Русь · Киев → Новгород» bar goes italic
      insetCaptionItalic: true,
      insetReserveBar: true,
      insetLabelsSoft: true,
      insetMirror: true,
      insetChipDiscussed: true,
      insetRelax: true,
      insetRelaxGap: 0,
      coverRelocate: true,
      insetSourceArrow: true,
      legend: null,
      nameOnlyLabels: true,
      ignoreAnchors: true,
      chipObstacles: true,
      numberAll: true,
      numberingAll: true,
      truePlace: true,
      truePlaceSecondTier: true,
      cleanSlotsOnly: true,
      noWholeFrameFallback: true,
      nameMentioned: true,
      pairMerge: true,
      pairMergeList: B8_PAIR_MERGE,
      labelStacks: B9_NORTH_STACKS,
      labelBias: B10_LABEL_BIAS,
      labelPins: NORTH_LABEL_PINS,
      labelAir: true,
      // H4144 (MG ruling «Глобальный решатель»): same as B9
      globalPlace: true,
      // H4051 Unit B (draft default, MG reviews the RENDERED sheet): city-
      // rank groups outside the Rus inset render as chips without names
      scaleRankedNames: true,
      // MG rev 12 point 1: filled (discussed) markers in dark gray
      softFill: true,
      // MG rev 12: ink-true placed boxes for upward multi-line labels - the
      // phantom extra line above blocked three requested label spots
      tightUpwardBoxes: true,
      leaderDistThresholdU: 40,
      relaxGap: 0,
      displaceCap: 32,
      displacedMinU: 16,
      title: true,
      subtitleOverride: `«Из жизни слов и языков» · ${total} названий мест: все точки на истинных местах, у каждой номер; города вне врезки — номера (легенда), ядро «Русь» крупно во врезке`,
      stamp: B10_STAMP,
      scaleBar: true,
      svgFile: "toponyms-map-b10-map.svg",
    },
    {
      key: "B10legend",
      pageW: PAGE_W_MM,
      pageH: PAGE_H_MM,
      mapBox: { x0: 0, y0: 0, x1: PAGE_W_MM, y1: PAGE_H_MM },
      fit: "all",
      inset: null,
      legend: "page-compact",
      legendNumberAll: true,
      numberingAll: true,
      displayOrder: true,
      noMap: true,
      title: false,
      stamp: B10_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-b10-legend.svg",
    },
  ];

  // sheet D numbering: every group gets a legend number (alphabetical, 1..N)
  const dGroups = groups.map((g) => ({ ...g }));
  let dnum = 0;
  for (const g of dGroups) g.number = ++dnum;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rendered = [];
  for (const cfg of sheets) {
    const sheetRenderer = cfg.renderer === "d2" ? renderSheetD : renderSheet;
    const groupsForSheet = cfg.numberAll || cfg.numberingAll || cfg.key.startsWith("D") ? dGroups : groups;
    const { svg, stats } = sheetRenderer(cfg, world, land, groupsForSheet, total);
    // H4051: `f()` turns a NaN coordinate into the literal string "NaN" and
    // the SVG still parses, so a broken placement path used to ship silently
    // (the B8 near-miss MG flagged). Refuse to write such a sheet at all.
    const bad = svg.match(/(?:NaN|Infinity)/);
    if (bad) {
      const at = svg.indexOf(bad[0]);
      throw new Error(`FAIL ${cfg.key}: non-finite coordinate in output near «${svg.slice(Math.max(0, at - 90), at + 260)}»`);
    }
    fs.writeFileSync(path.join(OUT_DIR, cfg.svgFile), svg, "utf-8");
    rendered.push({ cfg, svg, stats });
    console.log(cfg.key, JSON.stringify(stats));
  }

  const byKey = Object.fromEntries(rendered.map((r) => [r.cfg.key, r.stats]));
  // H4051: the wrapper writers used to address sheets by their position in
  // `rendered`, so appending a variant meant hand-counting indices - the
  // rev 11 spec mis-numbered them before a line of code was written. Keyed.
  const sheetFile = Object.fromEntries(rendered.map((r) => [r.cfg.key, r.cfg.svgFile]));

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-print.html"),
    pageHtml("Карта топонимов книги — печатный макет (H3996)", SPREAD_W_MM, SPREAD_H_MM, [sheetFile.A]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b-print.html"),
    pageHtml("Карта топонимов книги — страница + легенда (H3996)", PAGE_W_MM, PAGE_H_MM, [sheetFile.Bmap, sheetFile.Blegend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-c-print.html"),
    pageHtml("Карта топонимов книги — разворот с врезкой (H3996)", SPREAD_W_MM, SPREAD_H_MM, [sheetFile.C]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map.html"),
    reviewHtml(
      "Карта топонимов книги — все листы (H3996)",
      [
        { title: "A — разворот: карта + легенда (4-й столбец в полный рост)", pageW: SPREAD_W_MM, file: sheetFile.A },
        { title: "B — страница (карта) + соседняя страница (легенда)", pageW: PAGE_W_MM, file: sheetFile.Bmap },
        { title: "B — легенда, правая страница", pageW: PAGE_W_MM, file: sheetFile.Blegend },
        { title: "C — разворот с врезкой Западной Европы", pageW: SPREAD_W_MM, file: sheetFile.C },
      ]
    ),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-d3-print.html"),
    pageHtml("Карта топонимов книги — вариант D3: крупный план + обзор", PAGE_W_MM, PAGE_H_MM, [sheetFile.Dmap, sheetFile.Dlegend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-d3.html"),
    reviewHtml(
      "Карта топонимов — вариант D3: крупный план «Русь, Европа и Северная Африка» + обзор",
      [
        { title: `D3 — страница (карта): крупный план «Русь, Европа и Северная Африка» + обзорный локатор, все группы номерные · ${D_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.Dmap },
        { title: `D3 — соседняя страница: легенда, все группы по номерам (плотная вёрстка) · ${D_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.Dlegend },
      ]
    ),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b2-print.html"),
    pageHtml("Карта топонимов книги — вариант B2: подписи на местах + плотная легенда", PAGE_W_MM, PAGE_H_MM, [sheetFile.B2map, sheetFile.B2legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b2.html"),
    reviewHtml(
      "Карта топонимов — вариант B2: названия на своих местах, страницы в легенде",
      [
        { title: `B2 — страница (карта): названия у истинных точек (сдвиг ≤ 10 мм), врезка Западной Европы · ${B2_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B2map },
        { title: `B2 — соседняя страница: легенда, все 83 записи (● — обсуждается, номера — чипы) · ${B2_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B2legend },
      ]
    ),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b3-print.html"),
    pageHtml("Карта топонимов книги — вариант B3: подписи на местах, ядро «Русь» во врезке", PAGE_W_MM, PAGE_H_MM, [sheetFile.B3map, sheetFile.B3legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b3.html"),
    reviewHtml(
      "Карта топонимов — вариант B3: все цифры читаются, ядро «Русь» во врезке",
      [
        { title: `B3 — страница (карта): ядро «Русь» вынесено во врезку (≈24 группы, крупно), подписи у точек, цифры не пересекаются · ${B3_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B3map },
        { title: `B3 — соседняя страница: легенда, все 83 записи (● — обсуждается, номера — чипы) · ${B3_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B3legend },
      ]
    ),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b4-print.html"),
    pageHtml("Карта топонимов книги — вариант B4: лупа «Русь» над Индийским океаном", PAGE_W_MM, PAGE_H_MM, [sheetFile.B4map, sheetFile.B4legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b4.html"),
    reviewHtml(
      "Карта топонимов — вариант B4: карта в полный рост, лупа «Русь» над Индийским океаном",
      [
        { title: `B4 — страница (карта): полная карта + лупа «Русь» над Индийским океаном, цифры без наложений · ${B4_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B4map },
        { title: `B4 — соседняя страница: легенда, все 83 записи (● — обсуждается, номера — чипы) · ${B4_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B4legend },
      ]
    ),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b5-print.html"),
    pageHtml("Карта топонимов книги — вариант B5: zoom in + лупа киевского треугольника", PAGE_W_MM, PAGE_H_MM, [sheetFile.B5map, sheetFile.B5legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b5.html"),
    reviewHtml(
      "Карта топонимов — вариант B5: zoom in, все точки — номерные чипы, лупа киевского треугольника",
      [
        { title: `B5 — страница (карта): zoom in (верх Африки), все точки — номерные чипы, лупа киевского треугольника · ${B5_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B5map },
        { title: `B5 — соседняя страница: легенда, все 83 записи по номерам · ${B5_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B5legend },
      ]
    ),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b6-print.html"),
    pageHtml("Карта топонимов книги — вариант B6: zoom, врезка-ядро «Киев → Новгород», подписи только в чистых слотах", PAGE_W_MM, PAGE_H_MM, [sheetFile.B6map, sheetFile.B6legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b6.html"),
    reviewHtml(
      "Карта топонимов — вариант B6: zoom, врезка-ядро «Русь», ни одной наложенной подписи",
      [
        { title: `B6 — страница (карта): zoom (верх Африки), все точки — номерные чипы, врезка «Русь · Киев → Новгород» с именами, подписи только в чистых слотах · ${B6_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B6map },
        { title: `B6 — соседняя страница: легенда, все 83 записи по номерам · ${B6_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B6legend },
      ]
    ),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b7-print.html"),
    pageHtml("Карта топонимов книги — вариант B7: полная карта, истинные подписи, врезка-ядро в ЮВ углу", PAGE_W_MM, PAGE_H_MM, [sheetFile.B7map, sheetFile.B7legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b7.html"),
    reviewHtml(
      "Карта топонимов — вариант B7: полный мир, атласная точность, единая нумерация 1–83",
      [
        { title: `B7 — страница (карта): полный мир без выносов, подписи у истинных мест (≤ 10 мм), врезка «Русь · Киев → Новгород» в ЮВ углу с рамочным заголовком, штриховая рамка-источник + линия · ${B7_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B7map },
        { title: `B7 — соседняя страница: легенда, единый ряд 1–83 («номер строки = номер на карте») · ${B7_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B7legend },
      ]
    ),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b8-print.html"),
    pageHtml("Карта топонимов книги — вариант B8: воздух, исторические имена первыми, двухстрочные подписи", PAGE_W_MM, PAGE_H_MM, [sheetFile.B8map, sheetFile.B8legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b8.html"),
    reviewHtml(
      "Карта топонимов — вариант B8: воздух вокруг подписей, историческое имя первым, пары вместе",
      [
        { title: `B8 — страница (карта): воздух (pad 3.2 / чипы 10 / gap 5.5), стеки «Шри-Ланка→Цейлон», «Варанаси→Бенарес», пары «Британия · Англия», «Германия · ГДР», биасы направления · ${B8_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B8map },
        { title: `B8 — соседняя страница: легенда, единый ряд 1–83 · ${B8_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B8legend },
      ]
    ),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b9-print.html"),
    pageHtml("Карта топонимов книги — вариант B9: без выносных линий, штрихованный квадрат-источник врезки", PAGE_W_MM, PAGE_H_MM, [sheetFile.B9map, sheetFile.B9legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b9.html"),
    reviewHtml(
      "Карта топонимов — вариант B9: касание чипов вместо разлёва, штрих-квадрат со стрелкой на врезку",
      [
        { title: `B9 — страница (карта): чипы касаются, но не наезжают (gap 0), штрих только при дрейфе > 4 мм, подпись ≤ 10 мм от точки без лидера, врезка с запасом под рамочный заголовок, источник врезки — штрихованный квадрат со стрелкой · ${B9_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B9map },
        { title: `B9 — соседняя страница: легенда, единый ряд 1–83, порядок имён «древнейшая форма первой» · ${B9_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B9legend },
      ]
    ),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b10-print.html"),
    pageHtml("Карта топонимов книги — вариант B10: города вне врезки — номера, регионы и макро — с именами", PAGE_W_MM, PAGE_H_MM, [sheetFile.B10map, sheetFile.B10legend]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b10.html"),
    reviewHtml(
      "Карта топонимов — вариант B10: scale_rank (черновой разряд по умолчанию) — города вне врезки без имён",
      [
        { title: `B10 — страница (карта): как B9, но 12 городских имён вне ядра Руси убраны в легенду (Рим, Венеция, Флоренция… — чипы); их места освобождены для имён регионов · ${B10_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B10map },
        { title: `B10 — соседняя страница: легенда, единый ряд 1–83, порядок имён «древнейшая форма первой» · ${B10_STAMP}`, pageW: PAGE_W_MM, file: sheetFile.B10legend },
      ]
    ),
    "utf-8"
  );

  const A = byKey.A;
  const report = {
    total_toponyms: total,
    coordinate_groups: groups.length,
    // H4051: rows whose legend order still disagrees with the oldest-first
    // map stacks (they self-heal on any sheet that opts into cfg.displayOrder;
    // frozen legends keep alphabetical order by design).
    display_order_conflicts: groups.filter((g) => NAME_ORDER_OLDEST_FIRST.has(g.display)).length,
    display_order_conflict_rows: groups
      .filter((g) => NAME_ORDER_OLDEST_FIRST.has(g.display))
      .map((g) => `${g.display} → ${NAME_ORDER_OLDEST_FIRST.get(g.display)}`),
    labeled_groups: groups.filter((g) => g.discussed).length,
    numbered_groups: numbered.length,
    west_groups: groups.filter((g) => g.lineClass === "west").length,
    east_groups: groups.filter((g) => g.lineClass !== "west").length,
    cis_anchored: groups.filter((g) => g.anchor).length,
    areals: groups.filter((g) => g.areal).length,
    legend_rows_drawn: A.legend_rows_drawn,
    legend_capacity: A.legend_capacity,
    legend_overflow: A.legend_overflow,
    labels_without_slot: rendered.reduce((acc, r) => acc + r.stats.labels_without_slot, 0),
    labels_in_fallback_slots: rendered.reduce((acc, r) => acc + r.stats.labels_in_fallback_slots, 0),
    chip_close_pairs: Math.max(...rendered.map((r) => r.stats.chip_close_pairs)),
    legend_parity_ok: rendered.every((r) => r.stats.legend_parity_ok),
    cis_anchored_ok: A.cis_anchored_ok,
    areals_drawn_total: rendered.reduce((acc, r) => acc + r.stats.areals_drawn, 0),
    scale_bar_km: 1000,
    page_mm: [SPREAD_W_MM, SPREAD_H_MM],
    // H4051 MG-facing summary: one row per sheet on the criteria MG judges,
    // so «свободнее, без выносных линий» is a number and not an argument.
    mg_metrics: Object.fromEntries(
      rendered.map((r) => [
        r.cfg.key,
        {
          links_drawn: r.stats.links_drawn,
          links_by_kind: r.stats.links_by_kind,
          max_link_mm: Number((r.stats.max_link_mm || 0).toFixed(2)),
          names_requested: r.stats.names_requested,
          names_drawn: r.stats.names_drawn,
          names_not_drawn: r.stats.names_not_drawn,
          names_at_true_place: r.stats.names_at_true_place,
          names_policy_unnamed: r.stats.names_policy_unnamed || 0,
          label_offset_p50_mm: r.stats.label_offset_p50_mm,
          label_offset_p90_mm: r.stats.label_offset_p90_mm,
          label_offset_max_mm: r.stats.label_offset_max_mm,
          chip_ink_overlap_pairs: r.stats.chip_ink_overlap_pairs,
          chip_ink_overlap_max: r.stats.chip_ink_overlap_max,
        },
      ])
    ),
    sheets: byKey,
  };
  fs.writeFileSync(path.join(OUT_DIR, "toponyms-map-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  console.log(JSON.stringify(report, null, 2));

  const hardFail =
    report.labels_without_slot > 0 ||
    report.legend_overflow > 0 ||
    A.legend_rows_drawn !== numbered.length ||
    rendered[2].stats.legend_rows_drawn !== numbered.length ||
    !report.legend_parity_ok ||
    // H4051 B9: touching chips are ALLOWED on sheets that opt in
    // (chipClosePairsGate; MG B9a: «касание допустимо»), everyone else keeps
    // the strict 0. `report.chip_close_pairs` stays the cross-sheet max,
    // informational only.
    rendered.some((r) => r.stats.chip_close_pairs > (r.cfg.chipClosePairsGate ?? 0)) ||
    // H4051 B9: "no full number-on-number cover" as a measured gate - up to
    // 5% of the smaller chip's ink may be covered (touch), never more
    rendered.some((r) => (r.stats.chip_ink_overlap_max ?? 0) > (r.cfg.chipInkOverlapGate ?? 0.05)) ||
    report.cis_anchored_ok !== report.cis_anchored ||
    report.areals_drawn_total < 3 ||
    rendered.some((r) => r.stats.escapes > 0) ||
    byKey.Dmap.chip_close_pairs > 0 ||
    byKey.Dmap.labels_without_slot > 0 ||
    byKey.Dlegend.legend_rows_drawn !== groups.length ||
    byKey.Dlegend.legend_overflow > 0 ||
    !byKey.Dlegend.legend_parity_ok ||
    byKey.B3map.chip_close_pairs > 0 ||
    byKey.B3map.labels_without_slot > 0 ||
    byKey.B3map.escapes > 0 ||
    byKey.B3map.label_chip_violations > 0 ||
    byKey.B3map.max_leader_mm > 28.5 ||
    byKey.B3map.labels_last_resort > 6 ||
    byKey.B3legend.legend_rows_drawn !== groups.length ||
    byKey.B3legend.legend_overflow > 0 ||
    !byKey.B3legend.legend_parity_ok ||
    byKey.B4map.chip_close_pairs > 0 ||
    byKey.B4map.labels_without_slot > 0 ||
    byKey.B4map.escapes > 0 ||
    byKey.B4map.label_chip_violations > 0 ||
    byKey.B4map.max_leader_mm > 28.5 ||
    byKey.B4map.labels_last_resort > 6 ||
    byKey.B4legend.legend_rows_drawn !== groups.length ||
    byKey.B4legend.legend_overflow > 0 ||
    !byKey.B4legend.legend_parity_ok ||
    byKey.B5map.chip_close_pairs > 0 ||
    byKey.B5map.labels_without_slot > 0 ||
    byKey.B5map.escapes > 0 ||
    // B5 shipped (v4.17.21) with the known defect MG flagged in rev 8: 19
    // forced last-resort labels, 32 label-chip violations. The b5-* outputs
    // are frozen, so these two are REGRESSION detectors at the shipped
    // baseline; the strict == 0 gates live on B6 (cleanSlotsOnly).
    byKey.B5map.label_chip_violations > 32 ||
    byKey.B5map.max_leader_mm > 33 ||
    byKey.B5map.labels_last_resort > 19 ||
    byKey.B5legend.legend_rows_drawn !== groups.length ||
    byKey.B5legend.legend_overflow > 0 ||
    !byKey.B5legend.legend_parity_ok ||
    byKey.B6map.chip_close_pairs > 0 ||
    byKey.B6map.labels_without_slot > 0 ||
    byKey.B6map.escapes > 0 ||
    byKey.B6map.label_chip_violations > 0 ||
    byKey.B6map.labels_last_resort > 0 ||
    byKey.B6map.labels_deferred > 3 ||
    byKey.B6map.max_leader_mm > 33 ||
    byKey.B6legend.legend_rows_drawn !== groups.length ||
    byKey.B6legend.legend_overflow > 0 ||
    !byKey.B6legend.legend_parity_ok ||
    byKey.B7map.chip_close_pairs > 0 ||
    byKey.B7map.labels_without_slot > 0 ||
    byKey.B7map.escapes > 0 ||
    byKey.B7map.label_chip_violations > 0 ||
    byKey.B7map.labels_last_resort > 0 ||
    byKey.B7map.covered_relocated > 0 ||
    byKey.B7map.max_leader_mm > 30 ||
    byKey.B7map.labels_deferred > 50 ||
    byKey.B7legend.legend_rows_drawn !== groups.length ||
    byKey.B7legend.legend_overflow > 0 ||
    !byKey.B7legend.legend_parity_ok ||
    byKey.B8map.chip_close_pairs > 0 ||
    byKey.B8map.labels_without_slot > 0 ||
    byKey.B8map.escapes > 0 ||
    byKey.B8map.label_chip_violations > 0 ||
    byKey.B8map.labels_last_resort > 0 ||
    byKey.B8map.covered_relocated > 0 ||
    byKey.B8map.max_leader_mm > 31 ||
    byKey.B8map.labels_deferred > 55 ||
    byKey.B8legend.legend_rows_drawn !== groups.length ||
    byKey.B8legend.legend_overflow > 0 ||
    !byKey.B8legend.legend_parity_ok ||
    // H4051 B9 gates (MG rev 11a, ruled 04-09-2026): the lines MG complained
    // about are the chip displacement stubs - <= 8 of those on the main map;
    // label leaders follow the tier rule (none within 10 mm) and are reported
    // in mg_metrics rather than gated; inset stubs stay <= 8; the offset
    // percentile must beat B8's 23.75; no more names silently dropped than B8.
    byKey.B9map.links_by_kind.chip_displacement > 8 ||
    byKey.B9map.links_by_kind.inset_stub > 8 ||
    byKey.B9map.label_offset_p90_mm > 25 ||
    byKey.B9map.names_not_drawn > 25 ||
    byKey.B9map.names_at_true_place < 13 ||
    byKey.B9map.labels_without_slot > 0 ||
    byKey.B9map.escapes > 0 ||
    byKey.B9map.label_chip_violations > 0 ||
    byKey.B9map.labels_last_resort > 0 ||
    byKey.B9map.covered_relocated > 0 ||
    byKey.B9map.max_leader_mm > 31 ||
    byKey.B9legend.legend_rows_drawn !== groups.length ||
    byKey.B9legend.legend_overflow > 0 ||
    !byKey.B9legend.legend_parity_ok ||
    // H4051 Unit B (B10): the scale_rank default must drop exactly the city
    // names outside the Rus inset (draft says 12), and everything else stays
    // at B9's bars
    byKey.B10map.names_policy_unnamed !== 12 ||
    byKey.B10map.links_by_kind.chip_displacement > 8 ||
    byKey.B10map.links_by_kind.inset_stub > 8 ||
    byKey.B10map.label_offset_p90_mm > 25 ||
    byKey.B10map.names_not_drawn > 25 ||
    byKey.B10map.names_at_true_place < 13 ||
    byKey.B10map.labels_without_slot > 0 ||
    byKey.B10map.escapes > 0 ||
    byKey.B10map.label_chip_violations > 0 ||
    byKey.B10map.labels_last_resort > 0 ||
    byKey.B10map.covered_relocated > 0 ||
    byKey.B10map.max_leader_mm > 33 ||
    byKey.B10legend.legend_rows_drawn !== groups.length ||
    byKey.B10legend.legend_overflow > 0 ||
    !byKey.B10legend.legend_parity_ok;
  if (hardFail) {
    console.error("FAIL: see report fields above");
    process.exit(1);
  }
}

render();
