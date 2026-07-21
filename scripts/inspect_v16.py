"""检查 V16 SRD 包中所有 table 类型组件的 fields，找出 richText 列"""
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

with open('../V8发动机装配工艺_V16_encrypted.srd', 'rb') as f:
    encrypted = f.read()

zip_data = decrypt_data(encrypted)

with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
    # 查看 components.json 中所有 table 类型组件
    comps_content = zin.read('layout/components.json').decode('utf-8')
    comps = json.loads(comps_content)
    
    print("=== 所有 table 类型组件的 fields 配置 ===\n")
    for comp in comps:
        if comp.get('type') == 'table':
            print(f"--- 组件: {comp['id']} (标题: {comp['title']}) ---")
            config = comp.get('config', {})
            fields = config.get('fields', [])
            
            # 检查列表的 richTextDisplayMode 和 richTextInlineHeight
            print(f"  richTextDisplayMode: {config.get('richTextDisplayMode', '未设置')}")
            print(f"  richTextInlineHeight: {config.get('richTextInlineHeight', '未设置')}")
            
            for field in fields:
                field_type = field.get('type', '普通文本')
                width = field.get('width', '未设置')
                minWidth = field.get('minWidth', '未设置')
                print(f"  列: {field.get('label', '?')} - prop={field.get('prop', '?')}, type={field_type}, width={width}, minWidth={minWidth}")
            print()
    
    print("\n=== 所有 richText 类型的组件 ===\n")
    for comp in comps:
        if comp.get('type') == 'richText':
            print(f"  组件: {comp['id']} (标题: {comp['title']})")
            print(f"  tab_id: {comp.get('tab_id')}")
            print(f"  config: {json.dumps(comp.get('config', {}), ensure_ascii=False)}")
            print()

    # 也检查所有 collapse 类型
    print("\n=== 所有 collapse 或 tableTree 类型的组件 ===\n")
    for comp in comps:
        if comp.get('type') in ('collapse', 'tableTree'):
            print(f"  组件: {comp['id']} (type={comp['type']}, 标题: {comp['title']})")
            config = comp.get('config', {})
            fields = config.get('fields', [])
            for field in fields:
                field_type = field.get('type', '普通文本')
                width = field.get('width', '未设置')
                print(f"    列: {field.get('label', '?')} - type={field_type}, width={width}, minWidth={field.get('minWidth', '未设置')}")
            print()

    # 查看 process_tree.json 中节点的 tabs 配置 
    tree_content = zin.read('data/process_tree.json').decode('utf-8')
    tree = json.loads(tree_content)
    print("\n=== 工艺树节点结构 ===")
    for proc in tree:
        print(f"\n工艺: {proc['name']} (id={proc['innerId']})")
        print(f"  tabs_top: {proc.get('tabs_top')}")
        print(f"  tabs_bottom: {proc.get('tabs_bottom')}")
        for op in proc.get('children', []):
            print(f"  工序: {op['name']} (id={op['innerId']})")
            print(f"    tabs_top: {op.get('tabs_top')}")
            print(f"    tabs_bottom: {op.get('tabs_bottom')}")
            for step in op.get('children', []):
                print(f"    工步: {step['name']} (id={step['innerId']})")
                print(f"      tabs_top: {step.get('tabs_top')}")
                print(f"      tabs_bottom: {step.get('tabs_bottom')}")
