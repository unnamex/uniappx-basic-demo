"""
基于 V16 SRD 包，生成 V17 版本：
  - 增大列表中使用富文本组件(richText)列的宽度
  - 工序列表(comp_proc_list) 和 工步列表(comp_operation_list) 中 content 列宽度从 120 增加到 360，minWidth 从 350 增加到 500
"""

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
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, 'V8发动机装配工艺_V16_encrypted.srd')
    out_path = os.path.join(project_root, 'V8发动机装配工艺_V17_encrypted.srd')

    print(f"读取并解密 {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)

    out_zip_io = io.BytesIO()
    written = set()

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, \
         zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            content = zin.read(item.filename)

            # 更新 manifest.json 版本号
            if item.filename.endswith('manifest.json'):
                data = json.loads(content.decode('utf-8'))
                data['version'] = '17.0'
                data['description'] = 'V17: 增大列表中使用富文本组件的宽度'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ manifest.json 版本号更新为 17.0")

            # 修改 components.json，更新富文本列的宽度
            elif item.filename.endswith('components.json'):
                data = json.loads(content.decode('utf-8'))
                print("\n  处理 components.json ...")
                for comp in data:
                    if comp.get('type') == 'table':
                        config = comp.get('config', {})
                        fields = config.get('fields', [])
                        modified = False
                        for field in fields:
                            if field.get('type') == 'richText':
                                old_width = field.get('width')
                                field['width'] = 360 # 增加到3倍
                                field['minWidth'] = 500
                                modified = True
                                print(f"    ✓ 更新 {comp['id']} 中 '{field['label']}' 宽度: {old_width} -> 360")
                        
                        if modified:
                            comp['config'] = config
                
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

            zout.writestr(item, content)

    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)

    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted):,} bytes")

if __name__ == '__main__':
    main()
