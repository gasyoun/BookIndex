"""Шаг 2 креста «видео ↔ главы»: привязка 176 записей каталога к файлам архива.

Читает `data/crosswalk/yandex_archive_index.json` (шаг 1) и
`data/video_catalog_public.v2.json`, пишет `data/crosswalk/catalog_archive_map.json`.

Сопоставление идёт **с основой имени** (`<stem>.srt`, `<stem>.txt`, `<stem>.json`, …),
а не со всеми расширениями в одном конкурсе похожести: два канала распознавания
дают параллельные наборы с одинаковой основой, и при гонке расширений `.json` и
`.docx` выигрывают у `.srt`, обваливая охват тайм-кодов со 171 до 2. Эта ошибка
уже была допущена и исправлена при аудите — повторять её не надо.

Опорные числа (14-08-2026): `.srt` у 171 из 176 (97 %), `.docx` у 104 из 176 (59 %),
без тайм-кода ровно 5 — acc121/122/123 (падуанские лекции: в архиве только
mkv/mp3/webm) и acc052/acc150 (обрывки 1–2 мин).

    python scripts/crosswalk/match_catalog_to_archive.py

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
INDEX = REPO / "data" / "crosswalk" / "yandex_archive_index.json"
CATALOG = REPO / "data" / "video_catalog_public.v2.json"
OUT = REPO / "data" / "crosswalk" / "catalog_archive_map.json"

TEXT_EXT = {"srt", "vtt", "txt", "docx", "doc"}
TIMECODED = ("srt", "vtt")
PROOFREAD = ("docx", "doc")

NOISE = re.compile(r"(_после_[^.]*|_часть_\d+|_компиляция[^.]*|_сверк[^.]*|\(\d+\))", re.I)
NONWORD = re.compile(r"[^а-яёa-z0-9]+", re.I)
THRESHOLD = 0.62

# R-4: внутри одного цикла заголовки почти совпадают («Лекция 14» ↔ «Лекция 15»),
# поэтому номер лекции/семинара сверяется отдельно и расхождение дисквалифицирует.
NUM = re.compile(r"(?:лекци\w*|семинар\w*|занятие\w*|часть)\s*[№n]?\s*(\d{1,2})", re.I)


def norm(s: str) -> str:
    return " ".join(NONWORD.sub(" ", NOISE.sub(" ", s.lower())).split())


def lecture_no(s: str) -> str | None:
    m = NUM.search(s)
    return m.group(1) if m else None


def main() -> int:
    files = json.loads(INDEX.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))["videos"]

    # основа имени -> {ext: [файл, …]}, объединяя оба канала распознавания
    stems: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for f in files:
        if not f.get("ext"):
            continue
        stem = norm(f["name"].rsplit(".", 1)[0])
        if stem:
            stems[stem][f["ext"]].append(f)
    stem_keys = list(stems)

    out: dict[str, dict] = {}
    n_text = n_tc = n_pr = 0
    gaps: list[tuple[str, str, list[str]]] = []

    for v in catalog:
        acc = v["accession"]
        title = v.get("title_display") or v.get("title_source") or ""
        key = norm(title)
        want_no = lecture_no(title)

        hits: list[tuple[float, str]] = []
        for k in stem_keys:
            ratio = SequenceMatcher(None, key, k).ratio()
            if ratio < THRESHOLD:
                continue
            got_no = lecture_no(k)
            # R-4: разные номера в одном цикле — это разные лекции, не совпадение
            if want_no and got_no and want_no != got_no:
                continue
            hits.append((ratio, k))
        hits.sort(reverse=True)

        exts: set[str] = set()
        for _, k in hits:
            exts |= set(stems[k])

        def best(kinds: tuple[str, ...]) -> dict | None:
            for _, k in hits:
                for ext in kinds:
                    if stems[k].get(ext):
                        f = stems[k][ext][0]
                        return {"ext": ext, "name": f["name"], "path": f["path"],
                                "size": f["size"], "url": f.get("file") or "", "stem": k}
            return None

        srt = best(TIMECODED)
        doc = best(PROOFREAD)

        if exts & TEXT_EXT:
            n_text += 1
        if srt:
            n_tc += 1
        else:
            gaps.append((acc, title, sorted(exts)))
        if doc:
            n_pr += 1

        out[acc] = {
            "accession": acc,
            "youtube_id": v.get("youtube_id"),
            "title_display": title,
            "duration_seconds": v.get("duration_seconds"),
            "match_score": round(hits[0][0], 4) if hits else 0.0,
            "matched_stems": [k for _, k in hits[:6]],
            "extensions": sorted(exts),
            "timecoded": srt,
            "proofread": doc,
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "schema": "bookindex.crosswalk.catalog_archive_map/1",
        "source": {"index": str(INDEX.relative_to(REPO)).replace("\\", "/"),
                   "catalog": str(CATALOG.relative_to(REPO)).replace("\\", "/"),
                   "threshold": THRESHOLD},
        "stats": {"catalog": len(catalog), "any_text": n_text,
                  "timecoded": n_tc, "proofread": n_pr},
        "records": out,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    n = len(catalog)
    print(f"записей каталога            {n}")
    print(f"текст любого вида          {n_text:4d} / {n}")
    print(f"ТАЙМ-КОДЫ (.srt/.vtt)      {n_tc:4d} / {n}")
    print(f"вычитано человеком (.docx) {n_pr:4d} / {n}")
    print(f"\nбез тайм-кода ({len(gaps)}):")
    for acc, title, exts in gaps:
        print(f"  acc{acc}  есть={exts or '—'}  {title[:56]}")
    print(f"\nзаписано {OUT.relative_to(REPO)}")

    ok = n_tc >= 165
    print("A2:", "PASS" if ok else f"FAIL — .srt у {n_tc}, ожидалось ≥165 (норма 171)")
    if not ok:
        print("  сломалось сопоставление по основе имени, а не архив — см. шаг 2 плана")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
