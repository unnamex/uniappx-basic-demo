"""
生成 V5.2 规范的 .srd 数据包
核心特性：富文本内容按需加载 (Decoupled Rich Text)

1. 从工艺树中提取 description_html 到 data/descriptions.json
2. 更新 manifest.json 版本为 5.2，并添加 descriptions 映射
3. 保留 V5.0 的附件解耦逻辑
"""

import zipfile
import json
import os
import sys

# 强制使用 UTF-8 输出
sys.stdout.reconfigure(encoding='utf-8')

INPUT_SRD = 'test_v4_richer.srd'
OUTPUT_SRD = 'test_v52_lazy_rich.srd'
PROCESS_TREE_FILE = 'process_tree.json'

# 富文本字段集合 (V5.2 会从工艺树中剥离这些字段)
RICH_TEXT_FIELDS = {'description_html', 'safety_notice', 'technical_requirement'}

# 废弃字段集合 (旧版清理逻辑，但在 V52 测试中建议保留基础信息以便 infoView 成功渲染)
KEEP_METADATA = True # 为了确保 infoView 有数据，设置为 True

def extract_content(node, attachments_list, descriptions_list):
    """递归提取附件和富文本描述"""
    node_id = node.get('innerId', '')
    
    # 逻辑 1: 提取附件 (V5 逻辑)
    if 'attachment' in node:
        for att in node['attachment']:
            att['nodeId'] = node_id
            attachments_list.append(att)
        del node['attachment']
    
    if 'resources' in node:
        for res in node['resources']:
            res['nodeId'] = node_id
            attachments_list.append(res)
        del node['resources']
        
    # 逻辑 2: 提取富文本内容 (V5.2 逻辑)
    node_content = {"nodeId": node_id}
    has_rich_content = False
    
    for field in RICH_TEXT_FIELDS:
        if field in node:
            node_content[field] = node[field]
            # 只有在确认为重型 HTML 时才从树中删除
            del node[field]
            has_rich_content = True
            
    if has_rich_content:
        descriptions_list.append(node_content)
            
    # 逻辑 3: 清理废弃字段 (V5.2 中我们不再主动删除这些字段，除非它们确实没用了)
    # 为了保证 infoView 正常，这里不做主动删除
    
    # 递归子节点
    for child in node.get('children', []):
        extract_content(child, attachments_list, descriptions_list)

def main():
    if not os.path.exists(INPUT_SRD):
        print(f'错误：找不到输入文件 {INPUT_SRD}')
        return
    
    if not os.path.exists(PROCESS_TREE_FILE):
        print(f'错误：找不到工艺树文件 {PROCESS_TREE_FILE}')
        return
    
    print(f'正在生成 V5.2 测试包...')
    
    # 读取工艺树
    with open(PROCESS_TREE_FILE, 'r', encoding='utf-8') as f:
        process_tree = json.load(f)
        
    flat_attachments = []
    flat_descriptions = []
    
    # 执行解耦提取
    extract_content(process_tree, flat_attachments, flat_descriptions)
    
    print(f'  工艺树: {process_tree.get("name")}')
    print(f'  提取附件: {len(flat_attachments)} 项')
    print(f'  提取富文本描述: {len(flat_descriptions)} 处')
    
    with zipfile.ZipFile(INPUT_SRD, 'r') as in_zf:
        with zipfile.ZipFile(OUTPUT_SRD, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            for item in in_zf.infolist():
                name = item.filename
                
                # 跳过会被重写的文件
                if name in ['data/process_tree.json', 'data/attachment.json', 'data/descriptions.json']:
                    continue
                
                content = in_zf.read(name)
                
                if name == 'manifest.json':
                    manifest = json.loads(content.decode('utf-8'))
                    manifest['version'] = '5.2'
                    manifest['name'] = 'V8发动机总装工艺包 (V5.2-富文本解耦版)'
                    manifest['description'] = 'V5.2 测试包：已将 description_html 提取至 descriptions.json，支持异步按需加载。'
                    
                    if 'files' not in manifest:
                        manifest['files'] = {}
                    
                    manifest['files']['attachment'] = 'data/attachment.json'
                    manifest['files']['descriptions'] = 'data/descriptions.json'
                    
                    out_zf.writestr(name, json.dumps(manifest, ensure_ascii=False, indent=2))
                    print(f'  已更新 manifest.json (v5.2)')
                
                elif name == 'layout/components.json':
                    # 将 key-value 转换为 infoView，适配最新的 UI 开发逻辑
                    components = json.loads(content.decode('utf-8'))
                    for comp in components:
                        if comp.get('type') == 'key-value':
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
            
            # 写入解耦后的数据文件
            out_zf.writestr('data/process_tree.json', json.dumps(process_tree, ensure_ascii=False, indent=2))
            out_zf.writestr('data/attachment.json', json.dumps(flat_attachments, ensure_ascii=False, indent=2))
            out_zf.writestr('data/descriptions.json', json.dumps(flat_descriptions, ensure_ascii=False, indent=2))
            
    print(f'\n打包完成！')
    print(f'输出文件: {OUTPUT_SRD}')
    print(f'你可以现在使用此包进行导入测试。')

if __name__ == '__main__':
    main()
