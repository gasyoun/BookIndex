#!/usr/bin/env python3
"""Regenerate the Russian stats.md project summary from app_data.json.

Reuses scripts/content_report.py's build_report() for the entity/context
counters so this file and `npm run content:audit` never disagree, and reads
the version from package.json so it never drifts from README.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

import content_report  # noqa: E402  (path set up above)

APP_DATA_PATH = ROOT / "app_data.json"
PACKAGE_JSON_PATH = ROOT / "package.json"
STATS_PATH = ROOT / "stats.md"

RUSSIAN_MONTHS = (
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)


def configure_output_encoding() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def format_thousands(value: int) -> str:
    return f"{value:,}".replace(",", " ")


def format_russian_date(today: date) -> str:
    return f"{today.day} {RUSSIAN_MONTHS[today.month - 1]} {today.year} г."


def count_video_semantic_links(video_catalog: list) -> int:
    return sum(
        1
        for video in video_catalog
        if isinstance(video, dict)
        for link in (video.get("related_entities") or [])
        if isinstance(link, dict) and not link.get("src")
    )


def render_stats_markdown(data: dict, version: str, today: date) -> str:
    report = content_report.build_report(data, str(APP_DATA_PATH.name))
    entities = report["entities"]
    totals = report["totals"]

    lexemes = entities["lexicon"]["items_total"]
    persons_places = entities["names"]["items_total"] + entities["toponyms"]["items_total"]
    langs_ethno = entities["languages"]["items_total"] + entities["ethnonyms"]["items_total"]
    subject_terms = entities["subject_index"]["items_total"]
    reverse_tech = entities["lexicon_reverse"]["items_total"] + entities["lexicon_tech"]["items_total"]
    total_entities = totals["items_total"]

    lectures = data.get("lectures") or data.get("chapters") or []
    lecture_count = len(lectures) if isinstance(lectures, list) else 0
    total_pages = report.get("book_total_pages") or 0
    context_mentions = totals["context_snippets_total"]
    density = round(context_mentions / total_pages, 1) if total_pages else 0.0

    video_catalog = data.get("video_catalog") or []
    video_count = len(video_catalog) if isinstance(video_catalog, list) else 0
    total_duration_hours = round(
        sum(v.get("duration", 0) for v in video_catalog if isinstance(v, dict)) / 3600, 1
    )
    semantic_links = count_video_semantic_links(video_catalog)

    lines = [
        f"# Статистика проекта «Зализнякиада» ({version})",
        "",
        "Данный документ содержит актуальные метрики цифровой экосистемы, "
        "посвященной научному наследию А. А. Зализняка.",
        "",
        "## 1. Научный аппарат (Scientific Index)",
        "| Категория | Количество |",
        "| :--- | :--- |",
        f"| **Всего уникальных сущностей** | **{format_thousands(total_entities)}** |",
        f"| Лексемы и словоформы | {format_thousands(lexemes)} |",
        f"| Антропонимы и топонимы | {format_thousands(persons_places)} |",
        f"| Языки и этнонимы | {format_thousands(langs_ethno)} |",
        f"| Научные понятия и термины | {format_thousands(subject_terms)} |",
        f"| Обратный указатель и технические термины | {format_thousands(reverse_tech)} |",
        "",
        "## 2. Глубина корпуса (Corpus Depth)",
        "| Метрика | Значение |",
        "| :--- | :--- |",
        f"| Количество лекций (глав) в томе | {lecture_count} |",
        f"| Проиндексировано страниц | {format_thousands(total_pages)} |",
        f"| **Всего контекстных упоминаний** | **{format_thousands(context_mentions)}** |",
        f"| Плотность индексации | ~{density} упоминаний на страницу |",
        "",
        "## 3. Мультимедийный архив (Multimedia Archive)",
        "| Метрика | Значение |",
        "| :--- | :--- |",
        f"| **Всего видеолекций** | **{video_count}** |",
        f"| Общая длительность видео | {total_duration_hours} часов |",
        f"| **Семантические связи (Видео ↔ Текст)** | **{format_thousands(semantic_links)}** |",
        "| Технология привязки | Deep Semantic Matching (Stemming) |",
        "",
        "## 4. Технические характеристики",
        "*   **Архитектура**: Single-page Progressive Web App (PWA).",
        "*   **Оффлайн-режим**: Полное кэширование через Service Worker (Expedition Mode).",
        "*   **Поиск**: Фоновый индексатор (Web Workers) с поддержкой нечеткого поиска.",
        "*   **Персонализация**: Researcher's Diary (LocalDB + MD Export).",
        "",
        "---",
        f"*Дата последнего обновления: {format_russian_date(today)}*",
        "*Регенерируется автоматически: `npm run stats` (scripts/generate_stats_md.py).*",
        "",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    configure_output_encoding()
    data = load_json(APP_DATA_PATH)
    package_json = load_json(PACKAGE_JSON_PATH)
    version = f"v{package_json.get('version', '0.0.0')}"
    markdown = render_stats_markdown(data, version, date.today())
    STATS_PATH.write_text(markdown, encoding="utf-8")
    print(f"Wrote {STATS_PATH} ({version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
