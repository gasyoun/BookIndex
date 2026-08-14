#!/usr/bin/env python3
"""Build and validate the privacy-allowlisted scholarly video catalog export."""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import sys
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT = ROOT / "data" / "video_catalog_source_public.json"
DEFAULT_REGISTRY = ROOT / "data" / "video_accessions.json"
DEFAULT_APP_DATA = ROOT / "app_data.json"
DEFAULT_PIPELINE = ROOT / "data" / "video_pipeline.json"
DEFAULT_EDITORIAL = ROOT / "data" / "video_catalog_editorial.json"
DEFAULT_OUTPUT = ROOT / "data" / "video_catalog_public.json"
DEFAULT_OUTPUT_V2 = ROOT / "data" / "video_catalog_public.v2.json"

OVERRIDE_FIELD_ORDER = (
    "title_display",
    "contributors",
    "date_recorded",
    "upload_date",
    "topics",
    "type",
    "purpose",
    "transcript_status",
    "transcript_url",
    "public_note",
    "duplicate_of",
)
OVERRIDE_FIELDS = set(OVERRIDE_FIELD_ORDER)
CONTRIBUTOR_ROLES = {
    "speaker",
    "lecturer",
    "interviewer",
    "moderator",
    "participant",
    "host",
}

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
    "reconciled_records",
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
    "duplicate_of",
    "related_entities",
    "last_verified_at",
    "evidence",
}
ENTITY_KEYS = {"head", "type", "t", "src"}
SOURCE_KEYS = {
    "sheet_url",
    "sheet_gid",
    "snapshot_file",
    "snapshot_at",
    "accession_registry",
    "canonical_inputs",
    "editorial_file",
}
STATS_KEYS = {
    "source_rows",
    "videos",
    "unique_youtube_ids",
    "unresolved_records",
    "reconciled_records",
    "related_resources",
}
UNRESOLVED_KEYS = {
    "source_row",
    "reason",
    "youtube_id",
    "title_display",
    "canonical_accession",
    "status",
    "public_summary",
    "checked_at",
    "evidence",
}
RESOURCE_KEYS = {"source_row", "title_display", "url", "resource_type"}
CONTRIBUTOR_KEYS = {"name", "role"}
EVIDENCE_KEYS = {"url", "label", "accessed_at", "supports"}
EDITORIAL_KEYS = {
    "schema",
    "title_reviews",
    "overrides",
    "unresolved_research",
    "reconciled_records",
}
TITLE_REVIEW_KEYS = {
    "accession",
    "youtube_id",
    "title_source",
    "generated_title_display",
    "decision",
    "title_display",
    "evidence",
}
OVERRIDE_KEYS = {"accession", "youtube_id", "evidence"} | OVERRIDE_FIELDS
RESEARCH_KEYS = {
    "source_row",
    "status",
    "public_summary",
    "checked_at",
    "evidence",
}
RECONCILIATION_KEYS = {
    "source_row",
    "status",
    "canonical_accession",
    "youtube_id",
    "public_summary",
    "checked_at",
    "evidence",
}
PUBLIC_RECONCILIATION_KEYS = RECONCILIATION_KEYS | {
    "source_youtube_id",
    "source_title_display",
}
ORIGINAL_RESEARCH_SOURCE_ROWS = {
    49, 50, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68, 69, 70, 73, 75
}
YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
FILENAME_TITLE_RE = re.compile(
    r"(?:^|[\\/])[^\\/]+\.(?:avi|docx?|mkv|mov|mp3|mp4|pdf|srt|txt|vtt|webm)$",
    re.IGNORECASE,
)


class CatalogValidationError(ValueError):
    """Raised when the public export violates its data contract."""


def is_filename_like_title(title: str) -> bool:
    """Return true for path/extension names or obvious hyphen-delimited slugs."""
    stripped = title.strip()
    if FILENAME_TITLE_RE.search(stripped):
        return True
    hyphens = stripped.count("-")
    whitespace = sum(character.isspace() for character in stripped)
    return hyphens >= 4 and whitespace <= 1


def humanize_display_title(title_source: str) -> str:
    """Conservatively turn obvious filename-style hyphen slugs into display text."""
    title = title_source.strip()
    if not is_filename_like_title(title):
        return title
    title = re.sub(r"-+", " ", title)
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(
        r"\b([А-ЯЁA-Z])\s+([А-ЯЁA-Z])\s+(?=[А-ЯЁA-Z][а-яёa-z])",
        r"\1. \2. ",
        title,
    )
    return title


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


def _validate_iso_date(value: Any, where: str, *, nullable: bool = False) -> None:
    if nullable and value is None:
        return
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise CatalogValidationError(f"{where}: must be a full ISO date (YYYY-MM-DD)")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise CatalogValidationError(f"{where}: invalid calendar date") from exc
    if parsed.isoformat() != value:
        raise CatalogValidationError(f"{where}: must be a canonical ISO date")


def _validate_public_url(value: Any, where: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise CatalogValidationError(f"{where}: must be a public HTTP(S) URL")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise CatalogValidationError(f"{where}: must be a public HTTP(S) URL")
    hostname = parsed.hostname.lower()
    forbidden_hosts = {
        "drive.google.com",
        "docs.google.com",
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
    }
    host_labels = set(hostname.split("."))
    path_segments = set(parsed.path.lower().split("/"))
    if (
        hostname in forbidden_hosts
        or hostname.endswith((".drive.google.com", ".docs.google.com", ".internal"))
        or host_labels & {"internal", "workflow"}
        or path_segments & {"internal", "workflow"}
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise CatalogValidationError(f"{where}: private/internal/workflow URL is forbidden")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise CatalogValidationError(f"{where}: non-public IP URL is forbidden")


def _validate_evidence(
    entries: Any,
    where: str,
    *,
    allowed_supports: set[str] = OVERRIDE_FIELDS,
) -> set[str]:
    if not isinstance(entries, list):
        raise CatalogValidationError(f"{where}: evidence must be a list")
    covered: set[str] = set()
    seen: set[tuple[str, str, str, tuple[str, ...]]] = set()
    for index, entry in enumerate(entries):
        entry_where = f"{where}[{index}]"
        if not isinstance(entry, dict):
            raise CatalogValidationError(f"{entry_where}: must be an object")
        _require_keys(entry, EVIDENCE_KEYS, entry_where)
        if set(entry) != EVIDENCE_KEYS:
            raise CatalogValidationError(f"{entry_where}: all evidence fields are required")
        _validate_public_url(entry["url"], f"{entry_where}.url")
        if not isinstance(entry["label"], str) or not entry["label"].strip():
            raise CatalogValidationError(f"{entry_where}.label: must be non-empty")
        _validate_iso_date(entry["accessed_at"], f"{entry_where}.accessed_at")
        supports = entry["supports"]
        if (
            not isinstance(supports, list)
            or not supports
            or any(not isinstance(field, str) or field not in allowed_supports for field in supports)
            or len(set(supports)) != len(supports)
        ):
            raise CatalogValidationError(
                f"{entry_where}.supports: must be a unique non-empty allowlisted field list"
            )
        signature = (
            entry["url"],
            entry["label"],
            entry["accessed_at"],
            tuple(supports),
        )
        if signature in seen:
            raise CatalogValidationError(f"{entry_where}: duplicate evidence entry")
        seen.add(signature)
        covered.update(supports)
    return covered


def _validate_video_field_shapes(video: dict[str, Any], where: str) -> None:
    for field in ("date_recorded", "upload_date"):
        if field in video:
            _validate_iso_date(video[field], f"{where}.{field}")
    contributors = video.get("contributors", [])
    if not isinstance(contributors, list):
        raise CatalogValidationError(f"{where}: contributors must be a list")
    for contributor_index, contributor in enumerate(contributors):
        contributor_where = f"{where}.contributors[{contributor_index}]"
        if not isinstance(contributor, dict):
            raise CatalogValidationError(f"{contributor_where}: must be an object")
        _require_keys(contributor, CONTRIBUTOR_KEYS, contributor_where)
        if set(contributor) != CONTRIBUTOR_KEYS:
            raise CatalogValidationError(f"{contributor_where}: name and role are required")
        if not isinstance(contributor["name"], str) or not contributor["name"].strip():
            raise CatalogValidationError(f"{contributor_where}.name: must be non-empty")
        if contributor["role"] not in CONTRIBUTOR_ROLES:
            raise CatalogValidationError(f"{contributor_where}.role: invalid contributor role")
    transcript_url = video.get("transcript_url")
    transcript_status_value = video.get("transcript_status")
    if transcript_url is not None:
        _validate_public_url(transcript_url, f"{where}.transcript_url")
        if transcript_status_value in {"unknown", "none"}:
            raise CatalogValidationError(
                f"{where}: transcript_url is incompatible with transcript_status"
            )
    if transcript_status_value == "published" and not transcript_url:
        raise CatalogValidationError(f"{where}: published transcript requires transcript_url")
    duplicate_of = video.get("duplicate_of")
    if duplicate_of is not None:
        # Дубли помечаются, а не удаляются: удаление ломает ссылки и счётчики.
        if not isinstance(duplicate_of, str) or not re.fullmatch(r"\d{3}", duplicate_of):
            raise CatalogValidationError(f"{where}.duplicate_of: must be a three-digit accession")
        if duplicate_of == video.get("accession"):
            raise CatalogValidationError(f"{where}.duplicate_of: cannot point at itself")


def validate_catalog(catalog: dict[str, Any]) -> None:
    """Validate identity, privacy, enums, and public field shapes."""
    _require_keys(catalog, TOP_LEVEL_KEYS, "catalog")
    _walk_forbidden(catalog)
    version = catalog.get("version")
    if (catalog.get("schema"), version) not in {
        ("video_catalog_public/1", 1),
        ("video_catalog_public/2", 2),
    }:
        raise CatalogValidationError("unsupported schema/version")
    source = catalog.get("source")
    stats = catalog.get("stats")
    unresolved = catalog.get("unresolved_records")
    reconciled = catalog.get("reconciled_records")
    resources = catalog.get("related_resources")
    if not isinstance(source, dict):
        raise CatalogValidationError("source must be an object")
    _require_keys(source, SOURCE_KEYS, "source")
    if not isinstance(stats, dict):
        raise CatalogValidationError("stats must be an object")
    _require_keys(stats, STATS_KEYS, "stats")
    if version == 2 and "reconciled_records" not in stats:
        raise CatalogValidationError("v2 stats require reconciled_records")
    if version == 1 and "reconciled_records" in stats:
        raise CatalogValidationError("v1 stats must omit reconciled_records")
    if not isinstance(unresolved, list) or not isinstance(resources, list):
        raise CatalogValidationError("record collections must be lists")
    if version == 2 and not isinstance(reconciled, list):
        raise CatalogValidationError("v2 reconciled_records must be a list")
    if version == 1 and reconciled is not None:
        raise CatalogValidationError("v1 must omit reconciled_records")
    for index, record in enumerate(unresolved):
        if not isinstance(record, dict):
            raise CatalogValidationError(f"unresolved_records[{index}] must be an object")
        _require_keys(record, UNRESOLVED_KEYS, f"unresolved_records[{index}]")
        if version == 2:
            required_research = {"status", "public_summary", "checked_at", "evidence"}
            if required_research - set(record):
                raise CatalogValidationError(
                    f"unresolved_records[{index}]: missing public research fields"
                )
            if record["status"] != "unresolved":
                raise CatalogValidationError(
                    f"unresolved_records[{index}].status: must be unresolved"
                )
            if not isinstance(record["public_summary"], str) or not record["public_summary"].strip():
                raise CatalogValidationError(
                    f"unresolved_records[{index}].public_summary: must be non-empty"
                )
            _validate_iso_date(
                record["checked_at"], f"unresolved_records[{index}].checked_at"
            )
            _validate_evidence(
                record["evidence"],
                f"unresolved_records[{index}].evidence",
                allowed_supports={"public_summary"},
            )
    for index, record in enumerate(reconciled or []):
        where = f"reconciled_records[{index}]"
        if not isinstance(record, dict):
            raise CatalogValidationError(f"{where}: must be an object")
        _require_keys(record, PUBLIC_RECONCILIATION_KEYS, where)
        if set(record) != PUBLIC_RECONCILIATION_KEYS:
            raise CatalogValidationError(f"{where}: all reconciliation fields are required")
        if record["status"] != "reconciled":
            raise CatalogValidationError(f"{where}.status: must be reconciled")
        if not isinstance(record["public_summary"], str) or not record["public_summary"].strip():
            raise CatalogValidationError(f"{where}.public_summary: must be non-empty")
        _validate_iso_date(record["checked_at"], f"{where}.checked_at")
        _validate_evidence(
            record["evidence"],
            f"{where}.evidence",
            allowed_supports={"reconciliation"},
        )
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
    if version == 2:
        required.add("evidence")
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
        if is_filename_like_title(title):
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
        for optional_text in ("type", "purpose"):
            value = video[optional_text]
            if value is not None and not isinstance(value, str):
                raise CatalogValidationError(f"{where}: {optional_text} must be string or null")
        _validate_iso_date(video["last_verified_at"], f"{where}.last_verified_at", nullable=True)
        if "public_note" in video and not isinstance(video["public_note"], str):
            raise CatalogValidationError(f"{where}: public_note must be a string")
        _validate_video_field_shapes(video, where)
        if version == 2:
            covered = _validate_evidence(video["evidence"], f"{where}.evidence")
            expected_verified = max(
                (entry["accessed_at"] for entry in video["evidence"]),
                default=None,
            )
            if video["last_verified_at"] != expected_verified:
                raise CatalogValidationError(f"{where}: last_verified_at is not evidence-derived")
            del covered
        entities = video["related_entities"]
        if not isinstance(entities, list):
            raise CatalogValidationError(f"{where}: related_entities must be a list")
        for entity_index, entity in enumerate(entities):
            if not isinstance(entity, dict):
                raise CatalogValidationError(f"{where}.related_entities[{entity_index}]: must be an object")
            _require_keys(entity, ENTITY_KEYS, f"{where}.related_entities[{entity_index}]")

    visible_source_rows = len(videos) + len(unresolved) + len(resources)
    expected = {
        "source_rows": stats.get("source_rows"),
        "videos": len(videos),
        "unique_youtube_ids": len(youtube_ids),
        "unresolved_records": len(unresolved),
        "related_resources": len(resources),
    }
    if version == 2:
        expected["reconciled_records"] = len(reconciled)
        expected["source_rows"] = visible_source_rows + len(reconciled)
    elif type(stats.get("source_rows")) is not int or stats["source_rows"] < visible_source_rows:
        raise CatalogValidationError("v1 source_rows cannot be smaller than visible records")
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


def validate_editorial(editorial: dict[str, Any], base_catalog: dict[str, Any]) -> None:
    """Validate the evidence overlay against immutable canonical identities."""
    if not isinstance(editorial, dict):
        raise CatalogValidationError("editorial overlay must be an object")
    _require_keys(editorial, EDITORIAL_KEYS, "editorial")
    if set(editorial) != EDITORIAL_KEYS or editorial.get("schema") != "video_catalog_editorial/1":
        raise CatalogValidationError("unsupported or incomplete editorial schema")
    _walk_forbidden(editorial, "editorial")
    by_accession = {video["accession"]: video for video in base_catalog["videos"]}
    normalized_accessions = {
        video["accession"]
        for video in base_catalog["videos"]
        if video["title_source"] != video["title_display"]
    }

    reviews = editorial["title_reviews"]
    if not isinstance(reviews, list):
        raise CatalogValidationError("editorial.title_reviews must be a list")
    reviewed: set[str] = set()
    for index, review in enumerate(reviews):
        where = f"editorial.title_reviews[{index}]"
        if not isinstance(review, dict):
            raise CatalogValidationError(f"{where}: must be an object")
        _require_keys(review, TITLE_REVIEW_KEYS, where)
        required = {
            "accession",
            "youtube_id",
            "title_source",
            "generated_title_display",
            "decision",
            "evidence",
        }
        if required - set(review):
            raise CatalogValidationError(f"{where}: missing required title review fields")
        accession = review["accession"]
        if accession in reviewed:
            raise CatalogValidationError(f"{where}: duplicate title review accession")
        reviewed.add(accession)
        canonical = by_accession.get(accession)
        if canonical is None:
            raise CatalogValidationError(f"{where}: unknown canonical accession")
        if (
            review["youtube_id"] != canonical["youtube_id"]
            or review["title_source"] != canonical["title_source"]
            or review["generated_title_display"] != canonical["title_display"]
        ):
            raise CatalogValidationError(f"{where}: canonical identity/source title changed")
        decision = review["decision"]
        covered = _validate_evidence(review["evidence"], f"{where}.evidence")
        if decision == "accepted_generated":
            if "title_display" in review or review["evidence"]:
                raise CatalogValidationError(
                    f"{where}: accepted_generated must not carry an override/evidence"
                )
        elif decision == "overridden":
            title = review.get("title_display")
            if not isinstance(title, str) or not title.strip() or is_filename_like_title(title):
                raise CatalogValidationError(f"{where}: invalid title_display override")
            if "title_display" not in covered:
                raise CatalogValidationError(f"{where}: title_display lacks evidence coverage")
        else:
            raise CatalogValidationError(f"{where}: invalid title review decision")
    if reviewed != normalized_accessions:
        missing = sorted(normalized_accessions - reviewed)
        extra = sorted(reviewed - normalized_accessions)
        raise CatalogValidationError(
            f"title review ledger must cover exactly normalized titles; missing={missing}, extra={extra}"
        )

    overrides = editorial["overrides"]
    if not isinstance(overrides, list):
        raise CatalogValidationError("editorial.overrides must be a list")
    overridden: set[str] = set()
    for index, override in enumerate(overrides):
        where = f"editorial.overrides[{index}]"
        if not isinstance(override, dict):
            raise CatalogValidationError(f"{where}: must be an object")
        _require_keys(override, OVERRIDE_KEYS, where)
        required = {"accession", "youtube_id", "evidence"}
        if required - set(override):
            raise CatalogValidationError(f"{where}: missing identity/evidence fields")
        fields = set(override) & OVERRIDE_FIELDS
        if not fields:
            raise CatalogValidationError(f"{where}: no editorial override fields")
        empty_fields = {
            field
            for field in fields
            if override[field] is None
            or override[field] == ""
            or override[field] == []
            or override[field] == {}
            or (isinstance(override[field], str) and not override[field].strip())
        }
        if empty_fields:
            raise CatalogValidationError(
                f"{where}: empty values cannot erase canonical data: {sorted(empty_fields)}"
            )
        accession = override["accession"]
        if accession in overridden:
            raise CatalogValidationError(f"{where}: duplicate override accession")
        overridden.add(accession)
        canonical = by_accession.get(accession)
        if canonical is None or override["youtube_id"] != canonical["youtube_id"]:
            raise CatalogValidationError(f"{where}: canonical identity changed")
        covered = _validate_evidence(override["evidence"], f"{where}.evidence")
        if not fields <= covered:
            raise CatalogValidationError(
                f"{where}: fields lack evidence coverage: {sorted(fields - covered)}"
            )
        candidate = deepcopy(canonical)
        candidate.update({field: deepcopy(override[field]) for field in fields})
        _validate_video_field_shapes(candidate, where)
        if "title_display" in fields:
            title = candidate["title_display"]
            if not isinstance(title, str) or not title.strip() or is_filename_like_title(title):
                raise CatalogValidationError(f"{where}: invalid title_display override")
        if "topics" in fields and (
            not isinstance(candidate["topics"], list)
            or any(not isinstance(topic, str) or not topic.strip() for topic in candidate["topics"])
        ):
            raise CatalogValidationError(f"{where}: topics must be non-empty strings")
        if "transcript_status" in fields and candidate["transcript_status"] not in TRANSCRIPT_STATUSES:
            raise CatalogValidationError(f"{where}: invalid transcript_status")
        for field in ("type", "purpose"):
            if field in fields and not isinstance(candidate[field], str):
                raise CatalogValidationError(f"{where}: {field} must be a string")
        if "public_note" in fields and (
            not isinstance(candidate["public_note"], str) or not candidate["public_note"].strip()
        ):
            raise CatalogValidationError(f"{where}: public_note must be non-empty")

    reconciliations = editorial["reconciled_records"]
    if not isinstance(reconciliations, list):
        raise CatalogValidationError("editorial.reconciled_records must be a list")
    reconciled_rows: set[int] = set()
    for index, record in enumerate(reconciliations):
        where = f"editorial.reconciled_records[{index}]"
        if not isinstance(record, dict):
            raise CatalogValidationError(f"{where}: must be an object")
        _require_keys(record, RECONCILIATION_KEYS, where)
        if set(record) != RECONCILIATION_KEYS:
            raise CatalogValidationError(f"{where}: all reconciliation fields are required")
        source_row = record["source_row"]
        if type(source_row) is not int or source_row in reconciled_rows:
            raise CatalogValidationError(f"{where}: invalid/duplicate source_row")
        reconciled_rows.add(source_row)
        canonical = by_accession.get(record["canonical_accession"])
        if canonical is None or record["youtube_id"] != canonical["youtube_id"]:
            raise CatalogValidationError(f"{where}: canonical reconciliation identity changed")
        if record["status"] != "reconciled":
            raise CatalogValidationError(f"{where}: status must be reconciled")
        if not isinstance(record["public_summary"], str) or not record["public_summary"].strip():
            raise CatalogValidationError(f"{where}: public_summary must be non-empty")
        _validate_iso_date(record["checked_at"], f"{where}.checked_at")
        covered = _validate_evidence(
            record["evidence"],
            f"{where}.evidence",
            allowed_supports={"reconciliation"},
        )
        if "reconciliation" not in covered:
            raise CatalogValidationError(f"{where}: reconciliation lacks evidence coverage")
    if len(reconciled_rows) != 14:
        raise CatalogValidationError("editorial reconciled_records must contain exactly 14 rows")

    research = editorial["unresolved_research"]
    if not isinstance(research, list):
        raise CatalogValidationError("editorial.unresolved_research must be a list")
    reviewed_rows: set[int] = set()
    resolved_rows: set[int] = set()
    for index, record in enumerate(research):
        where = f"editorial.unresolved_research[{index}]"
        if not isinstance(record, dict):
            raise CatalogValidationError(f"{where}: must be an object")
        _require_keys(record, RESEARCH_KEYS, where)
        if set(record) != RESEARCH_KEYS:
            raise CatalogValidationError(f"{where}: all unresolved research fields are required")
        source_row = record["source_row"]
        if type(source_row) is not int or source_row in reviewed_rows:
            raise CatalogValidationError(f"{where}: invalid/duplicate source_row")
        reviewed_rows.add(source_row)
        if record["status"] not in {"unresolved", "resolved"}:
            raise CatalogValidationError(f"{where}: invalid research status")
        if record["status"] == "resolved":
            resolved_rows.add(source_row)
        if not isinstance(record["public_summary"], str) or not record["public_summary"].strip():
            raise CatalogValidationError(f"{where}: public_summary must be non-empty")
        _validate_iso_date(record["checked_at"], f"{where}.checked_at")
        covered = _validate_evidence(
            record["evidence"],
            f"{where}.evidence",
            allowed_supports={"public_summary"},
        )
        if record["status"] == "resolved" and "public_summary" not in covered:
            raise CatalogValidationError(f"{where}: resolved research lacks evidence coverage")
    if reviewed_rows != ORIGINAL_RESEARCH_SOURCE_ROWS:
        raise CatalogValidationError(
            "unresolved research ledger must cover exactly the original 16 source rows"
        )
    if reconciled_rows != resolved_rows - {75}:
        raise CatalogValidationError(
            "reconciled_records must match the 14 resolved existing-accession source rows"
        )


def apply_editorial(
    base_catalog: dict[str, Any], editorial: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply a validated overlay and return backward-compatible v1 plus evidence-rich v2."""
    validate_editorial(editorial, base_catalog)
    v2 = deepcopy(base_catalog)
    v2["schema"] = "video_catalog_public/2"
    v2["version"] = 2
    v2["source"]["editorial_file"] = "data/video_catalog_editorial.json"
    by_accession = {video["accession"]: video for video in v2["videos"]}

    evidence_by_accession: dict[str, list[dict[str, Any]]] = {
        accession: [] for accession in by_accession
    }
    for review in editorial["title_reviews"]:
        accession = review["accession"]
        if review["decision"] == "overridden":
            by_accession[accession]["title_display"] = review["title_display"]
        evidence_by_accession[accession].extend(deepcopy(review["evidence"]))
    for override in editorial["overrides"]:
        accession = override["accession"]
        target = by_accession[accession]
        for field in OVERRIDE_FIELD_ORDER:
            if field in override:
                target[field] = deepcopy(override[field])
        evidence_by_accession[accession].extend(deepcopy(override["evidence"]))
    for accession, video in by_accession.items():
        evidence = evidence_by_accession[accession]
        video["evidence"] = evidence
        video["last_verified_at"] = max(
            (entry["accessed_at"] for entry in evidence),
            default=None,
        )

    research_by_row = {
        record["source_row"]: record for record in editorial["unresolved_research"]
    }
    source_conflicts = {
        record["source_row"]: record for record in v2["unresolved_records"]
    }
    unresolved_records = [
        record
        for record in v2["unresolved_records"]
        if research_by_row[record["source_row"]]["status"] == "unresolved"
    ]
    for unresolved in unresolved_records:
        unresolved.update(deepcopy(research_by_row[unresolved["source_row"]]))
    v2["unresolved_records"] = unresolved_records

    reconciled_records: list[dict[str, Any]] = []
    for reconciliation in editorial["reconciled_records"]:
        source = source_conflicts[reconciliation["source_row"]]
        reconciled_records.append(
            {
                **deepcopy(reconciliation),
                "source_youtube_id": source["youtube_id"],
                "source_title_display": source["title_display"],
            }
        )
    v2["reconciled_records"] = reconciled_records
    v2["stats"] = {
        **v2["stats"],
        "unresolved_records": len(unresolved_records),
        "reconciled_records": len(reconciled_records),
    }

    validate_catalog(v2)
    v1 = deepcopy(v2)
    v1["schema"] = "video_catalog_public/1"
    v1["version"] = 1
    v1["source"].pop("editorial_file")
    v1.pop("reconciled_records")
    v1["stats"].pop("reconciled_records")
    for video in v1["videos"]:
        video.pop("evidence")
    for unresolved in v1["unresolved_records"]:
        for field in ("status", "public_summary", "checked_at", "evidence"):
            unresolved.pop(field)
    validate_catalog(v1)
    return v1, v2


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
            "title_display": humanize_display_title(app_video["title"]),
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


def build_exports(
    snapshot: dict[str, Any],
    registry: dict[str, Any],
    app_data: dict[str, Any],
    pipeline: dict[str, Any],
    editorial: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build the stable v1 export and the v2 evidence-layer export together."""
    base_catalog = build_catalog(snapshot, registry, app_data, pipeline)
    return apply_editorial(base_catalog, editorial)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--app-data", type=Path, default=DEFAULT_APP_DATA)
    parser.add_argument("--pipeline", type=Path, default=DEFAULT_PIPELINE)
    parser.add_argument("--editorial", type=Path, default=DEFAULT_EDITORIAL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--output-v2", type=Path, default=DEFAULT_OUTPUT_V2)
    parser.add_argument("--check", action="store_true", help="fail if either output is not current")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog, catalog_v2 = build_exports(
        load_json(args.snapshot),
        load_json(args.registry),
        load_json(args.app_data),
        load_json(args.pipeline),
        load_json(args.editorial),
    )
    rendered = dump_json(catalog)
    rendered_v2 = dump_json(catalog_v2)
    if args.check:
        outdated = [
            path
            for path, expected in ((args.output, rendered), (args.output_v2, rendered_v2))
            if not path.exists() or path.read_text(encoding="utf-8") != expected
        ]
        if outdated:
            for path in outdated:
                print(f"OUTDATED: {path}", file=sys.stderr)
            return 1
        print(f"OK: {args.output} and {args.output_v2} are deterministic and current")
        return 0
    args.output.write_text(rendered, encoding="utf-8", newline="\n")
    args.output_v2.write_text(rendered_v2, encoding="utf-8", newline="\n")
    print(f"Wrote {args.output} and {args.output_v2}: {catalog['stats']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
