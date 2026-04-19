import unittest

from scripts.issue_quality_guard import detect_text_problems


class IssueQualityGuardTests(unittest.TestCase):
    def test_detects_question_mark_garbage(self):
        text = "v4/????????: KWIC-????????, ????????? ?????? ? Sources ? ????? names"
        problems = detect_text_problems(text, require_template=False)
        self.assertTrue(problems)

    def test_detects_cyrillic_mojibake(self):
        source = "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430: \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 \u0432 \u0438\u0441\u0441\u044c\u044e \u0438\u0441\u043f\u043e\u0440\u0447\u0435\u043d."
        text = source.encode("utf-8").decode("cp1251", errors="ignore")
        problems = detect_text_problems(text, require_template=False)
        self.assertTrue(any("mojibake" in p for p in problems))

    def test_detects_latin1_mojibake(self):
        source = "\u041f\u0440\u0438\u0432\u0435\u0442, \u044d\u0442\u043e \u0441\u043b\u043e\u043c\u0430\u043d\u043d\u0430\u044f \u043a\u043e\u0434\u0438\u0440\u043e\u0432\u043a\u0430."
        text = source.encode("utf-8").decode("latin-1", errors="ignore")
        problems = detect_text_problems(text, require_template=False)
        self.assertTrue(any("mojibake" in p for p in problems))

    def test_ignores_mojibake_inside_inline_code(self):
        text = "Пример в коде: `РёС‚РєРёРЅ`."
        problems = detect_text_problems(text, require_template=False)
        self.assertFalse(any("mojibake" in p for p in problems))

    def test_accepts_normal_russian_template_text(self):
        text = (
            "Цель: исправить автолинковку.\n\n"
            "Критерии готовности:\n"
            "- Линки корректны.\n"
        )
        problems = detect_text_problems(text, require_template=True)
        self.assertEqual([], problems)

    def test_template_mode_flags_missing_sections(self):
        text = "Просто текст без структуры."
        problems = detect_text_problems(text, require_template=True)
        self.assertTrue(any("Цель:" in p for p in problems))
        self.assertTrue(any("Критерии готовности:" in p for p in problems))


if __name__ == "__main__":
    unittest.main()
