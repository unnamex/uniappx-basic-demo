import zipfile
import json
import sys

def check_srd(filepath):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            print("Files in srd:", z.namelist())
            for name in z.namelist():
                if name.endswith('.json'):
                    first_bytes = z.read(name)[:500].decode('utf-8')
                    print(f"\n--- {name} ---")
                    print(first_bytes)
    except zipfile.BadZipFile:
        print("Not a zip file")

if __name__ == "__main__":
    check_srd("test_rich_full_v6.srd")
