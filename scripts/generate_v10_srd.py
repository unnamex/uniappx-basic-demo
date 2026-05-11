import zipfile
import json
import os

def upgrade_to_v10(in_path, out_path):
    print(f"Applying v10 upgrades (removing left panel group): {in_path} -> {out_path}")
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
                    data['version'] = '10.0'
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
                    
            elif item.filename.endswith('tabs.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    # 移除 group_process_mgmt 分组
                    data = [t for t in data if t.get('id') != 'group_process_mgmt']
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))

            elif item.filename.endswith('tab.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    # 移除 group_process_mgmt 对应的 tab (left_panel 和 tab_process_list)
                    data = [t for t in data if t.get('group_id') != 'group_process_mgmt']
                    zout.writestr(item, json.dumps(data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))

            elif item.filename.endswith('components.json'):
                content = zin.read(item.filename).decode('utf-8')
                try:
                    data = json.loads(content)
                    new_data = []
                    for comp in data:
                        # 移除已经没有用处的 comp_process_table
                        if comp.get('id') == 'comp_process_table':
                            continue
                        
                        # 对于 left_process_tree 移除无用的 tab_id 属性
                        if comp.get('id') == 'left_process_tree':
                            if 'tab_id' in comp:
                                del comp['tab_id']
                        
                        new_data.append(comp)
                        
                    zout.writestr(item, json.dumps(new_data, ensure_ascii=False, indent=2))
                except Exception as e:
                    zout.writestr(item, zin.read(item.filename))
            else:
                zout.writestr(item, zin.read(item.filename))
                
    print(f"Done generating {out_path}!")

if __name__ == '__main__':
    upgrade_to_v10('test_rich_full_v9.srd', 'test_rich_full_v10.srd')
