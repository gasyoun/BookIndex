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
        # метод внутренней реконструкции
        "subject_index-38d77aad-4521-5851-bc0f-9e5df69049db": [
            "Метод внутренней реконструкции позволяет лингвистам восстанавливать облик языка на этапах, предшествующих первым письменным памятникам.",
            "Анализ чередований в пределах одного языка — основа метода внутренней реконструкции (например, восстановление редуцированных гласных)."
        ],
        # орфография
        "subject_index-7300bdc6-dcc8-5af9-84f7-ae7c64bdb22a": [
            "Древнерусская орфография берестяных грамот («бытовая система») значительно отличалась от книжной церковнославянской традиции.",
            "Отклонения от стандартной орфографии в древних текстах служат бесценным источником информации о живых фонетических процессах."
        ],
        # порядок слов
        "subject_index-ae8ded39-61ce-5040-a306-eaf6b3fc171f": [
            "В древнерусском языке порядок слов регулировался законом Вакернагеля, согласно которому энклитики занимали второе место в фразе.",
            "Свободный порядок слов в русском языке не означает произвольности; он служит для смыслового выделения (актуального членения) предложения."
        ],
        # admire
        "lexicon-310d84a9-704c-59f3-8634-0fe916ff3415": [
            "Латинский корень в слове admire (admirari) часто становится объектом народной этимологии для слов арабского происхождения (например, amiral)."
        ],
        # Ahmad
        "lexicon-e713768b-8844-59a5-a0fd-dc66e2c54847": [
            "Имя Ahmad рассматривается Зализняком в контексте структуры арабских имен и их семантики в мусульманской культуре."
        ],
        # Al-
        "lexicon-5771c232-44ac-5320-83b7-73ca24fc7a53": [
            "Арабский артикль Al- является характерным маркером заимствований в европейских языках, часто сливаясь с основой (например, в словах алхимия, алкоголь)."
        ],
        # al-gabr
        "lexicon-cbe688bc-677c-5904-80da-7abb00e7364d": [
            "Математический термин al-gabr (аль-джабр) — 'восполнение', привел к возникновению слова алгебра во всем мире."
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
