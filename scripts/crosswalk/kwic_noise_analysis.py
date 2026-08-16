"""H2707 gate v4 — калибровка машинных правил отсева KWIC-мусора.

Куратор (16-08-2026, v3 partial): «Почему показана невозможная связь петь и
терпеть? Переделай все голосование, чтобы человек на подобный мусор больше
времени не тратил» + «метафора — такие надо отсекать сразу без человека» +
«не обсуждается судьба конкретного слова — связь мусорная».

Два кандидата в правила:
  R1 substring — термин присутствует в цитате только внутри чужого слова
     (тер|петь): ни один токен цитаты не начинается с основы термина;
  R2 metalinguistic — в цитате нет ни одного маркера разговора О СЛОВЕ
     (слово, ударение, форма, значение, произносится, корень…).

Скрипт НЕ меняет данные: он прогоняет оба правила по всем kwic-рёбрам, уже
проголосованным куратором (v1+v2+v3 partial), и печатает матрицу
согласия — правило принимается только если не убивает ни одного approve.

Run: python scripts/crosswalk/kwic_noise_analysis.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CW, MODULES, load_json  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

PARTIALS = [CW / "gate_decisions_v1_partial.json",
            CW / "gate_decisions_v2_partial.json",
            CW / "gate_decisions_v3_partial.json"]

# маркеры разговора о слове/языке (основы, без окончаний)
META_MARKERS = [
    "слов", "ударени", "ударен", "акцент", "форм", "значени", "произн",
    "этимолог", "корень", "корн", "падеж", "склонен", "спряжен", "глагол",
    "существительн", "прилагательн", "окончани", "суффикс", "приставк",
    "букв", "пишет", "написан", "текст", "берестян", "грамот", "древнерусск",
    "праслав", "диалект", "говор", "язык", "лингвист", "пример", "цитат",
]


def term_stem(term: str) -> str:
    t = term.lower()
    for end in ("ться", "ть", "ие", "ия", "ый", "ой", "ая", "ий"):
        if t.endswith(end) and len(t) - len(end) >= 4:
            return t[: len(t) - len(end)]
    return t if len(t) <= 5 else t[:-1]


PREFIXES = ("вы", "пере", "при", "за", "у", "по", "на", "от", "ото", "об",
            "обо", "в", "во", "с", "со", "до", "раз", "рас", "из", "ис",
            "недо", "воз", "вос", "под", "надо", "над", "про", "пре", "не")


def _norm(s: str) -> str:
    return s.lower().replace("ё", "е")


def _stem_variants(stem: str) -> list[str]:
    """Стем + его полногласный вариант (брег→берег, глава→голова):
    ре→ере, ле→еле/оло, ра→оро, ла→оло после согласной."""
    out = [stem]
    for old, new in (("ре", "ере"), ("ле", "оло"), ("ла", "оло"),
                     ("ра", "оро"), ("ле", "еле")):
        i = stem.find(old)
        if i > 0 and stem[i - 1] not in "аеиоуыэюя":
            out.append(stem[:i] + new + stem[i + len(old):])
    return out


def r1_substring_false(term: str, quote: str) -> bool:
    """Стем термина встречается ТОЛЬКО внутри чужого слова (тер|петь) —
    т.е. есть токен со стемом в середине, начало которого не является
    глагольной приставкой, и нет ни одного токена, начинающегося со стема
    (или его полногласного варианта) или несущего стем после законной
    приставки. Сравнение с ё→е нормализацией."""
    stems = _stem_variants(_norm(term_stem(term)))
    tokens = re.findall(r"[а-яёa-z]+", _norm(quote))
    legal = False
    midword = False
    for tok in tokens:
        for stem in stems:
            i = tok.find(stem)
            if i < 0:
                continue
            if i == 0 or tok[:i] in PREFIXES:
                legal = True
            else:
                midword = True
    return midword and not legal


def r2_no_meta(quote: str) -> bool:
    q = quote.lower()
    return not any(m in q for m in META_MARKERS)


def main() -> int:
    edges = {e["edge_id"]: e for e in load_json(MODULES / "22-crosswalk.json")["crosswalk"]["edges"]}
    votes: dict[str, str] = {}
    for p in PARTIALS:
        if not p.is_file():
            continue
        for it in load_json(p)["items"]:
            if it.get("decision") in ("approve", "reject"):
                votes[it["id"]] = it["decision"]

    gold = [(eid, d) for eid, d in votes.items()
            if eid in edges and edges[eid].get("pass") == "kwic"]
    print(f"gold: {len(gold)} проголосованных kwic-рёбер")

    for name, rule in [("R1 substring", lambda e: r1_substring_false(
                            e["evidence"].get("term", ""), e["evidence"].get("quote", ""))),
                       ("R2 no-meta", lambda e: r2_no_meta(e["evidence"].get("quote", "")))]:
        tp = fp = 0
        killed_approves = []
        for eid, d in gold:
            hit = rule(edges[eid])
            if hit and d == "reject":
                tp += 1
            if hit and d == "approve":
                fp += 1
                killed_approves.append(eid)
        rej = sum(1 for _, d in gold if d == "reject")
        print(f"\n{name}: ловит {tp}/{rej} реджектов, убивает {fp} approve")
        for eid in killed_approves:
            ev = edges[eid]["evidence"]
            print(f"  FP: {eid} · {ev.get('term')} · «{ev.get('quote', '')[:90]}»")

    # что правила сняли бы с оставшихся спорных
    rest = [e for e in edges.values() if e["status"] == "disputed" and e.get("pass") == "kwic"]
    r1 = [e for e in rest if r1_substring_false(e["evidence"].get("term", ""), e["evidence"].get("quote", ""))]
    r2 = [e for e in rest if r2_no_meta(e["evidence"].get("quote", ""))]
    both = {e["edge_id"] for e in r1} | {e["edge_id"] for e in r2}
    print(f"\nоставшиеся спорные kwic: {len(rest)} · R1 снял бы {len(r1)} · "
          f"R2 снял бы {len(r2)} · вместе {len(both)}")
    for e in r1[:8]:
        ev = e["evidence"]
        print(f"  R1: {e['edge_id']} · {ev.get('term')} · «{ev.get('quote', '')[:80]}»")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
