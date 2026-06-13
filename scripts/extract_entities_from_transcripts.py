#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""C3: link known index entities to the lectures that mention them.

This is gazetteer-based entity *linking*, not open NER: the entities already
exist (the book index — names, toponyms, ethnonyms, languages, subject terms);
we find WHERE in the transcript corpus each is spoken, and add the (entity,
video) edge — with a first-mention timecode — to `video_catalog[].related_entities`.
That expands the reverse video links (B3.1) and their deep timecodes (B3.2) from
the ~48 hand-curated entities across the whole index.

Auto-added edges are flagged `"src": "transcript"` so they stay distinguishable
from the original curated edges and remain reviewable/trust-tierable.

Single common words (lexicon*) are deliberately excluded — too noisy. Names are
matched on a surname stem with a length floor and a collision denylist.

Usage:
    python scripts/extract_entities_from_transcripts.py --report
    python scripts/extract_entities_from_transcripts.py --report --type names
    python scripts/extract_entities_from_transcripts.py --write
"""
import sys
import os
import re
import json
import glob
import argparse
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA = os.path.join(ROOT, "app_data.json")
TRANSCRIPTS = os.path.join(ROOT, "data", "imports", "lectures-v2", "transcripts")

VOWELS = "аеёиоуыэюяь"
# entity types eligible for linking (lexicon* excluded — single common words)
LINK_TYPES = ["names", "toponyms", "ethnonyms", "languages", "subject_index"]
# minimum stemmed-token length to anchor a match, per type
MIN_LEN = {"names": 6, "toponyms": 4, "ethnonyms": 5, "languages": 5, "subject_index": 5}
# surname/heads that collide with common Russian words — never auto-link
COLLISION_DENY = {
    "блок", "поле", "розов", "белый", "сила", "мороз", "соболь", "волков",
    "зверев", "лебедев", "орлов", "соколов", "воробьёв", "грачёв",
}
# epithets that are common adjectives — anchoring a name on them is noise
NAME_EPITHETS = {"великий", "грозный", "мудрый", "красное", "окаянный", "святой"}


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


def clean_head(head):
    """Strip parentheticals/quotes that won't be spoken (e.g. «Велесова книга» (ВК))."""
    h = re.sub(r"\([^)]*\)", " ", str(head or ""))
    h = h.replace("«", " ").replace("»", " ").replace("‑", "-")
    return re.sub(r"\s+", " ", h).strip()


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


def load_transcripts():
    out = {}
    for f in glob.glob(os.path.join(TRANSCRIPTS, "*.json")):
        r = json.load(open(f, encoding="utf-8"))
        segs = [(s["t"], s["text"].lower()) for s in r.get("segments", []) if s.get("t") is not None]
        full = "\n".join(t for _, t in segs)
        out[r["video_id"]] = {"title": r.get("title"), "segments": segs, "full": full}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true", help="coverage + samples, write nothing")
    ap.add_argument("--write", action="store_true", help="merge edges into app_data.json")
    ap.add_argument("--type", help="restrict to one entity type (for inspection)")
    ap.add_argument("--min-count", type=int, default=1, help="min mentions in a lecture to link")
    args = ap.parse_args()

    app = json.load(open(APP_DATA, encoding="utf-8"))
    transcripts = load_transcripts()

    types = [args.type] if args.type else LINK_TYPES
    # compile patterns for the gazetteer
    gaz = []  # (type, head, pattern)
    for rtype in types:
        for it in app.get(rtype, []):
            head = it.get("head")
            pat = build_pattern(head, rtype)
            if pat:
                gaz.append((rtype, head, pat))

    # existing edges per video, to avoid duplicates
    existing = {}
    for v in app.get("video_catalog", []):
        existing[v.get("id")] = {(r.get("type"), r.get("head")) for r in v.get("related_entities", []) or []}

    # candidate edges: video_id -> list of (type, head, t, count)
    candidates = defaultdict(list)
    for vid, tr in transcripts.items():
        full = tr["full"]
        for rtype, head, pat in gaz:
            if (rtype, head) in existing.get(vid, set()):
                continue  # already linked (curated or B3.2)
            if not pat.search(full):
                continue
            t0 = None
            count = 0
            for t, text in tr["segments"]:
                if pat.search(text):
                    count += 1
                    if t0 is None:
                        t0 = t
            if count >= args.min_count:
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

    # samples per type for precision sanity (esp. names)
    print("\nsamples (for precision review):")
    shown = defaultdict(int)
    for vid, lst in candidates.items():
        for rtype, head, t0, count in sorted(lst, key=lambda x: -x[3]):
            if shown[rtype] >= 6:
                continue
            shown[rtype] += 1
            mm, ss = divmod(t0 or 0, 60)
            print(f"  {rtype:13s} {head!r:32s} x{count:<3d} @ {mm}:{ss:02d}  in {transcripts[vid]['title'][:38]}")

    if args.write:
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
        from pathlib import Path
        Path(APP_DATA).write_text(json.dumps(app, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with open(APP_DATA, "rb") as f:
            assert f.read(3).hex() != "efbbbf", "BOM written"
        print(f"\nwrote {added} edges (src=transcript) into app_data.json")
        print("next: npm run data:split && npm run build")
    else:
        print("\n(report only — pass --write to merge)")
    return 0


if __name__ == "__main__":
    main()
