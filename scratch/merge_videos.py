import json

def merge_videos():
    with open('app_data.json', 'r', encoding='utf-8') as f:
        app_data = json.load(f)
    
    with open('scratch/videos.json', 'r', encoding='utf-8') as f:
        new_videos = json.load(f)
    
    # Merge logic: if ID already exists, we might want to keep timecodes
    # But for now, user said "all the videos as I have them"
    # I'll preserve existing timecodes if ID matches
    existing_map = { v['id']: v for v in app_data.get('video_catalog', []) }
    
    final_videos = []
    for nv in new_videos:
        if nv['id'] in existing_map:
            # Preserve timecodes
            nv['timecodes'] = existing_map[nv['id']].get('timecodes', [])
        final_videos.append(nv)
    
    # Add any existing videos that weren't in the new list?
    # No, user likely wants the Excel to be the new source of truth for the list.
    
    app_data['video_catalog'] = final_videos
    
    with open('app_data.json', 'w', encoding='utf-8') as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    merge_videos()
    print("Merge complete")
