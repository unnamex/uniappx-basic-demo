import os
import sys
import json
import io
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
    base_dir = r"f:\workProject\avpbc-pop"
    in_path = os.path.join(base_dir, "V8发动机装配工艺_V18_multi_table_test.srd")
    out_path = os.path.join(base_dir, "V8发动机装配工艺_V20_action_unit.srd")

    if not os.path.exists(in_path):
        print(f"Error: {in_path} not found")
        sys.exit(1)

    print(f"Reading {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()

    zip_data = decrypt_data(encrypted_data)
    
    tabs_groups = []
    tabs = []
    components = []
    process_tree = []
    
    # 1. Parse existing data
    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as z:
        for item in z.infolist():
            if item.filename.endswith('tabs.json') and 'layout' in item.filename:
                tabs_groups = json.loads(z.read(item).decode('utf-8'))
            elif item.filename.endswith('tab.json') and 'layout' in item.filename:
                tabs = json.loads(z.read(item).decode('utf-8'))
            elif item.filename.endswith('components.json') and 'layout' in item.filename:
                components = json.loads(z.read(item).decode('utf-8'))
            elif item.filename.endswith('process_tree.json'):
                process_tree = json.loads(z.read(item).decode('utf-8'))

    # 2. Add Groups & Tabs & Components for ActionUnit (similar to v19 but v20)
    tabs_groups.extend([
        {
            "id": "group_action_view",
            "name": "动作概览",
            "type": "tabGroup",
            "description": "动作节点上方视图",
            "sort_order": 7
        },
        {
            "id": "group_bottom_action",
            "name": "动作详情",
            "type": "tabGroup",
            "description": "动作节点下方详情",
            "sort_order": 8
        }
    ])

    tabs.extend([
        {
            "id": "tab_action_overview",
            "group_id": "group_action_view",
            "title": "动作概览",
            "sort_order": 1,
            "visible_condition": None
        },
        {
            "id": "tab_bottom_action_detail",
            "group_id": "group_bottom_action",
            "title": "执行标准",
            "sort_order": 1,
            "visible_condition": None
        }
    ])

    components.extend([
        {
            "id": "comp_action_rich_text",
            "tab_id": "tab_action_overview",
            "type": "richText",
            "title": "动作说明",
            "sort_order": 1,
            "config": {}
        },
        {
            "id": "comp_action_attr",
            "tab_id": "tab_bottom_action_detail",
            "type": "infoView",
            "title": "动作属性",
            "sort_order": 1,
            "config": {
                "columns": 2,
                "fields": [
                    {"label": "动作编码", "prop": "code"},
                    {"label": "动作名称", "prop": "name"},
                    {"label": "序号", "prop": "serialNumber"}
                ]
            }
        }
    ])

    # 4. Generate action nodes and attach to process_tree
    action_counter = 1
    action_data = []
    
    def process_node(node):
        nonlocal action_counter
        # We need to rely on targetClassId for original nodes if type doesn't exist.
        # But in v18, they might have "type": "step". 
        node_type = node.get("type", "")
        tc = node.get("targetClassId", "")
        is_step = (node_type == "step") or (tc.lower() == "step")
        
        # Remove type if the user prefers purely targetClassId, but let's just leave existing nodes alone
        # except when generating action nodes.
        
        if is_step:
            actions = []
            for i in range(1, 3):
                action_id = f"{node['innerId']}_a{i:02d}"
                action_node = {
                    "innerId": action_id,
                    "code": f"{node.get('code', '')}-A{i:02d}",
                    "name": f"动作 {action_counter}",
                    "targetClassId": "ActionUnit", 
                    # NOTICE: NO "type": "action" here per user's instruction!
                    "classId": "",
                    "tabs_top": "group_action_view",
                    "tabs_bottom": "group_bottom_action",
                    "children": [],
                    "icon": "🔧",
                    "resourceCount": 0,
                    "processId": node.get("processId", ""),
                    "operationId": node.get("operationId", ""),
                    "stepId": node["innerId"],
                    "content": f"<p>这是动作 {action_counter} 的详细执行说明。</p>",
                    "serialNumber": f"{i:02d}",
                    "classId_display": "通用动作"
                }
                actions.append(action_node)
                action_data.append(action_node)
                action_counter += 1
            node["children"] = actions
        
        # Recursively process children
        for child in node.get("children", []):
            process_node(child)
            
    for root in process_tree:
        process_node(root)

    print(f"Generated {len(action_data)} action nodes.")

    # 5. Write back to ZIP
    out_zip_io = io.BytesIO()
    written = set()

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, \
         zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            if item.filename in written:
                continue
            # Skip old action.json just in case
            if item.filename.endswith('action.json'):
                continue
                
            written.add(item.filename)
            content = zin.read(item.filename)

            if item.filename.endswith('manifest.json'):
                data = json.loads(content.decode('utf-8'))
                data['version'] = '20.0'
                data['description'] = 'V20: 纯 ActionUnit.json 及无 type 字段适配版'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

            elif item.filename.endswith('tabs.json') and 'layout' in item.filename:
                content = json.dumps(tabs_groups, ensure_ascii=False, indent=2).encode('utf-8')

            elif item.filename.endswith('tab.json') and 'layout' in item.filename:
                content = json.dumps(tabs, ensure_ascii=False, indent=2).encode('utf-8')

            elif item.filename.endswith('components.json') and 'layout' in item.filename:
                content = json.dumps(components, ensure_ascii=False, indent=2).encode('utf-8')

            elif item.filename.endswith('process_tree.json'):
                content = json.dumps(process_tree, ensure_ascii=False, indent=2).encode('utf-8')

            zout.writestr(item, content)
            
        # Write actionUnit.json
        if 'data/actionUnit.json' not in written:
            zout.writestr('data/actionUnit.json', json.dumps(action_data, ensure_ascii=False, indent=2).encode('utf-8'))

    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)

    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted):,} bytes")

if __name__ == '__main__':
    main()
