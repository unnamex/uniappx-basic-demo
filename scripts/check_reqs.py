import zipfile
import json
import sys

def examine(srd_path):
    with open('reqs_output.txt', 'w', encoding='utf-8') as f:
        with zipfile.ZipFile(srd_path, 'r') as z:
            for item in z.namelist():
                if item.endswith('components.json'):
                    content = z.read(item).decode('utf-8')
                    comps = json.loads(content)
                    for comp in comps:
                        if comp['id'] == 'comp_proc_info':
                            f.write("--- comp_proc_info fields ---\n")
                            f.write(json.dumps(comp.get('config', {}).get('fields'), ensure_ascii=False, indent=2) + "\n")
                        if comp['id'] == 'comp_proc_list':
                            f.write("--- comp_proc_list fields ---\n")
                            f.write(json.dumps(comp.get('config', {}).get('fields'), ensure_ascii=False, indent=2) + "\n")

            for item in z.namelist():
                if item.endswith('process.json'):
                    content = z.read(item).decode('utf-8')
                    data = json.loads(content)
                    f.write(f"--- process data keys: {list(data[0].keys()) if data else []}\n")
                if item.endswith('operation.json'):
                    content = z.read(item).decode('utf-8')
                    data = json.loads(content)
                    f.write(f"--- operation data keys: {list(data[0].keys()) if data else []}\n")

if __name__ == '__main__':
    examine('test_rich_full_v7.srd')
