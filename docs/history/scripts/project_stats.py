import json

def get_stats():
    with open('app_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    entity_keys = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index']
    all_heads = set()
    for k in entity_keys:
        for it in data.get(k, []):
            if it.get('head'): all_heads.add(it['head'])
    
    # Contexts count
    context_count = 0
    for k in entity_keys:
        for it in data.get(k, []):
            context_count += len(it.get('page_list', []))
            
    videos = data.get('video_catalog', [])
    
    stats = {
        "scientific_index": {
            "total_unique_entities": len(all_heads),
            "lexemes": len(data.get('lexicon', [])),
            "names_and_toponyms": len(data.get('names', [])) + len(data.get('toponyms', [])),
            "languages_and_ethnonyms": len(data.get('languages', [])) + len(data.get('ethnonyms', [])),
            "scientific_concepts": len(data.get('subject_index', []))
        },
        "corpus_depth": {
            "total_lectures_in_book": len(data.get('chapters', [])),
            "total_pages_indexed": max([ch.get('end', 0) for ch in data.get('chapters', [])]) if data.get('chapters') else 0,
            "total_context_mentions": context_count
        },
        "multimedia_archive": {
            "total_video_lectures": len(videos),
            "semantic_cross_links": sum(len(v.get('related_entities', [])) for v in videos),
            "video_duration_hours": round(sum(v.get('duration', 0) for v in videos) / 3600, 1)
        }
    }
    return stats

if __name__ == "__main__":
    s = get_stats()
    print(json.dumps(s, indent=2, ensure_ascii=False))
