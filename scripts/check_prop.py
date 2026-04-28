import zipfile
import json
import sys

def examine(srd_path):
    with zipfile.ZipFile(srd_path, 'r') as z:
        if 'data/process_tree.json' in z.namelist():
            content = z.read('data/process_tree.json').decode('utf-8')
            data = json.loads(content)
            print("Process Tree node keys:", list(data[0].keys()))
            print("Process Tree name/displayName:", data[0].get('name'), data[0].get('displayName'))

if __name__ == '__main__':
    examine('test_rich_full_v6.srd')
