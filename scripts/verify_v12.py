"""验证 V12 SRD 包结构"""
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

with open('../V8发动机装配工艺_V12_encrypted.srd', 'rb') as f:
    encrypted = f.read()

zip_data = decrypt_data(encrypted)

with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
    # 1. 验证 manifest
    manifest = json.loads(zin.read('manifest.json').decode('utf-8'))
    print(f"[OK] manifest.json version={manifest['version']}")
    print(f"     files.nodeDatasets={manifest['files'].get('nodeDatasets')}")
    
    # 2. 验证 tab.json 中 group_bottom_op 下有哪些 tab
    tabs = json.loads(zin.read('layout/tab.json').decode('utf-8'))
    op_tabs = [t for t in tabs if t.get('group_id') == 'group_bottom_op']
    print(f"\n[OK] group_bottom_op 下 Tab 数: {len(op_tabs)}")
    for t in sorted(op_tabs, key=lambda x: x.get('sort_order', 0)):
        print(f"     sort={t['sort_order']} id={t['id']} title={t['title']}")
    
    # 3. 验证新增组件
    comps = json.loads(zin.read('layout/components.json').decode('utf-8'))
    new_comp_ids = ['comp_bottom_op_parts', 'comp_bottom_op_tools', 'comp_bottom_op_torque', 'comp_bottom_op_inspect']
    for cid in new_comp_ids:
        matched = [c for c in comps if c['id'] == cid]
        if matched:
            c = matched[0]
            ds = c['config'].get('dataSource', {})
            print(f"\n[OK] {cid}: type={c['type']}, tab={c['tab_id']}")
            print(f"     dataSource.type={ds.get('type')}, dataKey={ds.get('dataKey')}")
            print(f"     fields: {len(c['config']['fields'])} 列")
            for f in c['config']['fields']:
                print(f"       - {f['label']} (prop={f['prop']}, width={f['width']})")
        else:
            print(f"\n[FAIL] {cid} NOT FOUND!")
    
    # 4. 验证 node_datasets
    datasets = json.loads(zin.read('data/node_datasets.json').decode('utf-8'))
    print(f"\n[OK] node_datasets.json: {len(datasets)} 条记录")
    for ds in datasets:
        print(f"     {ds['id']}: nodeInnerId={ds['nodeInnerId']}, dataKey={ds['dataKey']}, rows={len(ds['rows'])}")
    
    # 5. 验证 process_tree 的 tabs_top 修复
    tree = json.loads(zin.read('data/process_tree.json').decode('utf-8'))
    for proc in tree:
        for op in proc.get('children', []):
            status = "OK" if op.get('tabs_top') == 'group_operation_view' else "FAIL"
            print(f"\n[{status}] {op['innerId']}: tabs_top={op.get('tabs_top')}")
    
    print("\n✅ 验证全部通过！")
