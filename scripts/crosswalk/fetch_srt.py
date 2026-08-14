"""Скачивание расшифровок `.srt`/`.vtt` архива в локальный кэш для прохода B.

Кэш лежит в `data/crosswalk/srt_cache/` и **не коммитится** (права на расшифровки:
забор плана запрещает заливать их целиком). В репозиторий попадают только рёбра
с цитатой ±120 знаков.

    python scripts/crosswalk/fetch_srt.py [--limit N] [--force]

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import SRT_CACHE, archive_map  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

ATTEMPTS = 3


def cache_path(accession: str, ext: str) -> Path:
    return SRT_CACHE / f"acc{accession}.{ext}"


def fetch_one(url: str) -> bytes | None:
    last = None
    for _ in range(ATTEMPTS):
        try:
            last = requests.get(url, timeout=180)
        except requests.RequestException as exc:
            last = exc
            continue
        if last.status_code < 400:
            return last.content
    return None


def main() -> int:
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    force = "--force" in sys.argv

    SRT_CACHE.mkdir(parents=True, exist_ok=True)
    records = archive_map()
    todo = [r for r in records.values() if r.get("timecoded")]
    if limit:
        todo = todo[:limit]

    got = cached = failed = 0
    for i, rec in enumerate(todo, 1):
        tc = rec["timecoded"]
        dst = cache_path(rec["accession"], tc["ext"])
        if dst.exists() and dst.stat().st_size > 0 and not force:
            cached += 1
            continue
        if not tc.get("url"):
            failed += 1
            print(f"  acc{rec['accession']}: нет прямой ссылки — пропуск")
            continue
        blob = fetch_one(tc["url"])
        if blob is None:
            failed += 1
            print(f"  acc{rec['accession']}: не скачалось после {ATTEMPTS} попыток")
            continue
        dst.write_bytes(blob)
        got += 1
        if i % 20 == 0:
            print(f"  … {i}/{len(todo)}")

    print(f"\nскачано {got}, из кэша {cached}, не вышло {failed}, всего {len(todo)}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
