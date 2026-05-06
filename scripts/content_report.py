#!/usr/bin/env python3
"""Generate editorial content metrics for BookIndex app_data.json."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import quote


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
ENTITY_ROUTE_KEYS = {
    "subject_index": "subject",
}
QUALITY_ENTITY_PRIORITY = {
    "lexicon": 0,
    "subject_index": 1,
    "lexicon_reverse": 2,
    "lexicon_tech": 3,
    "names": 4,
    "toponyms": 5,
    "ethnonyms": 6,
    "languages": 7,
}
CROSS_BOOK_ENTITY_PRIORITY = {
    "names": 0,
    "toponyms": 1,
    "ethnonyms": 2,
    "languages": 3,
    "subject_index": 4,
    "lexicon": 5,
    "lexicon_reverse": 6,
    "lexicon_tech": 7,
}
SORT_ORDER_KEYS = (
    "names",
    "toponyms",
    "ethnonyms",
    "languages",
    "lexicon",
    "subject_index",
)

DEFAULT_CORPUS_BOOK_ID = "mumintroll"
DEFAULT_CORPUS_BOOK_TITLE = "Из жизни слов и языков"
DEFAULT_VIDEO_CATALOG_COUNT = 200
V47_CONTEXT_BASELINE_PCT = 17.8
V47_CONTEXT_TARGET_MIN_PCT = 35.0
V47_CONTEXT_TARGET_MAX_PCT = 40.0
V47_QUEUE_TYPES_TOTAL = 8
V47_QUEUE_WORKFLOW_WEIGHT_PCT = 40.0
V47_CONTEXT_GROWTH_WEIGHT_PCT = 40.0
MANUAL_AUDIT_TERM_RE = re.compile(r"\*\*([^*]+)\*\*")


def configure_output_encoding() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def pct(part: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(part * 100.0 / total, 1)


def clamp_pct(value: float) -> float:
    return max(0.0, min(100.0, value))


def is_non_empty_list(value: Any) -> bool:
    return isinstance(value, list) and len(value) > 0


def iter_context_snippets(value: Any) -> tuple[int, int]:
    if isinstance(value, list):
        snippets = sum(1 for x in value if isinstance(x, str) and x.strip())
        return (1 if snippets else 0), snippets
    if not isinstance(value, dict):
        return 0, 0
    pages = 0
    snippets = 0
    for ctx in value.values():
        if not isinstance(ctx, list):
            continue
        pages += 1
        snippets += sum(1 for x in ctx if isinstance(x, str) and x.strip())
    return pages, snippets


def iter_occurrence_context_snippets(value: Any) -> tuple[int, int]:
    if not isinstance(value, dict):
        return 0, 0
    pages = 0
    snippets = 0
    for occurrence in value.values():
        if not isinstance(occurrence, dict):
            continue
        context_pages, context_snippets = iter_context_snippets(occurrence.get("contexts"))
        pages += context_pages
        snippets += context_snippets
    return pages, snippets


def sort_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.replace("ё", "е").replace("Ё", "Е"))
    without_marks = "".join(
        char
        for char in normalized
        if unicodedata.category(char) not in {"Mn", "Me", "Cf"}
    )
    return without_marks.casefold()


def collect_sort_order_metrics(items: list[dict[str, Any]], applicable: bool) -> dict[str, Any]:
    if not applicable:
        return {
            "applicable": False,
            "checked_pairs": 0,
            "inversions_count": 0,
            "inversions_sample": [],
        }

    heads = [str(item.get("head", "")).strip() for item in items if str(item.get("head", "")).strip()]
    inversions = []
    for index, (previous, current) in enumerate(zip(heads, heads[1:]), start=1):
        if sort_key(previous) > sort_key(current):
            inversions.append({
                "index": index,
                "previous": previous,
                "current": current,
            })
    return {
        "applicable": True,
        "checked_pairs": max(len(heads) - 1, 0),
        "inversions_count": len(inversions),
        "inversions": inversions,
        "inversions_sample": inversions[:10],
    }


def collect_entity_metrics(items: list[Any], *, sort_order_applicable: bool) -> dict[str, Any]:
    total = len(items)
    valid_items = [x for x in items if isinstance(x, dict)]

    heads = [str(x.get("head", "")).strip() for x in valid_items]
    non_empty_heads = [h for h in heads if h]
    duplicate_counts = Counter(non_empty_heads)
    duplicates = [
        {"head": head, "count": count}
        for head, count in sorted(duplicate_counts.items(), key=lambda x: (-x[1], x[0]))
        if count > 1
    ]
    suspicious_items = [
        item
        for item in valid_items
        if str(item.get("head", "")).strip().startswith("?")
        or "\ufffd" in str(item.get("head", "")).strip()
    ]
    suspicious_heads = [str(item.get("head", "")).strip() for item in suspicious_items]
    reviewed_suspicious_heads = [
        str(item.get("head", "")).strip()
        for item in suspicious_items
        if item.get("needs_review") is True
    ]
    unreviewed_suspicious_heads = [
        str(item.get("head", "")).strip()
        for item in suspicious_items
        if item.get("needs_review") is not True
    ]

    with_pages = 0
    unique_pages: set[int] = set()
    with_contexts = 0
    context_pages_total = 0
    context_snippets_total = 0
    with_sources = 0
    with_editorial_flags = 0
    with_verified_true = 0
    with_suspect_true = 0

    for item in valid_items:
        page_list = item.get("page_list")
        if is_non_empty_list(page_list):
            with_pages += 1
            for p in page_list:
                if isinstance(p, int):
                    unique_pages.add(p)

        context_pages, context_snippets = iter_context_snippets(item.get("contexts"))
        occurrence_context_pages, occurrence_context_snippets = iter_occurrence_context_snippets(item.get("occurrences"))
        if occurrence_context_snippets > context_snippets:
            context_pages, context_snippets = occurrence_context_pages, occurrence_context_snippets
        if context_pages > 0 or context_snippets > 0:
            with_contexts += 1
        context_pages_total += context_pages
        context_snippets_total += context_snippets

        sources = item.get("sources")
        occurrences = item.get("occurrences")
        if is_non_empty_list(sources) or isinstance(occurrences, dict) and bool(occurrences) or isinstance(item.get("book_id"), str):
            with_sources += 1

        editorial_flags = item.get("editorial_flags")
        if isinstance(editorial_flags, dict) and editorial_flags:
            with_editorial_flags += 1
            if editorial_flags.get("verified") is True:
                with_verified_true += 1
            if editorial_flags.get("suspect") is True:
                with_suspect_true += 1

    return {
        "items_total": total,
        "items_object_like": len(valid_items),
        "items_with_pages": with_pages,
        "items_with_contexts": with_contexts,
        "items_with_sources": with_sources,
        "items_with_editorial_flags": with_editorial_flags,
        "items_verified_true": with_verified_true,
        "items_suspect_true": with_suspect_true,
        "unique_pages_count": len(unique_pages),
        "context_pages_total": context_pages_total,
        "context_snippets_total": context_snippets_total,
        "duplicate_heads_count": len(duplicates),
        "duplicate_heads": duplicates,
        "duplicate_heads_top": duplicates[:10],
        "suspicious_heads_count": len(suspicious_heads),
        "reviewed_suspicious_heads_count": len(reviewed_suspicious_heads),
        "unreviewed_suspicious_heads_count": len(unreviewed_suspicious_heads),
        "suspicious_heads": suspicious_heads,
        "suspicious_heads_sample": suspicious_heads[:10],
        "unreviewed_suspicious_heads": unreviewed_suspicious_heads,
        "unreviewed_suspicious_heads_sample": unreviewed_suspicious_heads[:10],
        "sort_order": collect_sort_order_metrics(valid_items, sort_order_applicable),
        "coverage_pct": {
            "pages": pct(with_pages, total),
            "contexts": pct(with_contexts, total),
            "sources": pct(with_sources, total),
            "editorial_flags": pct(with_editorial_flags, total),
        },
    }


def collect_corpus_metrics(data: dict[str, Any]) -> dict[str, Any]:
    corpus = data.get("corpus")
    if not isinstance(corpus, dict):
        return {
            "present": False,
            "mode": "runtime_default",
            "active_book_id": DEFAULT_CORPUS_BOOK_ID,
            "active_book_title": DEFAULT_CORPUS_BOOK_TITLE,
            "books_total": 1,
            "source_types_total": 2,
            "planned_video_count": DEFAULT_VIDEO_CATALOG_COUNT,
        }

    books = corpus.get("books")
    source_types = corpus.get("source_types")
    book_items = [book for book in books if isinstance(book, dict)] if isinstance(books, list) else []
    source_type_items = [item for item in source_types if isinstance(item, dict)] if isinstance(source_types, list) else []
    planned_video = 0
    for item in source_type_items:
        if item.get("type") == "video_catalog":
            count = item.get("planned_count")
            planned_video = count if isinstance(count, int) and count >= 0 else 0
            break

    return {
        "present": True,
        "mode": "explicit",
        "active_book_id": corpus.get("active_book_id") if isinstance(corpus.get("active_book_id"), str) else None,
        "active_book_title": next(
            (
                str(book.get("title"))
                for book in book_items
                if isinstance(book.get("title"), str)
                and book.get("book_id") == corpus.get("active_book_id")
            ),
            None,
        ),
        "books_total": len(book_items),
        "source_types_total": len(source_type_items),
        "planned_video_count": planned_video,
    }


def collect_markdown_export_metrics(source: str) -> dict[str, Any]:
    source_path = Path(source)
    base_dir = source_path.parent if source_path.parent != Path("") else Path(".")
    content_dir = base_dir / "src" / "content"
    if not content_dir.is_dir():
        return {
            "present": False,
            "path": str(content_dir),
            "files_total": 0,
            "files_with_source": 0,
            "files_with_book_id": 0,
            "files_with_corpus_metadata": 0,
            "coverage_pct": {"source": 0.0, "book_id": 0.0, "corpus_metadata": 0.0},
            "missing_corpus_metadata_sample": [],
        }

    markdown_files = sorted(content_dir.glob("*.md"))
    files_with_source = 0
    files_with_book_id = 0
    files_with_corpus_metadata = 0
    missing_sample: list[str] = []

    for path in markdown_files:
        head = "".join(path.read_text(encoding="utf-8").splitlines(keepends=True)[:16])
        has_frontmatter = head.startswith("---\n")
        has_source = "\nsource: " in head
        has_book_id = "\nbook_id: " in head
        if has_source:
            files_with_source += 1
        if has_book_id:
            files_with_book_id += 1
        if has_frontmatter and has_source and has_book_id:
            files_with_corpus_metadata += 1
        elif len(missing_sample) < 10:
            missing_sample.append(str(path))

    total = len(markdown_files)
    return {
        "present": True,
        "path": str(content_dir),
        "files_total": total,
        "files_with_source": files_with_source,
        "files_with_book_id": files_with_book_id,
        "files_with_corpus_metadata": files_with_corpus_metadata,
        "coverage_pct": {
            "source": pct(files_with_source, total),
            "book_id": pct(files_with_book_id, total),
            "corpus_metadata": pct(files_with_corpus_metadata, total),
        },
        "missing_corpus_metadata_sample": missing_sample,
    }


def build_v47_progress(totals: dict[str, Any]) -> dict[str, Any]:
    coverage = float(totals.get("coverage_pct", {}).get("contexts", 0.0) or 0.0)
    effective_coverage = float(totals.get("coverage_pct", {}).get("effective_contexts", coverage) or coverage)
    context_target_min_progress = clamp_pct(round(effective_coverage * 100.0 / V47_CONTEXT_TARGET_MIN_PCT, 1))
    context_target_max_progress = clamp_pct(round(effective_coverage * 100.0 / V47_CONTEXT_TARGET_MAX_PCT, 1))
    context_growth_progress = 0.0
    remaining_growth = V47_CONTEXT_TARGET_MIN_PCT - V47_CONTEXT_BASELINE_PCT
    if remaining_growth > 0:
        context_growth_progress = clamp_pct(
            round((effective_coverage - V47_CONTEXT_BASELINE_PCT) * 100.0 / remaining_growth, 1)
        )
    queue_workflow_percent = 100.0
    phase_estimate = round(
        V47_QUEUE_WORKFLOW_WEIGHT_PCT * queue_workflow_percent / 100.0
        + V47_CONTEXT_GROWTH_WEIGHT_PCT * context_growth_progress / 100.0,
        1,
    )
    return {
        "phase": "v4.7",
        "phase_estimate_percent": phase_estimate,
        "phase_estimate_note": (
            "Queue workflow is complete; content cleanup and context expansion remain."
        ),
        "queue_workflow_percent": queue_workflow_percent,
        "queue_types_done": V47_QUEUE_TYPES_TOTAL,
        "queue_types_total": V47_QUEUE_TYPES_TOTAL,
        "context_coverage_percent": coverage,
        "effective_context_coverage_percent": effective_coverage,
        "inherited_context_items": totals.get("items_with_inherited_contexts", 0),
        "context_baseline_percent": V47_CONTEXT_BASELINE_PCT,
        "context_target_min_percent": V47_CONTEXT_TARGET_MIN_PCT,
        "context_target_max_percent": V47_CONTEXT_TARGET_MAX_PCT,
        "context_target_min_progress_percent": context_target_min_progress,
        "context_target_max_progress_percent": context_target_max_progress,
        "context_growth_progress_percent": context_growth_progress,
    }


def collect_manual_audit_metrics(source: str, data: dict[str, Any]) -> dict[str, Any]:
    source_path = Path(source)
    base_dir = source_path.parent if source_path.parent != Path("") else Path(".")
    index_errors_path = base_dir / "tests" / "index-errors.md"
    if not index_errors_path.is_file():
        return {
            "index_errors": {
                "present": False,
                "path": str(index_errors_path),
                "headings": 0,
                "table_rows": 0,
                "bullet_items": 0,
                "terms_total": 0,
                "terms_found": 0,
                "terms_missing": [],
            }
        }

    text = index_errors_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    terms = sorted(set(term.strip() for term in MANUAL_AUDIT_TERM_RE.findall(text) if term.strip()))
    heads_by_term: dict[str, list[str]] = {}
    all_heads: list[dict[str, str]] = []
    for key in ENTITY_KEYS:
        items = data.get(key, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            head = item.get("head")
            if not isinstance(head, str):
                continue
            all_heads.append({"section": key, "head": head})
            if head in terms:
                heads_by_term.setdefault(head, []).append(key)
    missing_terms = [term for term in terms if term not in heads_by_term]
    possible_matches: dict[str, list[dict[str, str]]] = {}
    for term in missing_terms:
        normalized_term = sort_key(term)
        matches = [
            head
            for head in all_heads
            if normalized_term
            and len(normalized_term) >= 4
            and len(sort_key(head["head"])) >= 4
            and (
                normalized_term in sort_key(head["head"])
                or sort_key(head["head"]) in normalized_term
            )
        ]
        if matches:
            possible_matches[term] = matches[:10]
    return {
        "index_errors": {
            "present": True,
            "path": str(index_errors_path),
            "headings": sum(1 for line in lines if line.startswith("#")),
            "table_rows": sum(1 for line in lines if line.startswith("|") and not line.startswith("| :")),
            "bullet_items": sum(1 for line in lines if line.lstrip().startswith("* ")),
            "terms_total": len(terms),
            "terms_found": len(heads_by_term),
            "terms_missing": missing_terms[:20],
            "terms_possible_matches": possible_matches,
            "terms_found_by_section": heads_by_term,
        }
    }


def build_report(data: dict[str, Any], source: str) -> dict[str, Any]:
    book_stats = data.get("book_stats", {})
    total_pages = book_stats.get("total_pages")
    if not isinstance(total_pages, int):
        total_pages = None

    entities: dict[str, Any] = {}
    totals = {
        "items_total": 0,
        "items_with_pages": 0,
        "items_with_contexts": 0,
        "items_with_sources": 0,
        "items_with_editorial_flags": 0,
        "items_verified_true": 0,
        "items_suspect_true": 0,
        "context_snippets_total": 0,
        "duplicate_heads_count": 0,
        "suspicious_heads_count": 0,
        "reviewed_suspicious_heads_count": 0,
        "unreviewed_suspicious_heads_count": 0,
        "sort_inversions_count": 0,
        "cross_book_duplicate_candidates_count": 0,
        "needs_page_verification_count": 0,
    }

    for key in ENTITY_KEYS:
        raw = data.get(key, [])
        items = raw if isinstance(raw, list) else []
        metrics = collect_entity_metrics(items, sort_order_applicable=key in SORT_ORDER_KEYS)
        entities[key] = metrics
        totals["items_total"] += metrics["items_total"]
        totals["items_with_pages"] += metrics["items_with_pages"]
        totals["items_with_contexts"] += metrics["items_with_contexts"]
        totals["items_with_sources"] += metrics["items_with_sources"]
        totals["items_with_editorial_flags"] += metrics["items_with_editorial_flags"]
        totals["items_verified_true"] += metrics["items_verified_true"]
        totals["items_suspect_true"] += metrics["items_suspect_true"]
        totals["context_snippets_total"] += metrics["context_snippets_total"]
        totals["duplicate_heads_count"] += metrics["duplicate_heads_count"]
        totals["suspicious_heads_count"] += metrics["suspicious_heads_count"]
        totals["reviewed_suspicious_heads_count"] += metrics["reviewed_suspicious_heads_count"]
        totals["unreviewed_suspicious_heads_count"] += metrics["unreviewed_suspicious_heads_count"]
        totals["sort_inversions_count"] += metrics["sort_order"]["inversions_count"]

    totals["cross_book_duplicate_candidates_count"] = count_cross_book_duplicate_candidates(data)
    totals["needs_page_verification_count"] = count_needs_page_verification(data)
    effective_contexts = count_effective_context_items(data)
    totals["items_with_effective_contexts"] = effective_contexts["effective"]
    totals["items_with_inherited_contexts"] = effective_contexts["inherited"]
    totals["coverage_pct"] = {
        "pages": pct(totals["items_with_pages"], totals["items_total"]),
        "contexts": pct(totals["items_with_contexts"], totals["items_total"]),
        "effective_contexts": pct(totals["items_with_effective_contexts"], totals["items_total"]),
        "sources": pct(totals["items_with_sources"], totals["items_total"]),
        "editorial_flags": pct(totals["items_with_editorial_flags"], totals["items_total"]),
    }
    progress = {
        "v47": build_v47_progress(totals),
    }

    return {
        "source": source,
        "schema_version": data.get("schema_version"),
        "book_total_pages": total_pages,
        "corpus": collect_corpus_metrics(data),
        "markdown_exports": collect_markdown_export_metrics(source),
        "manual_audits": collect_manual_audit_metrics(source, data),
        "entities": entities,
        "totals": totals,
        "progress": progress,
    }


def render_markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    v47 = report.get("progress", {}).get("v47", {})
    lines = [
        "# Content Audit Report",
        "",
        f"- Source: `{report['source']}`",
        f"- Schema: `{report.get('schema_version')}`",
        f"- Book pages: `{report.get('book_total_pages')}`",
        f"- Corpus registry: `{report.get('corpus', {}).get('mode', 'runtime_default')}`",
        f"- Markdown exports: `{report.get('markdown_exports', {}).get('files_total', 0)}`",
        f"- Manual index audit: `{report.get('manual_audits', {}).get('index_errors', {}).get('path', 'tests/index-errors.md')}`",
        "",
        "## Totals",
        "",
        f"- Items: **{totals['items_total']}**",
        f"- With pages: {totals['items_with_pages']} ({totals['coverage_pct']['pages']}%)",
        f"- With contexts: {totals['items_with_contexts']} ({totals['coverage_pct']['contexts']}%)",
        (
            f"- With effective contexts: {totals['items_with_effective_contexts']} "
            f"({totals['coverage_pct']['effective_contexts']}%; "
            f"{totals['items_with_inherited_contexts']} inherited)"
        ),
        f"- With sources: {totals['items_with_sources']} ({totals['coverage_pct']['sources']}%)",
        (
            f"- With editorial flags: {totals['items_with_editorial_flags']} "
            f"({totals['coverage_pct']['editorial_flags']}%)"
        ),
        f"- `verified=true`: {totals['items_verified_true']}",
        f"- `suspect=true`: {totals['items_suspect_true']}",
        f"- Context snippets: {totals['context_snippets_total']}",
        f"- Duplicate heads groups: {totals['duplicate_heads_count']}",
        f"- Cross-book duplicate candidates: {totals['cross_book_duplicate_candidates_count']}",
        f"- Needs page verification: {totals['needs_page_verification_count']}",
        f"- Suspicious heads: {totals['suspicious_heads_count']}",
        f"- Reviewed suspicious heads: {totals['reviewed_suspicious_heads_count']}",
        f"- Unreviewed suspicious heads: {totals['unreviewed_suspicious_heads_count']}",
        f"- Sort inversions: {totals['sort_inversions_count']}",
        "",
        "## v4.7 Progress",
        "",
        f"- Phase estimate: ~{v47.get('phase_estimate_percent', 0)}%",
        (
            f"- Queue workflow: {v47.get('queue_workflow_percent', 0)}% "
            f"({v47.get('queue_types_done', 0)}/{v47.get('queue_types_total', 0)} queue types)"
        ),
        (
            f"- Context coverage: {v47.get('context_coverage_percent', 0)}% "
            f"direct / {v47.get('effective_context_coverage_percent', 0)}% effective "
            f"(target {v47.get('context_target_min_percent', 0)}-{v47.get('context_target_max_percent', 0)}%)"
        ),
        (
            f"- Context target progress: {v47.get('context_target_min_progress_percent', 0)}% toward "
            f"{v47.get('context_target_min_percent', 0)}%; "
            f"{v47.get('context_growth_progress_percent', 0)}% growth since v4.7 baseline"
        ),
        "",
        "## Corpus",
        "",
        f"- Active book: `{report.get('corpus', {}).get('active_book_id') or 'runtime default'}`",
        f"- Active title: `{report.get('corpus', {}).get('active_book_title') or 'runtime default'}`",
        f"- Books: {report.get('corpus', {}).get('books_total', 0)}",
        f"- Source types: {report.get('corpus', {}).get('source_types_total', 0)}",
        f"- Planned videos: {report.get('corpus', {}).get('planned_video_count', 0)}",
        "",
        "## Markdown Exports",
        "",
        f"- Path: `{report.get('markdown_exports', {}).get('path', 'src/content')}`",
        f"- Files: {report.get('markdown_exports', {}).get('files_total', 0)}",
        (
            f"- With source: {report.get('markdown_exports', {}).get('files_with_source', 0)} "
            f"({report.get('markdown_exports', {}).get('coverage_pct', {}).get('source', 0.0)}%)"
        ),
        (
            f"- With book_id: {report.get('markdown_exports', {}).get('files_with_book_id', 0)} "
            f"({report.get('markdown_exports', {}).get('coverage_pct', {}).get('book_id', 0.0)}%)"
        ),
        (
            f"- With corpus metadata: {report.get('markdown_exports', {}).get('files_with_corpus_metadata', 0)} "
            f"({report.get('markdown_exports', {}).get('coverage_pct', {}).get('corpus_metadata', 0.0)}%)"
        ),
        "",
    ]

    index_errors = report.get("manual_audits", {}).get("index_errors", {})
    lines.extend([
        "## Manual Audits",
        "",
        f"- Index errors file: `{index_errors.get('path', 'tests/index-errors.md')}`",
        f"- Present: {index_errors.get('present', False)}",
        f"- Headings: {index_errors.get('headings', 0)}",
        f"- Table rows: {index_errors.get('table_rows', 0)}",
        f"- Bullet items: {index_errors.get('bullet_items', 0)}",
        f"- Terms found: {index_errors.get('terms_found', 0)} / {index_errors.get('terms_total', 0)}",
        "",
    ])
    missing_manual_terms = index_errors.get("terms_missing", [])
    if missing_manual_terms:
        lines.append("Manual audit terms missing from current heads:")
        lines.extend(f"- `{term}`" for term in missing_manual_terms)
        lines.append("")
    possible_manual_matches = index_errors.get("terms_possible_matches", {})
    if possible_manual_matches:
        lines.append("Possible matches for missing manual audit terms:")
        for term, matches in possible_manual_matches.items():
            formatted = ", ".join(
                f"`{match['head']}` ({match['section']})"
                for match in matches[:5]
            )
            lines.append(f"- `{term}`: {formatted}")
        lines.append("")

    missing_markdown = report.get("markdown_exports", {}).get("missing_corpus_metadata_sample", [])
    if missing_markdown:
        lines.append("Missing corpus metadata sample:")
        lines.extend(f"- `{path}`" for path in missing_markdown)
        lines.append("")

    lines.extend([
        "## Entities",
        "",
        "| Entity | Items | Pages % | Contexts % | Sources % | Duplicates | Suspicious heads | Unreviewed suspicious | Sort inversions |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ])

    for key, metrics in report["entities"].items():
        sort_inversions = (
            str(metrics["sort_order"]["inversions_count"])
            if metrics["sort_order"].get("applicable")
            else "n/a"
        )
        lines.append(
            f"| `{key}` | {metrics['items_total']} | {metrics['coverage_pct']['pages']} | "
            f"{metrics['coverage_pct']['contexts']} | {metrics['coverage_pct']['sources']} | "
            f"{metrics['duplicate_heads_count']} | {metrics['suspicious_heads_count']} | "
            f"{metrics['unreviewed_suspicious_heads_count']} | {sort_inversions} |"
        )

    lines.append("")
    lines.append("## Duplicate Heads (Top)")
    lines.append("")
    for key, metrics in report["entities"].items():
        top = metrics.get("duplicate_heads_top", [])
        if not top:
            continue
        head_items = ", ".join(f"`{item['head']}` x{item['count']}" for item in top[:5])
        lines.append(f"- `{key}`: {head_items}")
    if lines[-1] == "":
        lines.append("- none")

    lines.append("")
    lines.append("## Suspicious Heads (Sample)")
    lines.append("")
    has_suspicious_heads = False
    for key, metrics in report["entities"].items():
        sample = metrics.get("suspicious_heads_sample", [])
        if not sample:
            continue
        has_suspicious_heads = True
        formatted = ", ".join(f"`{head}`" for head in sample[:10])
        lines.append(f"- `{key}`: {formatted}")
    if not has_suspicious_heads:
        lines.append("- none")

    lines.append("")
    lines.append("## Sort Inversions (Sample)")
    lines.append("")
    has_sort_inversions = False
    for key, metrics in report["entities"].items():
        sample = metrics.get("sort_order", {}).get("inversions_sample", [])
        if not sample:
            continue
        has_sort_inversions = True
        formatted = ", ".join(
            f"`{item['previous']}` > `{item['current']}`"
            for item in sample[:5]
        )
        lines.append(f"- `{key}`: {formatted}")
    if not has_sort_inversions:
        lines.append("- none")

    return "\n".join(lines) + "\n"


def build_manual_audit_queue(report: dict[str, Any]) -> dict[str, Any]:
    entities = report.get("entities", {})
    suspicious = {
        key: metrics.get("suspicious_heads", [])
        for key, metrics in entities.items()
        if metrics.get("suspicious_heads")
    }
    sort_inversions = {
        key: metrics.get("sort_order", {}).get("inversions_sample", [])
        for key, metrics in entities.items()
        if metrics.get("sort_order", {}).get("inversions_sample")
    }
    return {
        "schema_version": 1,
        "source": report.get("source"),
        "manual_audit": report.get("manual_audits", {}).get("index_errors", {}),
        "totals": {
            "duplicate_heads_count": report.get("totals", {}).get("duplicate_heads_count", 0),
            "suspicious_heads_count": report.get("totals", {}).get("suspicious_heads_count", 0),
            "reviewed_suspicious_heads_count": report.get("totals", {}).get("reviewed_suspicious_heads_count", 0),
            "unreviewed_suspicious_heads_count": report.get("totals", {}).get("unreviewed_suspicious_heads_count", 0),
            "sort_inversions_count": report.get("totals", {}).get("sort_inversions_count", 0),
        },
        "suspicious_heads": suspicious,
        "sort_inversions": sort_inversions,
    }


def get_item_head(item: dict[str, Any]) -> str:
    return str(item.get("head", "")).strip()


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


def summarize_pages(pages: list[int]) -> str:
    if not pages:
        return "0 pages"
    if len(pages) <= 6:
        return ", ".join(str(page) for page in pages)
    first = ", ".join(str(page) for page in pages[:5])
    return f"{len(pages)} pages; first: {first}"


def page_verification_details(item: dict[str, Any]) -> dict[str, Any] | None:
    page_list = get_item_pages(item)
    occurrence_pages = get_occurrence_pages(item)
    context_pages = get_context_page_keys(item.get("contexts"))
    page_set = set(page_list)
    evidence_pages = set(occurrence_pages) | set(context_pages)
    if not evidence_pages:
        return None
    missing_from_page_list = sorted(evidence_pages - page_set)
    missing_from_evidence = sorted(page_set - set(occurrence_pages)) if occurrence_pages else []
    if not missing_from_page_list and not missing_from_evidence:
        return None
    return {
        "page_list": page_list,
        "occurrence_pages": occurrence_pages,
        "context_pages": context_pages,
        "missing_from_page_list": missing_from_page_list,
        "missing_from_evidence": missing_from_evidence,
        "page_list_summary": summarize_pages(page_list),
        "occurrence_pages_summary": summarize_pages(occurrence_pages),
        "context_pages_summary": summarize_pages(context_pages),
        "missing_from_page_list_summary": summarize_pages(missing_from_page_list),
        "missing_from_evidence_summary": summarize_pages(missing_from_evidence),
        "count": len(set(missing_from_page_list) | set(missing_from_evidence)),
    }


def item_context_counts(item: dict[str, Any]) -> dict[str, int]:
    direct_pages, direct_snippets = iter_context_snippets(item.get("contexts"))
    occurrence_pages, occurrence_snippets = iter_occurrence_context_snippets(item.get("occurrences"))
    return {
        "direct_pages": direct_pages,
        "direct_snippets": direct_snippets,
        "occurrence_pages": occurrence_pages,
        "occurrence_snippets": occurrence_snippets,
        "pages": max(direct_pages, occurrence_pages),
        "snippets": max(direct_snippets, occurrence_snippets),
    }


def build_inherited_context_index(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    lexicon = data.get("lexicon", [])
    valid_items = [item for item in lexicon if isinstance(item, dict)] if isinstance(lexicon, list) else []
    for item in valid_items:
        head = get_item_head(item)
        key = duplicate_candidate_head_key(head)
        if not key:
            continue
        contexts = item_context_counts(item)
        if contexts["snippets"] <= 0:
            continue
        existing = index.get(key)
        if existing and existing["context_snippets"] >= contexts["snippets"]:
            continue
        index[key] = {
            "entity": "lexicon",
            "head": head,
            "canonical_id": item.get("canonical_id") if isinstance(item.get("canonical_id"), str) else "",
            "context_pages": contexts["pages"],
            "context_snippets": contexts["snippets"],
            "route": build_item_route("lexicon", head),
        }
    return index


def effective_context_info(
    entity: str,
    item: dict[str, Any],
    inherited_context_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    direct = item_context_counts(item)
    out: dict[str, Any] = {
        **direct,
        "effective_pages": direct["pages"],
        "effective_snippets": direct["snippets"],
        "inherited": False,
    }
    if direct["snippets"] > 0 or entity != "lexicon_reverse":
        return out
    inherited = inherited_context_index.get(duplicate_candidate_head_key(get_item_head(item)))
    if not inherited:
        return out
    out.update({
        "effective_pages": inherited["context_pages"],
        "effective_snippets": inherited["context_snippets"],
        "inherited": True,
        "inherited_context_from": {
            "entity": inherited["entity"],
            "head": inherited["head"],
            "canonical_id": inherited["canonical_id"],
            "route": inherited["route"],
        },
    })
    return out


def item_has_source(item: dict[str, Any]) -> bool:
    return (
        is_non_empty_list(item.get("sources"))
        or isinstance(item.get("occurrences"), dict) and bool(item.get("occurrences"))
        or isinstance(item.get("book_id"), str)
    )


def build_item_route(entity: str, head: str) -> str | None:
    if not head:
        return None
    route_entity = ENTITY_ROUTE_KEYS.get(entity, entity)
    encoded_head = quote(head, safe="")
    return f"#v4/{route_entity}/list/item/{route_entity}/{encoded_head}"


def quality_entity_sort_key(entity: str, head: str = "") -> tuple[int, str, str]:
    return (QUALITY_ENTITY_PRIORITY.get(entity, 99), sort_key(head), entity)


def cross_book_entity_sort_key(entity: str, head: str = "") -> tuple[int, str, str]:
    return (CROSS_BOOK_ENTITY_PRIORITY.get(entity, 99), sort_key(head), entity)


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


def count_cross_book_duplicate_candidates(data: dict[str, Any]) -> int:
    by_head: dict[str, set[str]] = {}
    for entity in ENTITY_KEYS:
        items = data.get(entity, [])
        valid_items = [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []
        for item in valid_items:
            head = get_item_head(item)
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
    for entity in ENTITY_KEYS:
        items = data.get(entity, [])
        valid_items = [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []
        total += sum(1 for item in valid_items if page_verification_details(item))
    return total


def count_effective_context_items(data: dict[str, Any]) -> dict[str, int]:
    inherited_context_index = build_inherited_context_index(data)
    direct = 0
    effective = 0
    inherited = 0
    for entity in ENTITY_KEYS:
        items = data.get(entity, [])
        valid_items = [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []
        for item in valid_items:
            direct_counts = item_context_counts(item)
            if direct_counts["snippets"] > 0:
                direct += 1
            info = effective_context_info(entity, item, inherited_context_index)
            if info["effective_snippets"] > 0:
                effective += 1
            if info.get("inherited"):
                inherited += 1
    return {
        "direct": direct,
        "effective": effective,
        "inherited": inherited,
    }


CONTEXT_PRIORITY_BASE = {
    "lexicon": 100,
    "subject_index": 90,
    "lexicon_reverse": 80,
    "lexicon_tech": 70,
    "names": 45,
    "toponyms": 40,
    "ethnonyms": 40,
    "languages": 40,
}


def context_priority_info(entity: str, item: dict[str, Any]) -> dict[str, Any]:
    pages = get_item_pages(item)
    page_bonus = min(len(pages), 20)
    discussed_bonus = 5 if item.get("discussed") is True else 0
    review_bonus = 5 if item.get("needs_review") is True else 0
    score = CONTEXT_PRIORITY_BASE.get(entity, 20) + page_bonus + discussed_bonus + review_bonus
    if score >= 105:
        tier = "high"
    elif score >= 80:
        tier = "medium"
    else:
        tier = "low"
    if entity == "lexicon":
        reason = "v4.7 top priority: lexicon context expansion."
    elif entity == "subject_index":
        reason = "v4.7 top priority: subject_index context expansion."
    elif entity == "lexicon_reverse":
        reason = "v4.7 priority: reverse index entries not covered by lexicon inheritance."
    elif entity == "lexicon_tech":
        reason = "v4.7 priority: technical/OCR term needing source verification."
    else:
        reason = "Lower-priority context gap after lexicon and subject work."
    return {
        "priority_score": score,
        "priority_tier": tier,
        "priority_reason": reason,
        "priority_pages_count": len(pages),
    }


def build_quality_item(
    *,
    entity: str,
    item: dict[str, Any],
    reason: str,
    queue: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    head = get_item_head(item)
    pages = get_item_pages(item)
    contexts = item_context_counts(item)
    out: dict[str, Any] = {
        "queue": queue,
        "entity": entity,
        "head": head,
        "reason": reason,
        "pages_count": len(pages),
        "pages_summary": summarize_pages(pages),
        "context_snippets": contexts["snippets"],
        "source_present": item_has_source(item),
        "route": build_item_route(entity, head),
    }
    canonical_id = item.get("canonical_id")
    if isinstance(canonical_id, str) and canonical_id:
        out["canonical_id"] = canonical_id
    if extra:
        out.update(extra)
    return out


def build_quality_queue(data: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    inherited_context_index = build_inherited_context_index(data)
    queues: dict[str, list[dict[str, Any]]] = {
        "missing_context": [],
        "missing_pages": [],
        "missing_source": [],
        "duplicate_heads": [],
        "cross_book_duplicate_candidates": [],
        "suspicious_heads": [],
        "sort_inversions": [],
        "needs_page_verification": [],
    }

    valid_by_entity: dict[str, list[dict[str, Any]]] = {}
    cross_book_candidates: dict[str, list[dict[str, Any]]] = {}
    for entity in ENTITY_KEYS:
        items = data.get(entity, [])
        valid_items = [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []
        valid_by_entity[entity] = valid_items

        by_head: dict[str, list[dict[str, Any]]] = {}
        for item in valid_items:
            head = get_item_head(item)
            if not head:
                continue
            by_head.setdefault(head, []).append(item)
            candidate_key = duplicate_candidate_head_key(head)
            if candidate_key:
                cross_book_candidates.setdefault(candidate_key, []).append({
                    "entity": entity,
                    "head": head,
                    "item": item,
                    "books": get_item_books(item),
                })

            pages = get_item_pages(item)
            contexts = effective_context_info(entity, item, inherited_context_index)
            if not pages:
                queues["missing_pages"].append(build_quality_item(
                    entity=entity,
                    item=item,
                    queue="missing_pages",
                    reason="No page_list entries.",
                ))
            if contexts["effective_snippets"] <= 0:
                queues["missing_context"].append(build_quality_item(
                    entity=entity,
                    item=item,
                    queue="missing_context",
                    reason="No direct or occurrence context snippets.",
                    extra=context_priority_info(entity, item),
                ))
            if not item_has_source(item):
                queues["missing_source"].append(build_quality_item(
                    entity=entity,
                    item=item,
                    queue="missing_source",
                    reason="No sources, occurrences, or book_id.",
                ))
            page_details = page_verification_details(item)
            if page_details:
                queues["needs_page_verification"].append(build_quality_item(
                    entity=entity,
                    item=item,
                    queue="needs_page_verification",
                    reason="page_list differs from occurrence/context page evidence.",
                    extra=page_details,
                ))
            if head.startswith("?") or "\ufffd" in head:
                queues["suspicious_heads"].append(build_quality_item(
                    entity=entity,
                    item=item,
                    queue="suspicious_heads",
                    reason="Head starts with '?' or contains replacement character.",
                    extra={"needs_review": item.get("needs_review") is True},
                ))

        for head, duplicates in by_head.items():
            if len(duplicates) <= 1:
                continue
            canonical_ids = sorted({
                str(item.get("canonical_id"))
                for item in duplicates
                if isinstance(item.get("canonical_id"), str) and item.get("canonical_id")
            })
            queues["duplicate_heads"].append({
                "queue": "duplicate_heads",
                "entity": entity,
                "head": head,
                "reason": "Same head appears more than once in this entity list.",
                "count": len(duplicates),
                "canonical_ids": canonical_ids,
                "pages_summary": summarize_pages(sorted({page for item in duplicates for page in get_item_pages(item)})),
                "route": build_item_route(entity, head),
            })

    for normalized_head, records in cross_book_candidates.items():
        books = sorted({
            book
            for record in records
            for book in record.get("books", [])
            if isinstance(book, str) and book
        })
        if len(books) <= 1:
            continue
        preferred = sorted(
            records,
            key=lambda record: cross_book_entity_sort_key(str(record.get("entity", "")), str(record.get("head", ""))),
        )[0]
        heads = sorted(
            {
                str(record.get("head", "")).strip()
                for record in records
                if str(record.get("head", "")).strip()
            },
            key=sort_key,
        )
        entities = sorted(
            {
                str(record.get("entity", "")).strip()
                for record in records
                if str(record.get("entity", "")).strip()
            },
            key=lambda entity: quality_entity_sort_key(entity),
        )
        canonical_ids = sorted({
            str(record["item"].get("canonical_id"))
            for record in records
            if isinstance(record.get("item"), dict)
            and isinstance(record["item"].get("canonical_id"), str)
            and record["item"].get("canonical_id")
        })
        pages = sorted({
            page
            for record in records
            if isinstance(record.get("item"), dict)
            for page in get_item_pages(record["item"])
        })
        preferred_entity = str(preferred.get("entity", ""))
        preferred_head = str(preferred.get("head", ""))
        item: dict[str, Any] = {
            "queue": "cross_book_duplicate_candidates",
            "entity": preferred_entity,
            "head": preferred_head,
            "normalized_head": normalized_head,
            "reason": "Same normalized head appears in multiple books; review canonical links or aliases.",
            "count": len(records),
            "books": books,
            "entities": entities,
            "heads": heads,
            "canonical_ids": canonical_ids,
            "pages_count": len(pages),
            "pages_summary": summarize_pages(pages),
            "route": build_item_route(preferred_entity, preferred_head),
        }
        preferred_item = preferred.get("item")
        if isinstance(preferred_item, dict):
            canonical_id = preferred_item.get("canonical_id")
            if isinstance(canonical_id, str) and canonical_id:
                item["canonical_id"] = canonical_id
        queues["cross_book_duplicate_candidates"].append(item)

    for entity in SORT_ORDER_KEYS:
        valid_items = valid_by_entity.get(entity, [])
        inversions = collect_sort_order_metrics(valid_items, entity in SORT_ORDER_KEYS).get("inversions", [])
        by_head = {get_item_head(item): item for item in valid_items if get_item_head(item)}
        for inversion in inversions:
            current = str(inversion.get("current", "")).strip()
            item = by_head.get(current, {"head": current})
            queues["sort_inversions"].append(build_quality_item(
                entity=entity,
                item=item,
                queue="sort_inversions",
                reason=f"Sort order inversion after `{inversion.get('previous', '')}`.",
                extra={
                    "index": inversion.get("index"),
                    "previous": inversion.get("previous"),
                    "current": current,
                },
            ))

    for key, items in queues.items():
        if key == "missing_context":
            items.sort(key=lambda item: (
                -int(item.get("priority_score", 0)),
                *quality_entity_sort_key(str(item.get("entity", "")), str(item.get("head", ""))),
            ))
        else:
            items.sort(key=lambda item: quality_entity_sort_key(str(item.get("entity", "")), str(item.get("head", ""))))

    totals = dict(report.get("totals", {}))
    totals.update({
        "missing_context_count": len(queues["missing_context"]),
        "missing_pages_count": len(queues["missing_pages"]),
        "missing_source_count": len(queues["missing_source"]),
        "cross_book_duplicate_candidates_count": len(queues["cross_book_duplicate_candidates"]),
        "needs_page_verification_count": len(queues["needs_page_verification"]),
    })

    entities = report.get("entities", {})
    suspicious = {
        key: metrics.get("suspicious_heads", [])
        for key, metrics in entities.items()
        if metrics.get("suspicious_heads")
    }
    sort_inversions = {
        key: metrics.get("sort_order", {}).get("inversions", metrics.get("sort_order", {}).get("inversions_sample", []))
        for key, metrics in entities.items()
        if metrics.get("sort_order", {}).get("inversions_count")
    }
    duplicate_heads = {
        key: metrics.get("duplicate_heads", metrics.get("duplicate_heads_top", []))
        for key, metrics in entities.items()
        if metrics.get("duplicate_heads_count")
    }
    context_priority_top = queues["missing_context"][:25]

    return {
        "schema_version": 2,
        "source": report.get("source"),
        "manual_audit": report.get("manual_audits", {}).get("index_errors", {}),
        "progress": report.get("progress", {}),
        "totals": totals,
        "queue_order": [
            "duplicate_heads",
            "cross_book_duplicate_candidates",
            "suspicious_heads",
            "sort_inversions",
            "needs_page_verification",
            "missing_context",
            "missing_pages",
            "missing_source",
        ],
        "queues": {
            key: {
                "total": len(items),
                "items": items,
            }
            for key, items in queues.items()
        },
        "duplicate_heads": duplicate_heads,
        "suspicious_heads": suspicious,
        "sort_inversions": sort_inversions,
        "context_priority_top": context_priority_top,
    }


def build_context_entry_pack(quality_queue: dict[str, Any], limit: int = 25) -> dict[str, Any]:
    targets = []
    for rank, item in enumerate(quality_queue.get("context_priority_top", [])[:limit], start=1):
        target = {
            "rank": rank,
            "status": "needs_source_context",
            "entity": item.get("entity"),
            "head": item.get("head"),
            "canonical_id": item.get("canonical_id"),
            "route": item.get("route"),
            "pages_count": item.get("pages_count", 0),
            "pages_summary": item.get("pages_summary", "0 pages"),
            "priority_score": item.get("priority_score", 0),
            "priority_tier": item.get("priority_tier", "low"),
            "priority_reason": item.get("priority_reason", item.get("reason", "")),
            "source_present": item.get("source_present", False),
            "context_snippets": item.get("context_snippets", 0),
            "entry_fields": {
                "contexts": {},
                "source_notes": "",
                "verification_notes": "",
            },
        }
        targets.append({key: value for key, value in target.items() if value is not None})

    progress = quality_queue.get("progress", {}).get("v47", {})
    totals = quality_queue.get("totals", {})
    return {
        "schema_version": 1,
        "source": quality_queue.get("source"),
        "purpose": "Manual context-entry work pack for the highest-priority v4.7 missing_context items.",
        "selection_rule": "Top missing_context queue items sorted by priority_score, then entity priority and head.",
        "limit": limit,
        "target_count": len(targets),
        "progress": {
            "phase_estimate_percent": progress.get("phase_estimate_percent"),
            "direct_context_coverage_percent": progress.get("context_coverage_percent"),
            "effective_context_coverage_percent": progress.get("effective_context_coverage_percent"),
            "context_target_min_percent": progress.get("context_target_min_percent"),
            "context_target_max_percent": progress.get("context_target_max_percent"),
        },
        "queue_totals": {
            "missing_context_count": totals.get("missing_context_count"),
            "suspicious_heads_count": totals.get("suspicious_heads_count"),
            "sort_inversions_count": totals.get("sort_inversions_count"),
            "duplicate_heads_count": totals.get("duplicate_heads_count"),
            "cross_book_duplicate_candidates_count": totals.get("cross_book_duplicate_candidates_count"),
            "needs_page_verification_count": totals.get("needs_page_verification_count"),
        },
        "targets": targets,
    }


def render_context_entry_pack_markdown(pack: dict[str, Any]) -> str:
    progress = pack.get("progress", {})
    totals = pack.get("queue_totals", {})
    lines = [
        "# v4.7 Context Entry Pack",
        "",
        str(pack.get("purpose", "")),
        "",
        "## Metrics",
        "",
        f"- Source: `{pack.get('source', '')}`",
        f"- Targets: {pack.get('target_count', 0)} / {pack.get('limit', 0)}",
        f"- v4.7 estimate: ~{progress.get('phase_estimate_percent', 0)}%",
        (
            f"- Context coverage: {progress.get('direct_context_coverage_percent', 0)}% direct / "
            f"{progress.get('effective_context_coverage_percent', 0)}% effective"
        ),
        f"- Missing context queue: {totals.get('missing_context_count', 0)}",
        "",
        "## How To Use",
        "",
        "1. Open the route for one target.",
        "2. Check the listed source pages in the book.",
        "3. Add only source-confirmed snippets to `contexts` in `app_data.json`.",
        "4. Re-run `npm run content:audit` and validation before committing.",
        "",
        "## Targets",
        "",
    ]

    targets = pack.get("targets", [])
    if not isinstance(targets, list) or not targets:
        lines.append("_No context-entry targets._")
        lines.append("")
        return "\n".join(lines)

    for target in targets:
        if not isinstance(target, dict):
            continue
        rank = target.get("rank", "?")
        head = target.get("head", "(no head)")
        entity = target.get("entity", "")
        lines.extend([
            f"### {rank}. {head}",
            "",
            f"- Status: `{target.get('status', '')}`",
            f"- Entity: `{entity}`",
            f"- Canonical ID: `{target.get('canonical_id', '')}`",
            f"- Route: `{target.get('route', '')}`",
            f"- Pages: {target.get('pages_summary', '0 pages')}",
            f"- Priority: {target.get('priority_tier', '')} {target.get('priority_score', 0)}",
            f"- Reason: {target.get('priority_reason', '')}",
            "- Contexts to add: _pending source check_",
            "- Source notes: _pending_",
            "",
        ])
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate BookIndex content metrics report.")
    parser.add_argument("path", nargs="?", default="app_data.json", help="Path to app_data.json")
    parser.add_argument(
        "--format",
        choices=("md", "json"),
        default="md",
        help="Output format: markdown (md) or json",
    )
    parser.add_argument(
        "--write-manual-audit",
        metavar="PATH",
        help="Write compact manual audit queue JSON to PATH",
    )
    parser.add_argument(
        "--write-quality-queue",
        metavar="PATH",
        help="Write enriched actionable quality queue JSON to PATH",
    )
    parser.add_argument(
        "--write-context-pack",
        metavar="PATH",
        help="Write v4.7 manual context-entry pack JSON to PATH",
    )
    parser.add_argument(
        "--write-context-pack-md",
        metavar="PATH",
        help="Write v4.7 manual context-entry pack Markdown checklist to PATH",
    )
    parser.add_argument(
        "--context-pack-limit",
        type=int,
        default=25,
        help="Number of top missing-context targets to include in --write-context-pack",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    configure_output_encoding()
    args = parse_args(argv or sys.argv[1:])
    path = Path(args.path)
    if not path.exists():
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 2

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: invalid JSON in {path}: {exc}", file=sys.stderr)
        return 2

    report = build_report(data, str(path))

    if args.write_manual_audit:
        audit_path = Path(args.write_manual_audit)
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        audit_path.write_text(
            json.dumps(build_manual_audit_queue(report), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    quality_queue = None
    if args.write_quality_queue or args.write_context_pack or args.write_context_pack_md:
        quality_queue = build_quality_queue(data, report)

    if args.write_quality_queue:
        queue_path = Path(args.write_quality_queue)
        queue_path.parent.mkdir(parents=True, exist_ok=True)
        queue_path.write_text(
            json.dumps(quality_queue, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    if args.write_context_pack:
        pack_path = Path(args.write_context_pack)
        pack_path.parent.mkdir(parents=True, exist_ok=True)
        pack_path.write_text(
            json.dumps(
                build_context_entry_pack(quality_queue or build_quality_queue(data, report), args.context_pack_limit),
                ensure_ascii=False,
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
    if args.write_context_pack_md:
        pack_md_path = Path(args.write_context_pack_md)
        pack_md_path.parent.mkdir(parents=True, exist_ok=True)
        pack = build_context_entry_pack(quality_queue or build_quality_queue(data, report), args.context_pack_limit)
        pack_md_path.write_text(render_context_entry_pack_markdown(pack), encoding="utf-8")

    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(report), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
