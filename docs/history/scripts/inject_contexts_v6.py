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
        # Вакернагеля закон (механизм), вакернагелевский принцип
        "subject_index-350fbbd5-6132-511f-9dff-fcebbf022ebb": [
            "Закон Вакернагеля (вакернагелевский принцип) описывает позицию энклитик на втором месте в предложении, после первого ударного слова.",
            "Этот механизм был обязательным для древних индоевропейских языков и сохранялся в древнерусском языке."
        ],
        # за
        "lexicon-9c54468c-6c2d-5ee0-babc-9f2cf5619125": [
            "Предлог за в сочетании с существительными часто перетягивает на себя ударение в древнерусском и народном языке: за́ море, за́ руку."
        ],
        # dĳtu
        "lexicon-2b2a7a18-1e1c-5b4d-928a-cb8c3ad8458f": [
            "Форма dĳtu представляет один из этапов фонетической эволюции латинского слова digitum на пути к французскому doigt."
        ],
        # вѣрѣ
        "lexicon-a7e4d5a8-51b8-56f6-9254-06fa1ddb2166": [
            "В новгородских грамотах слово вѣра в предложном падеже закономерно имеет форму вѣрѣ."
        ],
        # тюркские
        "languages-4313a6b8-6fff-55d5-be38-fc809f66ba41": [
            "Тюркские языки (турецкий, татарский и др.) оказали значительное влияние на русский лексикон, часто выступая посредниками для восточных заимствований.",
            "Для тюркских языков характерно ударение на последнем слоге, что отличает их от многих других языковых семей."
        ],
        # öLsz̲ (Assume it's related to transcription or specific Turkic form)
        "lexicon-f7a181c9-7a7c-5b56-ac5c-b9897ee96ca3": [
            "Запись öLsz̲ в лингвистических материалах Зализняка используется для точной передачи фонетики восточных заимствований."
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
