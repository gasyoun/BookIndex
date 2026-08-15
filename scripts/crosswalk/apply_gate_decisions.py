"""Применение решений куратор-гейта к кресту «видео ↔ главы».

    python scripts/crosswalk/apply_gate_decisions.py <path-to-decisions.json> [--dry]

Читает экспорт листа (sheet_id `bookindex-crosswalk-video-chapter*`), применяет
к `data/modules/22-crosswalk.json`:

* ребро approve → status `approved`; reject → `rejected`; defer/null — не трогаем;
* заметка куратора → `curator_note` ребра (аудит-след, на полосу не идёт);
* пара дублей approve → status `approved` + `duplicate_of` (бо́льший accession
  указывает на меньший) в `data/video_catalog_public.v2.json`; reject →
  `rejected`; запись НЕ удаляется;
* телеметрия времени (V11, csl-pyutil 0.10.0) → `data/crosswalk/gate_vote_telemetry.json`.

После применения пересчитывает счётчики статусов в `stats` и напоминает про
`npm run data:assemble` (22-crosswalk.json — модуль app_data.json).

Печатный разворот (H2707) читает ТОЛЬКО рёбра со `status: approved`.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2841.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CATALOG, CW, MODULES, dump_canonical, dump_json, load_json  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

CROSSWALK = MODULES / "22-crosswalk.json"
TELEMETRY = CW / "gate_vote_telemetry.json"
SHEET_PREFIX = "bookindex-crosswalk-video-chapter"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("decisions", type=Path)
    ap.add_argument("--dry", action="store_true", help="показать, ничего не писать")
    args = ap.parse_args()

    dec = load_json(args.decisions)
    if not str(dec.get("sheet_id", "")).startswith(SHEET_PREFIX):
        print(f"ОТКАЗ: sheet_id {dec.get('sheet_id')!r} не {SHEET_PREFIX}*")
        return 2

    doc = load_json(CROSSWALK)
    cw = doc["crosswalk"]
    edges = {e["edge_id"]: e for e in cw["edges"]}
    dups = {f'dup-{a}-{b}': d for d in cw["duplicates"] for a, b in [d["pair"]]}

    cat_doc = load_json(CATALOG)
    cat = {v["accession"]: v for v in cat_doc["videos"]}

    applied = Counter()
    telem_items = []
    for item in dec["items"]:
        d, note = item.get("decision"), (item.get("note") or "").strip()
        if item.get("time_seconds"):
            telem_items.append({"id": item["id"], "decision": d,
                                "time_seconds": item["time_seconds"]})
        if d not in ("approve", "reject"):
            if d == "defer":
                applied["defer (не тронуто)"] += 1
            continue
        eid = item["id"]
        if eid in edges:
            edges[eid]["status"] = "approved" if d == "approve" else "rejected"
            if note:
                edges[eid]["curator_note"] = note
            applied[f"ребро {d}"] += 1
        elif eid in dups:
            dup = dups[eid]
            dup["status"] = "approved" if d == "approve" else "rejected"
            if note:
                dup["curator_note"] = note
            if d == "approve":
                a, b = sorted(dup["pair"])          # бо́льший указывает на меньший
                if b in cat:
                    cat[b]["duplicate_of"] = a
            applied[f"дубль {d}"] += 1
        else:
            applied["НЕИЗВЕСТНЫЙ id (пропущен)"] += 1
            print(f"⚠ id {eid} не найден ни среди рёбер, ни среди дублей")

    st = Counter(e["status"] for e in cw["edges"])
    cw["stats"]["auto"] = st.get("auto", 0)
    cw["stats"]["disputed"] = st.get("disputed", 0)
    cw["stats"]["approved"] = st.get("approved", 0)
    cw["stats"]["rejected"] = st.get("rejected", 0)

    for k, v in sorted(applied.items()):
        print(f"{k}: {v}")
    print("статусы рёбер:", dict(st))

    if args.dry:
        print("--dry: ничего не записано")
        return 0

    dump_canonical(CROSSWALK, doc)      # модуль app_data.json — формат сверяет CI
    dump_canonical(CATALOG, cat_doc)
    telem = load_json(TELEMETRY) if TELEMETRY.is_file() else {"votes": []}
    telem["votes"].append({
        "sheet_id": dec.get("sheet_id"),
        "generated": dec.get("generated"),
        "decided": dec.get("decided"),
        "time_total_seconds": dec.get("time_total_seconds"),
        "items": telem_items,
    })
    dump_json(TELEMETRY, telem)
    print(f"записано: {CROSSWALK.name}, {CATALOG.name}, {TELEMETRY.name}")
    print("не забыть: npm run data:assemble (22-crosswalk.json — модуль app_data.json)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
