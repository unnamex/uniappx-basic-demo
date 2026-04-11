import zipfile
import json

def map_node(old_node):
    new_node = {}
    new_node['innerId'] = old_node.get('id', '')
    new_node['code'] = old_node.get('code', '')
    new_node['name'] = old_node.get('name', '未命名')
    
    t = old_node.get('type', '').lower()
    if t == 'process':
        new_node['targetClassId'] = 'Process'
    elif t == 'procedure':
        new_node['targetClassId'] = 'Operation'
    elif t == 'step':
        new_node['targetClassId'] = 'Step'
    else:
        new_node['targetClassId'] = 'ActionUnit'
        
    new_node['classId'] = ''
    new_node['tabs_top'] = ''
    new_node['tabs_bottom'] = ''
    new_node['description'] = old_node.get('description', '')
    new_node['description_html'] = old_node.get('description_html', old_node.get('description', ''))
    
    # map resources
    new_node['resources'] = list(old_node.get('resources', []))
    
    # map children
    new_children = []
    old_children = old_node.get('children', [])
    for c in old_children:
        new_children.append(map_node(c))
    new_node['children'] = new_children
    
    # Copy over other custom metadata to allow UI rendering rich content
    for k, v in old_node.items():
        if k not in ['id', 'type', 'children', 'resources']:
            if k not in new_node:
                new_node[k] = v
                
    return new_node

def enrich_v4():
    input_srd = 'data_package_v9_cad.srd'
    output_srd = 'test_v4_richer.srd'
    
    with zipfile.ZipFile(input_srd, 'r') as in_zf:
        # find the process file
        process_files = [n for n in in_zf.namelist() if n.startswith('processes/') and n.endswith('.json')]
        if not process_files:
            print("No process file found!")
            return
            
        old_root = json.loads(in_zf.read(process_files[0]).decode('utf-8'))
        new_root = map_node(old_root)
        
        with zipfile.ZipFile(output_srd, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            for item in in_zf.infolist():
                if item.filename.startswith('processes/'):
                    continue
                
                content = in_zf.read(item.filename)
                
                if item.filename == 'manifest.json':
                    man = json.loads(content.decode('utf-8'))
                    if 'files' in man:
                        for k, v in man['files'].items():
                            if isinstance(v, str) and v.startswith('ui/'):
                                man['files'][k] = v.replace('ui/', 'layout/', 1)
                    man['version'] = '4.0'
                    if 'processes' in man['files']:
                        del man['files']['processes']
                    out_zf.writestr('manifest.json', json.dumps(man, ensure_ascii=False, indent=2).encode('utf-8'))
                else:
                    target_name = item.filename
                    if target_name.startswith('ui/'):
                        target_name = target_name.replace('ui/', 'layout/', 1)
                    out_zf.writestr(target_name, content)
            
            # write the new process tree
            out_zf.writestr('data/process_tree.json', json.dumps(new_root, ensure_ascii=False, indent=2).encode('utf-8'))

if __name__ == "__main__":
    enrich_v4()
    print("test_v4.srd has been enriched successfully!")
