#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""C1: ingest the Whisper/edited lecture transcripts as a timecoded corpus.

Source of truth for *which* transcripts exist and their proof-reading stage is
`data/video_pipeline.json` (built by migrate_video_pipeline.py). Each video with
a `links.text` points at a public Yandex.Disk .docx of the edited transcript.
The edited .docx preserves timecode markers (HH:MM:SS / MM:SS on their own line),
so we get both KWIC-ready prose AND per-segment timecodes in one pass.

Output (reviewable, diffable JSON — the raw .docx is NOT committed):
    data/imports/lectures-v2/transcripts/<video_id>.json   one record per lecture
    data/imports/lectures-v2/index.json                    corpus index + stats

This corpus feeds:
  * B3.2 — deep video links `?t=<sec>` from `segments[].t`
  * C3   — entity extraction per lecture (heads + minute references)
  * KWIC over the lecture corpus

Usage:
    python scripts/ingest_transcripts.py            # fetch all reachable transcripts
    python scripts/ingest_transcripts.py --limit 3  # first N (smoke)
    python scripts/ingest_transcripts.py --id <vid> # one video by youtube id
    python scripts/ingest_transcripts.py --offline   # re-extract from raw/ cache only
"""
import sys
import os
import re
import io
import json
import time
import zipfile
import argparse
import urllib.parse
import urllib.request
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIPELINE = os.path.join(ROOT, "data", "video_pipeline.json")
CORPUS_DIR = os.path.join(ROOT, "data", "imports", "lectures-v2")
TRANSCRIPTS_DIR = os.path.join(CORPUS_DIR, "transcripts")
RAW_DIR = os.path.join(CORPUS_DIR, "raw")            # gitignored .docx cache
INDEX = os.path.join(CORPUS_DIR, "index.json")

API = "https://cloud-api.yandex.net/v1/disk/public/resources"
DL = "https://cloud-api.yandex.net/v1/disk/public/resources/download"
UA = {"User-Agent": "BookIndex-ingest/1.0 (+https://github.com/gasyoun/BookIndex)"}

TIMECODE_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$")


def _get_json(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def extract_links(cell):
    """A migrated spreadsheet cell may hold several URLs plus prose annotations
    (multi-part lectures). Return the list of distinct Yandex public URLs."""
    urls = re.findall(r"https?://disk\.yandex\.[a-z.]+/[di]/[^\s]+", str(cell or ""))
    seen, out = set(), []
    for u in urls:
        u = u.rstrip(".,;)")
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def split_public_link(link):
    """Yandex public links may embed a sub-path: /d/<token>/inner/file.ext.
    The public API wants the root key (/d/<token> or /i/<token>) plus a `path`.
    Returns (root_public_key, inner_path_or_None).
    """
    m = re.match(r"(https?://disk\.yandex\.[a-z.]+/[di]/[^/]+)(/.*)?$", link)
    if not m:
        return link, None
    root, inner = m.group(1), m.group(2)
    return root, (urllib.parse.unquote(inner) if inner else None)


def resolve_public(link):
    """Resolve a Yandex public link to a downloadable transcript resource.

    Returns (download_href, source_name, sibling_files) or (None, reason, []).
    Handles direct file links, deep links with an inner path, and folders.
    """
    public_key, inner = split_public_link(link)
    pk_q = urllib.parse.quote(public_key, safe="")
    # Deep link straight to a file inside a public folder.
    if inner and re.search(r"\.(docx?|txt|srt|vtt)$", inner, re.I):
        href = _get_json(f"{DL}?public_key={pk_q}&path={urllib.parse.quote(inner, safe='')}")["href"]
        return href, inner.rsplit("/", 1)[-1], []
    meta = _get_json(f"{API}?public_key={pk_q}&limit=200"
                     + (f"&path={urllib.parse.quote(inner, safe='')}" if inner else ""))
    if meta.get("type") == "file":
        name = meta.get("name", "")
        dl = f"{DL}?public_key={pk_q}" + (f"&path={urllib.parse.quote(inner, safe='')}" if inner else "")
        href = _get_json(dl)["href"]
        return href, name, []
    # directory: choose the best transcript file inside
    items = (meta.get("_embedded") or {}).get("items", [])
    files = [it for it in items if it.get("type") == "file"]
    docx = [it for it in files if str(it.get("name", "")).lower().endswith(".docx")]
    candidates = docx or [it for it in files if str(it.get("name", "")).lower().endswith((".txt", ".doc", ".srt", ".vtt"))]
    extras = [it.get("name") for it in files if it not in candidates]
    if not candidates:
        return None, f"no transcript file in folder ({len(files)} files)", extras
    # prefer the most advanced reading stage encoded in the filename
    def stage_rank(n):
        n = n.lower()
        for kw, r in (("вёрст", 6), ("верст", 6), ("предвёрст", 5), ("предверст", 5),
                      ("треть", 4), ("втор", 3), ("перв", 2), ("сверк", 1)):
            if kw in n:
                return r
        return 0
    candidates.sort(key=lambda it: stage_rank(it.get("name", "")), reverse=True)
    pick = candidates[0]
    path = pick.get("path")  # path within the public resource
    q = f"{DL}?public_key={urllib.parse.quote(public_key, safe='')}&path={urllib.parse.quote(path or '/' + pick['name'], safe='')}"
    href = _get_json(q)["href"]
    other = [it.get("name") for it in candidates[1:]] + extras
    return href, pick.get("name", ""), other


def download(href):
    req = urllib.request.Request(href, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def srt_segments(blob):
    """Parse .srt/.vtt subtitle bytes into [{t, text}] segments (native timecodes)."""
    text = blob.decode("utf-8", "replace").replace("\r\n", "\n").replace("﻿", "")
    segs = []
    tc = re.compile(r"(\d{1,2}):(\d{2}):(\d{2})[,.]\d{1,3}\s*-->")
    for block in re.split(r"\n\s*\n", text):
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if not lines:
            continue
        start = None
        body = []
        for ln in lines:
            m = tc.search(ln)
            if m:
                start = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            elif not re.fullmatch(r"\d+", ln.strip()) and "-->" not in ln:
                body.append(ln.strip())
        if body:
            segs.append({"t": start, "text": " ".join(body).strip()})
    return segs


def docx_paragraphs(blob):
    """Extract non-empty paragraph texts from a .docx blob using stdlib only."""
    z = zipfile.ZipFile(io.BytesIO(blob))
    xml = z.read("word/document.xml").decode("utf-8", "replace")
    out = []
    for p in re.split(r"</w:p>", xml):
        # join all run texts in the paragraph, then strip remaining tags
        runs = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)
        txt = re.sub(r"<[^>]+>", "", "".join(runs))
        txt = (txt.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
               .replace("&quot;", '"').replace("&#39;", "'")).strip()
        if txt:
            out.append(txt)
    return out


def tc_to_seconds(m):
    a, b, c = m.group(1), m.group(2), m.group(3)
    if c is not None:
        return int(a) * 3600 + int(b) * 60 + int(c)
    return int(a) * 60 + int(b)  # MM:SS


def build_segments(paragraphs):
    """Fold [timecode, text, text, timecode, ...] into [{t, text}] segments."""
    segments = []
    cur_t = None
    buf = []

    def flush():
        if buf:
            text = " ".join(buf).strip()
            if text:
                segments.append({"t": cur_t, "text": text})

    for para in paragraphs:
        m = TIMECODE_RE.match(para)
        if m:
            flush()
            cur_t = tc_to_seconds(m)
            buf = []
        else:
            buf.append(para)
    flush()
    return segments


STAGE_LABELS = {
    "queued": "в очереди", "transcribed": "автотранскрибация", "review": "сверка",
    "read1": "первая читка", "read2": "вторая читка", "read3": "третья читка",
    "prelayout": "предвёрстка", "layout": "вёрстка", "done": "готово",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="only first N transcripts")
    ap.add_argument("--id", help="only this youtube id")
    ap.add_argument("--offline", action="store_true", help="re-extract from raw/ cache; no network")
    args = ap.parse_args()

    pipeline = json.load(open(PIPELINE, encoding="utf-8"))
    todo = [v for v in pipeline["videos"] if v.get("id") and (v.get("links") or {}).get("text")]
    if args.id:
        todo = [v for v in todo if v["id"] == args.id]
    if args.limit:
        todo = todo[:args.limit]

    os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    index = []
    ok = fail = 0
    for v in todo:
        vid = v["id"]
        cell = v["links"]["text"]
        links = extract_links(cell) or [cell]
        notes = []
        try:
            def blob_to_segments(blob):
                if blob[:2] == b"PK":  # docx is a zip
                    return build_segments(docx_paragraphs(blob))
                if b"-->" in blob[:4000] or blob[:6].lower() == b"webvtt":
                    return srt_segments(blob)
                return build_segments([ln for ln in blob.decode("utf-8", "replace").splitlines() if ln.strip()])

            segments = []
            source_files = []
            part_errors = []
            for pi, link in enumerate(links):
                raw_path = os.path.join(RAW_DIR, vid + (f".part{pi}" if pi else "") + ".bin")
                if args.offline:
                    if not os.path.exists(raw_path):
                        part_errors.append(f"no cache for part {pi}")
                        continue
                    blob = open(raw_path, "rb").read()
                    source_name = f"part{pi}"
                else:
                    try:
                        href, source_name, other = resolve_public(link)
                    except Exception as pe:  # noqa: BLE001
                        part_errors.append(f"{link[:50]}: {repr(pe)[:50]}")
                        continue
                    if href is None:
                        part_errors.append(f"{link[:50]}: {source_name}")
                        continue
                    notes += other
                    blob = download(href)
                    with open(raw_path, "wb") as f:
                        f.write(blob)
                part_segs = blob_to_segments(blob)
                if len(links) > 1:
                    for s in part_segs:
                        s["part"] = pi
                segments.extend(part_segs)
                source_files.append(source_name)
            if not segments:
                raise RuntimeError("; ".join(part_errors) or "no segments")
            if part_errors:
                notes += [f"unfetched: {e}" for e in part_errors]
            source_name = " | ".join(source_files)
            timed = [s for s in segments if s["t"] is not None]
            full_text = "\n".join(s["text"] for s in segments)
            record = {
                "schema": "lecture_transcript/1",
                "video_id": vid,
                "title": v.get("title"),
                "youtube_url": v.get("youtube_url"),
                "review_stage": v.get("stage"),
                "review_stage_label": STAGE_LABELS.get(v.get("stage"), v.get("stage")),
                "stage_inferred": bool(v.get("stage_inferred")),
                "source": {"link": cell, "links": links, "file": source_name,
                           "provider": "yandex-disk-public", "sibling_files": notes},
                "fetched_at": fetched_at,
                "stats": {
                    "segments": len(segments),
                    "timecoded_segments": len(timed),
                    "chars": len(full_text),
                    "words": len(full_text.split()),
                    "duration_covered_sec": (timed[-1]["t"] if timed else None),
                },
                "segments": segments,
            }
            out_path = os.path.join(TRANSCRIPTS_DIR, vid + ".json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
                f.write("\n")
            with open(out_path, "rb") as f:
                assert f.read(3).hex() != "efbbbf", "BOM written"
            index.append({
                "video_id": vid, "title": v.get("title"),
                "review_stage": v.get("stage"),
                "segments": record["stats"]["segments"],
                "timecoded": record["stats"]["timecoded_segments"],
                "words": record["stats"]["words"],
                "file": f"transcripts/{vid}.json",
            })
            ok += 1
            tail = f"  (+{len(notes)} sibling files)" if notes else ""
            print(f"[ok]  {v.get('stage'):11s} {record['stats']['timecoded_segments']:4d} tc  "
                  f"{record['stats']['words']:6d} w  {v.get('title','')[:48]}{tail}")
        except Exception as e:  # noqa: BLE001
            fail += 1
            print(f"[FAIL] {vid}  {v.get('title','')[:48]}  -> {repr(e)[:120]}", file=sys.stderr)

    index.sort(key=lambda r: (r["title"] or "").lower())
    payload = {
        "schema": "lecture_transcript_index/1",
        "source": "data/video_pipeline.json links.text (public Yandex.Disk .docx)",
        "fetched_at": fetched_at,
        "stats": {
            "transcripts": len(index),
            "total_words": sum(r["words"] for r in index),
            "total_timecoded_segments": sum(r["timecoded"] for r in index),
            "by_stage": _count_by(index, "review_stage"),
        },
        "transcripts": index,
    }
    with open(INDEX, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"\n{ok} ok, {fail} failed.  index -> {os.path.relpath(INDEX, ROOT)}  "
          f"({payload['stats']['total_words']} words, "
          f"{payload['stats']['total_timecoded_segments']} timecoded segments)")
    return 0 if ok else 1


def _count_by(rows, key):
    from collections import Counter
    return dict(Counter(r[key] for r in rows))


if __name__ == "__main__":
    sys.exit(main())
