#!/usr/bin/env python3
"""Deterministic gate for the brief about-Zaliznyak video sheets (H3973).

Checks three hard char budgets (A, B-Лист 1, B-Лист 2; spaces count,
newlines do not), printed "N/1877" marker parity, ids A ⊆ ids B, and
title/duration parity of every entry against data/video_catalog_public.v2.json.

--emit  rewrite the three "N/1877" markers in the doc to computed values
        and print the per-sheet report;
--check verify only; exit 0 = green, 1 = any failure.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs/VIDEO_ABOUT_ZALIZNYAK_BRIEF_1877_2026.md"
CATALOG = ROOT / "data/video_catalog_public.v2.json"
BUDGET = 1877

# Sheets in the doc: name -> heading prefix.
SHEETS = [
    ("A", "## Вариант A —"),
    ("B1", "### Лист 1 —"),
    ("B2", "### Лист 2 —"),
]
MARKER_RE = re.compile(r"^(\d+)/1877$")
# - accNNN. <title> — <duration>. <Р|З|К>: <annotation>
ENTRY_RE = re.compile(r"^- (acc\d+)\. (.+?) — ((?:\d+ ч )?\d+ мин)\. ([РЗК]): (.+)$")


def canon_duration(seconds) -> str:
    h, rem = divmod(int(seconds), 3600)
    m = rem // 60
    return f"{h} ч {m:02d} мин" if h else f"{m} мин"


def norm_title(s: str) -> str:
    s = s.casefold().replace("ё", "е")
    return "".join(ch for ch in s if ch.isalnum())


def parse_sheets(text: str):
    """Return {name: (printed, computed, body_lines)} or raise SystemExit."""
    lines = text.splitlines()
    out = {}
    for name, head in SHEETS:
        start = next(
            (i for i, ln in enumerate(lines) if ln.startswith(head)), None
        )
        if start is None:
            raise SystemExit(f"FAIL: sheet heading not found: {head}")
        j = start + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        m = MARKER_RE.match(lines[j].strip()) if j < len(lines) else None
        if not m:
            raise SystemExit(f"FAIL: [{name}] printed N/1877 marker not found")
        printed = int(m.group(1))
        j += 1
        body_lines = []
        while j < len(lines) and not lines[j].startswith("#"):
            if lines[j].startswith("_"):  # trailing doc byline ends the last sheet
                break
            if lines[j].strip():
                body_lines.append(lines[j].strip())
            j += 1
        body = "\n".join(body_lines).strip()
        computed = len(body.replace("\n", ""))
        out[name] = (printed, computed, body_lines)
    return out


def entries_of(body_lines):
    entries, bad = [], []
    for ln in body_lines:
        m = ENTRY_RE.match(ln)
        if m:
            entries.append(
                {
                    "acc": m.group(1)[3:],
                    "title": m.group(2),
                    "dur": m.group(3),
                    "level": m.group(4),
                }
            )
        else:
            bad.append(ln)
    return entries, bad


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--check"
    if mode not in ("--emit", "--check"):
        print("usage: count_brief_chars.py --emit|--check")
        return 2

    text = DOC.read_text(encoding="utf-8")
    sheets = parse_sheets(text)
    catalog = {
        r["accession"]: r
        for r in json.loads(CATALOG.read_text(encoding="utf-8"))["videos"]
    }

    parsed, failures = {}, []
    for name, (printed, computed, body_lines) in sheets.items():
        entries, bad = entries_of(body_lines)
        parsed[name] = entries
        label = {"A": "A (1×1877)", "B1": "B Лист 1", "B2": "B Лист 2"}[name]
        print(f"{label}: {computed}/{BUDGET} chars (printed marker {printed}/1877), {len(entries)} entries")
        if bad:
            failures.append(f"{label}: {len(bad)} line(s) do not match the entry format: {bad[:2]}")
        if computed > BUDGET:
            failures.append(f"{label}: budget exceeded {computed} > {BUDGET}")
        if printed != computed:
            failures.append(f"{label}: printed marker {printed} != computed {computed}")

    ids_a = {e["acc"] for e in parsed["A"]}
    ids_b = {e["acc"] for e in parsed["B1"]} | {e["acc"] for e in parsed["B2"]}
    if not ids_a <= ids_b:
        failures.append(f"ids A not subset of ids B: {sorted(ids_a - ids_b)}")

    for name, entries in parsed.items():
        for e in entries:
            rec = catalog.get(e["acc"])
            if rec is None:
                failures.append(f"[{name}] acc{e['acc']}: not in catalog v2")
                continue
            want_dur = canon_duration(rec["duration_seconds"])
            if e["dur"] != want_dur:
                failures.append(
                    f"[{name}] acc{e['acc']}: duration '{e['dur']}' != catalog {want_dur}"
                    f" ({rec['duration_seconds']}s)"
                )
            want_title = norm_title(rec["title_display"])
            got_title = norm_title(e["title"])
            if got_title != want_title:
                failures.append(
                    f"[{name}] acc{e['acc']}: title mismatch vs catalog v2"
                    f" ('{e['title']}' vs '{rec['title_display']}')"
                )
            if e["level"] not in ("Р", "З", "К"):
                failures.append(f"[{name}] acc{e['acc']}: bad level '{e['level']}'")

    if mode == "--emit":
        raw_lines = text.split("\n")
        for name, head in SHEETS:
            printed, computed, _ = sheets[name]
            if printed == computed:
                continue
            start = next(
                i for i, ln in enumerate(raw_lines) if ln.startswith(head)
            )
            j = start + 1
            while not MARKER_RE.match(raw_lines[j].strip()):
                j += 1
            raw_lines[j] = f"{computed}/1877"
        DOC.write_text("\n".join(raw_lines), encoding="utf-8")
        print("--emit: markers rewritten to computed values")
        return 0

    if failures:
        for f in failures:
            print("FAIL:", f)
        return 1
    print("--check: green (3 budgets, subset A⊆B, 0 title/duration mismatches vs catalog v2)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
