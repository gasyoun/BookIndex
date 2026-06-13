#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A3 follow-on: turn the raw aligner output into a fast human review worklist.

Reads data/authority_candidates.json (from align_authorities.py) and, for the
entries that were NOT auto-accepted, assigns a review tier and a suggested QID
so a human can confirm/reject quickly:

  decide        — a type-matched candidate exists; one quick accept/reject
                  (the suggested QID is the TOP candidate, NOT a vetted answer —
                   e.g. "франки" surfaces "Франкистская Испания"; reject is fine)
  research      — candidates exist but none type-matched; needs a look
  none          — Wikidata returned nothing usable

Outputs (no network; pure reorganization):
  data/authority_review.json  — tiered, sorted worklist with a `decision` field
  data/authority_review.csv   — flat sheet: head, type, tier, suggested_qid/label/desc, decision

To apply confirmed decisions later, fill `decision` with the QID (or `reject`)
and feed it back through align_authorities (a future --apply-review mode).
"""
import sys
import os
import csv
import json
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "authority_candidates.json")
OUT_JSON = os.path.join(ROOT, "data", "authority_review.json")
OUT_CSV = os.path.join(ROOT, "data", "authority_review.csv")

TIER_ORDER = {"decide": 0, "research": 1, "none": 2}


def suggested(cands):
    typed = [c for c in cands if c.get("type_ok")]
    pool = typed or cands
    return pool[0] if pool else None


def tier_of(cands):
    if not cands:
        return "none"
    if any(c.get("type_ok") for c in cands):
        return "decide"
    return "research"


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    rows = data.get("rows", [])
    todo = [r for r in rows if r.get("confidence") != "high"]

    out = []
    for r in todo:
        cands = r.get("candidates", []) or []
        tier = tier_of(cands)
        sug = suggested(cands)
        out.append({
            "head": r.get("head"),
            "type": r.get("type"),
            "canonical_id": r.get("canonical_id"),
            "review_tier": tier,
            "suggested_qid": (sug or {}).get("qid", ""),
            "suggested_label": (sug or {}).get("label", ""),
            "suggested_desc": (sug or {}).get("desc", ""),
            "n_candidates": len(cands),
            "candidates": cands,
            "decision": "",  # human fills: a QID to accept, or "reject"
        })

    out.sort(key=lambda x: (TIER_ORDER.get(x["review_tier"], 9), (x["type"] or ""), (x["head"] or "").lower()))

    stats = {
        "to_review": len(out),
        "by_tier": dict(Counter(x["review_tier"] for x in out)),
        "auto_confirmed_high": sum(1 for r in rows if r.get("confidence") == "high"),
    }
    payload = {
        "schema": "authority_review/1",
        "note": "Human worklist for unconfirmed Wikidata matches. `suggested_*` is the TOP candidate, not a vetted answer. Fill `decision` with a QID to accept or `reject`. Tiers by effort: decide (one accept/reject) < research (needs a look) < none (no candidate).",
        "stats": stats,
        "rows": out,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(OUT_JSON, "rb") as f:
        assert f.read(3).hex() != "efbbbf", "BOM"

    cols = ["head", "type", "review_tier", "n_candidates", "suggested_qid", "suggested_label", "suggested_desc", "decision"]
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for x in out:
            w.writerow({c: x.get(c, "") for c in cols})

    print(f"to review: {stats['to_review']}  by_tier: {stats['by_tier']}  (auto-confirmed: {stats['auto_confirmed_high']})")
    print(f"wrote {os.path.relpath(OUT_JSON, ROOT)} + {os.path.relpath(OUT_CSV, ROOT)}")


if __name__ == "__main__":
    main()
