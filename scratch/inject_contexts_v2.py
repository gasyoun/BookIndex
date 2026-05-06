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
        # литературный язык
        "subject_index-dfd0504f-6e0a-57b6-ad4e-b534aa7eba76": [
            "…поскольку на протяжении большей части истории русского языка литературным и высоким был именно церковнославянский, наш с вами современный литературный язык очень близок к церковнославянскому…"
        ],
        # фонетические изменения
        "subject_index-61e1605e-6dce-5652-abc7-fab856cee4a8": [
            "Фонетические — когда изменяются какие-то звуки. Например, когда-то в русском языке та форма, которая сейчас выглядит как буду, звучала как [бо́ндон]."
        ],
        # ли
        "lexicon-812eb88a-a624-56ca-8c8b-c29cea59264e": [
            "…являются ли эти ударения одинаковыми."
        ],
        # а
        "lexicon-b5e6f8f2-eeec-5bf4-b9c1-781ac06c5150": [
            "…в начале слова нужно произносить не простое а, как в русском, а ˀа."
        ],
        # правило
        "subject_index-f200cff7-af5b-59a1-9493-b8e41b75f154": [
            "В русском языке действует правило, что первое ударение слабее, а второе сильнее…"
        ],
        # dijtu
        "lexicon-9b609951-460d-5807-9e4a-25c282ec6178": [
            "…сохранением некоторой мягкости в этом dig, мягкости такого почти русского типа, которая превращает слово вот во что: dijtu."
        ],
        # иероглиф
        "subject_index-ddcf1675-cdb1-5d08-82ce-cd301c698dba": [
            "Шампольон расшифровал египетские иероглифы благодаря Розеттскому камню — но главное было в том, что он догадался: некоторые иероглифы обозначают звуки, а не понятия."
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
