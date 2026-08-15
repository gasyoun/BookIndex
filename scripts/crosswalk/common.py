"""Общее для проходов креста «видео ↔ главы»: пути, загрузка, схема ребра.

Один источник правды для всех `pass_*.py`, чтобы главы, пороги и форма ребра
не разъехались между проходами.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "data"
CW = DATA / "crosswalk"
MODULES = DATA / "modules"

CATALOG = DATA / "video_catalog_public.v2.json"
ARCHIVE_INDEX = CW / "yandex_archive_index.json"
ARCHIVE_MAP = CW / "catalog_archive_map.json"
SRT_CACHE = CW / "srt_cache"          # не коммитится: права на расшифровки

# Пороги автоматической постановки ребра — слой «проверка», таблица «Пороги уверенности».
THRESHOLDS = {"series": 0.90, "kwic": 0.75, "title_topics": 0.60, "llm": 0.80}

RELATIONS = {"lecture_of", "expands", "sequel_to", "about_zaliznyak",
             "other_book", "scholarly_work"}
PASSES = {"series", "kwic", "title_topics", "llm", "curator"}
STATUSES = {"auto", "disputed", "approved", "rejected"}


def load_json(path: Path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dump_json(path: Path, obj) -> None:
    """Рабочие файлы прохода (`data/crosswalk/*`): компактный indent=1, всегда LF.

    `newline="\\n"` обязателен: без него на Windows Python пишет CRLF, и файл
    целиком «меняется» в diff при правке одной строки.
    """
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=1),
                          encoding="utf-8", newline="\n")


def dump_canonical(path: Path, obj) -> None:
    """Канонические данные приложения — формат `scripts/app_data_modules.py`.

    `data/modules/*.json` и `data/video_catalog_public.v2.json` пишутся
    `indent=2` + завершающий перевод строки + LF. Писать их через `dump_json`
    нельзя: `indent=1` ломает байтовую сверку split/assemble в CI и раздувает
    diff одной правки до размера всего файла.
    """
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8", newline="\n")


def chapters() -> list[dict]:
    """ch01…ch11 с диапазонами страниц; порядок в модуле — канонический."""
    raw = load_json(MODULES / "20-lectures.json")["chapters"]
    return [{"id": f"ch{i:02d}", "name": c["name"], "start": c["start"], "end": c["end"]}
            for i, c in enumerate(raw, 1)]


def chapter_of_page(page: int, chs: list[dict] | None = None) -> str | None:
    for c in chs or chapters():
        if c["start"] <= page <= c["end"]:
            return c["id"]
    return None


def catalog() -> list[dict]:
    return load_json(CATALOG)["videos"]


def archive_map() -> dict[str, dict]:
    return load_json(ARCHIVE_MAP)["records"]


def acc_label(accession: str) -> str:
    """`001` -> `acc001`. В каталоге ключ хранится без префикса, в документации — с ним."""
    return accession if accession.startswith("acc") else f"acc{accession}"


def make_edge(accession: str, chapter: str, pass_name: str, relation: str,
              confidence: float, evidence: dict, timecode: str | None = None,
              status: str | None = None) -> dict:
    """Ребро — утверждение с доказательством; `evidence` обязателен и непуст."""
    assert relation in RELATIONS, relation
    assert pass_name in PASSES, pass_name
    assert evidence, "ребро без доказательства невалидно"
    conf = round(float(confidence), 3)
    if status is None:
        status = "auto" if conf >= THRESHOLDS.get(pass_name, 1.0) else "disputed"
    assert status in STATUSES, status
    return {
        "edge_id": f"{acc_label(accession)}-{chapter}-{pass_name}",
        "accession": accession,
        "chapter": chapter,
        "relation": relation,
        "pass": pass_name,
        "confidence": conf,
        "evidence": evidence,
        "timecode": timecode,
        "status": status,
    }


def timecode(seconds: float) -> str:
    s = max(0, int(seconds))
    return f"{s // 60:02d}:{s % 60:02d}"


NOISE = re.compile(r"(_после_[^.]*|_часть_\d+|_компиляция[^.]*|_сверк[^.]*|\(\d+\))", re.I)
NONWORD = re.compile(r"[^а-яёa-z0-9]+", re.I)


def norm(s: str) -> str:
    return " ".join(NONWORD.sub(" ", NOISE.sub(" ", (s or "").lower())).split())
