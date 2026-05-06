import zipfile
import xml.etree.ElementTree as ET
import json
import os

def extract_xlsx(file_path):
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    with zipfile.ZipFile(file_path, 'r') as z:
        # Get shared strings
        strings = []
        try:
            with z.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                for si in tree.findall('.//ns:si', ns):
                    t = si.find('ns:t', ns)
                    if t is not None:
                        strings.append(t.text)
                    else:
                        # Handle phonetic strings or other cases
                        strings.append("".join(t.text for t in si.findall('.//ns:t', ns)))
        except KeyError:
            pass

        # Get sheet data
        videos = []
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            rows = tree.findall('.//ns:row', ns)
            
            headers = []
            for i, row in enumerate(rows):
                cells = []
                for cell in row.findall('ns:c', ns):
                    v = cell.find('ns:v', ns)
                    if v is not None:
                        val = v.text
                        if cell.get('t') == 's':
                            val = strings[int(val)]
                        cells.append(val)
                    else:
                        cells.append("")
                
                if i == 0:
                    headers = cells
                    continue
                
                if not cells or not any(cells):
                    continue
                
                video = {}
                for j, h in enumerate(headers):
                    if j < len(cells):
                        video[h.lower()] = cells[j]
                
                if video.get('url') or video.get('title'):
                    videos.append(video)
        
        return videos

if __name__ == "__main__":
    xlsx_path = "video-archive.xlsx"
    data = extract_xlsx(xlsx_path)
    print(json.dumps(data, indent=2, ensure_ascii=False))
