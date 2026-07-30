import zipfile, io, json

data=open(r'f:\workProject\avpbc-pop\V8发动机装配工艺_V20_action_unit.srd','rb').read()
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
iv=data[:16]; ct=data[16:]
c=Cipher(algorithms.AES(b'MPM_OFFLINE_2026_SECURE_KEY_256B'),modes.CBC(iv),backend=default_backend())
d=c.decryptor(); pt=d.update(ct)+d.finalize(); pl=pt[-1]; zd=pt[:-pl]
z=zipfile.ZipFile(io.BytesIO(zd))

# 列出zip内所有文件的原始filename
raw_names = [item.filename for item in z.infolist()]
print("=== ZIP内原始filename ===")
for n in raw_names:
    print(repr(n))

# 查attachment.json中用的路径
att=json.loads(z.read('data/attachment.json').decode('utf-8'))
print("\n=== attachment.json中的path字段（前10条）===")
for a in att[:10]:
    p = a.get('path','')
    exists = p in raw_names
    print(f"  path={repr(p)}  exists={exists}")
