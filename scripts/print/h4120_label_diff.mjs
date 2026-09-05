// H4120 helper: label-position diff old -> new for b9/b10 (UTF-8 safe)
import fs from "node:fs";
function labels(p) {
  const s = fs.readFileSync(p, "utf-8");
  const out = {};
  const re = /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="middle" font-size="11\.2"[^>]*>((?:<tspan[^>]*>[^<]*<\/tspan>)+)<\/text>/g;
  for (const m of s.matchAll(re)) {
    out[m[3].match(/<tspan[^>]*>([^<]*)<\/tspan>/)[1]] = [+m[1], +m[2]];
  }
  return out;
}
let bad = 0;
for (const s of ["b9", "b10"]) {
  const old = labels(`../h4120_before/toponyms-map-${s}-map.svg`);
  const neu = labels(`print/toponyms-map-${s}-map.svg`);
  if (!Object.keys(old).length || !Object.keys(neu).length) { console.log(s, "EMPTY PARSE", Object.keys(old).length, Object.keys(neu).length); bad = 1; continue; }
  const rows = [];
  for (const k of Object.keys(old)) {
    const o = old[k], v = neu[k];
    if (v && Math.hypot(v[0] - o[0], v[1] - o[1]) > 0.5) rows.push(`  ${k} ${o.join(",")} -> ${v.join(",")}`);
  }
  const gone = Object.keys(old).filter((k) => !(k in neu));
  const neu2 = Object.keys(neu).filter((k) => !(k in old));
  console.log(`== ${s} moved: ${rows.length} | new: ${neu2.join("|") || "-"} | gone: ${gone.join("|") || "-"}`);
  rows.forEach((r) => console.log(r));
}
process.exit(bad);
