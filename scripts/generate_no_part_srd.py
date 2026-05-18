import zipfile
import json
import os

def remove_part_info(node):
    if isinstance(node, list):
        for item in node:
            remove_part_info(item)
    elif isinstance(node, dict):
        # Remove any key that starts with 'part'
        keys_to_remove = [k for k in node.keys() if k.startswith('part')]
        for k in keys_to_remove:
            del node[k]
            
        if 'children' in node and isinstance(node['children'], list):
            for child in node['children']:
                remove_part_info(child)

def generate_no_part(in_path, out_path):
    print(f"Removing part info: {in_path} -> {out_path}")
    written = set()
    with zipfile.ZipFile(in_path, 'r') as zin, zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            
            if item.filename.endswith('process_tree.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    remove_part_info(data)
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    print(f"Error processing process_tree.json: {e}")
                    zout.writestr(item, zin.read(item.filename))
            elif item.filename.endswith('manifest.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    data['name'] = data.get('name', '') + ' (无部件信息)'
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
            else:
                zout.writestr(item, zin.read(item.filename))
                
    print(f"Done generating {out_path}!")

if __name__ == '__main__':
    generate_no_part('test_rich_full_v10.srd', 'test_no_part_v10.srd')
