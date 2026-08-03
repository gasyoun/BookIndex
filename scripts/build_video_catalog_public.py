#!/usr/bin/env python3
"""Build and validate the privacy-allowlisted scholarly video catalog export."""

from __future__ import annotations

import argparse
import json
import re
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT = ROOT / "data" / "video_catalog_source_public.json"
DEFAULT_REGISTRY = ROOT / "data" / "video_accessions.json"
DEFAULT_APP_DATA = ROOT / "app_data.json"
DEFAULT_PIPELINE = ROOT / "data" / "video_pipeline.json"
DEFAULT_OUTPUT = ROOT / "data" / "video_catalog_public.json"

TRANSCRIPT_STATUSES = {
    "unknown",
    "none",
    "automatic",
    "partial",
    "checked",
    "edited",
    "published",
    "problem",
}
FORBIDDEN_KEYS = {
    "assigned",
    "assignment_date",
    "issued",
    "notes",
    "priority",
    "reviewer",
    "stage",
    "status_raw",
    "submitted",
    "volunteer",
    "disk_video",
    "video_disk_url",
}
TOP_LEVEL_KEYS = {
    "schema",
    "version",
    "built_at",
    "source",
    "stats",
    "videos",
    "unresolved_records",
    "related_resources",
}
VIDEO_KEYS = {
    "accession",
    "youtube_id",
    "watch_url",
    "title_source",
    "title_display",
    "contributors",
    "date_recorded",
    "upload_date",
    "duration_seconds",
    "topics",
    "type",
    "purpose",
    "transcript_status",
    "transcript_url",
    "public_note",
    "related_entities",
    "last_verified_at",
}
ENTITY_KEYS = {"head", "type", "t", "src"}
SOURCE_KEYS = {
    "sheet_url",
    "sheet_gid",
    "snapshot_file",
    "snapshot_at",
    "accession_registry",
    "canonical_inputs",
}
STATS_KEYS = {
    "source_rows",
    "videos",
    "unique_youtube_ids",
    "unresolved_records",
    "related_resources",
}
UNRESOLVED_KEYS = {
    "source_row",
    "reason",
    "youtube_id",
    "title_display",
    "canonical_accession",
}
RESOURCE_KEYS = {"source_row", "title_display", "url", "resource_type"}
CONTRIBUTOR_KEYS = {"name", "role"}
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
FILENAME_TITLE_RE = re.compile(
    r"(?:^|[\\/])[^\\/]+\.(?:avi|docx?|mkv|mov|mp3|mp4|pdf|srt|txt|vtt|webm)$",
    re.IGNORECASE,
)


class CatalogValidationError(ValueError):
    """Raised when the public export violates its data contract."""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def _require_keys(record: dict[str, Any], allowed: set[str], where: str) -> None:
    extra = set(record) - allowed
    if extra:
        raise CatalogValidationError(f"{where}: non-allowlisted keys: {sorted(extra)}")


def _walk_forbidden(value: Any, where: str = "root") -> None:
    if isinstance(value, dict):
        bad = set(value) & FORBIDDEN_KEYS
        if bad:
            raise CatalogValidationError(f"{where}: forbidden keys: {sorted(bad)}")
        for key, child in value.items():
            _walk_forbidden(child, f"{where}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _walk_forbidden(child, f"{where}[{index}]")


def validate_catalog(catalog: dict[str, Any]) -> None:
    """Validate identity, privacy, enums, and public field shapes."""
    _require_keys(catalog, TOP_LEVEL_KEYS, "catalog")
    _walk_forbidden(catalog)
    if catalog.get("schema") != "video_catalog_public/1" or catalog.get("version") != 1:
        raise CatalogValidationError("unsupported schema/version")
    source = catalog.get("source")
    stats = catalog.get("stats")
    unresolved = catalog.get("unresolved_records")
    resources = catalog.get("related_resources")
    if not isinstance(source, dict):
        raise CatalogValidationError("source must be an object")
    _require_keys(source, SOURCE_KEYS, "source")
    if not isinstance(stats, dict):
        raise CatalogValidationError("stats must be an object")
    _require_keys(stats, STATS_KEYS, "stats")
    if not isinstance(unresolved, list) or not isinstance(resources, list):
        raise CatalogValidationError("record collections must be lists")
    for index, record in enumerate(unresolved):
        if not isinstance(record, dict):
            raise CatalogValidationError(f"unresolved_records[{index}] must be an object")
        _require_keys(record, UNRESOLVED_KEYS, f"unresolved_records[{index}]")
    for index, record in enumerate(resources):
        if not isinstance(record, dict):
            raise CatalogValidationError(f"related_resources[{index}] must be an object")
        _require_keys(record, RESOURCE_KEYS, f"related_resources[{index}]")

    videos = catalog.get("videos")
    if not isinstance(videos, list):
        raise CatalogValidationError("videos must be a list")
    accessions: set[str] = set()
    youtube_ids: set[str] = set()
    required = {
        "accession",
        "youtube_id",
        "watch_url",
        "title_source",
        "title_display",
        "duration_seconds",
        "topics",
        "type",
        "purpose",
        "transcript_status",
        "related_entities",
        "last_verified_at",
    }
    for index, video in enumerate(videos):
        where = f"videos[{index}]"
        if not isinstance(video, dict):
            raise CatalogValidationError(f"{where}: must be an object")
        _require_keys(video, VIDEO_KEYS, where)
        missing = required - set(video)
        if missing:
            raise CatalogValidationError(f"{where}: missing keys: {sorted(missing)}")
        accession = video["accession"]
        youtube_id = video["youtube_id"]
        if not isinstance(accession, str) or not re.fullmatch(r"\d{3}", accession):
            raise CatalogValidationError(f"{where}: accession must be three digits")
        if accession in accessions:
            raise CatalogValidationError(f"{where}: duplicate accession {accession}")
        accessions.add(accession)
        if not isinstance(youtube_id, str) or not YOUTUBE_ID_RE.fullmatch(youtube_id):
            raise CatalogValidationError(f"{where}: invalid youtube_id")
        if youtube_id in youtube_ids:
            raise CatalogValidationError(f"{where}: duplicate youtube_id {youtube_id}")
        youtube_ids.add(youtube_id)
        if video["watch_url"] != f"https://www.youtube.com/watch?v={youtube_id}":
            raise CatalogValidationError(f"{where}: watch_url does not match youtube_id")
        title = video["title_display"]
        if not isinstance(title, str) or not title.strip():
            raise CatalogValidationError(f"{where}: title_display must be non-empty")
        if FILENAME_TITLE_RE.search(title.strip()):
            raise CatalogValidationError(f"{where}: filename-like title_display")
        duration = video["duration_seconds"]
        if duration is not None and (type(duration) is not int or duration <= 0):
            raise CatalogValidationError(f"{where}: invalid duration_seconds")
        if video["transcript_status"] not in TRANSCRIPT_STATUSES:
            raise CatalogValidationError(f"{where}: invalid transcript_status")
        if not isinstance(video["topics"], list) or any(
            not isinstance(topic, str) or not topic.strip() for topic in video["topics"]
        ):
            raise CatalogValidationError(f"{where}: topics must be non-empty strings")
        for optional_text in ("type", "purpose", "last_verified_at"):
            value = video[optional_text]
            if value is not None and not isinstance(value, str):
                raise CatalogValidationError(f"{where}: {optional_text} must be string or null")
        if "public_note" in video and not isinstance(video["public_note"], str):
            raise CatalogValidationError(f"{where}: public_note must be a string")
        contributors = video.get("contributors", [])
        if not isinstance(contributors, list):
            raise CatalogValidationError(f"{where}: contributors must be a list")
        for contributor_index, contributor in enumerate(contributors):
            if not isinstance(contributor, dict):
                raise CatalogValidationError(f"{where}.contributors[{contributor_index}] must be an object")
            _require_keys(
                contributor,
                CONTRIBUTOR_KEYS,
                f"{where}.contributors[{contributor_index}]",
            )
        transcript_url = video.get("transcript_url")
        if transcript_url is not None and (
            not isinstance(transcript_url, str)
            or not transcript_url.startswith(("https://", "http://"))
        ):
            raise CatalogValidationError(f"{where}: transcript_url must be public HTTP(S)")
        entities = video["related_entities"]
        if not isinstance(entities, list):
            raise CatalogValidationError(f"{where}: related_entities must be a list")
        for entity_index, entity in enumerate(entities):
            if not isinstance(entity, dict):
                raise CatalogValidationError(f"{where}.related_entities[{entity_index}]: must be an object")
            _require_keys(entity, ENTITY_KEYS, f"{where}.related_entities[{entity_index}]")

    expected = {
        "source_rows": len(videos) + len(unresolved) + len(resources),
        "videos": len(videos),
        "unique_youtube_ids": len(youtube_ids),
        "unresolved_records": len(unresolved),
        "related_resources": len(resources),
    }
    if stats != expected:
        raise CatalogValidationError(f"stats mismatch: expected {expected}, got {stats}")


def validate_registry(registry: dict[str, Any]) -> dict[str, str]:
    if registry.get("schema") != "video_accessions/1":
        raise CatalogValidationError("unsupported accession registry schema")
    entries = registry.get("accessions")
    if not isinstance(entries, list):
        raise CatalogValidationError("registry accessions must be a list")
    mapping: dict[str, str] = {}
    seen_accessions: set[str] = set()
    for entry in entries:
        if set(entry) != {"accession", "youtube_id"}:
            raise CatalogValidationError("registry entry keys must be accession + youtube_id")
        accession, youtube_id = entry["accession"], entry["youtube_id"]
        if not isinstance(accession, str) or not re.fullmatch(r"\d{3}", accession):
            raise CatalogValidationError("registry accession must be three digits")
        if not isinstance(youtube_id, str) or not YOUTUBE_ID_RE.fullmatch(youtube_id):
            raise CatalogValidationError("registry youtube_id is invalid")
        if accession in seen_accessions or youtube_id in mapping:
            raise CatalogValidationError("duplicate accession or youtube_id in registry")
        seen_accessions.add(accession)
        mapping[youtube_id] = accession
    if sorted(seen_accessions) != [f"{number:03d}" for number in range(1, len(entries) + 1)]:
        raise CatalogValidationError("registry accessions must be contiguous from 001")
    return mapping


def transcript_status(pipeline_video: dict[str, Any]) -> str:
    quality = pipeline_video.get("transcription", {}).get("quality")
    return {
        "ok": "automatic",
        "partial": "partial",
        "no_audio": "none",
        "unknown": "unknown",
    }.get(quality, "unknown")


def build_catalog(
    snapshot: dict[str, Any],
    registry: dict[str, Any],
    app_data: dict[str, Any],
    pipeline: dict[str, Any],
) -> dict[str, Any]:
    """Build export from a public-safe sheet snapshot and canonical BookIndex data."""
    if snapshot.get("schema") != "video_catalog_source_snapshot/1":
        raise CatalogValidationError("unsupported source snapshot schema")
    _require_keys(
        snapshot,
        {
            "schema",
            "source_url",
            "sheet_gid",
            "snapshot_at",
            "census",
            "title_reconciliation",
            "duplicate_records",
            "related_resources",
        },
        "source snapshot",
    )
    duplicate_rows = snapshot.get("duplicate_records")
    resource_rows = snapshot.get("related_resources")
    if not isinstance(duplicate_rows, list) or not isinstance(resource_rows, list):
        raise CatalogValidationError("snapshot duplicate/resource records must be lists")
    for index, record in enumerate(duplicate_rows):
        _require_keys(
            record,
            {"source_row", "youtube_id", "title_display"},
            f"duplicate_records[{index}]",
        )
    for index, record in enumerate(resource_rows):
        _require_keys(
            record,
            {"source_row", "title_display", "url", "resource_type"},
            f"related_resources[{index}]",
        )
    accession_by_id = validate_registry(registry)
    app_by_id = {video["id"]: video for video in app_data.get("video_catalog", [])}
    pipeline_by_id = {
        video["id"]: video
        for video in pipeline.get("videos", [])
        if isinstance(video.get("id"), str)
    }

    videos: list[dict[str, Any]] = []
    for youtube_id, accession in accession_by_id.items():
        if youtube_id not in app_by_id or youtube_id not in pipeline_by_id:
            raise CatalogValidationError(f"youtube_id {youtube_id} missing from canonical BookIndex data")
        app_video = app_by_id[youtube_id]
        pipeline_video = pipeline_by_id[youtube_id]
        topic = pipeline_video.get("theme")
        video = {
            "accession": accession,
            "youtube_id": youtube_id,
            "watch_url": f"https://www.youtube.com/watch?v={youtube_id}",
            "title_source": app_video["title"],
            "title_display": app_video["title"],
            "duration_seconds": pipeline_video.get("duration_sec"),
            "topics": [topic] if topic else [],
            "type": pipeline_video.get("type"),
            "purpose": pipeline_video.get("purpose"),
            "transcript_status": transcript_status(pipeline_video),
            "related_entities": deepcopy(app_video.get("related_entities", [])),
            "last_verified_at": None,
        }
        videos.append(video)

    videos.sort(key=lambda video: video["accession"])
    unresolved = [
        {
            **record,
            "reason": "duplicate_youtube_id_conflict",
            "canonical_accession": accession_by_id[record["youtube_id"]],
        }
        for record in duplicate_rows
    ]
    resources = deepcopy(resource_rows)
    stats = {
        "source_rows": snapshot["census"]["source_rows"],
        "videos": len(videos),
        "unique_youtube_ids": len(videos),
        "unresolved_records": len(unresolved),
        "related_resources": len(resources),
    }
    if stats != snapshot["census"]:
        raise CatalogValidationError(
            f"snapshot census mismatch: expected {snapshot['census']}, built {stats}"
        )
    catalog = {
        "schema": "video_catalog_public/1",
        "version": 1,
        "built_at": snapshot["snapshot_at"],
        "source": {
            "sheet_url": snapshot["source_url"],
            "sheet_gid": snapshot["sheet_gid"],
            "snapshot_file": "data/video_catalog_source_public.json",
            "snapshot_at": snapshot["snapshot_at"],
            "accession_registry": "data/video_accessions.json",
            "canonical_inputs": ["app_data.json", "data/video_pipeline.json"],
        },
        "stats": stats,
        "videos": videos,
        "unresolved_records": unresolved,
        "related_resources": resources,
    }
    validate_catalog(catalog)
    return catalog


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--app-data", type=Path, default=DEFAULT_APP_DATA)
    parser.add_argument("--pipeline", type=Path, default=DEFAULT_PIPELINE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="fail if output is not current")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog = build_catalog(
        load_json(args.snapshot),
        load_json(args.registry),
        load_json(args.app_data),
        load_json(args.pipeline),
    )
    rendered = dump_json(catalog)
    if args.check:
        if not args.output.exists() or args.output.read_text(encoding="utf-8") != rendered:
            print(f"OUTDATED: {args.output}", file=sys.stderr)
            return 1
        print(f"OK: {args.output} is deterministic and current")
        return 0
    args.output.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {args.output}: {catalog['stats']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
