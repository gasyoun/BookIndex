#!/usr/bin/env python3
"""Second audit pass for the /ask interview: ЛЛШ coverage, bibliography, routes/tasks.

Read-only. Answers:
  - which of the 11 ЛЛШ (Летняя лингвистическая школа, 2007-2017) talks are in the catalogue,
    which are tagged `ЛЛШ`, and whether any are duplicated
  - what bibliography (books/articles) the corpus already knows
  - what `routes` / `tasks` / glossary material exists to hang print pages on
  - the full 176-title inventory grouped by topic, for the lecture->video crosswalk

Run from the BookIndex repo root:
    python docs/history/audit_llsh_and_bibliography_h_ask.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]

# The 11 ЛЛШ talks as published on https://samskrtam.ru/llsh (mathnet.ru presentids).
LLSH = [
    (2007, "IX", "Новгородские берестяные грамоты", "Дубна, Ратмино"),
    (2008, "X", "О Велесовой книге", "Дубна"),
    (2009, "XI", "Контуры истории русского ударения", "Дубна"),
    (2010, "XII", "О происхождении слов", "Дубна"),
    (2011, "XIII", "Механизмы экспрессивности в языке", "Дубна"),
    (2012, "XIV", "Контуры истории русского языка", "Дубна"),
    (2013, "XV", "Коротко об арабском языке", "Дубна"),
    (2014, "XVI", "Как изменяется внешняя сторона слова", "Дубна"),
    (2015, "XVII", "Эпизод из истории русского ударения", "Дубна"),
    (2016, "XVIII", "Ещё раз о жизни слов", "Вороново"),
    (2017, "XIX", "Живые механизмы современного русского ударения", "Вороново"),
]


def load(rel: str):
    p = ROOT / rel
    if not p.exists():
        print(f"MISSING {rel}")
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def norm(s: str) -> str:
    s = (s or "").lower().replace("ё", "е")
    return re.sub(r"[^а-яa-z0-9]+", " ", s).strip()


def main() -> int:
    cat = load("data/video_catalog_public.v2.json")
    vids = cat["videos"]

    print("=" * 78)
    print("1. ЛЛШ COVERAGE — 11 published talks vs the 176-video catalogue")
    print("=" * 78)
    for year, roman, title, venue in LLSH:
        key = norm(title)
        hits = []
        for v in vids:
            t = norm(v.get("title_display"))
            # match on a distinctive head of the title
            if key in t or t in key or (len(key.split()) > 2 and " ".join(key.split()[:3]) in t):
                hits.append(v)
        tags = [("ЛЛШ" in (h.get("topics") or [])) for h in hits]
        status = "OK" if (len(hits) == 1 and all(tags)) else ("DUP" if len(hits) > 1 else "MISS")
        print(f"\n  {year} {roman:>4}  {title}   [{venue}]  -> {status}")
        for h in hits:
            mins = (h.get("duration_seconds") or 0) // 60
            print(f"      acc {h['accession']}  {mins:>4}m  ЛЛШ={'yes' if 'ЛЛШ' in (h.get('topics') or []) else 'NO '}"
                  f"  purpose={h.get('purpose')}  type={h.get('type')}")
            print(f"          {h.get('title_display')}")
            print(f"          {h.get('watch_url')}")

    print()
    print("  --- videos tagged ЛЛШ but not matched above ---")
    matched = set()
    for _, _, title, _ in LLSH:
        key = norm(title)
        for v in vids:
            t = norm(v.get("title_display"))
            if key in t or t in key or (len(key.split()) > 2 and " ".join(key.split()[:3]) in t):
                matched.add(v["accession"])
    for v in vids:
        if "ЛЛШ" in (v.get("topics") or []) and v["accession"] not in matched:
            print(f"    acc {v['accession']}  {v.get('title_display')}")

    print()
    print("=" * 78)
    print("2. DATA DEFECTS worth naming in the plan")
    print("=" * 78)
    for v in vids:
        t = str(v.get("type") or "")
        if t.startswith("http") or "?" in t:
            print(f"  acc {v['accession']}: `type` field holds a research note, not a type:")
            print(f"      type={t!r}")
            print(f"      title={v.get('title_display')}")
    dur = Counter()
    for v in vids:
        dur[v.get("duration_seconds")] += 1
    print("\n  identical durations (possible duplicate recordings):")
    for d, n in dur.most_common():
        if n > 1 and d:
            same = [v for v in vids if v.get("duration_seconds") == d]
            print(f"    {d}s x{n}: " + " | ".join(f"acc{v['accession']} {v.get('title_display')[:52]}" for v in same))

    print()
    print("=" * 78)
    print("3. BIBLIOGRAPHY / METADATA the corpus already holds")
    print("=" * 78)
    meta = load("data/modules/00-metadata.json")
    print(json.dumps(meta, ensure_ascii=False, indent=1)[:4000])

    print()
    print("=" * 78)
    print("4. ROUTES / TASKS / GLOSSARY (print-page raw material)")
    print("=" * 78)
    lec = load("data/modules/20-lectures.json")
    print("  routes:")
    for r in lec.get("routes", []):
        print(f"    {json.dumps(r, ensure_ascii=False)[:300]}")
    print("  tasks:")
    for t in lec.get("tasks", []):
        print(f"    {json.dumps(t, ensure_ascii=False)[:300]}")
    mat = load("data/modules/21-materials.json")
    if isinstance(mat, dict):
        for k, v in mat.items():
            print(f"  21-materials.{k}: n={len(v) if hasattr(v, '__len__') else '-'}")
            if isinstance(v, list) and v:
                print(f"      sample={json.dumps(v[0], ensure_ascii=False)[:400]}")

    print()
    print("=" * 78)
    print("5. FULL 176-VIDEO INVENTORY, grouped by topic (crosswalk raw material)")
    print("=" * 78)
    by_topic: dict[str, list] = defaultdict(list)
    for v in vids:
        tops = v.get("topics") or ["(без темы)"]
        for t in tops:
            by_topic[t].append(v)
    for t in sorted(by_topic, key=lambda x: -len(by_topic[x])):
        group = by_topic[t]
        hrs = sum(v.get("duration_seconds") or 0 for v in group) / 3600
        print(f"\n  ### {t}  (n={len(group)}, {hrs:.1f} h)")
        for v in sorted(group, key=lambda v: v["accession"]):
            mins = (v.get("duration_seconds") or 0) // 60
            print(f"    {v['accession']}  {mins:>4}m  {v.get('type') or '-':<10}  {v.get('title_display')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
