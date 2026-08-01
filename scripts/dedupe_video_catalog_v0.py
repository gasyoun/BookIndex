#!/usr/bin/env python3
"""H2122 V0: collapse video_catalog to unique ids (D8 survivor policy).

Survivor = row with richest related_entities; first wins on ties
(matches getDedupedVideoCatalog in v3_app.js). Does not invent URLs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def configure_output_encoding() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def re_len(row: dict[str, Any]) -> int:
    rel = row.get("related_entities")
    return len(rel) if isinstance(rel, list) else 0


def dedupe_catalog(catalog: list[Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (survivors in original order of first keep, dropped records)."""
    survivors: list[dict[str, Any]] = []
    index_by_key: dict[str, int] = {}
    meta: dict[str, dict[str, Any]] = {}
    dropped: list[dict[str, Any]] = []

    for i, raw in enumerate(catalog):
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("id") or raw.get("url") or "").strip()
        if not key:
            survivors.append(raw)
            continue
        score = re_len(raw)
        if key not in index_by_key:
            index_by_key[key] = len(survivors)
            meta[key] = {"idx": i, "re": score, "title": raw.get("title")}
            survivors.append(raw)
            continue
        prev = meta[key]
        if score > prev["re"]:
            dropped.append(
                {
                    "id": key,
                    "title": prev["title"],
                    "source_index": prev["idx"],
                    "related_entities_count": prev["re"],
                    "reason": "replaced_by_richer_related_entities",
                    "survivor_title": raw.get("title"),
                    "survivor_index": i,
                }
            )
            survivors[index_by_key[key]] = raw
            meta[key] = {"idx": i, "re": score, "title": raw.get("title")}
        else:
            dropped.append(
                {
                    "id": key,
                    "title": raw.get("title"),
                    "source_index": i,
                    "related_entities_count": score,
                    "reason": "duplicate_id_survivor_kept",
                    "survivor_title": prev["title"],
                    "survivor_index": prev["idx"],
                }
            )
    return survivors, dropped


def main() -> int:
    configure_output_encoding()
    root = Path(__file__).resolve().parents[1]
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "app_data.json"
    dry_run = "--dry-run" in sys.argv

    data = json.loads(path.read_text(encoding="utf-8"))
    catalog = data.get("video_catalog")
    if not isinstance(catalog, list):
        print("ERROR: video_catalog missing or not a list")
        return 2

    survivors, dropped = dedupe_catalog(catalog)
    report = {
        "raw": len(catalog),
        "unique": len(survivors),
        "dropped_count": len(dropped),
        "dropped": dropped,
        "policy": "richest related_entities; first wins on ties (getDedupedVideoCatalog)",
        "handoff": "H2122",
    }
    report_path = root / "docs" / "history" / "H2122_video_catalog_collision_census.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    if not dry_run:
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        data["video_catalog"] = survivors
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"raw={report['raw']} unique={report['unique']} dropped={report['dropped_count']}")
    for item in dropped:
        print(
            f"  DROP id={item['id']} title={item['title']!r} "
            f"survivor={item.get('survivor_title')!r}"
        )
    if dry_run:
        print("dry-run: no files written")
    else:
        print(f"wrote {path}")
        print(f"wrote {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
