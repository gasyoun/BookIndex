# Release Notes - v4.2.0 (2026-04-18)

## Highlights

- Улучшена устойчивость `runtime_test.py`:
  - авто-поиск Node.js через `NODE_BINARY`, PATH и типовые пути Windows;
  - понятная диагностика окружения при отсутствии Node.js.
- Добавлен `scripts/content_report.py`:
  - сводные метрики по `app_data.json`;
  - форматы вывода: Markdown (`--format md`) и JSON (`--format json`).
- Добавлена поддержка reduced motion:
  - CSS-адаптация для `prefers-reduced-motion: reduce`;
  - отключение smooth-scroll к якорям в scholar-разделе при reduced motion.
- Обновлена документация:
  - новый `README.md` с актуальным описанием функционала;
  - добавлена детская инструкция `KIDS_GUIDE_RU.md`.

## QA (прогон 2026-04-18)

- `python runtime_test.py` (c `NODE_BINARY`) - OK (`21/21`).
- `npx playwright test` (через локальный Node.js) - OK (`34 passed`).

## GitHub

- Merged PR:
  - `#50` runtime_test Node guard.
  - `#52` content audit report.
  - `#54` reduced motion support.
- Closed issues:
  - `#49`, `#51`, `#53`.
