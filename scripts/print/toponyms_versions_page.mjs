// Builds print/toponyms-map-versions.html - one review page with EVERY
// toponym-map variant that existed (A/B/C approved + D1/D2/D3 iterations),
// so MG can compare versions side by side. Run AFTER toponyms_print_map.mjs.
// D1 comes from git tag v4.17.7 (its files were overwritten by D2/D3).
// H4014 rev 3, MG 03-09-2026: «покажи на одной странице все какие были варианты».

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "print");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const readFile = (p) => {
  try {
    return fs.readFileSync(path.join(OUT_DIR, p), "utf-8");
  } catch {
    return null;
  }
};
const fromTag = (tag, p) => {
  try {
    return execSync(`git show ${tag}:${p}`, { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
};

const sections = [
  {
    num: 1,
    title: "A — разворот 290×215: карта + легенда полным столбцом",
    note: "v4.17.5 · <a href='toponyms-map.html'>toponyms-map.html</a>",
    files: [{ label: "лист A", svg: readFile("toponyms-map.svg"), pageW: 290 }],
  },
  {
    num: 2,
    fav: true,
    title: "B — страница-карта (подписи со страницами) + страница-легенда 145×215",
    note: "v4.17.5 · <a href='toponyms-map-b-print.html'>toponyms-map-b-print.html</a>",
    favNote: "★ отметка MG 03-09-2026: «the version I liked most»",
    files: [
      { label: "B — карта", svg: readFile("toponyms-map-b-map.svg"), pageW: 145 },
      { label: "B — легенда", svg: readFile("toponyms-map-b-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 3,
    title: "C — разворот с врезкой Западной Европы",
    note: "v4.17.5 · <a href='toponyms-map-c-print.html'>toponyms-map-c-print.html</a>",
    files: [{ label: "лист C", svg: readFile("toponyms-map-c.svg"), pageW: 290 }],
  },
  {
    num: 4,
    title: "D1 — все точки номерные, узкая врезка «Русь» (Киев→Новгород)",
    note: "v4.17.7 · снят с URL, файлы перезаписаны D2 — показан из git-тега",
    files: [
      { label: "D1 — карта", svg: fromTag("v4.17.7", "print/toponyms-map-d-map.svg"), pageW: 145 },
      { label: "D1 — легенда", svg: fromTag("v4.17.7", "print/toponyms-map-d-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 5,
    title: "D2 — крупный план «Русь и Западная Евразия» + обзор",
    note: "v4.17.8 · <a href='toponyms-map-d.html'>toponyms-map-d.html</a> (заморожен)",
    files: [
      { label: "D2 — карта", svg: readFile("toponyms-map-d-map.svg"), pageW: 145 },
      { label: "D2 — легенда", svg: readFile("toponyms-map-d-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 6,
    title: "D3 — крупный план «Русь, Европа и Северная Африка» + обзор, стрелка на Центральную Африку",
    note: "v4.17.9 · <a href='toponyms-map-d3.html'>toponyms-map-d3.html</a>",
    files: [
      { label: "D3 — карта", svg: readFile("toponyms-map-d3-map.svg"), pageW: 145 },
      { label: "D3 — легенда", svg: readFile("toponyms-map-d3-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 7,
    title: "B2 — вариант B с названиями на своих местах: страницы в легенде, якоря отменены, сдвиг ≤ 10 мм",
    note: "v4.17.10 · <a href='toponyms-map-b2.html'>toponyms-map-b2.html</a>",
    files: [
      { label: "B2 — карта", svg: readFile("toponyms-map-b2-map.svg"), pageW: 145 },
      { label: "B2 — легенда (83 записи)", svg: readFile("toponyms-map-b2-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 8,
    title: "B3 — самое густое ядро «Русь» во врезке крупно; цифры не пересекаются и читаются безупречно",
    note: "v4.17.16 · <a href='toponyms-map-b3.html'>toponyms-map-b3.html</a>",
    files: [
      { label: "B3 — карта", svg: readFile("toponyms-map-b3-map.svg"), pageW: 145 },
      { label: "B3 — легенда (83 записи)", svg: readFile("toponyms-map-b3-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 9,
    title: "B4 — карта в полный рост + лупа «Русь» над Индийским океаном; цифры без наложений",
    note: "v4.17.19 · <a href='toponyms-map-b4.html'>toponyms-map-b4.html</a>",
    files: [
      { label: "B4 — карта", svg: readFile("toponyms-map-b4-map.svg"), pageW: 145 },
      { label: "B4 — легенда (83 записи)", svg: readFile("toponyms-map-b4-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 10,
    title: "B5 — zoom in (верх Африки), все точки — номерные чипы, лупа киевского треугольника",
    note: "v4.17.21 · <a href='toponyms-map-b5.html'>toponyms-map-b5.html</a>",
    files: [
      { label: "B5 — карта", svg: readFile("toponyms-map-b5-map.svg"), pageW: 145 },
      { label: "B5 — легенда (83 записи)", svg: readFile("toponyms-map-b5-legend.svg"), pageW: 145 },
    ],
  },
  {
    num: 11,
    title: "B6 — zoom + врезка-ядро «Русь · Киев → Новгород» с именами; ни одной наложенной подписи (последний ресорт отменён)",
    note: "v4.17.22 · <a href='toponyms-map-b6.html'>toponyms-map-b6.html</a>",
    files: [
      { label: "B6 — карта", svg: readFile("toponyms-map-b6-map.svg"), pageW: 145 },
      { label: "B6 — легенда (83 записи)", svg: readFile("toponyms-map-b6-legend.svg"), pageW: 145 },
    ],
  },
];

const body = sections
  .map((sec) => {
    const sheets = sec.files
      .filter((f) => f.svg)
      .map(
        (f) =>
          `<h3>${esc(f.label)}</h3><div class="wrap ${f.pageW > 200 ? "w-spread" : "w-page"}">${f.svg}</div>`
      )
      .join("\n");
    const missing = sec.files.length - sec.files.filter((f) => f.svg).length;
    const fav = sec.fav ? `<p class="fav">★ ${esc(sec.favNote)}</p>` : "";
    return (
      `<h2><span class="num">Вариант №${sec.num}</span> — ${esc(sec.title.replace(/^[A-D]\d? ?— /, ""))}</h2>` +
      `<p class="note">${sec.note}${missing ? ` · <b>${missing} лист(а) недоступны</b>` : ""}</p>` +
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
  .fav { color: #ffd98a; font-size: 13px; font-weight: bold; margin: 2px 0 8px; }
  .wrap { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.5); margin-bottom: 8px; }
  .w-spread { width: 1100px; }
  .w-page { width: 550px; }
  svg { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
<h1 style="color:#fff;font-size:22px;margin:6px 0 2px;">Карта топонимов книги — все варианты (номерованные)</h1>
<p class="note">Ссылайтесь на номер варианта («№2»). Каждая D-версия — свой URL, штамп версии стоит в правом верхнем углу листов. Страница собирается scripts/print/toponyms_versions_page.mjs.</p>
${body}
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, "toponyms-map-versions.html"), html, "utf-8");
const count = sections.reduce((a, s) => a + s.files.filter((f) => f.svg).length, 0);
console.log(`toponyms-map-versions.html written: ${count} sheets across ${sections.length} variants`);
