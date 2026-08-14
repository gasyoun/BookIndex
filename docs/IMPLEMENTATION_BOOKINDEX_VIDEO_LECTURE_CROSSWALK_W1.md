# Реализация волны 1: сборка креста «видео ↔ главы»

_Created: 14-08-2026 · Last updated: 14-08-2026_

Слой «реализация» плана
[PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md).
Шаги идут по порядку; каждый называет файлы, которые трогает, и от чего зависит.
Handoff — **H2706 (Opus 5)**.

Все новые скрипты кладутся в `scripts/crosswalk/` и пишутся отдельными файлами,
не инлайном в оболочке. В каждом печатающем скрипте —
`sys.stdout.reconfigure(encoding='utf-8')`, на каждом захватывающем вывод
`subprocess.run` — `encoding='utf-8'` (правило репозитория, проверяется хуком).

## Шаг 0 — подготовка ветки

Зависимости: нет.

```sh
cd C:/Users/user/Documents/GitHub/BookIndex
git fetch origin
git worktree add -b h2706-crosswalk-w1 ../BookIndex-h2706-<pid> origin/main
```

BookIndex не входит в число репозиториев с блокировкой главного дерева, но
worktree всё равно обязателен: параллельные сессии здесь регулярны.

## Шаг 1 — индекс публичного архива

Файл: `scripts/crosswalk/index_yandex_archive.py` (новый).
Зависимости: шаг 0.

Обходит публичную шару без учётки:
`GET https://cloud-api.yandex.net/v1/disk/public/resources`
с `public_key=https://disk.yandex.ru/d/bt5FCdq9y11fJg`, постранично по `limit`/`offset`.

Пишет `data/crosswalk/yandex_archive_index.json`: `name`, `path`, `size`, `ext`,
`folder` на файл. Ожидаемая форма (измерено 14-08-2026) — **1569 файлов**:

| Папка | Файлов | Состав |
|---|---|---|
| текст-канал-Алексей-Головастиков | 614 | 126 `.srt`, 124 `.txt`, 119 `.json`, 110 `.ans`, 109 `.html`, 13 `.tsv` |
| текст-канал-Анна-Осанкина | 357 | 73 × (`.srt`, `.txt`, `.json`), 69 × (`.ans`, `.html`) |
| обработанные-тексты | 55 | `.docx` — вычитка человеком |
| таймкоды-речи-канал-Анна-Осанкина | 69 | `.txt` |
| II том Популярных лекций для юношества | 8 | `.docx` |
| аудио / видео / прочее | 466 | `.mp3`, `.mp4`, `.mkv`, `.webm`, `.pdf` |

Два канала распознавания дают **параллельные наборы с одинаковой основой имени**
(`<stem>.srt`, `<stem>.txt`, `<stem>.json`, …). Сопоставлять запись каталога надо
**с основой имени**, а потом брать нужное расширение — а не гонять все расширения
в одном конкурсе похожести. Иначе `.json` и `.docx` выигрывают у `.srt`, и охват
тайм-кодов занижается со 171 до 2. Эта ошибка уже была допущена и исправлена при
аудите; повторять её не надо.

## Шаг 2 — привязка записей каталога к файлам архива

Файл: `scripts/crosswalk/match_catalog_to_archive.py` (новый).
Зависимости: шаг 1.

Нормализация имени: нижний регистр, снять суффиксы стадий
(`_после_первой_читки`, `_после_сверки`, `_часть_2`, `_компиляция…`, `(1)`),
схлопнуть всё не буквенно-цифровое в пробел. Сравнение — `SequenceMatcher`,
порог **0.62**.

Пишет `data/crosswalk/catalog_archive_map.json`. Контрольные числа:

- **171 из 176** записей имеют `.srt` (97 %);
- **104 из 176** имеют `.docx` (59 %);
- без тайм-кода ровно 5: acc121, acc122, acc123 (падуанские лекции — в архиве только `mkv/mp3/webm`), acc052 и acc150 (обрывки 1–2 мин).

Если число с `.srt` вышло заметно меньше 171 — сломалось сопоставление по основе
имени, а не архив. Это условие остановки не образует: записать в журнал и идти
дальше, но в отчёте назвать.

## Шаг 3 — проход A, серии

Файл: `scripts/crosswalk/pass_a_series.py` (новый).
Зависимости: шаг 2.

Правила цикла (уверенность 0.95, `relation: lecture_of`):

| Цикл | Признак заголовка | Записей | Глава |
|---|---|---|---|
| История русского ударения | `История русского ударения`, `Семинар`, `Лекция N` | ~50 | ch08 «Из русского ударения» |
| Строй ведийского языка / Грамматический строй санскрита | `Строй ведийского`, `Грамматический строй санскрита` | ~32 | ch05 «Древняя Индия» |
| Берестяные грамоты (раскопки по сезонам) | `берестяны`, `раскопок сезона` | ~14 | ch09 «Берестяные грамоты» |

Первые два цикла — 82 записи одним правилом. Третий добавлен по данным аудита:
записи о сезонных раскопках образуют такой же однородный цикл.

## Шаг 4 — проход B, KWIC по тайм-кодам

Файлы: `scripts/crosswalk/srt_parse.py`, `scripts/crosswalk/pass_b_kwic.py` (новые).
Зависимости: шаг 2.

`srt_parse.py` — разбор `.srt` в список `(start_sec, end_sec, text)`; ~40 строк,
готового в org нет.

`pass_b_kwic.py`:

1. Собирает индекс «голова указателя → страницы» из модулей
   [10-names](https://github.com/gasyoun/BookIndex/blob/main/data/modules/10-names.json),
   [11-toponyms](https://github.com/gasyoun/BookIndex/blob/main/data/modules/11-toponyms.json),
   [12-ethnonyms](https://github.com/gasyoun/BookIndex/blob/main/data/modules/12-ethnonyms.json),
   [13-languages](https://github.com/gasyoun/BookIndex/blob/main/data/modules/13-languages.json),
   [14-lexicon](https://github.com/gasyoun/BookIndex/blob/main/data/modules/14-lexicon.json).
   Их **1299** — заново не выводить.
2. Страница → глава по диапазонам из
   [20-lectures.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/20-lectures.json)
   (ch01 6–13 … ch11 360–392).
3. Ищет головы в тексте `.srt`, копит попадания по главам, берёт тайм-код первого
   уверенного попадания.

**Отбрасывать высокочастотный шум.** По статистике корпуса `русский` встречается
180 раз, `же` — 10; такие головы связывают всё со всем. Головы длиной менее 4
знаков и попадающие более чем в 6 глав — исключать. Иначе повторится ровно тот
провал, из-за которого забракована сущностная разводка.

## Шаг 5 — проход C, заголовок и темы

Файл: `scripts/crosswalk/pass_c_title_topics.py` (новый).
Зависимости: шаги 3, 4.

Только для записей без уверенного ребра. Темы каталога: `русистика` 50,
`санскрит` 32, `ЛЛШ` 10 (после волны 0 — 12), `береста` 8, `интервью` 1;
**75 записей темы не имеют** — для них работает только заголовок.
Уверенность не выше 0.6: это слабый сигнал.

## Шаг 6 — проход D, DeepSeek

Файл: `scripts/crosswalk/pass_d_llm.py` (новый).
Зависимости: шаг 5.

**Смоук-тест до массового прогона, обязательно:**

```sh
python C:/Users/user/Documents/GitHub/IndologyScholars/tools/openmodel_client.py --selftest
```

Провал — условие остановки (риск R-1): очередь недоделанного пишется в
`data/crosswalk/pass_d_pending.json`, шаги 7–8 всё равно выполняются, проход D
доигрывается отдельным прогоном. LLM-проход не отменяется и не заменяется
эвристикой.

Клиент импортируется, не переписывается. Конфиг читается из окружения по цепочке
`OPENMODEL_* > DEEPSEEK_* > умолчание`; рабочие значения лежат в
[IndologyScholars/.env](https://github.com/gasyoun/IndologyScholars/blob/main/.env.example)
(`https://api.deepseek.com`, `deepseek-chat`).

На запись подаётся: заголовок, темы, длительность, до 6000 знаков расшифровки,
список 11 глав с аннотациями из `lecture_summaries`. Ответ — строгий JSON:
`chapter`, `relation`, `confidence`, `quote`. Температура 0, `json_object`.
Модель с точной версией пишется в `evidence.model` — правило атрибуции.

## Шаг 7 — сборка модуля и починка дефектов

Файлы: `data/modules/22-crosswalk.json` (новый),
[data/modules/manifest.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/manifest.json),
[data/video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json).
Зависимости: шаг 6.

1. Слить рёбра всех проходов; при конфликте выигрывает проход с большей уверенностью, проигравший сохраняется в `evidence.superseded_by`.
2. Прописать `22-crosswalk` в `manifest.json` — ключ владения **и** `key_order`.
3. Волна 0: перенести заметки из `type` в `notes` у acc139/acc145/acc146; проставить тему `ЛЛШ` у acc139 и acc140; проставить `duplicate_of` у acc040 → acc005.
4. Пересобрать: `npm run data:assemble` затем `npm run build`. Оба артефакта — в тот же коммит.

## Шаг 8 — лист голосования и статистика

Файлы: `review/crosswalk_gate.html` (новый), `data/crosswalk/youtube_stats.json` (новый).
Зависимости: шаг 7.

Лист собирается через [/review-sheet](https://github.com/gasyoun/claude-config/blob/main/commands/review-sheet.md),
три секции: **рёбра-кандидаты** · **спорные** (ниже порога) · **дубли** (все семь
пар, включая три вероятно ложные). Выгружает `decisions.json`.

Статистика по архиву для полосы и приложения: 176 записей, 214,1 ч,
распределение по темам и типам, доля с тайм-кодом (171), доля с вычиткой (104),
самый длинный и самый короткий материал, охват по годам.

## Шаг 9 — сдача

Зависимости: шаг 8.

Прогнать проверки из
[VERIFICATION_BOOKINDEX_VIDEO_LECTURE_CROSSWALK.md](https://github.com/gasyoun/BookIndex/blob/main/docs/VERIFICATION_BOOKINDEX_VIDEO_LECTURE_CROSSWALK.md),
добавить запись в [CHANGELOG.md](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md),
открыть PR и влить его (право дано handoff'ом), снять worktree тем же проходом.

_Dr. Mārcis Gasūns_
