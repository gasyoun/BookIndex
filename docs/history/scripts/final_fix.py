import json
from pathlib import Path

def final_fix():
    paths = [
        Path("data/modules/14-lexicon.json")
    ]
    
    mapping = {
        "?д": "→д",
        "?Це": "→цѣ",
        "?дмъ1": "→дмъ¹",
        "?и6паупі": "-ayni",
        "??||": "→||",
        "?дмъ": "→дмъ"
    }
    
    for p in paths:
        if not p.exists(): continue
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        changed = False
        for entity_key in data:
            if not isinstance(data[entity_key], list): continue
            for item in data[entity_key]:
                head = item.get("head", "")
                if head in mapping:
                    new_head = mapping[head]
                    # print(f"Fixing {head} -> {new_head}")
                    item["head"] = new_head
                    item["needs_review"] = False
                    changed = True
        
        if changed:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    final_fix()
