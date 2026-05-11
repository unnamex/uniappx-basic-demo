import zipfile
import json
import sys

def examine(srd_path):
    with zipfile.ZipFile(srd_path, 'r') as z:
        for item in z.namelist():
            if item.endswith('components.json'):
                content = z.read(item).decode('utf-8')
                data = json.loads(content)
                res = []
                for comp in data:
                    if comp['id'] in ('left_process_tree', 'comp_proc_list'):
                        res.append({
                            "id": comp['id'],
                            "config": comp.get('config')
                        })
                with open('examine_comps.json', 'w', encoding='utf-8') as f:
                    json.dump(res, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    examine('test_rich_full_v6.srd')
