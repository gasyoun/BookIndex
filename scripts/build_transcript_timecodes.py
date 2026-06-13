#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""B3.2: timecode the entity->video backlinks from the transcript corpus.

For every (entity, video) pair in `video_catalog[].related_entities` where the
video has a transcript in `data/imports/lectures-v2/`, find the earliest segment
whose text mentions the entity and write that timecode onto the related-entity
entry as `t` (seconds). The app then deep-links the card's video list to the
minute (`...&t=<sec>s`). Pairs with no transcript or no match keep no `t` and
fall back to a plain link.

Russian matching: each head token is matched as a stemmed word-prefix (drops one
trailing vowel for tokens >=6 chars) so inflected forms hit; multiword heads
require all tokens in order; names with initials match on the surname token.

Usage:
    python scripts/build_transcript_timecodes.py --report   # coverage, write nothing
    python scripts/build_transcript_timecodes.py            # write t into app_data.json
"""
import sys
import os
import re
import json
import glob
import argparse

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA = os.path.join(ROOT, "app_data.json")
TRANSCRIPTS = os.path.join(ROOT, "data", "imports", "lectures-v2", "transcripts")

VOWELS = "аеёиоуыэюяь"
# Heads too generic/noisy to anchor a reliable timecode — skip (no deep link).
HEAD_DENYLIST = {"истора", "андрей", "сторона"}


def stem_token(tok):
    tok = tok.lower()
    if len(tok) >= 6 and tok[-1] in VOWELS:
        return tok[:-1]
    return tok


def head_pattern(head, aliases):
    """Compile a regex that matches the entity head (and aliases) in Russian text."""
    forms = [head] + list(aliases or [])
    alts = []
    for form in forms:
        f = str(form or "").strip().lower()
        if not f:
            continue
        has_initials = bool(re.search(r"[а-яёa-z]\.", f))
        tokens = re.findall(r"[а-яёa-z]+", f)
        tokens = [t for t in tokens if len(t) > 1]  # drop stray initials
        if not tokens:
            continue
        if has_initials and len(tokens) >= 1:
            # personal name: anchor on the longest token (surname)
            surname = max(tokens, key=len)
            alts.append(r"\b" + re.escape(stem_token(surname)) + r"[а-яё]*")
        elif len(tokens) >= 2:
            # multiword term: all tokens in order, each a stemmed prefix
            alts.append(r"\b" + r"[\s\-]+".join(re.escape(stem_token(t)) + r"[а-яё]*" for t in tokens))
        else:
            alts.append(r"\b" + re.escape(stem_token(tokens[0])) + r"[а-яё]*")
    if not alts:
        return None
    return re.compile("|".join(alts), re.IGNORECASE)


def load_transcripts():
    out = {}
    for f in glob.glob(os.path.join(TRANSCRIPTS, "*.json")):
        r = json.load(open(f, encoding="utf-8"))
        # only timecoded segments are useful as link targets
        segs = [(s["t"], s["text"]) for s in r.get("segments", []) if s.get("t") is not None]
        out[r["video_id"]] = segs
    return out


def find_timecode(pattern, segments):
    for t, text in segments:
        if pattern.search(text):
            return t
    return None


def alias_lookup(app):
    """head -> aliases, per entity type, to widen matching."""
    table = {}
    for key in ("names", "toponyms", "ethnonyms", "languages", "lexicon",
                "lexicon_tech", "lexicon_reverse", "subject_index"):
        for it in app.get(key, []):
            table[(key, it.get("head"))] = it.get("aliases") or []
    return table


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true", help="coverage only, write nothing")
    args = ap.parse_args()

    app = json.load(open(APP_DATA, encoding="utf-8"))
    transcripts = load_transcripts()
    aliases = alias_lookup(app)

    pairs = matched = skipped = no_transcript = 0
    by_head = {}
    sample = []
    for v in app.get("video_catalog", []):
        segs = transcripts.get(v.get("id"))
        for rel in v.get("related_entities", []) or []:
            rel.pop("t", None)  # idempotent: clear prior run
            head = rel.get("head")
            rtype = rel.get("type")
            if not segs:
                no_transcript += 1
                continue
            pairs += 1
            if str(head).strip().lower() in HEAD_DENYLIST:
                skipped += 1
                continue
            # subject_index aliases live under subject_index; map type
            akey = (rtype, head)
            pat = head_pattern(head, aliases.get(akey, []))
            if not pat:
                continue
            t = find_timecode(pat, segs)
            if t is not None:
                rel["t"] = t
                matched += 1
                by_head[head] = by_head.get(head, 0) + 1
                if len(sample) < 14:
                    mm, ss = divmod(t, 60)
                    sample.append(f"  {head!r} @ {mm}:{ss:02d} in {v.get('title','')[:42]}")

    print(f"pairs with transcript: {pairs}")
    print(f"  timecoded:  {matched}")
    print(f"  no match:   {pairs - matched - skipped}")
    print(f"  denylisted: {skipped}")
    print(f"pairs without transcript (left plain): {no_transcript}")
    print("by head:", json.dumps(by_head, ensure_ascii=False))
    print("samples:")
    print("\n".join(sample))

    if args.report:
        print("\n--report: app_data.json not modified")
        return 0

    # Match the canonical serialization (scripts/app_data_modules.canonical_json_text):
    # json.dumps(indent=2)+"\n" via write_text, which CRLF-izes on Windows. This keeps
    # the diff to just the added "t" lines instead of reformatting the whole 6 MB file.
    from pathlib import Path
    Path(APP_DATA).write_text(json.dumps(app, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with open(APP_DATA, "rb") as f:
        assert f.read(3).hex() != "efbbbf", "BOM written"
    print(f"\nwrote t onto {matched} related-entity entries in app_data.json")
    print("next: npm run data:split && npm run build")
    return 0


if __name__ == "__main__":
    main()
