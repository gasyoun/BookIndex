#!/usr/bin/env python3
"""Split monolithic app_data.json into logical module files."""

from __future__ import annotations

import argparse
from pathlib import Path

from app_data_modules import MANIFEST_FILENAME, read_json, split_into_modules


def main() -> int:
    parser = argparse.ArgumentParser(description="Split app_data.json into modules")
    parser.add_argument("input", nargs="?", default="app_data.json", help="Path to source app_data.json")
    parser.add_argument("--out-dir", default="data/modules", help="Output directory for module JSON files")
    args = parser.parse_args()

    src = Path(args.input)
    out_dir = Path(args.out_dir)
    if not src.exists():
        print(f"ERROR: source file not found: {src}")
        return 2

    data = read_json(src)
    manifest = split_into_modules(data, out_dir)
    print(f"OK: wrote {len(manifest.get('modules', []))} modules to {out_dir}")
    print(f"OK: manifest -> {out_dir / MANIFEST_FILENAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

