# Release Notes — v2.1.0 (2026-04-15)

## Highlights

- Closed full v2 backlog (`#16`–`#25`).
- Added density modes (`compact`, `reader`, `research`) with persistence.
- Added lecture comparison panel (intersection and unique entities).
- Added page-range trends analytics with interactive window selection.
- Added analytics export to `CSV` and `Markdown`.
- Added data schema versioning and migrations:
  - `schema_version` / `schema_migrations` in `app_data.json`;
  - runtime migration layer in `v3_app.js`;
  - validation checks in `scripts/validate_content.py`;
  - standalone migration tool `scripts/migrate_app_data.py`.

## Build and QA

- Built fresh standalone artifact: `aaz-index.html`.
- Validation: `python scripts/validate_content.py app_data.json` — `0 errors`.
- Runtime smoke: `python runtime_test.py` — `20/20`.

## Included artifact

- `aaz-index.html` (standalone SPA build for browser use).

