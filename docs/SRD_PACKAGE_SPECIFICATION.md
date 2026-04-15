# SRD 数据包规范说明 (V5)

> **文档版本**: 5.2  
> **最后更新**: 2026-04-15  
> **适用对象**: MPM 离线工艺预览系统 — 数据包制作与集成开发人员

---

## 1. 概述

SRD (Structured Resource Data) 是 MPM 离线工艺预览系统使用的标准数据分发格式。它本质上是一个 **ZIP 压缩包**（扩展名为 `.srd`），内部包含工艺树结构、UI 布局配置、附件资源清单以及多媒体素材等文件。

客户端在导入 `.srd` 文件后，会将其中的数据解析并持久化到本地数据库（Android/Harmony 使用 SQLite/RDB，Web 使用 IndexedDB），从而实现**完全离线**的工艺浏览体验。

---

## 2. 包目录结构

```
*.srd (ZIP)
├── manifest.json                  # 包清单（入口文件）
├── data/
│   ├── process_tree.json          # 工艺树结构（核心）
│   ├── attachment.json            # 附件资源清单（独立于工艺树）
│   └── records.json               # 静态数据记录
├── layout/
│   ├── groups.json                # Tab 分组定义
│   ├── tabs.json                  # Tab 页签定义
│   ├── components.json            # UI 组件配置
│   └── icons.json                 # 图标映射配置
└── assets/                        # 多媒体资源目录
    ├── images/                    # 图片文件
    ├── videos/                    # 视频文件
    ├── audios/                    # 音频文件
    ├── documents/                 # PDF 等文档
    ├── cad/                       # CAD 图纸（HTML 格式）
    ├── docs/                      # 其他文档
    └── icons/                     # SVG 图标文件
```

---

## 3. manifest.json — 包清单

包的入口文件，声明包的基本信息和各数据文件的路径映射。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 数据包名称 |
| `version` | string | ✅ | 数据包版本号（如 `"5.0"`） |
| `description` | string | 否 | 包的简要描述 |
| `exportTime` | string | 否 | 导出时间（ISO 8601 格式） |
| `files` | object | ✅ | 文件路径映射表 |

### files 对象字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `groups` | string | ✅ | Tab 分组文件路径 |
| `tabs` | string | ✅ | Tab 页签文件路径 |
| `components` | string | ✅ | UI 组件配置文件路径 |
| `icons` | string | 否 | 图标配置文件路径 |
| `records` | string | 否 | 静态数据记录文件路径 |
| `assets` | string | 否 | 资源文件根目录路径 |
| `attachment` | string | 否 | 独立附件清单文件路径（V5 新增） |
| `descriptions` | string | 否 | 节点富文本内容文件路径（V5.2 新增） |

> **注意**：`data/process_tree.json` 为固定路径，不在 `files` 中显式声明，系统自动从该路径加载工艺树。

### 示例

```json
{
  "name": "V8发动机总装工艺包（V5）",
  "version": "5.0",
  "description": "含工艺树、附件清单及 UI 布局",
  "exportTime": "2026-04-11T11:28:00+08:00",
  "files": {
    "groups": "layout/groups.json",
    "tabs": "layout/tabs.json",
    "components": "layout/components.json",
    "icons": "layout/icons.json",
    "records": "data/records.json",
    "assets": "assets/",
    "attachment": "data/attachment.json",
    "descriptions": "data/descriptions.json"
  }
}
```

---

## 4. data/process_tree.json — 工艺树

### 4.1 设计理念

工艺树是整个数据包的**核心数据结构**，采用严格的四级树形层次：

```
Process（工艺）
  └── Operation（工序）
        └── Step（工步）
              └── ActionUnit（动作单元）
```

每一级节点使用统一的 `ProcessNode` 类型，通过 `targetClassId` 字段区分层级。节点不可跳级嵌套。

> **重要设计决策**：从 V5 版本起，附件数据已**从工艺树中剥离**，独立存储于 `data/attachment.json`。工艺树仅保留纯粹的树状结构和元数据，不再包含任何附件数组，以优化文件体积和解析性能。

### 4.2 通用节点字段

以下字段适用于所有层级的节点：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `innerId` | string | ✅ | 节点全局唯一标识符，也是附件关联的外键 |
| `code` | string | ✅ | 节点编号（如 `"ASM-ENG-V8"`、`"OP-01"`、`"S-01"`） |
| `name` | string | ✅ | 节点名称 |
| `targetClassId` | string | ✅ | 层级标识，取值：`Process` / `Operation` / `Step` / `ActionUnit` |
| `classId` | string | 否 | 自定义分类标识（如 `"JJGY"` 表示机加工艺） |
| `tabs_top` | string | ✅ | 上方 Tab 组 ID（引用 `groups.json` 中的 `id`） |
| `tabs_bottom` | string | 否 | 下方 Tab 组 ID（空字符串则隐藏下方区域） |
| `children` | ProcessNode[] | ✅ | 子节点数组（严格下一级，`ActionUnit` 必须为空数组） |

### 4.3 根节点（Process 级）扩展字段

以下字段仅在根节点（`targetClassId = "Process"`）上存在：

#### 工艺信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 工艺版本号（如 `"3.0.0"`） |
| `classId_display` | string | 工艺分类显示名（如 `"机加工艺"`） |
| `classId_business_icon` | string | 业务图标路径 |
| `classId_icon` | string | 树节点图标路径 |
| `modifyById` | string | 最后修改人 ID |
| `modifyById_display` | string | 最后修改人姓名 |
| `modifyTime` | string | 最后修改时间 |
| `contextName` | string | 所属知识库名称 |
| `phaseId` | string | 工艺阶段 ID |
| `phaseId_display` | string | 工艺阶段中文名（如 `"试样阶段"`） |
| `secretId` | string | 密级 ID |
| `secretId_display` | string | 密级中文名（如 `"公开"`） |
| `stateName` | string | 工艺状态名称（如 `"设计中"`、`"已发布"`） |
| `fullversionNo` | string | 完整版本号（如 `"A.1"`） |

#### 关联部件信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `partCode` | string | 部件编号 |
| `partName` | string | 部件名称 |
| `partClassId` | string | 部件分类标识 |
| `partClassId_display` | string | 部件分类显示名 |
| `partClassId_business_icon` | string | 部件业务图标路径 |
| `partModifyById` | string | 部件最后修改人 ID |
| `partModifyById_display` | string | 部件最后修改人姓名 |
| `partModifyTime` | string | 部件最后修改时间 |
| `partContextName` | string | 部件所属库名称 |
| `partPhaseId` | string | 部件阶段 ID |
| `partPhaseId_display` | string | 部件阶段中文名 |
| `partSecretId` | string | 部件密级 ID |
| `partSecretId_display` | string | 部件密级中文名 |
| `partStateName` | string | 部件状态名称 |
| `partFullversionNo` | string | 部件完整版本号 |

### 4.4 `_display` 命名约定

带有 `_display` 后缀的字段是 **ID 字段的中文友好名称映射**，供 UI 直接展示使用。例如：

- `classId = "JJGY"` → `classId_display = "机加工艺"`
- `phaseId = "phase_trial_001"` → `phaseId_display = "试样阶段"`
- `secretId = "10"` → `secretId_display = "公开"`

### 4.5 精简后的节点示例

```json
{
  "innerId": "proc_v8_engine",
  "code": "ASM-ENG-V8",
  "name": "V8发动机总装工艺",
  "targetClassId": "Process",
  "classId": "JJGY",
  "classId_display": "机加工艺",
  "tabs_top": "group_process_view",
  "tabs_bottom": "group_bottom_proc",
  "children": [
    {
      "innerId": "proc_v8_engine_op01",
      "code": "OP-01",
      "name": "缸体组装",
      "targetClassId": "Operation",
      "classId": "",
      "tabs_top": "group_procedure_view",
      "tabs_bottom": "group_bottom_op",
      "children": [
        {
          "innerId": "proc_v8_engine_op01_s01",
          "code": "S-01",
          "name": "清洗缸体",
          "targetClassId": "Step",
          "children": []
        }
      ]
    }
  ]
}
```

---

## 5. data/descriptions.json — 节点富文本内容 (V5.2)

### 5.1 设计背景

在大型工艺包中，节点（Process/Operation/Step）往往包含大量的 HTML 富文本描述、安全提示、工艺注意事项等。
如果将这些庞大的 HTML 字符串直接嵌套在 `process_tree.json` 中，会导致树形结构文件体积剧增，在移动端触发大量的内存占用，并显著拖慢 `JSON.parse` 的解析速度（可能造成 2-5 秒的 UI 线程阻塞）。

为了优化性能，V5.2 引入了**描述内容解耦模式**。

### 5.2 存储规范

`descriptions.json` 是一个顶级数组，存储所有具有富文本描述的节点内容。系统会按需通过 `innerId` 查询此文件入库后的数据。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nodeId` | string | ✅ | 关联节点 `innerId`（外键） |
| `description_html` | string | 否 | 工艺描述 HTML 字符串 |
| `safety_notice` | string | 否 | 安全预防措施 |
| `technical_requirement` | string | 否 | 技术要求/标准说明 |

### 5.3 示例

```json
[
  {
    "nodeId": "proc_v8_engine_op01",
    "description_html": "<h3>工序描述</h3><p>本工序主要负责 V8 发动机缸体的基础组装，包含...</p>",
    "safety_notice": "操作时必须佩戴静电手环和劳保手套。"
  },
  {
    "nodeId": "proc_v8_engine_op01_s01",
    "description_html": "<p>使用高压喷淋设备冲洗缸体内部油道...</p>"
  }
]
```

### 5.4 加载策略

1. **导入期**：解压缩并在后台将内容存入 `t_node_content` 数据库表。
2. **预览期**：`process_tree.json` 加载时不包含这些内容，UI 界面仅在用户点击“展开”行时，通过 `nodeId` 异步查询数据库并渲染。
          "name": "缸体预处理",
          "targetClassId": "Step",
          "classId": "",
          "tabs_top": "group_step_view",
          "tabs_bottom": "group_bottom_step",
          "children": []
        }
      ]
    }
  ],
  "version": "3.0.0",
  "stateName": "设计中",
  "modifyById": "U20260101001",
  "modifyById_display": "张三",
  "modifyTime": "2026-03-21 14:06:17",
  "contextName": "工艺知识库",
  "phaseId": "phase_trial_001",
  "phaseId_display": "试样阶段",
  "secretId": "10",
  "secretId_display": "公开",
  "fullversionNo": "A.1",
  "partCode": "PART-V8-001",
  "partName": "V8涡轮增压发动机总成",
  "partClassId": "Part",
  "partClassId_display": "部件",
  "partModifyById": "U20260101001",
  "partModifyById_display": "张三",
  "partModifyTime": "2026-03-21 14:06:17",
  "partContextName": "部件库",
  "partPhaseId": "phase_part_trial_001",
  "partPhaseId_display": "试样阶段",
  "partSecretId": "10",
  "partSecretId_display": "公开",
  "partStateName": "设计中",
  "partFullversionNo": "A.1"
}
```

---

## 5. data/attachment.json — 附件资源清单

### 5.1 设计理念

附件数据从工艺树中独立出来，以**平铺数组**的形式存储。每条附件记录通过 `nodeId` 字段关联到工艺树中的某个节点（`innerId`），实现一对多的关系映射。

这种设计的优势：
- **工艺树瘦身**：`process_tree.json` 不再包含大量附件信息，解析更快
- **灵活查询**：导入后通过数据库 `SELECT * FROM t_resources WHERE node_id = ?` 即可快速检索
- **向后兼容**：如果包内不存在此文件，系统会回退到从工艺树节点的 `attachment` 字段中提取

### 5.2 字段说明

`attachment.json` 是一个 JSON 数组，每个元素的结构如下：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 资源唯一 ID |
| `nodeId` | string | ✅ | 关联的工艺树节点 ID（对应节点的 `innerId`） |
| `type` | string | ✅ | 资源类型，见下表 |
| `name` | string | ✅ | 显示名称 |
| `path` | string | ✅ | 包内资源文件路径（相对于包根目录） |
| `thumbnail` | string | 否 | 缩略图路径 |
| `duration` | number | 否 | 时长（秒），仅视频/音频有效 |
| `size` | number | 否 | 文件大小（字节） |
| `description` | string | 否 | 资源描述 |

### 5.3 资源类型枚举

| type 值 | 说明 | 常见扩展名 |
|---------|------|------------|
| `image` | 图片 | `.png` `.jpg` `.jpeg` `.svg` |
| `video` | 视频 | `.mp4` `.mov` `.avi` |
| `audio` | 音频 | `.mp3` `.wav` `.aac` |
| `document` | 文档 | `.pdf` `.doc` `.docx` |
| `cad` | CAD 图纸 | `.html`（内嵌 3D 查看器） |

### 5.4 示例

```json
[
  {
    "id": "res_proc_001",
    "type": "video",
    "name": "工艺总览视频",
    "path": "assets/videos/engine_overview.mp4",
    "thumbnail": "assets/images/thumb_video_overview.jpg",
    "duration": 180,
    "description": "V8发动机总装工艺完整流程演示",
    "nodeId": "proc_v8_engine"
  },
  {
    "id": "res_cad_001",
    "type": "cad",
    "name": "装配CAD图纸.html",
    "path": "assets/cad/process-cad-viewer.html",
    "description": "卡伦特供应商提供的装配CAD图纸（HTML格式）",
    "nodeId": "proc_v8_engine"
  },
  {
    "id": "res_s01_001",
    "type": "image",
    "name": "清洁前状态",
    "path": "assets/images/clean_before.jpg",
    "description": "缸体清洁前的状态照片",
    "nodeId": "proc_v8_engine_op01_s01"
  }
]
```

---

## 6. layout/groups.json — Tab 分组

定义 UI 中的 Tab 区域分组。每个分组对应界面上的一个 Tab 容器（如左侧面板、上方视图区、下方详情区）。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 分组唯一 ID（被工艺树节点的 `tabs_top` / `tabs_bottom` 引用） |
| `name` | string | ✅ | 分组显示名称 |
| `type` | string | ✅ | 固定为 `"tab-group"` |
| `description` | string | 否 | 描述信息 |
| `sort_order` | number | ✅ | 排序序号 |

### 完整分组清单

系统定义了 7 个 Tab 分组，按 `sort_order` 排列：

| sort_order | id | name | 位置 | 说明 |
|------------|------|------|------|------|
| 0 | `group_process_mgmt` | 工艺管理 | 左侧面板 | 工艺结构树和工艺列表所在区域 |
| 1 | `group_process_view` | 工艺视图 | 上方视图区 | 选中 Process 节点时显示 |
| 2 | `group_procedure_view` | 工序视图 | 上方视图区 | 选中 Operation 节点时显示 |
| 3 | `group_step_view` | 工步视图 | 上方视图区 | 选中 Step 节点时显示 |
| 4 | `group_bottom_proc` | 工艺详情 | 下方详情区 | 选中 Process 节点时显示 |
| 5 | `group_bottom_op` | 工序详情 | 下方详情区 | 选中 Operation 节点时显示 |
| 6 | `group_bottom_step` | 工步详情 | 下方详情区 | 选中 Step 节点时显示 |

### 示例

```json
[
  {
    "id": "group_process_mgmt",
    "name": "工艺管理",
    "type": "tab-group",
    "description": "Left Panel Group",
    "sort_order": 0
  },
  {
    "id": "group_process_view",
    "name": "工艺视图",
    "type": "tab-group",
    "description": "Selected Process View (Middle Top)",
    "sort_order": 1
  },
  {
    "id": "group_procedure_view",
    "name": "工序视图",
    "type": "tab-group",
    "description": "Selected Procedure View (Middle Top)",
    "sort_order": 2
  },
  {
    "id": "group_step_view",
    "name": "工步视图",
    "type": "tab-group",
    "description": "Selected Step View (Middle Top)",
    "sort_order": 3
  },
  {
    "id": "group_bottom_proc",
    "name": "工艺详情",
    "type": "tab-group",
    "description": "Selected Process Details (Middle Bottom)",
    "sort_order": 4
  },
  {
    "id": "group_bottom_op",
    "name": "工序详情",
    "type": "tab-group",
    "description": "Selected Procedure Details (Middle Bottom)",
    "sort_order": 5
  },
  {
    "id": "group_bottom_step",
    "name": "工步详情",
    "type": "tab-group",
    "description": "Selected Step Details (Middle Bottom)",
    "sort_order": 6
  }
]
```

### 分组与界面位置的映射关系

```
┌─────────────────────────────────────────────────────┐
│  左侧面板              │    上方视图区 (tabs_top)     │
│                        │  ┌────────────────────────┐│
│  group_process_mgmt    │  │ group_process_view     ││
│  ├─ 工艺结构树         │  │ group_procedure_view   ││
│  └─ 工艺列表           │  │ group_step_view        ││
│                        │  └────────────────────────┘│
│                        │    下方详情区 (tabs_bottom)   │
│                        │  ┌────────────────────────┐│
│                        │  │ group_bottom_proc      ││
│                        │  │ group_bottom_op         ││
│                        │  │ group_bottom_step       ││
│                        │  └────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

> **动态切换**：上方和下方区域的可见分组由当前选中节点的 `tabs_top` 和 `tabs_bottom` 字段动态决定。例如，选中一个 Operation 节点时，上方显示 `group_procedure_view`，下方显示 `group_bottom_op`。

---

## 7. layout/tabs.json — Tab 页签

定义各分组内的具体 Tab 页签。每个 Tab 属于某个 Group，内部可挂载多个 Component。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | Tab 唯一 ID |
| `group_id` | string | ✅ | 所属分组 ID（引用 `groups.json` 中的 `id`） |
| `title` | string | ✅ | Tab 显示标题 |
| `sort_order` | number | ✅ | 在分组内的排序序号 |

### 完整页签清单

按分组归类如下：

#### 左侧面板（group_process_mgmt）

| id | title | sort_order |
|----|-------|------------|
| `left_panel` | 工艺结构树 | 0 |
| `tab_process_list` | 工艺列表 | 1 |

#### 上方 — 工艺视图（group_process_view）

| id | title | sort_order |
|----|-------|------------|
| `tab_proc_info` | 基本信息 | 0 |
| `tab_proc_children` | 工序列表 | 1 |

#### 上方 — 工序视图（group_procedure_view）

| id | title | sort_order |
|----|-------|------------|
| `tab_procedure_info` | 工序详情 | 0 |
| `tab_procedure_children` | 工步列表 | 1 |

#### 上方 — 工步视图（group_step_view）

| id | title | sort_order |
|----|-------|------------|
| `tab_step_info` | 操作说明 | 0 |
| `tab_step_resources` | 资源列表 | 1 |

#### 下方 — 工艺详情（group_bottom_proc）

| id | title | sort_order |
|----|-------|------------|
| `tab_bottom_proc_ov` | 概览 | 0 |
| `tab_bottom_proc_product` | 产品信息 | 1 |
| `tab_bottom_proc_quality` | 质量要求 | 2 |

#### 下方 — 工序详情（group_bottom_op）

| id | title | sort_order |
|----|-------|------------|
| `tab_bottom_op_ov` | 概览 | 0 |

#### 下方 — 工步详情（group_bottom_step）

| id | title | sort_order |
|----|-------|------------|
| `tab_bottom_step_ov` | 说明 | 0 |

### 示例

```json
[
  {
    "id": "left_panel",
    "group_id": "group_process_mgmt",
    "title": "工艺结构树",
    "sort_order": 0
  },
  {
    "id": "tab_proc_info",
    "group_id": "group_process_view",
    "title": "基本信息",
    "sort_order": 0
  },
  {
    "id": "tab_proc_children",
    "group_id": "group_process_view",
    "title": "工序列表",
    "sort_order": 1
  },
  {
    "id": "tab_procedure_info",
    "group_id": "group_procedure_view",
    "title": "工序详情",
    "sort_order": 0
  },
  {
    "id": "tab_bottom_proc_ov",
    "group_id": "group_bottom_proc",
    "title": "概览",
    "sort_order": 0
  }
]
```

---

## 8. layout/components.json — UI 组件配置

定义挂载在各 Tab 下的具体 UI 组件及其数据绑定方式。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 组件唯一 ID |
| `tab_id` | string | ✅ | 所挂载的 Tab ID（引用 `tabs.json` 中的 `id`） |
| `type` | string | ✅ | 组件类型，见下表 |
| `title` | string | ✅ | 组件显示标题 |
| `sort_order` | number | ✅ | 在 Tab 内的排序序号 |
| `config` | object | ✅ | 组件配置，内容因 `type` 而异 |

### 组件类型枚举

| type 值 | 说明 | 典型用途 |
|---------|------|----------|
| `process-tree` | 工艺树组件 | 左侧导航树 |
| `table` | 数据表格 | 列表型数据展示（工序/工步列表） |
| `infoView` | 信息视图（键值对） | 节点基本信息展示 |
| `list` | 简单列表 | 工具/物料清单 |

### config 配置详解

#### dataSource（数据源）

`dataSource` 决定组件从哪里获取数据：

| dataSource 值 | 类型 | 说明 |
|---------------|------|------|
| `"self"` | string | 当前选中节点自身数据 |
| `"children"` | string | 当前选中节点的子节点列表 |
| `{ type, name }` | object | 引用特定数据库表（如 `t_process`） |

#### fields（用于 infoView 类型）

定义要展示的字段列表，使用 `vModel` 指定数据绑定的字段名，`columns` 指定每行列数：

```json
{
  "dataSource": "self",
  "fields": [
    { "label": "工艺代码", "vModel": "code" },
    { "label": "工艺名称", "vModel": "name" },
    { "label": "版本", "vModel": "version" },
    { "label": "状态", "vModel": "stateName" }
  ],
  "columns": 2
}
```

#### columns（用于 table 类型）

定义表格列配置：

```json
{
  "dataSource": "children",
  "columns": [
    { "label": "代码", "prop": "code", "width": 180 },
    { "label": "名称", "prop": "name", "width": 350 }
  ]
}
```

### 完整组件清单

| id | tab_id | type | title |
|----|--------|------|-------|
| `comp_process_tree` | `left_panel` | `process-tree` | 工艺树 |
| `comp_process_table` | `tab_process_list` | `table` | 工艺总览表 |
| `comp_proc_info` | `tab_proc_info` | `infoView` | 工艺基本信息 |
| `comp_proc_list` | `tab_proc_children` | `table` | 工序列表 |
| `comp_procedure_info` | `tab_procedure_info` | `infoView` | 工序详情 |
| `comp_procedure_list` | `tab_procedure_children` | `table` | 工步列表 |
| `comp_step_basic` | `tab_step_info` | `infoView` | 基本信息 |
| `comp_bottom_proc_info` | `tab_bottom_proc_ov` | `infoView` | 工艺概览 |
| `comp_bottom_proc_product` | `tab_bottom_proc_product` | `infoView` | 关联产品 |
| `comp_bottom_proc_quality` | `tab_bottom_proc_quality` | `infoView` | 质量标准 |
| `comp_bottom_op_info` | `tab_bottom_op_ov` | `infoView` | 工序概览 |
| `comp_bottom_step_info` | `tab_bottom_step_ov` | `infoView` | 工步基本信息 |

### 完整组件示例

```json
{
  "id": "comp_proc_info",
  "tab_id": "tab_proc_info",
  "type": "infoView",
  "title": "工艺基本信息",
  "sort_order": 0,
  "config": {
    "dataSource": "self",
    "fields": [
      { "label": "工艺代码", "vModel": "code" },
      { "label": "工艺名称", "vModel": "name" },
      { "label": "版本", "vModel": "version" },
      { "label": "状态", "vModel": "stateName" }
    ],
    "columns": 2
  }
}
```

```json
{
  "id": "comp_proc_list",
  "tab_id": "tab_proc_children",
  "type": "table",
  "title": "工序列表",
  "sort_order": 0,
  "config": {
    "dataSource": "children",
    "columns": [
      { "label": "代码", "prop": "code", "width": 180 },
      { "label": "名称", "prop": "name", "width": 350 }
    ]
  }
}
```

---

## 9. layout/icons.json — 图标配置

定义工艺树各节点类型的图标映射。

### 字段说明

```json
{
  "nodeIcons": {
    "<节点类型>": {
      "icon": "<图标名称，对应 assets/icons/ 下的 SVG 文件名（不含扩展名）>",
      "fallback": "<备用 Emoji 图标>"
    }
  }
}
```

### 示例

```json
{
  "nodeIcons": {
    "process": { "icon": "process", "fallback": "📋" },
    "procedure": { "icon": "procedure", "fallback": "🔧" },
    "step": { "icon": "step", "fallback": "⚙️" },
    "default": { "icon": "default", "fallback": "📄" }
  }
}
```

系统会优先加载 `assets/icons/{icon}.svg`，加载失败时使用 `fallback` 字符。

---

## 10. data/records.json — 静态数据记录

存储与特定组件绑定的静态数据。每条记录通过 `component_id` 关联到 `components.json` 中的某个组件。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `record_id` | string | ✅ | 记录唯一 ID |
| `component_id` | string | ✅ | 关联的组件 ID |
| `data` | object | ✅ | 数据内容（键值对，字段名自由定义） |

### 示例

```json
[
  {
    "record_id": "rec_proc_1",
    "component_id": "comp_process_table",
    "data": {
      "code": "ASM-ENG-V8",
      "name": "V8发动机总装工艺",
      "version": "2.1.0",
      "status": "已发布",
      "productModel": "V8-T-2024"
    }
  },
  {
    "record_id": "rec_qa_1",
    "component_id": "comp_qa_collapse",
    "data": {
      "title": "外观检查",
      "检测项目": "表面质量",
      "检测方法": "目视检查",
      "合格标准": "无裂纹、划痕、毛刺",
      "检测频次": "100%"
    }
  }
]
```

---

## 11. assets/ — 资源文件目录

存放数据包中所有的多媒体资源文件。目录结构约定如下：

| 子目录 | 用途 | 常见文件类型 |
|--------|------|-------------|
| `assets/images/` | 图片资源 | PNG, JPG, SVG |
| `assets/videos/` | 视频资源 | MP4, MOV |
| `assets/audios/` | 音频资源 | MP3, WAV |
| `assets/documents/` | PDF 文档 | PDF |
| `assets/docs/` | 其他文档 | PDF, DOCX |
| `assets/cad/` | CAD 图纸查看器 | HTML |
| `assets/icons/` | 节点图标 | SVG |

> **路径引用规则**：`attachment.json` 和 `records.json` 中的 `path` 字段应使用相对于包根目录的路径，如 `"assets/images/engine_exploded.png"`。

---

## 12. 数据关联关系总览

```
manifest.json
    │
    ├── files.groups ──────────► layout/groups.json
    │                               │
    │                               └── groups[].id ◄──── tabs[].group_id
    │                                                          │
    ├── files.tabs ────────────► layout/tabs.json              │
    │                               │                          │
    │                               └── tabs[].id ◄──── components[].tab_id
    │                                                          │
    ├── files.components ──────► layout/components.json        │
    │                               │                          │
    │                               └── comp.id ◄──── records[].component_id
    │                                                          │
    ├── files.records ─────────► data/records.json             │
    │                                                          │
    ├── files.attachment ──────► data/attachment.json           │
    │                               │                          │
    │                               └── attachment[].nodeId ◄──┤
    │                                                          │
    └── (隐含) ────────────────► data/process_tree.json        │
                                    │                          │
                                    ├── node.innerId ──────────┘
                                    ├── node.tabs_top ──► groups[].id
                                    └── node.tabs_bottom ──► groups[].id
```

---

## 13. 导入流程简述

```
1. 解压 .srd 文件
2. 读取 manifest.json，获取各文件路径
3. 解析 layout/ 下的 UI 配置 → 写入数据库
4. 解析 data/process_tree.json → 写入 t_process 表
5. 解析 data/attachment.json → 提取资源 → 写入 t_resources 表
   （若无 attachment.json，回退从 process_tree 节点中提取）
6. 复制 assets/ 下的文件到本地存储
7. 完成导入，界面可离线浏览
```

---

## 14. 版本兼容说明

| 版本 | 变更 |
|------|------|
| V1-V3 | 旧版格式，manifest 中内联所有数据 |
| V4 | 引入四级工艺树、`layout/` 独立目录、`resources` 字段 |
| V5 | `resources` 重命名为 `attachment`；附件从工艺树剥离至独立的 `data/attachment.json`；移除废弃字段（`description_html`、`processDescription`、`productName`、`productModel`、`targetVehicle`、`qualityLevel`、`inspectionType`、`qualityChecks`）；工艺树 `status` 字段移除，统一使用 `stateName` |

> **向后兼容**：V5 客户端可以正常导入 V4 及更早版本的数据包。当检测到包内不存在 `data/attachment.json` 时，系统会自动回退到从工艺树节点的 `attachment`（或旧版 `resources`）字段中递归提取附件。
