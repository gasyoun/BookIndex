#!/usr/bin/env python3
"""Schema migration utility for app_data.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ENTITY_KEYS = (
    "names",
    "toponyms",
    "ethnonyms",
    "languages",
    "lexicon",
    "lexicon_reverse",
    "lexicon_tech",
    "subject_index",
)
CURRENT_SCHEMA = 2


def ensure_editorial_flags(item: dict[str, Any]) -> None:
    raw = item.get("editorial_flags")
    if not isinstance(raw, dict):
        raw = {}
    head = str(item.get("head", "")).strip()
    suspect_legacy = head.startswith("?") or item.get("needs_review") is True
    flags = {
        "verified": bool(raw.get("verified") is True or item.get("verified") is True),
        "suspect": bool(raw.get("suspect") is True or suspect_legacy),
        "source_confirmed": bool(
            raw.get("source_confirmed") is True
            or item.get("source_confirmed") is True
            or bool(item.get("wiki"))
        ),
    }
    note = raw.get("note")
    if not isinstance(note, str) or not note.strip():
        note = item.get("note")
    if isinstance(note, str) and note.strip():
        flags["note"] = note.strip()
    item["editorial_flags"] = flags


def ensure_sources(item: dict[str, Any]) -> None:
    sources = item.get("sources")
    normalized: list[dict[str, str]] = []
    if isinstance(sources, list):
        for src in sources:
            if not isinstance(src, dict):
                continue
            label = str(src.get("label", "")).strip()
            url = str(src.get("url", "")).strip()
            quote = str(src.get("quote", "")).strip()
            page = str(src.get("page", "")).strip()
            if not any((label, url, quote, page)):
                continue
            normalized.append({"label": label, "url": url, "quote": quote, "page": page})
    if not normalized and item.get("wiki"):
        normalized.append({"label": "Wikipedia", "url": str(item["wiki"]), "quote": "", "page": ""})
    item["sources"] = normalized


def migrate_to_v2(data: dict[str, Any]) -> None:
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        for row in arr:
            if not isinstance(row, dict):
                continue
            ensure_editorial_flags(row)
            ensure_sources(row)
    migrations = data.get("schema_migrations")
    if not isinstance(migrations, list):
        migrations = []
    marker = "1->2: editorial_flags_and_sources"
    if marker not in migrations:
        migrations.append(marker)
    data["schema_migrations"] = migrations
    data["schema_version"] = 2


def migrate(data: dict[str, Any]) -> int:
    version = data.get("schema_version")
    if not isinstance(version, int):
        version = 1
    if version < 2:
        migrate_to_v2(data)
        version = 2
    data["schema_version"] = version
    return version


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/migrate_app_data.py <input.json> [output.json]")
        return 2
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src
    if not src.exists():
        print(f"ERROR: file not found: {src}")
        return 2
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: invalid JSON: {exc}")
        return 2
    if not isinstance(data, dict):
        print("ERROR: root JSON must be object")
        return 2

    final_version = migrate(data)
    if final_version > CURRENT_SCHEMA:
        print(
            f"WARNING: migrated file schema {final_version} is newer than script support {CURRENT_SCHEMA}"
        )
    dst.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {src} -> {dst} (schema_version={final_version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

