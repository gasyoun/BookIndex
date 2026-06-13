#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a compact, lazy-loadable KWIC index from the lecture transcript corpus.

Flattens data/imports/lectures-v2/transcripts/*.json into a single small JSON the
app fetches on demand when the user runs KWIC over lectures. Kept out of
app_data.json so it never bloats the main 6 MB artifact.

Output: data/lectures_kwic.json
  { "schema": "lectures_kwic/1",
    "videos":   [ {"id": "<yt>", "title": "...", "url": "..."} ],
    "segments": [ [videoIndex, tSeconds|null, "segment text"], ... ] }

Usage:
  python scripts/build_lectures_kwic.py
  python scripts/build_lectures_kwic.py --check   # report counts, write nothing
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
TRANSCRIPTS = os.path.join(ROOT, "data", "imports", "lectures-v2", "transcripts")
OUT = os.path.join(ROOT, "data", "lectures_kwic.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    videos = []
    segments = []
    files = sorted(glob.glob(os.path.join(TRANSCRIPTS, "*.json")))
    for f in files:
        r = json.load(open(f, encoding="utf-8"))
        vi = len(videos)
        videos.append({
            "id": r.get("video_id"),
            "title": r.get("title"),
            "url": r.get("youtube_url"),
        })
        for s in r.get("segments", []):
            text = re.sub(r"\s+", " ", str(s.get("text", ""))).strip()
            if not text:
                continue
            t = s.get("t")
            segments.append([vi, t if isinstance(t, int) else None, text])

    words = sum(len(s[2].split()) for s in segments)
    timecoded = sum(1 for s in segments if s[1] is not None)
    print(f"videos: {len(videos)}  segments: {len(segments)}  timecoded: {timecoded}  words: {words}")

    if args.check:
        print("--check: nothing written")
        return 0

    payload = {
        "schema": "lectures_kwic/1",
        "source": "data/imports/lectures-v2/transcripts/*.json",
        "videos": videos,
        "segments": segments,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    with open(OUT, "rb") as fh:
        assert fh.read(3).hex() != "efbbbf", "BOM"
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)} bytes)")
    return 0


if __name__ == "__main__":
    main()
