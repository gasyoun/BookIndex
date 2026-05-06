import json
import os

def sort_module(file_path, key):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if key in data:
        # Sort by 'head' field, treating 'ё' as 'е' for common Russian sorting
        data[key].sort(key=lambda x: x.get('head', '').lower().replace('ё', 'е'))
        
        # Update letter_change flags if they exist
        prev_letter = None
        for item in data[key]:
            head = item.get('head', '')
            if head:
                first_letter = head[0].upper()
                if first_letter != prev_letter:
                    item['letter_change'] = True
                    item['letter'] = first_letter
                    prev_letter = first_letter
                else:
                    item['letter_change'] = False
                    item['letter'] = first_letter

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def main():
    modules_dir = 'data/modules'
    mapping = {
        '10-names.json': 'names',
        '11-toponyms.json': 'toponyms',
        '12-ethnonyms.json': 'ethnonyms',
        '13-languages.json': 'languages'
    }
    
    # Check what files actually exist
    files = os.listdir(modules_dir)
    print(f"Files in {modules_dir}: {files}")
    
    # Correct mapping based on files
    actual_mapping = {}
    for f in files:
        if 'names' in f: actual_mapping[f] = 'names'
        elif 'toponyms' in f: actual_mapping[f] = 'toponyms'
        elif 'ethnonyms' in f: actual_mapping[f] = 'ethnonyms'
        elif 'languages' in f: actual_mapping[f] = 'languages'
        elif 'lexicon' in f: actual_mapping[f] = 'lexicon'
    
    # Also find subject_index specifically
    for f in files:
        with open(os.path.join(modules_dir, f), 'r', encoding='utf-8') as file:
            try:
                data = json.load(file)
                if 'subject_index' in data:
                    actual_mapping[f] = 'subject_index' # Note: if 14-lexicon has both, this will sort subject_index only if it's the last check
            except:
                continue

    for filename, key in actual_mapping.items():
        print(f"Sorting {filename} (key: {key})...")
        sort_module(os.path.join(modules_dir, filename), key)

if __name__ == "__main__":
    main()
