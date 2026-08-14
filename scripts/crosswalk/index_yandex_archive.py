"""Шаг 1 креста «видео ↔ главы»: индекс публичного архива на Яндекс.Диске.

Обходит публичную шару «ААЗализняк-архив» без учётки и пишет
`data/crosswalk/yandex_archive_index.json` — по файлу на запись:
`name`, `path`, `size`, `ext`, `folder`, `file` (прямая ссылка на скачивание,
если её отдал API).

Опорная форма (измерено 14-08-2026): 1569 файлов, из них 213 тайм-кодированных
(`.srt`/`.vtt`).

    python scripts/crosswalk/index_yandex_archive.py [--refresh] [--offline]

Без сети (`--offline`, а также автоматически после трёх неудачных попыток)
берёт индекс прошлой сессии `/ask` из `docs/history/yandex_archive_index.json`:
шара может переехать (риск R-2), но работа переживает пропажу источника —
именно ради этого индекс закоммичен.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "data" / "crosswalk" / "yandex_archive_index.json"
FALLBACK = REPO / "docs" / "history" / "yandex_archive_index.json"

API = "https://cloud-api.yandex.net/v1/disk/public/resources"
PUBLIC_KEY = "https://disk.yandex.ru/d/bt5FCdq9y11fJg"   # «ААЗализняк-архив»

TIMECODED = {"srt", "vtt"}
ATTEMPTS = 3


def fetch(path: str, offset: int) -> dict:
    params = {"public_key": PUBLIC_KEY, "limit": 500, "offset": offset}
    if path and path != "/":
        params["path"] = path
    last = None
    for _ in range(ATTEMPTS):
        try:
            last = requests.get(API, params=params, timeout=120)
        except requests.RequestException as exc:      # сеть отвалилась
            last = exc
            continue
        if last.status_code < 400:
            return last.json()
    raise RuntimeError(f"шара недоступна после {ATTEMPTS} попыток: {last}")


def walk(path: str = "/", depth: int = 0) -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        emb = fetch(path, offset).get("_embedded") or {}
        items = emb.get("items", [])
        if not items:
            break
        for it in items:
            if it.get("type") == "dir":
                if depth < 4:
                    out.extend(walk(it.get("path", ""), depth + 1))
                continue
            name = it.get("name", "")
            out.append({
                "name": name,
                "path": it.get("path", ""),
                "size": it.get("size") or 0,
                "ext": name.rsplit(".", 1)[-1].lower() if "." in name else "",
                "folder": (it.get("path", "").rsplit("/", 2) or [""])[-2],
                "file": it.get("file") or "",
            })
        offset += len(items)
        if offset >= (emb.get("total") or 0):
            break
    return out


def load_fallback() -> list[dict]:
    files = json.loads(FALLBACK.read_text(encoding="utf-8"))
    for f in files:
        f.setdefault("file", "")
    return files


def main() -> int:
    offline = "--offline" in sys.argv
    fresh = not offline and ("--refresh" in sys.argv or not OUT.exists())

    if OUT.exists() and not fresh and not offline:
        files = json.loads(OUT.read_text(encoding="utf-8"))
        print(f"(кэш {OUT.relative_to(REPO)}: {len(files)} файлов; --refresh чтобы перечитать)")
    elif offline:
        files = load_fallback()
        print(f"офлайн: индекс из {FALLBACK.relative_to(REPO)} — {len(files)} файлов")
    else:
        try:
            print("обход публичной шары …")
            files = walk("/")
        except RuntimeError as exc:
            print(f"! {exc}")
            print(f"! откат на закоммиченный индекс {FALLBACK.relative_to(REPO)} (риск R-2)")
            files = load_fallback()
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(files, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"записано {OUT.relative_to(REPO)}: {len(files)} файлов")

    if not OUT.exists():
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(files, ensure_ascii=False, indent=1), encoding="utf-8")

    tc = sum(1 for f in files if f["ext"] in TIMECODED)
    with_url = sum(1 for f in files if f.get("file"))
    print(f"  файлов                 {len(files)}")
    print(f"  тайм-кодированных      {tc}   (.srt/.vtt)")
    print(f"  с прямой ссылкой       {with_url}")
    ok = len(files) >= 1500 and tc >= 200
    print("A1:", "PASS" if ok else "FAIL — ожидалось ≥1500 файлов и ≥200 тайм-кодов")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
