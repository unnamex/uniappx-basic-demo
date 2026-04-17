import zipfile
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

INPUT_SRD = 'test_v7_refactored.srd'
OUTPUT_SRD = 'test_v8_refactored.srd'

def process_components(content):
    components = json.loads(content.decode('utf-8'))
    for comp in components:
        # process-tree → tableTree
        if comp.get('type') == 'process-tree':
            comp['type'] = 'tableTree'
        # key-value → infoView
        elif comp.get('type') == 'key-value':
            comp['type'] = 'infoView'
            config = comp.get('config', {})
            if isinstance(config, dict) and 'fields' in config:
                for f in config['fields']:
                    if 'key' in f:
                        f['vModel'] = f.pop('key')
                if 'columns' not in config:
                    config['columns'] = 2
        # text-block → richText
        elif comp.get('type') == 'text-block':
            comp['type'] = 'richText'
    return json.dumps(components, ensure_ascii=False, indent=2)

def process_groups(content):
    groups = json.loads(content.decode('utf-8'))
    for g in groups:
        if g.get('type') == 'tab-group':
            g['type'] = 'tabGroup'
    return json.dumps(groups, ensure_ascii=False, indent=2)

def main():
    if not os.path.exists(INPUT_SRD):
        print(f'错误：找不到输入文件 {INPUT_SRD}')
        return
    
    print(f'正在基于 {INPUT_SRD} 生成最新的重命名规范包...')
    
    with zipfile.ZipFile(INPUT_SRD, 'r') as in_zf:
        with zipfile.ZipFile(OUTPUT_SRD, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            for item in in_zf.infolist():
                name = item.filename
                content = in_zf.read(name)
                
                # 处理 manifest
                if name == 'manifest.json':
                    manifest = json.loads(content.decode('utf-8'))
                    manifest['version'] = '5.3'
                    manifest['name'] = manifest.get('name', 'V8工艺包') + ' (命名规范版)'
                    
                    if 'files' in manifest:
                        old_files = manifest['files']
                        new_files = {}
                        for k, v in old_files.items():
                            if k == 'groups':
                                new_files['tabs'] = 'layout/tabs.json'
                            elif k == 'tabs':
                                new_files['tab'] = 'layout/tab.json'
                            else:
                                new_files[k] = v
                        manifest['files'] = new_files
                        

                            
                    out_zf.writestr(name, json.dumps(manifest, ensure_ascii=False, indent=2))
                    print(f'  已更新 manifest.json -> files.tabs / files.tab')
                
                # 处理 groups.json -> tabs.json
                elif name == 'layout/groups.json':
                    new_content = process_groups(content)
                    out_zf.writestr('layout/tabs.json', new_content)
                    print(f'  已重命名并处理 layout/groups.json -> layout/tabs.json (tab-group -> tabGroup)')
                    
                # 处理 tabs.json -> tab.json
                elif name == 'layout/tabs.json':
                    out_zf.writestr('layout/tab.json', content)
                    print(f'  已重命名 layout/tabs.json -> layout/tab.json')
                
                # 处理 components.json
                elif name == 'layout/components.json':
                    new_content = process_components(content)
                    out_zf.writestr(name, new_content)
                    print(f'  已更新 components.json (兼容处理)')
                
                else:
                    out_zf.writestr(item, content)
            
    print(f'\n打包完成！')
    print(f'输出文件: {OUTPUT_SRD}')
    print(f'你可以现在使用此包({OUTPUT_SRD})进行导入测试。')

if __name__ == '__main__':
    main()
