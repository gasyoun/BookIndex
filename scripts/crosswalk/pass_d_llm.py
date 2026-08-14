"""Шаг 6, проход D: DeepSeek на остатке — записи без уверенного ребра после A–C.

Клиент **импортируется, не переписывается**: канонический
[openmodel_client.py](https://github.com/gasyoun/IndologyScholars/blob/main/tools/openmodel_client.py)
уже несёт цепочку конфига, ретраи с экспонентой и `chat_json` со срезанием
markdown-заборов.

**Смоук-тест обязателен до массового прогона** (риск R-1). Провал — не отмена
прохода: очередь пишется в `data/crosswalk/pass_d_pending.json`, шаги 7–8 идут
дальше, проход доигрывается отдельным прогоном.

Измерено 14-08-2026: шлюз `OPENMODEL_BASE_URL` отвечает
`{'code': 'NOT_FOUND', 'msg': 'route not found'}`, а `DEEPSEEK_BASE_URL`
(`https://api.deepseek.com`) живой — поэтому скрипт при пустом ответе шлюза
принудительно опускается на звено DEEPSEEK_* цепочки.

    python scripts/crosswalk/pass_d_llm.py [--limit N] [--dry-run]

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import (CW, MODULES, SRT_CACHE, archive_map, catalog, chapters,  # noqa: E402
                    dump_json, load_json, make_edge)
from srt_parse import parse  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

CLIENT_DIR = Path(r"C:\Users\user\Documents\GitHub\IndologyScholars\tools")
TRANSCRIPT_CHARS = 6000
RELATIONS = ("lecture_of", "expands", "sequel_to", "about_zaliznyak",
             "other_book", "scholarly_work")


def load_client():
    """Импортируем канонический клиент; свой HTTP-клиент писать запрещено планом."""
    sys.path.insert(0, str(CLIENT_DIR))
    # шлюз OPENMODEL_* отдаёт 404 «route not found» — опускаемся на DEEPSEEK_*
    for var in ("OPENMODEL_BASE_URL", "OPENMODEL_MODEL", "OPENMODEL_API_KEY"):
        os.environ[var] = ""
    import openmodel_client  # noqa: E402
    return openmodel_client


def strip_fences(text: str) -> str:
    """Срезает случайный markdown-забор вокруг JSON — та же логика, что в `chat_json`."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        t = t[4:].strip() if t.lower().startswith("json") else t.strip()
    return t


def chapter_block() -> str:
    summaries = {s["name"]: s for s in load_json(MODULES / "20-lectures.json")["lecture_summaries"]}
    lines = []
    for c in chapters():
        s = summaries.get(c["name"]) or {}
        about = (s.get("about") or s.get("tagline") or "").strip()
        lines.append(f"{c['id']} — «{c['name']}» (с. {c['start']}–{c['end']}). {about}")
    return "\n".join(lines)


SYSTEM = (
    "Ты помогаешь связать видеозаписи А. А. Зализняка с главами его книги "
    "«Из жизни слов и языков». Отвечай строго одним объектом JSON без пояснений."
)

TEMPLATE = """Главы книги:
{chapters}

Запись видеокаталога:
заголовок: {title}
темы: {topics}
длительность: {duration}
фрагмент расшифровки (может быть пустым):
\"\"\"{transcript}\"\"\"

Верни JSON: {{"chapter": "chNN или null", "relation": "одно из {relations}",
"confidence": число 0..1, "quote": "дословная цитата из расшифровки или заголовка,
подтверждающая связь"}}.

Как выбирать:
- назови **ближайшую по предмету** главу и честно оцени уверенность; низкая
  уверенность — это нормальный ответ, он уйдёт на человеческую проверку;
- запись *о* Зализняке, о подготовке издания или о его других книгах тоже
  получает главу: биографическое и издательское идёт в ch01, предметное — в
  главу своей темы, а тип связи выражается полем relation
  (`about_zaliznyak`, `other_book`, `scholarly_work`);
- "chapter": null — только если запись вообще не о языке и не о Зализняке;
- цитату не выдумывай: если подтверждения нет, оставь её пустой и снизь
  confidence."""


def confident() -> set[str]:
    out: set[str] = set()
    for name in ("edges_pass_a.json", "edges_pass_b.json", "edges_pass_c.json"):
        p = CW / name
        if p.exists():
            out |= {e["accession"] for e in load_json(p)["edges"] if e["status"] == "auto"}
    return out


def transcript_for(rec: dict | None) -> str:
    if not rec or not rec.get("timecoded"):
        return ""
    src = SRT_CACHE / f"acc{rec['accession']}.{rec['timecoded']['ext']}"
    if not src.exists():
        return ""
    cues = parse(src.read_text(encoding="utf-8", errors="replace"))
    return " ".join(c.text for c in cues)[:TRANSCRIPT_CHARS]


def main() -> int:
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    dry = "--dry-run" in sys.argv

    done = confident()
    amap = archive_map()
    valid = {c["id"] for c in chapters()}
    todo = [v for v in catalog() if v["accession"] not in done]
    print(f"остаток после A–C: {len(todo)} записей")
    if limit:
        todo = todo[:limit]
        print(f"  (--limit {limit}: берём первые {len(todo)})")

    client = load_client()
    base, model_cfg = client.load_config()
    print(f"шлюз: {base}  модель конфига: {model_cfg}")

    if not dry:
        try:
            # слово «json» в промпте обязательно, иначе API отвергает
            # response_format=json_object с 400 — проверено 14-08-2026
            client.chat([{"role": "user", "content": "Верни json: {\"ok\":true}"}],
                        max_tokens=16, json_object=True)
            print("смоук-тест: OK")
        except Exception as exc:                      # noqa: BLE001 — R-1 это условие остановки прохода
            print(f"смоук-тест ПРОВАЛЕН: {exc}")
            dump_json(CW / "pass_d_pending.json", {
                "schema": "bookindex.crosswalk.pending/1",
                "reason": f"смоук-тест DeepSeek провален: {exc}",
                "accessions": [v["accession"] for v in todo],
            })
            print("очередь записана в data/crosswalk/pass_d_pending.json; шаги 7–8 идут дальше")
            return 0

    chs = chapter_block()
    edges, pending, seen_model = [], [], ""
    for i, v in enumerate(todo, 1):
        acc = v["accession"]
        prompt = TEMPLATE.format(
            chapters=chs,
            title=v.get("title_display") or v.get("title_source") or "",
            topics=", ".join(v.get("topics") or []) or "нет",
            duration=f"{(v.get('duration_seconds') or 0) // 60} мин",
            transcript=transcript_for(amap.get(acc)),
            relations="/".join(RELATIONS),
        )
        phash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
        if dry:
            print(f"  [dry] acc{acc} prompt={len(prompt)} знаков hash={phash}")
            continue
        try:
            # chat_json() отдаёт только словарь, а нам нужны ещё usage и точная
            # версия модели (правило атрибуции), поэтому берём chat() — ретраи и
            # разбор конверта шлюза всё равно остаются на канонической стороне.
            content, usage, resolved = client.chat(
                [{"role": "system", "content": SYSTEM},
                 {"role": "user", "content": prompt}], max_tokens=400)
            data = json.loads(strip_fences(content))
        except Exception as exc:                      # noqa: BLE001
            pending.append({"accession": acc, "error": str(exc)[:200]})
            continue
        seen_model = resolved or seen_model
        ch = (data or {}).get("chapter")
        if not ch or ch not in valid:
            continue
        rel = (data or {}).get("relation")
        rel = rel if rel in RELATIONS else "expands"
        try:
            conf = float((data or {}).get("confidence") or 0)
        except (TypeError, ValueError):
            conf = 0.0
        conf = max(0.0, min(1.0, conf))
        edges.append(make_edge(acc, ch, "llm", rel, conf, evidence={
            "model": resolved,
            "prompt_hash": phash,
            "answer": json.dumps(data, ensure_ascii=False)[:800],
            "quote": (data or {}).get("quote") or "",
            "usage": usage,
        }))
        if i % 10 == 0:
            print(f"  … {i}/{len(todo)}  рёбер {len(edges)}")

    if dry:
        return 0

    dump_json(CW / "edges_pass_d.json", {
        "schema": "bookindex.crosswalk.edges/1",
        "pass": "llm",
        "model": seen_model,
        "gateway": base,
        "attempted": len(todo),
        "failed": len(pending),
        "edges": edges,
    })
    if pending:
        dump_json(CW / "pass_d_pending.json", {
            "schema": "bookindex.crosswalk.pending/1",
            "reason": "отдельные записи не прошли; проход доигрывается повторным прогоном",
            "records": pending,
        })

    print(f"рёбер прохода D: {len(edges)}  (не вышло {len(pending)})")
    print(f"  auto {sum(1 for e in edges if e['status'] == 'auto')}, "
          f"disputed {sum(1 for e in edges if e['status'] == 'disputed')}")
    print(f"  модель: {seen_model}")
    print("записано data/crosswalk/edges_pass_d.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
