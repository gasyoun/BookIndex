#!/usr/bin/env python3
"""Static content validation for BookIndex app_data.json."""

from __future__ import annotations

import json
import sys
import unicodedata
from collections import Counter
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
SCHEMA_CURRENT = 2
SCHEMA_FILE_DEFAULT = Path(__file__).resolve().parents[1] / "schemas" / "app_data.schema.json"


def configure_output_encoding() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def fail(msg: str, errors: list[str]) -> None:
    errors.append(msg)


def warn(msg: str, warnings: list[str]) -> None:
    warnings.append(msg)


def build_entity_index(data: dict[str, Any]) -> dict[str, set[str]]:
    idx: dict[str, set[str]] = {}
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        names: set[str] = set()
        if isinstance(arr, list):
            for item in arr:
                if isinstance(item, dict):
                    head = item.get("head")
                    if isinstance(head, str) and head.strip():
                        names.add(head.strip())
        idx[key] = names
    return idx


def validate_duplicates(data: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            fail(f"[{key}] must be a list", errors)
            continue
        heads = [str(it.get("head", "")).strip() for it in arr if isinstance(it, dict)]
        dup = [h for h, c in Counter(heads).items() if h and c > 1]
        if dup:
            warn(f"[{key}] duplicate heads: {', '.join(sorted(dup)[:15])}", warnings)


def validate_suspicious_heads(data: dict[str, Any], warnings: list[str]) -> None:
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        suspicious = []
        for item in arr:
            if not isinstance(item, dict):
                continue
            head = str(item.get("head", "")).strip()
            if head.startswith("?") or "\ufffd" in head:
                suspicious.append(head)
        if suspicious:
            warn(
                f"[{key}] suspicious heads: "
                + ", ".join(suspicious[:15])
                + (f" (+{len(suspicious) - 15} more)" if len(suspicious) > 15 else ""),
                warnings,
            )


def duplicate_candidate_head_key(value: str) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value.strip().replace("\u0451", "\u0435").replace("\u0401", "\u0415"),
    )
    chunks: list[str] = []
    needs_space = False
    for char in normalized:
        if unicodedata.category(char) in {"Mn", "Me", "Cf"}:
            continue
        folded = char.casefold()
        if folded.isalnum():
            chunks.append(folded)
            needs_space = True
        elif needs_space:
            chunks.append(" ")
            needs_space = False
    return " ".join("".join(chunks).split())


def get_item_books(item: dict[str, Any]) -> list[str]:
    books: set[str] = set()
    occurrences = item.get("occurrences")
    if isinstance(occurrences, dict):
        for book_id in occurrences:
            if isinstance(book_id, str) and book_id.strip():
                books.add(book_id.strip())
    book_id = item.get("book_id")
    if isinstance(book_id, str) and book_id.strip():
        books.add(book_id.strip())
    return sorted(books)


def get_item_pages(item: dict[str, Any]) -> list[int]:
    pages = []
    for raw in item.get("page_list") or []:
        if isinstance(raw, int):
            pages.append(raw)
    return sorted(set(pages))


def get_context_page_keys(value: Any) -> list[int]:
    if not isinstance(value, dict):
        return []
    pages = []
    for raw in value:
        try:
            pages.append(int(raw))
        except (TypeError, ValueError):
            continue
    return sorted(set(pages))


def get_occurrence_pages(item: dict[str, Any]) -> list[int]:
    pages: set[int] = set()
    occurrences = item.get("occurrences")
    if not isinstance(occurrences, dict):
        return []
    for occurrence in occurrences.values():
        if not isinstance(occurrence, dict):
            continue
        for raw in occurrence.get("pages") or []:
            if isinstance(raw, int):
                pages.add(raw)
        pages.update(get_context_page_keys(occurrence.get("contexts")))
    return sorted(pages)


def item_needs_page_verification(item: dict[str, Any]) -> bool:
    page_list = set(get_item_pages(item))
    occurrence_pages = set(get_occurrence_pages(item))
    context_pages = set(get_context_page_keys(item.get("contexts")))
    evidence_pages = occurrence_pages | context_pages
    if not evidence_pages:
        return False
    if evidence_pages - page_list:
        return True
    return bool(occurrence_pages and page_list - occurrence_pages)


def count_cross_book_duplicate_candidates(data: dict[str, Any]) -> int:
    by_head: dict[str, set[str]] = {}
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        for item in arr:
            if not isinstance(item, dict):
                continue
            head = str(item.get("head", "")).strip()
            candidate_key = duplicate_candidate_head_key(head)
            if not candidate_key:
                continue
            books = get_item_books(item)
            if not books:
                continue
            by_head.setdefault(candidate_key, set()).update(books)
    return sum(1 for books in by_head.values() if len(books) > 1)


def count_needs_page_verification(data: dict[str, Any]) -> int:
    total = 0
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        total += sum(1 for item in arr if isinstance(item, dict) and item_needs_page_verification(item))
    return total


def validate_schema(data: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    schema_version = data.get("schema_version")
    if not isinstance(schema_version, int):
        fail("[schema] schema_version must be integer", errors)
        return
    if schema_version < 1:
        fail("[schema] schema_version must be >= 1", errors)
    if schema_version > SCHEMA_CURRENT:
        warn(
            f"[schema] schema_version {schema_version} is newer than validator support {SCHEMA_CURRENT}",
            warnings,
        )
    migrations = data.get("schema_migrations")
    if migrations is not None and not isinstance(migrations, list):
        fail("[schema] schema_migrations must be list when present", errors)


def validate_corpus(data: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    corpus = data.get("corpus")
    if corpus is None:
        return
    if not isinstance(corpus, dict):
        fail("[corpus] must be object", errors)
        return

    books = corpus.get("books", [])
    if not isinstance(books, list):
        fail("[corpus] books must be list", errors)
        books = []

    book_ids: list[str] = []
    for i, book in enumerate(books):
        if not isinstance(book, dict):
            fail(f"[corpus] books[{i}] must be object", errors)
            continue
        book_id = book.get("book_id")
        if not isinstance(book_id, str) or not book_id.strip():
            fail(f"[corpus] books[{i}].book_id must be non-empty string", errors)
            continue
        book_ids.append(book_id.strip())
        source_type = book.get("source_type")
        if source_type is not None and not isinstance(source_type, str):
            fail(f"[corpus] books[{i}].source_type must be string", errors)
        pages_total = book.get("pages_total")
        if pages_total is not None and (not isinstance(pages_total, int) or pages_total < 1):
            fail(f"[corpus] books[{i}].pages_total must be positive integer", errors)
        modules = book.get("content_modules")
        if modules is not None and not isinstance(modules, list):
            fail(f"[corpus] books[{i}].content_modules must be list", errors)
        elif isinstance(modules, list) and not all(isinstance(item, str) for item in modules):
            fail(f"[corpus] books[{i}].content_modules items must be strings", errors)

    duplicate_ids = [book_id for book_id, count in Counter(book_ids).items() if count > 1]
    if duplicate_ids:
        fail(f"[corpus] duplicate book_id values: {', '.join(sorted(duplicate_ids)[:15])}", errors)

    active_book_id = corpus.get("active_book_id")
    if active_book_id is not None:
        if not isinstance(active_book_id, str) or not active_book_id.strip():
            fail("[corpus] active_book_id must be non-empty string", errors)
        elif book_ids and active_book_id.strip() not in set(book_ids):
            fail(f"[corpus] active_book_id {active_book_id!r} is not listed in books", errors)

    source_types = corpus.get("source_types", [])
    if source_types is None:
        source_types = []
    if not isinstance(source_types, list):
        fail("[corpus] source_types must be list", errors)
        source_types = []

    type_ids: list[str] = []
    for i, source_type in enumerate(source_types):
        if not isinstance(source_type, dict):
            fail(f"[corpus] source_types[{i}] must be object", errors)
            continue
        type_id = source_type.get("type")
        if not isinstance(type_id, str) or not type_id.strip():
            fail(f"[corpus] source_types[{i}].type must be non-empty string", errors)
            continue
        type_ids.append(type_id.strip())
        planned_count = source_type.get("planned_count")
        if planned_count is not None and (not isinstance(planned_count, int) or planned_count < 0):
            fail(f"[corpus] source_types[{i}].planned_count must be non-negative integer", errors)
        supports = source_type.get("supports")
        if supports is not None and not isinstance(supports, list):
            fail(f"[corpus] source_types[{i}].supports must be list", errors)
        elif isinstance(supports, list) and not all(isinstance(item, str) for item in supports):
            fail(f"[corpus] source_types[{i}].supports items must be strings", errors)

    duplicate_types = [type_id for type_id, count in Counter(type_ids).items() if count > 1]
    if duplicate_types:
        fail(f"[corpus] duplicate source_types values: {', '.join(sorted(duplicate_types)[:15])}", errors)

    known_types = set(type_ids)
    for i, book in enumerate(books):
        if not isinstance(book, dict):
            continue
        source_type = book.get("source_type")
        if isinstance(source_type, str) and known_types and source_type not in known_types:
            warnings.append(f"[corpus] books[{i}].source_type {source_type!r} is not listed in source_types")


def validate_against_json_schema(
    data: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    schema_path: Path = SCHEMA_FILE_DEFAULT,
) -> None:
    if not schema_path.exists():
        warn(f"[json-schema] schema file not found: {schema_path}", warnings)
        return

    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"[json-schema] failed to read {schema_path}: {exc}", errors)
        return

    try:
        import jsonschema  # type: ignore
    except Exception:
        warn(
            "[json-schema] python package 'jsonschema' is not installed; schema validation skipped",
            warnings,
        )
        return

    validator_cls = getattr(jsonschema, "Draft202012Validator", None)
    if validator_cls is None:
        try:
            jsonschema.validate(instance=data, schema=schema)
        except Exception as exc:
            fail(f"[json-schema] validation error: {exc}", errors)
        return

    schema_errors = sorted(
        validator_cls(schema).iter_errors(data),
        key=lambda err: (list(err.path), err.message),
    )
    if not schema_errors:
        return

    for err in schema_errors[:50]:
        location = "/".join(str(p) for p in err.path) or "<root>"
        fail(f"[json-schema] {location}: {err.message}", errors)
    if len(schema_errors) > 50:
        warn(f"[json-schema] {len(schema_errors) - 50} additional schema errors omitted", warnings)


def validate_editorial_flags(data: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    allowed = {"verified", "suspect", "source_confirmed", "note"}
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        for i, item in enumerate(arr):
            if not isinstance(item, dict):
                continue
            head = str(item.get("head", f"#{i}"))
            flags = item.get("editorial_flags")
            if flags is None:
                continue
            if not isinstance(flags, dict):
                fail(f"[{key}] {head}: editorial_flags must be object", errors)
                continue
            unknown = sorted(set(flags.keys()) - allowed)
            if unknown:
                warn(f"[{key}] {head}: unknown editorial_flags keys: {', '.join(unknown)}", warnings)
            for field in ("verified", "suspect", "source_confirmed"):
                if field in flags and not isinstance(flags[field], bool):
                    fail(f"[{key}] {head}: editorial_flags.{field} must be bool", errors)
            if "note" in flags and not isinstance(flags["note"], str):
                fail(f"[{key}] {head}: editorial_flags.note must be string", errors)
            if flags.get("verified") is True and flags.get("suspect") is True:
                warn(f"[{key}] {head}: both verified and suspect are true", warnings)


def validate_sources(data: dict[str, Any], errors: list[str]) -> None:
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        for i, item in enumerate(arr):
            if not isinstance(item, dict):
                continue
            head = str(item.get("head", f"#{i}"))
            sources = item.get("sources")
            if sources is None:
                continue
            if not isinstance(sources, list):
                fail(f"[{key}] {head}: sources must be list", errors)
                continue
            for j, src in enumerate(sources):
                if not isinstance(src, dict):
                    fail(f"[{key}] {head}: sources[{j}] must be object", errors)
                    continue
                for field in ("label", "url", "quote"):
                    if field in src and not isinstance(src[field], str):
                        fail(f"[{key}] {head}: sources[{j}].{field} must be string", errors)
                if "page" in src and not isinstance(src["page"], (int, str)):
                    fail(f"[{key}] {head}: sources[{j}].page must be int|string", errors)


def validate_pages(data: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        for i, item in enumerate(arr):
            if not isinstance(item, dict):
                fail(f"[{key}][{i}] must be object", errors)
                continue
            head = str(item.get("head", f"#{i}"))
            pages = item.get("page_list", [])
            if pages is None:
                continue
            if not isinstance(pages, list):
                fail(f"[{key}] {head}: page_list must be list", errors)
                continue
            for p in pages:
                if not isinstance(p, int):
                    fail(f"[{key}] {head}: non-integer page {p!r}", errors)
                    continue
                if p < 1 or p > 5000:
                    fail(f"[{key}] {head}: page {p} out of range 1..5000", errors)
            if pages and pages != sorted(pages):
                warn(f"[{key}] {head}: page_list is not sorted", warnings)


def validate_contexts(data: dict[str, Any], errors: list[str]) -> None:
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        for item in arr:
            if not isinstance(item, dict):
                continue
            head = str(item.get("head", "<?>"))
            ctx = item.get("contexts")
            if ctx is None:
                continue
            if isinstance(ctx, list):
                if not all(isinstance(c, str) for c in ctx):
                    fail(f"[{key}] {head}: contexts list elements must be strings", errors)
                continue
            if not isinstance(ctx, dict):
                fail(f"[{key}] {head}: contexts must be object or list", errors)
                continue
            for pg, snippets in ctx.items():
                try:
                    p = int(str(pg))
                except ValueError:
                    fail(f"[{key}] {head}: invalid context page key {pg!r}", errors)
                    continue
                if p < 1 or p > 5000:
                    fail(f"[{key}] {head}: context page {p} out of range 1..5000", errors)
                if not isinstance(snippets, list):
                    fail(f"[{key}] {head}: contexts[{pg}] must be list", errors)


def validate_chapters(data: dict[str, Any], errors: list[str]) -> None:
    total_pages = int(data.get("book_stats", {}).get("total_pages", 424))
    chapters = data.get("chapters", [])
    if not isinstance(chapters, list):
        fail("[chapters] must be list", errors)
        return
    for i, ch in enumerate(chapters):
        if not isinstance(ch, dict):
            fail(f"[chapters][{i}] must be object", errors)
            continue
        name = str(ch.get("name", f"#{i}"))
        start = ch.get("start")
        end = ch.get("end")
        if not isinstance(start, int) or not isinstance(end, int):
            fail(f"[chapters] {name}: start/end must be integers", errors)
            continue
        if start < 1 or end < 1 or start > total_pages or end > total_pages:
            fail(f"[chapters] {name}: range {start}-{end} out of 1..{total_pages}", errors)
        if start > end:
            fail(f"[chapters] {name}: start > end ({start} > {end})", errors)


def validate_edges(data: dict[str, Any], idx: dict[str, set[str]], errors: list[str]) -> None:
    edges = data.get("edges", [])
    if isinstance(edges, list):
        for e in edges:
            if not isinstance(e, dict):
                fail("[edges] item must be object", errors)
                continue
            s = str(e.get("source", ""))
            t = str(e.get("target", ""))
            if s and s not in idx["names"]:
                fail(f"[edges] unknown source name: {s}", errors)
            if t and t not in idx["names"]:
                fail(f"[edges] unknown target name: {t}", errors)
    else:
        fail("[edges] must be list", errors)

    ledges = data.get("language_edges", [])
    if isinstance(ledges, list):
        for e in ledges:
            if not isinstance(e, dict):
                fail("[language_edges] item must be object", errors)
                continue
            s = str(e.get("source", ""))
            t = str(e.get("target", ""))
            if s and s not in idx["languages"]:
                fail(f"[language_edges] unknown source language: {s}", errors)
            if t and t not in idx["languages"]:
                fail(f"[language_edges] unknown target language: {t}", errors)
    else:
        fail("[language_edges] must be list", errors)


def validate_cross_links(data: dict[str, Any], idx: dict[str, set[str]], errors: list[str]) -> None:
    cross = data.get("cross_links", {})
    if not isinstance(cross, dict):
        fail("[cross_links] must be object", errors)
        return
    for src_type, targets_by_type in cross.items():
        if src_type not in idx:
            fail(f"[cross_links] unknown src type: {src_type}", errors)
            continue
        if not isinstance(targets_by_type, dict):
            fail(f"[cross_links] {src_type} must map to object", errors)
            continue
        for tgt_type, links_by_src in targets_by_type.items():
            if tgt_type not in idx:
                fail(f"[cross_links] unknown target type: {tgt_type}", errors)
                continue
            if not isinstance(links_by_src, dict):
                fail(f"[cross_links] {src_type}->{tgt_type} must be object", errors)
                continue
            for src_head, links in links_by_src.items():
                if src_head not in idx[src_type]:
                    fail(f"[cross_links] unknown src head in {src_type}: {src_head}", errors)
                if not isinstance(links, list):
                    fail(f"[cross_links] {src_type}:{src_head} links must be list", errors)
                    continue
                for link in links:
                    if not isinstance(link, dict):
                        fail(f"[cross_links] {src_type}:{src_head} link must be object", errors)
                        continue
                    tgt_head = str(link.get("head", ""))
                    if tgt_head and tgt_head not in idx[tgt_type]:
                        fail(
                            f"[cross_links] unknown target head {tgt_type}:{tgt_head} "
                            f"(from {src_type}:{src_head})",
                            errors,
                        )


def validate_markdown_exports(data_path: Path, errors: list[str], warnings: list[str]) -> None:
    content_dir = data_path.parent / "src" / "content"
    if not content_dir.exists():
        return
    if not content_dir.is_dir():
        fail(f"[markdown_exports] expected directory: {content_dir}", errors)
        return

    markdown_files = sorted(content_dir.glob("*.md"))
    if not markdown_files:
        warn(f"[markdown_exports] no markdown files found in {content_dir}", warnings)
        return

    missing: list[str] = []
    for path in markdown_files:
        head = "".join(path.read_text(encoding="utf-8").splitlines(keepends=True)[:16])
        if not head.startswith("---\n") or "\nsource: " not in head or "\nbook_id: " not in head:
            missing.append(str(path))
            if len(missing) >= 10:
                break
    if missing:
        fail(
            "[markdown_exports] files missing source/book_id frontmatter: "
            + ", ".join(missing),
            errors,
        )


def validate_manual_audit_queue(data_path: Path, errors: list[str], warnings: list[str]) -> None:
    queue_path = data_path.parent / "tests" / "index-audit-queue.json"
    if not queue_path.exists():
        return
    try:
        queue = json.loads(queue_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"[manual_audit] invalid {queue_path}: {exc}", errors)
        return

    if queue.get("schema_version") not in {1, 2}:
        fail("[manual_audit] index-audit-queue.json schema_version must be 1 or 2", errors)

    manual_audit = queue.get("manual_audit")
    if not isinstance(manual_audit, dict):
        fail("[manual_audit] index-audit-queue.json manual_audit must be object", errors)
        return
    missing_terms = manual_audit.get("terms_missing")
    if not isinstance(missing_terms, list) or not all(isinstance(term, str) for term in missing_terms):
        fail("[manual_audit] terms_missing must be list[str]", errors)
    totals = queue.get("totals")
    if not isinstance(totals, dict):
        fail("[manual_audit] totals must be object", errors)
        return
    for field in (
        "duplicate_heads_count",
        "suspicious_heads_count",
        "reviewed_suspicious_heads_count",
        "unreviewed_suspicious_heads_count",
        "sort_inversions_count",
    ):
        if not isinstance(totals.get(field), int):
            fail(f"[manual_audit] totals.{field} must be integer", errors)
    if "cross_book_duplicate_candidates_count" in totals and not isinstance(
        totals.get("cross_book_duplicate_candidates_count"),
        int,
    ):
        fail("[manual_audit] totals.cross_book_duplicate_candidates_count must be integer", errors)
    if "needs_page_verification_count" in totals and not isinstance(
        totals.get("needs_page_verification_count"),
        int,
    ):
        fail("[manual_audit] totals.needs_page_verification_count must be integer", errors)
    queues = queue.get("queues")
    if queues is not None:
        if not isinstance(queues, dict):
            fail("[manual_audit] queues must be object when present", errors)
        else:
            for key in (
                "missing_context",
                "missing_pages",
                "missing_source",
                "duplicate_heads",
                "cross_book_duplicate_candidates",
                "suspicious_heads",
                "sort_inversions",
                "needs_page_verification",
            ):
                bucket = queues.get(key)
                if not isinstance(bucket, dict):
                    fail(f"[manual_audit] queues.{key} must be object", errors)
                    continue
                if not isinstance(bucket.get("total"), int):
                    fail(f"[manual_audit] queues.{key}.total must be integer", errors)
                if not isinstance(bucket.get("items"), list):
                    fail(f"[manual_audit] queues.{key}.items must be list", errors)
    data = json.loads(data_path.read_text(encoding="utf-8"))
    duplicate_groups = 0
    suspicious_heads = 0
    reviewed_suspicious_heads = 0
    unreviewed_suspicious_heads = 0
    for key in ENTITY_KEYS:
        arr = data.get(key, [])
        if not isinstance(arr, list):
            continue
        heads = [str(item.get("head", "")).strip() for item in arr if isinstance(item, dict)]
        duplicate_groups += sum(1 for head, count in Counter(heads).items() if head and count > 1)
        suspicious_heads += sum(1 for head in heads if head.startswith("?") or "\ufffd" in head)
        for item in arr:
            if not isinstance(item, dict):
                continue
            head = str(item.get("head", "")).strip()
            if not (head.startswith("?") or "\ufffd" in head):
                continue
            if item.get("needs_review") is True:
                reviewed_suspicious_heads += 1
            else:
                unreviewed_suspicious_heads += 1
    if totals.get("duplicate_heads_count") != duplicate_groups:
        fail(
            "[manual_audit] stale duplicate_heads_count: "
            f"{totals.get('duplicate_heads_count')} != {duplicate_groups}",
            errors,
        )
    if totals.get("suspicious_heads_count") != suspicious_heads:
        fail(
            "[manual_audit] stale suspicious_heads_count: "
            f"{totals.get('suspicious_heads_count')} != {suspicious_heads}",
            errors,
        )
    if totals.get("reviewed_suspicious_heads_count") != reviewed_suspicious_heads:
        fail(
            "[manual_audit] stale reviewed_suspicious_heads_count: "
            f"{totals.get('reviewed_suspicious_heads_count')} != {reviewed_suspicious_heads}",
            errors,
        )
    if totals.get("unreviewed_suspicious_heads_count") != unreviewed_suspicious_heads:
        fail(
            "[manual_audit] stale unreviewed_suspicious_heads_count: "
            f"{totals.get('unreviewed_suspicious_heads_count')} != {unreviewed_suspicious_heads}",
            errors,
        )
    cross_book_count = count_cross_book_duplicate_candidates(data)
    if totals.get("cross_book_duplicate_candidates_count") not in {None, cross_book_count}:
        fail(
            "[manual_audit] stale cross_book_duplicate_candidates_count: "
            f"{totals.get('cross_book_duplicate_candidates_count')} != {cross_book_count}",
            errors,
        )
    page_verification_count = count_needs_page_verification(data)
    if totals.get("needs_page_verification_count") not in {None, page_verification_count}:
        fail(
            "[manual_audit] stale needs_page_verification_count: "
            f"{totals.get('needs_page_verification_count')} != {page_verification_count}",
            errors,
        )
    if manual_audit.get("present") is not True:
        warn("[manual_audit] index-errors.md is not marked present in queue", warnings)


def validate_context_entry_pack(data_path: Path, errors: list[str]) -> None:
    queue_path = data_path.parent / "tests" / "index-audit-queue.json"
    pack_path = data_path.parent / "tests" / "context-entry-pack.json"
    if not pack_path.exists():
        return
    if not queue_path.exists():
        fail("[context_pack] index-audit-queue.json is required when context-entry-pack.json exists", errors)
        return
    try:
        queue = json.loads(queue_path.read_text(encoding="utf-8"))
        pack = json.loads(pack_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"[context_pack] invalid queue/pack JSON: {exc}", errors)
        return

    if pack.get("schema_version") != 1:
        fail("[context_pack] schema_version must be 1", errors)
    targets = pack.get("targets")
    if not isinstance(targets, list):
        fail("[context_pack] targets must be list", errors)
        return
    if pack.get("target_count") != len(targets):
        fail("[context_pack] target_count must match targets length", errors)

    queue_targets = queue.get("context_priority_top")
    if not isinstance(queue_targets, list):
        fail("[context_pack] queue.context_priority_top must be list", errors)
        return
    limit = pack.get("limit")
    if not isinstance(limit, int) or limit < 1:
        fail("[context_pack] limit must be positive integer", errors)
        limit = len(targets)
    expected = queue_targets[:limit]
    if len(targets) != len(expected):
        fail(f"[context_pack] stale target count: {len(targets)} != {len(expected)}", errors)
        return

    for index, (target, source) in enumerate(zip(targets, expected), start=1):
        if not isinstance(target, dict) or not isinstance(source, dict):
            fail(f"[context_pack] target {index} must be object", errors)
            continue
        for field in ("entity", "head", "route", "priority_score", "priority_tier", "pages_summary"):
            if target.get(field) != source.get(field):
                fail(
                    f"[context_pack] stale target {index}.{field}: "
                    f"{target.get(field)!r} != {source.get(field)!r}",
                    errors,
                )
        if target.get("status") != "needs_source_context":
            fail(f"[context_pack] target {index}.status must be needs_source_context", errors)
        entry_fields = target.get("entry_fields")
        if not isinstance(entry_fields, dict):
            fail(f"[context_pack] target {index}.entry_fields must be object", errors)


def validate_readme_audit_summary(data_path: Path, errors: list[str]) -> None:
    readme_path = data_path.parent / "README.md"
    queue_path = data_path.parent / "tests" / "index-audit-queue.json"
    if not readme_path.exists() or not queue_path.exists():
        return
    readme = readme_path.read_text(encoding="utf-8")
    queue = json.loads(queue_path.read_text(encoding="utf-8"))
    totals = queue.get("totals", {})
    manual_audit = queue.get("manual_audit", {})
    duplicate_count = totals.get("duplicate_heads_count")
    duplicate_label = "duplicate-head group" if duplicate_count == 1 else "duplicate-head groups"
    required_fragments = [
        f"{totals.get('suspicious_heads_count')} suspicious heads",
        f"{totals.get('unreviewed_suspicious_heads_count')} без triage",
        f"{totals.get('sort_inversions_count')} sort inversions",
        f"{duplicate_count} {duplicate_label}",
        f"найдено {manual_audit.get('terms_found')} из {manual_audit.get('terms_total')} терминов",
    ]
    missing_terms = manual_audit.get("terms_missing", [])
    if isinstance(missing_terms, list):
        required_fragments.extend(str(term) for term in missing_terms)
    missing_fragments = [fragment for fragment in required_fragments if fragment not in readme]
    if missing_fragments:
        fail(
            "[readme] audit summary is stale or incomplete: "
            + ", ".join(repr(fragment) for fragment in missing_fragments),
            errors,
        )


def main() -> int:
    configure_output_encoding()
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "app_data.json")
    if not path.exists():
        print(f"ERROR: file not found: {path}")
        return 2

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: invalid JSON in {path}: {exc}")
        return 2

    errors: list[str] = []
    warnings: list[str] = []
    entity_index = build_entity_index(data)

    validate_schema(data, errors, warnings)
    validate_against_json_schema(data, errors, warnings)
    validate_corpus(data, errors, warnings)
    validate_duplicates(data, errors, warnings)
    validate_suspicious_heads(data, warnings)
    validate_editorial_flags(data, errors, warnings)
    validate_sources(data, errors)
    validate_pages(data, errors, warnings)
    validate_contexts(data, errors)
    validate_chapters(data, errors)
    validate_edges(data, entity_index, errors)
    validate_cross_links(data, entity_index, errors)
    validate_markdown_exports(path, errors, warnings)
    validate_manual_audit_queue(path, errors, warnings)
    validate_context_entry_pack(path, errors)
    validate_readme_audit_summary(path, errors)

    print("validate_content.py report")
    print(f"- file: {path}")
    print(f"- errors: {len(errors)}")
    print(f"- warnings: {len(warnings)}")

    if warnings:
        print("\nWarnings:")
        for w in warnings[:100]:
            print(f"  - {w}")

    if errors:
        print("\nErrors:")
        for e in errors[:200]:
            print(f"  - {e}")
        return 1

    print("\nOK: content validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
