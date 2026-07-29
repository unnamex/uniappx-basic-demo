import os
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

base_dir = r"f:\workProject\avpbc-pop"
in_path = os.path.join(base_dir, "V8发动机装配工艺_V20_action_unit.srd")
with open(in_path, 'rb') as f:
    zip_data = decrypt_data(f.read())

with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as z:
    for item in z.infolist():
        if item.filename.endswith('components.json'):
            comps = json.loads(z.read(item).decode('utf-8'))
            for c in comps:
                if c.get('tab_id') in ['tab_operation_info', 'tab_step_info']:
                    print(json.dumps(c, indent=2, ensure_ascii=False))
