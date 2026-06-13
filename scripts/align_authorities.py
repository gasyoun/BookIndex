#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A3: align names / toponyms / ethnonyms to Wikidata authority IDs.

For each index entity we query Wikidata by its Russian label, verify the
candidate's type (instance-of), and — for persons — check that the surname and
initials match. Verified matches yield an `authority` block
{wikidata, viaf, geonames, gnd, glottolog} pulled from the Wikidata item.

A wrong QID is a factual error in a scholarly resource, so only HIGH-confidence
matches are auto-written; everything else is left in the review file with its
candidates and confidence for a human to confirm.

Usage:
    python scripts/align_authorities.py --report                # query + report, write nothing
    python scripts/align_authorities.py --report --type names   # one type
    python scripts/align_authorities.py --write                 # write high-confidence into app_data.json
                                                                 # (+ data/authority_candidates.json review file)
"""
import sys
import os
import re
import json
import time
import argparse
import urllib.parse
import urllib.request
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA = os.path.join(ROOT, "app_data.json")
REVIEW = os.path.join(ROOT, "data", "authority_candidates.json")

API = "https://www.wikidata.org/w/api.php"
UA = {"User-Agent": "BookIndex-authority/1.0 (https://github.com/gasyoun/BookIndex; gasyoun@gmail.com)"}

# Wikidata property ids
P_INSTANCE_OF = "P31"
P_VIAF = "P214"
P_GND = "P227"
P_GEONAMES = "P1566"
P_GLOTTOLOG = "P1394"

Q_HUMAN = "Q5"
# place-type QIDs (broad) for toponym verification
PLACE_TYPES = {
    "Q486972", "Q515", "Q3957", "Q532", "Q6256", "Q82794", "Q23442", "Q4022",
    "Q23397", "Q1549591", "Q15284", "Q3024240", "Q1048835", "Q1637706", "Q34876",
    "Q5119", "Q177634", "Q56061", "Q15642541", "Q12131", "Q3623811", "Q1799794",
}
PLACE_WORDS = ("город", "столиц", "страна", "государств", "регион", "област",
               "река", "озеро", "море", "село", "остров", "импери", "княжеств",
               "республик", "район", "посёлок", "деревн", "край", "континент")
# ethnic-group-type QIDs
ETHNIC_TYPES = {"Q41710", "Q2472587", "Q220849", "Q878352", "Q713623", "Q3024240"}
ETHNIC_WORDS = ("народ", "этни", "племя", "группа населения", "этнос", "общност")


def api_get(params):
    params = {**params, "format": "json"}
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.load(r)
        except Exception:  # noqa: BLE001
            time.sleep(1.0 * (i + 1))
    return {}


def wb_search(label, limit=5):
    d = api_get({"action": "wbsearchentities", "search": label, "language": "ru",
                 "uselang": "ru", "type": "item", "limit": limit})
    return d.get("search", []) or []


def wb_entities(ids):
    """Fetch claims/labels/descriptions for up to 50 ids."""
    if not ids:
        return {}
    d = api_get({"action": "wbgetentities", "ids": "|".join(ids),
                 "props": "claims|labels|descriptions|aliases", "languages": "ru|en"})
    return d.get("entities", {}) or {}


def claim_values(entity, prop):
    out = []
    for c in (entity.get("claims", {}) or {}).get(prop, []) or []:
        try:
            dv = c["mainsnak"]["datavalue"]["value"]
            out.append(dv["id"] if isinstance(dv, dict) and "id" in dv else dv)
        except (KeyError, TypeError):
            continue
    return out


def label_of(entity):
    labs = entity.get("labels", {}) or {}
    return (labs.get("ru") or labs.get("en") or {}).get("value", "")


def desc_of(entity):
    ds = entity.get("descriptions", {}) or {}
    return (ds.get("ru") or ds.get("en") or {}).get("value", "")


def authority_block(entity):
    b = {"wikidata": entity.get("id")}
    viaf = claim_values(entity, P_VIAF)
    gnd = claim_values(entity, P_GND)
    geo = claim_values(entity, P_GEONAMES)
    glot = claim_values(entity, P_GLOTTOLOG)
    if viaf: b["viaf"] = str(viaf[0])
    if gnd: b["gnd"] = str(gnd[0])
    if geo: b["geonames"] = str(geo[0])
    if glot: b["glottolog"] = str(glot[0])
    return b


# ---- name parsing / verification ----
def name_parts(head):
    toks = str(head or "").replace("‑", "-").split()
    initials, words = [], []
    for t in toks:
        core = re.sub(r"[^А-Яа-яЁёA-Za-z]", "", t)
        if not core:
            continue
        if t.endswith(".") or len(core) == 1:
            initials.append(core[0].upper())
        else:
            words.append(core)
    surname = max(words, key=len) if words else ""
    return surname, initials


# The names in this index are scholars, writers and historical figures. A person
# whose Wikidata description is off-domain (actor, athlete…) with a coincidental
# surname+initials match is almost certainly the wrong referent.
DOMAIN_POSITIVE = (
    "лингвист", "языковед", "филолог", "славист", "востоковед", "индолог",
    "историк", "археолог", "этнограф", "палеограф", "текстолог", "лексикограф",
    "писатель", "поэт", "литератор", "публицист", "переводчик", "богослов",
    "учён", "академик", "профессор", "математик", "философ", "филолог",
    "князь", "царь", "император", "корол", "полководец", "святой", "митрополит",
    "патриарх", "летописец", "филос", "деятел", "просветител", "монах", "епископ",
)
DOMAIN_NEGATIVE = (
    "актёр", "актриса", "режиссёр", "оператор", "футболист", "хоккеист",
    "спортсмен", "певец", "певица", "музыкант", "блогер", "телеведущ",
    "боксёр", "гимнаст", "пловец", "теннисист", "модель", "рэпер",
)


def person_domain_ok(desc):
    d = (desc or "").lower()
    if any(n in d for n in DOMAIN_NEGATIVE):
        return False
    return any(p in d for p in DOMAIN_POSITIVE)


def verify_person(head, entity):
    if Q_HUMAN not in claim_values(entity, P_INSTANCE_OF):
        return False
    surname, initials = name_parts(head)
    if not surname:
        return False
    forms = [label_of(entity)]
    for al in (entity.get("aliases", {}) or {}).get("ru", []) or []:
        forms.append(al.get("value", ""))
    # surname must match a WHOLE word in the label/aliases (not a substring,
    # which would let a 2-3 letter surname match inside unrelated words)
    blob_words = {w.lower() for w in re.findall(r"[А-Яа-яЁёA-Za-z]+", " ".join(forms))}
    if surname.lower() not in blob_words:
        return False
    if not initials:
        return False  # mononym/no initials: too risky to auto-accept
    # check given/patronymic initials against the full label
    lbl_words = [w for w in re.findall(r"[А-Яа-яЁё]+", label_of(entity)) if w.lower() != surname.lower()]
    given_initials = [w[0].upper() for w in lbl_words]
    return given_initials[:len(initials)] == initials


def verify_place(entity):
    inst = set(claim_values(entity, P_INSTANCE_OF))
    if inst & PLACE_TYPES:
        return True
    d = desc_of(entity).lower()
    return any(w in d for w in PLACE_WORDS)


def verify_ethnic(entity):
    inst = set(claim_values(entity, P_INSTANCE_OF))
    if inst & ETHNIC_TYPES:
        return True
    d = desc_of(entity).lower()
    return any(w in d for w in ETHNIC_WORDS)


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def search_queries(head, rtype):
    head = str(head or "").strip()
    qs = [head]
    if rtype == "names":
        toks = head.split()
        # reorder "Фамилия И. О." -> "И. О. Фамилия"
        if len(toks) >= 2 and (toks[-1].endswith(".") or len(re.sub(r"\W", "", toks[-1])) == 1):
            inits = [t for t in toks if t.endswith(".") or len(re.sub(r"\W", "", t)) == 1]
            words = [t for t in toks if t not in inits]
            if words and inits:
                qs.append(" ".join(inits + words))
        surname, _ = name_parts(head)
        if surname and surname not in qs:
            qs.append(surname)
    return qs


def align_type(rtype, items, limit=0):
    verifier = {"names": None, "toponyms": verify_place, "ethnonyms": verify_ethnic}[rtype]
    rows = []
    todo = items[:limit] if limit else items
    for it in todo:
        head = it.get("head")
        best = None
        cands = []
        seen_ids = []
        for q in search_queries(head, rtype):
            for hit in wb_search(q, limit=5):
                if hit["id"] not in seen_ids:
                    seen_ids.append(hit["id"])
            if seen_ids:
                break
        ent_map = wb_entities(seen_ids[:8])
        verifying = []
        for qid in seen_ids[:8]:
            ent = ent_map.get(qid)
            if not ent:
                continue
            ok = verify_person(head, ent) if rtype == "names" else verifier(ent)
            exact = norm(label_of(ent)) == norm(head)
            cands.append({"qid": qid, "label": label_of(ent), "desc": desc_of(ent),
                          "type_ok": ok, "exact_label": exact})
            if ok:
                verifying.append({"entity": ent, "exact": exact, "desc": desc_of(ent)})

        conf = "none"
        if rtype == "names":
            # auto-accept only a UNIQUE, domain-relevant person (scholar/writer/
            # historical) — surname+initials alone collide across referents.
            domain = [v for v in verifying if person_domain_ok(v["desc"])]
            if len(domain) == 1:
                best, conf = domain[0], "high"
            elif verifying:
                best, conf = verifying[0], "medium"
        else:
            exacts = [v for v in verifying if v["exact"]]
            if exacts:
                best, conf = exacts[0], "high"
            elif verifying:
                best, conf = verifying[0], "medium"

        row = {"type": rtype, "head": head, "canonical_id": it.get("canonical_id"),
               "candidates": cands[:5], "confidence": conf}
        if best and conf != "none":
            row["match"] = authority_block(best["entity"])
            row["match_label"] = label_of(best["entity"])
        rows.append(row)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--type", choices=["names", "toponyms", "ethnonyms"])
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    app = json.load(open(APP_DATA, encoding="utf-8"))
    types = [args.type] if args.type else ["names", "toponyms", "ethnonyms"]

    all_rows = []
    for rtype in types:
        rows = align_type(rtype, app.get(rtype, []), limit=args.limit)
        all_rows.extend(rows)
        conf = Counter(r["confidence"] for r in rows)
        print(f"{rtype:10s} n={len(rows):4d}  high={conf['high']:4d}  medium={conf['medium']:4d}  none={conf['none']:4d}")

    # samples
    print("\nsamples (high-confidence):")
    shown = 0
    for r in all_rows:
        if r["confidence"] == "high" and shown < 18:
            m = r.get("match", {})
            extra = " ".join(f"{k}:{v}" for k, v in m.items() if k != "wikidata")
            print(f"  {r['type']:9s} {r['head']!r:30s} -> {m.get('wikidata')} «{r.get('match_label','')[:30]}» {extra}")
            shown += 1

    high = sum(1 for r in all_rows if r["confidence"] == "high")
    total = len(all_rows)
    print(f"\nauto-acceptable (high): {high}/{total} ({100*high//max(total,1)}%)")

    if args.write:
        # review file (everything, for the human)
        os.makedirs(os.path.dirname(REVIEW), exist_ok=True)
        with open(REVIEW, "w", encoding="utf-8") as f:
            json.dump({"schema": "authority_candidates/1", "rows": all_rows}, f, ensure_ascii=False, indent=2)
            f.write("\n")
        # merge high-confidence into app_data
        by_key = {}
        for r in all_rows:
            if r["confidence"] == "high" and r.get("match"):
                by_key[(r["type"], r["canonical_id"], r["head"])] = r["match"]
        written = 0
        for rtype in types:
            for it in app.get(rtype, []):
                m = by_key.get((rtype, it.get("canonical_id"), it.get("head")))
                if m:
                    it["authority"] = {**m, "src": "wikidata-auto"}
                    written += 1
        from pathlib import Path
        Path(APP_DATA).write_text(json.dumps(app, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with open(APP_DATA, "rb") as f:
            assert f.read(3).hex() != "efbbbf", "BOM"
        print(f"\nwrote authority on {written} entities + review file {os.path.relpath(REVIEW, ROOT)}")
        print("next: npm run data:split && npm run build")
    else:
        print("\n(report only — pass --write to merge high-confidence + emit review file)")


if __name__ == "__main__":
    main()
