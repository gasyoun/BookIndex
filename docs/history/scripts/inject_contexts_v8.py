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
        # ти
        "lexicon-0389920e-2f22-5479-8499-454848790967": [
            "Местоименная форма ти (тебе) в древнерусском языке была энклитикой и занимала второе место в предложении согласно закону Вакернагеля."
        ],
        # у́гол
        "lexicon-054b1e5a-f49e-5f1e-b959-3c01f5008bdd": [
            "Слово у́гол относится к числу слов с неподвижным ударением на основе в парадигме (акцентная кривая а)."
        ],
        # у́горь_(I.)
        "lexicon-16077fdd-20cb-57f2-93e7-fd21bc75446b": [
            "Слово у́горь исторически сохраняло ударение на основе (у́горь, у́горя), в отличие от слов типа у́голь, где оно стало подвижным."
        ],
        # у́горь_(II.)
        "lexicon-cfa951cb-9c82-5e46-8654-3d257f0b0b74": [
            "Слово у́горь (акне) также демонстрирует стабильность ударения на корне в лингвистических примерах Зализняка."
        ],
        # учи́шь
        "lexicon-2cb71cb3-7408-5ecc-aec7-4cacb9e4d194": [
            "В форме учи́шь (ранее у́чишь) произошел сдвиг ударения на окончание, типичный для многих глаголов этого класса в истории русского языка."
        ],
        # шестнадцать
        "lexicon-faa78ad0-5ebc-5e18-87df-49663297b287": [
            "В числительном шестнадцать (ранее ше́стнадцать) ударение в XVII-XVIII веках переместилось на слог -на-."
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
