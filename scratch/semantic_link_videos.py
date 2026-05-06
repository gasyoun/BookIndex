import json
import re

def normalize(text):
    if not text: return ""
    t = str(text).lower()
    t = re.sub(r'[^\w\s]', '', t)
    return t.strip()

def semantic_link():
    with open('app_data.json', 'r', encoding='utf-8') as f:
        app_data = json.load(f)
    
    # 1. Collect all terms from all content keys
    entity_keys = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index']
    terms = []
    for k in entity_keys:
        items = app_data.get(k, [])
        for it in items:
            h = it.get('head')
            if h:
                # Store term and its normalized version
                terms.append({'head': h, 'norm': normalize(h), 'type': k})
    
    # Also glossary
    for it in app_data.get('glossary', []):
        h = it.get('head')
        if h: terms.append({'head': h, 'norm': normalize(h), 'type': 'glossary'})

    # 2. Scan videos
    videos = app_data.get('video_catalog', [])
    linked_count = 0
    
    for v in videos:
        title = v.get('title', '')
        title_norm = normalize(title)
        related = []
        
        # Optimization: only check terms that are likely to be in the title
        # For small title, we can just check
        for t in terms:
            if not t['norm']: continue
            # Avoid too short terms which cause false positives (e.g. "и", "в")
            if len(t['norm']) < 5: continue 
            
            if t['norm'] in title_norm:
                related.append({
                    "head": t['head'],
                    "type": t['type']
                })
        
        # Deduplicate
        seen = set()
        final_related = []
        for r in related:
            key = f"{r['type']}:{r['head']}"
            if key not in seen:
                final_related.append(r)
                seen.add(key)
        
        v['related_entities'] = final_related
        if final_related:
            linked_count += 1
            
    # 3. Save
    with open('app_data.json', 'w', encoding='utf-8') as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)
    
    print(f"Linked {linked_count} videos with terms using broad entity search.")

if __name__ == "__main__":
    semantic_link()
