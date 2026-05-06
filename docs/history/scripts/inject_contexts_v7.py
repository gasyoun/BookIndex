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
        # мя
        "lexicon-9234c21c-7a08-52e5-a4fc-8fee2d935d84": [
            "Частица мя в древнерусском языке была энклитикой (сокращенная форма от меня) и занимала второе место в предложении."
        ],
        # милостивый
        "lexicon-54c5d400-6f6c-5d4a-8dc2-44ca002abf82": [
            "Слово милостивый в древнерусском языке имело ударение на корне: ми́лостивый (ср. современное ми́лостивый)."
        ],
        # семъ
        "lexicon-04555f43-e30e-532f-bcf4-78a443544bf7": [
            "Числительное семь в древности имело форму семъ, оканчивающуюся на редуцированный гласный ъ."
        ],
        # Стокгольм
        "lexicon-c407f252-c346-55bc-aff3-e1ad9af0ed0b": [
            "В русском языке в слове Стокгольм ударение сдвинулось на последний слог, тогда как в шведском оригинале оно падает на первый."
        ],
        # суоми
        "lexicon-379b555f-2a6c-51bd-ab1d-6b9c45d8e151": [
            "Финны сами себя называют Суоми (Suomi); название 'финны' — это внешнее наименование, вероятно, шведского происхождения."
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
