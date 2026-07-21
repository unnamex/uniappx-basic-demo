"""
基于 V14 SRD 包，生成 V16 版本：
  - 为部分工序节点添加 exclude_tab 字段，演示节点级 Tab 黑名单过滤功能
  - 缸体组装 (op01)：不排除任何 Tab（全量展示：概览、装入件清单、工具清单、拧紧记录、检验项目）
  - 缸盖组装 (op02)：排除"拧紧记录"Tab
  - 附件安装 (op03)：排除"拧紧记录"和"检验项目"Tab
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

# 定义各节点的 exclude_tab 规则
EXCLUDE_RULES = {
    # 缸体组装：全量展示，不排除任何 Tab
    # "proc_v8_engine_op01": [],

    # 缸盖组装：排除"拧紧记录"
    "proc_v8_engine_op02": ["tab_bottom_op_torque"],

    # 附件安装：排除"拧紧记录"和"检验项目"
    "proc_v8_engine_op03": ["tab_bottom_op_torque", "tab_bottom_op_inspect"],
}

def apply_exclude_tab(node, depth=0):
    """递归遍历工艺树节点，为匹配的节点添加 exclude_tab 字段"""
    node_id = node.get('innerId', '')
    node_name = node.get('name', '')

    if node_id in EXCLUDE_RULES:
        exclude_list = EXCLUDE_RULES[node_id]
        node['exclude_tab'] = exclude_list
        indent = "  " * depth
        print(f"{indent}✓ {node_name} (id={node_id}): exclude_tab = {exclude_list}")

    for child in node.get('children', []):
        apply_exclude_tab(child, depth + 1)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, 'V8发动机装配工艺_V14_encrypted.srd')
    out_path = os.path.join(project_root, 'V8发动机装配工艺_V16_encrypted.srd')

    print(f"读取并解密 {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)

    out_zip_io = io.BytesIO()
    written = set()
    modified_nodes = 0

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, \
         zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            content = zin.read(item.filename)

            # 更新 manifest.json 版本号
            if item.filename.endswith('manifest.json'):
                data = json.loads(content.decode('utf-8'))
                data['version'] = '16.0'
                data['description'] = 'V16: 新增 exclude_tab 节点级 Tab 黑名单过滤功能'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ manifest.json 版本号更新为 16.0")

            # 修改 process_tree.json，为指定节点添加 exclude_tab
            elif item.filename.endswith('process_tree.json'):
                data = json.loads(content.decode('utf-8'))
                print("\n  处理 process_tree.json ...")
                for node in data:
                    apply_exclude_tab(node, depth=1)
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

            zout.writestr(item, content)

    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)

    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted):,} bytes")
    print(f"\n📋 exclude_tab 测试说明:")
    print(f"   缸体组装 (op01): 无排除 → 下方应显示全部5个Tab（概览、装入件清单、工具清单、拧紧记录、检验项目）")
    print(f"   缸盖组装 (op02): 排除拧紧记录 → 下方应显示4个Tab（概览、装入件清单、工具清单、检验项目）")
    print(f"   附件安装 (op03): 排除拧紧记录+检验项目 → 下方应显示3个Tab（概览、装入件清单、工具清单）")

if __name__ == '__main__':
    main()
