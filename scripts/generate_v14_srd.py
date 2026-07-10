"""
基于 V13 SRD 包，为所有 table/tableTree 组件的 fields 调整 richText 的 minWidth 配置。
因为富文本现在改为了行内展示，需要更宽的列宽来完整显示内容。

规则：
  - richText 列：minWidth 修改为 350（之前是100）
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

def add_min_width_to_fields(fields):
    """为 fields 数组中的每个字段调整 richText 的 minWidth"""
    modified = False
    for field in fields:
        field_type = field.get('type', '')

        # 如果是富文本，重置 minWidth 为 350
        if field_type == 'richText':
            field['minWidth'] = 350
            modified = True

    return modified

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    in_path = os.path.join(project_root, 'V8发动机装配工艺_V13_encrypted.srd')
    out_path = os.path.join(project_root, 'V8发动机装配工艺_V14_encrypted.srd')

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
                data['version'] = '14.0'
                data['description'] = 'V14: 调整 richText 的 minWidth 为 350，以适配行内展示模式'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ manifest.json 版本号更新为 14.0")

            elif item.filename.endswith('components.json'):
                data = json.loads(content.decode('utf-8'))
                for comp in data:
                    comp_type = comp.get('type', '')
                    if comp_type in ('table', 'tableTree'):
                        config = comp.get('config', {})
                        fields = config.get('fields', [])
                        if fields and add_min_width_to_fields(fields):
                            comp_count += 1
                            print(f"  ✓ 组件 [{comp['id']}] ({comp.get('title','')}) 已添加 minWidth")
                            for f in fields:
                                w = f.get('width', -1)
                                mw = f.get('minWidth', '-')
                                print(f"      {f['label']:12s}  width={str(w):5s}  minWidth={mw}")

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
