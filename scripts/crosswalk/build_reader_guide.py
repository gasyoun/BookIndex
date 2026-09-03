#!/usr/bin/env python3
"""Build the reader guide «главы книги → видеоархив» (H3657).

derive-don't-store: everything published is generated from the curator-gated
crosswalk + the video catalog + hand-authored prose. Hand edits go to
scripts/crosswalk/reader_guide_prose.json, never to the outputs.

Outputs (--emit):
  data/reader_guide.json                      machine-readable guide module
  guide.html                                  standalone static page (no JS)
  docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md reader-guide document

Usage:
  python3 scripts/crosswalk/build_reader_guide.py --emit
  python3 scripts/crosswalk/build_reader_guide.py --check   # byte-exact parity

Python floor: 3.9 (stdlib only; no ``Path.read_text(newline=...)``).
"""

import argparse
import hashlib
import html
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CROSSWALK = ROOT / "data" / "modules" / "22-crosswalk.json"
CATALOG = ROOT / "data" / "video_catalog_public.v2.json"
LECTURES = ROOT / "data" / "modules" / "20-lectures.json"
PROSE = ROOT / "scripts" / "crosswalk" / "reader_guide_prose.json"
OUT_JSON = ROOT / "data" / "reader_guide.json"
OUT_HTML = ROOT / "guide.html"
OUT_DOC = ROOT / "docs" / "READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md"

CHAPTER_IDS = ["ch%02d" % i for i in range(1, 12)]

# Parity gate: approved-videos per chapter, frozen from the camera-ready
# сверка table (docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md, sum 142).
EXPECTED_APPROVED = {
    "ch01": 20, "ch02": 1, "ch03": 1, "ch04": 4, "ch05": 5,
    "ch06": 38, "ch07": 0, "ch08": 25, "ch09": 18, "ch10": 19, "ch11": 11,
}

RELATION_RU = {
    "lecture_of": "лекция темы главы",
    "expands": "дополняет главу",
    "about_zaliznyak": "о Зализняке",
    "other_book": "другая книга",
    "scholarly_work": "научная работа",
    "sequel_to": "продолжение темы",
}
RELATION_ORDER = ["lecture_of", "expands", "about_zaliznyak", "other_book",
                  "scholarly_work", "sequel_to"]
PASS_RU = {"series": "серия", "kwic": "KWIC", "title_topics": "заголовки",
           "llm": "DeepSeek", "curator": "куратор"}
PASS_ORDER = ["kwic", "curator", "llm", "title_topics", "series"]

# Хронология ЛЛШ (сверка samskrtam.ru/llsh 14-08-2026; полоса 5 камера-реди).
LLSH_CHRONOLOGY = [
    {"accession": "acc005", "year": 2007, "school": "IX", "date": "10 июля 2007", "place": "Ратмино"},
    {"accession": "acc007", "year": 2008, "school": "X", "date": "9 июля 2008", "place": "Ратмино"},
    {"accession": "acc003", "year": 2009, "school": "XI", "date": "17 июля 2009", "place": "Ратмино"},
    {"accession": "acc032", "year": 2010, "school": "XII", "date": "8 июля 2010", "place": "Ратмино"},
    {"accession": "acc033", "year": 2011, "school": "XIII", "date": "8 июля 2011", "place": "Ратмино"},
    {"accession": "acc006", "year": 2012, "school": "XIV", "date": "9 июля 2012", "place": "Ратмино"},
    {"accession": "acc001", "year": 2013, "school": "XV", "date": "10 июля 2013", "place": "Ратмино"},
    {"accession": "acc004", "year": 2014, "school": "XVI", "date": "9 июля 2014", "place": "Ратмино"},
    {"accession": "acc002", "year": 2015, "school": "XVII", "date": "8 июля 2015", "place": "Ратмино"},
    {"accession": "acc139", "year": 2016, "school": "XVIII", "date": "9 июля 2016", "place": "Вороново"},
    {"accession": "acc140", "year": 2017, "school": "XIX", "date": "8 июля 2017", "place": "Вороново"},
]

# Соседство тем: доклад ЛЛШ → глава книги (камера-реди, служебная таблица
# «Две карты, не одна»; соседство ≠ кураторский голос). Порядок хронологический —
# им же рендерится столбец «Соседний доклад ЛЛШ». Заземление каждого соседства —
# H4024 (03-09-2026), сверка с 22-crosswalk.json:
#   acc005 ch09 серия auto (куратор утвердил доклад в ch06 112:14);
#   acc007 ch06 approved 34:50 (ребра в ch10 нет — старое соседство было без заземления);
#   acc032 ch04 approved 88:34 (ch10 — только auto по заголовку);
#   acc033 исключён: утверждённых рёбер нет ни в одну главу (ch05 rejected, ch10 auto);
#   acc139 ch10 по названию «Ещё раз о жизни слов»;
#   acc004 ch10 approved 114:46.
LLSH_TOPIC_NEIGHBOR = {
    "acc005": "ch09", "acc007": "ch06", "acc003": "ch08", "acc032": "ch04",
    "acc006": "ch06", "acc001": "ch07", "acc004": "ch10",
    "acc002": "ch08", "acc139": "ch10", "acc140": "ch08",
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def parse_timecode(edge):
    """Return total seconds of the edge's minute mark, or None."""
    tc = edge.get("timecode")
    if tc:
        parts = [int(p) for p in str(tc).split(":")]
        while len(parts) < 3:
            parts.insert(0, 0)
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    at = (edge.get("evidence") or {}).get("at")
    if isinstance(at, (int, float)):
        return int(at)
    return None


def fmt_tc(seconds):
    if seconds is None:
        return None
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    if h:
        return "%d:%02d:%02d" % (h, m, s)
    return "%d:%02d" % (m, s)


def fmt_dur(seconds):
    m = int(round(seconds / 60.0))
    h, m = divmod(m, 60)
    if h:
        return "%d ч %02d мин" % (h, m)
    return "%d мин" % m


def edge_rank(edge, seconds):
    return (
        1 if seconds is not None else 0,
        PASS_ORDER.index(edge.get("pass")) if edge.get("pass") in PASS_ORDER else 99,
        edge.get("confidence") or 0.0,
    )


def video_entry(edge, catalog):
    """catalog is keyed by accession WITH the acc-prefix (acc001…)."""
    acc = "acc" + edge["accession"]
    rec = catalog.get(acc, {})
    seconds = parse_timecode(edge)
    watch = rec.get("watch_url") or ("https://www.youtube.com/watch?v=" + acc)
    entry = {
        "accession": acc,
        "title": rec.get("title_display") or acc,
        "watch_url": watch,
        "duration_seconds": rec.get("duration_seconds"),
        "duration_human": fmt_dur(rec["duration_seconds"]) if rec.get("duration_seconds") else None,
        "timecode": fmt_tc(seconds),
        "timecode_seconds": seconds,
        "relation": edge.get("relation"),
        "relation_ru": RELATION_RU.get(edge.get("relation"), edge.get("relation")),
        "pass": edge.get("pass"),
        "pass_ru": PASS_RU.get(edge.get("pass"), edge.get("pass")),
        "confidence": edge.get("confidence"),
    }
    if rec.get("duplicate_of"):
        entry["duplicate_of"] = "acc" + rec["duplicate_of"]
    return entry


def with_timecode_url(entry):
    url = entry["watch_url"]
    if entry["timecode_seconds"]:
        url = url + "&t=%ds" % entry["timecode_seconds"]
    entry["watch_url_at_minute"] = url
    return entry


def build():
    crosswalk = load_json(CROSSWALK)["crosswalk"]
    catalog = {"acc" + v["accession"]: v for v in load_json(CATALOG)["videos"]}
    lectures = load_json(LECTURES)["chapters"]
    prose = load_json(PROSE)

    chapter_names = {c["id"]: c["name"] for c in crosswalk["chapters"]}
    if [chapter_names[cid] for cid in CHAPTER_IDS] != [c["name"] for c in lectures]:
        raise SystemExit("chapter names diverge between 22-crosswalk.json and 20-lectures.json")

    by_chapter = defaultdict(lambda: defaultdict(list))
    for edge in crosswalk["edges"]:
        by_chapter[edge["chapter"]][edge.get("status") or "auto"].append(edge)

    # curator gate facts from the applied v4 decisions
    gate = load_json(ROOT / "data" / "crosswalk" / "gate_decisions_v4.json")
    gate_meta = {
        "sheet_id": gate.get("sheet_id"),
        "decided": gate.get("decided"),
        "undecided": gate.get("undecided"),
        "vote_seconds": gate.get("time_total_seconds"),
        "date": prose["gate_date"],
    }

    chapters = []
    problems = []
    for cid in CHAPTER_IDS:
        edges = by_chapter.get(cid, {})
        approved_edges = edges.get("approved", [])
        auto_edges = edges.get("auto", [])

        approved_map = {}
        for e in approved_edges:
            key = e["accession"]
            if key not in approved_map or edge_rank(e, parse_timecode(e)) > edge_rank(approved_map[key], parse_timecode(approved_map[key])):
                approved_map[key] = e
        approved = sorted(
            (video_entry(e, catalog) for e in approved_map.values()),
            key=lambda v: (
                RELATION_ORDER.index(v["relation"]) if v["relation"] in RELATION_ORDER else 99,
                0 if v["timecode_seconds"] is not None else 1,
                v["accession"],
            ),
        )
        approved = [with_timecode_url(v) for v in approved]

        auto_map = {}
        for e in auto_edges:
            key = e["accession"]
            if key not in auto_map or edge_rank(e, parse_timecode(e)) > edge_rank(auto_map[key], parse_timecode(auto_map[key])):
                auto_map[key] = e
        auto = sorted(
            (video_entry(e, catalog) for e in auto_map.values()),
            key=lambda v: (
                0 if v["timecode_seconds"] is not None else 1,
                -(v["confidence"] or 0.0),
                PASS_ORDER.index(v["pass"]) if v["pass"] in PASS_ORDER else 99,
                v["accession"],
            ),
        )
        auto = [with_timecode_url(v) for v in auto]

        n_app = len(approved)
        if n_app != EXPECTED_APPROVED[cid]:
            problems.append("%s approved %d != camera-ready %d" % (cid, n_app, EXPECTED_APPROVED[cid]))

        start_accs = prose["chapters"][cid]["start_here"]
        approved_accs = {v["accession"] for v in approved}
        for a in start_accs:
            if a not in approved_accs:
                problems.append("%s start_here %s is not an approved edge" % (cid, a))
        by_acc = {v["accession"]: v for v in approved}
        start_here = [by_acc[a] for a in start_accs]

        rejected_n = len(edges.get("rejected", []))
        chapters.append({
            "id": cid,
            "name": chapter_names[cid],
            "pages": "%d–%d" % (lectures[int(cid[2:]) - 1]["start"], lectures[int(cid[2:]) - 1]["end"]),
            "intro": prose["chapters"][cid]["intro"],
            "counts": {
                "approved_videos": n_app,
                "approved_edges": len(approved_edges),
                "auto_videos": len(auto),
                "auto_edges": len(auto_edges),
                "rejected_edges": rejected_n,
                "with_timecode": sum(1 for v in approved if v["timecode_seconds"] is not None),
            },
            "start_here": start_here,
            "approved": approved,
            "auto": auto,
            "llsh_neighbor": LLSH_TOPIC_NEIGHBOR.get(
                next((k for k, v in LLSH_TOPIC_NEIGHBOR.items() if v == cid), None)
            ) and None,  # replaced below
        })

    # attach ЛЛШ neighbor per chapter (inverse of the topic map)
    neighbor_by_chapter = defaultdict(list)
    for acc, cid in LLSH_TOPIC_NEIGHBOR.items():
        neighbor_by_chapter[cid].append(acc)
    for ch in chapters:
        accs = neighbor_by_chapter.get(ch["id"], [])
        ch["llsh_neighbors"] = [{
            "accession": a,
            "title": (catalog.get(a, {}) or {}).get("title_display") or a,
            "year": next(x["year"] for x in LLSH_CHRONOLOGY if x["accession"] == a),
        } for a in accs]
        del ch["llsh_neighbor"]

    chronology = []
    approved_chapters_of = defaultdict(set)
    for e in crosswalk["edges"]:
        if e.get("status") == "approved":
            approved_chapters_of["acc" + e["accession"]].add(e["chapter"])
    for row in LLSH_CHRONOLOGY:
        acc = row["accession"]
        rec = catalog.get(acc, {}) or {}
        chronology.append({
            "accession": acc,
            "title": rec.get("title_display") or acc,
            "watch_url": rec.get("watch_url"),
            "year": row["year"],
            "school": row["school"],
            "date": row["date"],
            "place": row["place"],
            "duration_seconds": rec.get("duration_seconds"),
            "duration_human": fmt_dur(rec["duration_seconds"]) if rec.get("duration_seconds") else None,
            "duplicate_of": ("acc" + rec["duplicate_of"]) if rec.get("duplicate_of") else None,
            "approved_chapters": sorted(approved_chapters_of.get(acc, set())),
        })

    total_approved_edges = sum(ch["counts"]["approved_edges"] for ch in chapters)
    total_approved_videos = len({v["accession"] for ch in chapters for v in ch["approved"]})
    total_auto_edges = sum(ch["counts"]["auto_edges"] for ch in chapters)

    return {
        "schema": "bookindex.reader_guide/1",
        "generated": {"doc_updated": prose["doc_updated"], "gate_date": prose["gate_date"]},
        "gate": gate_meta,
        "totals": {
            "approved_edges": total_approved_edges,
            "approved_videos": total_approved_videos,
            "approved_with_timecode": sum(ch["counts"]["with_timecode"] for ch in chapters),
            "auto_edges": total_auto_edges,
            "catalog_videos": len(catalog),
        },
        "book": {"title": "Из жизни слов и языков", "author": "А. А. Зализняк"},
        "chapters": chapters,
        "llsh_chronology": chronology,
        "meta_intro": prose["meta_intro"],
        "_problems": problems,
    }


# ---------------------------------------------------------------- rendering

CSS = """:root{--ink:#2b2118;--paper:#faf6ee;--accent:#5a3818;--line:#d8c9a8;--auto:#7a6a52;}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);
font:17px/1.55 Georgia,'Times New Roman',serif}
main{max-width:56rem;margin:0 auto;padding:0 1.25rem 4rem}
header.site{background:var(--accent);color:#f7efdd;padding:2.2rem 1.25rem 1.6rem}
header.site .wrap{max-width:56rem;margin:0 auto}
header.site h1{margin:0 0 .4rem;font-size:1.9rem;line-height:1.2}
header.site p{margin:.3rem 0;max-width:46rem}
.badges{margin-top:.7rem;font-size:.92rem}
.badges span{display:inline-block;background:rgba(255,255,255,.14);border-radius:.4rem;padding:.15rem .6rem;margin:.15rem .35rem .15rem 0}
nav.chapters{background:#f1e9d7;border-bottom:1px solid var(--line);padding:.6rem 1.25rem;font-size:.95rem}
nav.chapters .wrap{max-width:56rem;margin:0 auto}nav.chapters a{color:var(--accent);margin-right:.9rem;white-space:nowrap}
section.chapter{border-bottom:2px solid var(--line);padding:1.6rem 0 1.2rem}
section.chapter>h2{font-size:1.35rem;margin:0 0 .3rem;color:var(--accent)}
.pages{font-size:.9rem;color:var(--auto)}
.intro{margin:.6rem 0 1rem}
h3{font-size:1.05rem;margin:1.2rem 0 .5rem}
ol.videos{list-style:none;margin:0;padding:0}
ol.videos li{padding:.45rem 0;border-top:1px dotted var(--line)}
ol.videos li:first-child{border-top:none}
.vt{font-weight:bold}
.meta{color:var(--auto);font-size:.9rem}
a{color:var(--accent)}
.status-approved{color:#2c5e2e;font-size:.85rem}
.status-auto{color:var(--auto);font-size:.85rem}
.empty-note{background:#f1e9d7;border-left:4px solid var(--accent);padding:.8rem 1rem;margin:.8rem 0}
.start{background:#f1e9d7;border-radius:.5rem;padding:.7rem 1rem;margin:.2rem 0 1rem}
.start ol{margin:.3rem 0 0;padding-left:1.3rem}
aside.llsh{font-size:.92rem;color:var(--auto);margin:.6rem 0}
table{border-collapse:collapse;width:100%;font-size:.95rem;margin:.6rem 0 1rem}
th,td{text-align:left;padding:.4rem .55rem;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--accent)}
footer{padding:2rem 1.25rem 3rem;font-size:.9rem;color:var(--auto)}
footer .wrap{max-width:56rem;margin:0 auto}
code{font-size:.88em}
"""


def esc(s):
    return html.escape(str(s), quote=True)


def video_li(v, status):
    rel = esc(v["relation_ru"])
    cls = "status-approved" if status == "approved" else "status-auto"
    label = "утверждено куратором" if status == "approved" else "машинный кандидат · %s" % esc(v["pass_ru"])
    dup = " · дубль %s" % esc(v["duplicate_of"]) if v.get("duplicate_of") else ""
    watch = "смотреть" + ((" ▶ " + esc(v["timecode"])) if v["timecode_seconds"] is not None else "")
    return ('<li><span class="vt">%s</span> — %s, %s · '
            '<a href="%s">%s</a> <span class="meta">(%s%s)</span> '
            '<span class="%s">[%s]</span></li>'
            % (esc(v["title"]), rel, esc(v["duration_human"] or ""),
               esc(v["watch_url_at_minute"]), watch,
               rel, dup, cls, label))


def render_html(guide):
    t = guide["totals"]
    parts = []
    parts.append("<!doctype html>\n<html lang=\"ru\">\n<head>\n<meta charset=\"utf-8\" />\n")
    parts.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n")
    style_hash = hashlib.sha256(CSS.encode("utf-8")).hexdigest()
    import base64
    b64 = base64.b64encode(bytes.fromhex(style_hash)).decode("ascii")
    parts.append("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'none'; "
                 "style-src 'self' 'sha256-%s'; img-src 'self' data:; object-src 'none'; base-uri 'self'\" />\n" % b64)
    parts.append("<meta name=\"description\" content=\"Гид по видеоархиву А. А. Зализняка: что смотреть к каждой из 11 глав книги «Из жизни слов и языков».\" />\n")
    parts.append("<link rel=\"icon\" type=\"image/svg+xml\" href=\"./icon-192.svg\" />\n")
    parts.append("<title>Гид по видеоархиву к главам книги · BookIndex</title>\n")
    parts.append("<style>" + CSS + "</style>\n</head>\n<body>\n")

    parts.append("<header class=\"site\"><div class=\"wrap\">")
    parts.append("<p class=\"eyebrow\">А. А. Зализняк · «Из жизни слов и языков»</p>")
    parts.append("<h1>Гид по видеоархиву: что смотреть к главам книги</h1>")
    parts.append("<p>%s</p>" % esc(guide["meta_intro"]))
    parts.append("<div class=\"badges\"><span>%d утверждённых связок</span><span>%d видео</span>"
                 "<span>%d с минутой</span><span>%d машинных кандидатов</span><span>архив: %d записей</span></div>"
                 % (t["approved_edges"], t["approved_videos"], t["approved_with_timecode"],
                    t["auto_edges"], t["catalog_videos"]))
    parts.append("</div></header>\n")

    parts.append("<nav class=\"chapters\" aria-label=\"Главы\"><div class=\"wrap\">")
    for ch in guide["chapters"]:
        parts.append("<a href=\"#%s\">%s</a>" % (ch["id"], esc(ch["name"])))
    parts.append("<a href=\"#llsh\">Доклады ЛЛШ</a></div></nav>\n")

    parts.append("<main>")
    for ch in guide["chapters"]:
        c = ch["counts"]
        parts.append("<section class=\"chapter\" id=\"%s\" data-chapter=\"%s\">" % (ch["id"], ch["id"]))
        parts.append("<h2>%s</h2> <span class=\"pages\">стр. %s</span>" % (esc(ch["name"]), esc(ch["pages"])))
        parts.append("<p class=\"intro\">%s</p>" % esc(ch["intro"]))
        if ch["start_here"]:
            parts.append("<div class=\"start\"><strong>С чего начать</strong><ol>")
            for v in ch["start_here"]:
                tc = " — с минуты %s" % esc(v["timecode"]) if v["timecode_seconds"] is not None else ""
                parts.append("<li><a href=\"%s\">%s</a>%s</li>"
                             % (esc(v["watch_url_at_minute"]), esc(v["title"]), tc))
            parts.append("</ol></div>")
        parts.append("<h3>Утверждено куратором (%d)</h3>" % c["approved_videos"])
        if ch["approved"]:
            parts.append("<ol class=\"videos\">")
            for v in ch["approved"]:
                parts.append(video_li(v, "approved"))
            parts.append("</ol>")
        else:
            parts.append("<div class=\"empty-note\">Утверждённых связей нет: куратор не утвердил ни одной. "
                         "Это отказ печатать спорное, а не пробел в архиве.</div>")
        if ch["auto"]:
            parts.append("<h3>Машинные кандидаты — куратором не утверждены (%d)</h3>" % len(ch["auto"]))
            parts.append("<ol class=\"videos\">")
            for v in ch["auto"]:
                parts.append(video_li(v, "auto"))
            parts.append("</ol>")
        for nb in ch.get("llsh_neighbors", []):
            parts.append("<aside class=\"llsh\">Соседняя публичная серия: доклад Летней лингвистической школы %d года — «%s» (см. <a href=\"#llsh\">хронологию</a>).</aside>"
                         % (nb["year"], esc(nb["title"])))
        parts.append("</section>\n")

    parts.append("<section class=\"chapter\" id=\"llsh\" data-chapter=\"llsh\">")
    parts.append("<h2>Одиннадцать докладов Летней лингвистической школы, 2007–2017</h2>")
    parts.append("<p class=\"intro\">С 2007 по 2017 год Зализняк каждое лето выступал на Летней лингвистической школе — "
                 "сначала в Ратмине под Дубной, с 2016 года в Воронове. Это открытая публичная серия, соседняя по темам "
                 "с лекциями «Муми-тролля», из которых сложена книга. В колонке «Утверждённые связи» — куда куратор "
                 "утвердил каждый доклад в карте главы.</p>")
    parts.append("<table><thead><tr><th>Год</th><th>Школа</th><th>Доклад</th><th>Длительность</th><th>Дата</th><th>Место</th><th>Утверждённые связи</th></tr></thead><tbody>")
    for row in guide["llsh_chronology"]:
        dup = " (дубль %s)" % esc(row["duplicate_of"]) if row.get("duplicate_of") else ""
        chs = ", ".join(esc(c) for c in row["approved_chapters"]) if row["approved_chapters"] else "—"
        parts.append("<tr><td>%d</td><td>%s</td><td><a href=\"%s\">%s</a>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                     % (row["year"], esc(row["school"]), esc(row["watch_url"] or "#"), esc(row["title"]), dup,
                        esc(row["duration_human"] or ""), esc(row["date"]), esc(row["place"]), chs))
    parts.append("</tbody></table></section>\n")

    parts.append("</main>")
    parts.append("<footer><div class=\"wrap\"><p>Методика: гид собран автоматически из креста «видео ↔ главы» "
                 "(<code>data/modules/22-crosswalk.json</code>), каталога 176 записей и кураторских голосов гейта v4 "
                 "(%d карточек, %s). Только связи со статусом <code>approved</code> идут в основной список; "
                 "<code>auto</code> показаны отдельно с пометкой «машинный кандидат».</p>" % (guide["gate"]["decided"], esc(guide["gate"]["date"])))
    parts.append("<p>Полный каталог с поиском по минуте — в <a href=\"./aaz-index.html\">цифровом спутнике</a>. "
                 "Данные гида: <code>data/reader_guide.json</code>; регенерация: "
                 "<code>python3 scripts/crosswalk/build_reader_guide.py --emit</code>.</p></div></footer>")
    parts.append("\n</body>\n</html>\n")
    return "".join(parts)


def render_doc(guide):
    t = guide["totals"]
    upd = guide["generated"]["doc_updated"]
    lines = []
    lines.append("# Гид читателя: главы книги → видеоархив")
    lines.append("")
    lines.append("_Created: 28-08-2026 · Last updated: %s_" % upd)
    lines.append("")
    lines.append(guide["meta_intro"])
    lines.append("")
    lines.append("Страница для читателя: [guide.html](https://github.com/gasyoun/BookIndex/blob/main/guide.html) "
                 "(живёт на сайте: <https://gasyoun.github.io/BookIndex/guide.html>). Данные: "
                 "[data/reader_guide.json](https://github.com/gasyoun/BookIndex/blob/main/data/reader_guide.json). "
                 "Редакторская проза и выбор «с чего начать»: "
                 "[scripts/crosswalk/reader_guide_prose.json](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/reader_guide_prose.json).")
    lines.append("")
    lines.append("## Статусы")
    lines.append("")
    lines.append("- **Утверждено куратором** — ребро креста со статусом `approved`: за связь проголосовал владелец в куратор-гейте v4 (%s, %d карточек)." % (guide["gate"]["date"], guide["gate"]["decided"]))
    lines.append("- **Машинный кандидат** — ребро `auto` (проходы «серия», «KWIC», «заголовки», DeepSeek): куратор не утверждал и не отклонял; на печатный разворот не идёт.")
    lines.append("- Отклонённые куратором связи (`rejected`, %d) в гид не входят." % sum(ch["counts"]["rejected_edges"] for ch in guide["chapters"]))
    lines.append("")
    lines.append("## Сводка по главам")
    lines.append("")
    lines.append("| Глава | стр. | Утверждено видео | Из них с минутой | Машинных кандидатов | Соседний доклад ЛЛШ |")
    lines.append("|---|---|---|---|---|---|")
    for ch in guide["chapters"]:
        nb = ", ".join("«%s» (%d)" % (n["title"], n["year"]) for n in ch["llsh_neighbors"]) if ch["llsh_neighbors"] else "—"
        lines.append("| %s | %s | %d | %d | %d | %s |" % (
            esc(ch["name"]), esc(ch["pages"]), ch["counts"]["approved_videos"],
            ch["counts"]["with_timecode"], ch["counts"]["auto_videos"], nb))
    lines.append("| **сумма** | | **%d** | **%d** | **%d** (рёбер) | |" % (
        t["approved_videos"], t["approved_with_timecode"], t["auto_edges"]))
    lines.append("")
    lines.append("Сверка с камера-реди полосы 4 ([PRINT_SPREADS_4_5_CAMERA_READY_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md)): "
                 "утверждённые видео по главам 20/1/1/4/5/38/0/25/18/19/11 = **142** — паритет проверяется генератором при каждом запуске.")
    lines.append("")
    lines.append("## Хронология докладов ЛЛШ 2007–2017")
    lines.append("")
    lines.append("| Год | Школа | Доклад | Длительность | Дата | Место | Утверждённые связи |")
    lines.append("|---|---|---|---|---|---|---|")
    for row in guide["llsh_chronology"]:
        dup = " (дубль %s)" % esc(row["duplicate_of"]) if row.get("duplicate_of") else ""
        chs = ", ".join("`%s`" % c for c in row["approved_chapters"]) if row["approved_chapters"] else "—"
        lines.append("| %d | %s | [%s](%s)%s | %s | %s | %s | %s |" % (
            row["year"], row["school"], esc(row["title"]), esc(row["watch_url"] or "#"), dup,
            esc(row["duration_human"] or ""), row["date"], row["place"], chs))
    lines.append("")

    def vid_table(videos):
        out = ["| Видео | Длительность | Минута | Связь | Проход |", "|---|---|---|---|---|"]
        for v in videos:
            tc = "▶ [%s](%s)" % (esc(v["timecode"]), esc(v["watch_url_at_minute"])) if v["timecode_seconds"] is not None else "—"
            out.append("| [%s](%s) | %s | %s | %s | %s |" % (
                esc(v["title"]), esc(v["watch_url"]), esc(v["duration_human"] or "—"),
                tc, esc(v["relation_ru"]), esc(v["pass_ru"])))
        return out

    for i, ch in enumerate(guide["chapters"], 1):
        c = ch["counts"]
        lines.append("## %d. %s (стр. %s)" % (i, esc(ch["name"]), esc(ch["pages"])))
        lines.append("")
        lines.append(ch["intro"])
        lines.append("")
        if ch["start_here"]:
            lines.append("**С чего начать:**")
            lines.append("")
            for v in ch["start_here"]:
                tc = " — с минуты %s" % esc(v["timecode"]) if v["timecode_seconds"] is not None else ""
                lines.append("- [%s](%s)%s" % (esc(v["title"]), esc(v["watch_url_at_minute"]), tc))
            lines.append("")
        lines.append("### Утверждено куратором (%d)" % c["approved_videos"])
        lines.append("")
        if ch["approved"]:
            lines.extend(vid_table(ch["approved"]))
        else:
            lines.append("Пустая клетка: ни одна связь не утверждена.")
        lines.append("")
        if ch["auto"]:
            lines.append("### Машинные кандидаты — куратором не утверждены (%d)" % len(ch["auto"]))
            lines.append("")
            lines.extend(vid_table(ch["auto"]))
            lines.append("")
        if ch["llsh_neighbors"]:
            for nb in ch["llsh_neighbors"]:
                lines.append("Соседняя публичная серия: доклад ЛЛШ %d года «%s»." % (nb["year"], esc(nb["title"])))
            lines.append("")

    lines.append("## Методика и воспроизводимость")
    lines.append("")
    lines.append("Всё ниже — производные данные, не рукопись. Редактируется только проза в "
                 "[reader_guide_prose.json](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/reader_guide_prose.json); "
                 "остальное перегенерируется:")
    lines.append("")
    lines.append("```")
    lines.append("python3 scripts/crosswalk/build_reader_guide.py --emit   # пересобрать json + страницу + этот документ")
    lines.append("python3 scripts/crosswalk/build_reader_guide.py --check  # байт-в-байт паритет выходов с данными")
    lines.append("```")
    lines.append("")
    lines.append("Источники: [22-crosswalk.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/22-crosswalk.json) "
                 "(377 рёбер, статусы после гейта v4: `approved` 142 · `rejected` 106 · `auto` 129 · `disputed` 0) · "
                 "[video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json) "
                 "(176 записей, 214,13 ч) · [gate_decisions_v4.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/gate_decisions_v4.json). "
                 "Генератор при каждом запуске сверяет счётчик утверждённых видео по главам с камера-реди полосы 4 и "
                 "проверяет, что каждый пункт «с чего начать» — утверждённая связь.")
    lines.append("")
    lines.append("_Dr. Mārcis Gasūns_")
    lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--emit", action="store_true", help="write outputs")
    g.add_argument("--check", action="store_true", help="verify byte-exact parity")
    args = ap.parse_args()

    guide = build()
    if guide.get("_problems"):
        for p in guide["_problems"]:
            print("PARITY FAIL: %s" % p, file=sys.stderr)
        sys.exit(1)

    doc = render_doc(guide)
    page = render_html(guide)
    blob = json.dumps(guide, ensure_ascii=False, indent=2, sort_keys=False) + "\n"

    targets = [
        (OUT_JSON, blob),
        (OUT_HTML, page),
        (OUT_DOC, doc),
    ]
    if args.check:
        bad = []
        for path, content in targets:
            if not path.exists():
                bad.append("%s missing" % path.relative_to(ROOT))
            elif path.read_text(encoding="utf-8") != content:
                bad.append("%s drifts from data" % path.relative_to(ROOT))
        if bad:
            for b in bad:
                print("CHECK FAIL: %s" % b, file=sys.stderr)
            print("fix: python3 scripts/crosswalk/build_reader_guide.py --emit", file=sys.stderr)
            sys.exit(1)
        print("reader guide parity OK: %d chapters, %d approved videos, %d auto edges"
              % (len(guide["chapters"]), guide["totals"]["approved_videos"], guide["totals"]["auto_edges"]))
        return
    for path, content in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print("wrote %s" % path.relative_to(ROOT))
    print("reader guide built: %d chapters, %d approved videos, %d auto edges"
          % (len(guide["chapters"]), guide["totals"]["approved_videos"], guide["totals"]["auto_edges"]))


if __name__ == "__main__":
    main()
