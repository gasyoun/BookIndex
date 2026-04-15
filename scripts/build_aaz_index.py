#!/usr/bin/env python3
"""Build standalone aaz-index.html from template + app JS + embedded JSON data."""

from __future__ import annotations

import argparse
from pathlib import Path


def build(data_path: Path, js_path: Path, template_path: Path, out_path: Path) -> None:
    data_str = data_path.read_text(encoding="utf-8")
    js = js_path.read_text(encoding="utf-8")
    tpl = template_path.read_text(encoding="utf-8")
    escaped = (
        data_str.replace("\\", "\\\\")
        .replace("`", "\\`")
        .replace("${", "\\${")
    )
    html = tpl.replace("__APP_SCRIPT__", js.replace("__APP_DATA_STRING__", "`" + escaped + "`"))
    out_path.write_text(html, encoding="utf-8-sig")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build standalone aaz-index.html")
    parser.add_argument("--data", default="app_data.json", help="Path to app_data.json")
    parser.add_argument("--js", default="v3_app.js", help="Path to v3_app.js")
    parser.add_argument("--template", default="v3_template.html", help="Path to v3_template.html")
    parser.add_argument("--out", default="aaz-index.html", help="Output HTML path")
    args = parser.parse_args()

    build(
        data_path=Path(args.data),
        js_path=Path(args.js),
        template_path=Path(args.template),
        out_path=Path(args.out),
    )
    print(f"OK: built {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

