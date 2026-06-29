"""
在 V8发动机装配工艺_nolist_encrypted.srd 基础上，为工序节点生成新的 Tab 和 Table 组件。
新增 Tab:
  - 装入件清单 (tab_bottom_op_parts)
  - 工具清单 (tab_bottom_op_tools)
  - 拧紧记录 (tab_bottom_op_torque)
  - 检验项目 (tab_bottom_op_inspect)

数据使用 node_datasets 机制，通过 dataSource.type='dataset' + dataSource.dataKey 绑定。
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

# ========== 新增的 Tab 定义 ==========
NEW_TABS = [
    {
        "id": "tab_bottom_op_parts",
        "group_id": "group_bottom_op",
        "title": "装入件清单",
        "sort_order": 1
    },
    {
        "id": "tab_bottom_op_tools",
        "group_id": "group_bottom_op",
        "title": "工具清单",
        "sort_order": 2
    },
    {
        "id": "tab_bottom_op_torque",
        "group_id": "group_bottom_op",
        "title": "拧紧记录",
        "sort_order": 3
    },
    {
        "id": "tab_bottom_op_inspect",
        "group_id": "group_bottom_op",
        "title": "检验项目",
        "sort_order": 4
    }
]

# ========== 新增的 Component 定义 ==========
NEW_COMPONENTS = [
    {
        "id": "comp_bottom_op_parts",
        "tab_id": "tab_bottom_op_parts",
        "type": "table",
        "title": "装入件清单",
        "sort_order": 0,
        "config": {
            "dataSource": {
                "type": "dataset",
                "dataKey": "parts_list"
            },
            "fields": [
                {"label": "序号", "prop": "seq", "width": 60},
                {"label": "零件号", "prop": "partNo", "width": 150},
                {"label": "零件名称", "prop": "partName", "width": -1},
                {"label": "规格型号", "prop": "spec", "width": 160},
                {"label": "数量", "prop": "qty", "width": 70},
                {"label": "单位", "prop": "unit", "width": 60},
                {"label": "备注", "prop": "remark", "width": 120}
            ]
        }
    },
    {
        "id": "comp_bottom_op_tools",
        "tab_id": "tab_bottom_op_tools",
        "type": "table",
        "title": "工具清单",
        "sort_order": 0,
        "config": {
            "dataSource": {
                "type": "dataset",
                "dataKey": "tools_list"
            },
            "fields": [
                {"label": "序号", "prop": "seq", "width": 60},
                {"label": "工具编号", "prop": "toolNo", "width": 150},
                {"label": "工具名称", "prop": "toolName", "width": -1},
                {"label": "规格", "prop": "spec", "width": 150},
                {"label": "数量", "prop": "qty", "width": 70},
                {"label": "备注", "prop": "remark", "width": 120}
            ]
        }
    },
    {
        "id": "comp_bottom_op_torque",
        "tab_id": "tab_bottom_op_torque",
        "type": "table",
        "title": "拧紧记录",
        "sort_order": 0,
        "config": {
            "dataSource": {
                "type": "dataset",
                "dataKey": "torque_records"
            },
            "fields": [
                {"label": "序号", "prop": "seq", "width": 60},
                {"label": "拧紧点位", "prop": "position", "width": -1},
                {"label": "螺栓规格", "prop": "boltSpec", "width": 120},
                {"label": "扭矩值(N·m)", "prop": "torqueValue", "width": 120},
                {"label": "拧紧角度(°)", "prop": "torqueAngle", "width": 110},
                {"label": "拧紧策略", "prop": "strategy", "width": 120},
                {"label": "工具", "prop": "tool", "width": 120}
            ]
        }
    },
    {
        "id": "comp_bottom_op_inspect",
        "tab_id": "tab_bottom_op_inspect",
        "type": "table",
        "title": "检验项目",
        "sort_order": 0,
        "config": {
            "dataSource": {
                "type": "dataset",
                "dataKey": "inspection_items"
            },
            "fields": [
                {"label": "序号", "prop": "seq", "width": 60},
                {"label": "检验项目", "prop": "itemName", "width": -1},
                {"label": "检验方法", "prop": "method", "width": 120},
                {"label": "标准值", "prop": "standard", "width": 120},
                {"label": "公差范围", "prop": "tolerance", "width": 120},
                {"label": "检验工具", "prop": "tool", "width": 120},
                {"label": "频次", "prop": "frequency", "width": 80}
            ]
        }
    }
]

# ========== 每个工序的数据集 ==========
# 工序 OP-01 缸体组装
OP01_DATASETS = {
    "parts_list": [
        {"seq": "1", "partNo": "V8-BLK-001", "partName": "气缸体总成", "spec": "V8铝合金铸造", "qty": "1", "unit": "件", "remark": "主体铸件"},
        {"seq": "2", "partNo": "V8-PST-010", "partName": "活塞", "spec": "Φ92mm 锻造铝合金", "qty": "8", "unit": "件", "remark": "含活塞销"},
        {"seq": "3", "partNo": "V8-PSR-011", "partName": "活塞环组", "spec": "3环组(气环×2+油环×1)", "qty": "8", "unit": "套", "remark": ""},
        {"seq": "4", "partNo": "V8-CRK-020", "partName": "曲轴", "spec": "锻钢 8缸对置", "qty": "1", "unit": "件", "remark": "动平衡已校"},
        {"seq": "5", "partNo": "V8-CRD-021", "partName": "连杆", "spec": "锻钢 H型截面", "qty": "8", "unit": "件", "remark": "含连杆螺栓"},
        {"seq": "6", "partNo": "V8-BRG-022", "partName": "主轴承瓦", "spec": "三元合金 上下瓦", "qty": "5", "unit": "对", "remark": ""},
        {"seq": "7", "partNo": "V8-BRG-023", "partName": "连杆轴承瓦", "spec": "三元合金", "qty": "8", "unit": "对", "remark": ""},
        {"seq": "8", "partNo": "V8-GSK-030", "partName": "缸体下部密封垫", "spec": "金属多层复合", "qty": "1", "unit": "件", "remark": ""},
        {"seq": "9", "partNo": "V8-BLT-040", "partName": "主轴承盖螺栓", "spec": "M12×1.25×85", "qty": "10", "unit": "件", "remark": "高强度12.9级"},
        {"seq": "10", "partNo": "V8-OIL-050", "partName": "装配润滑油", "spec": "SAE 5W-30", "qty": "0.5", "unit": "L", "remark": "涂抹用"}
    ],
    "tools_list": [
        {"seq": "1", "toolNo": "TL-TQ-001", "toolName": "电动扭矩扳手", "spec": "10-200N·m", "qty": "1", "remark": "数显型"},
        {"seq": "2", "toolNo": "TL-TQ-002", "toolName": "液压扭矩扳手", "spec": "50-500N·m", "qty": "1", "remark": "用于主轴承盖"},
        {"seq": "3", "toolNo": "TL-FG-001", "toolName": "塞尺组", "spec": "0.02-1.0mm", "qty": "1", "remark": "间隙测量"},
        {"seq": "4", "toolNo": "TL-AG-001", "toolName": "角度规", "spec": "0-360°±0.5°", "qty": "1", "remark": "拧紧角度"},
        {"seq": "5", "toolNo": "TL-MG-001", "toolName": "千分尺", "spec": "0-100mm", "qty": "1", "remark": "轴径测量"},
        {"seq": "6", "toolNo": "TL-PR-001", "toolName": "活塞环压缩套", "spec": "Φ92mm专用", "qty": "1", "remark": ""},
        {"seq": "7", "toolNo": "TL-CL-001", "toolName": "清洗枪", "spec": "气动型", "qty": "1", "remark": "预装配清洗"}
    ],
    "torque_records": [
        {"seq": "1", "position": "主轴承盖螺栓(1-5号)", "boltSpec": "M12×1.25", "torqueValue": "60+90°", "torqueAngle": "90", "strategy": "扭矩+角度法", "tool": "液压扭矩扳手"},
        {"seq": "2", "position": "连杆螺栓(1-8缸)", "boltSpec": "M10×1.25", "torqueValue": "30+60°", "torqueAngle": "60", "strategy": "扭矩+角度法", "tool": "电动扭矩扳手"},
        {"seq": "3", "position": "缸体侧护板螺栓", "boltSpec": "M8×1.25", "torqueValue": "25", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"},
        {"seq": "4", "position": "油底壳螺栓", "boltSpec": "M6×1.0", "torqueValue": "10", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"}
    ],
    "inspection_items": [
        {"seq": "1", "itemName": "曲轴轴向间隙", "method": "塞尺测量", "standard": "0.05-0.20mm", "tolerance": "±0.02mm", "tool": "塞尺", "frequency": "全检"},
        {"seq": "2", "itemName": "曲轴径向跳动", "method": "百分表检测", "standard": "≤0.03mm", "tolerance": "-", "tool": "百分表+V形架", "frequency": "全检"},
        {"seq": "3", "itemName": "连杆大头孔圆度", "method": "内径量规", "standard": "Φ52.000mm", "tolerance": "±0.005mm", "tool": "内径千分尺", "frequency": "抽检20%"},
        {"seq": "4", "itemName": "活塞环端间隙", "method": "塞尺测量", "standard": "0.25-0.45mm", "tolerance": "-", "tool": "塞尺", "frequency": "全检"},
        {"seq": "5", "itemName": "活塞裙部间隙", "method": "塞尺测量", "standard": "0.02-0.04mm", "tolerance": "-", "tool": "塞尺", "frequency": "全检"},
        {"seq": "6", "itemName": "主轴承盖螺栓扭矩复检", "method": "扭矩扳手检查", "standard": "60N·m+90°", "tolerance": "角度±5°", "tool": "扭矩扳手", "frequency": "全检"}
    ]
}

# 工序 OP-02 缸盖组装
OP02_DATASETS = {
    "parts_list": [
        {"seq": "1", "partNo": "V8-CYH-100", "partName": "气缸盖(左列)", "spec": "DOHC 铝合金", "qty": "1", "unit": "件", "remark": "1-4缸"},
        {"seq": "2", "partNo": "V8-CYH-101", "partName": "气缸盖(右列)", "spec": "DOHC 铝合金", "qty": "1", "unit": "件", "remark": "5-8缸"},
        {"seq": "3", "partNo": "V8-HGK-110", "partName": "气缸垫", "spec": "MLS多层钢", "qty": "2", "unit": "件", "remark": "左右各一"},
        {"seq": "4", "partNo": "V8-CAM-120", "partName": "进气凸轮轴", "spec": "铸铁 VVT型", "qty": "2", "unit": "件", "remark": "左右列"},
        {"seq": "5", "partNo": "V8-CAM-121", "partName": "排气凸轮轴", "spec": "铸铁", "qty": "2", "unit": "件", "remark": "左右列"},
        {"seq": "6", "partNo": "V8-VLV-130", "partName": "进气门", "spec": "不锈钢 Φ34mm", "qty": "16", "unit": "件", "remark": "每缸2个"},
        {"seq": "7", "partNo": "V8-VLV-131", "partName": "排气门", "spec": "耐热钢 Φ30mm", "qty": "16", "unit": "件", "remark": "每缸2个"},
        {"seq": "8", "partNo": "V8-SPR-140", "partName": "气门弹簧", "spec": "双弹簧组", "qty": "32", "unit": "件", "remark": ""},
        {"seq": "9", "partNo": "V8-HBT-150", "partName": "缸盖螺栓", "spec": "M11×1.5×135", "qty": "20", "unit": "件", "remark": "TTY螺栓 一次性"}
    ],
    "tools_list": [
        {"seq": "1", "toolNo": "TL-TQ-003", "toolName": "电子角度扭矩扳手", "spec": "20-350N·m", "qty": "1", "remark": "缸盖螺栓专用"},
        {"seq": "2", "toolNo": "TL-VL-001", "toolName": "气门弹簧压缩器", "spec": "V8专用型", "qty": "1", "remark": ""},
        {"seq": "3", "toolNo": "TL-GM-001", "toolName": "凸轮轴正时对齐工具", "spec": "V8专用", "qty": "1", "remark": "含定位销"},
        {"seq": "4", "toolNo": "TL-DT-001", "toolName": "百分表", "spec": "0-10mm/0.01mm", "qty": "1", "remark": "凸轮轴跳动检测"},
        {"seq": "5", "toolNo": "TL-SQ-001", "toolName": "平面度检测尺", "spec": "500mm", "qty": "1", "remark": "缸盖平面度"}
    ],
    "torque_records": [
        {"seq": "1", "position": "缸盖螺栓(左列 1-10)", "boltSpec": "M11×1.5", "torqueValue": "40+90°+90°", "torqueAngle": "90+90", "strategy": "三步法", "tool": "电子角度扭矩扳手"},
        {"seq": "2", "position": "缸盖螺栓(右列 1-10)", "boltSpec": "M11×1.5", "torqueValue": "40+90°+90°", "torqueAngle": "90+90", "strategy": "三步法", "tool": "电子角度扭矩扳手"},
        {"seq": "3", "position": "凸轮轴盖螺栓", "boltSpec": "M8×1.25", "torqueValue": "20", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"},
        {"seq": "4", "position": "凸轮轴正时链轮螺栓", "boltSpec": "M10×1.25", "torqueValue": "50+45°", "torqueAngle": "45", "strategy": "扭矩+角度法", "tool": "电子角度扭矩扳手"},
        {"seq": "5", "position": "正时链条张紧器螺栓", "boltSpec": "M8×1.25", "torqueValue": "22", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"}
    ],
    "inspection_items": [
        {"seq": "1", "itemName": "缸盖平面度", "method": "直尺+塞尺", "standard": "≤0.05mm", "tolerance": "-", "tool": "平面度检测尺", "frequency": "全检"},
        {"seq": "2", "itemName": "气缸垫厚度", "method": "千分尺测量", "standard": "0.92mm", "tolerance": "±0.02mm", "tool": "外径千分尺", "frequency": "抽检10%"},
        {"seq": "3", "itemName": "凸轮轴轴向间隙", "method": "百分表", "standard": "0.05-0.15mm", "tolerance": "-", "tool": "百分表", "frequency": "全检"},
        {"seq": "4", "itemName": "气门间隙(进气)", "method": "塞尺测量", "standard": "0.20mm", "tolerance": "±0.02mm", "tool": "塞尺", "frequency": "全检"},
        {"seq": "5", "itemName": "气门间隙(排气)", "method": "塞尺测量", "standard": "0.30mm", "tolerance": "±0.02mm", "tool": "塞尺", "frequency": "全检"},
        {"seq": "6", "itemName": "正时标记对齐", "method": "目视确认", "standard": "标记对齐", "tolerance": "-", "tool": "正时对齐工具", "frequency": "全检"},
        {"seq": "7", "itemName": "缸盖螺栓扭矩复检", "method": "扭矩复查", "standard": "40+90°+90°", "tolerance": "角度±5°", "tool": "电子角度扭矩扳手", "frequency": "全检"}
    ]
}

# 工序 OP-03 附件安装
OP03_DATASETS = {
    "parts_list": [
        {"seq": "1", "partNo": "V8-INM-200", "partName": "进气歧管总成", "spec": "复合材料 可变长度", "qty": "1", "unit": "件", "remark": "含谐振阀"},
        {"seq": "2", "partNo": "V8-EXM-210", "partName": "排气歧管(左列)", "spec": "不锈钢铸件", "qty": "1", "unit": "件", "remark": "含隔热罩"},
        {"seq": "3", "partNo": "V8-EXM-211", "partName": "排气歧管(右列)", "spec": "不锈钢铸件", "qty": "1", "unit": "件", "remark": "含隔热罩"},
        {"seq": "4", "partNo": "V8-THB-220", "partName": "节气门体", "spec": "电子节气门 Φ82mm", "qty": "1", "unit": "件", "remark": ""},
        {"seq": "5", "partNo": "V8-INJ-230", "partName": "喷油器", "spec": "高压直喷 200bar", "qty": "8", "unit": "件", "remark": "含O型圈"},
        {"seq": "6", "partNo": "V8-FRL-240", "partName": "燃油分配管", "spec": "不锈钢 高压", "qty": "2", "unit": "件", "remark": "左右列"},
        {"seq": "7", "partNo": "V8-WRH-300", "partName": "发动机线束总成", "spec": "主线束", "qty": "1", "unit": "套", "remark": ""},
        {"seq": "8", "partNo": "V8-ECU-310", "partName": "ECU控制单元", "spec": "32位MCU", "qty": "1", "unit": "件", "remark": "含支架"},
        {"seq": "9", "partNo": "V8-SNS-320", "partName": "曲轴位置传感器", "spec": "霍尔型", "qty": "1", "unit": "件", "remark": ""},
        {"seq": "10", "partNo": "V8-SNS-321", "partName": "凸轮轴位置传感器", "spec": "霍尔型", "qty": "2", "unit": "件", "remark": "左右列各一"},
        {"seq": "11", "partNo": "V8-SNS-322", "partName": "氧传感器", "spec": "宽域型", "qty": "4", "unit": "件", "remark": "前后×左右"},
        {"seq": "12", "partNo": "V8-SPK-330", "partName": "火花塞", "spec": "铱金 NGK", "qty": "8", "unit": "件", "remark": ""},
        {"seq": "13", "partNo": "V8-COL-340", "partName": "点火线圈", "spec": "笔式线圈", "qty": "8", "unit": "件", "remark": "COP型"}
    ],
    "tools_list": [
        {"seq": "1", "toolNo": "TL-TQ-004", "toolName": "电动扭矩扳手", "spec": "5-50N·m", "qty": "1", "remark": "低扭矩区间"},
        {"seq": "2", "toolNo": "TL-TQ-005", "toolName": "预置扭矩扳手", "spec": "15-75N·m", "qty": "1", "remark": "歧管螺栓"},
        {"seq": "3", "toolNo": "TL-SPK-001", "toolName": "火花塞套筒", "spec": "16mm 磁吸型", "qty": "1", "remark": ""},
        {"seq": "4", "toolNo": "TL-CON-001", "toolName": "线束插接件工具", "spec": "通用释放型", "qty": "1", "remark": ""},
        {"seq": "5", "toolNo": "TL-FUL-001", "toolName": "燃油管接头扳手", "spec": "高压快接", "qty": "1", "remark": "防泄漏"},
        {"seq": "6", "toolNo": "TL-LK-001", "toolName": "泄漏检测仪", "spec": "0-600kPa", "qty": "1", "remark": "进气系统"}
    ],
    "torque_records": [
        {"seq": "1", "position": "进气歧管螺栓", "boltSpec": "M8×1.25", "torqueValue": "22", "torqueAngle": "-", "strategy": "定扭矩法 交叉拧紧", "tool": "预置扭矩扳手"},
        {"seq": "2", "position": "排气歧管螺栓(左列)", "boltSpec": "M10×1.25", "torqueValue": "35", "torqueAngle": "-", "strategy": "定扭矩法 由中心向外", "tool": "预置扭矩扳手"},
        {"seq": "3", "position": "排气歧管螺栓(右列)", "boltSpec": "M10×1.25", "torqueValue": "35", "torqueAngle": "-", "strategy": "定扭矩法 由中心向外", "tool": "预置扭矩扳手"},
        {"seq": "4", "position": "节气门体螺栓", "boltSpec": "M6×1.0", "torqueValue": "8", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"},
        {"seq": "5", "position": "喷油器压板螺栓", "boltSpec": "M6×1.0", "torqueValue": "7", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"},
        {"seq": "6", "position": "火花塞", "boltSpec": "M14×1.25", "torqueValue": "25", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "火花塞套筒+扭矩扳手"},
        {"seq": "7", "position": "ECU支架螺栓", "boltSpec": "M6×1.0", "torqueValue": "8", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"},
        {"seq": "8", "position": "传感器安装螺栓", "boltSpec": "M6×1.0", "torqueValue": "8", "torqueAngle": "-", "strategy": "定扭矩法", "tool": "电动扭矩扳手"}
    ],
    "inspection_items": [
        {"seq": "1", "itemName": "进气歧管气密性", "method": "正压检测", "standard": "保压30s 压降≤2kPa", "tolerance": "-", "tool": "泄漏检测仪", "frequency": "全检"},
        {"seq": "2", "itemName": "燃油管路气密性", "method": "加压保持", "standard": "200bar 保压60s", "tolerance": "压降≤5bar", "tool": "高压泵+压力表", "frequency": "全检"},
        {"seq": "3", "itemName": "线束导通检测", "method": "万用表通断", "standard": "各回路导通", "tolerance": "电阻<1Ω", "tool": "万用表", "frequency": "全检"},
        {"seq": "4", "itemName": "ECU供电电压", "method": "电压测量", "standard": "12.0-14.5V", "tolerance": "-", "tool": "万用表", "frequency": "全检"},
        {"seq": "5", "itemName": "传感器信号检测", "method": "示波器", "standard": "信号波形正常", "tolerance": "-", "tool": "示波器", "frequency": "抽检30%"},
        {"seq": "6", "itemName": "火花塞间隙", "method": "间隙规", "standard": "0.8mm", "tolerance": "±0.05mm", "tool": "火花塞间隙规", "frequency": "全检"}
    ]
}

# 工序 ID 与数据集的映射
OP_DATASET_MAP = {
    "proc_v8_engine_op01": OP01_DATASETS,
    "proc_v8_engine_op02": OP02_DATASETS,
    "proc_v8_engine_op03": OP03_DATASETS
}

def build_node_datasets():
    """构建 node_datasets.json 数据"""
    datasets = []
    ds_id = 1
    for op_id, dataset_map in OP_DATASET_MAP.items():
        for data_key, rows in dataset_map.items():
            datasets.append({
                "id": f"ds_{ds_id:04d}",
                "nodeInnerId": op_id,
                "dataKey": data_key,
                "rows": rows,
                "sortOrder": ds_id
            })
            ds_id += 1
    return datasets

def fix_tree_tabs_top(tree_nodes):
    """修复工序节点的 tabs_top 从旧的 group_procedure_view 到新的 group_operation_view"""
    for node in tree_nodes:
        if node.get('tabs_top') == 'group_procedure_view':
            node['tabs_top'] = 'group_operation_view'
        if 'children' in node:
            fix_tree_tabs_top(node['children'])
    return tree_nodes

def main():
    in_path = '../V8发动机装配工艺_nolist_encrypted.srd'
    out_path = '../V8发动机装配工艺_V12_encrypted.srd'
    
    print(f"读取并解密 {in_path} ...")
    with open(in_path, 'rb') as f:
        encrypted_data = f.read()
    zip_data = decrypt_data(encrypted_data)
    
    out_zip_io = io.BytesIO()
    written = set()
    
    with zipfile.ZipFile(io.BytesIO(zip_data), 'r') as zin, zipfile.ZipFile(out_zip_io, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in written:
                continue
            written.add(item.filename)
            content = zin.read(item.filename)
            
            if item.filename.endswith('manifest.json'):
                data = json.loads(content.decode('utf-8'))
                data['version'] = '12.0'
                data['description'] = 'V12: 工序级新增装入件清单/工具清单/拧紧记录/检验项目Tab'
                # 添加 node_datasets 路径引用
                data['files']['nodeDatasets'] = 'data/node_datasets.json'
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ manifest.json 已更新版本号为 12.0, 增加 nodeDatasets 路径")
            
            elif item.filename.endswith('tab.json'):
                data = json.loads(content.decode('utf-8'))
                data.extend(NEW_TABS)
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print(f"  ✓ tab.json 新增 {len(NEW_TABS)} 个Tab页签")
            
            elif item.filename.endswith('components.json'):
                data = json.loads(content.decode('utf-8'))
                data.extend(NEW_COMPONENTS)
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print(f"  ✓ components.json 新增 {len(NEW_COMPONENTS)} 个Table组件")
            
            elif item.filename.endswith('process_tree.json'):
                data = json.loads(content.decode('utf-8'))
                data = fix_tree_tabs_top(data)
                content = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
                print("  ✓ process_tree.json 修复 tabs_top: group_procedure_view → group_operation_view")
            
            zout.writestr(item, content)
        
        # 写入新的 node_datasets.json
        node_datasets = build_node_datasets()
        ds_content = json.dumps(node_datasets, ensure_ascii=False, indent=2).encode('utf-8')
        zout.writestr('data/node_datasets.json', ds_content)
        print(f"  ✓ 新增 data/node_datasets.json ({len(node_datasets)} 条数据集记录)")
    
    print(f"\n加密并写入 {out_path} ...")
    new_encrypted = encrypt_data(out_zip_io.getvalue())
    with open(out_path, 'wb') as f:
        f.write(new_encrypted)
    
    print(f"\n✅ 生成完成: {out_path}")
    print(f"   文件大小: {len(new_encrypted)} bytes")
    print("\n新增内容摘要:")
    print("  工序详情区新增 Tab:")
    for t in NEW_TABS:
        print(f"    - {t['title']} ({t['id']})")
    print("  工序详情区新增 Table 组件:")
    for c in NEW_COMPONENTS:
        print(f"    - {c['title']} → dataKey={c['config']['dataSource']['dataKey']}")
    print("  数据集数据量:")
    for op_id, ds in OP_DATASET_MAP.items():
        for dk, rows in ds.items():
            print(f"    {op_id}/{dk}: {len(rows)} 行")

if __name__ == '__main__':
    main()
