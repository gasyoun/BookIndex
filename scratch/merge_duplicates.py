import json
from pathlib import Path

def merge_duplicates():
    paths = [
        Path("data/modules/10-names.json"),
        Path("data/modules/14-lexicon.json"),
    ]
    
    # Person unification map: canonical_id to keep -> list of canonical_ids to merge
    merges = {
        # Цицерон
        "names-f16e0376-31ae-54c8-ac4a-a3fdb895100a": [
            "lexicon-f16e0376-31ae-54c8-ac4a-a3fdb895100a",
            "lexicon_reverse-f16e0376-31ae-54c8-ac4a-a3fdb895100a",
            "lexicon_reverse-99f4cabe-e04f-5024-85fe-9e7375fac334",
            "lexicon_tech-99f4cabe-e04f-5024-85fe-9e7375fac334"
        ],
        # Фоменко А. Т.
        "names-f95f8db0-0f93-511e-9323-e83daa8fe8b6": [
            "names-320e1d8a-821d-5561-a083-02f5a09292e2" # The other Fomenko
        ],
        # Янин В. Л.
        "names-d63fac7a-7442-5d6b-83ae-45048e4afaa0": [
            "lexicon-d63fac7a-7442-5d6b-83ae-45048e4afaa0",
            "lexicon_reverse-d63fac7a-7442-5d6b-83ae-45048e4afaa0"
        ]
    }
    
    # We need to collect ALL data for each target
    collected = {target: {"occurrences": {}, "contexts": []} for target in merges}
    
    all_data = {}
    for p in paths:
        with open(p, "r", encoding="utf-8") as f:
            all_data[p] = json.load(f)
            
    # First pass: collect occurrences and contexts from candidates to be merged
    for p, data in all_data.items():
        for entity_key in data:
            if not isinstance(data[entity_key], list): continue
            for item in data[entity_key][:]: # iterate over copy
                cid = item.get("canonical_id")
                # Is this a candidate to be merged?
                target_cid = None
                for target, candidates in merges.items():
                    if cid in candidates or cid == target:
                        target_cid = target
                        break
                
                if target_cid:
                    # Merge occurrences
                    occ = item.get("occurrences", {})
                    for book, meta in occ.items():
                        if book not in collected[target_cid]["occurrences"]:
                            collected[target_cid]["occurrences"][book] = {"pages": [], "contexts": []}
                        
                        collected[target_cid]["occurrences"][book]["pages"] = list(set(
                            collected[target_cid]["occurrences"][book]["pages"] + meta.get("pages", [])
                        ))
                        collected[target_cid]["occurrences"][book]["contexts"] = list(set(
                            collected[target_cid]["occurrences"][book]["contexts"] + meta.get("contexts", [])
                        ))
                    
                    # Merge global contexts
                    collected[target_cid]["contexts"] = list(set(
                        collected[target_cid]["contexts"] + item.get("contexts", [])
                    ))
                    
                    # If it's a candidate (not the target), we'll eventually delete it
                    # But we only delete it from its own module.
                    # Wait, Cicero is in names AND lexicon. 
                    # If we merge lexicon Cicero into names Cicero, we should probably 
                    # remove it from lexicon.json.

    # Second pass: Update targets and delete candidates
    for p, data in all_data.items():
        changed = False
        new_list = []
        for entity_key in data:
            if not isinstance(data[entity_key], list): 
                continue
            
            items = data[entity_key]
            updated_items = []
            for item in items:
                cid = item.get("canonical_id")
                
                # If it's a target, update it
                if cid in collected:
                    print(f"Updating target {cid} in {p.name}")
                    item["occurrences"] = collected[cid]["occurrences"]
                    item["contexts"] = collected[cid]["contexts"]
                    updated_items.append(item)
                    changed = True
                # If it's a candidate, drop it
                elif any(cid in candidates for candidates in merges.values()):
                    print(f"Dropping candidate {cid} from {p.name}")
                    changed = True
                else:
                    updated_items.append(item)
            
            data[entity_key] = updated_items
        
        if changed:
            with open(p, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    merge_duplicates()
