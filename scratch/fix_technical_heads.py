import json
from pathlib import Path

def fix_heads():
    paths = [
        Path("data/modules/14-lexicon.json"),
        Path("data/modules/11-names.json"),
        Path("data/modules/13-toponyms.json"),
        Path("data/modules/16-subject_index.json")
    ]
    
    mapping = {
        "?а": "ˀа",
        "?и": "ˀи",
        "?U": "ˀu",
        "?дмъ": "домъ",
        "?дмъЦе": "домъце",
        "?Ци...": "Цицерон",
        "?атіг": "ˀатаб",
        "?ибп": "ˀитба",
        "??||": "→||",
        "?U6n": "ˀu-",
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
                for k, v in mapping.items():
                    if head == k:
                        # item["head"] = v
                        item["head"] = v
                        changed = True
        
        if changed:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    fix_heads()
