import json
from pathlib import Path

def final_normalization():
    module_path = Path("data/modules/14-lexicon.json")
    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    for item in data.get("lexicon_reverse", []):
        cat = item.get("category")
        if cat is None or cat == "unknown" or cat == "":
            head = item.get("head", "")
            # Heuristic for the remaining 19
            if any(c in 'ˀ→*˗-' for c in head) or head in ["d0it", "sau"]:
                item["category"] = "tech"
            else:
                # If it has Latin letters, mark as lat
                if any(c.isascii() and c.isalpha() for c in head):
                    item["category"] = "lat"
                else:
                    item["category"] = "rus"
            changed = True

    if changed:
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    final_normalization()
