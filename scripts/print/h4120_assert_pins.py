#!/usr/bin/env python3
# H4120 acceptance assert: reads the FINAL b9/b10 SVGs and locks the seven
# named labels to their spec coordinates (+-2u), diffs every map label tspan
# against the BEFORE render (cascade gate: <= 8 moved, cluster-only), and
# fails if «см. врезку» returned.
#
# Usage: python scripts/print/h4120_assert_pins.py --before <dir-with-before-svgs>
# (the before dir needs toponyms-map-b9-map.svg / -b10-map.svg as rendered at
# base b0bf00aaa; python floor 3.9, no exotic kwargs - H3541)

import argparse
import math
import re
import sys

# label -> expected (x, y) of the <text> anchor (first-line baseline).
# H4120 shipped wave = italic caption ONLY: the pin wave was withdrawn
# (measured: drops 1-4 accepted names), so the seven labels must sit at
# their BASE b0bf00aaa positions - any move > 0.5u is a regression.
EXPECTED = {
    "Кольский полуостров": (372.90, 349.23),
    "Финляндия": (328.66, 369.40),
    "Архангельская": (296.97, 231.11),
    "Российская Федерация": (456.38, 286.34),
    "Литва": (291.11, 305.00),
    "Германия · ГДР": (87.97, 318.08),
    "Крым": (275.00, 444.00),
    "Украина": (264.03, 398.42),
}
TOL = 2.0
# H4144 loss gate: the drawn-label SET must be a superset of the before set
# (the solver may ADD draws - Пилос - never drop one). The old cluster-only
# cascade clause is retired by the MG ruling: the solver re-places globally.
MAX_MOVED = 10 ** 9

LABEL_RE = re.compile(
    r'<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="11\.2"'
    r' fill="#111111"[^>]*>((?:<tspan[^>]*>[^<]*</tspan>)+)</text>'
)
TSPAN_RE = re.compile(r"<tspan[^>]*>([^<]*)</tspan>")


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def labels(path):
    """name -> (x, y) of the anchor (first line baseline), main-map labels only"""
    out = {}
    for m in LABEL_RE.finditer(read(path)):
        x, y = float(m.group(1)), float(m.group(2))
        first = TSPAN_RE.search(m.group(4)).group(1)
        out[first] = (x, y)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", required=True)
    ap.add_argument("--sheet", action="append", default=[],
                    help="sheet suffix, repeatable (default: b9 + b10)")
    a = ap.parse_args()
    sheets = a.sheet or ["b9", "b10"]

    failures = []
    for s in sheets:
        new_path = "print/toponyms-map-%s-map.svg" % s
        old_path = "%s/toponyms-map-%s-map.svg" % (a.before, s)
        new, old = labels(new_path), labels(old_path)

        for svg in (new_path,):
            body = read(svg)
            if "см. врезку" in body:
                failures.append("%s: «см. врезку» вернулась" % svg)

        # H4120 shipped feature: the inset caption «Русь · Киев → Новгород»
        # goes italic on B9/B10 (cfg insetCaptionItalic, B7/B8 untouched)
        cap = [ln for ln in read(new_path).splitlines()
               if "Русь · Киев → Новгород" in ln and "font-size=\"10\"" in ln]
        if not cap or 'font-style="italic"' not in cap[0]:
            failures.append("%s: inset caption not italic" % new_path)
        else:
            print("  ok       inset caption italic")

        print("== %s ==" % new_path)
        for name, (ex, ey) in sorted(EXPECTED.items()):
            key = next((k for k in new if k.startswith(name)), None)
            if key is None:
                failures.append("%s: label %r not drawn" % (new_path, name))
                print("  MISSING  %-36s (expected %.2f,%.2f)" % (name, ex, ey))
                continue
            gx, gy = new[key]
            ok = math.hypot(gx - ex, gy - ey) <= TOL
            print("  %-4s %-36s (%8.2f,%8.2f)  expected (%8.2f,%8.2f)" %
                  ("ok" if ok else "FAIL", key, gx, gy, ex, ey))
            if not ok:
                failures.append("%s: %s at (%.2f,%.2f), expected (%.2f,%.2f)"
                                % (new_path, key, gx, gy, ex, ey))

        moved = []
        for name, (ox, oy) in sorted(old.items()):
            nx, ny = new.get(name, (None, None))
            if nx is None:
                moved.append((name, ox, oy, ox, oy, "no longer drawn"))
                continue
            if math.hypot(nx - ox, ny - oy) > 0.5:
                moved.append((name, ox, oy, nx, ny, ""))
        print("  moved labels: %d (gate <= %d)" % (len(moved), MAX_MOVED))
        for name, ox, oy, nx, ny, note in moved:
            print("    %-36s (%7.2f,%7.2f) -> (%7.2f,%7.2f)%s"
                  % (name, ox, oy, nx, ny, (" " + note) if note else ""))
        # H4144 rev 2: MG-approved renames/losses (see the meta doc)
        accepted = {"Литовское княжество", "Малая Азия"}
        for name in sorted(set(old) - set(new) - accepted):
            failures.append("%s: name lost: %s" % (new_path, name))

    if failures:
        print("\nFAIL (%d):" % len(failures))
        for f in failures:
            print("  - %s" % f)
        return 1
    print("\nPASS: 7 labels locked (+-2u), no cascade, no «см. врезку» on %s"
          % "/".join(sheets))
    return 0


if __name__ == "__main__":
    sys.exit(main())
