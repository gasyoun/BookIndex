"""Fixture suite for the encoding/mojibake guard (H1482).

Every corruption class the guard claims to cover gets a constructed fixture
built by actually performing the corruption, plus negative fixtures drawn from
the kind of text this project really contains.
"""

import unittest

from scripts.check_encoding import (
    MIN_RUN,
    REPLACEMENT_CHAR,
    check_text,
    find_mojibake,
    strip_code_spans,
)


SOURCE_RU = "Проверка кодировки: словарь Зализняка, том 2, страница 43."
SOURCE_MIXED = (
    "Словарь Зализняка (A. A. Zaliznjak, Grammaticheskij slovar', § 12) — ISO 9:1995."
)


def corrupt(text: str, codec: str) -> str:
    """UTF-8 bytes of ``text`` read through the wrong single-byte ``codec``."""

    return text.encode("utf-8").decode(codec, errors="replace")


def corrupt_sloppy(text: str, codec: str) -> str:
    """Same, but bytes undefined in ``codec`` fall back to Latin-1.

    CP1252 leaves five byte values undefined; real-world decoders (browsers,
    Windows APIs, ftfy's "sloppy-windows-1252") pass them through as Latin-1
    rather than losing them, so this is the shape CP1252 mojibake actually
    arrives in. Decoding with ``errors="replace"`` instead is the lossy
    variant, covered separately by the U+FFFD test.
    """

    out = []
    for byte in text.encode("utf-8"):
        chunk = bytes([byte])
        try:
            out.append(chunk.decode(codec))
        except UnicodeDecodeError:
            out.append(chunk.decode("latin-1"))
    return "".join(out)


class MojibakeClassTests(unittest.TestCase):
    """Each corruption class named in the module docstring must be flagged."""

    def assert_flagged(self, text: str, expected_codec: str | None = None) -> None:
        findings = find_mojibake(text)
        self.assertTrue(findings, f"no mojibake detected in {text[:40]!r}")
        if expected_codec is not None:
            self.assertIn(expected_codec, {f.codec for f in findings})
        ok, msg, _ = check_text(text)
        self.assertFalse(ok)
        self.assertIn("mojibake", msg)

    def test_utf8_as_cp1252(self):
        self.assert_flagged(corrupt_sloppy(SOURCE_RU, "cp1252"), "cp1252")

    def test_utf8_as_cp1252_lossy_variant(self):
        # Strict CP1252 cannot represent five byte values; a decoder that
        # replaces them leaves U+FFFD behind as well as the mojibake, so this
        # fixture must produce both signals.
        ok, msg, warnings = check_text(corrupt(SOURCE_RU, "cp1252"))
        self.assertFalse(ok)
        self.assertIn("mojibake", msg)
        self.assertTrue(any("U+FFFD" in w for w in warnings))

    def test_utf8_as_latin1(self):
        self.assert_flagged(corrupt(SOURCE_RU, "latin-1"), "latin-1")

    def test_utf8_as_cp1251(self):
        self.assert_flagged(corrupt(SOURCE_RU, "cp1251"), "cp1251")

    def test_utf8_as_koi8_r(self):
        self.assert_flagged(corrupt(SOURCE_RU, "koi8-r"), "koi8-r")

    def test_utf8_as_cp866(self):
        self.assert_flagged(corrupt(SOURCE_RU, "cp866"), "cp866")

    def test_utf8_as_mac_cyrillic(self):
        self.assert_flagged(corrupt(SOURCE_RU, "mac-cyrillic"), "mac-cyrillic")

    def test_double_utf8_encoding(self):
        # Mojibake re-saved as UTF-8 and read back as UTF-8: the classic
        # double-encoding chain.
        once = SOURCE_RU.encode("utf-8").decode("latin-1")
        twice = once.encode("utf-8").decode("utf-8")
        self.assert_flagged(twice)

    def test_recovers_the_original_text(self):
        findings = find_mojibake(corrupt(SOURCE_RU, "cp1251"))
        joined = "".join(f.recovered for f in findings if f.codec == "cp1251")
        self.assertIn("Проверка", joined)

    def test_legacy_signatures_still_caught(self):
        # The two hardcoded regexes this detector replaced covered exactly this
        # shape; it must not regress.
        legacy = "Р Р°Р±РѕС‚Р° СЃ РєРѕРґРёСЂРѕРІРєРѕР№"
        self.assertTrue(find_mojibake(legacy))


class LossySignalTests(unittest.TestCase):
    def test_replacement_character_warns_but_does_not_fail(self):
        # Legitimate code quotes U+FFFD on purpose (v3_app.js does), so the
        # signal must warn rather than break the build.
        text = "Зализняк, «Русское имен" + REPLACEMENT_CHAR + "ое словоизменение»"
        ok, _, warnings = check_text(text)
        self.assertTrue(ok)
        self.assertTrue(any("U+FFFD" in w for w in warnings))

    def test_marker_silences_a_deliberate_occurrence(self):
        marked = (
            'if (head.includes("' + REPLACEMENT_CHAR + '")) flag(head);'
            "  // encoding-guard: allow-ufffd\n"
        )
        ok, _, warnings = check_text(marked)
        self.assertTrue(ok)
        self.assertEqual(warnings, [])

    def test_marker_is_per_line_not_per_file(self):
        text = (
            'if (head.includes("' + REPLACEMENT_CHAR + '")) flag(head);'
            "  // encoding-guard: allow-ufffd\n"
            "иное слово: " + REPLACEMENT_CHAR + "доска\n"
        )
        _, _, warnings = check_text(text)
        self.assertTrue(warnings[0].startswith("1 U+FFFD"))
        self.assertIn("line 2", warnings[0])

    def test_replacement_character_counted(self):
        text = REPLACEMENT_CHAR.join(["Словарь", "Зализняка", "1980"])
        _, _, warnings = check_text(text)
        self.assertTrue(warnings[0].startswith("2 U+FFFD"))

    def test_nul_bytes(self):
        ok, msg, _ = check_text("Словарь\x00Зализняка")
        self.assertFalse(ok)
        self.assertIn("NUL", msg)

    def test_required_phrase_missing(self):
        ok, msg, _ = check_text("{}", name="app_data.json")
        self.assertFalse(ok)
        self.assertIn("schema_version", msg)


class FalsePositiveTests(unittest.TestCase):
    """Legitimate project text must never be flagged."""

    CLEAN = [
        SOURCE_RU,
        SOURCE_MIXED,
        "Zaliznyak's grammatical dictionary, 2nd ed. (Moscow, 1980), pp. 12-43.",
        "Ударение: за́мок — замо́к; ё вместо е.",
        "Кириллица и латиница: Пётр I, Peter the Great, Πέτρος, ¡Hola!",
        "Цитата: «Русское именное словоизменение» (1967), § 2.3, с. 121.",
        'JSON: {"schema_version": 3, "featured_quote": "Грамматика — это..."}',
        # The CP866 accident this detector was calibrated against: real Russian
        # words whose CP866 bytes happen to form valid UTF-8 (recovering as CJK).
        "Мы углубляем анализ принудительно и последовательно.",
        "Ошибка ввода: ??? — знаки вопроса в разметке.",
        "Тире — длинное, кавычки „ёлочки“ и “лапки”, многоточие…",
    ]

    def test_clean_text_is_not_flagged(self):
        for text in self.CLEAN:
            with self.subTest(text=text[:32]):
                self.assertEqual(find_mojibake(text), [])
                ok, _, _ = check_text(text)
                self.assertTrue(ok)

    def test_short_accidental_runs_below_threshold(self):
        # Two recovered characters is under MIN_RUN and must stay quiet.
        self.assertGreaterEqual(MIN_RUN, 3)
        self.assertEqual(find_mojibake("Ð°Ð±"), [])


class MarkdownTests(unittest.TestCase):
    """Docs may quote mojibake as an example — inside code spans only."""

    def test_fenced_example_is_ignored(self):
        doc = (
            "# Кодировки\n\nПример битого текста:\n\n```\n"
            + corrupt(SOURCE_RU, "cp1251")
            + "\n```\n\nКонец.\n"
        )
        ok, _, _ = check_text(doc, is_markdown=True)
        self.assertTrue(ok)
        # Same content outside a code span is still a failure.
        ok_plain, _, _ = check_text(doc.replace("```", ""), is_markdown=True)
        self.assertFalse(ok_plain)

    def test_inline_example_is_ignored(self):
        doc = "Смотри `" + corrupt(SOURCE_RU, "latin-1") + "` в логе.\n"
        ok, _, _ = check_text(doc, is_markdown=True)
        self.assertTrue(ok)

    def test_offsets_survive_blanking(self):
        doc = "`код`\nстрока два\n"
        self.assertEqual(len(strip_code_spans(doc)), len(doc))
        self.assertEqual(strip_code_spans(doc).count("\n"), doc.count("\n"))


if __name__ == "__main__":
    unittest.main()
