import json
from pathlib import Path

def inject_contexts():
    module_path = Path("data/modules/14-lexicon.json")
    if not module_path.exists():
        print("Lexicon module not found.")
        return

    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Updates mapping: canonical_id -> list of new contexts
    updates = {
        # ударение
        "subject_index-90fac88c-9294-5339-aa16-4876b2585d5c": [
            "Ударение является одной из самых сложных подсистем русского языка, характеризующейся исторической изменчивостью.",
            "Зализняк рассматривает ударение как ключевой инструмент для реконструкции древних языковых состояний."
        ],
        # беглая гласная, беглый гласный
        "subject_index-6298284a-ad8f-57bc-88c4-f3d6e1763f23": [
            "Беглые гласные в современном русском языке являются прямым следствием падения редуцированных ъ и ь в XI-XIII веках.",
            "Примеры типа уголь/угля или отец/отца наглядно демонстрируют механизм чередования гласного с нулем звука."
        ],
        # бытовая (живая, устная, разговорная) речь
        "subject_index-933591b2-5c80-5c33-ad77-915a76436a9b": [
            "Живая бытовая речь, зафиксированная в берестяных грамотах, радикально изменила представления ученых о древнерусском языке.",
            "В отличие от книжного языка, разговорная речь развивалась по собственным законам, часто опережая литературную норму."
        ],
        # древний язык, древность языка
        "subject_index-737afd1a-2b5c-50a5-9a77-e82af0586227": [
            "Понятие древности языка в лингвистике часто связано с глубиной реконструируемых праформ и наличием письменных памятников.",
            "Сравнение древних языков (санскрита, латыни, древнегреческого) позволяет выявить их общее индоевропейское происхождение."
        ],
        # ösem
        "lexicon-0725310f-c164-5689-b59d-6afb6853cc9c": [
            "Числительное восемь в древности имело форму осемь (ösem); начальное в- появилось позже в результате фонетической адаптации.",
            "Форма осемь сохранялась в славянских языках длительное время и до сих пор видна в слове 'осьминог'."
        ],
        # öahaba
        "lexicon-babc3f68-f531-5179-bdcf-6cd505b2ff02": [
            "Арабский глагол öahaba (dh-h-b - 'уходить') приводится как пример реализации трехсогласного корня в семитских языках."
        ],
        # ̂Ьновѣі
        "lexicon-071d6e3b-34f2-564a-93a1-4f025128e132": [
            "Запись ̂Ьновѣі в новгородских материалах отражает специфику орфографии берестяных грамот (например, грамота № 579)."
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
        print("Updating data/modules/14-lexicon.json")
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        print("No changes made.")

if __name__ == "__main__":
    inject_contexts()
