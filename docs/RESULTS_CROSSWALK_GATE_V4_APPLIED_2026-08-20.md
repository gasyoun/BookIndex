# Куратор-гейт креста «видео ↔ главы»: v4 применён полностью

_Created: 20-08-2026 · Last updated: 20-08-2026_

Экспорт листа `bookindex-crosswalk-video-chapter-v4` (файл скачан как `*_decisions_partial.json`, но `undecided: 0` и 160/160 карточек с голосом) применён к кресту 20-08-2026. Handoff: [H3198](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3198-Grok_BookIndex_crosswalk-gate-v4-votes-apply_20.08.26.md) (Grok 4.6 `grok-4.6`). Источник голосов: [data/crosswalk/gate_decisions_v4.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/gate_decisions_v4.json). Конвейер: `python scripts/crosswalk/apply_gate_decisions.py` → `npm run data:assemble`.

## Голоса

| | n |
|---|---|
| ✅ approve | 90 (84 ребра + 6 пар дублей) |
| ❌ reject | 70 рёбер |
| ◯ defer / не рассмотрено | 0 |
| примечаний куратора | 1 |
| активное время | 2322 с ≈ 38,7 мин (V11) |

Ярлыки отклонения: `mere_use` 39 · `false_match` 18 · `metaphor` 9 · без ярлыка 4.

Конфликтов с уже применёнными v1/v2/v3 нет (пересечение 160, расхождений 0).

## Статусы рёбер после применения

| status | n |
|---|---|
| approved | 142 |
| rejected | 106 |
| auto (не на листе: серии, уверенный KWIC ≥ 0,85, title_topics) | 129 |
| disputed | 0 |

По проходам среди **approved**: kwic 103 · llm 29 · title_topics 10. Среди **rejected**: kwic 105 · llm 1. Оставшийся auto: series 95 · title_topics 27 · kwic 7 (выше порога печати). `validate_edges.py` A3–A6/A13: PASS. Пустых глав нет (ch07 «Арабский язык» по-прежнему 1 ребро).

Шесть пар дублей получили `duplicate_of` в [data/video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json) (плюс ранее стоявший acc040→005 волны 0): 012→008, 018→017, 034→023, 054→007, 107→088, 173→119.

Печатный разворот 4–5 ([H3135](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3135-Fable_BookIndex_h2707-residual-spread-4-5-print-prose_19.08.26.md), Fable 5) теперь может читать только `status: approved`. H2707 сам по себе заперт precheck exit 4 (PR #267) — не перезапускать.

## Замечание куратора на acc050 (Крит ⊂ санскритская)

Единственная заметка:

> Почему вообще мое время тратиться, сопоставляя Крит и санскритская? Можно ли пересобрать голосование без подобного мусора? Чтобы впредь нигде подобное не повторялось.

Карточка — `status: auto`, pass kwic, conf 0,777 < порога печати 0,85, поэтому попала в группу **кандидатов** и шла **первой**. Правило R1 (термин только внутри чужого слова) и DeepSeek-скрин в v4 бежали только по `disputed`, поэтому слабый auto этот фильтр обошёл. R1 на этой цитате срабатывает (`крит` внутри `санскритская`). Куратор отклонил как `false_match` (77 с на первой карточке).

Пересобирать 160 уже проголосованных карточек не нужно — гейт закрыт. Чтобы мусор этого класса не возглавлял следующий лист:

- `build_crosswalk_gate.py` теперь понижает R1-совпадение со слабого auto в `disputed` и ставит экранный ранг `false_match`, плюс бейдж «R1: термин только внутри чужого слова».
- Автоотклонение R1 **не** расширяется на `auto`: на том же v4 золоте R1 убивает approve acc161 (`ворог` ⊂ `творог`, лекция про ударение). Калибровка «0 ложных срабатываний на 62 голосах» после v4 больше не держится.

## Watcher

Экспорт нёс `complete: false` / `partial: true` при нуле нерешённых. Watcher до этой правки игнорировал такой файл как черновик и не писал бы телеметрию в зачёт гейта H2855. Исправлено: `complete:false` блокирует ingest только при наличии нерешённых карточек. Addendum [FINDINGS §111](https://github.com/gasyoun/Uprava/blob/main/FINDINGS.md).

_Dr. Mārcis Gasūns_
