"""H2707 gate v4 — машинный отсев ложных подстрочных KWIC-совпадений.

Правило R1 (откалибровано на 62 голосах куратора, 0 ложных срабатываний по
approve — scripts/crosswalk/kwic_noise_analysis.py): стем термина встречается
в цитате ТОЛЬКО внутри чужого слова (тер|петь при термине «петь»), причём
начало этого слова — не глагольная приставка. Куратор (v3 partial,
16-08-2026): «Почему показана невозможная связь петь и терпеть? …чтобы
человек на подобный мусор больше времени не тратил».

Помечает такие спорные kwic-рёбра status=rejected c machine_reject=R1 и
причиной в curator_note-стиле поля machine_note (аудит-след; куратор ничего
не голосовал — это машинное решение по его же явному указанию).

H3198: не расширять на `status=auto`. На v4 золоте R1 убивает curator-approve
acc161 (ворог ⊂ творог). Слабый auto с R1 построитель листа теперь только
сортирует в конец, не отклоняет.

Run: python scripts/crosswalk/apply_kwic_autoreject.py [--dry]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import MODULES, dump_canonical, load_json  # noqa: E402
from kwic_noise_analysis import r1_substring_false  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

CROSSWALK = MODULES / "22-crosswalk.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    doc = load_json(CROSSWALK)
    cw = doc["crosswalk"]
    hit = 0
    for e in cw["edges"]:
        if e.get("status") != "disputed" or e.get("pass") != "kwic":
            continue
        ev = e.get("evidence") or {}
        if r1_substring_false(ev.get("term", ""), ev.get("quote", "")):
            hit += 1
            print(f"  R1 reject: {e['edge_id']} · {ev.get('term')} · "
                  f"«{ev.get('quote', '')[:70]}»")
            if not args.dry:
                e["status"] = "rejected"
                e["machine_reject"] = "R1-substring"
                e["machine_note"] = ("машина (16-08-2026, правило R1 по указанию "
                                     "куратора в v3): термин найден только внутри "
                                     "чужого слова — ложное совпадение")
    stats = cw["stats"]
    from collections import Counter

    counts = Counter(e["status"] for e in cw["edges"])
    stats["approved"] = counts.get("approved", 0)
    stats["rejected"] = counts.get("rejected", 0)
    print(f"R1 отклонил: {hit} · статусы: {dict(counts)}")
    if not args.dry:
        dump_canonical(CROSSWALK, doc)
        print(f"записано {CROSSWALK.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
