#!/usr/bin/env python3
"""Explain why ``lexicon`` and ``lexicon_reverse`` item counts differ.

Roadmap C4.2 (docs/CLEANUP_AND_UI_ROADMAP.md). The existing
``npm run content:audit`` reports both counters but never explains the gap.
This script decomposes the raw count difference into verifiable components:

1. Head-set edges: heads present in only one of the two indexes
   (reverse-only OCR placeholders, suffix particles, cross-reference
   arrows; lexicon-only leftovers).
2. Duplicate-multiplicity drift: heads whose within-list multiplicity
   differs between the two indexes.

The two components must sum exactly to the raw count difference
(``closure_ok``); the report states this so a reader can trust the
decomposition. Both indexes are independent curated sets: their
``canonical_id`` namespaces are disjoint by construction, so equality
of counts is not an invariant anyone broke - the report explains the
current shape instead of treating it as an error.

Usage::

    python scripts/explain_lexicon_reverse_divergence.py [app_data.json]
    python scripts/explain_lexicon_reverse_divergence.py --format json
    python scripts/explain_lexicon_reverse_divergence.py --write docs/LEXICON_REVERSE_COUNT_DIVERGENCE.md
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any


SAMPLE_LIMIT = 40

EMPTY_HEAD_KEY = "(пустой заголовок)"


def configure_output_encoding() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8")


_LEADING_QUESTIONS_RE = re.compile(r"^\?+")
_NON_ALNUM_RE = re.compile(r"[^a-zа-я0-9]+", re.IGNORECASE)


def head_key(value: Any) -> str:
    """Primary identity: the literal head, trimmed.

    The counters count stored entries, so the decomposition is done over
    literal heads. Punctuation and diacritics are part of the stored head
    (``-то`` the suffix particle and ``то`` the word are different heads).
    """

    text = str(value or "").strip()
    return text if text else EMPTY_HEAD_KEY


def runtime_head_key(value: Any) -> str:
    """Port of the runtime's ``normalizeHeadForMatch`` (v3_app.js).

    Used only for the supplementary runtime-view metric: which heads the app
    treats as the same lexeme when it inherits lexicon contexts into
    lexicon_reverse entries. Trim, lowercase, NFD, strip combining
    diacritics U+0300-U+036F, ё->е, drop leading '?'s, fold remaining
    non-letters/digits to spaces.
    """

    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if not ("\u0300" <= char <= "\u036f"))
    text = text.replace("ё", "е")
    text = _LEADING_QUESTIONS_RE.sub("", text)
    text = _NON_ALNUM_RE.sub(" ", text).strip()
    return text


def head_multiplicity(items: list[Any]) -> Counter[str]:
    """Partition items by literal head. Every dict item lands in exactly one
    bucket (empty heads get a sentinel), so the closure identity holds."""

    counter: Counter[str] = Counter()
    for item in items:
        if isinstance(item, dict):
            counter[head_key(item.get("head"))] += 1
    return counter


def build_divergence(data: dict[str, Any]) -> dict[str, Any]:
    raw_lexicon = data.get("lexicon")
    raw_reverse = data.get("lexicon_reverse")
    lexicon: list[Any] = [x for x in raw_lexicon if isinstance(x, dict)] if isinstance(raw_lexicon, list) else []
    reverse: list[Any] = [x for x in raw_reverse if isinstance(x, dict)] if isinstance(raw_reverse, list) else []

    lex_counts = head_multiplicity(lexicon)
    rev_counts = head_multiplicity(reverse)
    lex_heads = set(lex_counts)
    rev_heads = set(rev_counts)

    lexicon_only = sorted(lex_heads - rev_heads)
    reverse_only = sorted(rev_heads - lex_heads)
    shared = lex_heads & rev_heads

    # Shared heads whose within-list multiplicity differs.
    multiplicity_drift = sorted(
        (
            {"head": head, "lexicon": lex_counts[head], "lexicon_reverse": rev_counts[head]}
            for head in shared
            if lex_counts[head] != rev_counts[head]
        ),
        key=lambda row: (-abs(row["lexicon_reverse"] - row["lexicon"]), row["head"]),
    )

    # Within-list duplicate structure (same head, several entries).
    lex_dup_extra = sum(count - 1 for count in lex_counts.values() if count > 1)
    rev_dup_extra = sum(count - 1 for count in rev_counts.values() if count > 1)

    lex_unique = len(lex_heads)
    rev_unique = len(rev_heads)
    unique_head_delta = rev_unique - lex_unique
    extra_items_delta = rev_dup_extra - lex_dup_extra
    raw_delta = len(reverse) - len(lexicon)
    closure_ok = raw_delta == unique_head_delta + extra_items_delta

    # Same decomposition under the app's own head identity
    # (normalizeHeadForMatch): diacritic/case/punctuation-insensitive.
    # Supplementary view - shows how the split between "unique-head edges"
    # and "same-lexeme duplicates" redistributes, while raw_delta stays put.
    rt_lex_counts = Counter(runtime_head_key(head) for head in lex_counts.elements())
    rt_rev_counts = Counter(runtime_head_key(head) for head in rev_counts.elements())
    rt_lex_dup_extra = sum(c - 1 for c in rt_lex_counts.values() if c > 1)
    rt_rev_dup_extra = sum(c - 1 for c in rt_rev_counts.values() if c > 1)
    runtime_view = {
        "lexicon_unique_heads": len(rt_lex_counts),
        "lexicon_reverse_unique_heads": len(rt_rev_counts),
        "unique_head_delta": len(rt_rev_counts) - len(rt_lex_counts),
        "lexicon_duplicate_extra_items": rt_lex_dup_extra,
        "lexicon_reverse_duplicate_extra_items": rt_rev_dup_extra,
        "extra_items_delta": rt_rev_dup_extra - rt_lex_dup_extra,
        "raw_delta": raw_delta,
    }
    runtime_view["closure_ok"] = (
        runtime_view["unique_head_delta"] + runtime_view["extra_items_delta"] == raw_delta
    )

    # Data-driven example of same-lexeme literal variants (stress-mark
    # placement): first literal-head group that collapses to one runtime key.
    variant_example = ""
    for rt_key in sorted({runtime_head_key(head) for head in lex_heads}):
        variants = sorted({h for h in lex_heads if runtime_head_key(h) == rt_key})
        if len(variants) > 1:
            variant_example = " / ".join(f"`{h}`" for h in variants)
            break

    # Structural facts that frame the explanation.
    lex_ids = {
        item.get("canonical_id")
        for item in lexicon
        if isinstance(item, dict) and isinstance(item.get("canonical_id"), str)
    }
    rev_ids = {
        item.get("canonical_id")
        for item in reverse
        if isinstance(item, dict) and isinstance(item.get("canonical_id"), str)
    }
    reverse_note_count = sum(
        1
        for item in reverse
        if isinstance(item, dict)
        and isinstance(item.get("note"), str)
        and item["note"].strip()
    )
    lexicon_note_count = sum(
        1
        for item in lexicon
        if isinstance(item, dict)
        and isinstance(item.get("note"), str)
        and item["note"].strip()
    )
    reverse_review_count = sum(
        1 for item in reverse if isinstance(item, dict) and item.get("needs_review") is True
    )
    lexicon_review_count = sum(
        1 for item in lexicon if isinstance(item, dict) and item.get("needs_review") is True
    )
    reverse_only_with_note = sum(
        1
        for item in reverse
        if isinstance(item, dict)
        and head_key(item.get("head")) in set(reverse_only)
        and isinstance(item.get("note"), str)
        and item["note"].strip()
    )
    # Runtime view: reverse-only heads the app matches to some lexicon head
    # (same lexeme by normalizeHeadForMatch), i.e. inheritance-relevant.
    lex_runtime_keys = {runtime_head_key(head) for head in lex_heads}
    reverse_only_runtime_matched = sorted(
        head for head in reverse_only if runtime_head_key(head) in lex_runtime_keys
    )
    categories = {
        entity: sorted(
            {
                str(item.get("category"))
                for item in items
                if isinstance(item, dict) and item.get("category")
            }
        )
        for entity, items in (("lexicon", lexicon), ("lexicon_reverse", reverse))
    }

    return {
        "source_keys_present": {
            "lexicon": bool(lexicon),
            "lexicon_reverse": bool(reverse),
        },
        "counts": {
            "lexicon_total": len(lexicon),
            "lexicon_reverse_total": len(reverse),
            "raw_delta": raw_delta,
            "lexicon_unique_heads": lex_unique,
            "lexicon_reverse_unique_heads": rev_unique,
            "unique_head_delta": unique_head_delta,
            "lexicon_duplicate_extra_items": lex_dup_extra,
            "lexicon_reverse_duplicate_extra_items": rev_dup_extra,
            "extra_items_delta": extra_items_delta,
            "closure_ok": closure_ok,
            "runtime_view": runtime_view,
        },
        "head_sets": {
            "shared_heads": len(shared),
            "lexicon_only_count": len(lexicon_only),
            "lexicon_only_heads": lexicon_only,
            "lexicon_reverse_only_count": len(reverse_only),
            "lexicon_reverse_only_heads": reverse_only[:SAMPLE_LIMIT],
            "lexicon_reverse_only_truncated": len(reverse_only) > SAMPLE_LIMIT,
        },
        "multiplicity_drift": {
            "heads_count": len(multiplicity_drift),
            "heads": multiplicity_drift,
        },
        "structure": {
            "canonical_id_overlap": len(lex_ids & rev_ids),
            "note_counts": {
                "lexicon": lexicon_note_count,
                "lexicon_reverse": reverse_note_count,
            },
            "needs_review_counts": {
                "lexicon": lexicon_review_count,
                "lexicon_reverse": reverse_review_count,
            },
            "lexicon_reverse_only_heads_with_note": reverse_only_with_note,
            "lexicon_reverse_only_runtime_matched": reverse_only_runtime_matched,
            "stress_variant_example": variant_example,
            "categories": categories,
        },
    }


def render_markdown(divergence: dict[str, Any]) -> str:
    counts = divergence["counts"]
    head_sets = divergence["head_sets"]
    drift = divergence["multiplicity_drift"]
    structure = divergence["structure"]

    lines = [
        "# Почему у `lexicon` и `lexicon_reverse` разные счётчики",
        "",
        "Отчёт сгенерирован скриптом",
        "`scripts/explain_lexicon_reverse_divergence.py`"
        " (регенерация: `npm run content:divergence`).",
        "Дата генерации фиксируется git-коммитом файла, не строкой в тексте.",
        "",
        "## Короткий ответ",
        "",
        f"`lexicon_reverse` - это не механическое зеркало `lexicon`, а самостоятельный",
        "обратный указатель, который курировался отдельно: у записей разные пространства",
        f"`canonical_id` (`lexicon-*` против `lexicon_reverse-*`, пересечение {structure['canonical_id_overlap']}).",
        "Поэтому равенство счётчиков никем не нарушалось - его никогда не было.",
        "Расхождение раскладывается на два проверяемых слагаемых:",
        "",
        "## Разложение",
        "",
        "| Компонент | lexicon | lexicon_reverse | Δ (reverse − lexicon) |",
        "|---|---:|---:|---:|",
        f"| Всего записей | {counts['lexicon_total']} | {counts['lexicon_reverse_total']} | {counts['raw_delta']:+d} |",
        f"| Уникальных заголовков | {counts['lexicon_unique_heads']} | {counts['lexicon_reverse_unique_heads']} | {counts['unique_head_delta']:+d} |",
        f"| Лишних записей от дублей заголовков | {counts['lexicon_duplicate_extra_items']} | {counts['lexicon_reverse_duplicate_extra_items']} | {counts['extra_items_delta']:+d} |",
        "",
        "Тождество замыкается: "
        f"{counts['unique_head_delta']:+d} + {counts['extra_items_delta']:+d} = {counts['raw_delta']:+d}"
        f" (closure_ok: **{str(counts['closure_ok']).lower()}**).",
        "",
        "Разложение считается по буквальным заголовкам (trim без прочих нормализаций):"
        " счётчики считают сохранённые записи, а пунктуация и диакритика - часть"
        " заголовка (частица `-то` и слово `то` - разные заголовки).",
        "",
        "## Слагаемое 1: края множеств заголовков",
        "",
        f"Общих заголовков: {head_sets['shared_heads']}.",
        f"Только в `lexicon_reverse`: **{head_sets['lexicon_reverse_only_count']}** заголовков -",
        "OCR-заглушки из исходного указателя (часть помечена `note` про сверку"
        f" с изображением источника: {structure['lexicon_reverse_only_heads_with_note']} из них),"
        " суффиксные частицы (`-то`, `-либо`), стрелки перекрёстных ссылок (`→д`, `→цѣ`),"
        " протореконструкции (`*vivotä`) и формы с гортанной смычкой (`ʔaktaba`).",
        f"Только в `lexicon`: **{head_sets['lexicon_only_count']}**"
        f" ({', '.join('`' + h + '`' for h in head_sets['lexicon_only_heads']) or '-'}).",
        "",
        "Полный список reverse-only заголовков"
        f" (первые {SAMPLE_LIMIT}, всего {head_sets['lexicon_reverse_only_count']}):",
        "",
    ]
    for head in head_sets["lexicon_reverse_only_heads"]:
        lines.append(f"- `{head}`")
    if head_sets["lexicon_reverse_only_truncated"]:
        lines.append("- … (список усечён, см. `--format json`)")

    # Data-driven example comes from the divergence payload.
    variant_example = structure.get("stress_variant_example", "")

    lines.extend(
        [
            "",
            "## Слагаемое 2: разный дубляж общих заголовков",
            "",
            f"Общих заголовков с разной кратностью: **{drift['heads_count']}**.",
        ]
    )
    if drift["heads"]:
        lines.append("| Заголовок | lexicon | lexicon_reverse |")
        lines.append("|---|---:|---:|")
        for row in drift["heads"]:
            lines.append(f"| `{row['head']}` | {row['lexicon']} | {row['lexicon_reverse']} |")
    else:
        lines.append(
            "При буквальном тождестве расхождений кратности нет: дубли внутри каждого"
            " указателя отсутствуют. Дубли, которые видно в данных, появляются только"
            " при нормализации без диакритики (см. ниже): одна и та же словоформа"
            f" хранится с ударением на разных слогах ({variant_example}) - это разные"
            " записи, а не дубляж."
        )

    lines.extend(
        [
            "",
            "## Взгляд рантайма (нормализация без диакритики)",
            "",
            "Приложение сопоставляет заголовки через `normalizeHeadForMatch`"
            " (v3_app.js: NFD, снятие диакритики, ё→е, регистр и пунктуация игнорируются),"
            " когда наследует контексты `lexicon` в записи `lexicon_reverse`. В этом"
            " представлении внутри каждого списка есть «дубли» - записи одного лексема"
            f" с ударением на разных слогах ({variant_example}):",
            "",
        ]
    )
    rt = counts.get("runtime_view") or {}
    if rt:
        lines.extend(
            [
                f"- Уникальных заголовков: lexicon - {rt['lexicon_unique_heads']},"
                f" lexicon_reverse - {rt['lexicon_reverse_unique_heads']}"
                f" (Δ {rt['unique_head_delta']:+d});",
                f"- лишних записей от таких «дублей»: lexicon - {rt['lexicon_duplicate_extra_items']},"
                f" lexicon_reverse - {rt['lexicon_reverse_duplicate_extra_items']}"
                f" (Δ {rt['extra_items_delta']:+d});",
                f"- сумма: {rt['unique_head_delta']:+d} + {rt['extra_items_delta']:+d} ="
                f" {rt['raw_delta']:+d} - расхождение то же самое, просто часть краевых"
                " записей и часть «дублей» перераспределяются между слагаемыми.",
            ]
        )

    lines.extend(
        [
            "",
            "## Сопутствующая структура",
            "",
            f"- Записей с `note` (OCR-заглушки требуют сверки):"
            f" lexicon - {structure['note_counts']['lexicon']},"
            f" lexicon_reverse - {structure['note_counts']['lexicon_reverse']}.",
            f"- Записей с `needs_review: true`:"
            f" lexicon - {structure['needs_review_counts']['lexicon']},"
            f" lexicon_reverse - {structure['needs_review_counts']['lexicon_reverse']}.",
            f"- Категории: lexicon - {', '.join(structure['categories']['lexicon'])};"
            f" lexicon_reverse - {', '.join(structure['categories']['lexicon_reverse'])}.",
            f"- Взгляд рантайма: из reverse-only заголовков"
            f" {len(structure['lexicon_reverse_only_runtime_matched'])} совпадают с каким-либо"
            " заголовком `lexicon` по нормализации `normalizeHeadForMatch` (частица"
            " `-то` ↔ слово `то`), то есть для рантайм-наследования это тот же лексемный"
            " материал; на хранимые счётчики эта нормализация не влияет.",
            "",
            "## Что из этого следует",
            "",
            "1. Расхождение счётчиков - свойство двух независимо курируемых указателей,"
            " а не дефект сборки: CI-гейт синхронизации `app_data.json` ↔ `data/modules/`"
            " проверяет байтовую целостность, а не равенство этих двух списков.",
            "2. Существенный хвост - reverse-only заголовки-заглушки"
            f" ({head_sets['lexicon_reverse_only_count']} шт., у"
            f" {structure['lexicon_reverse_only_heads_with_note']} стоит явная пометка"
            " о сверке с источником). Их разбор - контентная работа из очереди"
            " `npm run content:audit` (см. `RESULTS_LOG.md`, coverage-drain),"
            " а не задача этого скрипта.",
            "3. Отчёт идемпотентен: скрипт только читает `app_data.json`.",
            "",
        ]
    )
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Explain why lexicon and lexicon_reverse counts differ."
    )
    parser.add_argument("path", nargs="?", default="app_data.json", help="Path to app_data.json")
    parser.add_argument(
        "--format",
        choices=("md", "json"),
        default="md",
        help="Output format: markdown (md) or json",
    )
    parser.add_argument("--write", metavar="PATH", help="Write the report to PATH instead of stdout")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    configure_output_encoding()
    args = parse_args(argv or sys.argv[1:])
    path = Path(args.path)
    if not path.exists():
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 2

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: invalid JSON in {path}: {exc}", file=sys.stderr)
        return 2
    if not isinstance(data, dict):
        print(f"ERROR: JSON root must be an object: {path}", file=sys.stderr)
        return 2

    divergence = build_divergence(data)
    if not all(divergence["source_keys_present"].values()):
        missing = [key for key, ok in divergence["source_keys_present"].items() if not ok]
        print(f"ERROR: missing entity lists in {path}: {', '.join(missing)}", file=sys.stderr)
        return 2

    payload = (
        json.dumps(divergence, ensure_ascii=False, indent=2) + "\n"
        if args.format == "json"
        else render_markdown(divergence)
    )
    if args.write:
        out_path = Path(args.write)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(payload, encoding="utf-8")
        print(f"Report written: {out_path}")
    else:
        print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
