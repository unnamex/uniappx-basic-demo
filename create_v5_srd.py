"""
生成新的 V4+ .srd 数据包
基于已有 test_v4_richer.srd 的 UI 配置和资源文件，
使用更新后的 process_tree.json（附件字段重构版）

- resources → attachment
- 移除已删除字段的 UI 组件引用（tools/materials/safetyNotes/safetyChecks/checklist/notes/duration）
- 保留 qualityChecks / processDescription
"""

import zipfile
import json
import os
import sys

# 强制使用 UTF-8 输出
sys.stdout.reconfigure(encoding='utf-8')

INPUT_SRD = 'test_v4_richer.srd'
OUTPUT_SRD = 'test_v5_attachment.srd'
PROCESS_TREE_FILE = 'process_tree.json'

# 需要从 UI 配置中移除的组件（引用了已删除字段）
REMOVED_COMPONENT_IDS = {
    'comp_step_tools',           # dataSource: tools
    'comp_step_materials',       # dataSource: materials
    'comp_bottom_op_tools',      # dataSource: tools
    'comp_bottom_op_materials',  # dataSource: materials
    'comp_bottom_op_safety',     # dataSource: safetyNotes
    'comp_bottom_op_safety_items', # dataSource: safetyChecks
    'comp_bottom_step_checklist_items', # dataSource: checklist
    'comp_bottom_step_notes',    # dataSource: notes
}

# 需要移除的 Tab（其下组件已全部移除）
REMOVED_TAB_IDS = {
    'tab_bottom_op_tools',       # 工具/材料（工序底部）
    'tab_bottom_op_safety',      # 安全规范（工序底部）
    'tab_bottom_step_tools',     # 工具/材料（工步底部）
    'tab_bottom_step_checklist', # 检查清单（工步底部）
}

# 需要从 key-value 组件的 fields 中移除的字段
REMOVED_FIELDS = {'duration'}

def clean_components(components):
    """清理组件列表：移除引用已删字段的组件，清理 fields 中的 duration"""
    cleaned = []
    for comp in components:
        comp_id = comp.get('id', '')
        
        # 跳过已移除的组件
        if comp_id in REMOVED_COMPONENT_IDS:
            print(f'  移除组件: {comp_id}')
            continue
        
        # 清理 key-value 组件中的 duration 字段
        config = comp.get('config', {})
        if isinstance(config, dict) and 'fields' in config:
            fields = config['fields']
            if isinstance(fields, list):
                original_len = len(fields)
                config['fields'] = [f for f in fields if f.get('key') not in REMOVED_FIELDS]
                if len(config['fields']) < original_len:
                    print(f'  清理组件 {comp_id} 中的 duration 字段')
        
        # 清理 table 组件 columns 中的 duration 列
        if isinstance(config, dict) and 'columns' in config:
            columns = config['columns']
            if isinstance(columns, list):
                original_len = len(columns)
                config['columns'] = [c for c in columns if c.get('prop') not in REMOVED_FIELDS]
                if len(config['columns']) < original_len:
                    print(f'  清理组件 {comp_id} 中的 duration 列')
        
        cleaned.append(comp)
    
    return cleaned


def clean_tabs(tabs):
    """清理 Tab 列表：移除不再需要的 Tab"""
    cleaned = []
    for tab in tabs:
        tab_id = tab.get('id', '')
        if tab_id in REMOVED_TAB_IDS:
            print(f'  移除Tab: {tab_id} ({tab.get("title", "")})')
            continue
        cleaned.append(tab)
    return cleaned


def main():
    if not os.path.exists(INPUT_SRD):
        print(f'错误：找不到输入文件 {INPUT_SRD}')
        return
    
    if not os.path.exists(PROCESS_TREE_FILE):
        print(f'错误：找不到工艺树文件 {PROCESS_TREE_FILE}')
        return
    
    # 读取更新后的工艺树
    with open(PROCESS_TREE_FILE, 'r', encoding='utf-8') as f:
        process_tree = json.load(f)
    
    print(f'读取工艺树: {process_tree["name"]} ({process_tree["code"]})')
    print(f'  新增字段: classId_display={process_tree.get("classId_display")}, '
          f'modifyById_display={process_tree.get("modifyById_display")}, '
          f'secretId_display={process_tree.get("secretId_display")}, '
          f'phaseId_display={process_tree.get("phaseId_display")}, '
          f'partPhaseId_display={process_tree.get("partPhaseId_display")}')
    
    with zipfile.ZipFile(INPUT_SRD, 'r') as in_zf:
        with zipfile.ZipFile(OUTPUT_SRD, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            entries_copied = 0
            
            for item in in_zf.infolist():
                name = item.filename
                
                # 跳过旧的工艺树
                if name == 'data/process_tree.json':
                    continue
                
                content = in_zf.read(name)
                
                if name == 'manifest.json':
                    # 更新 manifest
                    manifest = json.loads(content.decode('utf-8'))
                    manifest['version'] = '5.0'
                    manifest['name'] = 'V8发动机总装工艺包（V5-附件版）'
                    manifest['description'] = '字段重构版：resources→attachment，新增元数据字段，移除冗余数据'
                    manifest['exportTime'] = '2026-04-11T11:28:00+08:00'
                    out_zf.writestr(name, json.dumps(manifest, ensure_ascii=False, indent=2))
                    print(f'更新 manifest.json (version={manifest["version"]})')
                    
                elif name == 'layout/components.json':
                    # 清理组件配置
                    components = json.loads(content.decode('utf-8'))
                    print(f'处理 components.json (原始 {len(components)} 个):')
                    components = clean_components(components)
                    print(f'  保留 {len(components)} 个组件')
                    out_zf.writestr(name, json.dumps(components, ensure_ascii=False, indent=2))
                    
                elif name == 'layout/tabs.json':
                    # 清理 Tab 配置
                    tabs = json.loads(content.decode('utf-8'))
                    print(f'处理 tabs.json (原始 {len(tabs)} 个):')
                    tabs = clean_tabs(tabs)
                    print(f'  保留 {len(tabs)} 个 Tab')
                    out_zf.writestr(name, json.dumps(tabs, ensure_ascii=False, indent=2))
                    
                else:
                    # 直接复制其他文件（资源、图标等）
                    out_zf.writestr(item, content)
                    entries_copied += 1
            
            # 写入新的工艺树
            out_zf.writestr('data/process_tree.json', 
                          json.dumps(process_tree, ensure_ascii=False, indent=2))
            print(f'\n写入新工艺树: data/process_tree.json')
            
            print(f'\n=== 打包完成 ===')
            print(f'输出文件: {OUTPUT_SRD}')
            print(f'复制文件数: {entries_copied}')
            
            # 显示包内文件列表
            print(f'\n包内文件:')
            for name in out_zf.namelist():
                info = out_zf.getinfo(name)
                size = info.compress_size
                if size > 1024 * 1024:
                    size_str = f'{size / 1024 / 1024:.1f} MB'
                elif size > 1024:
                    size_str = f'{size / 1024:.1f} KB'
                else:
                    size_str = f'{size} B'
                print(f'  {name} ({size_str})')


if __name__ == '__main__':
    main()
