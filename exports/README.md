_Created: 13-06-2026 · Last updated: 05-09-2026_

# exports/ — генерируемые экспорты данных (A6)

Машинонезависимые выгрузки указателя для интероперабельности и архивации
(артефакты GitHub Release + Zenodo). **Генерируются**, не редактируются вручную.

| Файл | Что это |
|---|---|
| `bookindex.tei.xml` | TEI standOff: `listPerson` (имена), `listPlace` (топонимы), `listNym` (этнонимы), списки языков и понятий. У каждой записи — `xml:id` (= `canonical_id`), авторитетные `idno` (Wikidata/VIAF/GND/GeoNames, A3), канонический `ptr` (стабильный URI, A2), страницы/источники. |
| `names.csv`, `toponyms.csv`, `ethnonyms.csv`, `languages.csv`, `subject.csv` | Плоские дампы: head, slug, canonical_url, discussed, books, pages, wikidata, viaf, gnd, geonames. |

## Генерация и проверка

```sh
npm run export:tei          # сгенерировать TEI + CSV в exports/
npm run export:tei:check    # собрать и проверить well-formedness, ничего не записывая
python scripts/export_tei.py --date 2026-06-13   # с датой в заголовке (для релиза)
```

Вывод **детерминирован** (без авто-даты по умолчанию) — перегенерация при
неизменных данных дает байт-идентичный результат. Перегенерируйте после правок
сущностей или авторитетных ID. TEI здесь — **формат экспорта, не авторинга**:
источник правды остается `app_data.json` / `data/modules/`.

## Лицензия

Данные указателя — CC BY 4.0; см. [LICENSE-DATA.md](https://github.com/gasyoun/BookIndex/blob/main/LICENSE-DATA.md). Цитаты из
книги/лекций не входят в эти выгрузки.

_Dr. Mārcis Gasūns_
