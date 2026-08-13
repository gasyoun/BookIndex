#!/usr/bin/env python3
"""Third audit pass: can a video->lecture crosswalk be DERIVED from data already in the repo?

The catalogue has no chapter/lecture field, but every video carries `related_entities`
(names / toponyms / ethnonyms / languages / lexicon / subject_index). If those entity heads
resolve to page numbers in the book modules, then:

    video -> related_entity -> page(s) -> chapter (pp. range) -> lecture

is derivable without inventing anything. This measures whether that path actually closes,
and how strong it is per video.

Run from the BookIndex repo root:
    python docs/history/audit_crosswalk_derivability_h_ask.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]

MODULES = {
    "names": "data/modules/10-names.json",
    "toponyms": "data/modules/11-toponyms.json",
    "ethnonyms": "data/modules/12-ethnonyms.json",
    "languages": "data/modules/13-languages.json",
    "lexicon": "data/modules/14-lexicon.json",
    "subject_index": "data/modules/15-subject_index.json",
}


def load(rel: str):
    p = ROOT / rel
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def main() -> int:
    lec = load("data/modules/20-lectures.json")
    chapters = lec["chapters"]

    def chapter_of(page: int):
        for ch in chapters:
            if ch["start"] <= page <= ch["end"]:
                return ch["name"]
        return None

    print("=" * 78)
    print("0. WHAT MODULE FILES EXIST")
    print("=" * 78)
    for p in sorted((ROOT / "data" / "modules").glob("*.json")):
        print(f"  {p.name:<28} {p.stat().st_size/1024:>9.1f} KB")

    # Build head -> pages index across every module we can read.
    print()
    print("=" * 78)
    print("1. HEAD -> PAGES INDEX (per module)")
    print("=" * 78)
    head_pages: dict[tuple[str, str], list[int]] = {}
    for mod, rel in MODULES.items():
        d = load(rel)
        if d is None:
            print(f"  {mod:<15} MISSING {rel}")
            continue
        entries = d if isinstance(d, list) else (
            d.get("entries") or d.get(mod) or d.get("items") or [])
        if isinstance(d, dict) and not entries:
            print(f"  {mod:<15} dict keys={list(d.keys())[:10]}")
            for k, v in d.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    entries = v
                    print(f"      using key {k!r} n={len(v)}")
                    break
        n_with_pages = 0
        for e in entries or []:
            if not isinstance(e, dict):
                continue
            head = e.get("head") or e.get("term") or e.get("name")
            pages = e.get("pages") or e.get("page") or e.get("refs") or []
            if isinstance(pages, (int, str)):
                pages = [pages]
            nums = []
            for pg in pages:
                if isinstance(pg, int):
                    nums.append(pg)
                elif isinstance(pg, dict):
                    v = pg.get("page") or pg.get("p")
                    if isinstance(v, int):
                        nums.append(v)
                elif isinstance(pg, str) and pg.strip().isdigit():
                    nums.append(int(pg.strip()))
            if head and nums:
                head_pages[(mod, head)] = nums
                n_with_pages += 1
        print(f"  {mod:<15} entries={len(entries or []):>5}  with page numbers={n_with_pages:>5}"
              f"  sample_keys={list(entries[0].keys())[:10] if entries else ''}")

    print(f"\n  TOTAL (module, head) pairs carrying pages: {len(head_pages)}")

    # Now walk the videos.
    print()
    print("=" * 78)
    print("2. DOES THE CROSSWALK CLOSE?  video -> entity -> page -> chapter")
    print("=" * 78)
    cat = load("data/video_catalog_public.v2.json")
    vids = cat["videos"]

    per_video: dict[str, Counter] = {}
    unresolved = Counter()
    for v in vids:
        hits: Counter = Counter()
        for e in v.get("related_entities") or []:
            key = (e.get("type"), e.get("head"))
            pages = head_pages.get(key)
            if not pages:
                unresolved[e.get("type")] += 1
                continue
            for pg in pages:
                ch = chapter_of(pg)
                if ch:
                    hits[ch] += 1
        per_video[v["accession"]] = hits

    closed = sum(1 for a, h in per_video.items() if h)
    print(f"  videos with >=1 resolvable chapter link: {closed} / {len(vids)}")
    print(f"  unresolved entity refs by type: {dict(unresolved)}")

    print("\n  chapter attention across the whole catalogue (sum of entity hits):")
    total = Counter()
    for h in per_video.values():
        total.update(h)
    for ch in chapters:
        print(f"    {total.get(ch['name'], 0):>6}  pp.{ch['start']}-{ch['end']:<4} {ch['name']}")

    print("\n  per-video TOP chapter (first 60 videos, strongest link):")
    for v in vids[:60]:
        h = per_video[v["accession"]]
        if not h:
            print(f"    {v['accession']}  (нет связей)          {v.get('title_display')[:64]}")
            continue
        top, n = h.most_common(1)[0]
        share = n / sum(h.values())
        print(f"    {v['accession']}  {top[:28]:<28} {n:>4} ({share:.0%})  {v.get('title_display')[:56]}")

    print()
    print("=" * 78)
    print("3. TIMECODE COVERAGE (99-extra video_catalog)")
    print("=" * 78)
    extra = load("data/modules/99-extra.json")
    vc = extra.get("video_catalog", [])
    with_tc = [v for v in vc if v.get("timecodes")]
    print(f"  entries: {len(vc)}   with non-empty timecodes: {len(with_tc)}")
    if with_tc:
        print(f"  sample: {json.dumps(with_tc[0], ensure_ascii=False)[:500]}")
    tc_counts = Counter(len(v.get("timecodes") or []) for v in vc)
    print(f"  distribution of timecode counts: {dict(sorted(tc_counts.items()))}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
