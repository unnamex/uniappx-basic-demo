"""检查 V14 SRD 包中 tab.json 和 process_tree 完整内容"""
import os, io, json, zipfile
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

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, 'V8发动机装配工艺_V14_encrypted.srd')
    
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
        # tab.json
        content = json.loads(zin.read('layout/tab.json').decode('utf-8'))
        print("=== layout/tab.json ===")
        print(json.dumps(content, ensure_ascii=False, indent=2))
        
        # process_tree - 只打印节点的 innerId, name, tabs_top, tabs_bottom, type（递归）
        tree = json.loads(zin.read('data/process_tree.json').decode('utf-8'))
        print("\n=== process_tree 节点摘要 ===")
        def print_node(node, depth=0):
            indent = "  " * depth
            name = node.get('name', '')
            nid = node.get('innerId', '')
            tt = node.get('tabs_top', '')
            tb = node.get('tabs_bottom', '')
            ntype = node.get('type', node.get('targetClassId', ''))
            print(f"{indent}{name} | id={nid} | type={ntype} | tabs_top={tt} | tabs_bottom={tb}")
            for child in node.get('children', []):
                print_node(child, depth + 1)
        for node in tree:
            print_node(node)

if __name__ == '__main__':
    main()
