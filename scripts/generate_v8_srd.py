import zipfile
import json
import os

def upgrade_to_v8(in_path, out_path):
    print(f"Applying v8 icon upgrades: {in_path} -> {out_path}")
    written = set()
    with zipfile.ZipFile(in_path, 'r') as zin, zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in written:
                continue
                
            # Skip icons.json
            if item.filename.endswith('icons.json'):
                continue
                
            written.add(item.filename)
            
            if item.filename.endswith('manifest.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    if 'files' in data and 'icons' in data['files']:
                        del data['files']['icons']
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
            
            elif item.filename.endswith('process_tree.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    
                    def add_icons_to_tree(nodes):
                        for node in nodes:
                            t = node.get('type')
                            if t == 'process':
                                node['classId_icon'] = 'process'
                            elif t == 'operation':
                                node['classId_icon'] = 'operation'
                            elif t == 'step':
                                node['classId_icon'] = 'step'
                            elif t == 'action-unit':
                                node['classId_icon'] = 'action'
                            if 'children' in node:
                                add_icons_to_tree(node['children'])
                                
                    add_icons_to_tree(data)
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
                    
            elif item.filename.endswith('process.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    for row in data:
                        row['classId_business_icon'] = 'process'
                        row['partClassId_business_icon'] = 'process'
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
                    
            elif item.filename.endswith('operation.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    for row in data:
                        # Can optionally assign business icons here if applicable
                        pass
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
                    
            else:
                zout.writestr(item, zin.read(item.filename))
                
    print("Done!")

if __name__ == '__main__':
    upgrade_to_v8('test_rich_full_v7.srd', 'test_rich_full_v8.srd')
