#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A3 follow-on: interactive review sheet for the 34 "decide"-tier authority rows.

data/authority_review.json (produced by retier_authority_candidates.py) sorts
209 unconfirmed Wikidata candidates into three tiers. This script builds a
self-contained HTML review/voting sheet over the **decide** tier only (a
type-matched candidate exists; one quick accept/reject) — research/none tiers
are out of scope and never appear on the sheet, so they cannot be silently
promoted by an approve click.

The sheet is a personal working artifact (org review-sheet convention): it is
written to the gitignored review/ directory, never committed. Approve/reject
votes export a decisions.json that scripts/apply_authority_decisions.py
consumes to write `authority: {..., src: "manual"}` onto app_data.json.

Usage:
    python scripts/build_authority_review_sheet.py
"""
import sys
import os
import json
from datetime import date

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIEW_JSON = os.path.join(ROOT, "data", "authority_review.json")
APP_DATA = os.path.join(ROOT, "app_data.json")
SLUG_REGISTRY = os.path.join(ROOT, "data", "slug_registry.json")
OUT_DIR = os.path.join(ROOT, "review")

SHEET_ID = "bookindex-authority_decide-tier"
OUT_HTML = os.path.join(OUT_DIR, SHEET_ID + "_review.html")
SAVE_AS = "review/" + SHEET_ID + "_decisions.json"

BASE_URL = "https://gasyoun.github.io/BookIndex"
TYPE_URL = {"names": "names", "toponyms": "toponyms", "ethnonyms": "ethnonyms"}
TYPE_LABEL_RU = {"names": "имена", "toponyms": "топонимы", "ethnonyms": "этнонимы"}


def esc(s):
    import html
    return html.escape("" if s is None else str(s))


def canonical_url(rtype, slug):
    seg = TYPE_URL[rtype]
    return f"{BASE_URL}/{seg}/list/item/{seg}/{slug}/" if slug else None


def load_entity_index(app):
    idx = {}
    for rtype in TYPE_URL:
        for it in app.get(rtype, []) or []:
            idx[(rtype, it.get("canonical_id"))] = it
    return idx


def occurrence_context(entity, limit=2):
    if not entity:
        return "", []
    pages, books, snippets = [], [], []
    for book, info in (entity.get("occurrences") or {}).items():
        books.append(book)
        for p in (info or {}).get("pages", []) or []:
            pages.append(p)
        for c in (info or {}).get("contexts", []) or []:
            if c and len(snippets) < limit:
                snippets.append(c)
    return ", ".join(books), pages, snippets


def candidate_row_html(c, is_suggested):
    star = ' <span class="badge">предложен</span>' if is_suggested else ""
    okbadge = ' <span class="badge">тип совпал</span>' if c.get("type_ok") else ""
    exbadge = ' <span class="badge">точное совпадение метки</span>' if c.get("exact_label") else ""
    qid = c.get("qid", "")
    wd_url = f"https://www.wikidata.org/wiki/{qid}" if qid else ""
    return (
        '<div class="chip">'
        f'<a href="{esc(wd_url)}" target="_blank" rel="noopener">{esc(qid)}</a> '
        f'&mdash; <b>{esc(c.get("label", ""))}</b> &mdash; {esc(c.get("desc", "") or "(без описания)")}'
        f'{star}{okbadge}{exbadge}</div>'
    )


def build_items(rows, ent_idx, slugs):
    items = []
    for r in rows:
        rtype = r["type"]
        cid = r["canonical_id"]
        entity = ent_idx.get((rtype, cid))
        books, pages, snippets = occurrence_context(entity)
        qid = r.get("suggested_qid", "")
        wd_url = f"https://www.wikidata.org/wiki/{qid}" if qid else ""

        question = (
            f'Присвоить сущности <b>{esc(r["head"])}</b> авторитетный QID '
            f'<a href="{esc(wd_url)}" target="_blank" rel="noopener">{esc(qid)}</a> '
            f'&laquo;{esc(r.get("suggested_label", ""))}&raquo;? '
            f'<span class="muted">({esc(r.get("suggested_desc", "") or "без описания")})</span>'
        )

        cand_html = "".join(
            candidate_row_html(c, c.get("qid") == qid) for c in (r.get("candidates") or [])[:5]
        )
        panels = [
            ("Кандидаты Wikidata (до 5)", cand_html or '<span class="muted">кандидатов нет</span>'),
        ]
        if snippets:
            ctx_html = "".join(f"<pre>{esc(s)}</pre>" for s in snippets)
            panels.append(("Контекст употребления в тексте", ctx_html))
        if books or pages:
            occ = []
            if books:
                occ.append("источники: " + esc(books))
            if pages:
                occ.append("страницы: " + ", ".join(str(p) for p in sorted(set(pages))))
            panels.append(("Вхождения", "<div>" + "; ".join(occ) + "</div>"))

        slug = slugs.get((rtype, cid))
        title_href = canonical_url(rtype, slug)

        items.append({
            "id": cid,
            "filt": rtype,
            "title": r["head"],
            "title_href": title_href,
            "badges": [TYPE_LABEL_RU.get(rtype, rtype), f"кандидатов: {r.get('n_candidates', 0)}"],
            "question": question,
            "panels": panels,
            "note_placeholder": "своё уточнение (например, другой QID) — apply-скрипт его не парсит, только approve/reject решают",
        })
    return items


def main():
    from csl_pyutil import render_review_sheet

    review = json.load(open(REVIEW_JSON, encoding="utf-8"))
    rows = [r for r in review.get("rows", []) if r.get("review_tier") == "decide"]
    if not rows:
        print("no decide-tier rows found — nothing to build")
        return

    app = json.load(open(APP_DATA, encoding="utf-8"))
    ent_idx = load_entity_index(app)

    slugs = {}
    if os.path.exists(SLUG_REGISTRY):
        reg = json.load(open(SLUG_REGISTRY, encoding="utf-8"))
        for rtype, entries in (reg.get("types") or {}).items():
            for cid, e in (entries or {}).items():
                slugs[(rtype, cid)] = e.get("slug")

    items = build_items(rows, ent_idx, slugs)

    config = {
        "sheet_id": SHEET_ID,
        "title": "BookIndex — авторитетные ID (A3), decide-tier",
        "subtitle": (
            "34 сущности с типово-совпадающим кандидатом Wikidata. "
            "Approve = записать предложенный QID как есть; Reject = не привязывать "
            "(текущая запись остаётся без authority)."
        ),
        "footer": (
            "Research/none уровни (139/36) в этот лист не входят — их продвижение "
            "здесь невозможно."
        ),
        "approve_label": "Принять QID",
        "reject_label": "Не привязывать",
        "filters": [(t, TYPE_LABEL_RU[t]) for t in ("names", "toponyms", "ethnonyms")],
        "generated": date.today().isoformat(),
        "show_ids": True,
        "save_as": SAVE_AS,
    }

    html_doc = render_review_sheet(items, config)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_doc)

    print(f"wrote {os.path.relpath(OUT_HTML, ROOT)} ({len(items)} items)")
    print(f"decisions.json (on download) -> {SAVE_AS}")
    print("apply with: python scripts/apply_authority_decisions.py --decisions "
          f"{SAVE_AS}  (dry-run by default; add --apply to write)")


if __name__ == "__main__":
    main()
