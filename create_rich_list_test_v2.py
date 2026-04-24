import zipfile
import json
import os

def create_rich_list_full_v2():
    input_srd = 'final_repaired.srd'
    output_srd = 'test_rich_full_v6.srd'
    
    # 统一的富文本模板
    rich_html = """
    <div style="color: #334155;">
        <h3 style="color: #0891B2; border-bottom: 2px solid #0891B2; padding-bottom: 4px;">全量注入 - 操作要求</h3>
        <p>此内容已同步注入到数据库 tables 和 process_tree 中，用于测试鸿蒙端数据一致性。</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">项次</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">操作内容</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px;">力矩 (N·m)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">1</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">检测点 A</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">10.5</td>
                </tr>
            </tbody>
        </table>
        <p style="margin-top: 12px; color: #ef4444; font-weight: bold;">
            已验证：由 handleRowClick 从数据表查询加载。
        </p>
    </div>
    """

    with zipfile.ZipFile(input_srd, 'r') as in_zf, zipfile.ZipFile(output_srd, 'w', zipfile.ZIP_DEFLATED) as out_zf:
        # 1. 确保 UI 列配置正确
        components = json.loads(in_zf.read('layout/components.json').decode('utf-8'))
        for comp in components:
            if comp['id'] in ['comp_proc_list', 'comp_operation_list', 'comp_process_tree']:
                if not any(c.get('prop') == 'content' for c in comp['config']['columns']):
                    comp['config']['columns'].append({
                        "label": "内容说明 (富文本)", "prop": "content", "cellType": "richtext", "width": -1
                    })
        out_zf.writestr('layout/components.json', json.dumps(components, ensure_ascii=False, indent=2).encode('utf-8'))

        # 2. 全量注入到数据表文件
        target_files = ['data/operation.json', 'data/step.json', 'data/process_tree.json', 'data/process.json']
        
        def inject_deep(obj):
            if isinstance(obj, list):
                for item in obj: inject_deep(item)
            elif isinstance(obj, dict):
                obj['content'] = rich_html
                for key in obj:
                    if isinstance(obj[key], (list, dict)):
                        inject_deep(obj[key])

        for path in target_files:
            try:
                data = json.loads(in_zf.read(path).decode('utf-8'))
                inject_deep(data)
                out_zf.writestr(path, json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
            except KeyError:
                print(f"跳过不存在的文件: {path}")

        # 3. 复制其余文件
        processed = set(target_files) | {'layout/components.json'}
        for file in in_zf.namelist():
            if file not in processed:
                out_zf.writestr(file, in_zf.read(file))
                
    print(f"成功生成全量注入富文本的数据包: {output_srd}")

if __name__ == "__main__":
    create_rich_list_full_v2()
