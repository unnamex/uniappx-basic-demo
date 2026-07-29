import json
import zipfile
import io
import os
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

data = open('V8发动机装配工艺_V18_multi_table_test.srd', 'rb').read()
zip_data = decrypt_data(data)

with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin:
    tabs_groups = json.loads(zin.read('layout/tabs.json').decode('utf-8'))
    print("tabs.json:")
    print(json.dumps(tabs_groups, ensure_ascii=False, indent=2))
