import json
import zipfile
import io
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

KEY = b'MPM_OFFLINE_2026_SECURE_KEY_256B'

def decrypt_data(data):
    iv = data[:16]
    ciphertext = data[16:]
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    padded_plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    return padded_plaintext[:-padded_plaintext[-1]]

data = open('V8发动机装配工艺_V18_multi_table_test.srd', 'rb').read()
zip_data = decrypt_data(data)
with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
    c = json.loads(zin.read('layout/components.json').decode('utf-8'))
    for comp in c:
        if comp['id'] == 'comp_step_desc':
            print(json.dumps(comp, indent=2, ensure_ascii=False))
