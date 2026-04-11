import zipfile
import json
import os

manifest = {
    "version": "4.0",
    "groups": [],
    "tabs": [],
    "components": [],
    "records": []
}

process_tree = {
    "classId": "test_class",
    "innerId": "root_process_01",
    "name": "V4 测试工艺树",
    "code": "P-V4-001",
    "targetClassId": "Process",
    "tabs_top": "",
    "tabs_bottom": "",
    "resources": [
        {
            "id": "res_1",
            "type": "document",
            "name": "测试附件.txt",
            "path": "assets/test.txt",
            "thumbnail": "",
            "duration": 0,
            "description": "虚拟附件"
        }
    ],
    "children": [
        {
            "classId": "",
            "innerId": "op_01",
            "name": "默认工序",
            "code": "OP-10",
            "targetClassId": "Operation",
            "tabs_top": "",
            "tabs_bottom": "",
            "resources": [],
            "children": [
                {
                    "classId": "",
                    "innerId": "step_01",
                    "name": "基础组装",
                    "code": "STEP-10-1",
                    "targetClassId": "Step",
                    "tabs_top": "",
                    "tabs_bottom": "",
                    "description_html": "<p>请仔细确认组件 <strong>无破损</strong> 后再组装。</p>",
                    "resources": [
                        {
                            "id": "res_2",
                            "type": "image",
                            "name": "示意图.txt",
                            "path": "assets/image.txt",
                            "thumbnail": "",
                            "duration": 0,
                            "description": "虚拟图片"
                        }
                    ],
                    "children": []
                }
            ]
        }
    ]
}

os.makedirs('assets', exist_ok=True)
with open('assets/test.txt', 'w', encoding='utf-8') as f:
    f.write('这是一个测试文本文件。')
with open('assets/image.txt', 'w', encoding='utf-8') as f:
    f.write('这是一个假图。')

with zipfile.ZipFile('test_v4.srd', 'w') as zf:
    zf.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    zf.writestr('data/process_tree.json', json.dumps(process_tree, ensure_ascii=False, indent=2))
    zf.write('assets/test.txt')
    zf.write('assets/image.txt')

print("test_v4.srd generated successfully.")
