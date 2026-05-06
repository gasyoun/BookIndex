import json
import re

def stem_ru(word):
    """Simple rule-based Russian stemmer (Porter-like)"""
    if len(word) < 4: return word
    word = word.lower()
    # Endings to strip
    RVRE = re.compile(r'^(.*?[аеиоуыэюя])(.*)$')
    DERIVATIONAL = re.compile(r'.*[^аеиоуыэюя][аеиоуыэюя]нт$')
    DERIVATIONAL_SUFFIX = re.compile(r'ость?$')
    ADJECTIVE = re.compile(r'(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$')
    PARTICIPLE = re.compile(r'((ивш|ывш|ующ)|((?<=[ая])(ем|нн|вш|ющ)))$')
    VERB = re.compile(r'((ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)|((?<=[ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)))$')
    NOUN = re.compile(r'(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$')
    REFLEXIVE = re.compile(r'(ся|сь)$')
    
    m = RVRE.match(word)
    if not m: return word
    pre, rv = m.groups()
    
    # Step 1: Reflexive
    rv = REFLEXIVE.sub('', rv)
    # Step 2: Adjective / Participle / Verb / Noun
    temp = ADJECTIVE.sub('', rv)
    if temp != rv:
        rv = temp
        rv = PARTICIPLE.sub('', rv)
    else:
        temp = VERB.sub('', rv)
        if temp != rv:
            rv = temp
        else:
            rv = NOUN.sub('', rv)
    # Step 3: Derivational
    rv = DERIVATIONAL_SUFFIX.sub('', rv)
    
    return pre + rv

def get_stems(text):
    if not text: return set()
    # Tokenize
    tokens = re.findall(r'[а-яёa-z0-9]+', text.lower())
    return {stem_ru(t) for t in tokens if len(t) > 2}

def deep_semantic_link():
    with open('app_data.json', 'r', encoding='utf-8') as f:
        app_data = json.load(f)
    
    # 1. Collect and pre-stem all terms
    entity_keys = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon', 'lexicon_tech', 'subject_index', 'glossary']
    term_index = []
    
    # Stop-words or too common stems to ignore as "anchor" stems
    STOP_STEMS = {'язык', 'лекц', 'курс', 'част', 'запис', 'книг', 'слов', 'автор'}
    
    for k in entity_keys:
        items = app_data.get(k, [])
        for it in items:
            h = it.get('head')
            if not h or len(h) < 3: continue
            stems = get_stems(h)
            if not stems: continue
            # Filter out terms that only consist of stop-stems
            significant_stems = stems - STOP_STEMS
            if not significant_stems and len(stems) > 0:
                significant_stems = stems # Fallback if everything is a stop-word
            
            term_index.append({
                'head': h,
                'stems': stems,
                'sig_stems': significant_stems,
                'type': k
            })

    # 2. Scan videos with deep matching
    videos = app_data.get('video_catalog', [])
    linked_count = 0
    total_links = 0
    
    for v in videos:
        title = v.get('title', '')
        v_stems = get_stems(title)
        if not v_stems: continue
        
        related = []
        for t in term_index:
            # Match condition:
            # If term is multi-word: ALL stems must be in title
            # If term is single-word: its stem must be in title
            
            t_stems = t['stems']
            if not t_stems: continue
            
            # Intersection logic
            matches = t_stems.issubset(v_stems)
            
            # Special case for "A and B" matching where order might vary or words are separated
            if matches:
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
            total_links += len(final_related)
            
    # 3. Save
    with open('app_data.json', 'w', encoding='utf-8') as f:
        json.dump(app_data, f, ensure_ascii=False, indent=2)
    
    print(f"Deep Linking Complete:")
    print(f"- Videos with links: {linked_count}")
    print(f"- Total semantic connections: {total_links}")

if __name__ == "__main__":
    deep_semantic_link()
