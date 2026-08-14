"""Аудит /ask (H2706): сколько записей каталога реально обеспечено текстом.

Отвечает на вопрос, на котором спотыкались три прежних источника:
репозиторий говорит 27, конвейер — 98, реестр владельца — 119.
Непосредственное свидетельство — публичный архив на Яндекс.Диске.

Измерено 14-08-2026: 1569 файлов, 171 из 176 записей с тайм-кодированным .srt
(97 %), 104 из 176 с вычитанным .docx (59 %).

Учётка не нужна: шара публичная.

    python docs/history/audit_yandex_archive_coverage_h_ask.py [--refresh]

Только чтение. Кэширует индекс рядом с собой, чтобы не ходить в сеть повторно.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent                      # <repo>/docs/history/x.py -> <repo>
CACHE = HERE / "yandex_archive_index.json"
CATALOG = REPO / "data" / "video_catalog_public.v2.json"

API = "https://cloud-api.yandex.net/v1/disk/public/resources"
PUBLIC_KEY = "https://disk.yandex.ru/d/bt5FCdq9y11fJg"   # «ААЗализняк-архив»

TEXT_EXT = {"srt", "vtt", "txt", "docx", "doc"}
TIMECODED = {"srt", "vtt"}

# суффиксы стадий вычитки, мешающие сопоставлению по имени
NOISE = re.compile(r"(_после_[^.]*|_часть_\d+|_компиляция[^.]*|_сверк[^.]*|\(\d+\))", re.I)
NONWORD = re.compile(r"[^а-яёa-z0-9]+", re.I)
THRESHOLD = 0.62


def norm(s: str) -> str:
    return " ".join(NONWORD.sub(" ", NOISE.sub(" ", s.lower())).split())


def fetch(path: str, offset: int) -> dict:
    params = {"public_key": PUBLIC_KEY, "limit": 500, "offset": offset}
    if path and path != "/":
        params["path"] = path
    last = None
    for _ in range(3):
        last = requests.get(API, params=params, timeout=120)
        if last.status_code < 400:
            return last.json()
    raise SystemExit(f"{last.status_code}: {last.text[:200]}")


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
            else:
                name = it.get("name", "")
                out.append({
                    "name": name,
                    "path": it.get("path", ""),
                    "size": it.get("size") or 0,
                    "ext": name.rsplit(".", 1)[-1].lower() if "." in name else "",
                    "folder": (it.get("path", "").rsplit("/", 2) or [""])[-2],
                })
        offset += len(items)
        if offset >= (emb.get("total") or 0):
            break
    return out


def main() -> None:
    if CACHE.exists() and "--refresh" not in sys.argv:
        files = json.loads(CACHE.read_text(encoding="utf-8"))
        print(f"(кэш: {len(files)} файлов; --refresh чтобы перечитать)")
    else:
        print("обход публичной шары …")
        files = walk("/")
        CACHE.write_text(json.dumps(files, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"записано {CACHE.name}: {len(files)} файлов")

    print()
    print("=" * 74)
    print("1. СОСТАВ АРХИВА")
    print("=" * 74)
    per = defaultdict(Counter)
    for f in files:
        per[f["folder"]][f["ext"]] += 1
    for folder in sorted(per):
        exts = per[folder]
        top = ", ".join(f"{n}×.{e}" for e, n in exts.most_common(6))
        print(f"  {folder[:44]:44s} {sum(exts.values()):5d}  {top}")

    tc = [f for f in files if f["ext"] in TIMECODED]
    print(f"\n  тайм-кодированных файлов (.srt/.vtt): {len(tc)}")

    print()
    print("=" * 74)
    print("2. ПОКРЫТИЕ КАТАЛОГА")
    print("=" * 74)
    print("  Внимание: сопоставлять надо с ОСНОВОЙ имени, затем смотреть расширения.")
    print("  Гонка всех расширений в одном конкурсе даёт 2 вместо 171 — .json и")
    print("  .docx выигрывают у .srt. Эта ошибка уже была допущена однажды.\n")

    # основа имени -> набор расширений (объединение по обоим каналам ASR)
    stems: dict[str, set[str]] = defaultdict(set)
    for f in files:
        if f["ext"]:
            stems[norm(f["name"].rsplit(".", 1)[0])].add(f["ext"])
    stem_keys = [k for k in stems if k]

    cat = json.loads(CATALOG.read_text(encoding="utf-8"))["videos"]
    n_text = n_tc = n_docx = 0
    gaps = []
    for v in cat:
        title = norm(v.get("title_display") or v.get("title_source") or "")
        exts: set[str] = set()
        for k in stem_keys:
            if SequenceMatcher(None, title, k).ratio() >= THRESHOLD:
                exts |= stems[k]
        if exts & TEXT_EXT:
            n_text += 1
        if exts & TIMECODED:
            n_tc += 1
        else:
            gaps.append((v, exts))
        if exts & {"docx", "doc"}:
            n_docx += 1

    n = len(cat)
    print(f"  записей в каталоге              {n}")
    print(f"  текст любого вида               {n_text:4d} / {n}  ({100*n_text/n:.0f}%)")
    print(f"  ТАЙМ-КОДЫ (.srt/.vtt)           {n_tc:4d} / {n}  ({100*n_tc/n:.0f}%)")
    print(f"  вычитано человеком (.docx)      {n_docx:4d} / {n}  ({100*n_docx/n:.0f}%)")

    print(f"\n  без тайм-кода ({len(gaps)}):")
    for v, exts in gaps:
        print(f"    {v.get('accession')}  есть={sorted(exts) or '—'}  "
              f"{(v.get('title_display') or '')[:56]}")
    print("\n  Падуанские лекции лежат как mkv/mp3/webm — распознавание просто")
    print("  не запускали; это восполнимо, а не отсутствие материала.")


if __name__ == "__main__":
    main()
