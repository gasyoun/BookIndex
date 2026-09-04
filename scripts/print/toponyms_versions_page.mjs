// Builds print/toponyms-map-versions.html - one review page with EVERY
// toponym-map variant that existed (A/B/C approved + D1/D2/D3 iterations),
// so MG can compare versions side by side. Run AFTER toponyms_print_map.mjs.
// D1 comes from git tag v4.17.7 (its files were overwritten by D2/D3).
// H4014 rev 3, MG 03-09-2026: «покажи на одной странице все какие были варианты».
//
// H4051 (MG ruling 04-09-2026): the page REFERENCES each sheet with <img src>
// instead of inlining its markup. Inlining had grown this file to a
// 63,755,814-byte tracked blob - GitHub warns above 50 MB and refuses above
// 100 MB, and each new variant added ~5.3 MB because 99.1% of a map SVG is the
// Natural Earth land path. It also made the review page itself the bottleneck:
// MG's comparison artefact asked a browser to parse thirteen world coastlines
// before showing anything. Now it is ~20 KB and the browser fetches sheets
// lazily. D1 is extracted from its tag ONCE into d1-* files so it too can be
// referenced rather than embedded.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "print");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// a sheet is usable if the file is actually on disk next to the page
const have = (p) => (fs.existsSync(path.join(OUT_DIR, p)) ? p : null);

// One-time rescue of a variant whose files were overwritten by a later
// revision: materialise it from the release tag that shipped it, then treat it
// like any other frozen sheet. Idempotent - never overwrites an existing file.
const fromTagOnce = (tag, tagPath, outName) => {
  const out = path.join(OUT_DIR, outName);
  if (fs.existsSync(out)) return outName;
  try {
    const svg = execSync(`git show ${tag}:${tagPath}`, { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(out, svg, "utf-8");
    console.log(`extracted ${outName} from ${tag}`);
    return outName;
  } catch {
    return null;
  }
};

const sections = [
  {
    num: 1,
    title: "A — разворот 290×215: карта + легенда полным столбцом",
    note: "v4.17.5 · <a href='toponyms-map.html'>toponyms-map.html</a>",
    files: [{ label: "лист A", file: have("toponyms-map.svg"), pageW: 290 }],
  },
  {
    num: 2,
    fav: true,
    title: "B — страница-карта (подписи со страницами) + страница-легенда 145×215",
    note: "v4.17.5 · <a href='toponyms-map-b-print.html'>toponyms-map-b-print.html</a>",
    favNote: "★ отметка MG 03-09-2026: «the version I liked most»",
    files: [
      { label: "B — карта", file: have("toponyms-map-b-map.svg"), pageW: 145 },
      { label: "B — легенда", file: have("toponyms-map-b-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 3,
    title: "C — разворот с врезкой Западной Европы",
    note: "v4.17.5 · <a href='toponyms-map-c-print.html'>toponyms-map-c-print.html</a>",
    files: [{ label: "лист C", file: have("toponyms-map-c.svg"), pageW: 290 }],
  },
  {
    num: 4,
    title: "D1 — все точки номерные, узкая врезка «Русь» (Киев→Новгород)",
    note: "v4.17.7 · снят с URL, файлы перезаписаны D2 — извлечён из git-тега один раз в d1-*",
    files: [
      { label: "D1 — карта", file: fromTagOnce("v4.17.7", "print/toponyms-map-d-map.svg", "toponyms-map-d1-map.svg"), pageW: 145 },
      { label: "D1 — легенда", file: fromTagOnce("v4.17.7", "print/toponyms-map-d-legend.svg", "toponyms-map-d1-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 5,
    title: "D2 — крупный план «Русь и Западная Евразия» + обзор",
    note: "v4.17.8 · <a href='toponyms-map-d.html'>toponyms-map-d.html</a> (заморожен)",
    files: [
      { label: "D2 — карта", file: have("toponyms-map-d-map.svg"), pageW: 145 },
      { label: "D2 — легенда", file: have("toponyms-map-d-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 6,
    title: "D3 — крупный план «Русь, Европа и Северная Африка» + обзор, стрелка на Центральную Африку",
    note: "v4.17.9 · <a href='toponyms-map-d3.html'>toponyms-map-d3.html</a>",
    files: [
      { label: "D3 — карта", file: have("toponyms-map-d3-map.svg"), pageW: 145 },
      { label: "D3 — легенда", file: have("toponyms-map-d3-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 7,
    title: "B2 — вариант B с названиями на своих местах: страницы в легенде, якоря отменены, сдвиг ≤ 10 мм",
    note: "v4.17.10 · <a href='toponyms-map-b2.html'>toponyms-map-b2.html</a>",
    files: [
      { label: "B2 — карта", file: have("toponyms-map-b2-map.svg"), pageW: 145 },
      { label: "B2 — легенда (83 записи)", file: have("toponyms-map-b2-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 8,
    title: "B3 — самое густое ядро «Русь» во врезке крупно; цифры не пересекаются и читаются безупречно",
    note: "v4.17.16 · <a href='toponyms-map-b3.html'>toponyms-map-b3.html</a>",
    files: [
      { label: "B3 — карта", file: have("toponyms-map-b3-map.svg"), pageW: 145 },
      { label: "B3 — легенда (83 записи)", file: have("toponyms-map-b3-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 9,
    title: "B4 — карта в полный рост + лупа «Русь» над Индийским океаном; цифры без наложений",
    note: "v4.17.19 · <a href='toponyms-map-b4.html'>toponyms-map-b4.html</a>",
    files: [
      { label: "B4 — карта", file: have("toponyms-map-b4-map.svg"), pageW: 145 },
      { label: "B4 — легенда (83 записи)", file: have("toponyms-map-b4-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 10,
    title: "B5 — zoom in (верх Африки), все точки — номерные чипы, лупа киевского треугольника",
    note: "v4.17.21 · <a href='toponyms-map-b5.html'>toponyms-map-b5.html</a>",
    files: [
      { label: "B5 — карта", file: have("toponyms-map-b5-map.svg"), pageW: 145 },
      { label: "B5 — легенда (83 записи)", file: have("toponyms-map-b5-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 11,
    title: "B6 — zoom + врезка-ядро «Русь · Киев → Новгород» с именами; ни одной наложенной подписи (последний ресорт отменён)",
    note: "v4.17.22 · <a href='toponyms-map-b6.html'>toponyms-map-b6.html</a>",
    files: [
      { label: "B6 — карта", file: have("toponyms-map-b6-map.svg"), pageW: 145 },
      { label: "B6 — легенда (83 записи)", file: have("toponyms-map-b6-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 12,
    title: "B7 — полный мир без выносов, атласная точность (подписи у истинных мест ≤ 10 мм / ≤ 25 мм с лидером), единая нумерация 1–83, врезка-ядро в ЮВ углу с рамочным заголовком",
    note: "v4.17.23 · <a href='toponyms-map-b7.html'>toponyms-map-b7.html</a>",
    files: [
      { label: "B7 — карта", file: have("toponyms-map-b7-map.svg"), pageW: 145 },
      { label: "B7 — легенда (83 записи, единый ряд с картой)", file: have("toponyms-map-b7-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 13,
    title: "B8 — воздух вокруг подписей, историческое имя первым, двухстрочные подписи, пары «Британия · Англия» и «Германия · ГДР» вместе, врезка шире и выше",
    note: "v4.17.24 · <a href='toponyms-map-b8.html'>toponyms-map-b8.html</a>",
    files: [
      { label: "B8 — карта", file: have("toponyms-map-b8-map.svg"), pageW: 145 },
      { label: "B8 — легенда (83 записи, единый ряд с картой)", file: have("toponyms-map-b8-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 14,
    title: "B9 — без разлёва: чипы касаются, но не наезжают; штрих только при дрейфе > 4 мм; подпись ≤ 10 мм от точки без лидера; источник врезки — штрихованный квадрат со стрелкой; рамочный заголовок врезки с запасом",
    note: "v4.17.26 · <a href='toponyms-map-b9.html'>toponyms-map-b9.html</a>",
    files: [
      { label: "B9 — карта", file: have("toponyms-map-b9-map.svg"), pageW: 145 },
      { label: "B9 — легенда (83 записи, «древнейшая форма первой»)", file: have("toponyms-map-b9-legend.svg"), pageW: 145 },
    ],
  },
];

// H4051: MG's own criteria per variant, read straight out of the generator
// report - the page that lets MG compare variants now also says what each one
// costs in leader lines, in names not drawn, and in distance from the dot.
let mg = {};
try {
  mg = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "toponyms-map-report.json"), "utf-8")).mg_metrics || {};
} catch {
  mg = {};
}
const METRIC_SHEET = {
  1: "A", 2: "Bmap", 3: "C", 5: "Dmap", 6: "Dmap",
  7: "B2map", 8: "B3map", 9: "B4map", 10: "B5map", 11: "B6map", 12: "B7map", 13: "B8map", 14: "B9map",
};
const metricRow = (num) => {
  const m = mg[METRIC_SHEET[num]];
  if (!m) return "";
  const drawn = m.names_requested ? `${m.names_drawn} из ${m.names_requested}` : `${m.names_drawn || 0}`;
  return (
    `<p class="metrics">выносных линий: <b>${m.links_drawn}</b>` +
    ` · подписей нарисовано: <b>${drawn}</b>` +
    (m.names_not_drawn ? ` (не нарисовано <b>${m.names_not_drawn}</b>)` : "") +
    ` · в бюджете 10 мм: <b>${m.names_at_true_place}</b>` +
    ` · отступ от точки p50/p90: <b>${m.label_offset_p50_mm} / ${m.label_offset_p90_mm} мм</b></p>`
  );
};

const body = sections
  .map((sec) => {
    const sheets = sec.files
      .filter((f) => f.file)
      .map(
        (f) =>
          `<h3>${esc(f.label)}</h3><div class="wrap ${f.pageW > 200 ? "w-spread" : "w-page"}"><img src="${esc(f.file)}" alt="" loading="lazy"></div>`
      )
      .join("\n");
    const missing = sec.files.length - sec.files.filter((f) => f.file).length;
    const fav = sec.fav ? `<p class="fav">★ ${esc(sec.favNote)}</p>` : "";
    return (
      `<h2><span class="num">Вариант №${sec.num}</span> — ${esc(sec.title.replace(/^[A-D]\d? ?— /, ""))}</h2>` +
      `<p class="note">${sec.note}${missing ? ` · <b>${missing} лист(а) недоступны</b>` : ""}</p>` +
      metricRow(sec.num) +
      fav +
      (sheets || "<p class='note'>нет данных</p>")
    );
  })
  .join("\n");

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Карта топонимов — все варианты (A/B/C + D1/D2/D3)</title>
<style>
  body { margin: 0; padding: 16px; background: #55524c; font-family: Georgia, serif; }
  h2 { color: #fff; font-size: 17px; margin: 26px 0 2px; border-bottom: 1px solid #8a857c; padding-bottom: 4px; }
  h2 .num { background: #ffd98a; color: #33302b; padding: 1px 8px; border-radius: 3px; margin-right: 6px; }
  h3 { color: #e8e4dc; font-size: 13px; margin: 14px 0 4px; }
  .note { color: #d8d4cc; font-size: 12px; margin: 2px 0 8px; }
  .note a { color: #ffd98a; }
  .metrics { color: #cfe8cf; font-size: 12px; margin: 2px 0 8px; font-family: "SFMono-Regular", Consolas, monospace; }
  .metrics b { color: #fff; }
  .fav { color: #ffd98a; font-size: 13px; font-weight: bold; margin: 2px 0 8px; }
  .wrap { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.5); margin-bottom: 8px; }
  .w-spread { width: 1100px; }
  .w-page { width: 550px; }
  img { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
<h1 style="color:#fff;font-size:22px;margin:6px 0 2px;">Карта топонимов книги — все варианты (номерованные)</h1>
<p class="note">Ссылайтесь на номер варианта («№2»). Каждая D-версия — свой URL, штамп версии стоит в правом верхнем углу листов. Страница собирается scripts/print/toponyms_versions_page.mjs.</p>
<p class="metrics">Зелёная строка под каждым вариантом — метрики H4051: сколько выносных линий рисует лист, сколько подписей вообще нарисовано (и сколько молча не нарисовано), сколько уложилось в бюджет 10 мм от своей точки, и медианный / 90-й процентиль отступа подписи от точки.</p>
${body}
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, "toponyms-map-versions.html"), html, "utf-8");
const count = sections.reduce((a, s) => a + s.files.filter((f) => f.file).length, 0);
console.log(`toponyms-map-versions.html written: ${count} sheets across ${sections.length} variants (${(html.length / 1024).toFixed(1)} KB)`);
