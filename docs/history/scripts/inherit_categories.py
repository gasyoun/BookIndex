import json
from pathlib import Path

def inherit_categories():
    module_path = Path("data/modules/14-lexicon.json")
    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Create mapping from lexicon
    mapping = {}
    for item in data.get("lexicon", []):
        head = item.get("head")
        if head:
            mapping[head] = item.get("category", "rus") # default to rus if missing

    # 2. Update lexicon_reverse
    changed = False
    for item in data.get("lexicon_reverse", []):
        head = item.get("head")
        if head and item.get("category") in [None, "unknown", ""]:
            if head in mapping:
                item["category"] = mapping[head]
                changed = True
            else:
                # If not found in lexicon, we might try to guess or leave as is
                # For now, let's just mark it as rus if it looks Russian
                if any(c in 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя' for c in head.lower()):
                    item["category"] = "rus"
                    changed = True

    # 3. Update lexicon_tech
    for item in data.get("lexicon_tech", []):
        if item.get("category") in [None, "unknown", ""]:
            item["category"] = "tech" # default for tech index
            changed = True

    if changed:
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("Updated categories in lexicon_reverse and lexicon_tech.")

if __name__ == "__main__":
    inherit_categories()
