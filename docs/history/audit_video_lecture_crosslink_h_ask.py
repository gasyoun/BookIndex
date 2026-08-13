#!/usr/bin/env python3
"""Ad-hoc audit for the /ask interview on the print 8pp signature (video<->lecture crosslink).

Read-only. Measures what the repo already knows about:
  - the 11 chapters / 10 lectures of «Из жизни слов и языков»
  - the 176-video catalogue: topics, purpose, transcript status, durations
  - ЛЛШ (samskrtam.ru/llsh) tagging inside the catalogue
  - any existing lecture<->video mapping artefacts

Run from the BookIndex repo root:  python docs/history/audit_video_lecture_crosslink_h_ask.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]


def load(rel: str):
    p = ROOT / rel
    if not p.exists():
        print(f"MISSING {rel}")
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    print("=" * 72)
    print("1. CHAPTERS / LECTURES  (data/modules/20-lectures.json)")
    print("=" * 72)
    lec = load("data/modules/20-lectures.json")
    if lec:
        for key in lec:
            val = lec[key]
            print(f"  {key}: {type(val).__name__} n={len(val) if hasattr(val, '__len__') else '-'}")
        print()
        for i, ch in enumerate(lec.get("chapters", []), 1):
            print(f"  ch{i:02d}  pp.{ch.get('start')}-{ch.get('end')}  {ch.get('name')}")
        print()
        for i, l in enumerate(lec.get("lectures", []), 1):
            print(f"  L{i:02d}  {l.get('pages'):>9}  {l.get('name')}")
        summaries = lec.get("lecture_summaries")
        if summaries:
            print(f"\n  lecture_summaries: n={len(summaries)} type={type(summaries).__name__}")
            sample = summaries[0] if isinstance(summaries, list) else next(iter(summaries.items()))
            print(f"  sample: {json.dumps(sample, ensure_ascii=False)[:400]}")

    print()
    print("=" * 72)
    print("2. VIDEO CATALOGUE  (data/video_catalog_public.v2.json)")
    print("=" * 72)
    cat = load("data/video_catalog_public.v2.json")
    if cat:
        vids = cat["videos"]
        print(f"  stats: {json.dumps(cat.get('stats', {}), ensure_ascii=False)}")
        print(f"  videos: {len(vids)}")
        total_sec = sum(v.get("duration_seconds") or 0 for v in vids)
        print(f"  total duration: {total_sec/3600:.1f} h  (missing duration: "
              f"{sum(1 for v in vids if not v.get('duration_seconds'))})")

        print("\n  topics:")
        topics = Counter(t for v in vids for t in (v.get("topics") or []))
        for t, n in topics.most_common(30):
            print(f"    {n:>4}  {t}")
        print(f"  videos with NO topic: {sum(1 for v in vids if not v.get('topics'))}")

        print("\n  purpose:")
        for p, n in Counter(str(v.get("purpose")) for v in vids).most_common(20):
            print(f"    {n:>4}  {p}")

        print("\n  type:")
        for p, n in Counter(str(v.get("type")) for v in vids).most_common(20):
            print(f"    {n:>4}  {p}")

        print("\n  transcript_status:")
        for p, n in Counter(str(v.get("transcript_status")) for v in vids).most_common(20):
            print(f"    {n:>4}  {p}")

        print("\n  related_entities type distribution (all videos):")
        ents = Counter(e.get("type") for v in vids for e in (v.get("related_entities") or []))
        for t, n in ents.most_common(20):
            print(f"    {n:>6}  {t}")
        with_t = sum(1 for v in vids for e in (v.get("related_entities") or []) if e.get("t") is not None)
        print(f"  entity links carrying a timecode `t`: {with_t}")

        print("\n  do videos carry a chapter/lecture link field?")
        allkeys = Counter(k for v in vids for k in v.keys())
        for k, n in allkeys.most_common():
            print(f"    {n:>4}  {k}")

        print("\n  ЛЛШ-tagged videos (first 40 titles):")
        llsh = [v for v in vids if "ЛЛШ" in (v.get("topics") or [])]
        print(f"  n(ЛЛШ) = {len(llsh)}")
        for v in llsh[:40]:
            mins = (v.get("duration_seconds") or 0) // 60
            print(f"    {v['accession']}  {mins:>4}m  {v.get('title_display')}")

    print()
    print("=" * 72)
    print("3. OTHER CATALOGUE FILES")
    print("=" * 72)
    for rel in ("data/video_pipeline.json", "data/modules/99-extra.json",
                "data/video_catalog_editorial.json"):
        d = load(rel)
        if d is None:
            continue
        if isinstance(d, dict):
            print(f"  {rel}: keys={list(d.keys())[:12]}")
            for k, v in d.items():
                if isinstance(v, list):
                    print(f"      {k}: n={len(v)}"
                          f"  sample_keys={list(v[0].keys())[:12] if v and isinstance(v[0], dict) else ''}")
        else:
            print(f"  {rel}: list n={len(d)}")

    print()
    print("=" * 72)
    print("4. KWIC")
    print("=" * 72)
    kwic = load("data/lectures_kwic.json")
    if kwic:
        if isinstance(kwic, dict):
            print(f"  keys={list(kwic.keys())[:12]}")
            for k, v in kwic.items():
                if isinstance(v, list):
                    print(f"    {k}: n={len(v)}  sample="
                          f"{json.dumps(v[0], ensure_ascii=False)[:300] if v else ''}")
        else:
            print(f"  list n={len(kwic)}  sample={json.dumps(kwic[0], ensure_ascii=False)[:300]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
