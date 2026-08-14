"""Шаг 7, волна 0: починка трёх дефектов видеокаталога перед сборкой креста.

Дефекты, найденные аудитом 14-08-2026, чинятся **в оверлее**
`data/video_catalog_editorial.json`, а не в сгенерированном
`data/video_catalog_public.v2.json`: каталог собирается скриптом
`build_video_catalog_public.py`, и правка выходного файла была бы затёрта
следующей же сборкой.

1. У acc139/acc145/acc146 в поле `type` лежит ссылка-заметка редактора
   (`https://elementy.ru/...`) вместо типа записи. Заметка переезжает в
   `public_note`, `type` получает настоящее значение.
2. acc139 и acc140 — записи ЛЛШ без темы; тема `ЛЛШ` проставляется
   (10 записей темы → 12).
3. acc040 и acc005 — один доклад «Новгородские берестяные грамоты» (2007),
   обе записи по 8340 с. Ставится `duplicate_of`; **удалять запись нельзя** —
   это ломает существующие ссылки и счётчики (забор плана).

    python scripts/crosswalk/wave0_fix_catalog_defects.py [--check]

После прогона каталог пересобирается:
`python scripts/build_video_catalog_public.py`.

План: docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md · handoff H2711.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
EDITORIAL = REPO / "data" / "video_catalog_editorial.json"
ACCESSED = "2026-08-14"
YT = "https://www.youtube.com/watch?v="
ELEMENTY_JIZN = "https://elementy.ru/nauchno-populyarnaya_biblioteka/433260/O_zhizni_slov"
ELEMENTY_ILI = "https://elementy.ru/nauchno-populyarnaya_biblioteka/433894/Ili_i_uzhe"

FIXES: list[dict] = [
    {
        "accession": "139",
        "youtube_id": "Y8-LcHSreTE",
        "type": "лекция",
        "topics": ["ЛЛШ"],
        "public_note": "Редакторская заметка, перенесённая из поля «type»: сверить с "
                       "публикацией «О жизни слов» на «Элементах» — возможно, тот же текст.",
        "evidence": [
            {"url": YT + "Y8-LcHSreTE", "label": "YouTube video", "accessed_at": ACCESSED,
             "supports": ["type", "topics"]},
            {"url": ELEMENTY_JIZN, "label": "«Элементы»: О жизни слов", "accessed_at": ACCESSED,
             "supports": ["public_note"]},
        ],
    },
    {
        "accession": "140",
        "youtube_id": "cdowOJcJ9_c",
        "topics": ["ЛЛШ"],
        "evidence": [
            {"url": YT + "cdowOJcJ9_c", "label": "YouTube video", "accessed_at": ACCESSED,
             "supports": ["topics"]},
        ],
    },
    {
        "accession": "145",
        "youtube_id": "H9Ul5qcniS8",
        "type": "лекция",
        "public_note": "Редакторская заметка, перенесённая из поля «type»: расшифровка "
                       "доклада опубликована на «Элементах» как «Или и уже».",
        "evidence": [
            {"url": YT + "H9Ul5qcniS8", "label": "YouTube video", "accessed_at": ACCESSED,
             "supports": ["type"]},
            {"url": ELEMENTY_ILI, "label": "«Элементы»: Или и уже", "accessed_at": ACCESSED,
             "supports": ["public_note"]},
        ],
    },
    {
        "accession": "146",
        "youtube_id": "r7ep0PXICkk",
        "type": "лекция",
        "public_note": "Редакторская заметка, перенесённая из поля «type»: расшифровка "
                       "доклада опубликована на «Элементах» как «Или и уже».",
        "evidence": [
            {"url": YT + "r7ep0PXICkk", "label": "YouTube video", "accessed_at": ACCESSED,
             "supports": ["type"]},
            {"url": ELEMENTY_ILI, "label": "«Элементы»: Или и уже", "accessed_at": ACCESSED,
             "supports": ["public_note"]},
        ],
    },
    {
        "accession": "040",
        "youtube_id": "PXDA9rQAsx0",
        "duplicate_of": "005",
        "public_note": "Тот же доклад, что и запись 005: «Новгородские берестяные грамоты» "
                       "(2007), обе записи длительностью 8340 с. Запись сохраняется, "
                       "удаление сломало бы существующие ссылки и счётчики.",
        "evidence": [
            {"url": YT + "PXDA9rQAsx0", "label": "YouTube video", "accessed_at": ACCESSED,
             "supports": ["duplicate_of", "public_note"]},
            {"url": YT + "Xf2GBzzKb_0", "label": "YouTube video (запись 005)",
             "accessed_at": ACCESSED, "supports": ["duplicate_of"]},
        ],
    },
]


def main() -> int:
    data = json.loads(EDITORIAL.read_text(encoding="utf-8"))
    existing = {o["accession"] for o in data["overrides"]}
    added, merged = 0, 0

    for fix in FIXES:
        acc = fix["accession"]
        if acc in existing:
            target = next(o for o in data["overrides"] if o["accession"] == acc)
            for k, v in fix.items():
                if k in ("accession", "youtube_id"):
                    continue
                if k == "evidence":
                    seen = {json.dumps(e, ensure_ascii=False, sort_keys=True)
                            for e in target["evidence"]}
                    for e in v:
                        if json.dumps(e, ensure_ascii=False, sort_keys=True) not in seen:
                            target["evidence"].append(e)
                else:
                    target[k] = v
            merged += 1
        else:
            data["overrides"].append(fix)
            added += 1

    data["overrides"].sort(key=lambda o: o["accession"])
    if "--check" in sys.argv:
        print(f"проверка: добавилось бы {added}, слилось бы {merged}")
        return 0

    EDITORIAL.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"оверлей обновлён: добавлено {added}, слито {merged}; "
          f"всего overrides {len(data['overrides'])}")
    print("дальше: python scripts/build_video_catalog_public.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
