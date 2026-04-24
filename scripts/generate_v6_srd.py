"""
SRD V6 标准数据包生成器
根据 SRD_PACKAGE_SPECIFICATION.md V6 规范和项目运行时代码实际需求生成测试包。

关键约定：
- data/*.json 中的业务数据使用 camelCase 字段名（Web 端 IndexedDB 直接存取，不做转换）
- IndexedDB keyPath 为 inner_id，导入时由代码从 innerId 复制过去
- 工艺树骨架节点必须包含 innerId, type, code, name, children
- 关系表中的外键使用 camelCase: processId, operationId, stepId
"""
import json
import zipfile

def create_v6_srd(output_path):
    # ==================== 1. manifest.json ====================
    manifest = {
        "name": "V6 标准测试数据包",
        "version": "6.0",
        "description": "符合 SRD V6 规范的标准测试数据包",
        "exportTime": "2026-04-21T20:00:00+08:00",
        "files": {
            "tabs": "layout/tabs.json",
            "tab": "layout/tab.json",
            "components": "layout/components.json",
            "icons": "layout/icons.json",
            "attachment": "data/attachment.json",
            "process": "data/process.json",
            "operation": "data/operation.json",
            "step": "data/step.json",
            "action": "data/action.json"
        }
    }

    # ==================== 2. 轻量工艺树骨架 ====================
    process_tree = [
        {
            "innerId": "proc_1",
            "type": "process",
            "code": "ASM-ENG-V8",
            "name": "V8发动机总装工艺",
            "tabs_top": "group_process_view",
            "tabs_bottom": "group_bottom_proc",
            "children": [
                {
                    "innerId": "op_1",
                    "type": "operation",
                    "code": "OP-010",
                    "name": "缸体准备",
                    "tabs_top": "group_operation_view",
                    "tabs_bottom": "group_bottom_op",
                    "children": [
                        {
                            "innerId": "step_1",
                            "type": "step",
                            "code": "S-010-01",
                            "name": "缸体清洁",
                            "tabs_top": "group_step_view",
                            "tabs_bottom": "group_bottom_step",
                            "children": []
                        },
                        {
                            "innerId": "step_2",
                            "type": "step",
                            "code": "S-010-02",
                            "name": "缸体检测",
                            "tabs_top": "group_step_view",
                            "tabs_bottom": "group_bottom_step",
                            "children": []
                        }
                    ]
                },
                {
                    "innerId": "op_2",
                    "type": "operation",
                    "code": "OP-020",
                    "name": "曲轴安装",
                    "tabs_top": "group_operation_view",
                    "tabs_bottom": "group_bottom_op",
                    "children": [
                        {
                            "innerId": "step_3",
                            "type": "step",
                            "code": "S-020-01",
                            "name": "轴瓦预装",
                            "tabs_top": "group_step_view",
                            "tabs_bottom": "group_bottom_step",
                            "children": []
                        }
                    ]
                }
            ]
        }
    ]

    # ==================== 3. 四级关系平铺表 (camelCase) ====================
    # 注意：字段名使用 camelCase，与 Web 端运行时过滤条件一致
    process_data = [
        {
            "innerId": "proc_1",
            "code": "ASM-ENG-V8",
            "name": "V8发动机总装工艺",
            "classId": "Engine",
            "classId_display": "发动机工艺",
            "version": "3.0.0",
            "fullversionNo": "V3.0.0",
            "stateName": "已发布",
            "modifyById_display": "张工",
            "modifyTime": "2026-04-20",
            "contextName": "航空发动机事业部",
            "phaseId_display": "生产阶段",
            "secretId_display": "内部",
            "partCode": "P-V8-2026",
            "partName": "V8发动机缸体组件",
            "partClassId_display": "发动机部件",
            "partStateName": "已发布",
            "partFullversionNo": "V2.1.0",
            "partModifyById_display": "李工",
            "partModifyTime": "2026-04-18",
            "partContextName": "航空发动机事业部",
            "partPhaseId_display": "量产阶段",
            "partSecretId_display": "内部",
            "content": "<h3>工艺总览</h3><p>V8发动机总装工艺，包含缸体准备、曲轴安装等关键工序。</p><ul><li>适用型号：V8-2026</li><li>产线编号：L03</li></ul>",
            "tabs_top": "group_process_view",
            "tabs_bottom": "group_bottom_proc",
            "sortOrder": 0
        }
    ]

    operation_data = [
        {
            "innerId": "op_1",
            "processId": "proc_1",
            "code": "OP-010",
            "name": "缸体准备",
            "serialNumber": "010",
            "classId_display": "常规工序",
            "isKey": "true",
            "isKey_display": "是",
            "content": "<p>对发动机缸体进行清洁和检测，确保表面无残留物，尺寸精度合格。</p>",
            "tabs_top": "group_operation_view",
            "tabs_bottom": "group_bottom_op",
            "sortOrder": 0
        },
        {
            "innerId": "op_2",
            "processId": "proc_1",
            "code": "OP-020",
            "name": "曲轴安装",
            "serialNumber": "020",
            "classId_display": "关键工序",
            "isKey": "true",
            "isKey_display": "是",
            "content": "<p>安装曲轴及主轴承盖，注意扭矩要求和润滑规范。</p>",
            "tabs_top": "group_operation_view",
            "tabs_bottom": "group_bottom_op",
            "sortOrder": 1
        }
    ]

    step_data = [
        {
            "innerId": "step_1",
            "operationId": "op_1",
            "processId": "proc_1",
            "code": "S-010-01",
            "name": "缸体清洁",
            "serialNumber": "01",
            "classId_display": "清洁工步",
            "note": "使用专用清洗液，注意防护措施",
            "content": "<p>使用工业清洗剂对缸体表面进行全面清洁：</p><ol><li>喷涂清洗剂</li><li>静置10分钟</li><li>高压水枪冲洗</li><li>压缩空气吹干</li></ol>",
            "tabs_top": "group_step_view",
            "tabs_bottom": "group_bottom_step",
            "sortOrder": 0
        },
        {
            "innerId": "step_2",
            "operationId": "op_1",
            "processId": "proc_1",
            "code": "S-010-02",
            "name": "缸体检测",
            "serialNumber": "02",
            "classId_display": "检测工步",
            "note": "记录所有测量数据",
            "content": "<p>使用三坐标测量仪对缸体关键尺寸进行检测，确保精度在±0.01mm范围内。</p>",
            "tabs_top": "group_step_view",
            "tabs_bottom": "group_bottom_step",
            "sortOrder": 1
        },
        {
            "innerId": "step_3",
            "operationId": "op_2",
            "processId": "proc_1",
            "code": "S-020-01",
            "name": "轴瓦预装",
            "serialNumber": "01",
            "classId_display": "装配工步",
            "note": "轴瓦方向不可装反",
            "content": "<p>将主轴承轴瓦安装到缸体主轴承座中，确保定位销对齐。</p>",
            "tabs_top": "group_step_view",
            "tabs_bottom": "group_bottom_step",
            "sortOrder": 0
        }
    ]

    action_data = []  # 本测试包暂无动作单元数据

    # ==================== 4. 附件资源清单 ====================
    attachment_data = [
        {
            "id": "res_proc_1_img",
            "nodeId": "proc_1",
            "type": "image",
            "name": "V8发动机爆炸图",
            "path": "assets/images/engine_exploded.png",
            "description": "V8发动机总装爆炸视图"
        },
        {
            "id": "res_op1_img",
            "nodeId": "op_1",
            "type": "image",
            "name": "缸体清洁示意图",
            "path": "assets/images/block_clean.png",
            "description": "缸体清洁操作示意图"
        }
    ]

    # ==================== 5. UI 布局 - Tab 分组 ====================
    tabs_data = [
        {"id": "group_process_mgmt", "name": "工艺管理", "type": "tabGroup", "description": "左侧面板", "sort_order": 0},
        {"id": "group_process_view", "name": "工艺视图", "type": "tabGroup", "description": "工艺节点上方视图", "sort_order": 1},
        {"id": "group_operation_view", "name": "工序视图", "type": "tabGroup", "description": "工序节点上方视图", "sort_order": 2},
        {"id": "group_step_view", "name": "工步视图", "type": "tabGroup", "description": "工步节点上方视图", "sort_order": 3},
        {"id": "group_bottom_proc", "name": "工艺详情", "type": "tabGroup", "description": "工艺节点下方详情", "sort_order": 4},
        {"id": "group_bottom_op", "name": "工序详情", "type": "tabGroup", "description": "工序节点下方详情", "sort_order": 5},
        {"id": "group_bottom_step", "name": "工步详情", "type": "tabGroup", "description": "工步节点下方详情", "sort_order": 6}
    ]

    # ==================== 6. UI 布局 - Tab 页签 ====================
    tab_data = [
        # 左侧面板
        {"id": "left_panel", "group_id": "group_process_mgmt", "title": "工艺结构树", "sort_order": 0},
        {"id": "tab_process_list", "group_id": "group_process_mgmt", "title": "工艺列表", "sort_order": 1},
        # 上方 - 工艺视图
        {"id": "tab_proc_info", "group_id": "group_process_view", "title": "基本信息", "sort_order": 0},
        {"id": "tab_proc_children", "group_id": "group_process_view", "title": "工序列表", "sort_order": 1},
        # 上方 - 工序视图
        {"id": "tab_operation_info", "group_id": "group_operation_view", "title": "工序详情", "sort_order": 0},
        {"id": "tab_operation_children", "group_id": "group_operation_view", "title": "工步列表", "sort_order": 1},
        # 上方 - 工步视图
        {"id": "tab_step_info", "group_id": "group_step_view", "title": "操作说明", "sort_order": 0},
        # 下方 - 工艺详情
        {"id": "tab_bottom_proc_ov", "group_id": "group_bottom_proc", "title": "概览", "sort_order": 0},
        {"id": "tab_bottom_proc_product", "group_id": "group_bottom_proc", "title": "产品信息", "sort_order": 1},
        # 下方 - 工序详情
        {"id": "tab_bottom_op_ov", "group_id": "group_bottom_op", "title": "概览", "sort_order": 0},
        # 下方 - 工步详情
        {"id": "tab_bottom_step_ov", "group_id": "group_bottom_step", "title": "说明", "sort_order": 0}
    ]

    # ==================== 7. UI 布局 - 组件配置 ====================
    components_data = [
        # ---- 左侧面板 ----
        # 工艺树: type 必须是 tableTree，dataSource 必须是 database
        {
            "id": "comp_process_tree", "tab_id": "left_panel",
            "type": "tableTree", "title": "工艺树", "sort_order": 0,
            "config": {
                "columns": [
                    {"label": "名称", "prop": "displayName", "width": -1}
                ]
            }
        },
        # 工艺列表: type 为 tableTree + database 以复用树加载逻辑
        {
            "id": "comp_process_table", "tab_id": "tab_process_list",
            "type": "tableTree", "title": "工艺总览表", "sort_order": 0,
            "config": {
                "columns": [
                    {"label": "代码", "prop": "code", "width": 180},
                    {"label": "名称", "prop": "name", "width": 350},
                    {"label": "状态", "prop": "stateName", "width": 120}
                ]
            }
        },

        # ---- 上方 - 工艺视图 ----
        {
            "id": "comp_proc_info", "tab_id": "tab_proc_info",
            "type": "infoView", "title": "工艺基本信息", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "工艺代码", "vModel": "code"},
                    {"label": "工艺名称", "vModel": "name"},
                    {"label": "版本", "vModel": "fullversionNo"},
                    {"label": "状态", "vModel": "stateName"},
                    {"label": "类型", "vModel": "classId_display"},
                    {"label": "修改人", "vModel": "modifyById_display"},
                    {"label": "修改时间", "vModel": "modifyTime"},
                    {"label": "密级", "vModel": "secretId_display"},
                    {"label": "工艺总览", "vModel": "content", "type": "richText"}
                ],
                "columns": 2
            }
        },
        {
            "id": "comp_proc_list", "tab_id": "tab_proc_children",
            "type": "table", "title": "工序列表", "sort_order": 0,
            "config": {
                "columns": [
                    {"label": "序号", "prop": "serialNumber", "width": 80},
                    {"label": "代码", "prop": "code", "width": 180},
                    {"label": "名称", "prop": "displayName", "width": -1},
                    {"label": "说明", "prop": "content", "width": 100, "type": "richText"},
                    {"label": "关键", "prop": "isKey_display", "width": 80}
                ]
            }
        },

        # ---- 上方 - 工序视图 ----
        {
            "id": "comp_operation_info", "tab_id": "tab_operation_info",
            "type": "infoView", "title": "工序详情", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "工序代码", "vModel": "code"},
                    {"label": "工序名称", "vModel": "name"},
                    {"label": "序号", "vModel": "serialNumber"},
                    {"label": "类型", "vModel": "classId_display"},
                    {"label": "关键工序", "vModel": "isKey_display"}
                ],
                "columns": 2
            }
        },
        {
            "id": "comp_operation_list", "tab_id": "tab_operation_children",
            "type": "table", "title": "工步列表", "sort_order": 0,
            "config": {
                "columns": [
                    {"label": "序号", "prop": "serialNumber", "width": 80},
                    {"label": "代码", "prop": "code", "width": 180},
                    {"label": "名称", "prop": "displayName", "width": -1}
                ]
            }
        },

        # ---- 上方 - 工步视图 ----
        {
            "id": "comp_step_basic", "tab_id": "tab_step_info",
            "type": "infoView", "title": "基本信息", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "工步代码", "vModel": "code"},
                    {"label": "工步名称", "vModel": "name"},
                    {"label": "序号", "vModel": "serialNumber"},
                    {"label": "类型", "vModel": "classId_display"},
                    {"label": "备注", "vModel": "note"}
                ],
                "columns": 2
            }
        },
        {
            "id": "comp_step_desc", "tab_id": "tab_step_info",
            "type": "richText", "title": "操作描述", "sort_order": 1,
            "config": {
            }
        },

        # ---- 下方 - 工艺详情 ----
        {
            "id": "comp_bottom_proc_info", "tab_id": "tab_bottom_proc_ov",
            "type": "infoView", "title": "工艺概览", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "版本", "vModel": "fullversionNo"},
                    {"label": "状态", "vModel": "stateName"},
                    {"label": "所属部门", "vModel": "contextName"},
                    {"label": "阶段", "vModel": "phaseId_display"}
                ],
                "columns": 2
            }
        },
        {
            "id": "comp_bottom_proc_desc", "tab_id": "tab_bottom_proc_ov",
            "type": "richText", "title": "工艺说明", "sort_order": 1,
            "config": {
            }
        },
        {
            "id": "comp_bottom_proc_product", "tab_id": "tab_bottom_proc_product",
            "type": "infoView", "title": "关联产品", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "部件代码", "vModel": "partCode"},
                    {"label": "部件名称", "vModel": "partName"},
                    {"label": "部件类型", "vModel": "partClassId_display"},
                    {"label": "部件版本", "vModel": "partFullversionNo"},
                    {"label": "部件状态", "vModel": "partStateName"},
                    {"label": "修改人", "vModel": "partModifyById_display"}
                ],
                "columns": 2
            }
        },

        # ---- 下方 - 工序详情 ----
        {
            "id": "comp_bottom_op_info", "tab_id": "tab_bottom_op_ov",
            "type": "infoView", "title": "工序概览", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "代码", "vModel": "code"},
                    {"label": "名称", "vModel": "name"},
                    {"label": "关键工序", "vModel": "isKey_display"}
                ],
                "columns": 2
            }
        },
        {
            "id": "comp_bottom_op_desc", "tab_id": "tab_bottom_op_ov",
            "type": "richText", "title": "工序描述", "sort_order": 1,
            "config": {
            }
        },

        # ---- 下方 - 工步详情 ----
        {
            "id": "comp_bottom_step_info", "tab_id": "tab_bottom_step_ov",
            "type": "infoView", "title": "工步基本信息", "sort_order": 0,
            "config": {
                "fields": [
                    {"label": "代码", "vModel": "code"},
                    {"label": "名称", "vModel": "name"},
                    {"label": "备注", "vModel": "note"}
                ],
                "columns": 2
            }
        },
        {
            "id": "comp_bottom_step_desc", "tab_id": "tab_bottom_step_ov",
            "type": "richText", "title": "操作说明", "sort_order": 1,
            "config": {
            }
        }
    ]

    # ==================== 8. 图标配置 ====================
    icons_data = {
        "nodeIcons": {
            "process": {"icon": "process", "fallback": "📋"},
            "operation": {"icon": "operation", "fallback": "🔧"},
            "step": {"icon": "step", "fallback": "⚙️"},
            "action-unit": {"icon": "action", "fallback": "▶️"},
            "default": {"icon": "default", "fallback": "📄"}
        }
    }

    # ==================== 9. 虚拟资源图片 ====================
    # 最小合法 PNG（10x10 像素）
    dummy_png = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\n'
        b'\x00\x00\x00\n\x08\x02\x00\x00\x00\x02P\x58\xea'
        b'\x00\x00\x00\x1aIDATx\x9cc\xfc\xff\xff\x3f\x03'
        b'\x0c\x1b\x06\xa0\x14\x00\x00\x00\xc9\x01\x13\x64'
        b'\x73\x2a\x4a\x00\x00\x00\x00IEND\xaeB`\x82'
    )

    # ==================== 打包成 ZIP (.srd) ====================
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 包清单
        zf.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))

        # 业务数据
        zf.writestr('data/process_tree.json', json.dumps(process_tree, ensure_ascii=False, indent=2))
        zf.writestr('data/process.json', json.dumps(process_data, ensure_ascii=False, indent=2))
        zf.writestr('data/operation.json', json.dumps(operation_data, ensure_ascii=False, indent=2))
        zf.writestr('data/step.json', json.dumps(step_data, ensure_ascii=False, indent=2))
        zf.writestr('data/action.json', json.dumps(action_data, ensure_ascii=False, indent=2))
        zf.writestr('data/attachment.json', json.dumps(attachment_data, ensure_ascii=False, indent=2))

        # UI 布局
        zf.writestr('layout/tabs.json', json.dumps(tabs_data, ensure_ascii=False, indent=2))
        zf.writestr('layout/tab.json', json.dumps(tab_data, ensure_ascii=False, indent=2))
        zf.writestr('layout/components.json', json.dumps(components_data, ensure_ascii=False, indent=2))
        zf.writestr('layout/icons.json', json.dumps(icons_data, ensure_ascii=False, indent=2))

        # 虚拟资源文件
        zf.writestr('assets/images/engine_exploded.png', dummy_png)
        zf.writestr('assets/images/block_clean.png', dummy_png)

    print(f"✅ SRD V6 数据包已生成: {output_path}")
    print(f"   - 工艺树节点: 1 process → 2 operations → 3 steps")
    print(f"   - 附件资源: {len(attachment_data)} 个")
    print(f"   - UI 分组: {len(tabs_data)} 个")
    print(f"   - Tab 页签: {len(tab_data)} 个")
    print(f"   - 组件: {len(components_data)} 个")


if __name__ == '__main__':
    create_v6_srd('F:/workProject/avpbc-pop/final_test_v6_package.srd')
