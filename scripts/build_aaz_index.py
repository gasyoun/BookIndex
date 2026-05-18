#!/usr/bin/env python3
"""Build standalone aaz-index.html from template + app JS + JSON module manifest."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

from app_data_modules import assemble_from_modules, canonical_json_text


def compute_build_id(data_str: str, js: str, tpl: str) -> str:
    def normalize(value: str) -> str:
        return value.replace("\r\n", "\n").replace("\r", "\n")

    digest = hashlib.sha1()
    digest.update(normalize(data_str).encode("utf-8"))
    digest.update(b"\0")
    digest.update(normalize(js).encode("utf-8"))
    digest.update(b"\0")
    digest.update(normalize(tpl).encode("utf-8"))
    return digest.hexdigest()[:12]


def escape_json_for_html_script(json_text: str) -> str:
    """Escape JSON for safe embedding inside <script type="application/json">."""
    return (
        json_text
        .replace("</script", "<\\/script")
        .replace("<!--", "<\\!--")
    )


def app_data_module_manifest_text(modules_dir: Path, build_id: str) -> str:
    manifest_path = modules_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError(f"JSON root must be object: {manifest_path}")
    modules = manifest.get("modules", [])
    if not isinstance(modules, list) or not modules:
        raise ValueError(f"App data module manifest is empty: {manifest_path}")

    enriched: list[dict[str, Any]] = []
    for item in modules:
        if not isinstance(item, dict):
            continue
        file_name = str(item.get("file", "")).strip()
        if not file_name:
            raise ValueError("App data module entry is missing file")
        text = (modules_dir / file_name).read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
        raw = text.encode("utf-8")
        enriched.append(
            {
                "file": file_name,
                "keys": item.get("keys") if isinstance(item.get("keys"), list) else [],
                "bytes": len(raw),
                "sha256": base64.b64encode(hashlib.sha256(raw).digest()).decode("ascii"),
            }
        )

    payload = {
        "mode": "modules",
        "version": manifest.get("version") or 1,
        "build_id": build_id,
        "base_url": "./data/modules/",
        "modules": enriched,
        "key_order": manifest.get("key_order") if isinstance(manifest.get("key_order"), list) else [],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def build(
    data_path: Path,
    js_path: Path,
    template_path: Path,
    out_path: Path,
    build_id: str | None = None,
    modules_dir: Path | None = None,
) -> str:
    if data_path.exists():
        data_obj = json.loads(data_path.read_text(encoding="utf-8"))
        if not isinstance(data_obj, dict):
            raise ValueError(f"JSON root must be object: {data_path}")
        data_str = canonical_json_text(data_obj)
    elif modules_dir is not None:
        data_obj = assemble_from_modules(modules_dir)
        data_str = canonical_json_text(data_obj)
    else:
        raise FileNotFoundError(f"Data file not found: {data_path}")
    js = js_path.read_text(encoding="utf-8")
    tpl = template_path.read_text(encoding="utf-8")
    resolved_build_id = (build_id or "").strip() or compute_build_id(data_str, js, tpl)
    js = js.replace("__APP_BUILD_ID__", resolved_build_id)
    app_data_payload = (
        app_data_module_manifest_text(modules_dir, resolved_build_id)
        if modules_dir is not None
        else data_str
    )
    html = (
        tpl
        .replace("__APP_DATA_JSON__", escape_json_for_html_script(app_data_payload))
        .replace("__APP_SCRIPT__", js)
    )
    out_path.write_text(html, encoding="utf-8-sig")
    return resolved_build_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Build standalone aaz-index.html")
    parser.add_argument("--data", default="app_data.json", help="Path to app_data.json")
    parser.add_argument("--modules-dir", default="data/modules", help="Directory with split app_data modules")
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
