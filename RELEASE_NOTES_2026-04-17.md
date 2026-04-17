# Release Notes - v4.1.0 (2026-04-17)

## Highlights

- `#43` KWIC MVP доведен до формального DoD:
  - поиск по `lexicon` и `glossary`;
  - фильтр диапазона страниц;
  - сортировка по левому/правому контексту и странице;
  - переходы в карточку и в термин глоссария.
- Добавлены статические и рантайм guard'ы для структуры KWIC-контекстов:
  - нормализация `contexts` на этапе подготовки данных;
  - безопасная итерация по контекстам;
  - лимиты на размер фрагмента и количество строк выдачи;
  - явный флаг усечения выдачи и сообщение в UI ("показаны первые N").
- `#45` Граф персоналий переведен на `D3.js`:
  - zoom/pan;
  - фильтр минимального веса ребра;
  - tooltip и легенда;
  - клик по узлу открывает карточку персоны.
- `#46` PWA foundations:
  - `manifest.webmanifest`;
  - `sw.js` (cache shell + offline fallback);
  - иконки `icon-192.svg`, `icon-512.svg`;
  - регистрация service worker в рантайме.
- `#47` BibTeX export:
  - экспорт scholar bibliography;
  - экспорт further reading;
  - экспорт источников из карточки.

## KWIC Perf Snapshot

Профиль снят на локальной сборке командой:

```bash
node scripts/profile_kwic.js
```

Итог по 30 итерациям на запрос:

- Lexicon KWIC: максимум `avg ~14.1ms`, максимум `p95 ~30.8ms`, до `593` строк.
- Glossary KWIC: максимум `avg ~61.2ms`, максимум `p95 ~78.5ms`, capped at `1200` строк (`truncated=true` для широких запросов).
- Сортировка `left` на 400 строк: максимум `avg ~34.5ms`, максимум `p95 ~50.7ms`.

## QA

- `python scripts/build_aaz_index.py` - OK.
- `python scripts/check_encoding.py` - OK.
- `python scripts/validate_content.py app_data.json` - OK (`0 errors`, `2` известных warning по дублям данных).
- `python runtime_test.py` - OK (`21/21`).
- `playwright test` - OK (`34 passed`).

## Included Artifacts

- `aaz-index.html` (standalone SPA build).

## Notes

- Локальный статус `#45/#46/#47` готов к синхронизации в GitHub.
- Синхронизация issue-статусов в этой сессии не выполнялась через `gh` CLI (недоступен).
