"""Шаг 8: лист голосования куратора над крестом «видео ↔ главы».

Лист собирается канонической org-функцией `csl_pyutil.render_review_sheet`
(та же, что у `scripts/build_authority_review_sheet.py`) — своя HTML-форма
запрещена конвенцией `/review-sheet`, markdown-чекбоксы запрещены тем более.

Три секции:

* **рёбра-кандидаты** — всё, что дал LLM-проход, плюс тайм-кодированные рёбра
  KWIC в полосе 0.75–0.85: они автоматические, но на бумагу без человеческого
  «да» не идут (печать неисправима);
* **спорные** — всё ниже порога своего прохода; не выбрасывается и не
  досочиняется, а выносится сюда;
* **дубли** — все семь пар с одинаковой длительностью, включая три заведомо
  ложные: схлопывание вручную, автоматом ни одно не выполняется (риск R-5).

Лист пишется в gitignored `review/` (конвенция репозитория: лист — личный
рабочий артефакт). Воспроизводится этим скриптом; в коммит идут кандидаты
`data/crosswalk/gate_candidates.json`, чтобы лист можно было пересобрать.

    python scripts/crosswalk/build_crosswalk_gate.py

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CW, MODULES, catalog, chapters, dump_json, load_json  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "review"
SHEET_ID = "bookindex-crosswalk-video-chapter"
OUT_HTML = OUT_DIR / "crosswalk_gate.html"
SAVE_AS = "review/crosswalk_gate_decisions.json"
GENERATED = "2026-08-14"

PRINT_FLOOR = 0.85          # ниже этого ребро KWIC на полосу не идёт без куратора

VERDICT_RU = {"confirmed": "подтверждён", "likely": "вероятен",
              "false": "скорее всего не дубль", "unknown": "не разобрано"}


def esc(s) -> str:
    return html.escape("" if s is None else str(s))


def build_items(module: dict, cat: dict[str, dict]) -> tuple[list[dict], dict]:
    ch_name = {c["id"]: c["name"] for c in chapters()}
    items: list[dict] = []
    counts = {"candidate": 0, "disputed": 0, "duplicate": 0}

    for e in module["edges"]:
        is_llm = e["pass"] == "llm"
        weak_auto = e["status"] == "auto" and e["pass"] == "kwic" and e["confidence"] < PRINT_FLOOR
        if e["status"] == "disputed":
            filt = "disputed"
        elif is_llm or weak_auto:
            filt = "candidate"
        else:
            continue          # проход A и уверенный KWIC — доказаны, человеку не нужны
        counts[filt] += 1

        v = cat.get(e["accession"]) or {}
        ev = e["evidence"]
        title = v.get("title_display") or f"acc{e['accession']}"
        tc = f" ▸ {e['timecode']}" if e.get("timecode") else ""
        question = (
            f'Связать запись <b>acc{esc(e["accession"])}</b> с главой '
            f'<b>{esc(e["chapter"])} «{esc(ch_name.get(e["chapter"], ""))}»</b> '
            f'(связь <code>{esc(e["relation"])}</code>, проход {esc(e["pass"])}, '
            f'уверенность {e["confidence"]:.2f}){esc(tc)}?'
        )
        rows = []
        if ev.get("term"):
            rows.append(f'термин указателя <b>{esc(ev["term"])}</b>, с. {esc(ev.get("page"))}')
        if ev.get("srt"):
            rows.append(f'файл <code>{esc(ev["srt"])}</code>, смещение {esc(ev.get("at"))} с')
        if ev.get("series"):
            rows.append(f'цикл <code>{esc(ev["series"])}</code>')
        if ev.get("matched"):
            rows.append(f'совпало по {esc(ev.get("by", "заголовку"))}: «{esc(ev["matched"])}»')
        if ev.get("model"):
            rows.append(f'модель <code>{esc(ev["model"])}</code>')
        if ev.get("asr") == "looped":
            rows.append("⚠ подозрение на зацикленный фрагмент распознавания — "
                        "уверенность уже снижена вдвое")
        panels = [("Доказательство", "<div>" + "; ".join(rows) + "</div>"
                   if rows else '<span class="muted">только правило прохода</span>')]
        if ev.get("quote"):
            panels.append(("Цитата", f"<pre>{esc(ev['quote'])}</pre>"))
        panels.append(("Запись каталога", (
            f'<div><a href="{esc(v.get("watch_url"))}" target="_blank" rel="noopener">'
            f'{esc(title)}</a><br>темы: {esc(", ".join(v.get("topics") or []) or "нет")}; '
            f'длительность: {(v.get("duration_seconds") or 0) // 60} мин</div>')))

        items.append({
            "id": e["edge_id"],
            "filt": filt,
            "title": f'acc{e["accession"]} → {e["chapter"]}',
            "title_href": v.get("watch_url"),
            "badges": [e["pass"], f'{e["confidence"]:.2f}', e["relation"]],
            "question": question,
            "panels": panels,
            "note_placeholder": "если глава другая — впишите ch01…ch11; apply-скрипт читает "
                                "только approve/reject, заметка идёт в аудит-след",
        })

    for d in module["duplicates"]:
        counts["duplicate"] += 1
        a, b = d["pair"]
        items.append({
            "id": f"dup-{a}-{b}",
            "filt": "duplicate",
            "title": f"acc{a} ≡ acc{b}?",
            "badges": ["дубль", VERDICT_RU.get(d["verdict"], d["verdict"]),
                       f'{d["duration_seconds"] // 60} мин'],
            "question": (f'Считать записи <b>acc{esc(a)}</b> и <b>acc{esc(b)}</b> одной и той '
                         f'же публикацией? Approve проставит <code>duplicate_of</code>; '
                         f'запись <b>не удаляется</b> ни при каком решении.'),
            "panels": [
                ("Заголовки", "<div>" + "<br>".join(
                    f"acc{esc(x)} — {esc(t)}" for x, t in zip(d["pair"], d["titles"])) + "</div>"),
                ("Предварительный разбор",
                 f'<div>{esc(d["rationale"])} (машинная оценка: '
                 f'{esc(VERDICT_RU.get(d["verdict"], d["verdict"]))})</div>'),
            ],
            "note_placeholder": "чем именно записи отличаются, если это не дубль",
        })

    return items, counts


def main() -> int:
    from csl_pyutil import render_review_sheet
    from csl_pyutil.evidence import EvidenceManifest

    module = load_json(MODULES / "22-crosswalk.json")["crosswalk"]
    cat = {v["accession"]: v for v in catalog()}
    items, counts = build_items(module, cat)

    dump_json(CW / "gate_candidates.json", {
        "schema": "bookindex.crosswalk.gate/1",
        "generated": GENERATED,
        "sheet_id": SHEET_ID,
        "counts": counts,
        "print_floor": PRINT_FLOOR,
        "ids": [i["id"] for i in items],
    })

    stats = module["stats"]
    screening = {
        "deterministic": stats["per_relation"].get("lecture_of", 0),
        "lookup": stats["with_timecode"],
        "agent": counts["candidate"],
        "human": counts["disputed"] + counts["duplicate"],
        "evidence_path": "data/crosswalk/edges_pass_a.json … edges_pass_d.json",
        "rules": [
            "проход A (серии) с уверенностью 0.95 и уверенный KWIC на лист не выносятся: "
            "правило цикла и термин указателя со страницей — уже доказательство",
            "ни одно ребро от LLM не попадает на печатную полосу без человеческого «да»",
            "дубли не схлопываются автоматически: три пары из семи почти наверняка ложные",
        ],
    }

    config = {
        "sheet_id": SHEET_ID,
        "title": "BookIndex — крест «видео ↔ главы», куратор-гейт (H2711)",
        "subtitle": (
            f"{stats['edges']} рёбер на {stats['records_covered']} из "
            f"{stats['records_total']} записей каталога; {stats['with_timecode']} с тайм-кодом. "
            "Approve = ребро идёт в печать волны 2; Reject = ребро остаётся в данных "
            "со статусом rejected и на полосу не попадает."
        ),
        "footer": ("Секции: кандидаты (LLM и слабый KWIC) · спорные (ниже порога прохода) · "
                   "дубли (все семь пар одинаковой длительности). Записи каталога не "
                   "удаляются ни при каком решении."),
        "approve_label": "Принять связь",
        "reject_label": "Отклонить",
        "filters": [("candidate", f"кандидаты ({counts['candidate']})"),
                    ("disputed", f"спорные ({counts['disputed']})"),
                    ("duplicate", f"дубли ({counts['duplicate']})")],
        "generated": GENERATED,
        "show_ids": True,
        "save_as": SAVE_AS,
        # Идентификаторы YouTube — латиница со смешанным регистром, и детектор
        # SLP1 читает их как санскрит в человеческом тексте. Это не транслитерация,
        # а машинный ключ, поэтому он объявляется допустимым явно, а не глушится
        # отключением проверки.
        "preflight": {"allow_slp1_tokens": tuple(
            sorted({v["youtube_id"] for v in cat.values() if v.get("youtube_id")}))},
    }

    # V9-манифест: чем карточки уже обеспечены и что сознательно не подмешано.
    # Без него никто не проверяет, не спрашиваем ли мы человека о том, на что в
    # репозитории уже есть ответ — а это ровно тот дефект, из-за которого в другом
    # листе 191 карточка из 200 уехала к куратору с готовым вердиктом под рукой.
    manifest = EvidenceManifest(SHEET_ID, [i["id"] for i in items], repo_root=str(REPO))
    manifest.declare_joined("data/modules/22-crosswalk.json",
                            ["chapter", "relation", "confidence", "evidence", "timecode"])
    manifest.declare_joined("data/video_catalog_public.v2.json",
                            ["title_display", "topics", "duration_seconds", "watch_url"])
    manifest.declare_omitted_path(
        "data/crosswalk/srt_cache",
        "расшифровки целиком не публикуются (права); в карточке — цитата ±120 знаков")
    manifest.declare_omitted_path(
        "data/modules/20-lectures.json",
        "аннотации глав шли в промпт прохода D; на карточке дублировали бы вопрос")
    manifest.declare_omitted_path(
        "data/lectures_kwic.json",
        "прежний KWIC по книге, а не по расшифровкам: другой источник, не про эти рёбра")

    doc = render_review_sheet(items, config, screening=screening, manifest=manifest)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_HTML.write_text(doc, encoding="utf-8")

    print(f"записано {OUT_HTML.relative_to(REPO)} — {len(items)} карточек "
          f"(кандидаты {counts['candidate']}, спорные {counts['disputed']}, "
          f"дубли {counts['duplicate']})")
    print(f"решения выгружаются в {SAVE_AS}")
    print("кандидаты продублированы в data/crosswalk/gate_candidates.json (лист gitignored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
