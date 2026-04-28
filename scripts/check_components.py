import zipfile
import json

def check_components(srd_path):
    with zipfile.ZipFile(srd_path, 'r') as z:
        for item in z.infolist():
            if 'components.json' in item.filename:
                content = z.read(item.filename).decode('utf-8')
                data = json.loads(content)
                for comp in data:
                    print(f"Type: {comp.get('type')}, Keys in config: {list(comp.get('config', {}).keys())}")
                    if 'columns' in comp.get('config', {}):
                        v = comp['config']['columns']
                        print(f"  columns type: {type(v)}")

if __name__ == '__main__':
    check_components('test_rich_full_v6.srd')
