#!/usr/bin/env python3
"""Build standalone aaz-index.html from template + app JS + embedded JSON data."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from app_data_modules import assemble_from_modules, canonical_json_text


def compute_build_id(data_str: str, js: str, tpl: str) -> str:
    digest = hashlib.sha1()
    digest.update(data_str.encode("utf-8"))
    digest.update(b"\0")
    digest.update(js.encode("utf-8"))
    digest.update(b"\0")
    digest.update(tpl.encode("utf-8"))
    return digest.hexdigest()[:12]


def escape_json_for_html_script(json_text: str) -> str:
    """Escape JSON for safe embedding inside <script type="application/json">."""
    return (
        json_text
        .replace("</script", "<\\/script")
        .replace("<!--", "<\\!--")
    )


def build(
    data_path: Path,
    js_path: Path,
    template_path: Path,
    out_path: Path,
    build_id: str | None = None,
    modules_dir: Path | None = None,
) -> str:
    if modules_dir is not None:
        data_obj = assemble_from_modules(modules_dir)
        data_str = canonical_json_text(data_obj)
    else:
        data_obj = json.loads(data_path.read_text(encoding="utf-8"))
        if not isinstance(data_obj, dict):
            raise ValueError(f"JSON root must be object: {data_path}")
        data_str = canonical_json_text(data_obj)
    js = js_path.read_text(encoding="utf-8")
    tpl = template_path.read_text(encoding="utf-8")
    resolved_build_id = (build_id or "").strip() or compute_build_id(data_str, js, tpl)
    js = js.replace("__APP_BUILD_ID__", resolved_build_id)
    html = (
        tpl
        .replace("__APP_DATA_JSON__", escape_json_for_html_script(data_str))
        .replace("__APP_SCRIPT__", js)
    )
    out_path.write_text(html, encoding="utf-8-sig")
    return resolved_build_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Build standalone aaz-index.html")
    parser.add_argument("--data", default="app_data.json", help="Path to app_data.json")
    parser.add_argument("--modules-dir", default="", help="Optional directory with split app_data modules (overrides --data)")
    parser.add_argument("--js", default="v3_app.js", help="Path to v3_app.js")
    parser.add_argument("--template", default="v3_template.html", help="Path to v3_template.html")
    parser.add_argument("--out", default="aaz-index.html", help="Output HTML path")
    parser.add_argument("--build-id", default="", help="Optional explicit build id (default: deterministic hash of data+js+template)")
    args = parser.parse_args()

    build_id = build(
        data_path=Path(args.data),
        js_path=Path(args.js),
        template_path=Path(args.template),
        out_path=Path(args.out),
        build_id=args.build_id,
        modules_dir=Path(args.modules_dir) if str(args.modules_dir).strip() else None,
    )
    print(f"OK: built {args.out} (build_id={build_id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
