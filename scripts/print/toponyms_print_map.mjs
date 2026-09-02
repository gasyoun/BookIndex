// Print-ready vector toponym map for the Zaliznyak book companion.
// H3974 — renders print/toponyms-map.svg + print/toponyms-map-print.html
// from data/modules/11-toponyms.json + vendored Natural Earth land TopoJSON.
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
const PAGE_W_MM = 290;
const PAGE_H_MM = 215;
const MAP_BOX = { x0: 8, y0: 15, x1: 208, y1: 154 };
const LEGEND_HEADER_Y = 159.5;
const LEGEND_ROWS_Y = 165.5;
const LEGEND_Y1 = 206.5;
const LEGEND_X0 = 8;
const LEGEND_X1 = 283;
const LEGEND_COLS = 4;
const PAD_FRACTION = 0.09;
const LABEL_FONT_U = 11.2;
const LEGEND_FONT_U = 9.9;
const LEGEND_ROW_H = 11.6;
const CHAR_W = 0.64;
const MAX_LABEL_LINES = 5;
const RELAX_GAP = 4.5;
const RELAX_ITERATIONS = 500;
const DISPLACE_CAP = 88;

function markerRadU(g) {
  return g.discussed ? 2.8 : 7;
}

function relaxAll(groups, box) {
  const pts = groups.map((g) => ({ g, x: g.px, y: g.py, ox: g.px, oy: g.py, r: markerRadU(g) }));
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


const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f = (n) => Number(n).toFixed(2);

function compressPages(sortedUniq) {
  const out = [];
  let i = 0;
  while (i < sortedUniq.length) {
    let j = i;
    while (j + 1 < sortedUniq.length && sortedUniq[j + 1] - sortedUniq[j] === 1) j++;
    out.push(i === j ? `${sortedUniq[i]}` : `${sortedUniq[i]}–${sortedUniq[j]}`);
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

function placeLabel(g, px, py, lines, placed, box, fontU) {
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
      if (bx0 < box.x0 + 2 || bx1 > box.x1 - 2 || by0 < box.y0 + 2 || by1 > box.y1 - 2) continue;
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
    l.lines.map((line, i) => `<tspan x="${f(l.x)}" dy="${i === 0 ? 0 : f(l.lineH)}">${esc(line)}</tspan>`).join("") +
    `</text>`
  );
}

function render() {
  const { groups, total } = loadGroups();
  for (const g of groups) g.nPages = g.pages ? g.pages.split(", ").length : 0;

  const { projection, geopath, box } = buildProjection(MAP_BOX, groups.map((g) => [g.lon, g.lat]), PAD_FRACTION);
  for (const g of groups) {
    [g.px, g.py] = projection([g.lon, g.lat]);
  }

  const world = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor/land-50m.json"), "utf-8"));
  const land = topojson.feature(world, world.objects.land);
  const graticule = d3.geoGraticule().step([10, 10])();

  const placed = [];
  const markers = [];
  const chips = [];
  const labels = [];
  const leaders = [];
  let collisions = 0;

  relaxAll(groups, box);

  for (const g of groups) {
    const r = markerRadU(g) + (g.conditional ? 3.2 : 0) + 2.5;
    placed.push({ x0: g.px2 - r, x1: g.px2 + r, y0: g.py2 - r, y1: g.py2 + r });
  }
  let chipClosePairs = 0;
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      const d = Math.hypot(a.px2 - b.px2, a.py2 - b.py2);
      if (d < markerRadU(a) + markerRadU(b) - 1) chipClosePairs += 1;
    }
  }
  for (const g of groups) {
    markers.push(g);
    if (!g.discussed) chips.push(g);
  }
  const labeledGroups = groups
    .filter((x) => x.discussed)
    .map((g) => ({
      g,
      width: Math.max(
        ...wrapText(g.mapName, 26, 2).map((l) => textW(l, LABEL_FONT_U)),
        ...wrapText(g.pages || "", 32, 2).map((l) => textW(l, LABEL_FONT_U))
      ),
    }))
    .sort((a, b) => b.width - a.width || a.g.primary.head.localeCompare(b.g.primary.head, "ru"));
  let fallbackUsed = 0;
  for (const { g } of labeledGroups) {
    const lines = wrapText(g.mapName, 26, 2);
    if (g.pages) {
      lines.push(...wrapText(g.pages, 34, 3).map((l, i) => (i === 0 ? `стр. ${l}` : l)));
    } else if (g.conditional) {
      lines.push("расположение условно");
    }
    if (lines.length > MAX_LABEL_LINES) {
      lines.length = MAX_LABEL_LINES;
      lines[MAX_LABEL_LINES - 1] += "…";
    }
    const pos = placeLabel(g, g.px2, g.py2, lines, placed, box, LABEL_FONT_U);
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
          const dist = Math.hypot(gx - g.px2, gy - g.py2);
          if (!best || dist < best.dist) best = { ...bb, dist };
        }
      }
      if (best) {
        placed.push({ x0: best.x0, x1: best.x1, y0: best.y0, y1: best.y1 });
        labels.push({ g, x: best.x0, y: best.y0 + LABEL_FONT_U * 0.85, anchor: "start", lines, lineH: LABEL_FONT_U * 1.22 });
        leaders.push({ x1: g.px2, y1: g.py2, x2: best.x0 - 2, y2: best.y0 + LABEL_FONT_U * 0.4 });
        fallbackUsed += 1;
      } else {
        collisions += 1;
        const lx = Math.min(Math.max(g.px2 + 12, box.x0 + 60), box.x1 - 60);
        const ly = Math.min(Math.max(g.py2 - 12, box.y0 + 16), box.y1 - 8);
        labels.push({ g, x: lx, y: ly, anchor: "middle", lines, lineH: LABEL_FONT_U * 1.22 });
        leaders.push({ x1: g.px2, y1: g.py2, x2: lx, y2: ly - 4 });
      }
    } else {
      labels.push({ g, ...pos });
      const lx = pos.anchor === "end" ? pos.x - textW(lines[0], LABEL_FONT_U) : pos.anchor === "middle" ? pos.x - textW(lines[0], LABEL_FONT_U) / 2 : pos.x;
      const nearDisplaced = Math.hypot(lx - g.px2, pos.y - g.py2) > 24;
      if (nearDisplaced || g.displaced) {
        leaders.push({ x1: g.px2, y1: g.py2, x2: lx, y2: pos.y - 2 });
      }
    }
  }

  const frame = { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
  const c0 = projection([30, 45]);
  const c1 = projection([31, 45]);
  const kmPerUnit = (111.32 * Math.cos((45 * Math.PI) / 180)) / Math.abs(c1[0] - c0[0]);
  const barKm = 1000;
  const barU = barKm / kmPerUnit;
  const barX = frame.x + 12;
  const barY = frame.y + frame.h - 12;

  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W_MM * U} ${PAGE_H_MM * U}" font-family="Georgia, 'Times New Roman', serif">`);
  s.push(`<rect width="${PAGE_W_MM * U}" height="${PAGE_H_MM * U}" fill="#ffffff"/>`);
  s.push(`<defs><clipPath id="map-clip"><rect x="${f(frame.x)}" y="${f(frame.y)}" width="${f(frame.w)}" height="${f(frame.h)}"/></clipPath></defs>`);

  s.push(
    `<text x="${8 * U}" y="${8.4 * U}" font-size="23" font-weight="bold" fill="#111111">Карта топонимов книги</text>` +
      `<text x="${8 * U}" y="${(8.4 * U + 13).toFixed(1)}" font-size="11" fill="#33302b">«Из жизни слов и языков» · ${total} названий мест: обсуждаемые в книге подписаны с номерами страниц, остальные раскрывает легенда ниже</text>`
  );

  s.push(`<g clip-path="url(#map-clip)">`);
  s.push(`<path d="${geopath(land)}" fill="#e9e5dc" stroke="#4a4640" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"/>`);
  s.push(`<path d="${geopath(graticule)}" fill="none" stroke="#cdc8be" stroke-width="0.45"/>`);
  for (const g of groups) {
    if (g.displaced) {
      s.push(`<line x1="${f(g.px)}" y1="${f(g.py)}" x2="${f(g.px2)}" y2="${f(g.py2)}" stroke="#55524c" stroke-width="0.4"/>`);
      s.push(`<circle cx="${f(g.px)}" cy="${f(g.py)}" r="1.7" fill="none" stroke="#111111" stroke-width="0.5"/>`);
    }
  }
  for (const g of markers) {
    if (g.discussed) {
      s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="2.8" fill="#111111" stroke="#ffffff" stroke-width="0.7"/>`);
      if (g.conditional) {
        s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="6" fill="none" stroke="#111111" stroke-width="0.55" stroke-dasharray="2.2 1.8"/>`);
      }
    }
  }
  for (const l of leaders) {
    s.push(`<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}" stroke="#55524c" stroke-width="0.4"/>`);
  }
  for (const g of chips) {
    if (g.conditional) {
      s.push(`<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="10.5" fill="none" stroke="#111111" stroke-width="0.55" stroke-dasharray="2.2 1.8"/>`);
    }
    s.push(
      `<circle cx="${f(g.px2)}" cy="${f(g.py2)}" r="7" fill="#ffffff" stroke="#111111" stroke-width="0.6"/><text x="${f(g.px2)}" y="${f(g.py2 + 2.5)}" text-anchor="middle" font-size="7.2" fill="#111111">${g.number}</text>`
    );
  }
  for (const l of labels) {
    s.push(textBlockSvg(l, LABEL_FONT_U));
  }
  s.push(`</g>`);

  s.push(
    `<rect x="${f(frame.x)}" y="${f(frame.y)}" width="${f(frame.w)}" height="${f(frame.h)}" fill="none" stroke="#111111" stroke-width="1.6"/>` +
      `<rect x="${f(frame.x + 5)}" y="${f(frame.y + 5)}" width="${f(frame.w - 10)}" height="${f(frame.h - 10)}" fill="none" stroke="#111111" stroke-width="0.45"/>`
  );

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

  s.push(
    `<text x="${LEGEND_X0 * U}" y="${f(LEGEND_HEADER_Y * U)}" font-size="12.6" font-weight="bold" fill="#111111">Легенда: топонимы по номерам</text>` +
      `<text x="${(LEGEND_X1 * U).toFixed(1)}" y="${f(LEGEND_HEADER_Y * U)}" text-anchor="end" font-size="9.4" fill="#33302b">номер у точки на карте · страницы книги, где встречается название</text>`
  );
  const numbered = groups.filter((g) => !g.discussed);
  const colW = ((LEGEND_X1 - LEGEND_X0) * U) / LEGEND_COLS;
  const rowsPerCol = Math.ceil(numbered.length / LEGEND_COLS);
  const colCursors = Array(LEGEND_COLS).fill(LEGEND_ROWS_Y * U);
  let rowsDrawn = 0;
  let legendOverflow = 0;
  let legendParityOk = true;
  for (let i = 0; i < numbered.length; i++) {
    const g = numbered[i];
    const col = Math.floor(i / rowsPerCol);
    const x = LEGEND_X0 * U + col * colW;
    const y = colCursors[col];
    const expect = g.pages ? `стр. ${g.pages}` : "—";
    const maxChars = Math.floor((colW - 12) / (LEGEND_FONT_U * CHAR_W));
    const rowText = `${g.number}. ${g.display} — ${expect}`;
    const lines = wrapText(rowText, maxChars, 2);
    const rowH = LEGEND_ROW_H + (lines.length - 1) * 11;
    if (y + rowH > LEGEND_Y1 * U) {
      legendOverflow += 1;
      continue;
    }
    rowsDrawn += 1;
    s.push(
      `<text x="${f(x)}" y="${f(y)}" font-size="${LEGEND_FONT_U}" fill="#111111">` +
        lines
          .map(
            (line, li) =>
              `<tspan x="${f(x)}" dy="${li === 0 ? 0 : 11}">${esc(line)}</tspan>`
          )
          .join("") +
        `</text>`
    );
    if (g.pages && expect !== `стр. ${g.pages}`) legendParityOk = false;
    colCursors[col] = y + rowH;
  }

  const keyY = (LEGEND_Y1 + 3.6) * U;
  s.push(
    `<text x="${LEGEND_X0 * U}" y="${f(keyY)}" font-size="9" fill="#33302b">Точка — место из книги · номер в кружке — см. легенду · пунктир — условное расположение («Велесова книга») · «—» — без страниц</text>`
  );
  s.push(
    `<text x="${(LEGEND_X1 * U).toFixed(1)}" y="${f(keyY)}" text-anchor="end" font-size="8.2" fill="#55524c">Основа: Natural Earth (public domain) · коническая конформная проекция</text>`
  );

  s.push("</svg>");
  const svg = s.join("\n");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "toponyms-map.svg"), svg, "utf-8");

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Карта топонимов книги — печатный макет (H3974)</title>
<style>
  @page { size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #888; }
  svg { display: block; width: ${PAGE_W_MM}mm; height: ${PAGE_H_MM}mm; background: #fff; }
  @media print { html, body { background: #fff; } }
</style>
</head>
<body>
${svg}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, "toponyms-map-print.html"), html, "utf-8");

  const report = {
    total_toponyms: total,
    coordinate_groups: groups.length,
    labeled_groups: groups.filter((g) => g.discussed).length,
    numbered_groups: numbered.length,
    legend_rows_drawn: rowsDrawn,
    legend_capacity: rowsPerCol * LEGEND_COLS,
    legend_overflow: legendOverflow,
    labels_without_slot: collisions,
    labels_in_fallback_slots: fallbackUsed,
    chip_close_pairs: chipClosePairs,
    legend_parity_ok: legendParityOk,
    scale_bar_km: barKm,
    page_mm: [PAGE_W_MM, PAGE_H_MM],
  };
  fs.writeFileSync(path.join(OUT_DIR, "toponyms-map-report.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
  console.log(JSON.stringify(report, null, 2));

  const hardFail = collisions > 0 || legendOverflow > 0 || rowsDrawn !== numbered.length || !legendParityOk || chipClosePairs > 0;
  if (hardFail) {
    console.error("FAIL: see report fields above");
    process.exit(1);
  }
}

render();
