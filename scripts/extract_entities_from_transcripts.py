#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""C3: link known index entities to lectures, or propose *new* volume-II heads.

Two modes share the same precision filters (surname anchors, epithet denylist,
collision denylist, length floors):

1. **Gazetteer linking** (default with --report / --write): entities already
   exist in app_data; we find WHERE each is spoken and add (entity, video)
   edges with first-mention timecodes. Lexicon* is excluded (too noisy).

2. **Candidate extraction** (--candidates): open extraction of heads *absent*
   from app_data (names with initials, languages, ethnonyms, quoted subjects).
   Writes a reviewable JSON/CSV under data/imports/lectures-v2/ — never merges
   into app_data. An editor promotes approved rows via import_source.py.

Usage:
    python scripts/extract_entities_from_transcripts.py --report
    python scripts/extract_entities_from_transcripts.py --report --type names
    python scripts/extract_entities_from_transcripts.py --write
    python scripts/extract_entities_from_transcripts.py --candidates
    python scripts/extract_entities_from_transcripts.py --candidates --cap 40 --min-count 2
"""
import sys
import os
import re
import csv
import json
import glob
import unicodedata
import argparse
from datetime import datetime, timezone
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA = os.path.join(ROOT, "app_data.json")
TRANSCRIPTS = os.path.join(ROOT, "data", "imports", "lectures-v2", "transcripts")
CANDIDATES_DIR = os.path.join(ROOT, "data", "imports", "lectures-v2")
CANDIDATES_JSON = os.path.join(CANDIDATES_DIR, "entity_candidates.json")
CANDIDATES_CSV = os.path.join(CANDIDATES_DIR, "entity_candidates.csv")

VOWELS = "аеёиоуыэюяь"
# entity types eligible for linking (lexicon* excluded — single common words)
LINK_TYPES = ["names", "toponyms", "ethnonyms", "languages", "subject_index"]
# minimum stemmed-token length to anchor a match, per type
MIN_LEN = {"names": 6, "toponyms": 4, "ethnonyms": 5, "languages": 5, "subject_index": 5}
# surname/heads that collide with common Russian words — never auto-link / never propose
COLLISION_DENY = {
    "блок", "поле", "розов", "белый", "сила", "мороз", "соболь", "волков",
    "зверев", "лебедев", "орлов", "соколов", "воробьёв", "грачёв",
}
# epithets that are common adjectives — anchoring a name on them is noise
NAME_EPITHETS = {"великий", "грозный", "мудрый", "красное", "окаянный", "святой"}
# sentence-filler / discourse words that follow speaker labels and pollute surname capture
SURNAME_JUNK = {
    "он", "она", "они", "это", "вот", "уже", "ещё", "еще", "когда", "если",
    "добро", "спасибо", "здравствуйте", "конечно", "теперь", "потом", "здесь",
    "там", "так", "что", "как", "где", "кто", "чем", "все", "всё", "ну",
    "да", "нет", "мой", "наш", "ваш", "его", "её", "ее", "их", "для",
    "андрей", "анатольевич",  # first names after a wrong-bound surname
    # discourse / ASR-glued false surnames ("Ф. Значит, …")
    "значит", "также", "только", "может", "сейчас", "просто", "между",
    "после", "перед", "около", "через", "однако", "впрочем", "например",
    "действительно", "соответственно", "поэтому", "потому", "тогда",
}
# segments that are production credits, not lecture content
RE_CREDIT_LINE = re.compile(
    r"(?:корректор|редактор\s+субтитров|субтитры|translator|editor)\b",
    re.IGNORECASE,
)
# typical Russian surname morphology (permissive — rejects pure common words)
RE_SURNAME_SHAPE = re.compile(
    r"(?:ов|ев|ёв|ин|ын|ский|цкий|ской|цкой|ич|ук|юк|енко|ко|ая|яя|ий|ый|"
    r"ова|ева|ёва|ина|ына|ихина|ская|цкая)$",
    re.IGNORECASE,
)
# common false-friend ethnonym/language tokens (too short or too common)
ETHNO_DENY = {
    "люди", "русские", "русские", "слова", "формы", "буквы", "глаголы",
    "имена", "вещи", "места", "годы", "века", "дни", "части", "связи",
}
# languages that are common words when stripped of "язык"
LANG_DENY = {"другой", "новый", "старый", "родной", "живой", "мертвый", "мёртвый",
             "любой", "данный", "каждый", "этот", "тот", "свой", "наш", "ваш"}

# Initials + surname: "А. А. Зализняк", "Е.А. Рыбина", "М.\xa0Ю.\xa0Гасунс"
# Single surname only (no trailing word) — avoids "Тихомиров Он".
RE_NAME_INIT = re.compile(
    r"(?<![А-ЯЁа-яёA-Za-z])"
    r"((?:[А-ЯЁ]\.\s*){1,3})"
    r"([А-ЯЁ][а-яё]{2,})"
)
# "X-ский/ая/ое/ие язык(е/а/ом/у/и)"
RE_LANG = re.compile(
    r"\b([А-Яа-яЁё]{4,}ск[а-яё]{1,4})\s+язык(?:[аеиоуы]?|ом|ами)?\b",
    re.IGNORECASE,
)
# ethnonym-ish plurals mid-discourse (capitalized). Endings intentionally
# narrow: -ины/-ены match genitives of -а/-я nouns (Украины, Екатерины) — excluded.
RE_ETHNO = re.compile(
    r"(?<![.!?…]\s)"
    r"(?<!\A)"
    r"\b([А-ЯЁ][а-яё]{3,}(?:цы|ане|яне|иты|ичи|аки|яки|уды|еды))\b"
)
# quoted multiword titles as subject_index seeds
RE_SUBJECT = re.compile(r"«([^»]{5,60})»")
# single-token quotes that are discourse noise, not titles
SUBJECT_SINGLE_DENY_SUFFIX = re.compile(
    r"(?:о|е|а|я|и|ы|ую|ой|ый|ий|ая|ое|ые|ие)$"
)


def weak_name_token(tok):
    """A name head should not be anchored on a patronymic or a common epithet."""
    if tok in NAME_EPITHETS:
        return True
    return bool(re.search(r"(?:ьевич|еевич|евич|ович|инична|ична|овна|евна)$", tok))


def stem_token(tok):
    tok = tok.lower()
    if len(tok) >= 6 and tok[-1] in VOWELS:
        return tok[:-1]
    return tok


def strip_accents(s):
    """Fold transcript stress marks (combining acute) without destroying й/ё.

    Full Mn-strip after NFD would turn й → и (breve is Mn) and break language
    lemmas (древнерусский → древнерусскии). Only strip U+0301 COMBINING ACUTE.
    """
    return s.replace("\u0301", "").replace("´", "")


def clean_head(head):
    """Strip parentheticals/quotes that won't be spoken (e.g. «Велесова книга» (ВК))."""
    h = re.sub(r"\([^)]*\)", " ", str(head or ""))
    h = h.replace("«", " ").replace("»", " ").replace("‑", "-")
    h = h.replace("\xa0", " ").replace("\u202f", " ")
    return re.sub(r"\s+", " ", h).strip()


def normalize_key(head):
    """Case-folded, accent-folded, whitespace-normalized key for dedup vs app_data."""
    h = strip_accents(clean_head(head)).lower()
    h = re.sub(r"\s*\.\s*", ". ", h)  # "А.А." / "А. А." → "а. а."
    h = re.sub(r"\s+", " ", h).strip()
    return h


def build_pattern(head, rtype):
    """Compile a matcher for an index head, or None if it is too weak to link."""
    h = clean_head(head).lower()
    tokens = [t for t in re.findall(r"[а-яёa-z]+", h) if len(t) > 1]
    if not tokens:
        return None
    floor = MIN_LEN.get(rtype, 5)
    # Only personal names anchor on a single surname token. Every other type uses
    # the strict path below, so descriptive index heads (e.g. "Критика «Новой
    # хронологии» А. Т. Фоменко") require the whole phrase and self-filter.
    if rtype == "names":
        surname = max(tokens, key=len)
        if len(surname) < floor or surname in COLLISION_DENY or weak_name_token(surname):
            return None
        return re.compile(r"\b" + re.escape(stem_token(surname)) + r"[а-яё]*", re.IGNORECASE)
    if len(tokens) >= 2:
        # multiword term: all tokens in order, each a stemmed prefix
        return re.compile(r"\b" + r"[\s\-]+".join(re.escape(stem_token(t)) + r"[а-яё]*" for t in tokens),
                          re.IGNORECASE)
    tok = tokens[0]
    if len(tok) < floor or tok in COLLISION_DENY:
        return None
    return re.compile(r"\b" + re.escape(stem_token(tok)) + r"[а-яё]*", re.IGNORECASE)


def load_transcripts(keep_case=False):
    """Load transcripts. keep_case=True preserves casing (needed for open NER)."""
    out = {}
    for f in glob.glob(os.path.join(TRANSCRIPTS, "*.json")):
        r = json.load(open(f, encoding="utf-8"))
        if keep_case:
            segs = [(s["t"], s["text"]) for s in r.get("segments", []) if s.get("t") is not None]
        else:
            segs = [(s["t"], s["text"].lower()) for s in r.get("segments", []) if s.get("t") is not None]
        full = "\n".join(t for _, t in segs)
        out[r["video_id"]] = {"title": r.get("title"), "segments": segs, "full": full}
    return out


def lemma_lang_adj(adj):
    """Approximate Russian adj → nominative masculine (древнерусского → древнерусский)."""
    a = strip_accents(adj).lower()
    # -ский / -цкий family covers nearly all "* язык" adjectives
    case = r"(?:[ое]го|[ое]му|им|ом|их|ых|ий|ие|ая|ое|ую|ой)?"
    m = re.match(r"^(.+ск)" + case + r"$", a)
    if m and len(m.group(1)) >= 4:
        return m.group(1) + "ий"
    m = re.match(r"^(.+цк)" + case + r"$", a)
    if m and len(m.group(1)) >= 3:
        return m.group(1) + "ий"
    # residual hard-stem adjectives
    rules = [
        ("ого", "ый"), ("его", "ий"),
        ("ому", "ый"), ("ему", "ий"),
        ("ым", "ый"), ("им", "ий"),
        ("ом", "ый"), ("ем", "ий"),
        ("ая", "ый"), ("яя", "ий"),
        ("ое", "ый"), ("ее", "ий"),
        ("ые", "ый"), ("ие", "ий"),
        ("ую", "ый"), ("юю", "ий"),
        ("ой", "ый"), ("ей", "ий"),
    ]
    for suf, nom in rules:
        if a.endswith(suf) and len(a) > len(suf) + 3:
            return a[: -len(suf)] + nom
    return a


def build_known_index(app):
    """Heads already in the published index — candidates must not re-propose these.

    Returns:
      known_heads: set of normalize_key(head) across LINK_TYPES
      known_surnames: set of surname stems for names (so А.А.Зализняк ≡ Зализняк А.А.)
      known_lang_stems: lemma forms of language adjectives already indexed
    """
    known_heads = set()
    known_surnames = set()
    known_lang_stems = set()
    for rtype in LINK_TYPES:
        for it in app.get(rtype, []):
            head = it.get("head") or it.get("name") or ""
            if not head:
                continue
            nk = normalize_key(head)
            known_heads.add(nk)
            if rtype == "names":
                tokens = [t for t in re.findall(r"[а-яёa-z]+", nk) if len(t) > 1]
                if tokens:
                    surname = max(tokens, key=len)
                    if len(surname) >= MIN_LEN["names"]:
                        known_surnames.add(stem_token(surname))
            if rtype == "languages":
                # "Французский язык" / "французский" / "древнерусский"
                core = nk.replace(" язык", "").strip()
                tokens = [t for t in re.findall(r"[а-яёa-z]+", core) if len(t) > 2]
                for tok in tokens:
                    known_lang_stems.add(lemma_lang_adj(tok))
                    known_lang_stems.add(stem_token(lemma_lang_adj(tok)))
    # lexicon heads: never propose common words that already sit in the word lists
    for key in ("lexicon", "lexicon_reverse", "lexicon_tech"):
        for it in app.get(key, []):
            head = it.get("head") or it.get("name") or ""
            if head:
                known_heads.add(normalize_key(head))
    return known_heads, known_surnames, known_lang_stems


def format_initials(raw_init):
    """'А.А.' / 'А.\xa0А.\xa0' / 'А. А. ' → 'А. А.'"""
    letters = re.findall(r"[А-ЯЁ]", raw_init)
    return " ".join(f"{c}." for c in letters)


def is_known_name(surname, full_key, known_heads, known_surnames):
    if full_key in known_heads:
        return True
    return stem_token(surname.lower()) in known_surnames


def name_merge_key(surname):
    """Collapse Е. А. Рыбина / Е. Рыбина under one surname stem."""
    return stem_token(strip_accents(surname).lower())


def propose_names(text):
    """Yield (display_head, surname_lower) from initials+surname hits in text."""
    if RE_CREDIT_LINE.search(text):
        return
    for m in RE_NAME_INIT.finditer(text):
        init_raw, surname = m.group(1), m.group(2)
        sur_l = strip_accents(surname).lower()
        if sur_l in SURNAME_JUNK or sur_l in COLLISION_DENY:
            continue
        if len(sur_l) < MIN_LEN["names"] or weak_name_token(sur_l):
            continue
        n_init = len(re.findall(r"[А-ЯЁ]", init_raw))
        # single-initial hits need surname morphology; multi-initial are safer
        if n_init < 2 and not RE_SURNAME_SHAPE.search(sur_l):
            continue
        head = f"{format_initials(init_raw)} {surname}"
        yield head, sur_l


def propose_languages(text):
    for m in RE_LANG.finditer(text):
        adj = strip_accents(m.group(1))
        lemma = lemma_lang_adj(adj)
        if lemma in LANG_DENY or lemma in COLLISION_DENY:
            continue
        if len(lemma) < MIN_LEN["languages"]:
            continue
        # Canonical display: nominative masculine adjective + "язык"
        display = lemma[0].upper() + lemma[1:] + " язык"
        yield display, lemma


def propose_ethnonyms(text):
    """Yield ethnonym-shaped tokens. Precision is low; review sheet must filter."""
    for m in RE_ETHNO.finditer(text):
        form = strip_accents(m.group(1))
        form_l = form.lower()
        if form_l in ETHNO_DENY or form_l in COLLISION_DENY:
            continue
        if len(form_l) < MIN_LEN["ethnonyms"]:
            continue
        # writing-system / text-title false friends
        if any(x in form_l for x in ("кирилл", "глагол", "руниц", "ригвед", "задонщ", "псалт")):
            continue
        # place-name locatives (Таджикистане) and village names often match -ичи/-ане
        if form_l.endswith(("стане", "стане", "ове", "еве", "ине")):
            continue
        yield form, form_l


def subject_dedupe_key(inner):
    """Collapse inflected title variants («Слово/Слова/Слове о полку…»)."""
    bare = strip_accents(inner).lower()
    bare = re.sub(r"\s+", " ", bare).strip()
    # first-word case fold for common title heads
    bare = re.sub(
        r"^(?:слов(?:ом|ами|а|е|у|ы|о)?|книг(?:ами|ой|а|е|у|и)?|"
        r"повест(?:ью|и|ь)?|сказан(?:ием|ия|ии|ие)?)\b",
        "title*",
        bare,
    )
    return bare


def propose_subjects(text):
    for m in RE_SUBJECT.finditer(text):
        inner = clean_head(m.group(1))
        if not inner or len(inner) < 5:
            continue
        # skip pure citations / speaker labels that are just initials
        if re.fullmatch(r"(?:[А-ЯЁ]\.\s*){1,3}[А-ЯЁ][а-яё]+", inner):
            continue
        tokens = [t for t in re.findall(r"[а-яёa-z]+", strip_accents(inner).lower()) if len(t) > 1]
        if not tokens:
            continue
        # single common-word quotes are lexicon noise («неправильно», «слово»)
        if len(tokens) == 1:
            tok = tokens[0]
            if len(tok) < MIN_LEN["subject_index"] or SUBJECT_SINGLE_DENY_SUFFIX.search(tok):
                continue
        # Prefer nominative-looking display when several case forms collapse
        display = f"«{inner}»"
        yield display, subject_dedupe_key(inner)


def run_candidates(app, transcripts, cap_per_type=40, min_count=2, min_videos=1):
    """Open extraction of heads absent from app_data; returns (rows, stats)."""
    known_heads, known_surnames, known_lang_stems = build_known_index(app)

    # key -> accumulator
    # key = (type_guess, display_or_norm)
    acc = {}  # key -> dict

    def touch(type_guess, display, norm_key, vid, t, title, snippet):
        k = (type_guess, norm_key)
        if k not in acc:
            acc[k] = {
                "head": display,
                "type_guess": type_guess,
                "norm": norm_key,
                "mention_count": 0,
                "videos": {},  # vid -> {t, count, title}
                "first_t": None,
                "first_vid": None,
                "evidence": snippet,
            }
        row = acc[k]
        row["mention_count"] += 1
        # prefer longer display; more initials for names; nominative «Слово…» for subjects
        if type_guess == "names":
            # more initials / longer form wins (Е. А. Рыбина > Е. Рыбина)
            if display.count(".") > row["head"].count(".") or (
                display.count(".") == row["head"].count(".") and len(display) > len(row["head"])
            ):
                row["head"] = display
        elif type_guess == "subject_index":
            if display.startswith("«Слово ") and not row["head"].startswith("«Слово "):
                row["head"] = display
            elif len(display) > len(row["head"]) and not row["head"].startswith("«Слово "):
                row["head"] = display
        elif len(display) > len(row["head"]):
            row["head"] = display
        v = row["videos"].setdefault(vid, {"video_id": vid, "t": t, "count": 0, "title": title})
        v["count"] += 1
        if t is not None and (v["t"] is None or t < v["t"]):
            v["t"] = t
        if row["first_vid"] is None:
            row["first_vid"] = vid
            row["first_t"] = t
            row["evidence"] = snippet

    for vid, tr in transcripts.items():
        title = tr.get("title") or vid
        for t, text in tr["segments"]:
            # names — key by surname stem so Е.А.Рыбина ≡ Е.Рыбина
            for head, sur_l in propose_names(text):
                full_key = normalize_key(head)
                if is_known_name(sur_l, full_key, known_heads, known_surnames):
                    continue
                snip = text[max(0, text.lower().find(sur_l) - 20):].strip()[:120]
                touch("names", head, name_merge_key(sur_l), vid, t, title, snip)
            # languages
            for head, lemma in propose_languages(text):
                nkey = normalize_key(head)
                if nkey in known_heads or lemma in known_heads:
                    continue
                if lemma in known_lang_stems or stem_token(lemma) in known_lang_stems:
                    continue
                snip = text.strip()[:120]
                touch("languages", head, nkey, vid, t, title, snip)
            # ethnonyms
            for head, form_l in propose_ethnonyms(text):
                nkey = normalize_key(head)
                if nkey in known_heads:
                    continue
                snip = text.strip()[:120]
                touch("ethnonyms", head, nkey, vid, t, title, snip)
            # subjects (quoted)
            for head, nkey in propose_subjects(text):
                bare = normalize_key(head.strip("«»"))
                if nkey in known_heads or bare in known_heads:
                    continue
                snip = text.strip()[:120]
                # nkey already case-collapsed; use it as the accumulator key
                touch("subject_index", head, nkey, vid, t, title, snip)

    # filter by frequency, cap per type
    by_type_raw = defaultdict(list)
    for row in acc.values():
        if row["mention_count"] < min_count:
            continue
        if len(row["videos"]) < min_videos:
            continue
        by_type_raw[row["type_guess"]].append(row)

    emitted = []
    stats_by_type = {}
    for rtype, rows in by_type_raw.items():
        rows.sort(key=lambda r: (-r["mention_count"], -len(r["videos"]), r["head"]))
        stats_by_type[rtype] = {"raw_passing_floor": len(rows), "emitted": min(len(rows), cap_per_type)}
        for row in rows[:cap_per_type]:
            vids_sorted = sorted(row["videos"].values(), key=lambda v: -v["count"])
            first = row["videos"].get(row["first_vid"], vids_sorted[0] if vids_sorted else {})
            emitted.append({
                "head": row["head"],
                "type_guess": row["type_guess"],
                "mention_count": row["mention_count"],
                "video_count": len(row["videos"]),
                "first_mention": {
                    "video_id": first.get("video_id") or row["first_vid"],
                    "t": first.get("t") if first.get("t") is not None else row["first_t"],
                    "title": first.get("title") or "",
                },
                "videos": [
                    {"video_id": v["video_id"], "t": v["t"], "count": v["count"], "title": v["title"]}
                    for v in vids_sorted[:8]
                ],
                "evidence": (row.get("evidence") or "")[:160],
                "status": "unreviewed",
            })

    emitted.sort(key=lambda r: (r["type_guess"], -r["mention_count"], r["head"]))
    stats = {
        "total_raw_keys": len(acc),
        "total_emitted": len(emitted),
        "by_type": stats_by_type,
        "cap_per_type": cap_per_type,
        "min_count": min_count,
        "min_videos": min_videos,
        "known_heads": len(known_heads),
        "known_surnames": len(known_surnames),
        "known_lang_stems": len(known_lang_stems),
    }
    return emitted, stats


def write_candidates(rows, stats):
    Path(CANDIDATES_DIR).mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "entity_candidates/1",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "lectures-v2",
        "tool": "scripts/extract_entities_from_transcripts.py --candidates",
        "params": {
            "cap_per_type": stats["cap_per_type"],
            "min_count": stats["min_count"],
            "min_videos": stats["min_videos"],
        },
        "stats": stats,
        "note": (
            "Candidates only — not merged into app_data. Human review required before "
            "promotion via data/imports draft + scripts/import_source.py. See "
            "ENTITY_CANDIDATES_README.md for the review protocol."
        ),
        "candidates": rows,
    }
    Path(CANDIDATES_JSON).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with open(CANDIDATES_JSON, "rb") as f:
        assert f.read(3).hex() != "efbbbf", "BOM written"

    with open(CANDIDATES_CSV, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow([
            "head", "type_guess", "mention_count", "video_count",
            "first_video_id", "first_t", "first_title", "evidence", "status",
        ])
        for r in rows:
            fm = r["first_mention"]
            w.writerow([
                r["head"], r["type_guess"], r["mention_count"], r["video_count"],
                fm.get("video_id", ""), fm.get("t", ""), fm.get("title", ""),
                r.get("evidence", ""), r.get("status", "unreviewed"),
            ])
    return CANDIDATES_JSON, CANDIDATES_CSV


def run_link(app, transcripts, types, min_count, do_write):
    """Original gazetteer linking path."""
    gaz = []  # (type, head, pattern)
    for rtype in types:
        for it in app.get(rtype, []):
            head = it.get("head")
            pat = build_pattern(head, rtype)
            if pat:
                gaz.append((rtype, head, pat))

    existing = {}
    for v in app.get("video_catalog", []):
        existing[v.get("id")] = {(r.get("type"), r.get("head")) for r in v.get("related_entities", []) or []}

    candidates = defaultdict(list)
    for vid, tr in transcripts.items():
        full = tr["full"]
        for rtype, head, pat in gaz:
            if (rtype, head) in existing.get(vid, set()):
                continue
            if not pat.search(full):
                continue
            t0 = None
            count = 0
            for t, text in tr["segments"]:
                if pat.search(text):
                    count += 1
                    if t0 is None:
                        t0 = t
            if count >= min_count:
                candidates[vid].append((rtype, head, t0, count))

    total = sum(len(c) for c in candidates.values())
    by_type = defaultdict(int)
    entity_videos = defaultdict(set)
    for vid, lst in candidates.items():
        for rtype, head, t0, count in lst:
            by_type[rtype] += 1
            entity_videos[(rtype, head)].add(vid)

    print(f"new (entity,video) edges: {total}")
    print(f"distinct entities gaining video presence: {len(entity_videos)}")
    print("by type:", dict(by_type))
    top = sorted(entity_videos.items(), key=lambda kv: -len(kv[1]))[:20]
    print("\ntop entities by lecture count:")
    for (rtype, head), vids in top:
        print(f"  {len(vids):3d}  {rtype:13s} {head}")

    print("\nsamples (for precision review):")
    shown = defaultdict(int)
    for vid, lst in candidates.items():
        for rtype, head, t0, count in sorted(lst, key=lambda x: -x[3]):
            if shown[rtype] >= 6:
                continue
            shown[rtype] += 1
            mm, ss = divmod(t0 or 0, 60)
            print(f"  {rtype:13s} {head!r:32s} x{count:<3d} @ {mm}:{ss:02d}  in {transcripts[vid]['title'][:38]}")

    if do_write:
        added = 0
        for v in app.get("video_catalog", []):
            lst = candidates.get(v.get("id"))
            if not lst:
                continue
            rels = v.setdefault("related_entities", [])
            for rtype, head, t0, count in lst:
                edge = {"head": head, "type": rtype, "src": "transcript"}
                if t0 is not None:
                    edge["t"] = t0
                rels.append(edge)
                added += 1
        Path(APP_DATA).write_text(json.dumps(app, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with open(APP_DATA, "rb") as f:
            assert f.read(3).hex() != "efbbbf", "BOM written"
        print(f"\nwrote {added} edges (src=transcript) into app_data.json")
        print("next: npm run data:split && npm run build")
    else:
        print("\n(report only — pass --write to merge edges, or --candidates for new heads)")
    return 0


def main():
    ap = argparse.ArgumentParser(
        description="C3: link known entities to lectures, or extract new volume-II candidates"
    )
    ap.add_argument("--report", action="store_true", help="coverage + samples for gazetteer linking")
    ap.add_argument("--write", action="store_true", help="merge link edges into app_data.json")
    ap.add_argument(
        "--candidates", action="store_true",
        help="extract NEW heads absent from app_data → entity_candidates.{json,csv} (never writes app_data)",
    )
    ap.add_argument("--type", help="restrict linking to one entity type")
    ap.add_argument("--min-count", type=int, default=None,
                    help="min mentions (link default 1; candidates default 2)")
    ap.add_argument("--cap", type=int, default=40, help="max candidates per type (candidates mode)")
    ap.add_argument("--min-videos", type=int, default=1, help="min distinct lectures (candidates mode)")
    args = ap.parse_args()

    if not (args.report or args.write or args.candidates):
        ap.error("pass --report, --write, and/or --candidates")

    app = json.load(open(APP_DATA, encoding="utf-8"))

    if args.candidates:
        min_count = args.min_count if args.min_count is not None else 2
        transcripts = load_transcripts(keep_case=True)
        rows, stats = run_candidates(
            app, transcripts,
            cap_per_type=args.cap,
            min_count=min_count,
            min_videos=args.min_videos,
        )
        jpath, cpath = write_candidates(rows, stats)
        print(f"entity candidates: {stats['total_emitted']} emitted "
              f"(from {stats['total_raw_keys']} raw keys; known heads={stats['known_heads']})")
        print("by type:", stats["by_type"])
        print(f"wrote {jpath}")
        print(f"wrote {cpath}")
        print("\nsample (top by type):")
        shown = defaultdict(int)
        for r in rows:
            if shown[r["type_guess"]] >= 5:
                continue
            shown[r["type_guess"]] += 1
            fm = r["first_mention"]
            mm, ss = divmod(fm.get("t") or 0, 60)
            print(f"  {r['type_guess']:13s} {r['head']!r:36s} "
                  f"x{r['mention_count']:<4d} vids={r['video_count']} "
                  f"@ {mm}:{ss:02d}  {fm.get('title', '')[:36]}")
        print("\n(candidates only — app_data NOT modified; review before import_source.py)")
        if args.write:
            print("NOTE: --write ignored in --candidates mode (refusing silent app_data growth)")
        return 0

    min_count = args.min_count if args.min_count is not None else 1
    transcripts = load_transcripts(keep_case=False)
    types = [args.type] if args.type else LINK_TYPES
    return run_link(app, transcripts, types, min_count, do_write=args.write)


if __name__ == "__main__":
    raise SystemExit(main() or 0)
