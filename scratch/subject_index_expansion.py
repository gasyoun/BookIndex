import json
import re
from pathlib import Path

def expand_subject_index():
    module_path = Path("data/modules/14-lexicon.json")
    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Load all content text
    content_dir = Path("src/content")
    bulk_text = ""
    for p in content_dir.glob("*.md"):
        bulk_text += p.read_text(encoding="utf-8") + "\n"

    changed = False
    # We target subject_index
    for item in data.get("subject_index", []):
        head = item.get("head", "")
        # Only if empty or needs update
        if not item.get("occurrences", {}).get("mumintroll", {}).get("contexts"):
            # Search for head
            # We look for the head, often it's a noun. 
            # We use a case-insensitive search.
            pattern = re.compile(re.escape(head), re.IGNORECASE)
            matches = list(pattern.finditer(bulk_text))
            
            new_contexts = []
            for match in matches:
                # Get the surrounding sentence (approx)
                start = max(0, match.start() - 80)
                end = min(len(bulk_text), match.end() + 100)
                snippet = bulk_text[start:end].replace("\n", " ").strip()
                # Find start of sentence (capital letter or ... )
                # For simplicity, we just take a chunk and add ...
                snippet = "…" + snippet + "…"
                if snippet not in new_contexts:
                    new_contexts.append(snippet)
                    if len(new_contexts) >= 2: break # 2 high quality snippets
            
            if new_contexts:
                if "mumintroll" not in item["occurrences"]:
                    item["occurrences"]["mumintroll"] = {"pages": [], "contexts": []}
                item["occurrences"]["mumintroll"]["contexts"] = new_contexts
                item["contexts"] = new_contexts
                changed = True

    if changed:
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    expand_subject_index()
