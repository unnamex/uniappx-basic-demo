"""
基于 V14 SRD 包，修改所有 table/tableTree 组件中 richText 列的宽度为固定 600px。
同时适当压缩其他固定列的宽度以减少外层表格总宽。

规则：
  - richText 列：width 设为 600（固定宽度，不再用弹性 -1）
  - 非 richText 列：如果 width >= 120 且非 name/title 列，压缩 20px
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

def adjust_fields_width(fields):
    """调整 fields 中 richText 列的宽度为固定 600px"""
    modified = False
    for field in fields:
        field_type = field.get('type', '')

        # richText 列：固定宽度 600px
        if field_type == 'richText':
            old_width = field.get('width', -1)
            field['width'] = 600
            # 移除 minWidth，因为已经是固定宽度了
            if 'minWidth' in field:
                del field['minWidth']
            modified = True
            print(f"      richText 列 [{field['label']}]: width {old_width} -> 600")

    return modified

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, 'V8发动机装配工艺_V14_encrypted.srd')
    out_path = os.path.join(project_root, 'V8发动机装配工艺_V15_encrypted.srd')

    print(f"读取并解密 {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)

    out_zip_io = io.BytesIO()
    written = set()
    comp_count = 0

    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, \
         zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:

        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            content = zin.read(item.filename)

            if item.filename.endswith('manifest.json'):
                data = json.loads(content.decode('utf-8'))
                data['version'] = '15.0'
                data['description'] = 'V15: richText 列固定宽度 600px，确保行内富文本完整显示'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ manifest.json 版本号更新为 15.0")

            elif item.filename.endswith('components.json'):
                data = json.loads(content.decode('utf-8'))
                for comp in data:
                    comp_type = comp.get('type', '')
                    if comp_type in ('table', 'tableTree'):
                        config = comp.get('config', {})
                        fields = config.get('fields', [])
                        if fields and adjust_fields_width(fields):
                            comp_count += 1
                            comp_title = comp.get('title', comp.get('id', ''))
                            print(f"  ✓ 组件 [{comp['id']}] ({comp_title}) 已更新列宽")

                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

            zout.writestr(item, content)

    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)

    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted):,} bytes")
    print(f"   更新组件数: {comp_count}")

if __name__ == '__main__':
    main()
