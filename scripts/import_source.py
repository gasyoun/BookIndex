#!/usr/bin/env python3
"""
scripts/import_source.py — Import pipeline for new corpus sources.

Usage:
  python scripts/import_source.py --book-id <id> --validate
  python scripts/import_source.py --book-id <id> --merge
  python scripts/import_source.py --book-id <id> --status

Lifecycle:
  data/imports/<book_id>/draft.json  ->  validate  ->  merge into app_data.json
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMPORTS_DIR = ROOT / "data" / "imports"
APP_DATA = ROOT / "app_data.json"

ENTITY_KEYS = [
    "names", "toponyms", "ethnonyms", "languages",
    "lexicon", "lexicon_reverse", "lexicon_tech", "subject_index",
    "glossary", "chapters", "edges", "language_edges",
]


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def cmd_status(book_id: str) -> int:
    draft_path = IMPORTS_DIR / book_id / "draft.json"
    status_path = IMPORTS_DIR / book_id / "status.json"
    if not draft_path.exists():
        print(f"[ERROR] No draft found: {draft_path}", file=sys.stderr)
        return 1
    draft = load_json(draft_path)
    status = load_json(status_path) if status_path.exists() else {"status": draft.get("status", "draft")}
    print(f"book_id:  {book_id}")
    print(f"status:   {status.get('status', 'draft')}")
    print(f"title:    {draft.get('title', '?')}")
    print(f"author:   {draft.get('author', '?')}")
    print(f"year:     {draft.get('year', '?')}")
    data = draft.get("data", {})
    for key in ENTITY_KEYS:
        items = data.get(key, [])
        if items:
            print(f"  {key}: {len(items)}")
    return 0


def cmd_validate(book_id: str) -> int:
    draft_path = IMPORTS_DIR / book_id / "draft.json"
    if not draft_path.exists():
        print(f"[ERROR] No draft found: {draft_path}", file=sys.stderr)
        print(f"  -> Copy data/imports/_template/draft.json to {draft_path} and fill it in.")
        return 1

    draft = load_json(draft_path)
    errors = []

    # Required metadata fields
    for field in ("book_id", "title", "author", "year", "pages_total"):
        val = draft.get(field)
        if not val or val == "FILL_ME" or val == 0:
            errors.append(f"Missing or unfilled required field: {field!r}")

    if draft.get("book_id") != book_id:
        errors.append(f"book_id in draft ({draft.get('book_id')!r}) does not match --book-id ({book_id!r})")

    # Check for FILL_ME placeholders
    for key in ("book_id", "title", "author", "edition"):
        if draft.get(key) == "FILL_ME":
            errors.append(f"Field {key!r} still has placeholder value 'FILL_ME'")

    data = draft.get("data", {})
    if not isinstance(data, dict):
        errors.append("'data' field must be an object")
    else:
        total_items = sum(len(data.get(k, [])) for k in ENTITY_KEYS)
        if total_items == 0:
            errors.append("No entity data found. All lists in 'data' are empty.")
        else:
            # Validate entity items have required fields
            for key in ENTITY_KEYS:
                items = data.get(key, [])
                for i, item in enumerate(items):
                    if not isinstance(item, dict):
                        errors.append(f"{key}[{i}]: expected object, got {type(item).__name__}")
                    elif not item.get("head"):
                        errors.append(f"{key}[{i}]: missing 'head' field")

    # Check book_id not already in app_data corpus
    app = load_json(APP_DATA)
    existing_ids = [b.get("book_id") for b in (app.get("corpus") or {}).get("books", [])]
    if book_id in existing_ids:
        errors.append(f"book_id {book_id!r} already exists in app_data.json corpus.books")

    if errors:
        print(f"[FAIL] Validation failed for {book_id} ({len(errors)} errors):")
        for e in errors:
            print(f"  x {e}")
        return 1

    # Write status.json
    status_path = IMPORTS_DIR / book_id / "status.json"
    save_json(status_path, {"book_id": book_id, "status": "validated"})
    total_items = sum(len(data.get(k, [])) for k in ENTITY_KEYS)
    print(f"[OK] Validation passed for {book_id}")
    print(f"  entities: {total_items}")
    print(f"  status -> validated (written to {status_path})")
    return 0


def cmd_merge(book_id: str) -> int:
    draft_path = IMPORTS_DIR / book_id / "draft.json"
    status_path = IMPORTS_DIR / book_id / "status.json"

    if not draft_path.exists():
        print(f"[ERROR] No draft found: {draft_path}", file=sys.stderr)
        return 1

    status = load_json(status_path) if status_path.exists() else {}
    if status.get("status") != "validated":
        print(f"[ERROR] Book must be validated before merging. Run --validate first.", file=sys.stderr)
        return 1

    draft = load_json(draft_path)
    app = load_json(APP_DATA)

    # Add book to corpus registry
    corpus = app.setdefault("corpus", {})
    books = corpus.setdefault("books", [])
    if any(b.get("book_id") == book_id for b in books):
        print(f"[ERROR] book_id {book_id!r} already in corpus.books", file=sys.stderr)
        return 1

    book_meta = {k: draft[k] for k in ("book_id", "title", "author", "year", "edition",
                                        "status", "source_type", "pages_total",
                                        "default_route", "content_modules")
                 if k in draft}
    book_meta["status"] = "published"
    books.append(book_meta)

    # Merge entity data
    data = draft.get("data", {})
    for key in ENTITY_KEYS:
        items = data.get(key, [])
        if items:
            existing = app.setdefault(key, [])
            # Tag each item with source book_id
            for item in items:
                item.setdefault("_book_id", book_id)
            existing.extend(items)
            print(f"  merged {key}: +{len(items)} items")

    save_json(APP_DATA, app)

    # Update status
    save_json(status_path, {"book_id": book_id, "status": "published"})

    print(f"[OK] Merged {book_id} into app_data.json")
    print(f"  corpus.books now: {[b.get('book_id') for b in books]}")
    print(f"\nNext steps:")
    print(f"  1. python scripts/validate_content.py app_data.json")
    print(f"  2. npm run build")
    print(f"  3. npm run check")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="BookIndex import pipeline")
    parser.add_argument("--book-id", required=True, help="book_id to import")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--validate", action="store_true", help="Validate draft.json")
    group.add_argument("--merge", action="store_true", help="Merge validated draft into app_data.json")
    group.add_argument("--status", action="store_true", help="Show import status")
    args = parser.parse_args()

    if args.validate:
        return cmd_validate(args.book_id)
    elif args.merge:
        return cmd_merge(args.book_id)
    elif args.status:
        return cmd_status(args.book_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
