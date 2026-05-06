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
        # юродивый
        "lexicon-4f81b13c-767e-5c18-b564-d3dbc6d79fed": [
            "Слово юродивый в древнерусском языке имело ударение на корне: юро́дивый, что соответствует его церковнославянскому происхождению."
        ],
        # огласовка
        "subject_index-0747cfa2-e1d3-579f-9c12-67a46503c4c8": [
            "Огласовка (харакат) в арабском языке используется для обозначения кратких гласных, которые не имеют отдельных букв в алфавите.",
            "При обсуждении восточных заимствований Зализняк часто обращается к принципам огласовки семитских корней."
        ],
        # письменность
        "subject_index-ce2086b2-e4b9-5725-9595-f8e49b44d3ba": [
            "Развитие письменности является ключевым фактором сохранения языковых норм; Зализняк анализирует переход от устной традиции к графической фиксации.",
            "Древнерусская письменность на бересте открыла лингвистам живой разговорный язык, свободный от книжных канонов."
        ],
        # 'ada
        "lexicon-7992c27c-145a-5c05-b16a-83a4b4cb3f3a": [
            "Слово 'ada (араб. 'āda) — 'обычай', рассматривается как пример широкого распространения арабских терминов в исламском мире."
        ],
        # ̂/slm
        "lexicon-35f4e6cc-393c-5566-8a69-9d8d670765a1": [
            "Семитский корень slm (с-л-м) со значением 'мир', 'покорность' лежит в основе слов Ислам и салям."
        ],
        # ̂/tlb
        "lexicon-8feb354e-2f5d-5a43-aac9-625a9936db22": [
            "Корень tlb (т-л-б) — 'искать', 'просить', часто встречается в тюркских и арабских заимствованиях (например, в слове талиб)."
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
