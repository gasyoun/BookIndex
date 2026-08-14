"""Шаг 7: слияние рёбер всех проходов в модуль `data/modules/22-crosswalk.json`.

При конфликте (одна и та же запись и глава пришли из разных проходов) выигрывает
проход с большей уверенностью; проигравший не выбрасывается, а сохраняется в
`evidence.superseded_by` — иначе из модуля нельзя восстановить, что именно
сравнивалось.

Модуль попадает в `app_data.json`, а тот целиком инлайнится в артефакт, поэтому
в модуль идёт **урезанное** доказательство (цитата, термин, страница, файл,
смещение), а полное — в `data/crosswalk/edges_pass_*.json`, которые в приложение
не попадают. Само поле `evidence` при этом всегда непусто: ребро без
доказательства невалидно.

    python scripts/crosswalk/assemble_crosswalk.py

Дальше: `npm run data:assemble` и `npm run build`.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (CW, MODULES, catalog, chapters, load_json)  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Модуль и манифест должны быть побайтово теми же, что напишет `npm run data:split`,
# иначе CI-шаг «Ensure split modules are in sync» краснеет на одном отступе.
# Поэтому пишем канонической функцией репозитория, а не своим dump_json.
from app_data_modules import write_json  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

OUT = MODULES / "22-crosswalk.json"
MANIFEST = MODULES / "manifest.json"
PASS_FILES = ("edges_pass_a.json", "edges_pass_b.json", "edges_pass_c.json", "edges_pass_d.json")

# Бюджет артефакта конечен (`app_data.json` инлайнится в одностраничный артефакт
# целиком), поэтому в модуль идёт **короткое** доказательство: чем связь
# подтверждена и где это проверить. Прозаическая формулировка правила, термины-
# соседи, доля и отрыв главы, дословный ответ модели и usage остаются в
# `data/crosswalk/edges_pass_*.json` — они в приложение не попадают.
QUOTE_MAX = 140

# Ложность пары определяется содержанием, а не совпадением длительности:
# 43-минутные «1 лекция» и «2 лекция» одного цикла — разные доклады.
DUPLICATE_VERDICTS = {
    ("005", "040"): ("confirmed", "Один доклад «Новгородские берестяные грамоты» (2007); "
                                  "проставлен `duplicate_of`"),
    ("017", "018"): ("likely", "Один и тот же рассказ об истории русского языка под разными "
                               "заголовками перезаливки"),
    ("119", "173"): ("likely", "Одна дата 07.11.2015 и одна длительность: вероятно, одна "
                               "и та же лекция под общим заголовком «в МГУ»"),
    ("023", "034"): ("likely", "Обе записи о берестяных грамотах из раскопок 2017 года"),
    ("008", "012"): ("false", "Разные лекции одного цикла «Русский устный» (1-я и 2-я)"),
    ("088", "107"): ("false", "Разные циклы: русское ударение и строй ведийского языка"),
    ("007", "054"): ("false", "Разные темы: «О Велесовой книге» и семинар об ударении"),
}


def trim(edge: dict) -> dict:
    """Компактное доказательство под конкретный проход; полное — в файлах проходов."""
    src, ev = edge["evidence"], {}
    if edge["pass"] == "series":
        ev = {"series": src.get("series_id"), "matched": src.get("matched")}
    elif edge["pass"] == "kwic":
        ev = {"term": src.get("term"), "page": src.get("page"), "srt": src.get("srt"),
              "at": src.get("offset_seconds"),
              "quote": (src.get("quote") or "")[:QUOTE_MAX]}
        if src.get("asr_quality"):
            ev["asr"] = "looped"       # подозрение на зацикленный фрагмент, риск R-3
    elif edge["pass"] == "title_topics":
        ev = {"matched": src.get("matched_title_token") or src.get("topic"),
              "by": "topic" if src.get("topic") and not src.get("matched_title_token") else "title"}
    elif edge["pass"] == "llm":
        ev = {"model": src.get("model"), "quote": (src.get("quote") or "")[:QUOTE_MAX]}
    ev = {k: v for k, v in ev.items() if v not in (None, "", [])}
    if not ev:                         # ребро без доказательства невалидно
        ev = {"pass": edge["pass"]}
    out = dict(edge)
    out["evidence"] = ev
    return out


def duplicates() -> list[dict]:
    by_dur: dict[int, list[dict]] = defaultdict(list)
    for v in catalog():
        if v.get("duration_seconds"):
            by_dur[v["duration_seconds"]].append(v)
    out = []
    for dur, group in sorted(by_dur.items()):
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                key = tuple(sorted((a["accession"], b["accession"])))
                verdict, why = DUPLICATE_VERDICTS.get(key, ("unknown", "не разобрано"))
                out.append({
                    "pair": list(key),
                    "duration_seconds": dur,
                    "titles": [a.get("title_display"), b.get("title_display")],
                    "verdict": verdict,
                    "rationale": why,
                    "status": "approved" if verdict == "confirmed" else "disputed",
                })
    return out


def main() -> int:
    raw: list[dict] = []
    per_pass = Counter()
    for name in PASS_FILES:
        path = CW / name
        if not path.exists():
            print(f"  (нет {name} — проход не выполнялся)")
            continue
        data = load_json(path)
        raw.extend(data["edges"])
        per_pass[data["pass"]] += len(data["edges"])

    # конфликт = одна запись + одна глава из разных проходов
    best: dict[tuple[str, str], dict] = {}
    losers: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for e in sorted(raw, key=lambda x: (-x["confidence"], x["pass"])):
        key = (e["accession"], e["chapter"])
        if key not in best:
            best[key] = e
        else:
            losers[key].append(e)

    edges = []
    for key, e in best.items():
        out = trim(e)
        if losers[key]:
            out["evidence"]["superseded_by"] = [
                {"pass": l["pass"], "confidence": l["confidence"], "edge_id": l["edge_id"]}
                for l in losers[key]
            ]
        edges.append(out)
    edges.sort(key=lambda x: (x["accession"], x["chapter"], x["pass"]))

    chs = chapters()
    per_chapter = Counter(e["chapter"] for e in edges)
    empty = [c["id"] for c in chs if not per_chapter[c["id"]]]
    accs = {e["accession"] for e in edges}

    write_json(OUT, {
        "crosswalk": {
            "schema": "bookindex.crosswalk/1",
            "built_by": "scripts/crosswalk/assemble_crosswalk.py (H2711)",
            "note": "Полное доказательство каждого ребра — в data/crosswalk/edges_pass_*.json; "
                    "здесь оно урезано под бюджет артефакта. Ключ accession совпадает с "
                    "полем каталога («001»); в документации та же запись зовётся acc001.",
            "chapters": chs,
            "passes": dict(per_pass),
            "stats": {
                "edges": len(edges),
                "records_covered": len(accs),
                "records_total": len(catalog()),
                "with_timecode": sum(1 for e in edges if e.get("timecode")),
                "auto": sum(1 for e in edges if e["status"] == "auto"),
                "disputed": sum(1 for e in edges if e["status"] == "disputed"),
                "per_chapter": {c["id"]: per_chapter[c["id"]] for c in chs},
                "per_relation": dict(Counter(e["relation"] for e in edges)),
            },
            "edges": edges,
            "duplicates": duplicates(),
        }
    })

    # манифест: ключ владения и порядок сборки — иначе сборка модуль не увидит
    man = load_json(MANIFEST)
    if not any(m["file"] == OUT.name for m in man["modules"]):
        idx = next((i for i, m in enumerate(man["modules"]) if m["file"] == "30-scholar.json"),
                   len(man["modules"]))
        man["modules"].insert(idx, {"file": OUT.name, "keys": ["crosswalk"]})
    if OUT.name not in man["module_layout"]:
        pos = man["module_layout"].index("30-scholar.json") if "30-scholar.json" in man["module_layout"] else len(man["module_layout"])
        man["module_layout"].insert(pos, OUT.name)
    if "crosswalk" not in man["key_order"]:
        man["key_order"].append("crosswalk")
    write_json(MANIFEST, man)

    print(f"рёбер после слияния: {len(edges)}  (из проходов: {dict(per_pass)})")
    print(f"  записей охвачено   {len(accs)} / {len(catalog())}")
    print(f"  с тайм-кодом       {sum(1 for e in edges if e.get('timecode'))}")
    print(f"  auto / disputed    {sum(1 for e in edges if e['status'] == 'auto')} / "
          f"{sum(1 for e in edges if e['status'] == 'disputed')}")
    print("  по главам:", " ".join(f"{c['id']}={per_chapter[c['id']]}" for c in chs))
    if empty:
        print(f"  ! ПУСТЫЕ ГЛАВЫ: {empty} — критерий A6 не выполнен")
    print(f"  дублей-пар         {len(duplicates())}")
    print(f"записано {OUT.relative_to(OUT.parents[2])} и manifest.json")
    return 1 if empty else 0


if __name__ == "__main__":
    raise SystemExit(main())
