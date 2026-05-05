---
id: "corpus"
title: "corpus"
source_key: "corpus"
source: "Из жизни слов и языков"
book_id: "mumintroll"
tags: ["corpus"]
---

Active book: Из жизни слов и языков (mumintroll).

## Books

- Из жизни слов и языков, А. А. Зализняк, 2026, 424 pages; modules: names, toponyms, ethnonyms, languages, lexicon, lexicon_reverse, lexicon_tech, subject_index, lectures, scholar
- Из заметок о любительской лингвистике, А. А. Зализняк, 2025, 208 pages; modules: app_data.json
- «Слово о полку Игореве»: взгляд лингвиста, А. А. Зализняк, 2024, 448 pages; modules: app_data.json

## Source types

- Книга (book): pages, citations
- Видеокаталог (video_catalog): timecodes, transcripts, citations, media; status: planned; planned: 200

## Source JSON

```json
{
  "active_book_id": "mumintroll",
  "books": [
    {
      "book_id": "mumintroll",
      "title": "Из жизни слов и языков",
      "author": "А. А. Зализняк",
      "year": 2026,
      "edition": "BookIndex corpus edition",
      "default_route": "#v4/home/home",
      "status": "active",
      "source_type": "book",
      "pages_total": 424,
      "content_modules": [
        "names",
        "toponyms",
        "ethnonyms",
        "languages",
        "lexicon",
        "lexicon_reverse",
        "lexicon_tech",
        "subject_index",
        "lectures",
        "scholar"
      ]
    },
    {
      "book_id": "zametki",
      "title": "Из заметок о любительской лингвистике",
      "author": "А. А. Зализняк",
      "year": 2025,
      "edition": "2-е изд., испр. и доп. — М. : Альпина нон-фикшн, 2025",
      "status": "published",
      "source_type": "book",
      "pages_total": 208,
      "default_route": "#v4/home/home",
      "content_modules": [
        "app_data.json"
      ]
    },
    {
      "book_id": "slovo",
      "title": "«Слово о полку Игореве»: взгляд лингвиста",
      "author": "А. А. Зализняк",
      "year": 2024,
      "edition": "4-е изд., испр. — М. : Альпина нон-фикшн, 2024",
      "status": "published",
      "source_type": "book",
      "pages_total": 448,
      "default_route": "#v4/home/home",
      "content_modules": [
        "app_data.json"
      ]
    }
  ],
  "source_types": [
    {
      "type": "book",
      "label": "Книга",
      "supports": [
        "pages",
        "citations"
      ]
    },
    {
      "type": "video_catalog",
      "label": "Видеокаталог",
      "status": "planned",
      "planned_count": 200,
      "supports": [
        "timecodes",
        "transcripts",
        "citations",
        "media"
      ]
    }
  ]
}
```
