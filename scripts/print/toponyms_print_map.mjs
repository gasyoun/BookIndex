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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const d3 = require("../../vendor/d3.v7.min.js");
const topojson = require("../../vendor/topojson-client.min.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "print");

const U = 4;
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

const PAD_FRACTION = 0.09;
const LABEL_FONT_U = 11.2;
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

function markerRadU(g) {
  return g.discussed ? 2.8 : 7;
}

function relaxAll(groups, box) {
  const pts = groups.map((g) => ({ g, x: g.px, y: g.py, ox: g.px, oy: g.py, r: markerRadU(g), stay: false }));
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
        const minD = a.r + b.r + RELAX_GAP;
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
      if (p.stay) {
        p.x = p.ox;
        p.y = p.oy;
        continue;
      }
      p.x = Math.min(Math.max(p.x, x0), x1);
      p.y = Math.min(Math.max(p.y, y0), y1);
    }
  }
  for (const p of pts) {
    if (p.stay) {
      p.g.px2 = p.ox;
      p.g.py2 = p.oy;
      p.g.displaced = false;
      continue;
    }
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

function placeLabel(g, px, py, lines, placed, box, fontU, clipBox) {
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
  for (const r of [startR, startR + 12, startR + 26, startR + 42, startR + 60, startR + 85, startR + 115, startR + 150]) {
    for (const [dx, dy, anchor] of dirs) {
      const lx2 = dx !== 0 ? px + dx * r : px;
      const ly2 = dy !== 0 ? py + dy * r : py;
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
      const P = 2.5;
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
      return { x: lx2, y: ly, anchor, lines, lineH, leader };
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

function legendRowSvg(x, y, fontU, maxChars, g, maxLines = 2, pitchU = LEGEND_ROW_H, lineDy = 11) {
  const expect = g.pages ? `стр. ${g.pages}` : "—";
  const rowText = `${g.number}. ${g.display} — ${expect}`;
  const lines = wrapText(rowText, maxChars, maxLines);
  const rowH = pitchU + (lines.length - 1) * lineDy;
  const svg =
    `<text x="${f(x)}" y="${f(y)}" font-size="${fontU}" fill="#111111">` +
    lines.map((line, li) => `<tspan x="${f(x)}" dy="${li === 0 ? 0 : lineDy}">${lineHtml(line)}</tspan>`).join("") +
    `</text>`;
  return { svg, rowH, parity: !g.pages || expect === `стр. ${g.pages}` };
}

// ---------------------------------------------------------------------------
// sheet renderer
// ---------------------------------------------------------------------------

function renderSheet(cfg, world, landObj, groups, total) {
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
      `<pattern id="hatch-${cfg.key}" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="#6a655c" stroke-width="0.7"/></pattern></defs>`
  );

  const inMain = groups.filter((g) => (cfg.inset ? g.lineClass !== "west" : true));
  // the frame is always fitted to ALL points so every sheet shares the same geography;
  // on inset sheets the west points simply do not render on the main map
  const { projection, geopath, box } = buildProjection(cfg.mapBox, groups.map((g) => [g.lon, g.lat]), PAD_FRACTION);
  for (const g of groups) {
    [g.px, g.py] = projection([g.lon, g.lat]);
    g.anchorPx = g.anchor ? projection([g.anchor.lon, g.anchor.lat]) : null;
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
  for (const g of inMain) {
    if (!g.areal) continue;
    const pts = g.areal.map(([lon, lat]) => projection([lon, lat]));
    if (pts.some((p) => !p || Number.isNaN(p[0]))) continue;
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${f(p[0])},${f(p[1])}`).join("") + "Z";
    s.push(`<path d="${d}" fill="url(#hatch-${cfg.key})" fill-opacity="0.30" stroke="#3d3a34" stroke-width="0.9" stroke-dasharray="5 3"/>`);
    stats.areals_drawn += 1;
  }

  relaxAll(inMain, box);

  const placed = [];
  const labels = [];
  const leaders = [];

  // displaced chips keep a thin link to the true spot
  for (const g of inMain) {
    if (g.displaced) {
      const dash = LINE_DASH[g.lineClass];
      s.push(`<line x1="${f(g.px)}" y1="${f(g.py)}" x2="${f(g.px2)}" y2="${f(g.py2)}" stroke="#55524c" stroke-width="0.4"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
      s.push(`<circle cx="${f(g.px)}" cy="${f(g.py)}" r="1.7" fill="none" stroke="#111111" stroke-width="0.5"/>`);
    }
  }

  let chipClosePairs = 0;
  for (let i = 0; i < inMain.length; i++) {
    for (let j = i + 1; j < inMain.length; j++) {
      const a = inMain[i];
      const b = inMain[j];
      const d = Math.hypot(a.px2 - b.px2, a.py2 - b.py2);
      if (d < markerRadU(a) + markerRadU(b) - 1) {
        chipClosePairs += 1;
        stats.chip_close_pair = `${a.primary.head} (${a.px.toFixed(0)},${a.py.toFixed(0)}) <-> ${b.primary.head} (${b.px.toFixed(0)},${b.py.toFixed(0)}) d=${d.toFixed(1)}`;
      }
    }
  }
  stats.chip_close_pairs = chipClosePairs;

  // inset (sheet C): west points live here at a larger scale
  let insetCtx = null;
  if (cfg.inset) {
    const west = groups.filter((g) => g.lineClass === "west");
    const ib = {
      x0: cfg.inset.box.x0 * U,
      y0: cfg.inset.box.y0 * U,
      x1: cfg.inset.box.x1 * U,
      y1: cfg.inset.box.y1 * U,
    };
    const inset = buildProjection(cfg.inset.box, west.map((g) => [g.lon, g.lat]), 0.12);
    for (const g of west) {
      [g.ipx, g.ipy] = inset.projection([g.lon, g.lat]);
    }
    insetCtx = { west, inset, ib };
    placed.push({ x0: ib.x0 - 3, x1: ib.x1 + 3, y0: ib.y0 - 3, y1: ib.y1 + 3 });
  }

  // discussed labels on the main map (east classes; west live in the inset on sheet C)
  const mainLabeled = inMain
    .filter((x) => x.discussed)
    .map((g) => ({
      g,
      width: Math.max(
        ...wrapText(g.mapName, 26, 2).map((l) => textW(l, LABEL_FONT_U)),
        ...wrapText(g.pages || "", 32, 2).map((l) => textW(l, LABEL_FONT_U))
      ),
    }))
    .sort((a, b) => b.width - a.width || a.g.primary.head.localeCompare(b.g.primary.head, "ru"));

  const buildLines = (g) => {
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
    const dash = LINE_DASH[g.lineClass];
    leaders.push({ x1: g.px2, y1: g.py2, x2, y2, dash });
  };

  for (const { g } of mainLabeled) {
    const lines = buildLines(g);
    const origin = g.anchorPx ? { x: g.anchorPx[0], y: g.anchorPx[1] } : { x: g.px2, y: g.py2 };
    const pos = placeLabel(g, origin.x, origin.y, lines, placed, box, LABEL_FONT_U);
    if (!pos) {
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
        labels.push({ g, x: best.x0, y: best.y0 + LABEL_FONT_U * 0.85, anchor: "start", lines, lineH: LABEL_FONT_U * 1.22 });
        pushLeader(g, best.x0 - 2, best.y0 + LABEL_FONT_U * 0.4);
        stats.labels_in_fallback_slots += 1;
      } else {
        stats.labels_without_slot += 1;
        const lx = Math.min(Math.max(origin.x + 12, box.x0 + 60), box.x1 - 60);
        const ly = Math.min(Math.max(origin.y - 12, box.y0 + 16), box.y1 - 8);
        labels.push({ g, x: lx, y: ly, anchor: "middle", lines, lineH: LABEL_FONT_U * 1.22 });
        pushLeader(g, lx, ly - 4);
      }
    } else {
      labels.push({ g, ...pos });
      const lx = pos.anchor === "end" ? pos.x - textW(lines[0], LABEL_FONT_U) : pos.anchor === "middle" ? pos.x - textW(lines[0], LABEL_FONT_U) / 2 : pos.x;
      if (g.anchorPx || Math.hypot(lx - g.px2, pos.y - g.py2) > 24 || g.displaced) {
        pushLeader(g, lx, pos.y - 2);
      }
    }
  }

  // markers + chips on the main map
  for (const g of inMain) {
    if (g.discussed) {
      if (g.lineClass === "west") {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="2.8" fill="#ffffff" stroke="#111111" stroke-width="1.1"/>`);
      } else {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="2.8" fill="#111111" stroke="#ffffff" stroke-width="0.7"/>`);
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
  }
  for (const l of labels) {
    s.push(textBlockSvg(l, LABEL_FONT_U));
  }

  // inset content above everything in its box
  if (insetCtx) {
    const { west, inset, ib } = insetCtx;
    s.push(`<rect x="${f(ib.x0)}" y="${f(ib.y0)}" width="${f(ib.x1 - ib.x0)}" height="${f(ib.y1 - ib.y0)}" fill="#ffffff"/>`);
    s.push(`<g clip-path="url(#inset-clip-${cfg.key})">`);
    s.push(`<path d="${inset.geopath(landObj)}" fill="#e9e5dc" stroke="#4a4640" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"/>`);
    s.push(`<path d="${inset.geopath(graticule)}" fill="none" stroke="#cdc8be" stroke-width="0.45"/>`);
    const iPlaced = [];
    for (const g of west) {
      if (!g.discussed) {
        const chipDash = g.lineClass === "east" ? ` stroke-dasharray="${LINE_DASH.east}"` : "";
        s.push(
          `<circle cx="${f(g.ipx)}" cy="${f(g.ipy)}" r="7" fill="#ffffff" stroke="#111111" stroke-width="0.6"${chipDash}/><text x="${f(g.ipx)}" y="${f(g.ipy + 2.5)}" text-anchor="middle" font-size="7.2" fill="#111111">${g.number}</text>`
        );
        iPlaced.push({ x0: g.ipx - 8, x1: g.ipx + 8, y0: g.ipy - 8, y1: g.ipy + 8 });
      } else {
        const g2 = { ...g, px2: g.ipx, py2: g.ipy, anchor: null };
        if (g2.lineClass === "west") {
          s.push(`<circle cx="${f(g.ipx)}" cy="${f(g.ipy)}" r="2.8" fill="#ffffff" stroke="#111111" stroke-width="1.1"/>`);
        } else {
          s.push(`<circle cx="${f(g.ipx)}" cy="${f(g.ipy)}" r="2.8" fill="#111111" stroke="#ffffff" stroke-width="0.7"/>`);
        }
        iPlaced.push({ x0: g.ipx - 4, x1: g.ipx + 4, y0: g.ipy - 4, y1: g.ipy + 4 });
      }
    }
    const iLabeled = west
      .filter((g) => g.discussed)
      .map((g) => ({ g, width: Math.max(...wrapText(g.mapName, 20, 2).map((l) => textW(l, INSET_LABEL_FONT_U))) }))
      .sort((a, b) => b.width - a.width);
    for (const { g } of iLabeled) {
      const lines = wrapText(g.mapName, 20, 2);
      const pos = placeLabel(g, g.ipx, g.ipy, lines, iPlaced, ib, INSET_LABEL_FONT_U, ib);
      if (pos) {
        s.push(textBlockSvg({ g, ...pos }, INSET_LABEL_FONT_U));
      } else {
        stats.labels_without_slot += 1;
        s.push(textBlockSvg({ g, x: g.ipx + 10, y: g.ipy, anchor: "start", lines, lineH: INSET_LABEL_FONT_U * 1.22 }, INSET_LABEL_FONT_U));
      }
    }
    s.push(`</g>`);
    s.push(
      `<rect x="${f(ib.x0)}" y="${f(ib.y0)}" width="${f(ib.x1 - ib.x0)}" height="${f(ib.y1 - ib.y0)}" fill="none" stroke="#111111" stroke-width="1.2"/>` +
        `<text x="${f((ib.x0 + ib.x1) / 2)}" y="${f(ib.y1 - 6)}" text-anchor="middle" font-size="9.5" font-weight="bold" fill="#33302b">${esc(WEST_CAPTION)}</text>`
    );
  }

  s.push(`</g>`);

  // escapes: every label rect must sit inside its frame
  for (const l of labels) {
    const widest = Math.max(...l.lines.map((line) => textW(line, LABEL_FONT_U)));
    const bx0 = l.anchor === "end" ? l.x - widest : l.anchor === "middle" ? l.x - widest / 2 : l.x;
    const by0 = l.y - l.lineH * 0.8;
    if (bx0 < box.x0 || bx0 + widest > box.x1 || by0 < box.y0 || by0 + l.lines.length * l.lineH > box.y1) stats.escapes += 1;
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

  // CIS anchors must sit east of 55E (MG: former-CIS labels move onto RF territory)
  for (const g of inMain) {
    if (g.anchor && g.anchorPx) {
      if (g.anchor.lon >= 55) stats.cis_anchored_ok += 1;
    }
  }

  // legend
  const numbered = groups.filter((g) => !g.discussed);
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
      const row = legendRowSvg(SIDE_X0 * U, cursor, SIDE_FONT_U, maxChars, g);
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
      const lines = wrapText(`${g.number}. ${g.display} — ${expect}`, maxChars, 3);
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
      const lines = wrapText(`${g.number}. ${g.display} — ${expect}`, maxChars, 3);
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
    s.push(
      `<text x="${DLEG_X0 * U}" y="${f(keyY)}" font-size="7.6" fill="#33302b">Залитый маркер — обсуждается в книге, контурный — упоминается; штриховой контур — Русь, Византия, Восток</text>` +
        `<text x="${DLEG_X0 * U}" y="${f(keyY + 9)}" font-size="7.6" fill="#33302b">Штриховой ареал — языковая зона · пунктирное кольцо — условное расположение («Велесова книга») · «—» — без страниц</text>` +
        `<text x="${DLEG_X0 * U}" y="${f(keyY + 18)}" font-size="7.4" fill="#55524c">Основа: Natural Earth (public domain) · коническая конформная проекция · крупный план — верхняя панель карты</text>`
    );
  }

  // title + subtitle
  if (cfg.title) {
    s.push(`<text x="${8 * U}" y="${8.4 * U}" font-size="23" font-weight="bold" fill="#111111">Карта топонимов книги</text>`);
    const sub = `«Из жизни слов и языков» · ${total} названий мест: обсуждаемые в книге подписаны с номерами страниц${cfg.legend ? ", остальные раскрывает легенда" : ", номера раскрывает легенда на соседней странице"}`;
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

function relaxD(members, box, r) {
  const pts = members.map((g) => ({ g, x: g.px, y: g.py, ox: g.px, oy: g.py, stay: false }));
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
        const minD = r * 2 + RELAX_GAP;
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

function pageHtml(title, pageW, pageH, svgs) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #888; }
  svg { display: block; width: ${pageW}mm; height: ${pageH}mm; background: #fff; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  @media print { html, body { background: #fff; } }
</style>
</head>
<body>
${svgs.map((svg) => `<div class="sheet">${svg}</div>`).join("\n")}
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
  svg { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
${sheets
  .map(
    (sh) => `<h2>${esc(sh.title)}</h2><div class="wrap ${sh.pageW > 200 ? "w-spread" : "w-page"}">${sh.svg}</div>`
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
      noMap: true,
      title: false,
      stamp: D_STAMP,
      scaleBar: false,
      svgFile: "toponyms-map-d3-legend.svg",
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
    const { svg, stats } = sheetRenderer(cfg, world, land, cfg.key.startsWith("D") ? dGroups : groups, total);
    fs.writeFileSync(path.join(OUT_DIR, cfg.svgFile), svg, "utf-8");
    rendered.push({ cfg, svg, stats });
    console.log(cfg.key, JSON.stringify(stats));
  }

  const byKey = Object.fromEntries(rendered.map((r) => [r.cfg.key, r.stats]));

  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-print.html"),
    pageHtml("Карта топонимов книги — печатный макет (H3996)", SPREAD_W_MM, SPREAD_H_MM, [rendered[0].svg]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-b-print.html"),
    pageHtml("Карта топонимов книги — страница + легенда (H3996)", PAGE_W_MM, PAGE_H_MM, [rendered[1].svg, rendered[2].svg]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-c-print.html"),
    pageHtml("Карта топонимов книги — разворот с врезкой (H3996)", SPREAD_W_MM, SPREAD_H_MM, [rendered[3].svg]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map.html"),
    reviewHtml(
      "Карта топонимов книги — все листы (H3996)",
      [
        { title: "A — разворот: карта + легенда (4-й столбец в полный рост)", pageW: SPREAD_W_MM, svg: rendered[0].svg },
        { title: "B — страница (карта) + соседняя страница (легенда)", pageW: PAGE_W_MM, svg: rendered[1].svg },
        { title: "B — легенда, правая страница", pageW: PAGE_W_MM, svg: rendered[2].svg },
        { title: "C — разворот с врезкой Западной Европы", pageW: SPREAD_W_MM, svg: rendered[3].svg },
      ]
    ),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-d3-print.html"),
    pageHtml("Карта топонимов книги — вариант D3: крупный план + обзор", PAGE_W_MM, PAGE_H_MM, [rendered[4].svg, rendered[5].svg]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "toponyms-map-d3.html"),
    reviewHtml(
      "Карта топонимов — вариант D3: крупный план «Русь, Европа и Северная Африка» + обзор",
      [
        { title: `D3 — страница (карта): крупный план «Русь, Европа и Северная Африка» + обзорный локатор, все группы номерные · ${D_STAMP}`, pageW: PAGE_W_MM, svg: rendered[4].svg },
        { title: `D3 — соседняя страница: легенда, все группы по номерам (плотная вёрстка) · ${D_STAMP}`, pageW: PAGE_W_MM, svg: rendered[5].svg },
      ]
    ),
    "utf-8"
  );

  const A = byKey.A;
  const report = {
    total_toponyms: total,
    coordinate_groups: groups.length,
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
    report.chip_close_pairs > 0 ||
    report.cis_anchored_ok !== report.cis_anchored ||
    report.areals_drawn_total < 3 ||
    rendered.some((r) => r.stats.escapes > 0) ||
    byKey.Dmap.chip_close_pairs > 0 ||
    byKey.Dmap.labels_without_slot > 0 ||
    byKey.Dlegend.legend_rows_drawn !== groups.length ||
    byKey.Dlegend.legend_overflow > 0 ||
    !byKey.Dlegend.legend_parity_ok;
  if (hardFail) {
    console.error("FAIL: see report fields above");
    process.exit(1);
  }
}

render();
