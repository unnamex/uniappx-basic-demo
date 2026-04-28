import zipfile
import json
import os

def apply_fixes(in_path, out_path):
    print(f"Applying ui tweaks: {in_path} -> {out_path}")
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
                            if comp.get('id') == 'comp_proc_list' or comp.get('id') == 'comp_operation_list':
                                # Fix the column widths
                                config = comp.get('config', {})
                                fields = config.get('fields', [])
                                for f in fields:
                                    # Name should flex
                                    if f.get('prop') == 'name':
                                        f['width'] = -1
                                    # Content (richText) only shows a button, so fixed small width
                                    elif f.get('prop') == 'content':
                                        f['width'] = 120
                                    # Keep others fixed
                                    elif f.get('prop') == 'code':
                                        f['width'] = 150
                                    elif f.get('prop') == 'serialNumber':
                                        f['width'] = 80
                                    elif f.get('prop') == 'isKey_display':
                                        f['width'] = 80
                                config['fields'] = fields
                                
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    print(f"Error parsing JSON in {item.filename}: {e}")
                    zout.writestr(item, zin.read(item.filename))
            else:
                zout.writestr(item, zin.read(item.filename))
                
if __name__ == '__main__':
    apply_fixes('test_rich_full_v7.srd', 'test_rich_full_v7_new.srd')
