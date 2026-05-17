#!/usr/bin/env python3
"""Guard against invalid UTF-8 and obvious mojibake in core project files."""

from __future__ import annotations

import argparse
import pathlib
import re
import sys
from typing import Iterable


DEFAULT_FILES = [
    "v3_template.html",
    "v3_app.js",
    "app_data.json",
]

REQUIRED_PHRASES = {
    "v3_template.html": [
        "Content-Security-Policy",
        "leaflet.css",
        "__APP_DATA_JSON__",
    ],
    "v3_app.js": [
        "Книга в цифрах",
        "KWIC-конкорданс",
    ],
    "app_data.json": [
        '"schema_version"',
        '"featured_quote"',
    ],
}

SUSPICIOUS_PATTERNS = [
    re.compile(r"[Р РЎ][В°В±ВІВіВµВ¶В·С‘вЂ”вЂ“вЂў]"),
    re.compile(r"РІР‚[вЂњвЂќв„ўС™СњСћВ¦В§В¬В°В±В·]"),
]


def iter_targets(raw_files: Iterable[str]) -> list[pathlib.Path]:
    targets: list[pathlib.Path] = []
    for raw in raw_files:
        path = pathlib.Path(raw)
        if path.exists() and path.is_file():
            targets.append(path)
            continue
        print(f"[ERROR] File not found: {path}")
    return targets


def check_utf8(path: pathlib.Path) -> tuple[bool, str]:
    data = path.read_bytes()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        return False, f"invalid UTF-8 ({exc})"

    if "\x00" in text:
        return False, "contains NUL bytes"

    for phrase in REQUIRED_PHRASES.get(path.name, []):
        if phrase not in text:
            return False, f"missing required phrase: {phrase!r}"

    for pattern in SUSPICIOUS_PATTERNS:
        hit = pattern.search(text)
        if hit:
            snippet = text[max(0, hit.start() - 10) : min(len(text), hit.end() + 10)]
            return False, f"suspicious mojibake fragment near: {snippet!r}"

    return True, "ok"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check core files for UTF-8 integrity and obvious mojibake."
    )
    parser.add_argument("files", nargs="*", help="Files to validate")
    args = parser.parse_args()

    files = args.files if args.files else DEFAULT_FILES
    targets = iter_targets(files)
    if not targets:
        print("[ERROR] No valid files to check.")
        return 1

    failed = False
    for target in targets:
        ok, msg = check_utf8(target)
        if ok:
            print(f"[OK] {target}: {msg}")
        else:
            failed = True
            print(f"[FAIL] {target}: {msg}")

    if failed:
        print("[RESULT] Encoding check failed.")
        return 1

    print("[RESULT] Encoding check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
