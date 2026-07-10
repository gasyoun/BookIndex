# Депонирование на Zenodo и присвоение DOI (A1.3)

Чтобы BookIndex стал цитируемым DH-ресурсом с постоянным идентификатором,
репозиторий депонируется на [Zenodo](https://zenodo.org), который чеканит DOI
на каждый GitHub-релиз. Файлы метаданных уже готовы в репозитории
([`.zenodo.json`](../.zenodo.json), [`CITATION.cff`](../CITATION.cff),
[`LICENSE-DATA.md`](../LICENSE-DATA.md)).

Шаги (делает владелец репозитория, нужен доступ к Zenodo + GitHub):

1. **Связать аккаунты.** Войти на Zenodo через GitHub
   (Zenodo → Account → Linked accounts → GitHub).
2. **Включить репозиторий.** Zenodo → GitHub → найти `gasyoun/BookIndex` →
   переключатель **On**. (Если репозитория нет в списке — нажать «Sync now».)
3. **Указать ORCID.** Подставить реальный ORCID в двух местах и закоммитить:
   - [`CITATION.cff`](../CITATION.cff): раскомментировать строку `orcid:` у автора;
   - [`.zenodo.json`](../.zenodo.json): добавить в объект creators поле
     `"orcid": "0000-0000-0000-0000"`.
4. **Версия и changelog.** Перенести раздел `[Unreleased]` в
   [CHANGELOG.md](../CHANGELOG.md) под новый номер (например `2.3.0`), обновить
   `version` в [package.json](../package.json) и [CITATION.cff](../CITATION.cff),
   проставить `date-released`.
5. **Создать GitHub Release** с тегом версии (например `v2.3.0`). Zenodo
   автоматически заберет архив и присвоит **version DOI** + **concept DOI**
   (последний один на все версии — его и используем для цитирования).
6. **Вписать DOI обратно.** После чеканки:
   - [`CITATION.cff`](../CITATION.cff): раскомментировать блок `identifiers:` с
     concept DOI;
   - [README.md](../README.md): подставить настоящий DOI в бейдж и раздел
     «Как цитировать» (плейсхолдер `10.5281/zenodo.XXXXXXX`);
   - [`LICENSE-DATA.md`](../LICENSE-DATA.md): упомянуть DOI в атрибуции.
7. **Дальше** — каждый минорный выпуск данных = новый GitHub Release = новый
   version DOI; concept DOI остается стабильным.

## Что еще остается по A1 (после DOI)

- **Подвал приложения «Как цитировать ресурс».** В приложении уже есть виджет
  цитирования отдельных статей/лекций (APA/MLA/Chicago/ГОСТ). Не хватает
  цитаты ресурса в целом (автор — Gasūns, заголовок, год, URL, DOI). Добавить,
  когда появится DOI, чтобы не публиковать плейсхолдер в UI.

## Проверка метаданных

```sh
python -c "import json; json.load(open('.zenodo.json', encoding='utf-8')); print('zenodo ok')"
# CFF (если установлен cffconvert):
# pip install cffconvert && cffconvert --validate
```
