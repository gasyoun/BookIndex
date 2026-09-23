"""Guard: the prerender must not read the wall clock.

CI regenerates every prerendered page and diffs it against the committed copy
("Ensure committed build output ... is in sync"). A `new Date()` / `Date.now()`
in scripts/prerender.mjs makes that output depend on the calendar day, so main
goes red the day after any regen - which is exactly what kept main red from
04-09 to 23-09-2026 (citation access date in 689 item pages).
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRERENDER = ROOT / "scripts" / "prerender.mjs"

WALL_CLOCK = re.compile(r"new\s+Date\s*\(\s*\)|Date\.now\s*\(")


def _code_lines(text):
    for lineno, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        yield lineno, line


class PrerenderDeterminismTest(unittest.TestCase):
    def test_prerender_does_not_read_wall_clock(self):
        text = PRERENDER.read_text(encoding="utf-8")
        hits = [f"{n}: {line.strip()}" for n, line in _code_lines(text) if WALL_CLOCK.search(line)]
        self.assertEqual(hits, [], "scripts/prerender.mjs reads the wall clock; committed build output will drift daily:\n" + "\n".join(hits))

    def test_citation_access_date_is_pinned(self):
        text = PRERENDER.read_text(encoding="utf-8")
        self.assertRegex(text, r"const PRERENDER_CITATION_ACCESS_DATE = '\d{2}\.\d{2}\.\d{4}';")


if __name__ == "__main__":
    unittest.main()
