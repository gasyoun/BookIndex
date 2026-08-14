"""Шаг 8: статистика архива для печатной полосы и приложения.

Считает из каталога и карты архива: сколько записей и часов, распределение по
темам и типам, доля с тайм-кодом и с человеческой вычиткой, самый длинный и
самый короткий материал, охват по годам, покрытие крестом по главам.

`--live` дополнительно берёт публичные счётчики YouTube (Data API v3, ключ
`YOUTUBE_API_KEY` из [IndologyScholars/.env](https://github.com/gasyoun/IndologyScholars/blob/main/.env.example)).
Числа волатильны, поэтому в файл идёт дата съёма; без флага секция не
заполняется, и это честно видно в поле `youtube.fetched_at: null`.

    python scripts/crosswalk/build_youtube_stats.py [--live]

Пишет `data/crosswalk/youtube_stats.json`.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CW, MODULES, archive_map, catalog, chapters, dump_json, load_json  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

FETCHED_AT = "2026-08-14"
ENV_PATH = Path(r"C:\Users\user\Documents\GitHub\IndologyScholars\.env")
API = "https://www.googleapis.com/youtube/v3/videos"


def youtube_key() -> str:
    key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if key or not ENV_PATH.exists():
        return key
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line.startswith("YOUTUBE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def fetch_youtube(ids: list[str]) -> dict[str, dict]:
    import requests

    key = youtube_key()
    if not key:
        print("! YOUTUBE_API_KEY не найден — секция youtube останется пустой")
        return {}
    out: dict[str, dict] = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        r = requests.get(API, params={"part": "statistics", "id": ",".join(chunk), "key": key},
                         timeout=60)
        if r.status_code >= 400:
            print(f"! YouTube API {r.status_code}: {r.text[:160]}")
            break
        for item in r.json().get("items", []):
            st = item.get("statistics") or {}
            out[item["id"]] = {k: int(v) for k, v in st.items() if str(v).isdigit()}
    return out


def main() -> int:
    live = "--live" in sys.argv
    cat = catalog()
    amap = archive_map()
    module = load_json(MODULES / "22-crosswalk.json")["crosswalk"]

    total_sec = sum(v.get("duration_seconds") or 0 for v in cat)
    with_dur = [v for v in cat if v.get("duration_seconds")]
    longest = max(with_dur, key=lambda v: v["duration_seconds"])
    shortest = min(with_dur, key=lambda v: v["duration_seconds"])

    years = Counter()
    for v in cat:
        for field in ("date_recorded", "upload_date"):
            d = v.get(field)
            if isinstance(d, str) and len(d) >= 4 and d[:4].isdigit():
                years[d[:4]] += 1
                break

    timecoded = sum(1 for r in amap.values() if r.get("timecoded"))
    proofread = sum(1 for r in amap.values() if r.get("proofread"))

    stats = {
        "schema": "bookindex.crosswalk.stats/1",
        "generated": FETCHED_AT,
        "catalog": {
            "records": len(cat),
            "hours": round(total_sec / 3600, 1),
            "topics": dict(Counter(t for v in cat for t in (v.get("topics") or [])).most_common()),
            "without_topic": sum(1 for v in cat if not v.get("topics")),
            "types": dict(Counter(v.get("type") or "—" for v in cat).most_common()),
            "years": dict(sorted(years.items())),
            "longest": {"accession": longest["accession"], "minutes": longest["duration_seconds"] // 60,
                        "title": longest.get("title_display")},
            "shortest": {"accession": shortest["accession"], "minutes": shortest["duration_seconds"] // 60,
                         "title": shortest.get("title_display")},
            "duplicates_flagged": sum(1 for v in cat if v.get("duplicate_of")),
        },
        "archive": {
            "files": len(load_json(CW / "yandex_archive_index.json")),
            "with_timecode": timecoded,
            "proofread_docx": proofread,
            "note": "Расшифровки лежат в публичной шаре «ААЗализняк-архив», учётка не нужна; "
                    "в репозиторий они не копируются.",
        },
        "crosswalk": {
            "edges": module["stats"]["edges"],
            "records_covered": module["stats"]["records_covered"],
            "with_timecode": module["stats"]["with_timecode"],
            "per_chapter": {c["id"]: {"name": c["name"],
                                      "edges": module["stats"]["per_chapter"][c["id"]]}
                            for c in chapters()},
        },
        "youtube": {"fetched_at": None, "videos": {}},
    }

    if live:
        data = fetch_youtube([v["youtube_id"] for v in cat if v.get("youtube_id")])
        if data:
            by_id = {v["youtube_id"]: v for v in cat}
            views = {yid: s.get("viewCount", 0) for yid, s in data.items()}
            top = sorted(views.items(), key=lambda kv: -kv[1])[:10]
            stats["youtube"] = {
                "fetched_at": FETCHED_AT,
                "source": "YouTube Data API v3, part=statistics",
                "covered": len(data),
                "total_views": sum(views.values()),
                "most_viewed": [
                    {"accession": by_id[yid]["accession"], "views": n,
                     "title": by_id[yid].get("title_display")}
                    for yid, n in top if yid in by_id],
                "videos": {by_id[yid]["accession"]: s for yid, s in data.items() if yid in by_id},
            }

    dump_json(CW / "youtube_stats.json", stats)
    c = stats["catalog"]
    print(f"записей {c['records']} · {c['hours']} ч · тем {len(c['topics'])} · "
          f"без темы {c['without_topic']}")
    print(f"тайм-код {timecoded} · вычитано {proofread} · дублей помечено {c['duplicates_flagged']}")
    print(f"самый длинный acc{c['longest']['accession']} ({c['longest']['minutes']} мин), "
          f"самый короткий acc{c['shortest']['accession']} ({c['shortest']['minutes']} мин)")
    y = stats["youtube"]
    print(f"YouTube: {'снято ' + str(y['covered']) + ' записей, ' + str(y['total_views']) + ' просмотров'
                      if y['fetched_at'] else 'не снималось (--live)'}")
    print("записано data/crosswalk/youtube_stats.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
