"""Шаг 5, проход C: заголовок и темы — слабый сигнал на остатке.

Работает только по записям, у которых после проходов A и B нет уверенного
(`auto`) ребра. Уверенность не выше 0.60: заголовок и тема — это слабый сигнал,
и порог прохода намеренно поставлен так, что ниже 0.60 ребро уходит в «спорные»
листа голосования, а не на полосу.

Темы каталога: `русистика` 50, `санскрит` 32, `ЛЛШ` 10, `береста` 8,
`интервью` 1; **75 записей темы не имеют** — для них работает только заголовок.

Здесь же ставятся типы связи помимо `lecture_of`: `about_zaliznyak` (материалы
*о* нём, требование владельца), `other_book`, `sequel_to`.

Пишет `data/crosswalk/edges_pass_c.json`.

    python scripts/crosswalk/pass_c_title_topics.py

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CW, catalog, dump_json, load_json, make_edge  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

RX = lambda p: re.compile(p, re.I)  # noqa: E731

# (регулярка по заголовку, глава, связь, уверенность, пояснение)
TITLE_RULES: list[tuple[re.Pattern, str, str, float, str]] = [
    # ch07 «Арабский язык» — до этой работы глава получала ноль попаданий
    (RX(r"арабск"), "ch07", "lecture_of", 0.60, "заголовок называет арабский язык"),
    # ch11 «Или и уже»
    (RX(r"\bили\W+и\W+уже"), "ch11", "lecture_of", 0.60, "заголовок называет тему главы «Или и уже»"),
    # ch08 «Из русского ударения»
    (RX(r"ударени|творог"), "ch08", "lecture_of", 0.60, "заголовок называет русское ударение"),
    (RX(r"живые\s+механизмы\s+современного\s+русского\s+ударения"),
     "ch08", "sequel_to", 0.60, "поздний доклад того же цикла об ударении"),
    # ch05 «Древняя Индия»
    (RX(r"санскрит|ведийск|\bRV\s*\d|корне\s+jR"), "ch05", "lecture_of", 0.60,
     "заголовок называет санскрит / ведийский разбор"),
    # ch09 «Берестяные грамоты»
    (RX(r"новгородск|новгород|грамот|псалтыр|новгородском\s+кодексе|цере|"
        r"экспедици|раскопк|письма\s+из\s+средневековья"),
     "ch09", "lecture_of", 0.60, "заголовок называет новгородские находки и берестяные грамоты"),
    # ch06 «История русского языка»
    (RX(r"истори\w*\s+русского\s+языка|русский\s+устный|прошлом\s+и\s+будущем\s+русского|"
        r"русский\W+украинский\W+белорусский|лекци\w*\s+в\s+Падуе"),
     "ch06", "lecture_of", 0.60, "заголовок называет историю русского языка"),
    # ch03/ch04 «Историческая лингвистика» (две части одной темы: ставим первую)
    (RX(r"любительск\w*\s+лингвистик|ложной\s+лингвистике|псевдознан|лженаук|"
        r"квазистори|квазиистори|велесов"),
     "ch03", "expands", 0.60, "заголовок называет разбор любительской лингвистики"),
    (RX(r"скандинавское\s+слово|что\s+такое\s+русь|изначально\s+был\s+русью|древних\s+укров"),
     "ch03", "expands", 0.55, "заголовок называет этимологический разбор «Руси»"),
    (RX(r"изменяется\s+внешняя\s+сторона\s+слова"), "ch03", "lecture_of", 0.60,
     "заголовок называет звуковые изменения — предмет исторической лингвистики"),
    # ch10 «О жизни слов»
    (RX(r"жизни\s+слов|происхождени\w*\s+слов|механизмы\s+экспрессивности"),
     "ch10", "lecture_of", 0.60, "заголовок называет тему главы «О жизни слов»"),
    # другие книги Зализняка
    (RX(r"слов\w*\s+о\s+полку"), "ch06", "other_book", 0.55,
     "запись о книге «„Слово о полку Игореве“: взгляд лингвиста»"),
    (RX(r"прогулки\s+по\s+европе"), "ch01", "other_book", 0.50,
     "запись о книге «Прогулки по Европе»"),
]

# материалы *о* Зализняке — требование владельца «вплести выступления о нём»
ABOUT_RX = RX(
    r"фильм\s+о|истина\s+существует|лингвистическ\w*\s+детектив|наблюдатель|"
    r"воспоминани|прощание|умер\s+андрей|день\s+рождения|юбилей|памяти|"
    r"госпремию|birthday|presents\s+a\s+book|презентация\s+книги|"
    r"абсолютной\s+репутацией|между\s+прошлым\s+и\s+будущим|отвечает\s+на\s+вопросы|"
    r"беседует\s+с|коэффициент\s+достоверности|солженицынск")

TOPIC_RULES = {
    "санскрит": ("ch05", "lecture_of", 0.55, "тема каталога «санскрит»"),
    "береста": ("ch09", "lecture_of", 0.55, "тема каталога «береста»"),
    "русистика": ("ch06", "lecture_of", 0.50, "тема каталога «русистика»"),
}


def confident_accessions() -> set[str]:
    out: set[str] = set()
    for name in ("edges_pass_a.json", "edges_pass_b.json"):
        path = CW / name
        if not path.exists():
            continue
        for e in load_json(path)["edges"]:
            if e["status"] == "auto":
                out.add(e["accession"])
    return out


def main() -> int:
    done = confident_accessions()
    edges: list[dict] = []
    by_rule = {"title": 0, "about": 0, "topic": 0}

    for v in catalog():
        acc = v["accession"]
        if acc in done:
            continue
        title = f"{v.get('title_display') or ''} {v.get('title_source') or ''}".strip()
        topics = v.get("topics") or []
        hit = False

        for rx, chapter, relation, conf, why in TITLE_RULES:
            m = rx.search(title)
            if not m:
                continue
            edges.append(make_edge(acc, chapter, "title_topics", relation, conf, evidence={
                "rule": why, "matched_title_token": m.group(0), "title": title,
                "topics": topics,
            }))
            by_rule["title"] += 1
            hit = True
            break

        if ABOUT_RX.search(title):
            edges.append(make_edge(acc, "ch01", "title_topics", "about_zaliznyak", 0.55, evidence={
                "rule": "материал *о* Зализняке — глава «От редколлегии и предисловие» "
                        "собирает контекст издания и биографии",
                "matched_title_token": ABOUT_RX.search(title).group(0),
                "title": title, "topics": topics,
            }))
            by_rule["about"] += 1
            hit = True

        if not hit:
            for t in topics:
                rule = TOPIC_RULES.get(t)
                if not rule:
                    continue
                chapter, relation, conf, why = rule
                edges.append(make_edge(acc, chapter, "title_topics", relation, conf, evidence={
                    "rule": why, "topic": t, "title": title, "topics": topics,
                }))
                by_rule["topic"] += 1
                break

    dump_json(CW / "edges_pass_c.json", {
        "schema": "bookindex.crosswalk.edges/1",
        "pass": "title_topics",
        "skipped_with_confident_edge": len(done),
        "by_rule": by_rule,
        "edges": edges,
    })

    print(f"записей с уверенным ребром после A/B: {len(done)}")
    print(f"рёбер прохода C: {len(edges)}  (по заголовку {by_rule['title']}, "
          f"«о Зализняке» {by_rule['about']}, по теме {by_rule['topic']})")
    print(f"  auto {sum(1 for e in edges if e['status'] == 'auto')}, "
          f"disputed {sum(1 for e in edges if e['status'] == 'disputed')}")
    print("записано data/crosswalk/edges_pass_c.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
