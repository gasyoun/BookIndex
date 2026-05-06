import zipfile
import xml.etree.ElementTree as ET
import json

def debug_xlsx(file_path):
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    results = {}
    
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

        for i in range(1, 5):
            sheet_name = f'xl/worksheets/sheet{i}.xml'
            try:
                with z.open(sheet_name) as f:
                    tree = ET.parse(f)
                    rows = tree.findall('.//ns:row', ns)
                    results[sheet_name] = len(rows)
                    if len(rows) > 0:
                        # Extract first 5 rows for preview
                        preview = []
                        for r_idx, row in enumerate(rows[:5]):
                            cells = []
                            for cell in row.findall('ns:c', ns):
                                v = cell.find('ns:v', ns)
                                if v is not None:
                                    val = v.text
                                    if cell.get('t') == 's':
                                        val = strings[int(val)] if int(val) < len(strings) else f"MISSING_STRING_{val}"
                                    cells.append(val)
                                else:
                                    cells.append("")
                            preview.append(cells)
                        results[sheet_name + "_preview"] = preview
            except KeyError:
                continue
    
    return results

if __name__ == "__main__":
    print(json.dumps(debug_xlsx("video-archive.xlsx"), indent=2, ensure_ascii=False))
