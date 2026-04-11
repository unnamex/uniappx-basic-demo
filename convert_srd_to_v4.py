import zipfile
import json
import os

def check_dict_extract(items_list, prop_name):
    if not items_list: return []
    res = []
    for x in items_list:
        if isinstance(x, dict):
            res.append(x.get(prop_name, ''))
        elif isinstance(x, str):
            res.append(x)
    return res

def convert_to_v4():
    input_srd = 'data_package_v9_cad.srd'
    output_srd = 'test_v4_rich.srd'
    
    with zipfile.ZipFile(input_srd, 'r') as in_zf:
        # reconstruct process_tree
        root_node = {
            "classId": "",
            "innerId": "root_1",
            "name": "全部工艺",
            "code": "",
            "targetClassId": "Process",
            "tabs_top": "",
            "tabs_bottom": "",
            "resources": [],
            "children": []
        }
        
        for name in in_zf.namelist():
            if name.startswith('processes/') and name.endswith('.json'):
                proc_data = json.loads(in_zf.read(name).decode('utf-8'))
                print(f"Found process {name}, steps count: {len(proc_data.get('steps', []))}")
                
                # convert process properties
                p_node = {
                    "classId": "",
                    "innerId": proc_data.get('id', 'p_'+name),
                    "name": proc_data.get('name', '未命名工艺'),
                    "code": proc_data.get('code', ''),
                    "targetClassId": "Process",
                    "tabs_top": "",
                    "tabs_bottom": "",
                    "resources": [],
                    "children": []
                }
                
                # attachments to resources
                atts = proc_data.get('attachments', [])
                for i, att in enumerate(atts):
                    p_node["resources"].append({
                        "id": f"res_{p_node['innerId']}_{i}",
                        "type": att.get('type', ''),
                        "name": att.get('name', ''),
                        "path": att.get('path', ''),
                        "thumbnail": "",
                        "duration": 0,
                        "description": ""
                    })
                
                # steps 
                steps = proc_data.get('steps', [])
                if steps:
                    op_node = {
                        "classId": "",
                        "innerId": f"{p_node['innerId']}_op1",
                        "name": "基础工序",
                        "code": "OP-1",
                        "targetClassId": "Operation",
                        "tabs_top": "",
                        "tabs_bottom": "",
                        "resources": [],
                        "children": []
                    }
                    
                    for step in steps:
                        s_node = {
                            "classId": "",
                            "innerId": f"{op_node['innerId']}_s{step.get('stepNo', '')}",
                            "name": step.get('name', '步骤'),
                            "code": str(step.get('stepNo', '')),
                            "targetClassId": "Step",
                            "tabs_top": "",
                            "tabs_bottom": "",
                            "description_html": step.get('description_html', ''),
                            "description": step.get('description', ''),
                            "resources": [],
                            "children": []
                        }
                        
                        # old step custom fields
                        s_node["tools"] = step.get('tools', [])
                        s_node["materials"] = step.get('materials', [])
                        
                        r_idx = 0
                        # handle images (might be list of dicts with 'url' or list of strings)
                        images = check_dict_extract(step.get('images', []), 'url')
                        for img in images:
                            s_node["resources"].append({
                                "id": f"res_img_{s_node['innerId']}_{r_idx}",
                                "type": "image",
                                "name": os.path.basename(img),
                                "path": img,
                                "thumbnail": "",
                                "duration": 0,
                                "description": ""
                            })
                            r_idx += 1
                            
                        # handle videos
                        videos = check_dict_extract(step.get('videos', []), 'url')
                        for vid in videos:
                            s_node["resources"].append({
                                "id": f"res_vid_{s_node['innerId']}_{r_idx}",
                                "type": "video",
                                "name": os.path.basename(vid),
                                "path": vid,
                                "thumbnail": "",
                                "duration": 0,
                                "description": ""
                            })
                            r_idx += 1
                            
                        op_node["children"].append(s_node)
                        
                    p_node["children"].append(op_node)
                    
                root_node["children"].append(p_node)
                
        # If there's only 1 process, use it as the top level ProcessNode.
        if len(root_node["children"]) == 1:
            root_node = root_node["children"][0]
            
        print("Root node generated. children count: " + str(len(root_node["children"])))
        
        # Write output SRD
        with zipfile.ZipFile(output_srd, 'w', zipfile.ZIP_DEFLATED) as out_zf:
            for item in in_zf.infolist():
                if not item.filename.startswith('processes/'):
                    out_zf.writestr(item, in_zf.read(item.filename))
                    
            out_zf.writestr('data/process_tree.json', json.dumps(root_node, ensure_ascii=False, indent=2).encode('utf-8'))

if __name__ == "__main__":
    convert_to_v4()
