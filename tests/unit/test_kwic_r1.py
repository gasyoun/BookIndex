"""R1 substring-false-match rule (H2707 gate / H3198 v4 gold)."""
from __future__ import annotations

import unittest

from scripts.crosswalk.kwic_noise_analysis import r1_substring_false


class TestR1SubstringFalse(unittest.TestCase):
    def test_krit_inside_sanskritskaya(self):
        """The v4 card acc050: index term Крит inside санскритская."""
        self.assertTrue(r1_substring_false(
            "Крит",
            "чтение любого текста понимать, что это и есть санскритская форма выраже",
        ))

    def test_pet_inside_terpet(self):
        self.assertTrue(r1_substring_false("петь", "терпеть"))

    def test_legal_token_is_not_r1(self):
        self.assertFalse(r1_substring_false(
            "творог",
            "ударение творог выдаёт мгновенно и для историка языка",
        ))

    def test_vorog_inside_tvorog_is_r1_but_curator_approved(self):
        """acc161 v4 gold: R1 fires, curator still approved. Do not auto-reject."""
        self.assertTrue(r1_substring_false(
            "ворог",
            "больше того, ударение творог выдаёт мгновенно и для историка языка сво",
        ))


if __name__ == "__main__":
    unittest.main()
