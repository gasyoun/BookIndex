#!/usr/bin/env python3
"""Utilities for splitting and assembling BookIndex app_data.json modules."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

MODULE_LAYOUT: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "00-metadata.json",
        (
            "schema_version",
            "schema_migrations",
            "corpus",
            "labels",
            "colors",
            "epoch_labels",
            "epoch_colors",
            "family_colors",
            "book_stats",
            "non_content_pages",
        ),
    ),
    ("10-names.json", ("names", "edges")),
    ("11-toponyms.json", ("toponyms",)),
    ("12-ethnonyms.json", ("ethnonyms",)),
    ("13-languages.json", ("languages", "language_edges", "language_tree")),
    ("14-lexicon.json", ("lexicon", "lexicon_tech", "lexicon_reverse", "subject_index", "cross_links")),
    ("20-lectures.json", ("chapters", "lectures", "lecture_summaries", "routes", "tasks")),
    ("21-materials.json", ("glossary", "quotes", "russian_evolution", "phonetic_laws", "featured_quote", "further_reading")),
    ("30-scholar.json", ("scholar",)),
)
EXTRA_MODULE_FILENAME = "99-extra.json"
MANIFEST_FILENAME = "manifest.json"


def read_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"JSON root must be object: {path}")
    return data


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def split_into_modules(data: dict[str, Any], out_dir: Path) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    assigned: set[str] = set()
    manifest_modules: list[dict[str, Any]] = []

    for filename, keys in MODULE_LAYOUT:
        payload: dict[str, Any] = {}
        for key in keys:
            if key in data:
                payload[key] = data[key]
                assigned.add(key)
        if not payload:
            continue
        write_json(out_dir / filename, payload)
        manifest_modules.append({"file": filename, "keys": list(payload.keys())})

    leftovers = {k: v for k, v in data.items() if k not in assigned}
    if leftovers:
        write_json(out_dir / EXTRA_MODULE_FILENAME, leftovers)
        manifest_modules.append({"file": EXTRA_MODULE_FILENAME, "keys": list(leftovers.keys())})

    manifest = {
        "version": 1,
        "module_layout": [name for name, _ in MODULE_LAYOUT],
        "modules": manifest_modules,
        "key_order": list(data.keys()),
    }
    write_json(out_dir / MANIFEST_FILENAME, manifest)
    return manifest


def _iter_module_files(modules_dir: Path) -> tuple[list[Path], list[str]]:
    manifest_path = modules_dir / MANIFEST_FILENAME
    if manifest_path.exists():
        manifest = read_json(manifest_path)
        modules = manifest.get("modules", [])
        key_order = manifest.get("key_order", [])
        ordered_keys = [str(k) for k in key_order if isinstance(k, str)]
        if isinstance(modules, list):
            ordered: list[Path] = []
            for item in modules:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("file", "")).strip()
                if not name or name == MANIFEST_FILENAME:
                    continue
                p = modules_dir / name
                if p.exists():
                    ordered.append(p)
            if ordered:
                return ordered, ordered_keys
    files = sorted(
        p for p in modules_dir.glob("*.json")
        if p.name != MANIFEST_FILENAME
    )
    return files, []


def assemble_from_modules(modules_dir: Path) -> dict[str, Any]:
    if not modules_dir.exists():
        raise FileNotFoundError(f"Modules directory not found: {modules_dir}")

    merged: dict[str, Any] = {}
    duplicates: list[str] = []
    files, key_order = _iter_module_files(modules_dir)
    for module_path in files:
        payload = read_json(module_path)
        for key, value in payload.items():
            if key in merged:
                duplicates.append(key)
                continue
            merged[key] = value
    if duplicates:
        dup = ", ".join(sorted(set(duplicates)))
        raise ValueError(f"Duplicate top-level keys in modules: {dup}")
    if not key_order:
        return merged

    ordered: dict[str, Any] = {}
    for key in key_order:
        if key in merged:
            ordered[key] = merged[key]
    for key, value in merged.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def canonical_json_text(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"
