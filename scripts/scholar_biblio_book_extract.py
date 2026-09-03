#!/usr/bin/env python3
"""Extract text from scholar-bibliography book files (PDF/DjVu/HTML) and count
chapter topic-terms; pairs with scripts/scholar_biblio_lecture_signals.py.

Usage:
    python scripts/scholar_biblio_book_extract.py FILE [FILE ...]

Files are named <slug>.<ext>; the slug maps to a bibliography work via WORKS.
Scans without a text layer are OCR-sampled (title/TOC + every Nth page) with
tesseract -l rus. Book texts themselves stay OUT of the repo (copyright) —
only per-term counts and page samples are printed to stdout (TSV).

Caution: poppler/pdftotext is banned for Russian PDFs (silent Cyrillic loss);
this script uses PyMuPDF for extraction and fails loud on sanity violations.
"""

from __future__ import annotations

import html as html_mod
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MIN_TEXT_CHARS = 2000
OCR_MAX_PAGES = 80
SANITY_MARKERS = ("язык", "ударени", "слов", "грамот")

TERM_GROUPS = {
    "slovo_order": ["Вакернагел", "энклитик", "клитик", "порядок слов", "Слово о полку"],
    "hist_ling": ["сравнительн", "реконструкц", "праязык", "любительская лингвистика", "глоттохронолог", "Сводеш"],
    "ancient_india": ["санскрит", "ведийск", "Ригвед", "Панини", "древнеиндийск"],
    "hist_rus": ["древнерусск", "история русского языка", "восточнославянск", "редуцированн", "праславянск"],
    "russian_stress": ["ударени", "акцент", "акцентн"],
    "birchbark": ["берестян", "грамот", "Новгород", "палеограф", "Янин", "Гиппиус", "Онфим"],
    "life_of_words": ["этимолог", "происхождение слов", "заимствован"],
    "ili_i_uzhe": ["энклитик", "частиц", "неужел"],
}

WORKS = {
    "ris2002": "hist_rus",
    "ris2002_plus": "hist_rus",
    "opa1985": "russian_stress",
    "opa1985_scan": "russian_stress",
    "dnd2004": "birchbark",
    "slovo2008": "slovo_order",
    "enklitiki2008": "slovo_order",
    "iz_zametok2010": "hist_ling",
    "trudy_akc_t1": "russian_stress",
    "trudy_akc_t2": "russian_stress",
    "drudarenie2014": "russian_stress",
    "ngb_t12": "birchbark",
    "lingv_zadachi": "life_of_words",
    "nkj_2009_1": "hist_ling",
    "nkj_2009_2": "hist_ling",
    "progulki2018": "life_of_words",
    "merilo1990": "russian_stress",
    "grammat_ocherk": "ancient_india",
    "sanskr_konspekt": "ancient_india",
}

def norm(text: str) -> str:
    text = text.replace("ё", "е").replace("Ё", "Е").lower()
    return re.sub(r"\s+", " ", text)

def pdf_text(path: Path) -> tuple[str, int, str]:
    import fitz

    doc = fitz.open(path)
    pages = doc.page_count
    text = "\n".join(page.get_text() for page in doc)
    if len(re.sub(r"\W+", "", text)) >= MIN_TEXT_CHARS:
        return text, pages, "text-layer"
    sample_pages = list(range(min(10, pages)))
    if pages > 10:
        step = max(1, (pages - 10) // (OCR_MAX_PAGES - 10))
        sample_pages += list(range(10, pages, step))[: OCR_MAX_PAGES - 10]
    chunks = []
    for idx in sample_pages:
        pix = doc[idx].get_pixmap(dpi=150)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            pix.save(tmp.name)
            proc = subprocess.run(
                ["tesseract", tmp.name, "stdout", "-l", "rus"],
                capture_output=True,
                text=True,
                check=True,
            )
            chunks.append(proc.stdout)
        Path(tmp.name).unlink(missing_ok=True)
    ocr = "\n".join(chunks)
    mode = "ocr-sample" if len(re.sub(r"\W+", "", ocr)) >= MIN_TEXT_CHARS else "ocr-empty"
    return text + "\n" + ocr, pages, mode

def plain_text(path: Path) -> tuple[str, int, str]:
    raw = path.read_bytes()
    if path.suffix.lower() in (".html", ".htm"):
        for enc in ("utf-8", "windows-1251"):
            try:
                decoded = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            decoded = raw.decode("utf-8", errors="replace")
        decoded = re.sub(r"(?is)<(script|style).*?</\1>", " ", decoded)
        decoded = re.sub(r"<[^>]+>", " ", decoded)
        text = html_mod.unescape(decoded)
    else:
        text = raw.decode("utf-8", errors="replace")
    return text, 0, "html" if path.suffix.lower().startswith(".h") else "txt"

def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    rows = ["work\tfile\tpages\tchars\tmode\tsanity\tterm\thits\tsample_pages"]
    for arg in argv[1:]:
        path = Path(arg)
        slug = path.stem
        if slug not in WORKS:
            print(f"FAIL: unknown work slug: {slug}", file=sys.stderr)
            return 2
        chapter = WORKS[slug]
        if path.suffix.lower() == ".djvu":
            rows.append(f"{slug}\t{path.name}\t0\t0\tno-extractor\tskip\t-\t0\t-")
            continue
        text, pages, mode = plain_text(path) if path.suffix.lower() in (".html", ".htm", ".txt") else pdf_text(path)
        normalized = norm(text)
        alpha = len(re.sub(r"\W+", "", text))
        sanity = "ok" if any(m in normalized for m in SANITY_MARKERS) or alpha >= MIN_TEXT_CHARS else "fail"
        if sanity == "fail":
            print(f"FAIL: sanity check failed for {slug} ({alpha} chars)", file=sys.stderr)
            return 1
        hits_total = 0
        for term in TERM_GROUPS[chapter]:
            hits = normalized.count(norm(term))
            hits_total += hits
            rows.append(f"{slug}\t{path.name}\t{pages}\t{alpha}\t{mode}\t{sanity}\t{term}\t{hits}\t-")
        rows.append(f"{slug}\t{path.name}\t{pages}\t{alpha}\t{mode}\t{sanity}\tTOTAL({chapter})\t{hits_total}\t-")
    print("\n".join(rows))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
