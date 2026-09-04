#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate pipeline/index.html from data/video_pipeline.json.

Self-contained static dashboard (data inlined, no runtime fetch, works
offline) for the volunteer transcription/proof-reading team. Russian UI.

Usage:
    python scripts/build_pipeline_dashboard.py
"""
import sys
import os
import json
import html
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "video_pipeline.json")
OUT_DIR = os.path.join(ROOT, "pipeline")
OUT = os.path.join(OUT_DIR, "index.html")

PAGE = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Конвейер видео — BookIndex</title>
<meta name="robots" content="noindex">
<style>
:root {{
  --bg:#f4efe6; --panel:#fffdf8; --ink:#2c2622; --muted:#6f655c;
  --line:#e3d9c8; --accent:#7a5a3a; --ok:#3f7a4f; --warn:#b07a1e; --bad:#a23b2e;
  --queued:#b9ad9a;
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;
  background:var(--bg); color:var(--ink); }}
.wrap {{ max-width:1180px; margin:0 auto; padding:24px 18px 64px; }}
h1 {{ font-size:24px; margin:0 0 4px; }}
.sub {{ color:var(--muted); margin:0 0 22px; }}
.cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:24px; }}
.card {{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px 16px; }}
.card .n {{ font-size:26px; font-weight:700; }}
.card .l {{ color:var(--muted); font-size:13px; }}
.panel {{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px 18px; margin-bottom:20px; }}
.panel h2 {{ font-size:15px; margin:0 0 12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }}
.bar {{ display:flex; height:26px; border-radius:6px; overflow:hidden; border:1px solid var(--line); }}
.bar > span {{ display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; white-space:nowrap; }}
.legend {{ display:flex; flex-wrap:wrap; gap:10px 16px; margin-top:12px; font-size:13px; }}
.legend i {{ display:inline-block; width:11px; height:11px; border-radius:2px; margin-right:5px; vertical-align:baseline; }}
.controls {{ display:flex; flex-wrap:wrap; gap:10px; margin-bottom:12px; align-items:center; }}
input[type=search], select {{ font:inherit; padding:7px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel); color:inherit; }}
input[type=search] {{ flex:1; min-width:200px; }}
table {{ width:100%; border-collapse:collapse; font-size:14px; }}
th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
th {{ cursor:pointer; user-select:none; color:var(--muted); font-weight:600; white-space:nowrap; }}
th[aria-sort] {{ color:var(--ink); }}
tr:hover td {{ background:#faf6ee; }}
.pill {{ display:inline-block; padding:2px 8px; border-radius:11px; font-size:12px; color:#fff; white-space:nowrap; }}
.tq-ok {{ background:var(--ok); }} .tq-partial {{ background:var(--warn); }}
.tq-no_audio {{ background:var(--bad); }} .tq-unknown {{ background:var(--queued); }}
.muted {{ color:var(--muted); }}
a {{ color:var(--accent); }}
.flag {{ color:var(--bad); font-weight:600; }}
.count {{ color:var(--muted); font-size:13px; margin:0 0 10px; }}
footer {{ margin-top:30px; color:var(--muted); font-size:12px; }}
@media (max-width:640px) {{ .hide-sm {{ display:none; }} }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Конвейер видео</h1>
  <p class="sub">Производство II тома «Популярных лекций для юношества» — статус расшифровки и вычитки {nvideos} записей · {hours} ч · обновлено {generated}</p>

  <div class="cards">{cards}</div>

  <div class="panel">
    <h2>Стадии вычитки</h2>
    <div class="bar">{stage_bar}</div>
    <div class="legend">{stage_legend}</div>
  </div>

  <div class="panel">
    <h2>Качество автотранскрибации</h2>
    <div class="bar">{tq_bar}</div>
    <div class="legend">{tq_legend}</div>
  </div>

  <div class="panel">
    <h2>Видео</h2>
    <div class="controls">
      <input type="search" id="q" placeholder="поиск по названию, теме, исполнителю…" aria-label="поиск">
      <select id="fstage"><option value="">все стадии</option>{stage_opts}</select>
      <select id="ftheme"><option value="">все темы</option>{theme_opts}</select>
      <select id="fflag">
        <option value="">все</option>
        <option value="stale">висящие задания</option>
        <option value="problem">проблемы транскрибации</option>
        <option value="notcat">нет в каталоге</option>
      </select>
    </div>
    <p class="count" id="count"></p>
    <table id="tbl">
      <thead><tr>
        <th data-k="title">Название</th>
        <th data-k="theme" class="hide-sm">Тема</th>
        <th data-k="priority" class="hide-sm">Приоритет</th>
        <th data-k="duration_sec" class="hide-sm">Длит.</th>
        <th data-k="stageOrder">Стадия</th>
        <th data-k="tq">Транскр.</th>
        <th data-k="assignee" class="hide-sm">Исполнитель</th>
        <th>Ссылки</th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>

  <footer>
    Источник: <code>data/video_pipeline.json</code> (мигрировано из <code>video-archive.xlsx</code>, таблица выведена из обращения).
    Страница генерируется <code>scripts/build_pipeline_dashboard.py</code> — не редактировать вручную.
  </footer>
</div>

<script id="data" type="application/json">{data_json}</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const STAGE = {{}}; DATA.stages.forEach(s => STAGE[s.key] = s);
const STAGE_COLOR = {{queued:'#b9ad9a',transcribed:'#9aa97f',review:'#c2a35a',read1:'#b78b4a',read2:'#a9763c',read3:'#9a6030',prelayout:'#7f6a8a',layout:'#6a7f8f',done:'#3f7a4f'}};
const TQ_LABEL = {{ok:'готово',partial:'частично',no_audio:'без звука',unknown:'неизвестно'}};
const safeUrl = u => {{
  if (!u) return null;
  try {{
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  }} catch (e) {{
    return null;
  }}
}};

function firstAssignee(v) {{
  const ord = ['layout','prelayout','read3','read2','read1','review'];
  for (const k of ord) if (v.proof && v.proof[k] && v.proof[k].assignee) return v.proof[k].assignee;
  return '';
}}
function isStale(v) {{
  return !!(v.assigned && v.assigned.issued && !v.assigned.submitted) && v.stage !== 'done';
}}
function isProblem(v) {{ return v.transcription.quality === 'partial' || v.transcription.quality === 'no_audio'; }}

const enriched = DATA.videos.map(v => ({{
  ...v,
  stageOrder: STAGE[v.stage] ? STAGE[v.stage].order : -1,
  stageLabel: STAGE[v.stage] ? STAGE[v.stage].label : v.stage,
  tq: v.transcription.quality,
  assignee: firstAssignee(v),
  _stale: isStale(v),
  _problem: isProblem(v),
}}));

let sortK = 'stageOrder', sortDir = -1;
const $ = id => document.getElementById(id);

function rowRow(v) {{
  const tr = document.createElement('tr');

  const tdTitle = document.createElement('td');
  tdTitle.textContent = v.title == null ? '' : v.title;
  if (!v.in_catalog) {{
    const notcat = document.createElement('span');
    notcat.className = 'muted';
    notcat.title = 'нет в каталоге приложения';
    notcat.textContent = ' ∉';
    tdTitle.appendChild(notcat);
  }}
  tr.appendChild(tdTitle);

  const tdTheme = document.createElement('td');
  tdTheme.className = 'hide-sm muted';
  tdTheme.textContent = v.theme || '';
  tr.appendChild(tdTheme);

  const tdPriority = document.createElement('td');
  tdPriority.className = 'hide-sm muted';
  tdPriority.textContent = v.priority || '';
  tr.appendChild(tdPriority);

  const tdDur = document.createElement('td');
  tdDur.className = 'hide-sm muted';
  tdDur.textContent = v.duration_hms || '';
  tr.appendChild(tdDur);

  const tdStage = document.createElement('td');
  const dot = document.createElement('span');
  dot.style.display = 'inline-block';
  dot.style.width = '9px';
  dot.style.height = '9px';
  dot.style.borderRadius = '50%';
  dot.style.background = STAGE_COLOR[v.stage] || '#ccc';
  dot.style.marginRight = '6px';
  tdStage.appendChild(dot);
  tdStage.appendChild(document.createTextNode(v.stageLabel == null ? '' : v.stageLabel));
  if (v.stage_inferred) {{
    const inf = document.createElement('span');
    inf.className = 'muted';
    inf.title = 'стадия выведена автоматически';
    inf.textContent = ' ~';
    tdStage.appendChild(inf);
  }}
  if (v._stale) {{
    const stale = document.createElement('span');
    stale.className = 'flag';
    stale.title = 'выдано, но не сдано';
    stale.textContent = ' ⚠';
    tdStage.appendChild(stale);
  }}
  tr.appendChild(tdStage);

  const tdTq = document.createElement('td');
  const pill = document.createElement('span');
  pill.className = 'pill tq-' + (v.tq || '');
  pill.textContent = TQ_LABEL[v.tq] || v.tq || '';
  tdTq.appendChild(pill);
  tr.appendChild(tdTq);

  const tdAssignee = document.createElement('td');
  tdAssignee.className = 'hide-sm muted';
  tdAssignee.textContent = v.assignee || '';
  tr.appendChild(tdAssignee);

  const tdLinks = document.createElement('td');
  const addLink = (href, label) => {{
    const u = safeUrl(href);
    if (!u) return null;
    const a = document.createElement('a');
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    return a;
  }};
  const yt = addLink(v.youtube_url, 'YouTube');
  const tx = addLink(v.links && v.links.text, 'текст');
  if (yt) tdLinks.appendChild(yt);
  if (yt && tx) tdLinks.appendChild(document.createTextNode(' · '));
  if (tx) tdLinks.appendChild(tx);
  tr.appendChild(tdLinks);

  return tr;
}}

function render() {{
  const q = $('q').value.trim().toLowerCase();
  const fs = $('fstage').value, ft = $('ftheme').value, ff = $('fflag').value;
  let list = enriched.filter(v => {{
    if (fs && v.stage !== fs) return false;
    if (ft && v.theme !== ft) return false;
    if (ff === 'stale' && !v._stale) return false;
    if (ff === 'problem' && !v._problem) return false;
    if (ff === 'notcat' && v.in_catalog) return false;
    if (q) {{
      const hay = (v.title+' '+(v.theme||'')+' '+(v.assignee||'')+' '+(v.notes||'')).toLowerCase();
      if (!hay.includes(q)) return false;
    }}
    return true;
  }});
  list.sort((a,b) => {{
    let x=a[sortK], y=b[sortK];
    if (typeof x === 'string') {{ x=x.toLowerCase(); y=(y||'').toLowerCase(); }}
    if (x<y) return -sortDir; if (x>y) return sortDir; return 0;
  }});
  const rows = $('rows');
  rows.textContent = '';
  list.forEach(v => rows.appendChild(rowRow(v)));
  $('count').textContent = `показано ${{list.length}} из ${{enriched.length}}`;
}}

document.querySelectorAll('th[data-k]').forEach(th => th.addEventListener('click', () => {{
  const k = th.dataset.k;
  if (sortK === k) sortDir = -sortDir; else {{ sortK = k; sortDir = 1; }}
  document.querySelectorAll('th[data-k]').forEach(t => t.removeAttribute('aria-sort'));
  th.setAttribute('aria-sort', sortDir===1?'ascending':'descending');
  render();
}}));
['q','fstage','ftheme','fflag'].forEach(id => $(id).addEventListener('input', render));
render();
</script>
</body>
</html>
"""


def card(n, label):
    return f'<div class="card"><div class="n">{n}</div><div class="l">{html.escape(label)}</div></div>'


def seg_bar(items, colors, total):
    """items: list of (key, label, count). Returns (bar_html, legend_html)."""
    bar, legend = [], []
    for key, label, cnt in items:
        if cnt == 0:
            continue
        pct = cnt / total * 100 if total else 0
        color = colors.get(key, "#999")
        txt = str(cnt) if pct >= 6 else ""
        bar.append(f'<span style="width:{pct:.2f}%;background:{color}" title="{html.escape(label)}: {cnt}">{txt}</span>')
        legend.append(f'<span><i style="background:{color}"></i>{html.escape(label)} — {cnt}</span>')
    return "".join(bar), "".join(legend)


STAGE_COLORS = {
    "queued": "#b9ad9a", "transcribed": "#9aa97f", "review": "#c2a35a",
    "read1": "#b78b4a", "read2": "#a9763c", "read3": "#9a6030",
    "prelayout": "#7f6a8a", "layout": "#6a7f8f", "done": "#3f7a4f",
}
TQ_COLORS = {"ok": "#3f7a4f", "partial": "#b07a1e", "no_audio": "#a23b2e", "unknown": "#b9ad9a"}
TQ_LABELS = {"ok": "готово", "partial": "частично", "no_audio": "без звука", "unknown": "неизвестно"}


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    s = data["stats"]
    total = s["videos"]

    # cards
    stale = sum(1 for v in data["videos"]
                if v["assigned"]["issued"] and not v["assigned"]["submitted"] and v["stage"] != "done")
    problem = sum(1 for v in data["videos"] if v["transcription"]["quality"] in ("partial", "no_audio"))
    done_ish = s["by_stage"].get("layout", 0) + s["by_stage"].get("done", 0)
    cards = "".join([
        card(total, "видео всего"),
        card(s["total_hours"], "часов записи"),
        card(s["by_transcription_quality"].get("ok", 0), "транскрибация готова"),
        card(stale, "висящих заданий"),
        card(problem, "проблем транскрибации"),
        card(done_ish, "в вёрстке / готово"),
    ])

    # stage bar in pipeline order
    stage_items = [(st["key"], st["label"], s["by_stage"].get(st["key"], 0)) for st in data["stages"]]
    stage_bar, stage_legend = seg_bar(stage_items, STAGE_COLORS, total)

    # transcription quality bar
    tq_items = [(k, TQ_LABELS.get(k, k), s["by_transcription_quality"].get(k, 0))
                for k in ("ok", "partial", "no_audio", "unknown")]
    tq_bar, tq_legend = seg_bar(tq_items, TQ_COLORS, total)

    stage_opts = "".join(
        f'<option value="{st["key"]}">{html.escape(st["label"])}</option>' for st in data["stages"]
    )
    themes = sorted(s["by_theme"].keys())
    theme_opts = "".join(f'<option value="{html.escape(t)}">{html.escape(t)}</option>' for t in themes)

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    page = PAGE.format(
        nvideos=total,
        hours=s["total_hours"],
        generated=generated,
        cards=cards,
        stage_bar=stage_bar,
        stage_legend=stage_legend,
        tq_bar=tq_bar,
        tq_legend=tq_legend,
        stage_opts=stage_opts,
        theme_opts=theme_opts,
        data_json=json.dumps(data, ensure_ascii=False).replace("</", "<\\/"),
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page)
    with open(OUT, "rb") as f:
        assert f.read(3).hex() != "efbbbf", "BOM written — fix encoding"
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
