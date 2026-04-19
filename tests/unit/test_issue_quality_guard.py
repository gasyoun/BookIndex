import unittest

from scripts.issue_quality_guard import detect_text_problems


class IssueQualityGuardTests(unittest.TestCase):
    def test_detects_question_mark_garbage(self):
        text = "v4/????????: KWIC-????????, ????????? ?????? ? Sources ? ????? names"
        problems = detect_text_problems(text, require_template=False)
        self.assertTrue(problems)

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

