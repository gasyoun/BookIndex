"""Audit the `duplicate_of` links in the committed public video catalogue.

Reports, for every `duplicate_of` mark: the source/target metadata that a human
would use to judge it, and whether the mark coincides with a `duration_seconds`
collision. Written for H2586 (29-08-2026) after the six unsourced links in
`data/video_catalog_public.v2.json` turned out to be exactly the seven
duration-collision groups — see FINDINGS.md §4a.

Read-only: prints a report, never writes the catalogue or the overlay.

    python scripts/audit_duplicate_of.py
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = ROOT / "data" / "video_catalog_public.v2.json"
DEFAULT_EDITORIAL = ROOT / "data" / "video_catalog_editorial.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def evidenced_links(editorial: dict) -> set[tuple[str, str]]:
    """Links the overlay actually backs with evidence — the builder's own source."""
    out = set()
    for override in editorial.get("overrides", []):
        target = override.get("duplicate_of")
        if target:
            out.add((override["accession"], target))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--editorial", type=Path, default=DEFAULT_EDITORIAL)
    args = parser.parse_args()

    catalog = load(args.catalog)
    videos = catalog["videos"]
    by_accession = {video["accession"]: video for video in videos}
    backed = evidenced_links(load(args.editorial))

    durations = collections.defaultdict(list)
    for video in videos:
        durations[video["duration_seconds"]].append(video["accession"])
    collisions = {d: accs for d, accs in durations.items() if len(accs) > 1}

    links = [
        (acc, by_accession[acc]["duplicate_of"])
        for acc in sorted(by_accession)
        if by_accession[acc].get("duplicate_of")
    ]

    print("videos %d · distinct durations %d · duration-collision groups %d"
          % (len(videos), len(durations), len(collisions)))
    print("duplicate_of marks %d · backed by the overlay %d"
          % (len(links), len(backed)))
    marked = {acc for acc, _ in links}
    unmarked_collisions = [
        (d, accs) for d, accs in collisions.items() if not (set(accs) & marked)
    ]
    print("collision groups carrying no mark: %d" % len(unmarked_collisions))
    if not unmarked_collisions and len(links) == len(collisions):
        print("=> every mark is a duration collision and every collision is marked:")
        print("   the mapping IS duration equality, not a per-pair judgement.")
    print()

    for source, target in links:
        a = by_accession[source]
        b = by_accession.get(target)
        status = "overlay-backed" if (source, target) in backed else "UNSOURCED"
        print("%s -> %s  [%s]" % (source, target, status))
        if b is None:
            print("    !! target accession absent from the catalogue")
            continue
        same = a["duration_seconds"] == b["duration_seconds"]
        print("    duration   %s vs %s  %s"
              % (a["duration_seconds"], b["duration_seconds"],
                 "identical" if same else "DIFFERENT"))
        for label, video in (("source", a), ("target", b)):
            print("    %-6s     %s" % (label, video["title_display"]))
            print("           %s   topics=%s  type=%s"
                  % (video["watch_url"], video.get("topics"), video.get("type")))
            if video["title_source"] != video["title_display"]:
                print("           ! title_source disagrees: %s" % video["title_source"])
        print()

    print("A duration collision alone is not evidence of a shared recording;")
    print("compare the titles and dates above, and see FINDINGS.md §4a.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
