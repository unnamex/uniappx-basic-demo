import zipfile
import json
import os

def upgrade_to_v9(in_path, out_path):
    print(f"Applying v9 upgrades: {in_path} -> {out_path}")
    written = set()
    with zipfile.ZipFile(in_path, 'r') as zin, zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            
            if item.filename.endswith('manifest.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    data['version'] = '9.0'
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    print(f"Error processing manifest.json: {e}")
                    zout.writestr(item, zin.read(item.filename))
                    
            elif item.filename.endswith('components.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    for comp in data:
                        # Rename id
                        if comp.get('id') == 'comp_process_tree':
                            comp['id'] = 'left_process_tree'
                        
                        # Remove dataSource from config
                        if 'config' in comp and 'dataSource' in comp['config']:
                            del comp['config']['dataSource']
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    print(f"Error parsing components.json: {e}")
                    zout.writestr(item, zin.read(item.filename))
            else:
                zout.writestr(item, zin.read(item.filename))
                
    print(f"Done generating {out_path}!")

if __name__ == '__main__':
    # 假设在项目根目录运行
    upgrade_to_v9('test_rich_full_v8.srd', 'test_rich_full_v9.srd')
