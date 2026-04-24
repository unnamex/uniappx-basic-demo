import zipfile
import json
import os

def create_rich_list_test_srd():
    input_srd = 'final_repaired.srd'
    output_srd = 'test_rich_list_v6.srd'
    
    # 定义富文本模板
    rich_html = """
    <div style="color: #334155;">
        <h3 style="color: #0891B2; border-bottom: 2px solid #0891B2; padding-bottom: 4px;">工序详细操作要求</h3>
        <p>请严格遵守以下安装步骤：</p>
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
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">主轴定位销安装</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">15 ± 2</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">2</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px;">密封圈涂润滑油脂</td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">-</td>
                </tr>
            </tbody>
        </table>
        <p style="margin-top: 12px; color: #ef4444; font-weight: bold;">
            ⚠️ 注意：安装前必须核对活塞环开口方向。
        </p>
    </div>
    """

    with zipfile.ZipFile(input_srd, 'r') as in_zf, zipfile.ZipFile(output_srd, 'w', zipfile.ZIP_DEFLATED) as out_zf:
        # 1. 修改 layout/components.json 给工序列表增加富文本列
        components = json.loads(in_zf.read('layout/components.json').decode('utf-8'))
        for comp in components:
            if comp['id'] == 'comp_proc_list': # 工序列表
                # 增加一列富文本描述
                comp['config']['columns'].append({
                    "label": "内容说明 (富文本)",
                    "prop": "content",
                    "cellType": "richtext",
                    "width": -1
                })
            elif comp['id'] == 'comp_operation_list': # 随便把工步列表也加了，方便测试
                comp['config']['columns'].append({
                    "label": "内容说明 (富文本)",
                    "prop": "content",
                    "cellType": "richtext",
                    "width": -1
                })
            # 顺便给工艺树也留着富文本，全面测试
            elif comp['id'] == 'comp_process_tree':
                comp['config']['columns'].append({
                    "label": "内容说明 (富文本)",
                    "prop": "content",
                    "cellType": "richtext",
                    "width": 120
                })

        out_zf.writestr('layout/components.json', json.dumps(components, ensure_ascii=False, indent=2).encode('utf-8'))

        # 2. 修改 data/process_tree.json 在节点中注入富文本
        tree_data = json.loads(in_zf.read('data/process_tree.json').decode('utf-8'))
        
        def inject_rich_text(nodes):
            for node in nodes:
                # 给每个节点注入富文本内容
                node['content'] = rich_html
                if 'children' in node and node['children']:
                    inject_rich_text(node['children'])
        
        inject_rich_text(tree_data)
        out_zf.writestr('data/process_tree.json', json.dumps(tree_data, ensure_ascii=False, indent=2).encode('utf-8'))

        # 3. 复制其余所有文件
        for file in in_zf.namelist():
            if file not in ['layout/components.json', 'data/process_tree.json']:
                out_zf.writestr(file, in_zf.read(file))
                
    print(f"成功生成带富文本的测试数据包: {output_srd}")

if __name__ == "__main__":
    create_rich_list_test_srd()
