import os
import glob
import json
import zipfile
import tempfile
import shutil
import sys

def refactor_srd_file(filepath):
    print(f"Processing {filepath}...")
    temp_dir = tempfile.mkdtemp()
    needs_repack = False
    
    try:
        # Extract everything
        with zipfile.ZipFile(filepath, 'r') as zf:
            zf.extractall(temp_dir)
            
        # 1. Rename files in assets/docs to assets/documents
        docs_dir = os.path.join(temp_dir, 'assets', 'docs')
        documents_dir = os.path.join(temp_dir, 'assets', 'documents')
        
        if os.path.exists(docs_dir):
            needs_repack = True
            if not os.path.exists(documents_dir):
                os.makedirs(documents_dir)
            for item in os.listdir(docs_dir):
                src = os.path.join(docs_dir, item)
                dst = os.path.join(documents_dir, item)
                shutil.move(src, dst)
            os.rmdir(docs_dir)
            
        # 2. Update attachment.json
        attachment_path = os.path.join(temp_dir, 'data', 'attachment.json')
        if os.path.exists(attachment_path):
            with open(attachment_path, 'r', encoding='utf-8') as f:
                attachments = json.load(f)
            
            modified = False
            for att in attachments:
                if 'path' in att and 'assets/docs/' in att['path']:
                    att['path'] = att['path'].replace('assets/docs/', 'assets/documents/')
                    modified = True
                if 'thumbnail' in att and 'assets/docs/' in att['thumbnail']:
                    att['thumbnail'] = att['thumbnail'].replace('assets/docs/', 'assets/documents/')
                    modified = True
                    
            if modified:
                needs_repack = True
                with open(attachment_path, 'w', encoding='utf-8') as f:
                    json.dump(attachments, f, ensure_ascii=False, indent=2)

        # 3. Update any other JSON if necessary
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.json'):
                    json_path = os.path.join(root, file)
                    with open(json_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    if 'assets/docs/' in content:
                        needs_repack = True
                        content = content.replace('assets/docs/', 'assets/documents/')
                        with open(json_path, 'w', encoding='utf-8') as f:
                            f.write(content)

        if needs_repack:
            # Repack the zip
            backup_path = filepath + '.bak'
            shutil.copy2(filepath, backup_path)
            
            with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        arcname = arcname.replace(os.sep, '/')
                        zf.write(file_path, arcname)
            print(f"  -> Successfully refactored {filepath}")
        else:
            print(f"  -> No 'assets/docs/' found, skipping.")
            
    except Exception as e:
        print(f"  -> Error processing {filepath}: {e}")
    finally:
        shutil.rmtree(temp_dir)

if __name__ == '__main__':
    search_dir = '.'
    if len(sys.argv) > 1:
        search_dir = sys.argv[1]
    
    srd_files = glob.glob(os.path.join(search_dir, '**', '*.srd'), recursive=True)
    if not srd_files:
        print("No .srd files found.")
    for srd in srd_files:
        refactor_srd_file(srd)
    print("Done.")
