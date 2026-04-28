import zipfile
import json
import sys

def check(path):
    with zipfile.ZipFile(path, 'r') as z:
        for item in z.namelist():
            if item.endswith('components.json'):
                data = json.loads(z.read(item).decode('utf-8'))
                for comp in data:
                    print(comp['id'], comp['tab_id'], comp['type'])

if __name__ == '__main__':
    check('test_rich_full_v7.srd')
