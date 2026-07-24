# Entity candidates (volume II, index-first)

_Created: 24-07-2026 · Last updated: 24-07-2026_

**Schema:** `entity_candidates/1` · **Source:** lectures-v2 transcripts · **Tool:**
[`scripts/extract_entities_from_transcripts.py --candidates`](https://github.com/gasyoun/BookIndex/blob/main/scripts/extract_entities_from_transcripts.py)

These files list **new** heads that appear in the lecture corpus but are **not** already
in `app_data.json` entity tables. They are a review worklist for volume-II index-first
work — **not** auto-merged into the published index.

| Artifact | Role |
|---|---|
| [`entity_candidates.json`](entity_candidates.json) | Full structured list + first-mention + per-video counts |
| [`entity_candidates.csv`](entity_candidates.csv) | Flat sheet for spreadsheet / review-sheet import |
| This README | Review protocol + promotion path |

## Regenerate

```sh
python scripts/extract_entities_from_transcripts.py --candidates
python scripts/extract_entities_from_transcripts.py --candidates --cap 40 --min-count 2
```

Defaults: `--cap 40` per type, `--min-count 2` corpus mentions, `--min-videos 1`.
The mode **never** writes `app_data.json` (even if `--write` is also passed).

Gazetteer **linking** of heads that already exist remains the separate path:

```sh
python scripts/extract_entities_from_transcripts.py --report
python scripts/extract_entities_from_transcripts.py --write   # only known heads → video edges
```

## What is proposed

| `type_guess` | How extracted | Precision notes |
|---|---|---|
| `names` | Initials + surname (`А. А. …`, `Е.А. …`) | Surname length floor ≥6, collision denylist, epithet/patronymic guards, credit-line skip, multi-initial preferred; single-initial needs surname morphology |
| `languages` | `*ский язык` with case lemma | Known language stems from app_data are excluded; stress marks stripped without destroying `й` |
| `subject_index` | Guillemet titles `«…»` | Single-token discourse quotes dropped; case variants of «Слово…» collapsed |
| `ethnonyms` | Capitalized plural-ish endings | **Low precision** — expect place/title false friends; treat as hints only |

Lexicon / common-word lists are never proposed as candidates (same C3 policy as linking).

## Review protocol (editor)

1. Open `entity_candidates.csv` (or JSON) sorted by `type_guess`, then `mention_count`.
2. For each row, decide: **accept** / **reject** / **defer** / **retype**.
3. Reject hosts and production credits when they are not index-worthy (e.g. one-off TV hosts
   may stay out of a scholarly volume-II index even if the person is real).
4. Retype ethnonym false friends (settlements, book titles) or drop them.
5. For large batches, generate an interactive sheet with `/review-sheet` over the CSV and
   keep `decisions.json` gitignored until applied.
6. **Do not** paste unreviewed heads into `app_data.json` by hand.

### Spot-check (H1599 acceptance, 24-07-2026)

Sample of 20 rows from the first frozen run (names + languages + top subjects + ethnonyms):

| Verdict | Count | Examples |
|---|---|---|
| True friend (index-worthy person/lang/title) | ≥12 | Е. А. Рыбина, С. П. Капица, П. Г. Гайдуков, Ведийский язык, «Слово о полку Игореве», «Русское именное словоизменение» |
| True friend, peripheral (host / soft) | ~2 | А. Мозжухин (TV host — person real, may not belong in vol-II scholarly index) |
| False friend (filtered or residual) | ≤1 residual | `Сычевичи` (settlement, mis-typed as ethnonym) — reject or retype toponym |
| Credits / discourse noise | 0 after filter | Subtitle «Корректор …» lines and `Ф. Значит` dropped in-tool |

Regenerate after filter changes and re-sample before promoting a draft.

## Promote accepted heads via `import_source.py`

Candidates are **not** a book import by themselves. Promotion path:

1. Copy the import template:
   ```sh
   # PowerShell
   Copy-Item data/imports/_template/draft.json data/imports/lectures-v2-vol2/draft.json
   ```
2. Fill metadata (`book_id`, title, author, year, pages_total, …) — e.g. volume-II
   placeholder corpus id `lectures-v2-vol2`.
3. For each **accepted** candidate, append an item under the right `data.<type>` list:
   ```json
   {
     "head": "Е. А. Рыбина",
     "contexts": ["Упомянута в лекции «Наблюдатель…» (lectures-v2)."],
     "pages": []
   }
   ```
   Use `type_guess` as the list key (`names`, `languages`, `subject_index`, …). Prefer
   editor-normalized heads over raw machine forms.
4. Validate, then merge **only** after human sign-off:
   ```sh
   python scripts/import_source.py --book-id lectures-v2-vol2 --validate
   python scripts/import_source.py --book-id lectures-v2-vol2 --merge
   npm run data:split
   npm run build
   ```
5. `import_source.py --merge` refuses a draft that was not `--validate`d and refuses
   double-merge of the same `book_id`. That is the gate that keeps unreviewed heads out
   of `app_data`.

Linking those new heads to lecture minutes still uses the gazetteer path
(`--report` / `--write`) **after** they exist in `app_data`.

## Hard rules

- **Zero unreviewed heads in `app_data`.** Candidate mode writes only under
  `data/imports/lectures-v2/entity_candidates.*`.
- Do not hand-edit `transcripts/*.json` — re-ingest if the corpus changes, then re-run
  `--candidates`.
- Cap stays small on purpose (`--cap`) so a human sheet stays usable; raise only when a
  review workflow is ready.

_Dr. Mārcis Gasūns_
