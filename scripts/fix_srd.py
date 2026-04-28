import zipfile
import json
import os

def fix_srd_data(in_path, out_path):
    print(f"Refactoring SRD: {in_path} -> {out_path}")
    written = set()
    changes = 0
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
                            
                            # 1. Base legacy 'columns' to 'fields'
                            if 'columns' in config:
                                val = config['columns']
                                if isinstance(val, list):
                                    config['fields'] = config.pop('columns')
                            
                            # 2. Fix inner array
                            if 'fields' in config and isinstance(config['fields'], list):
                                # If it's the process tree or process table, ensure it's STRICTLY one field: '名称' -> 'name'
                                if comp.get('id') in ('comp_process_tree', 'comp_process_table'):
                                    config['fields'] = [
                                        {"label": "名称", "prop": "name", "width": -1}
                                    ]
                                    changes += 1
                                else:
                                    # Regular replace for other lists
                                    new_fields = []
                                    for field in config['fields']:
                                        # Update legacy rich text field type definition
                                        if field.get('cellType') == 'richtext':
                                            field['type'] = 'richText'
                                            del field['cellType']
                                            changes += 1
                                        elif field.get('type') == 'richtext':
                                            field['type'] = 'richText'
                                            changes += 1
                                            
                                        # Fix displayName to name
                                        if field.get('prop') == 'displayName':
                                            field['prop'] = 'name'
                                            changes += 1
                                            
                                        new_fields.append(field)
                                    config['fields'] = new_fields
                    elif item.filename == 'manifest.json':
                        if 'version' in data:
                            data['version'] = '6.1'
                            
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    print(f"Error parsing JSON in {item.filename}: {e}")
                    zout.writestr(item, zin.read(item.filename))
            else:
                zout.writestr(item, zin.read(item.filename))
    print(f"Done. Made {changes} field modifications.")

if __name__ == '__main__':
    fix_srd_data('test_rich_full_v6.srd', 'test_rich_full_v7.srd')
