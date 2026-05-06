import zipfile
import xml.etree.ElementTree as ET

def check_structure(file_path):
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(file_path, 'r') as z:
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            rows = tree.findall('.//ns:row', ns)
            if len(rows) > 1:
                row = rows[1] # Row 2
                for cell in row.findall('ns:c', ns):
                    print(ET.tostring(cell, encoding='unicode'))

if __name__ == "__main__":
    check_structure("video-archive.xlsx")
