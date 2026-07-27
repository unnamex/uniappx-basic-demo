import io, json, zipfile
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
KEY = b'MPM_OFFLINE_2026_SECURE_KEY_256B'
data = open('V8发动机装配工艺_V18_multi_table_test.srd', 'rb').read()
iv = data[:16]
cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv), backend=default_backend())
dec = cipher.decryptor()
p = dec.update(data[16:]) + dec.finalize()
zip_data = p[:-p[-1]]
z = zipfile.ZipFile(io.BytesIO(zip_data))
ops = json.loads(z.read('data/operation.json'))
for op in ops:
    if op['name'] == '缸体组装':
        print(f"exclude_tab: {op.get('exclude_tab')}")
