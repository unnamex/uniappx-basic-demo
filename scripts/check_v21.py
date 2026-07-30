import zipfile, io, json

data = open(r'f:\workProject\avpbc-pop\V8发动机装配工艺_V21_table_attachment.srd', 'rb').read()
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

iv = data[:16]
ct = data[16:]
c = Cipher(algorithms.AES(b'MPM_OFFLINE_2026_SECURE_KEY_256B'), modes.CBC(iv), backend=default_backend())
d = c.decryptor()
pt = d.update(ct) + d.finalize()
pl = pt[-1]
zd = pt[:-pl]

z = zipfile.ZipFile(io.BytesIO(zd))

# 列出所有文件
print("=== 文件列表 ===")
for item in z.infolist():
    print(" ", item.filename)

# 验证 node_datasets
print("\n=== node_datasets (parts_list 前2个) ===")
ds = json.loads(z.read('data/node_datasets.json').decode('utf-8'))
cnt = 0
for d2 in ds:
    if d2.get('dataKey') == 'parts_list':
        rows = d2.get('rows', [])
        print("  nodeInnerId:", d2['nodeInnerId'], "  rows:", len(rows))
        if rows:
            print("  firstRow keys:", list(rows[0].keys()))
            print("  firstRow innerId:", rows[0].get('innerId', 'N/A'))
        cnt += 1
        if cnt >= 2:
            break

# 验证新增附件
print("\n=== 新增附件 (row_parts_*) ===")
att = json.loads(z.read('data/attachment.json').decode('utf-8'))
for a in att:
    if 'row_parts' in a.get('nodeId', ''):
        print("  id:", a['id'])
        print("  path:", a['path'])
        print("  nodeId:", a['nodeId'])
        # 检查path是否存在于zip中
        exists = a['path'] in [item.filename for item in z.infolist()]
        print("  path exists in zip:", exists)
        print()

# 验证manifest
print("=== manifest ===")
mf = json.loads(z.read('manifest.json').decode('utf-8'))
print("  version:", mf.get('version'))
print("  description:", mf.get('description'))
