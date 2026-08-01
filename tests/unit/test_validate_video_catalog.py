"""Unit tests for video_catalog unique-id + id↔url guards (H2122 V0)."""

from __future__ import annotations

import unittest

from scripts.validate_content import extract_youtube_id_from_url, validate_video_catalog


class ExtractYoutubeIdTests(unittest.TestCase):
    def test_watch_url(self):
        self.assertEqual(
            extract_youtube_id_from_url("https://youtube.com/watch?v=Tz3T7IxsbLU"),
            "Tz3T7IxsbLU",
        )

    def test_youtu_be(self):
        self.assertEqual(
            extract_youtube_id_from_url("https://youtu.be/xIoXVxahvDY"),
            "xIoXVxahvDY",
        )

    def test_embed(self):
        self.assertEqual(
            extract_youtube_id_from_url("https://www.youtube.com/embed/cJp5ZrnGivw"),
            "cJp5ZrnGivw",
        )


class ValidateVideoCatalogTests(unittest.TestCase):
    def test_ok_unique_matching(self):
        errors: list[str] = []
        warnings: list[str] = []
        data = {
            "video_catalog": [
                {
                    "id": "Tz3T7IxsbLU",
                    "title": "A",
                    "url": "https://youtube.com/watch?v=Tz3T7IxsbLU",
                    "related_entities": [],
                },
                {
                    "id": "xIoXVxahvDY",
                    "title": "B",
                    "url": "https://youtu.be/xIoXVxahvDY",
                    "related_entities": [],
                },
            ]
        }
        validate_video_catalog(data, errors, warnings)
        self.assertEqual(errors, [])

    def test_fails_duplicate_id(self):
        errors: list[str] = []
        warnings: list[str] = []
        data = {
            "video_catalog": [
                {
                    "id": "Tz3T7IxsbLU",
                    "title": "Seminar 08",
                    "url": "https://youtube.com/watch?v=Tz3T7IxsbLU",
                },
                {
                    "id": "Tz3T7IxsbLU",
                    "title": "Seminar 16",
                    "url": "https://youtube.com/watch?v=Tz3T7IxsbLU",
                },
            ]
        }
        validate_video_catalog(data, errors, warnings)
        self.assertTrue(any("duplicate id" in e for e in errors), errors)

    def test_fails_id_url_mismatch(self):
        errors: list[str] = []
        warnings: list[str] = []
        data = {
            "video_catalog": [
                {
                    "id": "WRONGID1",
                    "title": "Mismatch",
                    "url": "https://youtube.com/watch?v=Tz3T7IxsbLU",
                }
            ]
        }
        validate_video_catalog(data, errors, warnings)
        self.assertTrue(any("does not match YouTube id" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
