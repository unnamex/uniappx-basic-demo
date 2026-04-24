import zipfile
import json
import os
import shutil

def process():
    srd_file = 'updated_rich_full_v6.srd'
    extract_dir = 'tmp_update_v3'
    
    # 1. Unzip
    with zipfile.ZipFile(srd_file, 'r') as zf:
        zf.extractall(extract_dir)
    
    # 2. Modify layout/components.json
    comp_path = os.path.join(extract_dir, 'layout', 'components.json')
    if os.path.exists(comp_path):
        with open(comp_path, 'r', encoding='utf-8') as f:
            comps = json.load(f)
        
        for comp in comps:
            # Update fields in infoView or others
            if 'config' in comp and 'fields' in comp['config']:
                for field in comp['config']['fields']:
                    if field.get('cellType') == 'richtext' or field.get('cellType') == 'richText' or field.get('type') == 'richtext':
                        field['type'] = 'richText'
                        field.pop('cellType', None)
                        
            # Update columns in table
            if 'config' in comp and 'columns' in comp['config'] and isinstance(comp['config']['columns'], list):
                for col in comp['config']['columns']:
                    if col.get('cellType') == 'richtext' or col.get('cellType') == 'richText' or col.get('type') == 'richtext':
                        col['type'] = 'richText'
                        col.pop('cellType', None)

        with open(comp_path, 'w', encoding='utf-8') as f:
            json.dump(comps, f, ensure_ascii=False, indent=2)
            
    # 3. Repack
    shutil.make_archive('updated_rich_full_v6', 'zip', extract_dir)
    os.replace('updated_rich_full_v6.zip', 'updated_rich_full_v6.srd')
    
    # 4. Cleanup
    shutil.rmtree(extract_dir)
    print("Successfully updated cellType to type: richText in updated_rich_full_v6.srd")

if __name__ == '__main__':
    process()
