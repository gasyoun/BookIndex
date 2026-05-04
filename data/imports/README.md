# data/imports/ — Import Pipeline

Директория для подготовки новых корпусных источников перед публикацией в `app_data.json`.

## Жизненный цикл источника

```
Исходный текст/PDF
  ↓
data/imports/<book_id>/raw/         ← исходные материалы (не трогать)
  ↓
data/imports/<book_id>/draft.json   ← промежуточный формат (редактируемый)
  ↓  python scripts/import_source.py --book-id <book_id> --validate
data/imports/<book_id>/validated/   ← результат валидации
  ↓  (ручная редакторская проверка)
data/imports/<book_id>/status.json  ← статус: draft → validated → published
  ↓  python scripts/import_source.py --book-id <book_id> --merge
app_data.json                       ← публикуется в корпус
```

## Статусы

| Статус | Описание |
|---|---|
| `draft` | Импортировано, не проверено |
| `validated` | Прошло автоматическую валидацию |
| `published` | Включено в `app_data.json` и `aaz-index.html` |

## Добавление нового источника

1. Создать директорию `data/imports/<book_id>/`
2. Скопировать `_template/draft.json` → `data/imports/<book_id>/draft.json`
3. Заполнить метаданные и данные сущностей
4. Запустить: `python scripts/import_source.py --book-id <book_id> --validate`
5. Устранить ошибки валидации
6. После ручной проверки: `python scripts/import_source.py --book-id <book_id> --merge`
7. Пересобрать: `npm run build`
8. Прогнать полный gate: `npm run check`

## Правила

- Не менять `raw/` после первичного импорта
- Не редактировать `app_data.json` напрямую
- Все новые сущности проходят `validate_content.py` перед merge
- `schema_version` не меняется при добавлении книги
- Маршруты `#v4/...` остаются совместимыми
