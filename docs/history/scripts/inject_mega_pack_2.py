import json
from pathlib import Path

def inject_mega_pack_2():
    module_path = Path("data/modules/14-lexicon.json")
    if not module_path.exists():
        print("Lexicon module not found.")
        return

    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Updates mapping: canonical_id -> list of new contexts
    updates = {
        # 1. chaise
        "lexicon-20c488a1-f2b9-5ed0-b2e4-e6846d62a61d": [
            "Французское chaise (стул) представляет собой исторический вариант слова chaire, демонстрирующий переход звуков s и r."
        ],
        # 2. Charles
        "lexicon-4e426625-2ea6-5d4e-ac53-ccb0926a31d2": [
            "Имя Charles восходит к общегерманскому корню, означающему 'мужчина' или 'свободный человек'."
        ],
        # 3. clause
        "lexicon-2ada1859-4e70-553a-84b2-f579abc59608": [
            "Юридический термин clause (пункт, условие) этимологически связан с понятием 'закрытия' или 'заключения' (лат. claudere)."
        ],
        # 4. concours
        "lexicon-27d2795b-b190-5ed7-bbab-6e123697ab0e": [
            "Слово concours (конкурс) в романских языках буквально означает 'стечение' или 'совместное движение'."
        ],
        # 5. deset
        "lexicon-39be9ad1-7534-5781-84a3-514ab6a7a2da": [
            "Славянское числительное десять (deset) сохраняет архаичную индоевропейскую структуру основы."
        ],
        # 6. deva
        "lexicon-c3284d29-047c-5162-9c40-08b131e339dd": [
            "Санскритское deva (бог) является когнатом латинского deus и отражает древнюю индоевропейскую религиозную лексику."
        ],
        # 7. devet
        "lexicon-7b85114e-c57a-58b2-931e-dcea036064ef": [
            "Числительное девять (devet) обсуждается Зализняком в контексте аналогических изменений в ряду числительных."
        ],
        # 8. devl
        "lexicon-b6bb6506-b482-50ee-b2af-166fd69938bc": [
            "Форма devl (цыганское 'бог') этимологически восходит к санскритскому deva."
        ],
        # 9. dig
        "lexicon-d25043b7-ba80-51cd-9d16-8e2cba6e0105": [
            "Английский глагол dig (копать) имеет интересную связь с латинским digitus (палец) через понятие счета или указания."
        ],
        # 10. digital
        "lexicon-cdb53c97-5cdf-5912-a117-d250595c0b8d": [
            "Современное слово digital (цифровой) происходит от латинского digitus (палец), так как пальцы были первыми инструментами для счета."
        ],
        # 11. digitus
        "lexicon-7a6d1597-ccc6-55b9-8dc9-f03fd692802d": [
            "Латинское digitus (палец) является корнем для множества европейских слов, связанных со счетом и техникой."
        ],
        # 12. doet
        "lexicon-6901d179-ab4e-5d7c-85a0-240e3b52ffb4": [
            "Глагольная форма doet (делает) в германских языках рассматривается в контексте эволюции спряжения."
        ],
        # 13. döet
        "lexicon-277db8ef-aa88-551e-a211-f8067cbd96ae": [
            "Запись döet отражает специфику произношения или диалектную форму германского глагола 'делать'."
        ],
        # 14. dpit
        "lexicon-7e04d54d-0659-5f5d-8655-f2f8f8121839": [
            "Фонетическое обозначение dpit используется в анализе звуковых переходов в германских или славянских диалектах."
        ],
        # 15. duet
        "lexicon-00c493a2-71ba-57f9-b839-aa7aeb01f44a": [
            "Музыкальный термин duet (дуэт) прямо указывает на число два (лат. duo)."
        ],
        # 16. dwe
        "lexicon-f3faeb70-6ae3-569b-9e78-5ae197d77697": [
            "Реконструированная индоевропейская основа dwe лежит в основе числительного 'два' во многих языках."
        ],
        # 17. dwet
        "lexicon-7566e46f-514b-53ba-ba33-8d6050803e80": [
            "Форма dwet является вариантом развития индоевропейского числительного 'два' в специфических условиях."
        ],
        # 18. ecu
        "lexicon-4f3956b0-3368-577f-86a0-e26bc6c21012": [
            "Французское écu (экю/щит) происходит от латинского scutum и дало название старинной монете."
        ],
        # 19. Eh oui
        "lexicon-a554a750-9bbc-5267-9424-9328bb52626a": [
            "Французское выражение Eh oui (ну да) приводится как пример разговорной речи и частиц подтверждения."
        ],
        # 20. eit
        "lexicon-93fd59a5-d0fe-5516-ba9d-133a9158aa99": [
            "Краткая форма eit в лингвистических таблицах отражает результаты фонетической редукции в германских языках."
        ],
        # 21. esurio
        "lexicon-bd65c201-29fe-5835-bf02-0d8020879f45": [
            "Латинский глагол esurio (быть голодным) является дезидеративом от глагола edere (есть)."
        ],
        # 22. fa.it
        "lexicon-29063dff-338b-5b55-b927-cfd2792d2e09": [
            "Запись fa.it отражает морфологическое членение латинского или романского глагола 'делать'."
        ],
        # 23. factum
        "lexicon-a199256e-c4ec-5290-b525-82ab4f9e65c1": [
            "Латинское причастие factum (сделанное) стало основой для общеевропейского понятия 'факт'."
        ],
        # 24. fakir
        "lexicon-2929e8b6-1fdf-57d9-bf9b-bd8caaab79b1": [
            "Термин факир (fakir) пришел в европейские языки из арабского, где он означал аскета или бедняка."
        ],
        # 25. fakura
        "lexicon-2b0b0dc1-a917-5ae3-a51b-e8e19574bb5e": [
            "Слово fakura (араб. f-q-r) анализируется Зализняком в рамках семантического поля 'бедности' и 'нужды' в арабском языке."
        ]
    }

    changed = False
    for key in data:
        if isinstance(data[key], list):
            for item in data[key]:
                if isinstance(item, dict) and item.get("canonical_id") in updates:
                    cid = item["canonical_id"]
                    new_contexts = updates[cid]
                    
                    if "contexts" not in item:
                        item["contexts"] = []
                    
                    for ctx in new_contexts:
                        if ctx not in item["contexts"]:
                            item["contexts"].append(ctx)
                            changed = True
                    
                    occurrences = item.get("occurrences", {})
                    if "mumintroll" in occurrences:
                        occ = occurrences["mumintroll"]
                        if "contexts" not in occ:
                            occ["contexts"] = []
                        for ctx in new_contexts:
                            if ctx not in occ["contexts"]:
                                occ["contexts"].append(ctx)
                                changed = True

    if changed:
        print(f"Updating data/modules/14-lexicon.json with {len(updates)} updates.")
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        print("No changes made.")

if __name__ == "__main__":
    inject_mega_pack_2()
