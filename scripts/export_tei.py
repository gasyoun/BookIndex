#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A6: export a TEI standOff document + per-type CSV dumps from app_data.json.

TEI is an EXPORT format here, not an authoring format. The lists are generated
from the canonical data, with stable URIs (A2 slug registry) and authority IDs
(A3) attached:

  names        -> <listPerson>/<person>   + <idno type="wikidata|VIAF|GND">
  toponyms     -> <listPlace>/<place>     + <idno type="geonames|wikidata">
  ethnonyms    -> <listNym>/<nym>         + <idno type="wikidata">
  languages    -> <list type="language">  (head + canonical ptr)
  subject_index-> <list type="subject">

Outputs (release/Zenodo artifacts):
  exports/bookindex.tei.xml
  exports/{names,toponyms,ethnonyms,languages,subject}.csv

The script validates its own output (XML well-formedness via ElementTree).

Usage:
  python scripts/export_tei.py
  python scripts/export_tei.py --check   # build in-memory, validate, write nothing
"""
import sys
import os
import csv
import json
import argparse
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DATA = os.path.join(ROOT, "app_data.json")
REGISTRY = os.path.join(ROOT, "data", "slug_registry.json")
OUT_DIR = os.path.join(ROOT, "exports")
BASE_URL = "https://gasyoun.github.io/BookIndex"

TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_NS = "http://www.w3.org/XML/1998/namespace"
ET.register_namespace("", TEI_NS)


def tei(tag, parent=None, text=None, **attrib):
    el = ET.Element(f"{{{TEI_NS}}}{tag}", {k: v for k, v in attrib.items() if v is not None})
    if text is not None:
        el.text = str(text)
    if parent is not None:
        parent.append(el)
    return el


def set_xml_id(el, value):
    el.set(f"{{{XML_NS}}}id", value)


# entity type -> (slug registry key, slug url segment)
TYPE_URL = {"names": "names", "toponyms": "toponyms", "ethnonyms": "ethnonyms",
            "languages": "languages", "subject_index": "subject"}
# authority idno types to emit, in order, with the TEI type label
IDNO_TYPES = [("wikidata", "wikidata"), ("viaf", "VIAF"), ("gnd", "GND"), ("geonames", "geonames")]


def slug_lookup(reg):
    out = {}
    for t, entries in reg.items():
        for cid, e in entries.items():
            out[(t, cid)] = e.get("slug")
    return out


def canonical_url(rtype, slug):
    seg = TYPE_URL[rtype]
    return f"{BASE_URL}/{seg}/list/item/{seg}/{slug}/" if slug else None


def aggregate_pages(it):
    pages, books = set(), []
    occ = it.get("occurrences") or {}
    for book, info in occ.items():
        books.append(book)
        for p in (info or {}).get("pages", []) or []:
            pages.add(p)
    for p in it.get("page_list", []) or []:
        pages.add(p)
    return sorted(pages, key=lambda x: (str(type(x)), x)), books


def add_entity(parent, elem_tag, name_tag, rtype, it, slugs):
    cid = it.get("canonical_id") or f"{rtype}-{it.get('head')}"
    el = tei(elem_tag, parent)
    set_xml_id(el, cid)
    tei(name_tag, el, text=it.get("head"))
    for alias in it.get("aliases", []) or []:
        if alias:
            tei(name_tag, el, text=alias, type="alias")
    auth = it.get("authority") or {}
    for key, label in IDNO_TYPES:
        if auth.get(key):
            tei("idno", el, text=auth[key], type=label)
    slug = slugs.get((TYPE_URL[rtype], cid)) if TYPE_URL[rtype] in ("subject",) else slugs.get((rtype, cid))
    url = canonical_url(rtype, slug)
    if url:
        tei("ptr", el, type="canonical", target=url)
    pages, books = aggregate_pages(it)
    if pages or books:
        parts = []
        if pages:
            parts.append("страницы: " + ", ".join(str(p) for p in pages))
        if books:
            parts.append("источники: " + ", ".join(books))
        tei("note", el, text="; ".join(parts), type="occurrences")
    return el


def build_tei(app, slugs, generated):
    root = ET.Element(f"{{{TEI_NS}}}TEI")
    header = tei("teiHeader", root)
    fd = tei("fileDesc", header)
    ts = tei("titleStmt", fd)
    tei("title", ts, text="BookIndex (Zalizniakiada) — authority lists (TEI standOff export)")
    tei("author", ts, text="Gasūns, Mārcis")
    ps = tei("publicationStmt", fd)
    tei("publisher", ps, text="BookIndex (Zalizniakiada)")
    av = tei("availability", ps)
    tei("licence", av, text="CC BY 4.0 (index data); see LICENSE-DATA.md",
        target="https://creativecommons.org/licenses/by/4.0/")
    if generated:
        tei("date", ps, when=generated)
    sd = tei("sourceDesc", fd)
    tei("bibl", sd, text="Generated from app_data.json — https://github.com/gasyoun/BookIndex")

    so = tei("standOff", root)

    lp = tei("listPerson", so)
    for it in app.get("names", []):
        add_entity(lp, "person", "persName", "names", it, slugs)

    lpl = tei("listPlace", so)
    for it in app.get("toponyms", []):
        add_entity(lpl, "place", "placeName", "toponyms", it, slugs)

    ln = tei("listNym", so)
    for it in app.get("ethnonyms", []):
        add_entity(ln, "nym", "form", "ethnonyms", it, slugs)

    llang = tei("list", so, type="language")
    for it in app.get("languages", []):
        item = tei("item", llang)
        set_xml_id(item, it.get("canonical_id") or f"languages-{it.get('head')}")
        tei("name", item, text=it.get("head"), type="language")
        url = canonical_url("languages", slugs.get(("languages", it.get("canonical_id"))))
        if url:
            tei("ptr", item, type="canonical", target=url)

    lsub = tei("list", so, type="subject")
    for it in app.get("subject_index", []):
        item = tei("item", llang if False else lsub)
        set_xml_id(item, it.get("canonical_id") or f"subject-{it.get('head')}")
        tei("term", item, text=it.get("head"))
        url = canonical_url("subject_index", slugs.get(("subject", it.get("canonical_id"))))
        if url:
            tei("ptr", item, type="canonical", target=url)

    return root


def write_csv(path, rtype, items, slugs):
    cols = ["head", "slug", "canonical_url", "discussed", "books", "pages",
            "wikidata", "viaf", "gnd", "geonames"]
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for it in items:
            cid = it.get("canonical_id")
            slug = slugs.get((TYPE_URL[rtype], cid)) if TYPE_URL[rtype] == "subject" else slugs.get((rtype, cid))
            pages, books = aggregate_pages(it)
            auth = it.get("authority") or {}
            w.writerow({
                "head": it.get("head", ""),
                "slug": slug or "",
                "canonical_url": canonical_url(rtype, slug) or "",
                "discussed": "1" if it.get("discussed") else "",
                "books": "|".join(books),
                "pages": " ".join(str(p) for p in pages),
                "wikidata": auth.get("wikidata", ""),
                "viaf": auth.get("viaf", ""),
                "gnd": auth.get("gnd", ""),
                "geonames": auth.get("geonames", ""),
            })


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="build + validate, write nothing")
    ap.add_argument("--date", help="optional release date (YYYY-MM-DD) stamped into the TEI header; "
                                    "omitted by default so committed output is deterministic")
    args = ap.parse_args()

    app = json.load(open(APP_DATA, encoding="utf-8"))
    reg = json.load(open(REGISTRY, encoding="utf-8")).get("types", {})
    slugs = slug_lookup(reg)
    generated = args.date

    root = build_tei(app, slugs, generated)
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    # validate well-formedness
    ET.fromstring(xml_bytes)
    counts = {
        "names": len(app.get("names", [])), "toponyms": len(app.get("toponyms", [])),
        "ethnonyms": len(app.get("ethnonyms", [])), "languages": len(app.get("languages", [])),
        "subject_index": len(app.get("subject_index", [])),
    }
    n_idno = xml_bytes.count(b"<idno")
    print("TEI well-formed:", dict(counts), "| <idno> elements:", n_idno)

    if args.check:
        print("--check: nothing written")
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    tei_path = os.path.join(OUT_DIR, "bookindex.tei.xml")
    # pretty-print
    try:
        ET.indent(root, space="  ")
        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    except Exception:
        pass
    with open(tei_path, "wb") as f:
        f.write(xml_bytes)
        if not xml_bytes.endswith(b"\n"):
            f.write(b"\n")
    assert open(tei_path, "rb").read(3).hex() != "efbbbf", "BOM"
    ET.parse(tei_path)  # re-validate file

    for rtype, fname in [("names", "names.csv"), ("toponyms", "toponyms.csv"),
                         ("ethnonyms", "ethnonyms.csv"), ("languages", "languages.csv"),
                         ("subject_index", "subject.csv")]:
        write_csv(os.path.join(OUT_DIR, fname), rtype, app.get(rtype, []), slugs)

    print(f"wrote {os.path.relpath(tei_path, ROOT)} + 5 CSV dumps to {os.path.relpath(OUT_DIR, ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
