"""Шаг 4, проход B: KWIC по тайм-кодам — единственный проход, дающий `▸ ММ:СС`.

Строит индекс «голова указателя → страницы» из модулей 10–14, переводит страницу
в главу по диапазонам `20-lectures.json`, ищет головы в расшифровках `.srt`
и берёт тайм-код первого уверенного попадания.

**Высокочастотный шум отбрасывается дважды.** Головы короче 4 знаков и попадающие
более чем в 6 глав исключаются сразу — это фильтр по книге, названный планом.
Его **недостаточно**: измерено 14-08-2026, что он пропускает головы, редкие в
книге и повсеместные в устной речи (`говор` — одна страница 261, глава 8, и при
этом почти каждая расшифровка), из-за чего глава 8 забирала 144 ребра из 263, а
лекция об арабском языке уезжала в «Из русского ударения» — тот же провал, из-за
которого забракована сущностная разводка `related_entities`, только с другой
стороны. Поэтому вес головы домножается на её IDF по корпусу расшифровок, а
головы, встречающиеся более чем в половине записей, выбрасываются: голова,
которая есть везде, не различает ничего.

Пишет `data/crosswalk/edges_pass_b.json`.

    python scripts/crosswalk/pass_b_kwic.py [--limit N]

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (CW, MODULES, SRT_CACHE, archive_map, catalog, chapter_of_page,  # noqa: E402
                    chapters, dump_json, load_json, make_edge, timecode)
from srt_parse import parse  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

# модуль -> ключи со списком статей указателя
INDEX_MODULES = {
    "10-names.json": ["names"],
    "11-toponyms.json": ["toponyms"],
    "12-ethnonyms.json": ["ethnonyms"],
    "13-languages.json": ["languages"],
    "14-lexicon.json": ["lexicon", "lexicon_tech", "lexicon_reverse", "subject_index"],
}

MIN_HEAD_LEN = 4          # головы короче 4 знаков связывают всё со всем
MAX_CHAPTERS = 6          # голова, попавшая более чем в 6 глав книги, — шум
MAX_DOC_FREQ = 0.5        # голова, звучащая более чем в половине записей, ничего не различает
QUOTE_PAD = 120
LOOP_RATIO = 0.35         # доля одинаковых реплик, после которой ASR подозревается зацикленным


def head_pages() -> dict[str, list[int]]:
    """Голова → страницы книги. 1299 пар посчитаны прошлым аудитом — не выводить заново."""
    out: dict[str, list[int]] = {}
    for fname, keys in INDEX_MODULES.items():
        data = load_json(MODULES / fname)
        for key in keys:
            for e in data.get(key) or []:
                head = (e.get("head") or "").strip()
                pages = e.get("page_list") or []
                if isinstance(pages, str):
                    pages = [int(x) for x in re.findall(r"\d+", pages)]
                pages = [p for p in pages if isinstance(p, int)]
                if head and pages:
                    out.setdefault(head, [])
                    out[head] = sorted(set(out[head]) | set(pages))
    return out


def build_terms() -> tuple[dict[str, dict], dict[str, int]]:
    """Отфильтрованный словарь голов: голова → {главы, страницы, вес}. Плюс статистика отсева."""
    chs = chapters()
    raw = head_pages()
    terms: dict[str, dict] = {}
    dropped = Counter()
    for head, pages in raw.items():
        if len(head) < MIN_HEAD_LEN:
            dropped["короткая"] += 1
            continue
        ch_pages: dict[str, list[int]] = defaultdict(list)
        for p in pages:
            ch = chapter_of_page(p, chs)
            if ch:
                ch_pages[ch].append(p)
        if not ch_pages:
            dropped["вне глав"] += 1
            continue
        if len(ch_pages) > MAX_CHAPTERS:
            dropped["высокочастотная"] += 1
            continue
        terms[head.lower()] = {
            "head": head,
            "chapters": {k: sorted(v) for k, v in ch_pages.items()},
            # редкая голова весит больше: вес обратно пропорционален разбросу по главам
            "weight": 1.0 / len(ch_pages),
        }
    return terms, dict(dropped)


def looped(cues) -> float:
    """Доля повторов реплик — механический признак «зациклен фрагмент» (риск R-3)."""
    if not cues:
        return 0.0
    texts = Counter(c.text for c in cues)
    return 1 - len(texts) / len(cues)


def read_cues(rec: dict):
    src = SRT_CACHE / f"acc{rec['accession']}.{rec['timecoded']['ext']}"
    if not src.exists():
        return None
    return parse(src.read_text(encoding="utf-8", errors="replace")) or None


def scan(text: str, terms: dict[str, dict]) -> dict[str, int]:
    """Голова → позиция первого вхождения в склеенном тексте расшифровки."""
    return {low: pos for low in terms if (pos := text.find(low)) >= 0}


def main() -> int:
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None

    terms, dropped = build_terms()
    print(f"голов в указателе после фильтра по книге: {len(terms)}  (отсев: {dropped})")

    records = archive_map()
    durations = {v["accession"]: v.get("duration_seconds") or 0 for v in catalog()}

    todo = [r for r in records.values() if r.get("timecoded")]
    if limit:
        todo = todo[:limit]

    # --- фаза 1: что где встречается + документная частота головы ---
    # Расшифровки НЕ держатся в памяти: 171 файл × ~100 КБ в разобранном виде
    # переполняет процесс, а повторный разбор во второй фазе стоит секунды.
    scanned: dict[str, dict] = {}
    doc_freq = Counter()
    for rec in todo:
        cues = read_cues(rec)
        if not cues:
            continue
        hits = scan(" ".join(c.text for c in cues).lower(), terms)
        scanned[rec["accession"]] = {"hits": hits, "loop": looped(cues), "rec": rec}
        doc_freq.update(hits.keys())     # именно ключи: Counter.update(dict) сложил бы позиции

    n_docs = max(1, len(scanned))
    ubiquitous = {low for low, df in doc_freq.items() if df > MAX_DOC_FREQ * n_docs}
    idf = {low: math.log(n_docs / df) for low, df in doc_freq.items() if df}
    print(f"расшифровок прочитано: {n_docs}; голов звучит в них {len(doc_freq)}; "
          f"выброшено как повсеместные {len(ubiquitous)}")

    edges: list[dict] = []
    n_hit = asr_flagged = 0

    # --- фаза 2: оценка по главам с весом «редкость в книге × редкость в корпусе» ---
    for acc, doc in scanned.items():
        hits, loop, rec = doc["hits"], doc["loop"], doc["rec"]
        penalty = 0.5 if loop >= LOOP_RATIO else 1.0
        if penalty < 1.0:
            asr_flagged += 1
        useful = {low: pos for low, pos in hits.items() if low not in ubiquitous}
        if not useful:
            continue
        cues = read_cues(rec)
        if not cues:
            continue
        text = " ".join(c.text for c in cues).lower()

        score: dict[str, float] = defaultdict(float)
        heads_per_ch: dict[str, list[str]] = defaultdict(list)
        first: dict[str, dict] = {}

        for low, pos in useful.items():
            t = terms[low]
            weight = t["weight"] * idf.get(low, 0.0)
            if weight <= 0:
                continue
            for ch, pages in t["chapters"].items():
                score[ch] += weight
                heads_per_ch[ch].append(t["head"])
                if ch not in first or weight > first[ch]["weight"]:
                    at = next((c for c in cues if low in c.text.lower()), None)
                    if at is None:
                        continue
                    quote = text[max(0, pos - QUOTE_PAD): pos + len(low) + QUOTE_PAD]
                    first[ch] = {"weight": weight, "head": t["head"],
                                 "page": pages[0], "start": at.start,
                                 "quote": quote.strip()}
        if not score:
            continue
        n_hit += 1

        total = sum(score.values())
        ranked = sorted(score.items(), key=lambda kv: -kv[1])
        top_ch, top_score = ranked[0]
        second = ranked[1][1] if len(ranked) > 1 else 0.0
        margin = 1 - (second / top_score) if top_score else 0.0

        for ch, sc in ranked[:2]:
            share = sc / total
            if ch != top_ch and (share < 0.15 or sc < 0.5 * top_score):
                continue
            hit = first.get(ch)
            if not hit:
                continue
            distinct = len(set(heads_per_ch[ch]))
            # отрыв от второй главы решает не меньше доли: связь доказывает
            # не «сколько попало», а «насколько это перевесило остальные главы»
            m = margin if ch == top_ch else 0.0
            conf = min(0.95, 0.40 + 0.30 * share + 0.25 * m + 0.02 * min(distinct, 5)) * penalty
            # A4: тайм-код обязан лежать внутри записи
            dur = durations.get(acc) or 0
            start = hit["start"] if (not dur or hit["start"] <= dur) else None
            ev = {
                "term": hit["head"],
                "page": hit["page"],
                "srt": rec["timecoded"]["name"],
                "offset_seconds": round(hit["start"], 2),
                "quote": hit["quote"][:2 * QUOTE_PAD + 60],
                "distinct_terms": distinct,
                "chapter_share": round(share, 3),
                "chapter_margin": round(m, 3),
                "terms_sample": sorted(set(heads_per_ch[ch]))[:12],
            }
            if penalty < 1.0:
                ev["asr_quality"] = f"подозрение на зацикленный фрагмент (повторов {loop:.0%}), уверенность вдвое ниже"
            edges.append(make_edge(acc, ch, "kwic",
                                   "lecture_of" if ch == top_ch else "expands",
                                   conf, ev,
                                   timecode=timecode(start) if start is not None else None))

    dump_json(CW / "edges_pass_b.json", {
        "schema": "bookindex.crosswalk.edges/1",
        "pass": "kwic",
        "terms_after_filter": len(terms),
        "terms_dropped": dropped,
        "terms_ubiquitous_dropped": len(ubiquitous),
        "records_scanned": n_docs,
        "records_with_hits": n_hit,
        "asr_flagged": asr_flagged,
        "edges": edges,
    })

    print(f"расшифровок прочитано      {n_docs}")
    print(f"из них дали попадания      {n_hit}")
    print(f"помечено дефектом ASR      {asr_flagged}")
    print(f"рёбер прохода B            {len(edges)}")
    print(f"  с тайм-кодом             {sum(1 for e in edges if e['timecode'])}")
    print(f"  auto                     {sum(1 for e in edges if e['status'] == 'auto')}")
    print("записано data/crosswalk/edges_pass_b.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
