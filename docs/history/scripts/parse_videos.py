import zipfile
import xml.etree.ElementTree as ET
import json
import re

def parse_xlsx(file_path):
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    with zipfile.ZipFile(file_path, 'r') as z:
        strings = []
        try:
            with z.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                for si in tree.findall('.//ns:si', ns):
                    t_nodes = si.findall('.//ns:t', ns)
                    strings.append("".join(t.text for t in t_nodes if t.text))
        except KeyError:
            pass

        videos = []
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            rows = tree.findall('.//ns:row', ns)
            
            for i, row in enumerate(rows):
                if i == 0: continue 
                
                row_data = {}
                for cell in row.findall('ns:c', ns):
                    r = cell.get('r')
                    if not r: continue
                    col_letter = re.match(r'([A-Z]+)', r).group(1)
                    
                    v = cell.find('ns:v', ns)
                    if v is not None:
                        val = v.text
                        if cell.get('t') == 's':
                            try:
                                val = strings[int(val)]
                            except:
                                pass
                        row_data[col_letter] = val
                
                title = row_data.get('A', '')
                date = row_data.get('G', '')
                duration_raw = row_data.get('O', '0')
                url = row_data.get('P', '')
                
                if not url or not isinstance(url, str) or 'youtube.com' not in url.lower():
                    if isinstance(duration_raw, str) and 'youtube.com' in duration_raw.lower():
                        url = duration_raw
                        duration_raw = row_data.get('N', '0')
                
                if not url or not isinstance(url, str) or 'youtube.com' not in url.lower():
                    continue
                
                try:
                    duration = int(float(duration_raw) * 24 * 3600)
                except:
                    duration = 0
                
                formatted_date = date
                if date and isinstance(date, str) and re.match(r'\d{2}\.\d{2}\.\d{2}', date):
                    parts = date.split('.')
                    year = "20" + parts[2] if len(parts[2]) == 2 else parts[2]
                    formatted_date = f"{year}-{parts[1]}-{parts[0]}"
                
                videos.append({
                    "id": url.split('v=')[-1].split('&')[0],
                    "title": str(title).strip(),
                    "url": url,
                    "date": formatted_date,
                    "duration": duration,
                    "timecodes": []
                })
        
        return videos

if __name__ == "__main__":
    videos = parse_xlsx("video-archive.xlsx")
    with open("scratch/videos.json", "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)
