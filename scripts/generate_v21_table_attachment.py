"""
基于 V20 SRD，生成 V21 table附件测试版本：
  - 为 parts_list (装入件清单) 中的部分行数据添加 innerId 字段
  - 在 attachment.json 中为这些行添加对应附件（图片、文档）
  - nodeId = 行数据的 innerId，用于测试 table 行点击 → 右侧查看器联动

测试预期：
  选中左侧任意工序节点 → 点击下方「装入件清单」tab 中的某行
  → 右侧查看器切换显示该行的附件
  → 无附件的行则显示「暂无资源」
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
    in_path  = os.path.join(project_root, 'V8发动机装配工艺_V20_action_unit.srd')
    out_path = os.path.join(project_root, 'V8发动机装配工艺_V21_table_attachment.srd')

    print(f"读取并解密 {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)

    # ── 读取原始数据 ──────────────────────────────────────────────
    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
        all_files = [item.filename for item in zin.infolist()]
        attachments   = json.loads(zin.read('data/attachment.json').decode('utf-8'))
        node_datasets = json.loads(zin.read('data/node_datasets.json').decode('utf-8'))
        process_tree  = json.loads(zin.read('data/process_tree.json').decode('utf-8'))

    print(f"  原有附件数量: {len(attachments)}")
    print(f"  原有数据集数量: {len(node_datasets)}")

    # ── 找到第一个工序节点(op01)的 innerId，用于演示 ────────────────
    target_op_ids = []
    for proc in process_tree:
        for op in proc.get('children', []):
            inner_id = op.get('innerId', '')
            if inner_id:
                target_op_ids.append(inner_id)
            if len(target_op_ids) >= 2:
                break
        if len(target_op_ids) >= 2:
            break

    print(f"\n  目标工序节点: {target_op_ids}")

    # ── 为 parts_list 行添加 innerId 并生成附件 ──────────────────────
    # 定义每行的 innerId（固定，与 attachment.json 中的 nodeId 对应）
    # 规则：row_parts_{op_id}_{序号从01}
    new_attachments = []
    modified_ds_count = 0

    for ds in node_datasets:
        if ds.get('dataKey') != 'parts_list':
            continue
        op_id = ds.get('nodeInnerId', '')
        if op_id not in target_op_ids:
            continue

        rows = ds.get('rows', [])
        print(f"\n  处理 parts_list (nodeInnerId={op_id})，共 {len(rows)} 行")

        for i, row in enumerate(rows):
            row_inner_id = f"row_parts_{op_id}_{i+1:02d}"
            # 给行数据注入 innerId，供 handleTabTableRowClick 提取
            row['innerId'] = row_inner_id
            row['name'] = row.get('partName', f'零件{i+1}')   # 确保有 name 字段供标题显示

            print(f"    行{i+1}: innerId={row_inner_id}  name={row['name']}")

            # 只给前3行附加附件（其余行无附件，测试「暂无资源」状态）
            if i == 0:
                # 第1行：附一张图片
                new_attachments.append({
                    "id": f"att_{row_inner_id}_img",
                    "type": "image",
                    "name": f"{row['name']} 装配示意图",
                    "path": "assets/images/缸体总成.png",
                    "description": f"{row['name']} 的装配示意图",
                    "nodeId": row_inner_id,
                    "sortOrder": 0
                })
                print(f"      → 添加图片附件")
            elif i == 1:
                # 第2行：附一个文档
                new_attachments.append({
                    "id": f"att_{row_inner_id}_doc",
                    "type": "document",
                    "name": f"{row['name']} 技术规范",
                    "path": "assets/documents/test_doc.docx",
                    "description": f"{row['name']} 技术规范文档",
                    "nodeId": row_inner_id,
                    "sortOrder": 0
                })
                print(f"      → 添加文档附件")
            elif i == 2:
                # 第3行：附一张图片 + 一个PDF
                new_attachments.append({
                    "id": f"att_{row_inner_id}_img",
                    "type": "image",
                    "name": f"{row['name']} 图纸",
                    "path": "assets/images/缸体总成.png",
                    "description": f"{row['name']} 图纸",
                    "nodeId": row_inner_id,
                    "sortOrder": 0
                })
                new_attachments.append({
                    "id": f"att_{row_inner_id}_pdf",
                    "type": "document",
                    "name": f"{row['name']} 检验报告",
                    "path": "assets/documents/测试文档（公开）.pdf",
                    "description": f"{row['name']} 检验报告PDF",
                    "nodeId": row_inner_id,
                    "sortOrder": 1
                })
                print(f"      → 添加图片+PDF共2个附件")
            else:
                print(f"      → 无附件（测试暂无资源状态）")

        modified_ds_count += 1

    # 合并附件列表
    attachments.extend(new_attachments)
    print(f"\n  新增附件: {len(new_attachments)} 条")
    print(f"  附件总数: {len(attachments)} 条")

    # ── 重新打包 ─────────────────────────────────────────────────
    out_zip_io = io.BytesIO()
    written = set()

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, \
         zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            content = zin.read(item.filename)

            if item.filename == 'manifest.json':
                data = json.loads(content.decode('utf-8'))
                data['version'] = '21.0'
                data['description'] = 'V21: table行附件联动测试版 - 装入件清单行含附件'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("\n  ✓ manifest.json → v21.0")

            elif item.filename == 'data/attachment.json':
                content = json.dumps(attachments, ensure_ascii=False, indent=2).encode('utf-8')
                print(f"  ✓ attachment.json → {len(attachments)} 条")

            elif item.filename == 'data/node_datasets.json':
                content = json.dumps(node_datasets, ensure_ascii=False, indent=2).encode('utf-8')
                print(f"  ✓ node_datasets.json → parts_list行已注入innerId")

            zout.writestr(item, content)

    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)

    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted):,} bytes")
    print(f"""
测试说明：
  1. 导入该 SRD 包
  2. 在左侧工艺树中选择「缸体组装」工序节点（或其他工序节点）
  3. 点击下方 Tab → 切换到「装入件清单」Tab
  4. 点击第1行（V8铝合金铸造）→ 右侧查看器显示「装配示意图」图片
  5. 点击第2行（Φ92mm锻造铝合金）→ 右侧查看器显示「技术规范」文档
  6. 点击第3行（3环组）→ 右侧查看器显示「图纸」+「检验报告」2个附件
  7. 点击第4行及之后 → 右侧查看器显示「暂无资源」（无附件）
    """)

if __name__ == '__main__':
    main()
