# Куратор-гейт креста «видео ↔ главы»: переделка v4 по замечаниям третьего захода

_Created: 16-08-2026 · Last updated: 16-08-2026_

Третий заход куратора (16-08-2026, 39 решений из 210,
[data/crosswalk/gate_decisions_v3_partial.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/gate_decisions_v3_partial.json))
принёс три замечания, и все три — про то, что мусор дошёл до человека:

1. «Почему показана невозможная связь **петь** и **терпеть**? Переделай все
   голосование, чтобы человек на подобный мусор больше времени не тратил»;
2. «другой полюс — эта **метафора**. Такие надо отсекать сразу без человека»;
3. «здесь **не обсуждается судьба конкретного слова** — связь мусорная».

Плюс отдельное: «почему в скачанном .json нет главного, **H2707** для
опознания, к кому он принадлежит?»

## Что сделано

### 1. Машинное правило R1 — ложные подстрочные совпадения (тер|петь)

Стем термина встречается в цитате **только внутри чужого слова**, начало
которого не является глагольной приставкой. Реализация:
[scripts/crosswalk/kwic_noise_analysis.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/kwic_noise_analysis.py)
(ё→е нормализация; полногласный вариант стема — брег→берегу — легален;
приставочный вариант — везя→вывозя — легален). **Калибровка на всех 62
голосах куратора по kwic-рёбрам: 0 ложных срабатываний по approve.**
Применение —
[scripts/crosswalk/apply_kwic_autoreject.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/apply_kwic_autoreject.py):
**11 рёбер** отклонено машиной (`machine_reject: R1-substring`), среди них
Фест↔мани**фест**ом, сёла↔ве**сёла**я, петь-класс целиком. Пограничный
случай, зафиксированный честно: acc174 «рубель» ↔ «ду**рубель** сказан
дважды» — цитата обсуждает чтение, но токен не словарный; снят машиной,
восстановим из данных по флагу.

### 2. DeepSeek-скрин — семантика ПОДПИСЫВАЕТ, но не режет

[scripts/crosswalk/deepseek_kwic_screen.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/deepseek_kwic_screen.py)
(deepseek-v4-flash, thinking off, t=0) судит каждое спорное kwic-ребро:
linguistic / mere_use / false_match / unsure. Валидация на тех же 62 голосах,
дважды (без контекста главы и с ним):

| скрин ↓ · куратор → | approve | reject |
|---|---|---|
| linguistic | 23 | 2 |
| mere_use | 13 | 11 |
| false_match | 1 | 11 |
| unsure | 1 | 0 |

Семантический автоотсев **убил бы 13–14 approve из 38**: критерий куратора
шире, чем «слово обсуждается как языковой объект» — биографическим главам
достаточно тематической связи эпизода (Париж, футбол, Лотман). Поэтому
вердикт скрина: (а) **сортирует** карточки — вероятно-ценные первыми,
вероятный мусор в конце; (б) печатается на карточке бейджем и панелью с
причиной. Решает человек — но мусор он теперь видит последним и с
подсказкой. Вердикты: 46 linguistic · 47 mere_use · 44 false_match · 3
unsure —
[data/crosswalk/kwic_screen_verdicts.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/kwic_screen_verdicts.json).

### 3. Reject в один клик

Ярлыки отклонения («слово лишь употреблено», «метафора», «ложное
совпадение», «глава другая») — печатать причину больше не нужно;
[apply-скрипт](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/apply_gate_decisions.py)
кладёт ярлык в `curator_reject_label` ребра.

### 4. decisions.json теперь сам говорит, чей он

csl-pyutil **0.13.0** (V14, [PR #25](https://github.com/sanskrit-lexicon/csl-pyutil/pull/25),
[release](https://github.com/sanskrit-lexicon/csl-pyutil/releases/tag/v0.13.0)):
`config["context"]` уходит верхнеуровневым полем `context` в **каждый**
экспорт (download / autosave / strict / «сдать сколько успел») и печатается
в шапке листа. Для этого гейта: `{"handoff": "H2707", "repo":
"gasyoun/BookIndex", "apply_with": "python
scripts/crosswalk/apply_gate_decisions.py"}`. Identity-gate V13 включён
(каждый acc###/ch## в вопросе назван по имени).

## Итог по объёму

| | v3 | v4 |
|---|---|---|
| Карточек на листе | 210 | **160** |
| — применено голосов куратора | — | 39 (28 approve · 11 reject) |
| — снято машиной (R1) | — | 11 |
| Порядок карточек | как в данных | скрин-сортировка, мусор в конце |

Лист опубликован:
[vote/sheets/h2707_crosswalk_gate.html](https://gasyoun.github.io/vote/sheets/h2707_crosswalk_gate.html).
Применение решений куратора: `python scripts/crosswalk/apply_gate_decisions.py
<decisions.json>` → `npm run data:assemble`.

## Ограничение, названное прямо

Семантический мусор («метафора», «слово лишь употреблено») машина без
человека резать **не может** — двукратная валидация на голосах самого
куратора это показала (13–14 убитых approve). Если куратор хочет жёстче:
проголосовав v4, он даёт новые голоса — правило можно перекалибровать на
большем золоте, и порог «резать всё, что скрин зовёт false_match, если R1
не возражает» станет проверяемым.

Модели: правки и правила — Fable 5 (`claude-fable-5`); скрин —
DeepSeek Flash (`deepseek-v4-flash`).

_Dr. Mārcis Gasūns_
