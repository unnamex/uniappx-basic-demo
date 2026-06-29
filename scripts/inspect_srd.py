"""查看当前 nolist SRD 包的 tabs 和 tab 结构"""
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

with open('../V8发动机装配工艺_nolist_encrypted.srd', 'rb') as f:
    encrypted = f.read()

zip_data = decrypt_data(encrypted)

with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
    tabs_content = zin.read('layout/tabs.json').decode('utf-8')
    tabs = json.loads(tabs_content)
    print("=== layout/tabs.json ===")
    print(json.dumps(tabs, indent=2, ensure_ascii=False))
    
    tab_content = zin.read('layout/tab.json').decode('utf-8')
    tab = json.loads(tab_content)
    print("\n=== layout/tab.json ===")
    print(json.dumps(tab, indent=2, ensure_ascii=False))
    
    # 查看工艺树中所有工序节点的 tabs_top 指向
    tree_content = zin.read('data/process_tree.json').decode('utf-8')
    tree = json.loads(tree_content)
    print("\n=== 工序节点的 tabs 绑定 ===")
    for proc in tree:
        for op in proc.get('children', []):
            print(f"  {op['innerId']}: tabs_top={op.get('tabs_top')} tabs_bottom={op.get('tabs_bottom')}")
            for step in op.get('children', []):
                print(f"    {step['innerId']}: tabs_top={step.get('tabs_top')} tabs_bottom={step.get('tabs_bottom')}")
    
    # 完整 step.json
    step_content = zin.read('data/step.json').decode('utf-8')
    steps = json.loads(step_content)
    print(f"\n=== data/step.json ({len(steps)} steps) ===")
    for s in steps:
        print(f"  {s.get('innerId')}: {s.get('code')} - {s.get('name')} (opId={s.get('operationId')})")
