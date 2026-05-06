import json
import re
from pathlib import Path

def source_audit():
    module_path = Path("data/modules/14-lexicon.json")
    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Load all content text
    content_dir = Path("src/content")
    bulk_text = ""
    for p in content_dir.glob("*.md"):
        bulk_text += p.read_text(encoding="utf-8") + "\n"

    # Sentences are usually between boundaries
    # We'll search for the head and extract the surrounding sentence
    
    changed = False
    targets = [
        "nyn", "Oj", "P", "Tf", "admirer", "admire", "ailleurs", "al-himär", 
        "alibi", "Allemands", "amiral", "armenians", "armeniens", "aspirare",
        "Bahr", "Bratpfanne", "business", "chair", "chaise", "Charles", "clause",
        "concours", "deset", "deva", "devet", "digital", "digitus", "fakir"
    ]

    for entity_key in data:
        if not isinstance(data[entity_key], list): continue
        for item in data[entity_key]:
            head = item.get("head", "")
            if head in targets:
                # Find occurrences in bulk text
                # We look for the head as a whole word or part of it
                pattern = re.compile(re.escape(head), re.IGNORECASE)
                matches = list(pattern.finditer(bulk_text))
                
                new_contexts = []
                for match in matches:
                    start = max(0, match.start() - 60)
                    end = min(len(bulk_text), match.end() + 60)
                    snippet = bulk_text[start:end].replace("\n", " ").strip()
                    # Clean up snippet
                    snippet = "…" + snippet + "…"
                    if snippet not in new_contexts:
                        new_contexts.append(snippet)
                
                if new_contexts:
                    item["contexts"] = new_contexts[:3] # limit to 3
                    changed = True
                else:
                    # If no real context found, remove the "invented" ones
                    if "contexts" in item and item["contexts"]:
                        item["contexts"] = []
                        changed = True

    if changed:
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    source_audit()
