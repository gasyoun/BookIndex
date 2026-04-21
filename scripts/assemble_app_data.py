#!/usr/bin/env python3
"""Assemble app_data.json from data/modules/*.json."""

from __future__ import annotations

import argparse
from pathlib import Path

from app_data_modules import assemble_from_modules, canonical_json_text


def main() -> int:
    parser = argparse.ArgumentParser(description="Assemble app_data.json from module files")
    parser.add_argument("--modules-dir", default="data/modules", help="Directory with module JSON files")
    parser.add_argument("--out", default="app_data.json", help="Output app_data.json path")
    args = parser.parse_args()

    modules_dir = Path(args.modules_dir)
    out_path = Path(args.out)
    try:
        data = assemble_from_modules(modules_dir)
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1

    out_path.write_text(canonical_json_text(data), encoding="utf-8")
    print(f"OK: assembled {out_path} from {modules_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

