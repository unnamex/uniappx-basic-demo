import zipfile
import json
import os

# 配置要修复的文件名
TARGET_SRD = 'final_v6_v8_merged_v2.srd'
REPAIRED_SRD = 'final_repaired.srd'

def repair():
    if not os.path.exists(TARGET_SRD):
        print(f"错误：找不到文件 {TARGET_SRD}")
        return

    print(f"正在修复数据包: {TARGET_SRD} ...")
    
    with zipfile.ZipFile(TARGET_SRD, 'r') as in_zf:
        # 获取压缩包内所有文件列表
        all_files = in_zf.namelist()
        print(f"包内总文件数: {len(all_files)}")

        with zipfile.ZipFile(REPAIRED_SRD, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            # 1. 首先处理 manifest.json
            manifest_content = in_zf.read('manifest.json')
            manifest = json.loads(manifest_content.decode('utf-8'))
            
            if 'files' not in manifest:
                manifest['files'] = {}
            
            files = manifest['files']
            
            # 定义标准映射检查
            mappings = {
                'process': 'data/process.json',
                'operation': 'data/operation.json',
                'step': 'data/step.json',
                'action': 'data/action.json',
                'attachment': 'data/attachment.json'
            }
            
            print("检查核心数据索引...")
            for key, path in mappings.items():
                if path in all_files:
                    if key not in files:
                        files[key] = path
                        print(f"  [补全] 发现 {path}，已建立映射 '{key}'")
                    else:
                        print(f"  [通过] {key} 已存在索引")
                else:
                    print(f"  [警告] 包内未发现物理文件: {path}")

            # 2. 写入修复后的 manifest
            out_zf.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
            
            # 3. 复制其余所有文件
            for item in in_zf.infolist():
                if item.filename != 'manifest.json':
                    out_zf.writestr(item, in_zf.read(item.filename))

    print(f"\n修复完成！已生成: {REPAIRED_SRD}")
    print("请尝试在鸿蒙端导入此修复后的文件。")

if __name__ == '__main__':
    repair()
