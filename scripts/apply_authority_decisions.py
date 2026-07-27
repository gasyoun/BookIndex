#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A3 follow-on: apply human-voted decide-tier authority decisions.

Consumes a review-sheet decisions.json (scripts/build_authority_review_sheet.py
+ the org /review-sheet contract: {sheet_id, generated, decided,
items:[{id, decision, note}]}) and writes `authority: {..., src: "manual"}`
onto the matching app_data.json entities for every explicit "approve" vote.
The QID applied is always the row's `suggested_qid` from
data/authority_review.json — free-text notes are for a human to read, this
script never parses one into a QID (a wrong QID is a factual error in a
scholarly resource; guessing from prose is not an acceptable source).

Only "decide"-tier rows are eligible, even if a decisions.json somehow names a
research/none-tier canonical_id (defence in depth against a stale/hand-edited
review file or a sheet regenerated with a wider scope) — research/none must
never be silently promoted.

Dry-run by default: prints exactly what WOULD be written and touches no
files. Pass --apply to actually write app_data.json (full authority block,
viaf/gnd/geonames/glottolog pulled fresh from Wikidata for the approved QID,
same shape as align_authorities.py's authority_block()) and
data/authority_review.json (records the accepted QID / "reject" into each
row's `decision` field per retier_authority_candidates.py's documented
convention).

Usage:
    python scripts/apply_authority_decisions.py --decisions review/bookindex-authority_decide-tier_decisions.json
    python scripts/apply_authority_decisions.py --decisions ... --apply

Next steps after --apply:
    npm run data:split && npm run build && npm run export:tei
"""
import sys
import os
import json
import argparse
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from align_authorities import wb_entities, authority_block, label_of  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_APP_DATA = os.path.join(ROOT, "app_data.json")
DEFAULT_REVIEW = os.path.join(ROOT, "data", "authority_review.json")
ENTITY_TYPES = ("names", "toponyms", "ethnonyms")
ELIGIBLE_TIER = "decide"


def load(path):
    return json.load(open(path, encoding="utf-8"))


def write_json_matching_convention(path, data):
    """Same write shape as align_authorities.py / app_data_modules.py: text
    mode (newline=None) so CRLF-checked-out working trees round-trip, no
    trailing BOM (git normalizes to the repo's committed LF on commit)."""
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with open(path, "rb") as f:
        assert f.read(3).hex() != "efbbbf", f"BOM written to {path}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--decisions", required=True, help="path to a review-sheet decisions.json")
    ap.add_argument("--app-data", default=DEFAULT_APP_DATA)
    ap.add_argument("--review", default=DEFAULT_REVIEW)
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry-run report only)")
    args = ap.parse_args()

    decisions = load(args.decisions)
    review = load(args.review)
    app = load(args.app_data)

    rows_by_id = {r["canonical_id"]: r for r in review.get("rows", [])}
    ent_idx = {}
    for rtype in ENTITY_TYPES:
        for it in app.get(rtype, []) or []:
            ent_idx[it.get("canonical_id")] = (rtype, it)

    to_apply = []   # (cid, rtype, entity, qid, suggested_label)
    skipped = []    # (cid, reason)
    rejects = []
    for item in decisions.get("items", []) or []:
        cid = item.get("id")
        decision = item.get("decision")
        if not cid or not decision:
            continue
        row = rows_by_id.get(cid)
        if decision == "reject":
            rejects.append(cid)
            continue
        if decision != "approve":
            continue  # defer or any other value: no action
        if not row:
            skipped.append((cid, "not found in data/authority_review.json"))
            continue
        if row.get("review_tier") != ELIGIBLE_TIER:
            skipped.append((cid, f"tier is {row.get('review_tier')!r}, not {ELIGIBLE_TIER!r} — refused"))
            continue
        qid = row.get("suggested_qid")
        if not qid:
            skipped.append((cid, "no suggested_qid on this row"))
            continue
        found = ent_idx.get(cid)
        if not found:
            skipped.append((cid, "canonical_id not present in app_data.json"))
            continue
        rtype, entity = found
        if rtype != row.get("type"):
            skipped.append((cid, f"type mismatch: app_data={rtype!r} review={row.get('type')!r}"))
            continue
        to_apply.append((cid, rtype, entity, qid, row.get("suggested_label", "")))

    print(f"decisions file: {args.decisions}")
    print(f"approve -> apply: {len(to_apply)}   reject: {len(rejects)}   skipped: {len(skipped)}")
    for cid, reason in skipped:
        print(f"  SKIP {cid}: {reason}")

    if not to_apply and not rejects:
        print("nothing to do")
        return

    ent_map = {}
    qids = sorted({qid for _cid, _rtype, _entity, qid, _label in to_apply})
    for i in range(0, len(qids), 50):
        ent_map.update(wb_entities(qids[i:i + 50]))

    written = []
    for cid, rtype, entity, qid, sugg_label in to_apply:
        wd_entity = ent_map.get(qid)
        if not wd_entity:
            skipped.append((cid, f"Wikidata lookup for {qid} failed — not applied"))
            continue
        block = authority_block(wd_entity)
        block["src"] = "manual"
        overwrite_note = " (overwriting existing authority)" if entity.get("authority") else ""
        print(f"  APPLY {cid} [{rtype}] {entity.get('head')!r} -> {qid} "
              f"«{label_of(wd_entity) or sugg_label}»{overwrite_note}")
        entity["authority"] = block
        written.append((cid, qid))

    for cid in rejects:
        row = rows_by_id.get(cid)
        if row is not None:
            row["decision"] = "reject"
    for cid, qid in written:
        row = rows_by_id.get(cid)
        if row is not None:
            row["decision"] = qid

    if not args.apply:
        print(f"\n(dry-run — {len(written)} would be written, {len(rejects)} rejects recorded; "
              "pass --apply to write)")
        return

    write_json_matching_convention(args.app_data, app)
    write_json_matching_convention(args.review, review)
    print(f"\nwrote authority on {len(written)} entities to {os.path.relpath(args.app_data, ROOT)}")
    print(f"recorded {len(written)} accept + {len(rejects)} reject decision(s) in "
          f"{os.path.relpath(args.review, ROOT)}")
    print("next: npm run data:split && npm run build && npm run export:tei")


if __name__ == "__main__":
    main()
