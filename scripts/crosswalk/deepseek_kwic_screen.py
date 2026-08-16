"""H2707 gate v4 — DeepSeek-скрин спорных KWIC-рёбер креста «видео ↔ главы».

Куратор (v3 partial, 16-08-2026) велел отсекать без человека три класса
KWIC-мусора: ложное совпадение внутри чужого слова (тер|петь), метафору
(«другой полюс»), и цитаты, где слово лишь употреблено, а не обсуждается
(«не обсуждается судьба конкретного слова»). Механическое правило ловит
только первый класс; второй и третий — семантика, здесь её судит
DeepSeek Flash как независимый скрин.

Режимы:
    --validate   прогнать скрин по УЖЕ проголосованным куратором kwic-рёбрам
                 (v1+v2+v3 partial) и напечатать матрицу согласия — скрину
                 разрешается резать только если он не убивает approve;
    --screen     прогнать по оставшимся спорным kwic-рёбрам, записать
                 вердикты в data/crosswalk/kwic_screen_verdicts.json
                 (данные креста НЕ меняет — применяет apply-этап v4).

Ключ: DEEPSEEK_API_KEY из BookIndex/.env, ../ORS-FAQ/.env или окружения.
Модель: deepseek-v4-flash, thinking off, temperature 0. Возобновляемо.

Run: python scripts/crosswalk/deepseek_kwic_screen.py --validate
     python scripts/crosswalk/deepseek_kwic_screen.py --screen
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CW, MODULES, load_json  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
OUT = CW / "kwic_screen_verdicts.json"
PARTIALS = [CW / f"gate_decisions_v{i}_partial.json" for i in (1, 2, 3)]
ENV_CANDIDATES = [REPO / ".env", REPO.parent / "ORS-FAQ" / ".env",
                  REPO.parent / "CommentaryStrategies" / ".env"]
MODEL = os.environ.get("LLM_MODEL") or "deepseek-v4-flash"
BASE_URL = os.environ.get("LLM_BASE_URL") or "https://api.deepseek.com"

SYSTEM = (
    "Ты — редактор указателя к научно-популярной книге об А. А. Зализняке. "
    "Крест «видео ↔ главы» предлагает дополнить ГЛАВУ КНИГИ ссылкой на место "
    "в видеозаписи, где встретился термин из указателя этой главы. Тебе дают "
    "главу (название и о чём она), термин и цитату из автоматической "
    "расшифровки видео (±120 знаков вокруг совпадения; в расшифровке бывают "
    "ошибки распознавания). Вопрос: ДОПОЛНЯЕТ ли это место записи главу?\n"
    "- linguistic — да: слово обсуждается как языковой объект (форма, "
    "ударение, история, значение) ИЛИ цитата содержательно касается темы "
    "главы (для биографических глав достаточно, что эпизод относится к "
    "жизни/людям/реалиям главы);\n"
    "- mere_use — нет: слово случайно мелькнуло в речи (в т.ч. "
    "метафорически), к теме главы место записи отношения не имеет;\n"
    "- false_match — в цитате этого слова нет вовсе (совпадение внутри "
    "чужого слова или ошибка распознавания); родственная форма с приставкой "
    "(вывозя при термине «везя») — НЕ false_match;\n"
    "- unsure — по обрывку решить нельзя.\n"
    "Отвечай СТРОГО одним JSON: {\"verdict\": \"linguistic|mere_use|"
    "false_match|unsure\", \"reason\": \"кратко по-русски\"}."
)


def load_dotenv() -> None:
    for env_path in ENV_CANDIDATES:
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def client_or_die():
    load_dotenv()
    key = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("LLM_API_KEY")
    if not key:
        print("ERROR: DEEPSEEK_API_KEY не найден (.env)")
        sys.exit(2)
    import openai

    return openai.OpenAI(api_key=key, base_url=BASE_URL)


def chapter_info() -> dict[str, str]:
    from common import chapters  # noqa: PLC0415 — same path hack as siblings

    lectures = {l["name"]: l for l in load_json(MODULES / "20-lectures.json")["lectures"]}
    out = {}
    for c in chapters():
        lec = lectures.get(c.get("name", "")) or {}
        out[c["id"]] = f'{c.get("name", c["id"])} — {lec.get("main_idea", "")}'
    return out


def ask(client, term: str, quote: str, chapter: str = "") -> dict:
    user = (f"Глава книги: {chapter}\nТермин указателя: «{term}»\n"
            f"Цитата из расшифровки:\n«{quote}»")
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=MODEL, max_tokens=300, temperature=0,
                messages=[{"role": "system", "content": SYSTEM},
                          {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                extra_body={"thinking": {"type": "disabled"}},
            )
            return json.loads((resp.choices[0].message.content or "{}").strip())
        except Exception as e:  # noqa: BLE001
            print(f"  retry {attempt + 1}: {type(e).__name__}: {e}")
            time.sleep(3 * (attempt + 1))
    return {"verdict": "unsure", "reason": "api failure"}


def kwic_edges() -> dict[str, dict]:
    return {e["edge_id"]: e
            for e in load_json(MODULES / "22-crosswalk.json")["crosswalk"]["edges"]
            if e.get("pass") == "kwic"}


def main() -> int:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--validate", action="store_true")
    mode.add_argument("--screen", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    edges = kwic_edges()
    client = client_or_die()

    if args.validate:
        votes: dict[str, str] = {}
        for p in PARTIALS:
            if p.is_file():
                for it in load_json(p)["items"]:
                    if it.get("decision") in ("approve", "reject"):
                        votes[it["id"]] = it["decision"]
        gold = [(eid, d) for eid, d in votes.items() if eid in edges]
        if args.limit:
            gold = gold[: args.limit]
        chs = chapter_info()
        conf: dict[tuple[str, str], int] = {}
        killed = []
        for n, (eid, d) in enumerate(gold, 1):
            ev = edges[eid]["evidence"]
            v = ask(client, ev.get("term", ""), ev.get("quote", ""),
                    chs.get(edges[eid].get("chapter", ""), ""))
            verdict = v.get("verdict", "unsure")
            conf[(d, verdict)] = conf.get((d, verdict), 0) + 1
            if d == "approve" and verdict in ("mere_use", "false_match"):
                killed.append((eid, verdict, v.get("reason", "")))
            print(f"[{n}/{len(gold)}] {eid}: куратор={d} скрин={verdict}")
        print("\nматрица (куратор, скрин):")
        for k in sorted(conf):
            print(f"  {k}: {conf[k]}")
        print(f"\napprove, которые скрин бы убил: {len(killed)}")
        for eid, verdict, reason in killed:
            print(f"  {eid} [{verdict}] {reason[:100]}")
        return 0

    done: dict[str, dict] = {}
    if OUT.is_file():
        done = {r["edge_id"]: r for r in load_json(OUT)["verdicts"]}
    rest = [e for e in edges.values() if e["status"] == "disputed"]
    chs = chapter_info()
    results = list(done.values())
    n_new = 0
    for e in rest:
        if e["edge_id"] in done:
            continue
        if args.limit and n_new >= args.limit:
            break
        ev = e["evidence"]
        v = ask(client, ev.get("term", ""), ev.get("quote", ""),
                chs.get(e.get("chapter", ""), ""))
        rec = {"edge_id": e["edge_id"], "term": ev.get("term"),
               "verdict": v.get("verdict", "unsure"),
               "reason": v.get("reason", "")}
        results.append(rec)
        n_new += 1
        print(f"[{n_new}] {e['edge_id']}: {rec['verdict']} — {rec['reason'][:80]}")
        OUT.write_text(json.dumps(
            {"_meta": {"model": f"{MODEL} @ {BASE_URL}", "date": "2026-08-16",
                       "handoff": "H2707", "system_prompt_role": "kwic-screen/1"},
             "verdicts": results}, ensure_ascii=False, indent=1) + "\n",
            encoding="utf-8")
    from collections import Counter

    print("\nвердикты:", dict(Counter(r["verdict"] for r in results)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
