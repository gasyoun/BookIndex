#!/usr/bin/env python3
"""Generate editorial content metrics for BookIndex app_data.json."""

from __future__ import annotations

import argparse
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
SORT_ORDER_KEYS = (
    "names",
    "toponyms",
    "ethnonyms",
    "languages",
    "lexicon",
    "subject_index",
)

DEFAULT_CORPUS_BOOK_ID = "zaliznyak-aaz-index"
DEFAULT_CORPUS_BOOK_TITLE = "Из жизни слов и языков"
DEFAULT_VIDEO_CATALOG_COUNT = 200


def configure_output_encoding() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def pct(part: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(part * 100.0 / total, 1)


def is_non_empty_list(value: Any) -> bool:
    return isinstance(value, list) and len(value) > 0


def iter_context_snippets(value: Any) -> tuple[int, int]:
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
        if context_pages > 0 or context_snippets > 0:
            with_contexts += 1
        context_pages_total += context_pages
        context_snippets_total += context_snippets

        sources = item.get("sources")
        if is_non_empty_list(sources):
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
        "duplicate_heads_top": duplicates[:10],
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
        "sort_inversions_count": 0,
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
        totals["sort_inversions_count"] += metrics["sort_order"]["inversions_count"]

    totals["coverage_pct"] = {
        "pages": pct(totals["items_with_pages"], totals["items_total"]),
        "contexts": pct(totals["items_with_contexts"], totals["items_total"]),
        "sources": pct(totals["items_with_sources"], totals["items_total"]),
        "editorial_flags": pct(totals["items_with_editorial_flags"], totals["items_total"]),
    }

    return {
        "source": source,
        "schema_version": data.get("schema_version"),
        "book_total_pages": total_pages,
        "corpus": collect_corpus_metrics(data),
        "markdown_exports": collect_markdown_export_metrics(source),
        "entities": entities,
        "totals": totals,
    }


def render_markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    lines = [
        "# Content Audit Report",
        "",
        f"- Source: `{report['source']}`",
        f"- Schema: `{report.get('schema_version')}`",
        f"- Book pages: `{report.get('book_total_pages')}`",
        f"- Corpus registry: `{report.get('corpus', {}).get('mode', 'runtime_default')}`",
        f"- Markdown exports: `{report.get('markdown_exports', {}).get('files_total', 0)}`",
        "",
        "## Totals",
        "",
        f"- Items: **{totals['items_total']}**",
        f"- With pages: {totals['items_with_pages']} ({totals['coverage_pct']['pages']}%)",
        f"- With contexts: {totals['items_with_contexts']} ({totals['coverage_pct']['contexts']}%)",
        f"- With sources: {totals['items_with_sources']} ({totals['coverage_pct']['sources']}%)",
        (
            f"- With editorial flags: {totals['items_with_editorial_flags']} "
            f"({totals['coverage_pct']['editorial_flags']}%)"
        ),
        f"- `verified=true`: {totals['items_verified_true']}",
        f"- `suspect=true`: {totals['items_suspect_true']}",
        f"- Context snippets: {totals['context_snippets_total']}",
        f"- Duplicate heads groups: {totals['duplicate_heads_count']}",
        f"- Sort inversions: {totals['sort_inversions_count']}",
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

    missing_markdown = report.get("markdown_exports", {}).get("missing_corpus_metadata_sample", [])
    if missing_markdown:
        lines.append("Missing corpus metadata sample:")
        lines.extend(f"- `{path}`" for path in missing_markdown)
        lines.append("")

    lines.extend([
        "## Entities",
        "",
        "| Entity | Items | Pages % | Contexts % | Sources % | Duplicates | Sort inversions |",
        "|---|---:|---:|---:|---:|---:|---:|",
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
            f"{metrics['duplicate_heads_count']} | {sort_inversions} |"
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


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate BookIndex content metrics report.")
    parser.add_argument("path", nargs="?", default="app_data.json", help="Path to app_data.json")
    parser.add_argument(
        "--format",
        choices=("md", "json"),
        default="md",
        help="Output format: markdown (md) or json",
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

    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(report), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
