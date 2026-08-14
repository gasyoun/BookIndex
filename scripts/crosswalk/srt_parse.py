"""Разбор `.srt`/`.vtt` в список реплик `(start_sec, end_sec, text)`.

Формат тривиален, готового в org нет — поэтому пишем свои ~40 строк, а не тянем
зависимость (слой «архитектура», таблица «строить или взять готовое»).

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

TIME = re.compile(
    r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})")
SHORT_TIME = re.compile(r"(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2})[,.](\d{1,3})")
TAG = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class Cue:
    start: float
    end: float
    text: str


def _secs(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms.ljust(3, "0")) / 1000


def parse(raw: str) -> list[Cue]:
    """Терпимо к обоим форматам и к нумерации реплик; пустые реплики отбрасывает."""
    cues: list[Cue] = []
    start = end = None
    buf: list[str] = []

    def flush() -> None:
        if start is not None and buf:
            text = TAG.sub("", " ".join(buf)).strip()
            if text:
                cues.append(Cue(start, end, text))

    for line in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        stripped = line.strip()
        m = TIME.match(stripped) or SHORT_TIME.match(stripped)
        if m:
            flush()
            buf = []
            g = m.groups()
            if len(g) == 8:
                start, end = _secs(*g[:4]), _secs(*g[4:])
            else:                                   # MM:SS,mmm --> MM:SS,mmm
                start, end = _secs("0", *g[:3]), _secs("0", *g[3:])
            continue
        if not stripped or stripped.isdigit() or stripped.upper() == "WEBVTT":
            continue
        buf.append(stripped)
    flush()
    return cues


def full_text(cues: list[Cue]) -> str:
    return " ".join(c.text for c in cues)
