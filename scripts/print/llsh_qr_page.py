#!/usr/bin/env python3
"""Print page "QR ЛЛШ" — 145x215 mm (60/90/16) QR grid of Zaliznyak's LLSH talks.

Reads  data/print/llsh_qr_page.json  and emits:
    print/llsh-qr-page.svg         trim-exact vector page (fonts referenced, not embedded)
    print/llsh-qr-page.html        @page wrapper for headless-Chrome printing

Downstream artifacts (documented recipe, same convention as toponyms_print_map.mjs):
    msedge --headless --disable-gpu --no-pdf-header-footer \
        --print-to-pdf=print/llsh-qr-page.pdf  file://<repo>/print/llsh-qr-page.html
    msedge --headless --disable-gpu --screenshot=print/llsh-qr-page-preview.png \
        --window-size=1713,2539 --default-background-color=FFFFFFFF \
        file://<repo>/print/llsh-qr-page.html

Layout mirrors the authorized-transcripts QR sheet of samskrtam.ru/mt:
header cell + one QR per talk, caption = talk title only.
Requires: python >= 3.9, segno (pure Python).
"""
from __future__ import annotations

import itertools
import json
import sys
from pathlib import Path

try:
    import segno
except ImportError:  # pragma: no cover
    sys.exit("segno is required: pip install segno")

if sys.version_info < (3, 9):  # pragma: no cover
    sys.exit("python >= 3.9 required (pyfloor H3541)")

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "print" / "llsh_qr_page.json"
OUT_DIR = ROOT / "print"

PAGE_W_MM = 145.0
PAGE_H_MM = 215.0
MARGIN_MM = 11.0

HEADER_H_MM = 24.0
GRID_TOP_MM = MARGIN_MM + HEADER_H_MM + 2.5
GRID_BOTTOM_MM = PAGE_H_MM - MARGIN_MM
COLS, ROWS = 3, 4

QR_BOX_MM = 27.0
QR_CAPTION_PT = 7.3
QR_CAPTION_LINE_MM = 3.1

FONT_STACK = "Georgia, 'Times New Roman', serif"

TITLE_LINES = ("Видеозаписи выступлений", "А. А. Зализняка", "на Летней лингвистической школе")
SOURCE_LINE = "mathnet.ru"


def esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def qr_embed(url: str, ec: str, border: int) -> tuple[str, int]:
    """Return (compact fill path `d` in module units, total units incl. border).

    Built from the QR matrix with row runs merged — deterministic full-module
    coverage, immune to stroke half-pixel snapping in rasterisers.
    """
    q = segno.make(url, error=ec)
    parts: list[str] = []
    for y, row in enumerate(q.matrix):
        x = 0
        for is_dark, run in itertools.groupby(row):
            n = len(list(run))
            if is_dark:
                parts.append(f"M{x + border} {y + border}h{n}v1h-{n}z")
            x += n
    units = 17 + 4 * q.version + 2 * border
    return " ".join(parts), units


def wrap_caption(title: str, approx_chars_per_line: int) -> list[str]:
    words, lines, cur = title.split(), [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if len(cand) > approx_chars_per_line and cur:
            lines.append(cur)
            cur = w
        else:
            cur = cand
    if cur:
        lines.append(cur)
    return lines[:4]


def main() -> int:
    cfg = json.loads(DATA.read_text(encoding="utf-8"))
    talks = cfg["talks"]
    if len(talks) > COLS * ROWS:
        sys.exit(f"{len(talks)} talks exceed the {COLS}x{ROWS} grid")

    ec = cfg["qr"]["error_correction"]
    border = cfg["qr"]["border_modules"]

    s: list[str] = []
    s.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{PAGE_W_MM:g}mm" '
        f'height="{PAGE_H_MM:g}mm" viewBox="0 0 {PAGE_W_MM:g} {PAGE_H_MM:g}" '
        f'font-family="{FONT_STACK}">'
    )
    s.append(f'<rect x="0" y="0" width="{PAGE_W_MM:g}" height="{PAGE_H_MM:g}" fill="#fff"/>')

    # --- header cell -------------------------------------------------------
    y = MARGIN_MM + 4.6
    for line in TITLE_LINES:
        s.append(
            f'<text x="{MARGIN_MM}" y="{y:.2f}" font-size="3.45" fill="#000">{esc(line)}</text>'
        )
        y += 4.7
    y += 0.4
    s.append(
        f'<text x="{MARGIN_MM}" y="{y:.2f}" font-size="2.6" fill="#000">{esc(SOURCE_LINE)}</text>'
    )
    hair_y = MARGIN_MM + HEADER_H_MM
    s.append(
        f'<line x1="{MARGIN_MM}" y1="{hair_y:.2f}" x2="{PAGE_W_MM - MARGIN_MM:g}" '
        f'y2="{hair_y:.2f}" stroke="#000" stroke-width="0.25"/>'
    )

    # --- QR grid -----------------------------------------------------------
    cell_w = (PAGE_W_MM - 2 * MARGIN_MM) / COLS
    cell_h = (GRID_BOTTOM_MM - GRID_TOP_MM) / ROWS

    for i, talk in enumerate(talks):
        col, row = i % COLS, i // COLS
        cx = MARGIN_MM + col * cell_w
        cy = GRID_TOP_MM + row * cell_h

        d, units = qr_embed(talk["url"], ec, border)
        module_mm = QR_BOX_MM / units
        qx = cx + (cell_w - QR_BOX_MM) / 2
        qy = cy + 1.6
        s.append(
            f'<g transform="translate({qx:.2f} {qy:.2f}) scale({module_mm:.4f})" '
            f'fill="#000"><path d="{d}" stroke="none"/></g>'
        )

        cap_lines = wrap_caption(talk["title"], 19)
        ty = qy + QR_BOX_MM + 4.0
        for line in cap_lines:
            s.append(
                f'<text x="{cx + cell_w / 2:.2f}" y="{ty:.2f}" text-anchor="middle" '
                f'font-size="{QR_CAPTION_PT / 72 * 25.4:.3f}" fill="#000">{esc(line)}</text>'
            )
            ty += QR_CAPTION_LINE_MM

    s.append("</svg>")

    OUT_DIR.mkdir(exist_ok=True)
    svg_path = OUT_DIR / "llsh-qr-page.svg"
    svg_path.write_text("\n".join(s), encoding="utf-8")

    html_path = OUT_DIR / "llsh-qr-page.html"
    html_path.write_text(
        "<!DOCTYPE html>\n<html><head><meta charset='utf-8'>\n"
        "<style>@page { size: 145mm 215mm; margin: 0; }"
        "html,body { margin: 0; padding: 0; background: #fff; }"
        "svg { display: block; width: 145mm; height: 215mm; }</style>\n"
        "</head><body>\n" + "\n".join(s) + "\n</body></html>\n",
        encoding="utf-8",
    )

    print(f"OK {len(talks)} QR cells -> {svg_path.relative_to(ROOT)}, {html_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
