"""Шаг 8, версия 2: лист голосования куратора над крестом «видео ↔ главы».

Версия 1 (H2711) провалила первый заход куратора 15-08-2026 — 10 карточек из
255, дальше голосование остановилось. Причины, по примечаниям куратора в
`data/crosswalk/gate_decisions_v1_partial.json`, все — про подачу:

* «как по-твоему я должен знать, что такое запись acc001?» — вопрос называл
  запись голым инвентарным номером; название лежало в нижней панели;
* «модель deepseek-v4-flash — это не может быть самим доказательством, а
  способом получения оного» — LLM-проход подавал имя модели в панели
  «Доказательство»;
* «термин указателя семнадцать — а в книге он на что ссылался?» — карточка
  показывала цитату из ВИДЕО, но не показывала, о чём термин в КНИГЕ;
* «файлов много, надо цитировать точно название файла» — источник цитаты
  должен быть назван полным именем файла.

Версия 2 отвечает на каждое примечание:

* вопрос карточки называет запись по имени, глава — по имени и страницам;
* панель «Термин в книге» — статья указателя: заголовок, страницы, книжный
  контекст (modules 10–14, `occurrences.mumintroll.contexts`);
* панель «Цитата из записи» цитирует точное имя srt-файла и смещение;
* у LLM-рёбер метод (модель, хеш промпта) отделён от доказательства; цитата
  модели проверяется поиском по данным репозитория — найден источник, карточка
  его называет; не найден — карточка честно предупреждает, что цитата может
  быть выдумана;
* десять решений первого захода переносятся преднабором (localStorage),
  остаются редактируемыми;
* лист меряет время куратора (csl-pyutil v0.10.0, V11): всего и на карточку,
  секунды уходят в decisions.json.

Версия 3 (H2857) — после второго захода 15-08-2026: 30 принято, 14 отклонено из
255 за 14 минут, дальше время кончилось. Два следствия:

* решённое применено к кресту и на лист больше не выносится (`SETTLED`). До v3
  фильтр по статусу стоял только на ветке «спорные», поэтому отклонённое ребро
  прохода LLM вернулось бы кандидатом следующим заходом;
* «Сдать сколько успел» и ⏸ (csl-pyutil v0.11.0, V12) — куратор может
  остановиться, не потеряв работу: «Хочу поставить на паузу, остановить таймер и
  остановить работу, сдать то что было… но такой функции как сдать сколько успел
  нет — а она нужна.»

Версия 4 (16-08-2026) — после третьего захода (39 решений, v3 partial) и
замечаний куратора «Почему показана невозможная связь петь и терпеть?
Переделай все голосование, чтобы человек на подобный мусор больше времени
не тратил» и «почему в скачанном .json нет главного, H2707 для опознания»:

* ложные подстрочные совпадения (тер|петь) сняты машиной ДО листа — правило
  R1, откалиброванное на 62 голосах куратора с нулём ложных срабатываний
  (scripts/crosswalk/apply_kwic_autoreject.py);
* каждое оставшееся спорное kwic-ребро несёт вердикт DeepSeek-скрина
  (linguistic / mere_use / false_match — scripts/crosswalk/deepseek_kwic_screen.py);
  карточки отсортированы: вероятно-ценные первыми, вероятный мусор в конце.
  Скрин НЕ режет сам: на тех же 62 голосах он убил бы 13–14 approve —
  критерий куратора шире (биографическим главам достаточно тематической
  связи), поэтому семантика остаётся человеку;
* reject получил ярлыки в один клик («лишь употреблено», «метафора»,
  «ложное совпадение», «глава другая») — печатать причину больше не нужно;
* decisions.json несёт context {handoff: H2707, repo, apply_with}
  (V14 csl-pyutil 0.13.0) — файл сам говорит, чей он;
* identity-gate V13 включён: каждый acc###/ch## в вопросе назван по имени.

Лист пишется в gitignored `review/`; в коммит идут кандидаты
`data/crosswalk/gate_candidates.json`. Применение решений —
`scripts/crosswalk/apply_gate_decisions.py`.

    python scripts/crosswalk/build_crosswalk_gate.py

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoffs H2711, H2841, H2707.
"""
from __future__ import annotations

import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CW, MODULES, catalog, chapters, dump_json, load_json  # noqa: E402
from kwic_noise_analysis import r1_substring_false  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "review"
SHEET_ID = "bookindex-crosswalk-video-chapter-v4"
OUT_HTML = OUT_DIR / "crosswalk_gate.html"
SAVE_AS = "review/crosswalk_gate_decisions.json"
PREFILL_V1 = CW / "gate_decisions_v3_partial.json"
GENERATED = "2026-08-16"
SCREEN_FILE = CW / "kwic_screen_verdicts.json"
CONTEXT = {"handoff": "H2707", "repo": "gasyoun/BookIndex",
           "apply_with": "python scripts/crosswalk/apply_gate_decisions.py"}
SCREEN_RU = {"linguistic": "скрин: о слове / по теме главы",
             "mere_use": "скрин: слово лишь употреблено",
             "false_match": "скрин: ложное совпадение",
             "unsure": "скрин: не ясно"}
SCREEN_ORDER = {"linguistic": 0, None: 1, "unsure": 1, "mere_use": 2, "false_match": 3}
REJECT_LABELS = [("mere_use", "слово лишь употреблено"),
                 ("metaphor", "метафора"),
                 ("false_match", "ложное совпадение"),
                 ("wrong_chapter", "глава другая"),
                 ("other", "другое (в заметку)")]

# Решённое куратором на лист больше не выносится (H2857). До v3 фильтр по статусу
# стоял только на ветке `disputed`: ребро прохода LLM или слабого KWIC попадало в
# «кандидаты» независимо от статуса, поэтому уже отклонённое ребро вернулось бы на
# лист следующим заходом.
SETTLED = {"approved", "rejected"}

PRINT_FLOOR = 0.85          # ниже этого ребро KWIC на полосу не идёт без куратора

VERDICT_RU = {"confirmed": "подтверждён", "likely": "вероятен",
              "false": "скорее всего не дубль", "unknown": "не разобрано"}

RELATION_RU = {
    "lecture_of": "лекция по теме главы",
    "expands": "дополняет главу",
    "sequel_to": "продолжение темы",
    "about_zaliznyak": "о самом Зализняке",
    "other_book": "другая книга",
    "scholarly_work": "научная работа",
}

# Модули указателя, где живут статьи с книжным контекстом (head/occurrences).
_INDEX_MODULES = (
    ("10-names", "names", "имена"),
    ("11-toponyms", "toponyms", "топонимы"),
    ("12-ethnonyms", "ethnonyms", "этнонимы"),
    ("13-languages", "languages", "языки"),
    ("14-lexicon", "lexicon", "лексикон"),
)


def esc(s) -> str:
    return html.escape("" if s is None else str(s))


def fmt_hms(seconds: float | None) -> str:
    s = max(0, int(seconds or 0))
    if s >= 3600:
        return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"
    return f"{s // 60}:{s % 60:02d}"


def index_entries() -> dict[str, dict]:
    """head(lower) -> статья указателя с книжными страницами и контекстом."""
    out: dict[str, dict] = {}
    for fname, key, rubric in _INDEX_MODULES:
        for e in load_json(MODULES / f"{fname}.json")[key]:
            occ = (e.get("occurrences") or {}).get("mumintroll") or {}
            rec = {
                "head": e.get("head", ""),
                "rubric": rubric,
                "pages": occ.get("pages") or e.get("page_list") or [],
                "contexts": occ.get("contexts") or e.get("contexts") or [],
            }
            out.setdefault(rec["head"].lower(), rec)
    return out


def quote_source(quote: str) -> str | None:
    """Где в данных репозитория живёт цитата, которую привела модель.

    Ищем по тем входам, что шли в промпт прохода D (аннотации глав) и по
    смежным модулям. Возвращаем человекочитаемое имя источника или None —
    и тогда карточка честно предупреждает, что цитата не подтверждена.
    """
    if not quote:
        return None
    needle = " ".join(quote.split())[:120].lower()
    sources = [
        ("data/modules/20-lectures.json", "аннотации глав (20-lectures.json)"),
        ("data/modules/30-scholar.json", "биография учёного (30-scholar.json)"),
        ("data/video_catalog_public.v2.json", "каталог записей (video_catalog_public.v2.json)"),
        ("data/modules/21-materials.json", "материалы (21-materials.json)"),
    ]
    for rel, label in sources:
        try:
            hay = " ".join((REPO / rel).read_text(encoding="utf-8").split()).lower()
        except OSError:
            continue
        if needle and needle in hay:
            return label
    return None


def build_items(module: dict, cat: dict[str, dict]) -> tuple[list[dict], dict, dict]:
    chs = {c["id"]: c for c in chapters()}
    lectures = {l["name"]: l for l in load_json(MODULES / "20-lectures.json")["lectures"]}
    idx = index_entries()
    screen = {}
    if SCREEN_FILE.is_file():
        screen = {r["edge_id"]: r for r in load_json(SCREEN_FILE)["verdicts"]}
    id_labels: dict[str, str] = {}
    items: list[dict] = []
    counts = {"candidate": 0, "disputed": 0, "duplicate": 0}

    for e in module["edges"]:
        if e["status"] in SETTLED:
            continue          # куратор уже высказался — второй раз не спрашиваем
        is_llm = e["pass"] == "llm"
        weak_auto = e["status"] == "auto" and e["pass"] == "kwic" and e["confidence"] < PRINT_FLOOR
        ev = e.get("evidence") or {}
        # H3198: R1 (крит⊂санскритская) on weak-auto was shown FIRST as a
        # "candidate" because R1/screen only ran on disputed. Demote to
        # disputed + false_match rank so it never leads the pack. Do NOT
        # auto-reject: v4 gold has 1 R1 false positive (ворог⊂творог, approve).
        is_r1 = e["pass"] == "kwic" and r1_substring_false(
            ev.get("term", ""), ev.get("quote", ""))
        if e["status"] == "disputed":
            filt = "disputed"
        elif is_llm or weak_auto:
            filt = "disputed" if is_r1 else "candidate"
        else:
            continue          # проход A и уверенный KWIC — доказаны, человеку не нужны
        counts[filt] += 1

        v = cat.get(e["accession"]) or {}
        ch = chs.get(e["chapter"]) or {}
        ch_label = f'{e["chapter"]} «{ch.get("name", "")}» (с. {ch.get("start")}–{ch.get("end")})'
        title = v.get("title_display") or f'acc{e["accession"]}'
        rel_ru = RELATION_RU.get(e["relation"], e["relation"])
        tc = f' ▸ {e["timecode"]}' if e.get("timecode") else ""

        question = (
            f'Дополнить главу <b>{esc(ch_label)}</b> ссылкой на запись '
            f'<b>acc{esc(e["accession"])} «{esc(title)}»</b> '
            f'({fmt_hms(v.get("duration_seconds"))})? '
            f'Тип связи: <b>{esc(rel_ru)}</b> (<code>{esc(e["relation"])}</code>), '
            f'проход <code>{esc(e["pass"])}</code>, '
            f'уверенность {e["confidence"]:.2f}{esc(tc)}. '
            f'Связь значит «чем запись дополняет главу», а не «это запись этой главы».'
        )

        panels = []
        panels.append(("Что это за запись", (
            f'<div><a href="{esc(v.get("watch_url"))}" target="_blank" rel="noopener">'
            f'{esc(title)}</a> — {fmt_hms(v.get("duration_seconds"))}'
            f'{"; темы: " + esc(", ".join(v.get("topics") or [])) if v.get("topics") else ""}'
            f'</div>')))
        lec = lectures.get(ch.get("name", ""))
        if lec:
            panels.append(("Глава книги", (
                f'<div><b>{esc(ch.get("name"))}</b>, с. {esc(lec.get("pages"))}: '
                f'{esc(lec.get("main_idea", ""))}</div>')))

        if ev.get("term"):
            entry = idx.get(str(ev["term"]).lower())
            if entry:
                book_ctx = "<br>".join(f"«…{esc(c)}…»" for c in entry["contexts"][:2]) \
                    or '<span class="muted">контекст в указателе не сохранён</span>'
                panels.append(("Термин в книге", (
                    f'<div>Статья указателя ({esc(entry["rubric"])}): <b>{esc(entry["head"])}</b>, '
                    f'с. {esc(", ".join(str(p) for p in entry["pages"]))}.<br>{book_ctx}</div>')))
            else:
                panels.append(("Термин в книге", (
                    f'<div>Термин <b>{esc(ev["term"])}</b> (с. {esc(ev.get("page"))}) '
                    f'в модулях указателя не найден — совпадение только по расшифровке, '
                    f'доказательство слабее.</div>')))

        if ev.get("quote"):
            src = (f'файл <code>{esc(ev["srt"])}</code>, смещение '
                   f'{fmt_hms(ev.get("at") or ev.get("offset_seconds"))}'
                   if ev.get("srt") else "источник не назван")
            panels.append(("Цитата из записи", f'<pre>{esc(ev["quote"])}</pre>'
                                               f'<div class="muted">{src}</div>'))

        if is_llm:
            src = quote_source(ev.get("quote", ""))
            verdict = (f'цитата найдена в: {esc(src)}' if src else
                       '⚠ источник цитаты в данных репозитория НЕ найден — модель могла '
                       'её пересказать или выдумать; перед approve проверьте вручную')
            panels.append(("Метод (не доказательство)", (
                f'<div>Ребро предложила модель <code>{esc(ev.get("model"))}</code> '
                f'(промпт <code>{esc(ev.get("prompt_hash"))}</code>) по аннотациям глав и '
                f'метаданным записи. Имя модели — способ получения связи; доказательство — '
                f'приведённая ею цитата: {verdict}.</div>')))

        extra = []
        if ev.get("series"):
            extra.append(f'цикл <code>{esc(ev["series"])}</code>')
        if ev.get("matched"):
            extra.append(f'совпало по {esc(ev.get("by", "заголовку"))}: «{esc(ev["matched"])}»')
        if ev.get("asr") == "looped":
            extra.append("⚠ подозрение на зацикленный фрагмент распознавания — "
                         "уверенность уже снижена вдвое")
        if extra:
            panels.append(("Прочие сигналы", "<div>" + "; ".join(extra) + "</div>"))

        badges = [e["pass"], f'{e["confidence"]:.2f}', rel_ru]
        sc = screen.get(e["edge_id"])
        if sc:
            badges.append(SCREEN_RU.get(sc.get("verdict"), sc.get("verdict", "")))
            panels.append(("Скрин DeepSeek (не приговор)", (
                f'<div>{esc(SCREEN_RU.get(sc.get("verdict"), sc.get("verdict")))} — '
                f'{esc(sc.get("reason", ""))}. Модель deepseek-v4-flash; на 62 ваших '
                f'голосах скрин расходится с вами в ~1/4 случаев, поэтому он только '
                f'сортирует и подписывает карточки, а решает человек.</div>')))
        if is_r1:
            badges.append("R1: термин только внутри чужого слова")

        id_labels[f'acc{e["accession"]}'] = title
        id_labels[e["chapter"]] = ch.get("name", "")
        screen_rank = SCREEN_ORDER.get((sc or {}).get("verdict"), 1)
        if is_r1:
            screen_rank = max(screen_rank, SCREEN_ORDER["false_match"])
        items.append({
            "id": e["edge_id"],
            "filt": filt,
            "_screen_rank": screen_rank,
            "title": f'«{title}» ↔ {e["chapter"]} «{ch.get("name", "")}»',
            "title_href": v.get("watch_url"),
            "badges": badges,
            "question": question,
            "panels": panels,
            "note_placeholder": "если глава другая — впишите ch01…ch11; apply-скрипт читает "
                                "только approve/reject, заметка идёт в аудит-след",
        })

    for d in module["duplicates"]:
        if d.get("status") in SETTLED:
            continue
        counts["duplicate"] += 1
        a, b = d["pair"]
        ta, tb = ((cat.get(a) or {}).get("title_display") or f"acc{a}",
                  (cat.get(b) or {}).get("title_display") or f"acc{b}")
        id_labels[f"acc{a}"] = ta
        id_labels[f"acc{b}"] = tb
        items.append({
            "id": f"dup-{a}-{b}",
            "filt": "duplicate",
            "title": f"дубль? «{ta}» ≡ «{tb}»",
            "badges": ["дубль", VERDICT_RU.get(d["verdict"], d["verdict"]),
                       f'{d["duration_seconds"] // 60} мин'],
            "question": (f'Считать записи <b>acc{esc(a)} «{esc(ta)}»</b> и '
                         f'<b>acc{esc(b)} «{esc(tb)}»</b> одной и той же публикацией '
                         f'(длительность совпадает до секунды)? Approve проставит '
                         f'<code>duplicate_of</code>; запись <b>не удаляется</b> ни при '
                         f'каком решении.'),
            "panels": [
                ("Заголовки", "<div>" + "<br>".join(
                    f"acc{esc(x)} — {esc(t)}" for x, t in zip(d["pair"], d["titles"])) + "</div>"),
                ("Предварительный разбор",
                 f'<div>{esc(d["rationale"])} (машинная оценка: '
                 f'{esc(VERDICT_RU.get(d["verdict"], d["verdict"]))})</div>'),
            ],
            "note_placeholder": "чем именно записи отличаются, если это не дубль",
        })

    # вероятно-ценные карточки первыми, вероятный мусор в конце (замечание
    # куратора v3: не тратить человеческое время на мусор); сортировка
    # устойчивая — внутри ранга исходный порядок рёбер сохраняется
    group = {"candidate": 0, "disputed": 1, "duplicate": 2}
    items.sort(key=lambda it: (group[it["filt"]], it.pop("_screen_rank", 1)))
    return items, counts, id_labels


def prefill_script(sheet_id: str) -> str:
    """Преднабор решений первого захода (15-08-2026): голоса переносятся в
    localStorage нового листа, если куратор ещё не голосовал эти карточки."""
    if not PREFILL_V1.is_file():
        return ""
    v1 = load_json(PREFILL_V1)
    seed = {i["id"]: {"d": i["decision"], "n": i.get("note", "")}
            for i in v1["items"] if i.get("decision")}
    if not seed:
        return ""
    return ("\n<script>\n(function () {\n"
            "  var K = 'review-sheet:' + %s;\n"
            "  var P = %s;\n"
            "  try {\n"
            "    var s = JSON.parse(localStorage.getItem(K) || '{}') || {};\n"
            "    var changed = false;\n"
            "    for (var id in P) {\n"
            "      if (!Object.prototype.hasOwnProperty.call(P, id)) continue;\n"
            "      s[id] = s[id] || {};\n"
            "      if (!s[id].decision) { s[id].decision = P[id].d; changed = true; }\n"
            "      if (P[id].n && !s[id].note) { s[id].note = P[id].n; changed = true; }\n"
            "    }\n"
            "    if (changed) localStorage.setItem(K, JSON.stringify(s));\n"
            "  } catch (e) {}\n"
            "})();\n</script>\n"
            % (json.dumps(sheet_id), json.dumps(seed, ensure_ascii=False)))


def main() -> int:
    from csl_pyutil import render_review_sheet
    from csl_pyutil.evidence import EvidenceManifest

    module = load_json(MODULES / "22-crosswalk.json")["crosswalk"]
    cat = {v["accession"]: v for v in catalog()}
    items, counts, id_labels = build_items(module, cat)

    dump_json(CW / "gate_candidates.json", {
        "schema": "bookindex.crosswalk.gate/2",
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
        "title": "BookIndex — крест «видео ↔ главы», куратор-гейт v4 (H2707)",
        "context": CONTEXT,
        "reject_labels": REJECT_LABELS,
        "identity_gate": {"patterns": [r"\bacc\d{3}\b", r"\bch\d{2}\b"],
                          "labels": id_labels},
        "subtitle": (
            f"{stats['edges']} рёбер на {stats['records_covered']} из "
            f"{stats['records_total']} записей каталога; {stats['with_timecode']} с тайм-кодом. "
            "Approve = ребро идёт в печать волны 2; Reject = ребро остаётся в данных "
            f"со статусом rejected и на полосу не попадает. Решённое в заходах "
            f"15–16-08-2026 ({stats.get('approved', 0)} принято, {stats.get('rejected', 0)} "
            "отклонено, включая машинные R1-отсевы ложных подстрочных совпадений) "
            "применено к данным и на лист больше не выносится. Карточки отсортированы "
            "DeepSeek-скрином: вероятно-ценные первыми, вероятный мусор в конце — "
            "вердикт скрина подписан на карточке, решает человек."
        ),
        "footer": ("Секции: кандидаты (LLM и слабый KWIC) · спорные (ниже порога прохода) · "
                   "дубли (пары одинаковой длительности). Записи каталога не "
                   "удаляются ни при каком решении. Лист меряет активное время (⏱) — "
                   "всего и на карточку; секунды уходят в decisions.json. Кончилось "
                   "время — ⏸ останавливает таймер, «Сдать сколько успел» выгружает "
                   "проголосованное; остальное остаётся в браузере, заход продолжается."),
        "approve_label": "Принять связь",
        "reject_label": "Отклонить",
        "filters": [("candidate", f"кандидаты ({counts['candidate']})"),
                    ("disputed", f"спорные ({counts['disputed']})"),
                    ("duplicate", f"дубли ({counts['duplicate']})")],
        "generated": GENERATED,
        "show_ids": True,
        "save_as": SAVE_AS,
        "ui_strings": {
            "timing_title": "активное время на листе (пока вкладка видима)",
            # V12 (csl-pyutil 0.11.0) — то, чего куратору не хватило 15-08-2026.
            "handin_button": "Сдать сколько успел",
            "handin_title": ("остановить таймер и выгрузить уже проголосованное; "
                             "остальное остаётся сохранённым в этом браузере"),
            "pause_title": "пауза — перерыв не должен считаться работой",
            "handin_said": ("сдано {n} из {total} — таймер остановлен, "
                            "остальное осталось в браузере"),
        },
        # Идентификаторы YouTube — латиница со смешанным регистром, и детектор
        # SLP1 читает их как санскрит в человеческом тексте. Это не транслитерация,
        # а машинный ключ, поэтому он объявляется допустимым явно. Латинские
        # арабские модели ("katiba", "salima") — предмет главы 6, тоже данные.
        "preflight": {"allow_slp1_tokens": tuple(sorted(
            {v["youtube_id"] for v in cat.values() if v.get("youtube_id")}))},
    }

    manifest = EvidenceManifest(SHEET_ID, [i["id"] for i in items], repo_root=str(REPO))
    manifest.declare_joined("data/modules/22-crosswalk.json",
                            ["chapter", "relation", "confidence", "evidence", "timecode"])
    manifest.declare_joined("data/video_catalog_public.v2.json",
                            ["title_display", "topics", "duration_seconds", "watch_url"])
    manifest.declare_joined("data/modules/20-lectures.json",
                            ["name", "pages", "main_idea"])
    for fname, _key, _r in _INDEX_MODULES:
        manifest.declare_joined(f"data/modules/{fname}.json",
                                ["head", "occurrences"])
    manifest.declare_omitted_path(
        "data/crosswalk/srt_cache",
        "расшифровки целиком не публикуются (права); в карточке — цитата ±120 знаков")
    manifest.declare_omitted_path(
        "data/lectures_kwic.json",
        "KWIC по вечеру памяти, а не по этим записям: другой источник, не про эти рёбра")

    doc = render_review_sheet(items, config, screening=screening, manifest=manifest)
    doc = doc.replace("</body>", prefill_script(SHEET_ID) + "</body>", 1)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_HTML.write_text(doc, encoding="utf-8")

    print(f"записано {OUT_HTML.relative_to(REPO)} — {len(items)} карточек "
          f"(кандидаты {counts['candidate']}, спорные {counts['disputed']}, "
          f"дубли {counts['duplicate']})")
    print(f"решения выгружаются в {SAVE_AS}; применение — "
          f"python scripts/crosswalk/apply_gate_decisions.py <decisions.json>")
    print("кандидаты продублированы в data/crosswalk/gate_candidates.json (лист gitignored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
