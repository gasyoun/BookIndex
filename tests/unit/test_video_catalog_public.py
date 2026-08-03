"""Focused tests for the deterministic, privacy-allowlisted video export."""

from __future__ import annotations

import copy
import unittest

from scripts.build_video_catalog_public import (
    CatalogValidationError,
    DEFAULT_APP_DATA,
    DEFAULT_OUTPUT,
    DEFAULT_PIPELINE,
    DEFAULT_REGISTRY,
    DEFAULT_SNAPSHOT,
    build_catalog,
    dump_json,
    load_json,
    validate_catalog,
)


class PublicVideoCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = build_catalog(
            load_json(DEFAULT_SNAPSHOT),
            load_json(DEFAULT_REGISTRY),
            load_json(DEFAULT_APP_DATA),
            load_json(DEFAULT_PIPELINE),
        )

    def mutated(self):
        return copy.deepcopy(self.catalog)

    def test_committed_export_is_deterministic(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), dump_json(self.catalog))

    def test_exact_census_and_accessions(self):
        self.assertEqual(self.catalog["stats"], {
            "source_rows": 192,
            "videos": 175,
            "unique_youtube_ids": 175,
            "unresolved_records": 16,
            "related_resources": 1,
        })
        self.assertEqual(
            [video["accession"] for video in self.catalog["videos"]],
            [f"{number:03d}" for number in range(1, 176)],
        )

    def test_rejects_duplicate_accession(self):
        catalog = self.mutated()
        catalog["videos"][1]["accession"] = catalog["videos"][0]["accession"]
        with self.assertRaisesRegex(CatalogValidationError, "duplicate accession"):
            validate_catalog(catalog)

    def test_rejects_duplicate_youtube_id(self):
        catalog = self.mutated()
        duplicate = catalog["videos"][0]["youtube_id"]
        catalog["videos"][1]["youtube_id"] = duplicate
        catalog["videos"][1]["watch_url"] = f"https://www.youtube.com/watch?v={duplicate}"
        with self.assertRaisesRegex(CatalogValidationError, "duplicate youtube_id"):
            validate_catalog(catalog)

    def test_rejects_forbidden_key(self):
        catalog = self.mutated()
        catalog["videos"][0]["priority"] = "internal"
        with self.assertRaisesRegex(CatalogValidationError, "forbidden keys"):
            validate_catalog(catalog)

    def test_rejects_invalid_transcript_status(self):
        catalog = self.mutated()
        catalog["videos"][0]["transcript_status"] = "in_review"
        with self.assertRaisesRegex(CatalogValidationError, "invalid transcript_status"):
            validate_catalog(catalog)

    def test_rejects_invalid_duration(self):
        catalog = self.mutated()
        catalog["videos"][0]["duration_seconds"] = -1
        with self.assertRaisesRegex(CatalogValidationError, "invalid duration_seconds"):
            validate_catalog(catalog)

    def test_rejects_filename_like_title(self):
        catalog = self.mutated()
        catalog["videos"][0]["title_display"] = "private/final-video.mp4"
        with self.assertRaisesRegex(CatalogValidationError, "filename-like title_display"):
            validate_catalog(catalog)


if __name__ == "__main__":
    unittest.main()
