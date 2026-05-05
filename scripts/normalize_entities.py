import json
import uuid
import os
import argparse

def generate_canonical_id(kind, head):
    return f"{kind}-{uuid.uuid5(uuid.NAMESPACE_URL, head)}"

def main():
    parser = argparse.ArgumentParser(description="Normalize app_data entities to support cross-book occurrences.")
    parser.add_argument("input_file", help="Path to app_data.json")
    parser.add_argument("--out", dest="output_file", help="Path to output json", default="app_data_normalized.json")
    args = parser.parse_args()

    with open(args.input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for kind in ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_reverse', 'lexicon_tech', 'subject_index']:
        items = data.get(kind, [])
        grouped = {}
        for it in items:
            head = it.get('head', '').strip()
            if not head: continue
            if head not in grouped:
                grouped[head] = []
            grouped[head].append(it)
        
        normalized = []
        for head, group in grouped.items():
            if len(group) == 1 and 'occurrences' in group[0]:
                normalized.append(group[0])
                continue
                
            canonical_id = group[0].get('canonical_id') or generate_canonical_id(kind, head)
            aliases = set()
            occurrences = {}
            
            for it in group:
                book_id = it.get('book_id', 'mumintroll')
                if 'aliases' in it and isinstance(it['aliases'], list):
                    for a in it['aliases']: aliases.add(a)
                    
                if 'occurrences' in it:
                    for b_id, occ in it['occurrences'].items():
                        if b_id not in occurrences: occurrences[b_id] = {'pages': [], 'contexts': []}
                        occurrences[b_id]['pages'].extend(occ.get('pages', []))
                        occurrences[b_id]['contexts'].extend(occ.get('contexts', []))
                else:
                    if book_id not in occurrences: occurrences[book_id] = {'pages': [], 'contexts': []}
                    occurrences[book_id]['pages'].extend(it.get('page_list', []))
                    
                    ctx = it.get('contexts')
                    if isinstance(ctx, list):
                        occurrences[book_id]['contexts'].extend(ctx)
                    elif isinstance(ctx, dict):
                        # Some legacy contexts might be dicts mapping page -> context array
                        for pg, arr in ctx.items():
                            occurrences[book_id]['contexts'].extend(arr)
            
            for b_id in occurrences:
                occurrences[b_id]['pages'] = sorted(list(set(occurrences[b_id]['pages'])))
                # ensure contexts are unique strings
                occurrences[b_id]['contexts'] = list(set([str(c) for c in occurrences[b_id]['contexts']]))
                
            merged = {
                'canonical_id': canonical_id,
                'head': head,
                'aliases': list(aliases),
                'occurrences': occurrences
            }
            
            # Legacy fields for frontend compatibility
            merged['book_id'] = group[0].get('book_id', 'mumintroll')
            merged['page_list'] = occurrences.get(merged['book_id'], {}).get('pages', [])
            merged['contexts'] = occurrences.get(merged['book_id'], {}).get('contexts', [])
            
            for k in ['head_pages', 'is_moderator', 'moderator_note', 'discussed']:
                if k in group[0]:
                    merged[k] = group[0][k]
            
            normalized.append(merged)
            
        data[kind] = normalized

    with open(args.output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Normalization complete. Wrote {args.output_file}")

if __name__ == '__main__':
    main()
