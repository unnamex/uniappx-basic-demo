"""
基于 V17 SRD 包，生成 V18 多表格测试版本：
  - 在工序节点的 bottom 区域新增一个"质量记录"tab
  - 该 tab 下包含 3 个 table 组件（制造流程表单、工艺时间表、质量控制记录表）
  - 添加对应的 node_datasets 测试数据
  - 用于验证多组件卡片化 UI 布局优化效果
"""

import os
import io
import json
import zipfile
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

KEY = b'MPM_OFFLINE_2026_SECURE_KEY_256B'

def decrypt_data(data):
    iv = data[:16]
    ciphertext = data[16:]
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    padding_len = padded_plaintext[-1]
    return padded_plaintext[:-padding_len]

def encrypt_data(plaintext):
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padding_len = 16 - (len(plaintext) % 16)
    padded_plaintext = plaintext + bytes([padding_len] * padding_len)
    ciphertext = encryptor.update(padded_plaintext) + encryptor.finalize()
    return iv + ciphertext

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, 'V8发动机装配工艺_V17_encrypted.srd')
    out_path = os.path.join(project_root, 'V8发动机装配工艺_V18_multi_table_test.srd')

    print(f"读取并解密 {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)

    # 先读取现有数据了解结构
    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
        # 读取现有 tabs(groups)
        tabs_groups = json.loads(zin.read('layout/tabs.json').decode('utf-8'))
        # 读取现有 tab
        tabs = json.loads(zin.read('layout/tab.json').decode('utf-8'))
        # 读取现有 components
        components = json.loads(zin.read('layout/components.json').decode('utf-8'))
        # 读取 node_datasets
        try:
            node_datasets = json.loads(zin.read('data/node_datasets.json').decode('utf-8'))
        except:
            node_datasets = []
        # 读取 process_tree 获取节点ID
        process_tree = json.loads(zin.read('data/process_tree.json').decode('utf-8'))
        # 读取工序数据获取 inner_id
        operations = json.loads(zin.read('data/operation.json').decode('utf-8'))

    # 打印现有 tabs_bottom 的 group IDs
    bottom_group_ids = set()
    for g in tabs_groups:
        if 'bottom' in g['id'].lower() or 'bottom' in g.get('description', '').lower():
            bottom_group_ids.add(g['id'])
            print(f"  发现 bottom group: {g['id']} ({g['name']})")

    # 找到工序节点的 bottom group ID
    op_bottom_group = None
    for proc in process_tree:
        for op in proc.get('children', []):
            tb = op.get('tabs_bottom', '')
            if tb:
                op_bottom_group = tb
                break
        if op_bottom_group:
            break
    print(f"  工序节点 bottom group: {op_bottom_group}")

    # 查看该 group 下现有的 tab 数量
    existing_tabs_in_group = [t for t in tabs if t['group_id'] == op_bottom_group]
    print(f"  该 group 下已有 {len(existing_tabs_in_group)} 个 tab:")
    for t in existing_tabs_in_group:
        print(f"    - {t['id']}: {t['title']}")

    max_sort = max([t['sort_order'] for t in existing_tabs_in_group]) if existing_tabs_in_group else 0

    # === 新增"质量记录"Tab ===
    new_tab = {
        "id": "tab_bottom_op_quality",
        "group_id": op_bottom_group,
        "title": "质量记录",
        "sort_order": max_sort + 1,
        "visible_condition": None
    }
    tabs.append(new_tab)
    print(f"\n  ✓ 新增 Tab: {new_tab['title']} (sort_order={new_tab['sort_order']})")

    # === 新增 3 个 Table 组件（隶属于质量记录 Tab）===
    new_components = [
        {
            "id": "comp_quality_mfg_flow",
            "tab_id": "tab_bottom_op_quality",
            "type": "table",
            "title": "制造流程表单(互检)",
            "sort_order": 0,
            "config": {
                "dataSource": {"type": "dataset", "dataKey": "mfg_flow_check"},
                "fields": [
                    {"label": "易错因素", "prop": "error_factor", "width": -1},
                    {"label": "易错环节", "prop": "error_stage", "width": -1},
                    {"label": "记录内容", "prop": "record_content", "width": -1}
                ]
            }
        },
        {
            "id": "comp_quality_process_time",
            "tab_id": "tab_bottom_op_quality",
            "type": "table",
            "title": "工艺时间表(自检)",
            "sort_order": 1,
            "config": {
                "dataSource": {"type": "dataset", "dataKey": "process_time"},
                "fields": [
                    {"label": "干燥方法", "prop": "dry_method", "width": 140},
                    {"label": "收缩率%", "prop": "shrink_rate", "width": 100},
                    {"label": "附件", "prop": "attachment", "width": -1},
                    {"label": "质控卡唯一标识", "prop": "qc_card_id", "width": 160}
                ]
            }
        },
        {
            "id": "comp_quality_control_record",
            "tab_id": "tab_bottom_op_quality",
            "type": "table",
            "title": "质量控制记录表(互检)",
            "sort_order": 2,
            "config": {
                "dataSource": {"type": "dataset", "dataKey": "quality_control_record"},
                "fields": [
                    {"label": "涂料", "prop": "coating", "width": 100},
                    {"label": "活块数", "prop": "block_count", "width": 80},
                    {"label": "使用部件", "prop": "part_used", "width": 120},
                    {"label": "关联型号", "prop": "related_model", "width": 120},
                    {"label": "分类", "prop": "category", "width": 80},
                    {"label": "使用期限", "prop": "expire_date", "width": 100},
                    {"label": "工序号", "prop": "op_number", "width": 80},
                    {"label": "处理意见", "prop": "opinion", "width": -1}
                ]
            }
        }
    ]
    components.extend(new_components)
    print(f"  ✓ 新增 3 个 Table 组件:")
    for c in new_components:
        print(f"    - {c['id']}: {c['title']}")

    # === 为每个工序节点添加对应的 node_datasets 测试数据 ===
    # 收集所有工序节点的 innerId
    op_inner_ids = []
    for proc in process_tree:
        for op in proc.get('children', []):
            inner_id = op.get('innerId', '')
            if inner_id:
                op_inner_ids.append(inner_id)

    print(f"\n  发现 {len(op_inner_ids)} 个工序节点，为每个节点添加测试数据集...")

    ds_counter = len(node_datasets)
    for op_id in op_inner_ids:
        # 制造流程表单数据
        node_datasets.append({
            "id": f"ds_mfg_flow_{op_id}",
            "nodeInnerId": op_id,
            "dataKey": "mfg_flow_check",
            "sortOrder": 0,
            "rows": [
                {"error_factor": "装配扭矩偏差", "error_stage": "螺栓预紧阶段", "record_content": "使用扭矩扳手复核，偏差≤±5%"},
                {"error_factor": "密封面损伤", "error_stage": "密封圈安装", "record_content": "目视检查无划痕，涂抹密封脂"},
                {"error_factor": "零件混装", "error_stage": "物料配送环节", "record_content": "核对BOM清单与实物标签一致"}
            ]
        })
        # 工艺时间表数据
        node_datasets.append({
            "id": f"ds_proc_time_{op_id}",
            "nodeInnerId": op_id,
            "dataKey": "process_time",
            "sortOrder": 1,
            "rows": [
                {"dry_method": "自然晾干", "shrink_rate": "0.12", "attachment": "", "qc_card_id": f"QC-{op_id[:6]}-001"},
                {"dry_method": "烘箱80℃/2h", "shrink_rate": "0.08", "attachment": "", "qc_card_id": f"QC-{op_id[:6]}-002"}
            ]
        })
        # 质量控制记录表数据
        node_datasets.append({
            "id": f"ds_qc_record_{op_id}",
            "nodeInnerId": op_id,
            "dataKey": "quality_control_record",
            "sortOrder": 2,
            "rows": [
                {"coating": "环氧底漆", "block_count": "4", "part_used": "缸体总成", "related_model": "V8-2026A", "category": "A类", "expire_date": "2027-12-31", "op_number": "OP-10", "opinion": "合格，按标准执行"},
                {"coating": "聚氨酯面漆", "block_count": "2", "part_used": "缸盖罩", "related_model": "V8-2026A", "category": "B类", "expire_date": "2028-06-30", "op_number": "OP-20", "opinion": "合格"},
                {"coating": "防锈油", "block_count": "6", "part_used": "曲轴组件", "related_model": "V8-2026B", "category": "A类", "expire_date": "2027-09-15", "op_number": "OP-30", "opinion": "需返工重涂"}
            ]
        })
        ds_counter += 3

    print(f"  ✓ 总共添加了 {ds_counter - len(node_datasets) + len(op_inner_ids) * 3} 条数据集记录")

    # === 重新打包 ===
    out_zip_io = io.BytesIO()
    written = set()

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, \
         zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            content = zin.read(item.filename)

            # 更新 manifest.json
            if item.filename.endswith('manifest.json'):
                data = json.loads(content.decode('utf-8'))
                data['version'] = '18.0'
                data['description'] = 'V18: 多Tab多Table组件测试版（含质量记录3表格）'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("\n  ✓ manifest.json 版本号更新为 18.0")

            # 替换 tabs.json（保持不变，group已有）
            elif item.filename.endswith('tabs.json') and 'layout' in item.filename:
                content = json.dumps(tabs_groups, ensure_ascii=False, indent=2).encode('utf-8')

            # 替换 tab.json
            elif item.filename.endswith('tab.json') and 'layout' in item.filename:
                content = json.dumps(tabs, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ tab.json 已更新（新增质量记录tab）")

            # 替换 components.json
            elif item.filename.endswith('components.json') and 'layout' in item.filename:
                content = json.dumps(components, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ components.json 已更新（新增3个table组件）")

            # 替换 node_datasets.json
            elif item.filename.endswith('node_datasets.json'):
                content = json.dumps(node_datasets, ensure_ascii=False, indent=2).encode('utf-8')
                print(f"  ✓ node_datasets.json 已更新（共 {len(node_datasets)} 条记录）")

            zout.writestr(item, content)

    # 加密输出
    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)

    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted):,} bytes")
    print(f"\n测试说明：")
    print(f"   导入该 SRD 包后，选择任意工序节点，下方会出现【质量记录】Tab")
    print(f"   该 Tab 下包含 3 个表格组件，用于验证卡片化 UI 布局效果：")
    print(f"   1. 制造流程表单(互检) - 3列")
    print(f"   2. 工艺时间表(自检) - 4列")
    print(f"   3. 质量控制记录表(互检) - 8列")

if __name__ == '__main__':
    main()
