import json
from collections import defaultdict

def generate_semantic_links(data_path, output_path):
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Collect all items and their pages
    all_items = []
    categories = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index']
    
    item_to_pages = {}
    
    for cat in categories:
        if cat in data:
            for item in data[cat]:
                name = item.get('head') or item.get('name')
                pages = set(item.get('pages', []))
                if name and pages:
                    item_to_pages[name] = pages
                    all_items.append(name)

    print(f"Loaded {len(item_to_pages)} items with pages.")

    # Matrix of co-occurrence
    # We only care about pairs that share at least one page
    related = defaultdict(lambda: defaultdict(int))
    
    # Pre-calculate page -> items mapping for speed
    page_to_items = defaultdict(list)
    for name, pages in item_to_pages.items():
        for p in pages:
            page_to_items[p].append(name)

    print("Calculating shared pages...")
    for p, items in page_to_items.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                u, v = items[i], items[j]
                related[u][v] += 1
                related[v][u] += 1

    # Filter and format
    semantic_links = {}
    for name, targets in related.items():
        results = []
        len_i = len(item_to_pages[name])
        
        for target, shared_count in targets.items():
            len_j = len(item_to_pages[target])
            # Jaccard index or similar
            score = shared_count / (len_i + len_j - shared_count)
            if score > 0.05: # Threshold
                results.append({"head": target, "score": round(score, 3), "shared": shared_count})
        
        # Sort by score and take top 10
        results.sort(key=lambda x: x['score'], reverse=True)
        if results:
            semantic_links[name] = results[:10]

    data['semantic_links'] = semantic_links

    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {data_path} with {len(semantic_links)} semantic link entries.")

if __name__ == "__main__":
    generate_semantic_links('c:\\Users\\user\\Documents\\GitHub\\BookIndex\\app_data.json', 'c:\\Users\\user\\Documents\\GitHub\\BookIndex\\semantic_links.json')
