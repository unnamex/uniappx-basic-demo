import os
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

def encrypt_data(plaintext):
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padding_len = 16 - (len(plaintext) % 16)
    padded_plaintext = plaintext + bytes([padding_len] * padding_len)
    ciphertext = encryptor.update(padded_plaintext) + encryptor.finalize()
    return iv + ciphertext

def main():
    in_path = '../V8发动机装配工艺_encrypted.srd'
    out_path = '../V8发动机装配工艺_nolist_encrypted.srd'
    
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
        
    print(f"Decrypting {in_path}...")
    zip_data = decrypt_data(encrypted_data)
    
    out_zip_io = io.BytesIO()
    
    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename.endswith('components.json'):
                try:
                    data = json.loads(content.decode('utf-8'))
                    new_data = [comp for comp in data if comp.get('type') != 'list']
                    content = json.dumps(new_data, ensure_ascii=False, indent=2).encode('utf-8')
                except Exception as e:
                    print(f"Failed to process {item.filename}: {e}")
            zout.writestr(item, content)
            
    print(f"Encrypting {out_path}...")
    new_encrypted_data = encrypt_data(out_zip_io.getvalue())
    
    with open(out_path, 'wb') as f:
        f.write(new_encrypted_data)
        
    print(f"Successfully generated {out_path}")

if __name__ == '__main__':
    main()
