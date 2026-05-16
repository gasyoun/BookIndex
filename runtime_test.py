#!/usr/bin/env python3
"""Smoke guard for BookIndex build artifacts and infrastructure contracts."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent

REQUIRED_FILES = [
    "app_data.json",
    "index.html",
    "aaz-index.html",
    "v3_app.js",
    "manifest.webmanifest",
    "sw.js",
    "service-worker.js",
    "package.json",
    "vite.config.mjs",
]

TEXT_REQUIRED = {
    "index.html": [
        "Content-Security-Policy",
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        'rel="manifest" href="%BASE_URL%manifest.webmanifest"',
        '<script id="app-data-json" type="application/json">',
        '<script type="module" src="/src/entry.js"></script>',
        "navigator.serviceWorker.register('./sw.js')",
    ],
    "aaz-index.html": [
        "Content-Security-Policy",
        "default-src 'self'",
        'rel="manifest" href="./manifest.webmanifest"',
        '<script id="app-data-json" type="application/json">',
        "navigator.serviceWorker.register('./sw.js')",
        "Книга в цифрах",
        "KWIC-конкорданс",
    ],
    "v3_app.js": [
        "function safeUrl(url)",
        "function loadScriptOnce(src, attrs = {})",
        "Script URL is not allowed.",
        "Книга в цифрах",
        "KWIC-конкорданс",
    ],
    "sw.js": [
        "const CACHE_NAME = `bookindex-shell-${SW_BUILD_ID}`;",
        "const SHELL_ASSETS = [",
        "request.method !== 'GET'",
        "caches.match(OFFLINE_URL)",
        "request.destination === 'style'",
    ],
    "service-worker.js": [
        "request.method !== 'GET'",
        "sameOrigin",
        "allowedExternalStyle",
    ],
    "vite.config.mjs": [
        "viteSingleFile()",
        "injectAppDataPlugin()",
        "host: '127.0.0.1'",
        "allowedHosts: ['localhost', '127.0.0.1']",
        "cors: false",
    ],
}

TEXT_FORBIDDEN = {
    "index.html": [
        "script-src 'self' 'unsafe-inline' https://unpkg.com",
    ],
    "aaz-index.html": [
        "__APP_DATA_JSON__",
        "__APP_SCRIPT__",
        "script-src 'self' 'unsafe-inline' https://unpkg.com",
    ],
    "v3_template.html": [
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
        "script-src 'self' 'unsafe-inline' https://unpkg.com",
    ],
    "sw.js": [
        "request.destination === 'script'",
        "'cdn.jsdelivr.net'",
    ],
}

NODE_CHECK_FILES = [
    "v3_app.js",
    "scripts/build_aaz_index.mjs",
    "scripts/dev/static-server.mjs",
    "scripts/viz/build-viz-cache.js",
    "scripts/viz/viz-state.js",
]

ENTITY_KEYS = [
    "names",
    "toponyms",
    "ethnonyms",
    "languages",
    "lexicon",
    "lexicon_reverse",
    "lexicon_tech",
    "subject_index",
]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def load_json(path: str) -> Any:
    return json.loads(text(path))


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def resolve_node_binary() -> tuple[str | None, str | None]:
    candidates: list[str] = []
    env_node = os.environ.get("NODE_BINARY", "").strip()
    if env_node:
        candidates.append(env_node)

    for name in ("node", "nodejs"):
        found = shutil.which(name)
        if found:
            candidates.append(found)

    if os.name == "nt":
        candidates.extend(
            [
                r"C:\Program Files\nodejs\node.exe",
                r"C:\Program Files (x86)\nodejs\node.exe",
            ]
        )

    seen: set[str] = set()
    for candidate in candidates:
        candidate = os.path.expandvars(os.path.expanduser(candidate.strip('"')))
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        if os.path.isabs(candidate) and not os.path.exists(candidate):
            continue
        try:
            result = subprocess.run(
                [candidate, "--version"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=8,
            )
        except (OSError, subprocess.SubprocessError):
            continue
        if result.returncode == 0:
            return candidate, (result.stdout or result.stderr).strip()
    return None, None


def check_required_files() -> None:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).is_file()]
    if missing:
        fail("missing required files: " + ", ".join(missing))
    ok("required files are present")


def check_text_contracts() -> None:
    for path, needles in TEXT_REQUIRED.items():
        body = text(path)
        missing = [needle for needle in needles if needle not in body]
        if missing:
            fail(f"{path} missing required fragments: {missing!r}")
    for path, needles in TEXT_FORBIDDEN.items():
        file_path = ROOT / path
        if not file_path.exists():
            continue
        body = text(path)
        present = [needle for needle in needles if needle in body]
        if present:
            fail(f"{path} contains forbidden fragments: {present!r}")
    ok("HTML, JS, service-worker, and Vite contracts are current")


def check_package_contract() -> None:
    package = load_json("package.json")
    scripts = package.get("scripts", {})
    required_scripts = {
        "build": "npm run build:vite && node scripts/vite/postbuild-copy.mjs",
        "build:vite": "vite build",
        "check:js": None,
        "check:e2e": None,
        "check:e2e:smoke": None,
        "typecheck": None,
    }
    for name, expected in required_scripts.items():
        value = scripts.get(name)
        if not isinstance(value, str) or not value:
            fail(f"package.json scripts.{name} is missing")
        if expected is not None and value != expected:
            fail(f"package.json scripts.{name} drifted: {value!r}")
    ok("npm script contract is valid")


def check_manifest() -> None:
    manifest = load_json("manifest.webmanifest")
    if manifest.get("start_url") != "./aaz-index.html#v4/home/home":
        fail("manifest start_url drifted")
    if manifest.get("display") != "standalone":
        fail("manifest display must be standalone")
    icons = manifest.get("icons")
    if not isinstance(icons, list) or len(icons) < 2:
        fail("manifest must define at least two icons")
    ok("PWA manifest is valid")


def check_app_data() -> None:
    data = load_json("app_data.json")
    if data.get("schema_version") != 2:
        fail("app_data schema_version must be 2")
    corpus = data.get("corpus")
    if not isinstance(corpus, dict) or corpus.get("active_book_id") != "mumintroll":
        fail("app_data corpus.active_book_id must be mumintroll")
    book_stats = data.get("book_stats")
    if not isinstance(book_stats, dict) or int(book_stats.get("total_pages", 0)) < 400:
        fail("book_stats.total_pages is unexpectedly low")
    for key in ENTITY_KEYS:
        items = data.get(key)
        if not isinstance(items, list) or not items:
            fail(f"app_data.{key} must be a non-empty list")
    ok("app_data core shape is valid")


def check_node_syntax(node_bin: str) -> None:
    for path in NODE_CHECK_FILES:
        result = subprocess.run(
            [node_bin, "--check", str(ROOT / path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            print(result.stderr[:2000])
            fail(f"node --check failed for {path}")
    ok("Node syntax checks passed")


def main() -> int:
    print("=" * 60)
    print("BookIndex runtime infrastructure smoke")
    print("=" * 60)

    node_bin, node_version = resolve_node_binary()
    if not node_bin:
        fail("Node.js binary not found")
    print(f"[env] Node.js: {node_bin} ({node_version})")

    check_required_files()
    check_package_contract()
    check_text_contracts()
    check_manifest()
    check_app_data()
    check_node_syntax(node_bin)

    print("=" * 60)
    print("OK: infrastructure smoke passed")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
