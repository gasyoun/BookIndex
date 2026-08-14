"""Критерии приёмки A3–A6 (и A13) над собранным модулем креста.

    python scripts/crosswalk/validate_edges.py

Проверяет:

* **A3** — у каждого ребра непустое `evidence` (ребро без доказательства
  невалидно: печатная полоса утверждает связь перед читателем, и связь, которую
  нельзя предъявить, на бумаге неотличима от выдумки);
* **A4** — тайм-код лежит внутри `duration_seconds` записи;
* **A5** — глава существует (ch01…ch11) и запись есть в каталоге;
* **A6** — ни одна из 11 глав не осталась без ребра, включая ch07 «Арабский
  язык» и ch01 «От редколлегии», которые при сущностной разводке получали ноль;
* **A13** — дефекты волны 0 закрыты в каталоге.

Выход 0 — всё сошлось.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (MODULES, PASSES, RELATIONS, STATUSES, catalog,  # noqa: E402
                    chapters, load_json)

sys.stdout.reconfigure(encoding="utf-8")

TC = re.compile(r"^\d{2,4}:\d{2}$")


def main() -> int:
    module = load_json(MODULES / "22-crosswalk.json")["crosswalk"]
    edges = module["edges"]
    cat = {v["accession"]: v for v in catalog()}
    valid_ch = {c["id"] for c in chapters()}
    fails: list[str] = []

    # A3 — доказательство
    no_ev = [e["edge_id"] for e in edges if not e.get("evidence")]
    print(f"A3  рёбер без evidence: {len(no_ev)}")
    if no_ev:
        fails.append(f"A3: {no_ev[:5]}")

    # A4 — тайм-код в границах записи
    bad_tc = []
    for e in edges:
        tc = e.get("timecode")
        if tc is None:
            continue
        if not TC.match(tc):
            bad_tc.append((e["edge_id"], tc, "формат"))
            continue
        mm, ss = (int(x) for x in tc.split(":"))
        dur = (cat.get(e["accession"]) or {}).get("duration_seconds") or 0
        if dur and mm * 60 + ss > dur:
            bad_tc.append((e["edge_id"], tc, f"> {dur} с"))
    print(f"A4  тайм-кодов вне длительности записи: {len(bad_tc)}")
    if bad_tc:
        fails.append(f"A4: {bad_tc[:5]}")

    # A5 — глава и запись существуют, перечисления соблюдены
    bad_ref = [e["edge_id"] for e in edges
               if e["chapter"] not in valid_ch or e["accession"] not in cat
               or e["relation"] not in RELATIONS or e["pass"] not in PASSES
               or e["status"] not in STATUSES]
    print(f"A5  рёбер с неизвестной главой/записью/перечислением: {len(bad_ref)}")
    if bad_ref:
        fails.append(f"A5: {bad_ref[:5]}")

    # A6 — пустых глав нет
    per_ch = Counter(e["chapter"] for e in edges)
    empty = [c["id"] for c in chapters() if not per_ch[c["id"]]]
    print(f"A6  пустых глав: {len(empty)}  "
          + " ".join(f"{c['id']}={per_ch[c['id']]}" for c in chapters()))
    if empty:
        fails.append(f"A6: пустые главы {empty}")

    # A13 — дефекты волны 0
    a13 = []
    for acc in ("139", "145", "146"):
        t = (cat[acc].get("type") or "")
        if t.startswith("http") or "?" in t:
            a13.append(f"acc{acc}: type всё ещё заметка ({t[:40]!r})")
    llsh = sum(1 for v in cat.values() if "ЛЛШ" in (v.get("topics") or []))
    if llsh != 12:
        a13.append(f"тема ЛЛШ у {llsh} записей, ожидалось 12")
    if cat["040"].get("duplicate_of") != "005":
        a13.append(f"acc040.duplicate_of = {cat['040'].get('duplicate_of')!r}, ожидалось '005'")
    print(f"A13 незакрытых дефектов волны 0: {len(a13)}")
    for line in a13:
        print(f"    {line}")
    if a13:
        fails.append("A13")

    print(f"\nрёбер {len(edges)} · записей охвачено {len({e['accession'] for e in edges})}"
          f" / {len(cat)} · с тайм-кодом {sum(1 for e in edges if e.get('timecode'))}")
    print("статусы:", dict(Counter(e["status"] for e in edges)))
    print("связи:", dict(Counter(e["relation"] for e in edges)))

    print("\nИТОГ:", "PASS" if not fails else f"FAIL — {fails}")
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
