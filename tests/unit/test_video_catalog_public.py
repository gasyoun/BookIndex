"""Focused tests for the deterministic, privacy-allowlisted video export."""

from __future__ import annotations

import copy
import unittest

from scripts.build_video_catalog_public import (
    CatalogValidationError,
    DEFAULT_APP_DATA,
    DEFAULT_EDITORIAL,
    DEFAULT_OUTPUT,
    DEFAULT_OUTPUT_V2,
    DEFAULT_PIPELINE,
    DEFAULT_REGISTRY,
    DEFAULT_SNAPSHOT,
    apply_editorial,
    build_catalog,
    build_exports,
    dump_json,
    humanize_display_title,
    is_filename_like_title,
    load_json,
    validate_catalog,
    validate_editorial,
)


class PublicVideoCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = load_json(DEFAULT_SNAPSHOT)
        cls.registry = load_json(DEFAULT_REGISTRY)
        cls.app_data = load_json(DEFAULT_APP_DATA)
        cls.pipeline = load_json(DEFAULT_PIPELINE)
        cls.editorial = load_json(DEFAULT_EDITORIAL)
        cls.base_catalog = build_catalog(
            cls.snapshot,
            cls.registry,
            cls.app_data,
            cls.pipeline,
        )
        cls.catalog, cls.catalog_v2 = build_exports(
            cls.snapshot,
            cls.registry,
            cls.app_data,
            cls.pipeline,
            cls.editorial,
        )

    def mutated(self):
        return copy.deepcopy(self.catalog)

    def test_committed_export_is_deterministic(self):
        self.assertEqual(DEFAULT_OUTPUT.read_text(encoding="utf-8"), dump_json(self.catalog))
        self.assertEqual(DEFAULT_OUTPUT_V2.read_text(encoding="utf-8"), dump_json(self.catalog_v2))

    def test_exact_census_and_accessions(self):
        self.assertEqual(self.catalog["stats"], {
            "source_rows": 192,
            "videos": 176,
            "unique_youtube_ids": 176,
            "unresolved_records": 1,
            "related_resources": 1,
        })
        self.assertEqual(self.catalog_v2["stats"], {
            **self.catalog["stats"],
            "reconciled_records": 14,
        })
        self.assertEqual(
            [video["accession"] for video in self.catalog["videos"]],
            [f"{number:03d}" for number in range(1, 177)],
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

    def test_rejects_hyphen_delimited_source_name_as_display(self):
        raw = "А-А-Зализняк-Грамматический-строй-санскрита-Лекция-1-13-09-2014-МГУ"
        self.assertTrue(is_filename_like_title(raw))
        catalog = self.mutated()
        catalog["videos"][0]["title_display"] = raw
        with self.assertRaisesRegex(CatalogValidationError, "filename-like title_display"):
            validate_catalog(catalog)

    def test_humanizes_filename_style_without_changing_title_source(self):
        raw = "А-А-Зализняк-Грамматический-строй-санскрита-Лекция-1-13-09-2014-МГУ"
        self.assertEqual(
            humanize_display_title(raw),
            "А. А. Зализняк Грамматический строй санскрита Лекция 1 13 09 2014 МГУ",
        )
        video = next(item for item in self.base_catalog["videos"] if item["accession"] == "060")
        self.assertEqual(video["title_source"], raw)
        self.assertEqual(video["title_display"], humanize_display_title(raw))

    def test_title_review_ledger_has_exact_golden_decisions(self):
        reviews = self.editorial["title_reviews"]
        self.assertEqual(len(reviews), 68)
        self.assertEqual(sum(row["decision"] == "overridden" for row in reviews), 67)
        accepted = [row for row in reviews if row["decision"] == "accepted_generated"]
        self.assertEqual(
            [(row["accession"], row["youtube_id"], row["evidence"]) for row in accepted],
            [("109", "NRd6Aua4CKo", [])],
        )

    def test_overlay_preserves_identity_and_source_title(self):
        immutable_fields = ("accession", "youtube_id", "watch_url", "title_source")
        for base, merged in zip(self.base_catalog["videos"], self.catalog_v2["videos"], strict=True):
            self.assertEqual(
                {field: base[field] for field in immutable_fields},
                {field: merged[field] for field in immutable_fields},
            )

    def test_v1_shape_remains_backward_compatible(self):
        self.assertEqual(
            (self.catalog["schema"], self.catalog["version"]),
            ("video_catalog_public/1", 1),
        )
        self.assertNotIn("editorial_file", self.catalog["source"])
        self.assertNotIn("reconciled_records", self.catalog)
        self.assertNotIn("reconciled_records", self.catalog["stats"])
        for base, merged in zip(self.base_catalog["videos"], self.catalog["videos"], strict=True):
            self.assertLessEqual(set(base), set(merged))
            self.assertLessEqual(
                set(merged) - set(base),
                {"contributors", "date_recorded", "upload_date"},
            )
            changed = {
                field for field in set(base) & set(merged) if base[field] != merged[field]
            }
            self.assertLessEqual(
                changed,
                {"title_display", "last_verified_at"},
            )
        for unresolved in self.catalog["unresolved_records"]:
            self.assertTrue(
                {"status", "public_summary", "checked_at", "evidence"}.isdisjoint(unresolved)
            )
        self.assertEqual(
            self.catalog["stats"]["source_rows"],
            len(self.catalog["videos"]) + 1 + 14 + len(self.catalog["related_resources"]),
        )

    def test_v2_evidence_and_last_verified_are_derived(self):
        evidenced = [video for video in self.catalog_v2["videos"] if video["evidence"]]
        self.assertEqual(len(evidenced), 70)
        for video in evidenced:
            self.assertEqual(video["last_verified_at"], "2026-08-04")
        self.assertEqual(
            sum(
                any("title_display" in evidence["supports"] for evidence in video["evidence"])
                for video in evidenced
            ),
            69,
        )
        accession_109 = next(
            video for video in self.catalog_v2["videos"] if video["accession"] == "109"
        )
        self.assertEqual(accession_109["evidence"], [])
        self.assertIsNone(accession_109["last_verified_at"])

    def test_research_ledger_keeps_all_original_rows_and_resolves_fifteen(self):
        research = self.editorial["unresolved_research"]
        self.assertEqual(
            [row["source_row"] for row in research],
            [49, 50, 58, 59, 60, 62, 63, 64, 65, 66, 67, 68, 69, 70, 73, 75],
        )
        self.assertEqual(sum(row["status"] == "resolved" for row in research), 15)
        unresolved = [row for row in research if row["status"] == "unresolved"]
        self.assertEqual([row["source_row"] for row in unresolved], [66])
        self.assertEqual(
            [row["source_row"] for row in self.catalog_v2["unresolved_records"]],
            [66],
        )
        self.assertEqual(len(self.editorial["reconciled_records"]), 14)
        self.assertEqual(len(self.catalog_v2["reconciled_records"]), 14)

    def test_row_75_is_a_new_video_not_a_reconciliation(self):
        video = next(row for row in self.catalog_v2["videos"] if row["accession"] == "176")
        self.assertEqual(video["youtube_id"], "spqW9cz7Gk0")
        self.assertEqual(video["duration_seconds"], 4706)
        self.assertEqual(video["upload_date"], "2019-10-26")
        self.assertEqual(video["date_recorded"], "2017-05-20")
        self.assertEqual(
            video["contributors"],
            [{"name": "А. А. Зализняк", "role": "lecturer"}],
        )
        self.assertNotIn(75, {row["source_row"] for row in self.catalog_v2["reconciled_records"]})

    def test_identity_preserving_title_corrections(self):
        expected = {
            "046": (
                "Tz3T7IxsbLU",
                "Зализняк. История русского ударения. Семинар 6. 15.10.2016",
            ),
            "054": (
                "xIoXVxahvDY",
                "Зализняк. История русского ударения. Семинар 22. 25.03.2017",
            ),
        }
        by_accession = {video["accession"]: video for video in self.catalog_v2["videos"]}
        for accession, (youtube_id, title) in expected.items():
            self.assertEqual(by_accession[accession]["youtube_id"], youtube_id)
            self.assertEqual(by_accession[accession]["title_display"], title)

    def test_rejects_non_allowlisted_override_field(self):
        editorial = copy.deepcopy(self.editorial)
        editorial["overrides"] = [{
            "accession": "001",
            "youtube_id": self.base_catalog["videos"][0]["youtube_id"],
            "duration_seconds": 10,
            "evidence": [],
        }]
        with self.assertRaisesRegex(CatalogValidationError, "non-allowlisted keys"):
            validate_editorial(editorial, self.base_catalog)

    def test_rejects_override_without_evidence_coverage(self):
        editorial = copy.deepcopy(self.editorial)
        editorial["overrides"] = [{
            "accession": "001",
            "youtube_id": self.base_catalog["videos"][0]["youtube_id"],
            "purpose": "Public lecture",
            "evidence": [{
                "url": "https://www.youtube.com/watch?v=tv87ggs0yq4",
                "label": "YouTube page",
                "accessed_at": "2026-08-04",
                "supports": ["type"],
            }],
        }]
        with self.assertRaisesRegex(CatalogValidationError, "fields lack evidence coverage"):
            validate_editorial(editorial, self.base_catalog)

    def test_rejects_empty_values_that_would_erase_canonical_data(self):
        empty_overrides = {
            "type": None,
            "purpose": "",
            "topics": [],
            "contributors": [],
        }
        for field, value in empty_overrides.items():
            editorial = self.with_override(**{field: value})
            with self.subTest(field=field), self.assertRaisesRegex(
                CatalogValidationError, "empty values cannot erase canonical data"
            ):
                validate_editorial(editorial, self.base_catalog)

    def test_rejects_reconciliation_identity_mutation(self):
        editorial = copy.deepcopy(self.editorial)
        editorial["reconciled_records"][0]["youtube_id"] = "AAAAAAAAAAA"
        with self.assertRaisesRegex(CatalogValidationError, "identity changed"):
            validate_editorial(editorial, self.base_catalog)

    def test_rejects_identity_and_source_title_mutation(self):
        editorial = copy.deepcopy(self.editorial)
        editorial["title_reviews"][0]["title_source"] = "Changed canonical title"
        with self.assertRaisesRegex(CatalogValidationError, "canonical identity/source title changed"):
            validate_editorial(editorial, self.base_catalog)

    def test_rejects_invalid_contributor_role(self):
        editorial = self.with_override(
            contributors=[{"name": "A. Scholar", "role": "author"}],
        )
        with self.assertRaisesRegex(CatalogValidationError, "invalid contributor role"):
            validate_editorial(editorial, self.base_catalog)

    def test_rejects_partial_dates(self):
        editorial = self.with_override(date_recorded="2014-09")
        with self.assertRaisesRegex(CatalogValidationError, "full ISO date"):
            validate_editorial(editorial, self.base_catalog)

    def test_rejects_private_drive_and_workflow_urls(self):
        for url in (
            "https://drive.google.com/file/d/private",
            "https://internal.example.org/video",
            "https://example.org/workflow/42",
        ):
            editorial = self.with_override(public_note="Checked", evidence_url=url)
            with self.subTest(url=url), self.assertRaisesRegex(
                CatalogValidationError, "private/internal/workflow URL"
            ):
                validate_editorial(editorial, self.base_catalog)

    def test_rejects_transcript_status_url_conflicts(self):
        editorial = self.with_override(
            transcript_status="none",
            transcript_url="https://example.org/transcript/001",
        )
        with self.assertRaisesRegex(CatalogValidationError, "incompatible"):
            validate_editorial(editorial, self.base_catalog)

    def test_last_verified_at_cannot_be_forged(self):
        catalog = copy.deepcopy(self.catalog_v2)
        catalog["videos"][15]["last_verified_at"] = "2026-08-03"
        with self.assertRaisesRegex(CatalogValidationError, "not evidence-derived"):
            validate_catalog(catalog)

    def with_override(self, evidence_url="https://example.org/catalog/001", **fields):
        editorial = copy.deepcopy(self.editorial)
        editorial["overrides"] = [{
            "accession": "001",
            "youtube_id": self.base_catalog["videos"][0]["youtube_id"],
            **fields,
            "evidence": [{
                "url": evidence_url,
                "label": "Public catalog record",
                "accessed_at": "2026-08-04",
                "supports": list(fields),
            }],
        }]
        return editorial


if __name__ == "__main__":
    unittest.main()
