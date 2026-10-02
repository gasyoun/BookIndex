"""Unit tests for scripts/explain_lexicon_reverse_divergence.py (roadmap C4.2).

The synthetic corpus is built so that the raw count difference decomposes
into known components at both identity levels (literal trim and the
runtime's normalizeHeadForMatch), letting the tests pin the closure
identity, the head-set edges, and the report rendering.
"""

from __future__ import annotations

import unittest

from scripts.explain_lexicon_reverse_divergence import (
    EMPTY_HEAD_KEY,
    build_divergence,
    head_key,
    render_markdown,
    runtime_head_key,
)


def item(entity: str, head: str) -> dict:
    return {"canonical_id": f"{entity}-test-{head or 'empty'}", "head": head, "page_list": [1]}


def build_data() -> dict:
    return {
        # 3 items; literal-unique heads {дом, до́м, кот}; runtime-unique {дом, кот}.
        "lexicon": [
            item("lexicon", "дом"),
            item("lexicon", "до́м"),  # combining acute -> same runtime key as "дом"
            item("lexicon", "кот"),
        ],
        # 4 items; literal-unique {дом, -дом, χ}; runtime-unique {дом, χ}.
        # "-дом" matches the lexicon head "дом" after runtime normalization.
        "lexicon_reverse": [
            item("lexicon_reverse", "дом"),
            item("lexicon_reverse", "дом"),
            item("lexicon_reverse", "-дом"),
            item("lexicon_reverse", "χ"),
        ],
    }


class HeadKeyTests(unittest.TestCase):
    def test_head_key_is_literal_trim(self):
        self.assertEqual(head_key("  -то "), "-то")
        self.assertNotEqual(head_key("-то"), head_key("то"))
        self.assertNotEqual(head_key("до́м"), head_key("дом"))

    def test_head_key_total_for_empty(self):
        self.assertEqual(head_key(""), EMPTY_HEAD_KEY)
        self.assertEqual(head_key("   "), EMPTY_HEAD_KEY)

    def test_runtime_head_key_matches_runtime_contract(self):
        self.assertEqual(runtime_head_key("до́м"), runtime_head_key("дом"))
        self.assertEqual(runtime_head_key("-то"), "то")
        self.assertNotEqual(runtime_head_key("кот"), runtime_head_key("дом"))


class BuildDivergenceTests(unittest.TestCase):
    def setUp(self):
        self.div = build_divergence(build_data())
        self.counts = self.div["counts"]

    def test_raw_counts(self):
        self.assertEqual(self.counts["lexicon_total"], 3)
        self.assertEqual(self.counts["lexicon_reverse_total"], 4)
        self.assertEqual(self.counts["raw_delta"], 1)

    def test_literal_view_closure(self):
        # Literal: lexicon 3 unique / 0 dup-extra; reverse 3 unique / 1 dup-extra.
        self.assertEqual(self.counts["lexicon_unique_heads"], 3)
        self.assertEqual(self.counts["lexicon_reverse_unique_heads"], 3)
        self.assertEqual(self.counts["lexicon_duplicate_extra_items"], 0)
        self.assertEqual(self.counts["lexicon_reverse_duplicate_extra_items"], 1)
        self.assertEqual(self.counts["unique_head_delta"], 0)
        self.assertEqual(self.counts["extra_items_delta"], 1)
        self.assertTrue(self.counts["closure_ok"])

    def test_literal_head_set_edges(self):
        head_sets = self.div["head_sets"]
        self.assertEqual(head_sets["shared_heads"], 1)
        # "до́м" (with acute) is lexicon-only at literal identity; it merges
        # with "дом" only under the runtime's normalization.
        self.assertEqual(head_sets["lexicon_only_heads"], ["до́м", "кот"])
        self.assertEqual(head_sets["lexicon_reverse_only_heads"], ["-дом", "χ"])

    def test_runtime_view_closure(self):
        rt = self.counts["runtime_view"]
        # Runtime: lexicon {дом, кот}; reverse {дом, χ}.
        self.assertEqual(rt["lexicon_unique_heads"], 2)
        self.assertEqual(rt["lexicon_reverse_unique_heads"], 2)
        self.assertEqual(rt["lexicon_duplicate_extra_items"], 1)
        self.assertEqual(rt["lexicon_reverse_duplicate_extra_items"], 2)
        self.assertEqual(rt["unique_head_delta"] + rt["extra_items_delta"], rt["raw_delta"])
        self.assertTrue(rt["closure_ok"])

    def test_runtime_matched_reverse_only_heads(self):
        # "-дом" normalizes to "дом", which exists in lexicon.
        self.assertEqual(
            self.div["structure"]["lexicon_reverse_only_runtime_matched"],
            ["-дом"],
        )

    def test_missing_entity_lists_flagged(self):
        div = build_divergence({})
        self.assertFalse(div["source_keys_present"]["lexicon"])
        self.assertFalse(div["source_keys_present"]["lexicon_reverse"])

    def test_empty_heads_still_close(self):
        data = {
            "lexicon": [item("lexicon", ""), item("lexicon", "   ")],
            "lexicon_reverse": [item("lexicon_reverse", "")],
        }
        div = build_divergence(data)
        counts = div["counts"]
        self.assertEqual(counts["raw_delta"], -1)
        # Both empty-ish lexicon heads collapse to the sentinel: 1 unique key
        # with multiplicity 2 (one dup-extra) vs 1 unique in reverse.
        self.assertEqual(counts["unique_head_delta"], 0)
        self.assertEqual(counts["extra_items_delta"], -1)
        self.assertTrue(counts["closure_ok"])


class RenderMarkdownTests(unittest.TestCase):
    def setUp(self):
        self.report = render_markdown(build_divergence(build_data()))

    def test_contains_closure_statement(self):
        self.assertIn("closure_ok: **true**", self.report)

    def test_contains_section_headers(self):
        for header in (
            "## Короткий ответ",
            "## Разложение",
            "## Слагаемое 1",
            "## Слагаемое 2",
            "## Взгляд рантайма",
            "## Сопутствующая структура",
        ):
            self.assertIn(header, self.report)

    def test_lists_reverse_only_heads(self):
        self.assertIn("`-дом`", self.report)
        self.assertIn("`χ`", self.report)

    def test_no_placeholder_leaks(self):
        self.assertNotIn("None", self.report)
        self.assertNotIn("{'", self.report)


if __name__ == "__main__":
    unittest.main()
