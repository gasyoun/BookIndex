#!/usr/bin/env python3
"""Guard against invalid UTF-8 and mojibake in project files.

Detection method (H1482 redesign, 31-07-2026)
---------------------------------------------
Mojibake is UTF-8 bytes that were decoded with the wrong single-byte legacy
codec. The detector therefore *reverses the accident* instead of matching
byte signatures: for every candidate legacy codec it re-encodes the text back
to bytes and looks for runs of well-formed UTF-8 multi-byte sequences. Three
or more such sequences in a row that decode to letters cannot plausibly occur
in correctly-encoded text, but occur by construction in mojibake.

One re-encode plus one regex scan per codec, so cost is linear in file size and
independent of how many corruption signatures we want to cover.

Corruption classes covered
--------------------------
* UTF-8 misdecoded as CP1252 / Latin-1  (the classic ``Ð``/``Ñ`` mojibake)
* UTF-8 misdecoded as CP1251            (Windows Cyrillic, ``Р``/``С``)
* UTF-8 misdecoded as KOI8-R
* UTF-8 misdecoded as CP866             (DOS Cyrillic)
* UTF-8 misdecoded as Mac Cyrillic
* Double UTF-8 encoding (mojibake re-encoded as UTF-8) — caught by the
  Latin-1/CP1252 pass, which is exactly what that chain leaves behind
* Invalid UTF-8 byte sequences and NUL bytes
* Required-phrase loss (a file silently truncated or re-saved wrong)

All of the above fail the check. U+FFFD replacement characters (the signature
of a lossy conversion) are reported as a *warning* instead: legitimate source
quotes the character on purpose — ``v3_app.js`` tests for it when building the
quality queue — so failing on it would block merges on correct code. Pass
``--strict`` to promote warnings to failures.

Not covered on purpose: single mis-encoded characters (one bad sequence is
indistinguishable from a legitimate rare glyph at this threshold) and
non-UTF-8 source encodings that were never UTF-8 to begin with.

Prior art
---------
``ftfy`` is the canonical Python mojibake library and its core trick is the
same round-trip. Measured against ftfy 6.3.1 on the fixtures in
``tests/unit/test_check_encoding.py``, it flags the Latin-1/CP1252, CP1251,
double-UTF-8 and U+FFFD classes but returns ``is_bad() == False`` for the
KOI8-R, CP866 and Mac-Cyrillic misdecodes — three of the six classes this
project ingests Russian text through. Adding a runtime dependency that covers
half the requirement was not worth it, so the round-trip is implemented here
against an explicit codec list. See ``docs/ENCODING_GUARD.md``.

A lighter, GitHub-API-oriented variant of this check lives in
``scripts/issue_quality_guard.py`` (it works on issue bodies, not files).
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys
from typing import Iterable, NamedTuple


DEFAULT_FILES = [
    "v3_template.html",
    "v3_app.js",
    "app_data.json",
]

REQUIRED_PHRASES = {
    "v3_template.html": [
        "Content-Security-Policy",
        "leaflet.css",
        "__APP_DATA_JSON__",
    ],
    "v3_app.js": [
        "Книга в цифрах",
        "KWIC-конкорданс",
    ],
    "app_data.json": [
        '"schema_version"',
        '"featured_quote"',
    ],
}

# Legacy single-byte codecs a UTF-8 stream is realistically misdecoded as in
# this project's ingestion paths (Wikidata API, .docx/.srt transcripts, GitHub
# issue forms). All are single-byte charmaps, so one input character always
# encodes to exactly one byte — that 1:1 mapping is what lets a byte offset be
# reported as a character offset below.
LEGACY_CODECS = (
    "cp1252",
    "latin-1",
    "cp1251",
    "koi8-r",
    "cp866",
    "mac-cyrillic",
)

# A well-formed UTF-8 multi-byte sequence (2-4 bytes). Overlong forms and
# surrogates are excluded by the lead-byte ranges.
_UTF8_SEQ = (
    rb"(?:[\xC2-\xDF][\x80-\xBF]"
    rb"|\xE0[\xA0-\xBF][\x80-\xBF]"
    rb"|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}"
    rb"|\xED[\x80-\x9F][\x80-\xBF]"
    rb"|\xF0[\x90-\xBF][\x80-\xBF]{2}"
    rb"|[\xF1-\xF3][\x80-\xBF]{3}"
    rb"|\xF4[\x80-\x8F][\x80-\xBF]{2})"
)

# How many consecutive recovered characters make a finding. Three is the point
# where an accidental match stops being plausible: it needs six or more bytes
# of correctly-encoded text to line up as consecutive well-formed UTF-8
# sequences. Calibrated against the committed corpus — 5592 files
# (app_data.json, data/modules/*.json, the built artifacts, README.md,
# docs/**/*.md) — which produces zero findings at 2, 3 and 4.
MIN_RUN = 3

# Of those recovered characters, how many must be plausible letters. A run of
# recovered punctuation or box-drawing glyphs is noise, not decoded prose.
MIN_LETTERS = 3

# Scripts this project's text can legitimately be recovered *into*. Russian
# words encoded to CP866 do sometimes form valid UTF-8 by accident, but they
# decode to CJK ideographs — a corpus of Russian and transliterated Latin never
# recovers into CJK, Hangul, private-use or astral planes, so requiring a
# plausible target script removes exactly that class of false positive.
# Measured: without this filter the committed corpus produces 9 false
# positives (e.g. "углубляем" -> CJK via CP866); with it, zero.
PLAUSIBLE_LETTER_RANGES = (
    (0x00C0, 0x024F),  # Latin-1 Supplement, Latin Extended-A/B
    (0x0370, 0x03FF),  # Greek
    (0x0400, 0x04FF),  # Cyrillic
    (0x0500, 0x052F),  # Cyrillic Supplement
    (0x1E00, 0x1EFF),  # Latin Extended Additional
)

_FENCED_CODE_RE = re.compile(r"```.*?```", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")

_MARKDOWN_SUFFIXES = {".md", ".markdown"}

# Built from its code point so this file never carries a literal U+FFFD (which
# would make the guard flag its own source).
REPLACEMENT_CHAR = chr(0xFFFD)

# A line carrying this marker may hold U+FFFD on purpose — the app's own quality
# queue tests for the character, and that is not a defect. Per line, never
# per file, so an unmarked occurrence elsewhere in the same file still reports.
ALLOW_UFFFD_MARKER = "encoding-guard: allow-ufffd"


class Finding(NamedTuple):
    codec: str
    offset: int
    source: str
    recovered: str


def _is_plausible_letter(ch: str) -> bool:
    """True if ``ch`` is a letter this corpus could plausibly be recovered as."""

    if not ch.isalpha():
        return False
    point = ord(ch)
    return any(low <= point <= high for low, high in PLAUSIBLE_LETTER_RANGES)


def _sequence_re(min_run: int) -> re.Pattern[bytes]:
    return re.compile(b"(?:" + _UTF8_SEQ + b"){" + str(min_run).encode() + b",}")


def strip_code_spans(text: str) -> str:
    """Blank out Markdown code spans, preserving offsets.

    Documentation legitimately quotes mojibake as an example (this module's own
    docstring does). Those live in fenced or inline code, so docs are scanned
    with code spans replaced by spaces of equal length — offsets in findings
    still point at the real file position.
    """

    def blank(match: re.Match[str]) -> str:
        return "".join(" " if ch != "\n" else "\n" for ch in match.group(0))

    return _INLINE_CODE_RE.sub(blank, _FENCED_CODE_RE.sub(blank, text))


def find_mojibake(text: str, min_run: int = MIN_RUN) -> list[Finding]:
    """Return mojibake findings, one per (codec, run), in file order.

    For each candidate legacy codec: re-encode the text (unencodable
    characters become ``?``, which can never start a UTF-8 sequence, so they
    only ever break runs — never create them), then look for runs of
    ``min_run`` or more consecutive well-formed UTF-8 sequences. Such a run
    means those characters were UTF-8 bytes read through the wrong codec.
    """

    pattern = _sequence_re(min_run)
    findings: list[Finding] = []

    for codec in LEGACY_CODECS:
        try:
            raw = text.encode(codec, errors="replace")
        except LookupError:  # pragma: no cover - codec always present in CPython
            continue

        for match in pattern.finditer(raw):
            try:
                recovered = match.group(0).decode("utf-8")
            except UnicodeDecodeError:  # pragma: no cover - regex guarantees validity
                continue
            if sum(1 for ch in recovered if _is_plausible_letter(ch)) < MIN_LETTERS:
                continue
            # Single-byte codec: byte offset == character offset.
            start = match.start()
            findings.append(
                Finding(
                    codec=codec,
                    offset=start,
                    source=text[start : match.end()],
                    recovered=recovered,
                )
            )

    findings.sort(key=lambda f: (f.offset, f.codec))
    return findings


def iter_targets(raw_files: Iterable[str]) -> list[pathlib.Path]:
    targets: list[pathlib.Path] = []
    for raw in raw_files:
        path = pathlib.Path(raw)
        if path.exists() and path.is_file():
            targets.append(path)
            continue
        print(f"[ERROR] File not found: {path}")
    return targets


def check_text(
    text: str, *, name: str = "", is_markdown: bool = False
) -> tuple[bool, str, list[str]]:
    """Check already-decoded text. Returns (ok, message, warnings)."""

    warnings: list[str] = []

    if REPLACEMENT_CHAR in text:
        # U+FFFD is a *warning*, not a failure: legitimate code quotes it (the
        # app's own quality queue tests for it), so hard-failing here would
        # block merges on correct source. Promote with --strict; silence a
        # deliberate occurrence with the per-line marker.
        hits = [
            (number, line)
            for number, line in enumerate(text.split("\n"), start=1)
            if REPLACEMENT_CHAR in line and ALLOW_UFFFD_MARKER not in line
        ]
        if hits:
            count = sum(line.count(REPLACEMENT_CHAR) for _, line in hits)
            number, line = hits[0]
            index = line.index(REPLACEMENT_CHAR)
            snippet = line[max(0, index - 20) : index + 20]
            warnings.append(
                f"{count} U+FFFD replacement character(s); "
                f"first at line {number} near: {snippet!r}"
            )

    if "\x00" in text:
        return False, "contains NUL bytes", warnings

    for phrase in REQUIRED_PHRASES.get(name, []):
        if phrase not in text:
            return False, f"missing required phrase: {phrase!r}", warnings

    scanned = strip_code_spans(text) if is_markdown else text
    findings = find_mojibake(scanned)
    if findings:
        first = findings[0]
        line = scanned.count("\n", 0, first.offset) + 1
        return (
            False,
            (
                f"{len(findings)} mojibake run(s); first at line {line} "
                f"(UTF-8 read as {first.codec}): {first.source!r} -> {first.recovered!r}"
            ),
            warnings,
        )

    return True, "ok", warnings


def check_file(path: pathlib.Path) -> tuple[bool, str, list[str]]:
    data = path.read_bytes()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        return False, f"invalid UTF-8 ({exc})", []

    return check_text(
        text,
        name=path.name,
        is_markdown=path.suffix.lower() in _MARKDOWN_SUFFIXES,
    )


# Backwards-compatible alias: this name predates the redesign and is referenced
# from docs and workflow notes.
check_utf8 = check_file


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check files for UTF-8 integrity and mojibake."
    )
    parser.add_argument("files", nargs="*", help="Files to validate")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings (U+FFFD) as failures.",
    )
    parser.add_argument(
        "--warn-only",
        action="store_true",
        help="Report problems but always exit 0 (for non-blocking CI passes).",
    )
    args = parser.parse_args()

    files = args.files if args.files else DEFAULT_FILES
    targets = iter_targets(files)
    if not targets:
        print("[ERROR] No valid files to check.")
        return 0 if args.warn_only else 1

    failed = False
    warned = False
    for target in targets:
        ok, msg, warnings = check_file(target)
        for warning in warnings:
            warned = True
            print(f"[WARN] {target}: {warning}")
        if ok:
            print(f"[OK] {target}: {msg}")
        else:
            failed = True
            print(f"[FAIL] {target}: {msg}")

    if args.strict and warned:
        failed = True

    if failed:
        if args.warn_only:
            print("[RESULT] Encoding check found problems (warn-only, not failing).")
            return 0
        print("[RESULT] Encoding check failed.")
        return 1

    if warned:
        print("[RESULT] Encoding check passed with warnings.")
        return 0

    print("[RESULT] Encoding check passed.")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    sys.exit(main())
