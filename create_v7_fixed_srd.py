import zipfile
import json
import os
import sys

# 强制使用 UTF-8 输出
sys.stdout.reconfigure(encoding='utf-8')

INPUT_SRD = 'test_v7_refactored.srd'
OUTPUT_SRD = 'test_v7_tree_fixed.srd'

def main():
    if not os.path.exists(INPUT_SRD):
        print(f'错误：找不到输入文件 {INPUT_SRD}')
        return
    
    print(f'正在基于 {INPUT_SRD} 生成修正了 tableTree 的包...')
    
    with zipfile.ZipFile(INPUT_SRD, 'r') as in_zf:
        with zipfile.ZipFile(OUTPUT_SRD, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            for item in in_zf.infolist():
                name = item.filename
                content = in_zf.read(name)
                
                if name == 'manifest.json':
                    manifest = json.loads(content.decode('utf-8'))
                    manifest['version'] = '5.3'  # 标记为5.3
                    manifest['name'] = manifest.get('name', 'V8工艺包') + ' (修复树组件)'
                    out_zf.writestr(name, json.dumps(manifest, ensure_ascii=False, indent=2))
                    print(f'  已更新 manifest.json (v5.3)')
                
                elif name == 'layout/components.json':
                    components = json.loads(content.decode('utf-8'))
                    for comp in components:
                        # process-tree → tableTree
                        if comp.get('type') == 'process-tree':
                            comp['type'] = 'tableTree'
                            print(f'  转换组件类型: {comp.get("id")} process-tree → tableTree')
                        # key-value → infoView
                        elif comp.get('type') == 'key-value':
                            comp['type'] = 'infoView'
                            print(f'  转换组件类型: {comp.get("id")} key-value → infoView')
                            config = comp.get('config', {})
                            if isinstance(config, dict) and 'fields' in config:
                                for f in config['fields']:
                                    if 'key' in f:
                                        f['vModel'] = f.pop('key')
                                if 'columns' not in config:
                                    config['columns'] = 2
                    out_zf.writestr(name, json.dumps(components, ensure_ascii=False, indent=2))
                else:
                    out_zf.writestr(item, content)
            
    print(f'\n打包完成！')
    print(f'输出文件: {OUTPUT_SRD}')
    print(f'你可以现在使用此包({OUTPUT_SRD})进行导入测试。')

if __name__ == '__main__':
    main()
