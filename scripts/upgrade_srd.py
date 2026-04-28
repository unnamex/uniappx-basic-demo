import zipfile
import json
import os

def upgrade_srd(in_path, out_path):
    print(f"Upgrading SRD: {in_path} -> {out_path}")
    changes = 0
    written = set()
    with zipfile.ZipFile(in_path, 'r') as zin, zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            
            if item.filename.endswith('.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    if 'components.json' in item.filename:
                        for comp in data:
                            config = comp.get('config', {})
                            if 'columns' in config:
                                val = config['columns']
                                if isinstance(val, list):
                                    config['fields'] = config.pop('columns')
                                    print(f"  Upgraded columns -> fields array for component: {comp.get('id')} ({comp.get('type')})")
                                    changes += 1
                                    
                    elif item.filename == 'manifest.json':
                        if 'version' in data:
                            data['version'] = '6.1'
                            print("  Upgraded manifest.json version to 6.1")
                    
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    print(f"  [ERROR] Failed to parse JSON in {item.filename}: {e}")
                    zout.writestr(item, zin.read(item.filename))
            else:
                zout.writestr(item, zin.read(item.filename))
                
    print(f"Upgrade complete. Modified {changes} components.")

if __name__ == '__main__':
    upgrade_srd('test_rich_full_v6.srd', 'test_rich_full_updated.srd')
