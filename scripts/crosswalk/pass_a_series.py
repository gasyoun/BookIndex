"""Шаг 3, проход A: серии → главы.

Главный рычаг связи — не сущности, а серии. Поштучная разводка через
`related_entities` даёт шум (лекция об арабском уезжает в «Историческую
лингвистику», а глава «Арабский язык» получает ноль попаданий), тогда как два
длинных семинарских цикла закрывают 82 записи одним правилом.

Пишет `data/crosswalk/edges_pass_a.json`.

    python scripts/crosswalk/pass_a_series.py

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CW, catalog, dump_json, make_edge  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

# Цикл: (id, человекочитаемое имя, регулярка по заголовку, глава, уверенность)
SERIES = [
    ("rus_stress", "История русского ударения",
     re.compile(r"истори\w*\s+русского\s+ударения|русское\s+ударение", re.I),
     "ch08", 0.95),
    ("vedic_sanskrit", "Строй ведийского языка / Грамматический строй санскрита",
     re.compile(r"строй\s+ведийского|грамматическ\w*\s+строй\s+санскрита|ведийск\w+\s+язык", re.I),
     "ch05", 0.95),
    ("birchbark", "Берестяные грамоты, раскопки по сезонам",
     re.compile(r"берестян\w*|раскопок\s+сезона|новгородск\w+\s+раскопк", re.I),
     "ch09", 0.95),
]


def main() -> int:
    edges, per_series = [], {s[0]: 0 for s in SERIES}
    for v in catalog():
        title = f"{v.get('title_display') or ''} {v.get('title_source') or ''}"
        for sid, name, rx, chapter, conf in SERIES:
            m = rx.search(title)
            if not m:
                continue
            edges.append(make_edge(
                v["accession"], chapter, "series", "lecture_of", conf,
                evidence={
                    "series_id": sid,
                    "series_name": name,
                    "rule": f"заголовок записи содержит признак цикла «{name}» → глава {chapter}",
                    "matched": m.group(0),
                    "title": v.get("title_display") or v.get("title_source") or "",
                },
            ))
            per_series[sid] += 1
            break          # запись принадлежит одному циклу

    dump_json(CW / "edges_pass_a.json", {
        "schema": "bookindex.crosswalk.edges/1",
        "pass": "series",
        "series": [{"id": s[0], "name": s[1], "chapter": s[3], "records": per_series[s[0]]}
                   for s in SERIES],
        "edges": edges,
    })

    for sid, name, rx, chapter, _ in SERIES:
        print(f"  {name[:46]:46s} → {chapter}  {per_series[sid]:3d} записей")
    print(f"\nвсего рёбер прохода A: {len(edges)}")
    print(f"записано {(CW / 'edges_pass_a.json').relative_to(CW.parents[1])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
