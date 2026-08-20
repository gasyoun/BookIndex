#!/usr/bin/env python3
"""Recount catalog stats + approved-only edges for print spreads 4–5 (H3135)."""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def hms(seconds):
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def main():
    cw = load("data/modules/22-crosswalk.json")["crosswalk"]
    catalog = load("data/video_catalog_public.v2.json")
    pipeline = load("data/video_pipeline.json")

    videos = {v["accession"]: v for v in catalog["videos"]}
    n_videos = len(videos)
    unique_yt = len({v.get("youtube_id") for v in videos.values() if v.get("youtube_id")})
    total_sec = sum(int(v.get("duration_seconds") or 0) for v in videos.values())
    with_tc_catalog = sum(1 for v in videos.values() if v.get("duration_seconds"))
    topics = Counter()
    for v in videos.values():
        t = v.get("topics") or []
        if t:
            for topic in t:
                topics[topic] += 1
        else:
            topics["(без темы)"] += 1
    types = Counter((v.get("type") or "(без типа)") for v in videos.values())
    dupes = [v["accession"] for v in videos.values() if v.get("duplicate_of")]
    llsh = sorted(
        (v for v in videos.values() if "ЛЛШ" in (v.get("topics") or [])),
        key=lambda v: v["accession"],
    )
    llsh_by_acc = {v["accession"]: v for v in llsh}

    by_stage = Counter()
    by_quality = Counter()
    n_pipeline = 0
    n_in_catalog = 0
    edited_stages = {"read1", "read2", "read3", "prelayout", "layout", "done"}
    n_edited = 0
    n_transcribed = 0
    for pv in pipeline.get("videos") or []:
        n_pipeline += 1
        if pv.get("in_catalog"):
            n_in_catalog += 1
        stage = pv.get("stage") or "unknown"
        by_stage[stage] += 1
        q = (pv.get("transcription") or {}).get("quality") or "unknown"
        by_quality[q] += 1
        if stage in edited_stages:
            n_edited += 1
        if stage not in {"queued", None, "unknown"}:
            n_transcribed += 1

    chapters = {c["id"]: c for c in cw["chapters"]}
    approved = [e for e in cw["edges"] if e.get("status") == "approved"]
    auto = [e for e in cw["edges"] if e.get("status") == "auto"]
    rejected = [e for e in cw["edges"] if e.get("status") == "rejected"]
    print_kwic_auto = [
        e
        for e in auto
        if e.get("pass") == "kwic" and float(e.get("confidence") or 0) >= 0.85
    ]
    series_auto = [e for e in auto if e.get("pass") == "series"]

    per_ch = defaultdict(list)
    for e in approved:
        per_ch[e["chapter"]].append(e)

    per_rel = Counter(e.get("relation") for e in approved)
    per_pass = Counter(e.get("pass") for e in approved)
    accs = {e["accession"] for e in approved}
    with_tc = sum(1 for e in approved if e.get("timecode"))

    print("=== ARCHIVE 20-08-2026 ===")
    print(f"catalog videos: {n_videos}")
    print(f"unique youtube: {unique_yt}")
    print(f"duration_seconds: {total_sec} = {total_sec/3600:.2f} h ({hms(total_sec)})")
    print(f"pipeline videos: {n_pipeline}; in_catalog: {n_in_catalog}")
    print(f"pipeline stats.total_hours: {pipeline.get('stats', {}).get('total_hours')}")
    print(f"pipeline stats.videos_in_catalog: {pipeline.get('stats', {}).get('videos_in_catalog')}")
    print(f"pipeline stages: {dict(by_stage)}")
    print(f"pipeline quality: {dict(by_quality)}")
    print(f"transcribed-or-later: {n_transcribed}; edited (read1+): {n_edited}")
    print(f"topics: {dict(topics)}")
    print(f"types: {dict(types)}")
    print(f"duplicate_of: {dupes}")
    print(f"LLSH tagged: {len(llsh)}")
    for v in llsh:
        print(
            f"  acc{v['accession']} {v.get('title_display') or v.get('title_source')} "
            f"{v.get('duration_seconds')}s topics={v.get('topics')} type={v.get('type')}"
        )

    print("\n=== CROSSWALK ===")
    print(f"edges total: {len(cw['edges'])} stats={cw.get('stats')}")
    print(f"approved {len(approved)} auto {len(auto)} rejected {len(rejected)}")
    print(f"approved unique accessions: {len(accs)}")
    print(f"approved with timecode: {with_tc}")
    print(f"approved pass: {dict(per_pass)}")
    print(f"approved relation: {dict(per_rel)}")
    print(f"series auto (not print per H3135): {len(series_auto)}")
    print(f"kwic auto >=0.85 (VERIFICATION print threshold, H3135 forbids): {len(print_kwic_auto)}")

    print("\n=== APPROVED PER CHAPTER ===")
    for cid, ch in chapters.items():
        edges = per_ch.get(cid, [])
        n_acc = len({x["accession"] for x in edges})
        print(
            f"\n{cid} {ch['name']} pp.{ch['start']}–{ch['end']}  "
            f"edges={len(edges)} unique={n_acc}"
        )
        seen = []
        for e in sorted(edges, key=lambda x: (-float(x.get("confidence") or 0), x["accession"])):
            acc = e["accession"]
            if acc in seen:
                continue
            seen.append(acc)
            v = videos.get(acc, {})
            title = (v.get("title_display") or v.get("title_source") or "").strip()
            print(
                f"  acc{acc} {e.get('relation')} {e.get('pass')} "
                f"conf={e.get('confidence')} tc={e.get('timecode')} "
                f"{title[:80]}"
            )
            if len(seen) >= 6:
                extra = len({x['accession'] for x in edges}) - len(seen)
                if extra > 0:
                    print(f"  … +{extra} more unique accessions")
                break

    print("\n=== PRINT CHAR COUNTS (body under each heading, no heading line) ===")
    prose = (ROOT / "docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md").read_text(
        encoding="utf-8"
    )
    for title in ("## Полоса 4", "## Полоса 5"):
        start = prose.index(title)
        rest = prose[start + len(title) :]
        nxt = rest.find("\n## ")
        block = rest if nxt < 0 else rest[:nxt]
        lines = []
        for line in block.splitlines():
            if line.startswith("**Заголовок.**"):
                continue
            lines.append(line)
        body = "\n".join(lines).strip()
        n = len(body.replace("\n", ""))
        print(f"{title}: {n} chars (newlines stripped; target 1800–2200)")

    print("\n=== LLSH ROADMAP ACCESSIONS IN CATALOG ===")
    roadmap = [
        ("005", "2007 IX Новгородские берестяные грамоты"),
        ("007", "2008 X О Велесовой книге"),
        ("003", "2009 XI Контуры истории русского ударения"),
        ("032", "2010 XII О происхождении слов"),
        ("033", "2011 XIII Механизмы экспрессивности в языке"),
        ("006", "2012 XIV Контуры истории русского языка"),
        ("001", "2013 XV Коротко об арабском языке"),
        ("004", "2014 XVI Как изменяется внешняя сторона слова"),
        ("002", "2015 XVII Эпизод из истории русского ударения"),
        ("139", "2016 XVIII Ещё раз о жизни слов"),
        ("140", "2017 XIX Живые механизмы современного русского ударения"),
    ]
    for acc, label in roadmap:
        v = videos.get(acc)
        tagged = acc in llsh_by_acc
        print(f"  acc{acc} tagged={tagged} present={v is not None} {label}")
        if v:
            print(f"      title={v.get('title_display') or v.get('title_source')}")
            print(f"      topics={v.get('topics')} dup={v.get('duplicate_of')}")


if __name__ == "__main__":
    main()
