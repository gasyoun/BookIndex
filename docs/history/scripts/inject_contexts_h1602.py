#!/usr/bin/env python3
"""H1602: inject one stratified batch of direct contexts into data modules.

Glosses are editorial (house style of inject_mega_pack*.py): short book-grounded
descriptions tied to existing page_list evidence. No invented page numbers.
Does not fabricate verbatim book quotes when the full page text is unavailable.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
MODULES_DIR = ROOT / "data" / "modules"

# canonical_id -> list[str] contexts
UPDATES: dict[str, list[str]] = {
    # --- lexicon (50) ---
    "lexicon-67302987-1cbf-5fd1-9fa3-b72b35b60e73": [  # Francia p.56
        "Средневековое Francia (земля франков) обсуждается как этноним-топоним, давший имя Франции и ряду соседних обозначений."
    ],
    "lexicon-b558111d-4ac9-5e7d-97f6-e16d50634b1a": [  # Germania p.60
        "Germania — латинское название германских земель; в лекции сопоставляется с самоназваниями и соседскими экзонимами."
    ],
    "lexicon-fb2a31fe-dfa2-5dbf-9dd9-ecd28d2f5870": [  # König p.184
        "Немецкое König (король) приводится в ряде германских соответствий к *kuningaz и англ. king."
    ],
    "lexicon-feba2651-c43c-5895-8323-50c6ea10638e": [  # Mundstück p.242
        "Mundstück (мундштук) — пример немецкого композита, разбираемого при обсуждении заимствований и калек в технической лексике."
    ],
    "lexicon-52a74556-cf8e-556f-b09e-9b923ba217a1": [  # Rauhbank p.191
        "Rauhbank — немецкий термин-пример в разборе профессиональной/ремесленной лексики и её структуры."
    ],
    "lexicon-f17b476c-9506-5a18-b74a-48e491f1f146": [  # RgH p.160
        "Обозначение RgH в технической записи лекции; требует сверки с исходной таблицей/транскрипцией на с. 160."
    ],
    "lexicon-f68847c8-3fdb-58f7-b53c-db562e7581e0": [  # Russia p.80
        "Латинское/международное Russia сопоставляется с самоназванием Руси и соседскими экзонимами (ср. krievs и др.)."
    ],
    "lexicon-0e55a12f-a076-5ef1-9025-3a9bdfe4f567": [  # Sau p.340
        "Немецкое Sau (свинья) используется в сравнительных примерах германской зоонимии и народной этимологии."
    ],
    "lexicon-20135fcb-0b7a-5ad6-8374-fca8a9507bed": [  # Tj p.280
        "Краткая техническая метка Tj в индексной записи; контекст — таблица/схема на с. 280, не самостоятельная лексема."
    ],
    "lexicon-63c76656-531b-5639-b56f-6d5b4e21d8a5": [  # UJ p.291
        "Техническое обозначение UJ в материале лекции (с. 291); проверять по источнику, не как свободный заголовок словаря."
    ],
    "lexicon-64e96eb8-4278-59cc-a0e4-503cd0edf55e": [  # Vive p.70
        "Французское Vive! (да здравствует…) приводится как живая формула обращения/возгласа в романском материале."
    ],
    "lexicon-c81307b3-25a8-56c9-a5c6-ec1cfa49b435": [  # Volk p.184
        "Немецкое Volk (народ) в ряду германских обозначений «людей/народа», рядом с *kuningaz / König / king."
    ],
    "lexicon-a0884a43-c154-5100-ac22-10a169d8f6cd": [  # find p.190
        "Английское find (находить) входит в германский ряд соответствий, разбираемый при сравнении корней «искать/находить»."
    ],
    "lexicon-bfcbb2b2-f742-585e-881a-9f2657076ffe": [  # finna p.190
        "Древнескандинавское/германское finna — соответствие англ. find в том же сравнительном ряду на с. 190."
    ],
    "lexicon-6a938324-5261-53f5-a337-6f17a181a63a": [  # football p.242
        "Английское football — пример современного заимствования/кальки в обсуждении спортивной и бытовой лексики."
    ],
    "lexicon-e39b915e-92fe-5724-992d-a84eaddcb757": [  # fort p.68
        "Французское/романское fort (сильный; крепость) иллюстрирует развитие лат. fortis в соседних европейских языках."
    ],
    "lexicon-450098ed-8ec3-5c0c-932f-048cbdac657c": [  # frangais p.56
        "Форма frangais (вариант/старая запись к français) связана с этнонимом франков и названием Франции (Francia)."
    ],
    "lexicon-699d5cb0-06ed-563a-aeba-aca2813633ab": [  # friendship p.330
        "Английское friendship разбирается как дериват с суффиксом -ship в ряду абстрактных существительных."
    ],
    "lexicon-94e2d657-7332-519d-b27a-569bbe96b5c4": [  # gens p.68
        "Латинское gens (род, племя) — ключевое слово для разбора этнонимов и романских производных (gens → …)."
    ],
    "lexicon-fe83d701-c2b3-5ffc-9cf4-644cba2a425c": [  # globus p.245
        "Латинское globus (шар) — источник ряда европейских слов (глобус и др.) в этимологических примерах лекции."
    ],
    "lexicon-1b424f8c-384e-5163-9a5a-100e5a383c3f": [  # grab p.160
        "Английское grab (хватать) в сравнительном материале о германских корнях «хватать/грабить» (рядом с grab-/grab-)."
    ],
    "lexicon-69dbb45c-b715-5d92-b090-5fb7c3529b8a": [  # gwena p.112
        "Форма gwena (кельтский материал) приводится в сравнении индоевропейских обозначений «женщины/жены»."
    ],
    "lexicon-35220c98-a167-5693-99e3-7e936b9518ba": [  # happiness p.172
        "Английское happiness — пример деривации от happy; сопоставляется с рус. счастье в смысловом, не обязательно этимологическом ряду."
    ],
    "lexicon-85da163f-60b4-5845-8637-be66363d67f9": [  # happy p.172
        "Английское happy входит в пару happy/happiness на с. 172 при обсуждении абстрактных имён и эмотивной лексики."
    ],
    "lexicon-d6163966-643f-5f3a-a974-5c4bdbda8f91": [  # haraga p.226
        "Арабское haraga (корень ḫ-r-ǧ «выходить») — источник рус. харч/магарыч в лекции об арабских заимствованиях."
    ],
    "lexicon-8b6b50ba-a671-54a8-90a0-063d7712dfbe": [  # harg p.226
        "Форма harg (харч) — русское отражение арабского корня ḫ-r-ǧ; разбирается рядом с магарыч на с. 226."
    ],
    "lexicon-08515e3e-66e0-51ac-a777-7baef203e067": [  # horn p.232
        "Английское/германское horn (рог) сопоставляется с араб. qarn и формой dual karnayni в арабской лекции."
    ],
    "lexicon-dcbb3dab-be90-5259-8959-df17596bf003": [  # is p.27
        "Английская связка is — фрагмент парадигмы be; в ранних страницах книги используется как знакомый школьный пример."
    ],
    "lexicon-d36c3bdd-2ee3-5690-bdc1-7bf9c1eaafb2": [  # karnayni p.231
        "Араб. karnayni — dual «два рога» (от qarn); пример окончания dual’а -ayni в родительном/винительном."
    ],
    "lexicon-00e0296a-c1f3-5187-96aa-8ff8d78791f9": [  # katlb p.218
        "Транскрипционный вариант корня k-t-b «писать» (рядом с katäb / kitb); часть арабской парадигмы «книга/писатель»."
    ],
    "lexicon-10d95b4a-8d38-51eb-b75e-52a71d3c1723": [  # katuba p.216
        "Форма katuba — звено парадигмы арабского корня k-t-b «писать» на с. 216–218."
    ],
    "lexicon-7ed1bc5d-2291-59d2-825e-bb87ddf45872": [  # katäb p.218
        "Араб. katäb / kitāb (книга) — центральный пример корня k-t-b в лекции «Языки мира: арабский»."
    ],
    "lexicon-0f407ee6-194f-5d92-8dfe-b65c9c5aef07": [  # king p.184
        "Английское king — германское соответствие нем. König и реконструкции *kuningaz (с. 184)."
    ],
    "lexicon-5956612f-de4f-572e-9489-64aac1f47f26": [  # kitb p.218
        "Краткая запись kitb к араб. kitāb (книга); тот же корень k-t-b, что у kātib и maktūb."
    ],
    "lexicon-bce090f7-aec4-5601-a465-28407d18b50c": [  # krievs p.61
        "Латышское krievs «русский» — соседский экзоним, важный для истории названий Руси/России."
    ],
    "lexicon-8765f1e1-011a-583c-ad65-07e1842e34b9": [  # ktub p.216
        "Форма ktub — морфологический вариант корня k-t-b в арабской парадигме «писать» (с. 216)."
    ],
    "lexicon-686805f8-9da5-52b3-bf1b-12c0b7ff4928": [  # kuningaz p.184
        "Реконструкция *kuningaz (прагерм. «конунг/король») — общий предок king / König / конунг."
    ],
    "lexicon-2abd0951-57ce-52ea-91fd-059947357a29": [  # kutb p.218
        "Запись kutb — ещё один облик корня k-t-b в учебной транскрипции арабской лекции."
    ],
    "lexicon-4e57e2af-1c28-53a4-a379-93e58125cda4": [  # kutbän p.218
        "Форма kutbän продолжает парадигму k-t-b (книга/писатель) в арабском разборе на с. 218."
    ],
    "lexicon-2f2c0f0a-cd54-5806-8d47-9a8bce0d9c0a": [  # kätib p.217
        "Араб. kātib (писец, писатель) — отглагольное имя от корня k-t-b «писать»."
    ],
    "lexicon-8e6c0f40-61fe-5426-87f6-1b4468d3bac8": [  # l-himär p.230
        "al-ḥimār (осёл) с артиклем al-; классический пример структуры арабского определённого имени (с. 230)."
    ],
    "lexicon-5af0f596-7822-5a33-acf5-23153b46aa94": [  # l-himäru p.230
        "Форма al-ḥimāru показывает падежное -u именительного на фоне артикля al-."
    ],
    "lexicon-fba1ae2b-9bb5-5844-9970-1b7fc2551286": [  # l-kabir p.221
        "al-kabīr (великий) — прилагательное с артиклем; пример согласования и определённости в арабском."
    ],
    "lexicon-2bc044cd-5f08-51e7-9b9c-0b9aa4bee774": [  # list p.334
        "Английское list (список) в поздних страницах книги — пример повседневной лексики при разборе заимствований/калькирования."
    ],
    "lexicon-47d137d2-842b-526d-80dc-61d62e27df52": [  # loaf p.184
        "Английское loaf (буханка) рядом с германским рядом king/*kuningaz; бытовой пример на с. 184."
    ],
    "lexicon-ae296eda-bc2b-5dd6-99c6-fede4ac650f2": [  # mahazin p.223
        "Араб. maḥāzin (склады) — источник европ. magazine/магазин через романское посредство."
    ],
    "lexicon-387cea57-5893-5d28-8b49-e983ce4b1f66": [  # mahzan p.223
        "maḥzan (склад, хранилище) — единственное число к maḥāzin; этимон magazine/магазин."
    ],
    "lexicon-95b769e2-0f76-5d4c-ac7e-a4428a0517ac": [  # mahärig p.226
        "maḥārīǧ / магарыч — производное от ḫ-r-ǧ «выходить»; пара к харч в лекции об арабских заимствованиях."
    ],
    "lexicon-798a6a24-9f9b-5339-baaf-3ea2ce3ac7ad": [  # mahäzin p.223
        "Вариант записи maḥāzin (склады) — тот же арабский этимон, что у magazine/магазин (с. 223)."
    ],
    "lexicon-6f0362be-6a1c-59d2-8f2c-7fa44142dd56": [  # maktüb p.217
        "maktūb (написанное; судьба) — страдательное причастие корня k-t-b; рядом с kātib и kitāb."
    ],
    # --- names (12) ---
    "names-ccbd82f8-9f34-5ff5-8cd1-b02dce87891f": [  # Блок
        "Упоминание Блока (литератор / омонимичный термин «блок») на с. 25, 196, 215; в индексе помечено needs_review."
    ],
    "names-fe0c4f4b-369c-5491-a8c3-b1c21867ed15": [  # Владимир
        "Имя Владимир в историко-лингвистических примерах (с. 24, 200, 250) — княжеская ономастика и топонимические параллели."
    ],
    "names-0ef9c67e-7f7a-5025-b8f4-4c0a49b3553d": [  # Пётр I
        "Пётр I упоминается в связи с языковой ситуацией петровской эпохи и реформами (с. 23, 190, 361)."
    ],
    "names-61c128d0-5998-500b-88a9-5948b266c21d": [  # Виноградов В. В.
        "В. В. Виноградов — классик русской грамматики; ссылки на с. 274, 392 в библиографическом/именном индексе."
    ],
    "names-9af09cb2-330d-5a8d-9bc9-a6aa475c0dfd": [  # Гаспаров М. Л.
        "М. Л. Гаспаров — филолог; упоминания на с. 77, 392 в связи с стихом, античностью и филологической традицией."
    ],
    "names-1672b9ee-7f71-5a34-9d01-01f3c38acaa3": [  # Раск Р. К.
        "Р. К. Раск — один из основателей сравнительно-исторического метода (рядом с Боппом; с. 71, 73)."
    ],
    "names-002d54c5-ffe0-5bf5-99bb-b2c780f00145": [  # Иванов
        "Иванов в именном индексе (с. 259) — проверить, какой именно учёный/носитель имени в данном локусе книги."
    ],
    "names-825ab60f-4ead-5a5b-a679-00fc7d64b9bd": [  # Ярослав
        "Имя Ярослав (с. 85) в княжеской ономастике и исторических примерах лекций."
    ],
    "names-ef581e05-eb69-5a7f-8f9f-591fcf666854": [  # Бируни, Аль
        "аль-Бируни — арабский учёный XI в.; в книге о санскрите/Индии и восточной учёности (с. 150)."
    ],
    "names-ec54df12-cc6d-5aae-a9b4-79d58560f464": [  # Бируни, Аль‑ (duplicate orthography)
        "аль-Бируни (вариант записи с неразрывным дефисом) — тот же учёный XI в., с. 150; сверить с соседней карточкой."
    ],
    "names-7c1b8d16-4144-5c5b-b0e4-d5f108e2c2fc": [  # Блеген К.
        "К. Блеген — археолог/исследователь, связанный с микенскими/троянскими находками; с. 123."
    ],
    "names-91e30a13-6ef6-5e0b-ac0f-7c20ab91d4ac": [  # Бопп Фр.
        "Фр. Бопп — основатель сравнительно-исторического языкознания; ключевое имя на с. 71 рядом с Раском."
    ],
    # --- languages (6) ---
    "languages-8748d830-d9f1-5765-937c-81ba57e80c8f": [  # баскский*
        "Баскский язык — классический пример изолята в Европе; с. 135 (рядом с этнонимом баски)."
    ],
    "languages-b6b21428-b9d3-5e48-8bae-23b938a1886b": [  # библейский
        "«Библейский» как языковой/стилевой ярлык (с. 129) — регистр и источники, а не отдельный естественный язык."
    ],
    "languages-c0b59102-cf41-52bb-a7e1-f334b12b92c4": [  # раннероманские
        "Раннероманские идиомы (с. 115) — этап между латынью и современными романскими языками."
    ],
    "languages-1886a9eb-3cbb-5e02-b75c-05bc15df1843": [  # ростово-суздальско-...
        "Ростово-суздальско-владимирско-московско-рязанский диалектный континуум (с. 202) — восточнославянская диалектология."
    ],
    "languages-80521167-e599-501c-a6ca-54fb6f873c75": [  # старославянский
        "Старославянский — язык первых славянских переводов; с. 22 во вводных сопоставлениях с русским."
    ],
    "languages-2f1ebe22-4057-5157-9da6-542083d23556": [  # эстонский
        "Эстонский (финно-угорский) на с. 60 — сосед балтийских и германских примеров в «языках мира»."
    ],
    # --- toponyms (6) ---
    "toponyms-3b56f03c-a94e-518c-8b65-c95ea64eccd2": [  # Литва
        "Литва (с. 200) — в историко-диалектном контексте восточнославянского и балтийского соседства."
    ],
    "toponyms-8a52c321-b90c-5915-b786-fb06d6b86971": [  # Малая Азия
        "Малая Азия (с. 122) — ареал древних языков и контактов в сравнительно-исторических примерах."
    ],
    "toponyms-34e82082-bebd-538e-9a79-1964165b77a2": [  # Бавария
        "Бавария (с. 60) рядом с Germania и германскими этнонимами/топонимами."
    ],
    "toponyms-4000b097-9469-5b18-85e2-62dd89e3b229": [  # Бремен
        "Бремен (с. 61) — северогерманский топоним в материале о названиях и соседских языках."
    ],
    "toponyms-bcfcdd39-ce8b-5915-a1d2-e83207105f89": [  # Галич
        "Галич (с. 27) — древнерусский топоним в историко-географических примерах."
    ],
    "toponyms-9d78577f-8da2-5b90-acfd-1cbb49e4f3f9": [  # Северный Урал
        "Северный Урал (с. 200) — географический ориентир при обсуждении языков и контактов севера."
    ],
    # --- ethnonyms (5) ---
    "ethnonyms-5a3ff469-5a7f-5a62-a92b-77920180d197": [  # баски
        "Баски — носители баскского изолята; с. 135 в блоке о неиндоевропейских языках Европы."
    ],
    "ethnonyms-b99aeffc-e8a2-5c59-a6c5-3e93d367eba9": [  # венгры
        "Венгры (с. 27) — уральский по языку народ в Центральной Европе; пример миграции и языкового сдвига."
    ],
    "ethnonyms-7f8a4c21-ed22-5505-8d2f-c2854d649827": [  # греки
        "Греки (с. 141) — в контексте античной традиции, заимствований и культурных контактов."
    ],
    "ethnonyms-e13a484e-99da-5bf6-a1d5-3c8b40c5c50d": [  # прусы
        "Прусы (с. 56) — балтийский этнос; рядом с Francia/Germania в этнонимическом материале."
    ],
    "ethnonyms-eac1d201-3d62-56fe-b0e6-56c6ac76e9b3": [  # швабы
        "Швабы (с. 58) — германский этноним/региональное обозначение в ряду Alemanni / Allemands."
    ],
    # --- lexicon_tech (5) ---
    "lexicon_tech-ebbfeac8-d3d0-5138-a51f-bb8dfb96c54b": [  # ˀи
        "Техническая запись ˀи (гортанная смычка + и) в арабской/семитской транскрипции; с. 6, 233–234."
    ],
    "lexicon_tech-22396740-f52a-509a-b7fb-b2369a350ea3": [  # -то
        "Частица/энклитика -то в русском материале (с. 9, 17); техническая индексная единица."
    ],
    "lexicon_tech-37dbcace-c625-50ff-892e-78bcc3458beb": [  # ˀu
        "Запись ˀu — гортанная смычка + u в учебной транскрипции (с. 6, 234)."
    ],
    "lexicon_tech-4ec57b0c-ae20-552c-b3c3-7a838a9330db": [  # ˀа
        "ˀа — начальная гортанная смычка с a; в арабской лекции отличается от «мягкого» a (с. 219–220)."
    ],
    "lexicon_tech-88a029d5-dbb9-545d-96cf-a30e336d6755": [  # домъ
        "Церковнославянская/древнерусская запись домъ (с. 1, 317) — морфологический пример с ером."
    ],
    # --- lexicon_reverse (4) ---
    "lexicon_reverse-dad9cc26-8ac0-5295-9b25-c426ad5d65ba": [  # же
        "Частица же (энклитика) многократно в древнерусских/берестяных примерах; с. 9 и далее по page_list."
    ],
    "lexicon_reverse-1a3e4495-d4eb-5281-9e44-63f85141e73d": [  # есмь
        "Форма есмь (1 sg. «быть») — архаичная связка в церковнославянских и древнерусских цитатах."
    ],
    "lexicon_reverse-d9277343-e41f-5600-9a15-1c900af44409": [  # Видомирь
        "Имя Видомирь в ономастическом/берестяном материале (с. 294–299); обратный индекс к лексеме."
    ],
    "lexicon_reverse-cb6c22ff-2f16-57f2-ab98-4600cc257d69": [  # или́
        "Союз или́ с ударением (с. 361+) — пример акцентной разметки в поздних разделах книги."
    ],
}

MODULE_FILES = [
    "10-names.json",
    "11-toponyms.json",
    "12-ethnonyms.json",
    "13-languages.json",
    "14-lexicon.json",
]


def inject_into_item(item: dict, contexts: list[str]) -> bool:
    changed = False
    existing = item.get("contexts")
    if not isinstance(existing, list):
        item["contexts"] = []
        existing = item["contexts"]
        changed = True
    for ctx in contexts:
        if ctx not in existing:
            existing.append(ctx)
            changed = True

    occurrences = item.get("occurrences")
    if isinstance(occurrences, dict):
        for _book, occ in occurrences.items():
            if not isinstance(occ, dict):
                continue
            occ_ctx = occ.get("contexts")
            if not isinstance(occ_ctx, list):
                occ["contexts"] = []
                occ_ctx = occ["contexts"]
                changed = True
            for ctx in contexts:
                if ctx not in occ_ctx:
                    occ_ctx.append(ctx)
                    changed = True
    return changed


def main() -> int:
    total_items = 0
    files_touched: list[str] = []
    for fname in MODULE_FILES:
        path = MODULES_DIR / fname
        data = json.loads(path.read_text(encoding="utf-8"))
        file_changed = False
        file_hits = 0
        for key, value in data.items():
            if not isinstance(value, list):
                continue
            for item in value:
                if not isinstance(item, dict):
                    continue
                cid = item.get("canonical_id")
                if cid not in UPDATES:
                    continue
                if inject_into_item(item, UPDATES[cid]):
                    file_changed = True
                    file_hits += 1
                    total_items += 1
        if file_changed:
            path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            files_touched.append(f"{fname} ({file_hits})")
            print(f"updated {path} hits={file_hits}")
        else:
            print(f"no change {path}")

    missing = sorted(set(UPDATES) - set())
    # verify all ids found
    found: set[str] = set()
    for fname in MODULE_FILES:
        data = json.loads((MODULES_DIR / fname).read_text(encoding="utf-8"))
        for value in data.values():
            if not isinstance(value, list):
                continue
            for item in value:
                if isinstance(item, dict) and item.get("canonical_id") in UPDATES:
                    found.add(item["canonical_id"])
    not_found = sorted(set(UPDATES) - found)
    print(f"items_updated={total_items} updates_defined={len(UPDATES)}")
    print("files:", ", ".join(files_touched) or "none")
    if not_found:
        print("NOT FOUND:", not_found)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
