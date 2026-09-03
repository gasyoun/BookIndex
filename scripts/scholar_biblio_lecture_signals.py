#!/usr/bin/env python3
"""Topic-signal evidence: are the 8 bibliography chapters of «Из жизни слов и языков»
treated in the lectures-v2 video transcripts, with timecodes?

Chapter→video mapping seed: docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md
(sections «Утверждено куратором» = approved, «Машинные кандидаты» = auto).
Video corpus: data/imports/lectures-v2/transcripts/*.json (schema lecture_transcript/1).
Title source: data/lectures_kwic.json (schema lectures_kwic/1, videos[].id/.title).

Python >= 3.9, stdlib only. Run:  python scripts/scholar_biblio_lecture_signals.py
"""
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DOC_PATH = REPO_ROOT / "docs" / "READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md"
TRANSCRIPT_DIR = REPO_ROOT / "data" / "imports" / "lectures-v2" / "transcripts"
KWIC_PATH = REPO_ROOT / "data" / "lectures_kwic.json"
SCRATCH_OUT = Path(r"C:\Users\user\AppData\Local\Temp\opencode\scholar-verify\lecture_signals.tsv")

CHAPTER_TERMS = {
    "Порядок слов": ["Вакернагел", "энклитик", "клитик", "«порядок слов»", "«Слово о полку»"],
    "Историческая лингвистика": ["сравнительн", "реконструкц", "праязык", "«любительская лингвистика»", "глоттохронолог", "Сводеш"],
    "Древняя Индия": ["санскрит", "ведийск", "Ригвед", "Панини", "древнеиндийск", "«Древняя Индия»"],
    "История русского языка": ["древнерусск", "«история русского языка»", "восточнославянск", "редуцированн", "праславянск"],
    "Из русского ударения": ["ударени", "акцент", "«акцентн»"],
    "Берестяные грамоты": ["берестян", "грамот", "Новгород", "палеограф", "Янин", "Гиппиус", "Онфим"],
    "О жизни слов": ["этимолог", "«происхождение слов»", "заимствован"],
    "Или и уже": ["энклитик", "частиц", "неужел"],
}

BRIDGES = {
    # Единственное видео раздела §2 гид-документа (kpClft2Lz2o) отсутствует в корпусе
    # транскриптов lectures-v2. Мост: видео из того же гид-документа (утверждены в §6/§9,
    # §1/§5, §8), несущие сигналы термин-листа главы; корпусная проверка показывает,
    # что энклитик/клитик-дискуссия в корпусе живёт именно в 3xK_iAkr3rY и DT2grBrX7u4.
    "Порядок слов": [
        ("hkaJuyLERgE", "guide §6/§9 approved; chapter term «Слово о полку»; guide §2 video kpClft2Lz2o has no transcript"),
        ("fo10NKM_0JM", "guide §6/§9 approved; chapter term «Слово о полку»; guide §2 video kpClft2Lz2o has no transcript"),
        ("3xK_iAkr3rY", "guide §1/§5; corpus-wide the strongest энклитик signal (6 hits), topic = Слово о полку research"),
        ("DT2grBrX7u4", "guide §8 machine candidate; corpus-wide the strongest клитик signal (12) + энклитик (5); guide §2 links word order to the ударение-course context"),
    ],
}


def fail(msg):
    raise SystemExit(f"FAIL: {msg}")


def norm(s):
    return s.casefold().replace("ё", "е")


def parse_term(term):
    return norm(term).strip("«»")


def parse_guide(doc_text):
    """chapter -> {'approved': [video_id...], 'auto': [video_id...]} in doc order."""
    section_re = re.compile(r"^##\s+\d+\.\s+(.+?)\s+\(стр\. .*$")
    want = set(CHAPTER_TERMS)
    sections = {}
    current = None
    status = None
    for line in doc_text.splitlines():
        m = section_re.match(line)
        if m or line.startswith("## "):
            title = m.group(1).strip() if m else None
            current = title if title in want else None
            status = None
            continue
        if current is None:
            continue
        if line.startswith("### Утверждено куратором"):
            status = "approved"
            continue
        if line.startswith("### Машинные кандидаты"):
            status = "auto"
            continue
        if status and line.startswith("|"):
            ids = re.findall(r"watch\?v=([A-Za-z0-9_-]{6,})", line)
            bucket = sections.setdefault(current, {"approved": [], "auto": []})
            for vid in ids:
                if vid not in bucket[status]:
                    bucket[status].append(vid)
    missing = want - set(sections)
    if missing:
        fail(f"guide sections not found for chapters: {sorted(missing)}")
    for ch, bucket in sections.items():
        if not bucket["approved"]:
            fail(f"guide section «{ch}» has empty approved table")
    return sections


def load_transcripts():
    files = sorted(TRANSCRIPT_DIR.glob("*.json"))
    if not files:
        fail(f"no transcript files under {TRANSCRIPT_DIR}")
    transcripts = {}
    quirks = {"untimed_segments": 0, "untimed_by_video": {}}
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schema") != "lecture_transcript/1":
            fail(f"{path.name}: unexpected schema {data.get('schema')!r}")
        vid = data.get("video_id")
        if not vid:
            fail(f"{path.name}: missing video_id")
        if vid in transcripts:
            fail(f"{path.name}: duplicate video_id {vid}")
        if path.stem != vid:
            fail(f"{path.name}: filename stem != video_id {vid}")
        segs = []
        for seg in data.get("segments", []):
            if not isinstance(seg, dict) or not isinstance(seg.get("text"), str):
                fail(f"{path.name}: malformed segment {seg!r}")
            t = seg.get("t")
            if t is None:
                quirks["untimed_segments"] += 1
                quirks["untimed_by_video"][vid] = quirks["untimed_by_video"].get(vid, 0) + 1
                continue
            if not isinstance(t, (int, float)):
                fail(f"{path.name}: segment t is {type(t).__name__}, expected number/None")
            segs.append((int(t), norm(seg["text"])))
        transcripts[vid] = {"title": data.get("title", ""), "segments": segs}
    return transcripts, quirks


def load_kwic_titles():
    data = json.loads(KWIC_PATH.read_text(encoding="utf-8"))
    if data.get("schema") != "lectures_kwic/1":
        fail(f"{KWIC_PATH.name}: unexpected schema {data.get('schema')!r}")
    titles = {}
    for v in data.get("videos", []):
        titles[v["id"]] = v.get("title", "")
    return titles


def count_hits(segments, term):
    """Return (hits, [timecodes mm:ss ...]) for normalized term over timecoded segments."""
    total = 0
    times = []
    for t, text in segments:
        n = text.count(term)
        if n:
            total += n
            times.extend([t] * n)
    return total, times


def fmt_tc(sec):
    m, s = divmod(int(sec), 60)
    return f"{m:02d}:{s:02d}"


def fmt_tcs(times, limit=3):
    seen = []
    for t in times:
        tc = fmt_tc(t)
        if tc not in seen:
            seen.append(tc)
        if len(seen) == limit:
            break
    return ";".join(seen)


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    guide = parse_guide(DOC_PATH.read_text(encoding="utf-8"))
    transcripts, quirks = load_transcripts()
    kwic_titles = load_kwic_titles()

    mapping = {}
    print("== CHAPTER -> VIDEOS MAPPING (guide seed x transcript corpus) ==")
    print("chapter\tvideo_id\tsource\tvideo_title")
    for chapter, terms in CHAPTER_TERMS.items():
        bucket = guide[chapter]
        doc_ids = [(vid, "approved") for vid in bucket["approved"]] + [
            (vid, "auto") for vid in bucket["auto"]
        ]
        mapped = [(vid, src) for vid, src in doc_ids if vid in transcripts]
        if not mapped:
            mapped = [(vid, "bridge") for vid, _ in BRIDGES.get(chapter, []) if vid in transcripts]
            if not mapped:
                fail(f"chapter «{chapter}» maps to 0 videos with transcripts")
        dropped = len(doc_ids) - len([1 for vid, _ in doc_ids if vid in transcripts])
        mapping[chapter] = mapped
        for vid, src in mapped:
            title = kwic_titles.get(vid) or transcripts[vid]["title"]
            if vid not in kwic_titles:
                print(f"WARN: {vid} not in lectures_kwic.json, using transcript title", file=sys.stderr)
            print(f"{chapter}\t{vid}\t{src}\t{title}")
        print(f"-- {chapter}: {len(mapped)} transcript videos ({dropped} guide videos lack transcripts)", file=sys.stderr)

    rows = []
    matrix = {}
    examples = {}
    for chapter, terms in CHAPTER_TERMS.items():
        matrix[chapter] = {}
        chapter_examples = []
        for term in terms:
            pat = parse_term(term)
            term_total = 0
            for vid, _src in mapping[chapter]:
                segs = transcripts[vid]["segments"]
                hits, times = count_hits(segs, pat)
                title = kwic_titles.get(vid) or transcripts[vid]["title"]
                rows.append(
                    {
                        "chapter": chapter,
                        "video_id": vid,
                        "video_title": title,
                        "term": term,
                        "hits": hits,
                        "example_timecodes": fmt_tcs(times),
                    }
                )
                term_total += hits
                if hits:
                    chapter_examples.append((hits, term, vid, times))
            matrix[chapter][term] = term_total
        chapter_examples.sort(key=lambda x: (-x[0], x[1]))
        examples[chapter] = chapter_examples[:3]

    SCRATCH_OUT.parent.mkdir(parents=True, exist_ok=True)
    cols = ["chapter", "video_id", "video_title", "term", "hits", "example_timecodes"]
    with SCRATCH_OUT.open("w", encoding="utf-8", newline="") as fh:
        fh.write("\t".join(cols) + "\n")
        for r in rows:
            fh.write(
                "\t".join(
                    str(r[c]).replace("\t", " ").replace("\n", " ") for c in cols
                )
                + "\n"
            )

    print("\n== HIT MATRIX (chapter x term, totals over mapped videos) ==")
    for chapter, terms in CHAPTER_TERMS.items():
        parts = "; ".join(f"{term}={matrix[chapter][term]}" for term in terms)
        print(f"{chapter} [{len(mapping[chapter])} videos]\t{parts}")

    print("\n== STRONGEST EXAMPLES PER CHAPTER (top rows with timecodes) ==")
    for chapter in CHAPTER_TERMS:
        print(f"-- {chapter}")
        for hits, term, vid, times in examples[chapter]:
            tcs = fmt_tcs(times).replace(";", ", ")
            print(f"   {term}: {hits} hits, e.g. {vid} @ {tcs}")

    zero_chapters = [c for c in CHAPTER_TERMS if sum(matrix[c].values()) == 0]
    print(f"\nTSV written: {SCRATCH_OUT} ({len(rows)} rows)")
    print(
        f"Quirks: {quirks['untimed_segments']} untimed segments excluded from counting/examples "
        f"({', '.join(f'{k}:{v}' for k, v in sorted(quirks['untimed_by_video'].items())) or 'none'}); "
        f"substring overlap known: «клитик»⊂«энклитик», «акцентн»⊂«акцент», «грамот» also hits «грамотный»; "
        f"chapters with zero total hits: {zero_chapters or 'none'}"
    )
    if zero_chapters:
        print("WARN: zero-signal chapters present (see matrix above)", file=sys.stderr)


if __name__ == "__main__":
    main()
