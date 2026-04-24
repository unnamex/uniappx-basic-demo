# SRD 数据包规范说明 (V6)

> **文档版本**: 6.3  
> **最后更新**: 2026-04-24  
> **适用对象**: MPM 离线工艺预览系统 — 数据包制作与集成开发人员

---

## 1. 概述

SRD (Structured Resource Data) 是 MPM 离线工艺预览系统使用的标准数据分发格式。它本质上是一个 **ZIP 压缩包**（扩展名为 `.srd`），内部包含工艺树结构、UI 布局配置、附件资源清单以及多媒体素材等文件。

客户端在导入 `.srd` 文件后，会将其中的数据解析并持久化到本地数据库：
- **Android**: SQLite (`mpm_offline.db`)
- **HarmonyOS Next**: RDB (`@ohos.data.relationalStore`)
- **Web**: IndexedDB (`mpm_offline.db`, 版本号 8)

从而实现**完全离线**的工艺浏览体验。

### 1.1 支持平台

系统通过条件编译 (`#ifdef`) 为以下平台提供原生适配：

| 平台 | 数据库引擎 | ZIP 解压方式 | 资源存储 |
|------|-----------|-------------|---------|
| APP-ANDROID | SQLite (android.database.sqlite) | java.util.zip.ZipInputStream | 应用沙箱 filesDir |
| APP-HARMONY | RDB (@ohos.data.relationalStore) | uni FileSystemManager.unzip | 应用沙箱 USER_DATA_PATH |
| WEB | IndexedDB | JSZip | Blob URL + IndexedDB |

### 1.2 加密支持

数据包支持可选的 **AES-256-CBC** 加密封装。加密文件结构为：前 16 字节为 IV，后续为密文。导入时系统会先尝试使用 `decryptPackage()` 解密，失败则回退按未加密 ZIP 处理。

各平台的加密实现（`utils/crypto.uts`）：
- **Android**: 使用 `javax.crypto.Cipher` (AES/CBC/PKCS5Padding)
- **HarmonyOS**: 使用 `@ohos.security.cryptoFramework` (AES256|CBC|PKCS7)
- **Web**: 待实现（当前回退为明文处理）

完整性校验使用 MD5 算法（通过 `verifyChecksum()` 函数），各平台使用原生 API 实现。

---

## 2. 包目录结构

```
*.srd (ZIP)
├── manifest.json                  # 包清单（入口文件）
├── data/                          # 关系型数据表目录
│   ├── process_tree.json          # 轻量工艺树骨架（导航用）
│   ├── process.json               # 工艺表数据
│   ├── operation.json             # 工序表数据
│   ├── step.json                  # 工步表数据
│   ├── action.json                # 动作表数据
│   └── attachment.json            # 附件资源清单
├── layout/                        # UI 布局配置目录
│   ├── tabs.json                  # Tab 分组定义
│   ├── tab.json                   # Tab 页签定义
│   ├── components.json            # UI 组件配置
│   └── icons.json                 # 图标映射配置
└── assets/                        # 多媒体资源目录
    ├── images/                    # 图片文件
    ├── videos/                    # 视频文件
    ├── audios/                    # 音频文件
    ├── documents/                 # PDF 等文档
    ├── cad/                       # CAD 图纸（HTML 格式）
    ├── docs/                      # 其他文档
    └── icons/                     # SVG 图标文件（不导入，使用项目静态资源）
```

---

## 3. manifest.json — 包清单

包的入口文件，声明包的基本信息和各数据文件的路径映射。

### 3.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 数据包名称 |
| `version` | string | ✅ | 数据包版本号（**必须 ≥ `"6.0"`**） |
| `description` | string | 否 | 包的简要描述 |
| `exportTime` | string | 否 | 导出时间（ISO 8601 格式） |
| `source` | string | 否 | 数据来源标识 |
| `checksum` | string | 否 | 校验和（MD5） |
| `files` | ManifestFileRefs | ✅ | 文件路径映射表 |

### 3.2 files 对象字段 (ManifestFileRefs)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tabs` | string | ✅ | Tab 分组文件路径 (layout/tabs.json) |
| `tab` | string | ✅ | Tab 页签文件路径 (layout/tab.json) |
| `components` | string | ✅ | UI 组件配置文件路径 (layout/components.json) |
| `icons` | string | 否 | 图标配置文件路径 (layout/icons.json) |
| `attachment` | string | ✅ | 独立附件清单文件路径 (data/attachment.json) |
| `assets` | string | 否 | 资源文件根目录路径 ("assets/") |
| `process` | string | 否 | 工艺表数据路径 (data/process.json) |
| `operation` | string | 否 | 工序表数据路径 (data/operation.json) |
| `step` | string | 否 | 工步表数据路径 (data/step.json) |
| `action` | string | 否 | 动作表数据路径 (data/action.json) |

> **注意**：`process`/`operation`/`step`/`action` 字段为 V6 新增。若未显式声明，系统自动从 `data/` 固定路径加载。

### 3.3 对应类型定义 (`types/data-package.uts`)

```typescript
export type PackageManifest = {
    name: string
    version: string
    description: string | null
    exportTime: string | null
    source: string | null
    files: ManifestFileRefs
    checksum: string | null
}

export type ManifestFileRefs = {
    tabs: string
    tab: string
    components: string
    icons: string | null
    attachment: string
    assets: string | null
    process: string | null
    operation: string | null
    step: string | null
    action: string | null
}
```

### 3.4 示例

```json
{
  "name": "发动机总装工艺数据包",
  "version": "6.0",
  "description": "符合 SRD V6 规范的标准数据包",
  "exportTime": "2026-04-24T09:00:00+08:00",
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
```

---

## 4. 核心业务数据 (data/ 目录)

V6 架构下，业务数据被严格划分为**双轨制**存储：

1. **轻量级导航树 (`process_tree.json`)**：不携带业务详情，专门用于供左侧树形组件极速绘制层次结构。
2. **四级关系平铺表 (`process.json`, `operation.json`, `step.json`, `action.json`)**：全量存储每一级的详细字段、富文本以及展现配置。当在树上点击某个节点时，通过外键向本地数据库发起平级拉取。

### 4.1 字段命名约定（重要）

**数据包 JSON 使用 camelCase 字段名**，与 Web 端 IndexedDB 直接存取的格式一致。

导入 Native 平台时，`saveRelationalDataToDatabase()` 函数会自动执行 **camelCase → snake_case** 转换后存入 SQLite/RDB。具体规则：

```
JSON 字段 (camelCase)  →  数据库列名 (snake_case)
────────────────────────────────────────────────
innerId                →  inner_id
processId              →  process_id
serialNumber           →  serial_number
classId_display        →  class_id_display
tabs_top               →  tabs_top (已含下划线，不变)
sortOrder              →  sort_order
```

转换由正则 `s.replace(/[A-Z]/g, '_' + letter.toLowerCase())` 实现。

不在标准字段列表中的多余字段，会自动收集到 `extra_json` TEXT 列中（JSON 序列化），前端读取时通过 `mapRelationalRow()` 函数反向展开。

### 4.2 轻型工艺树骨架 `data/process_tree.json`

仅包含维系父子层级与基础展示所需的最简字段。加载后存入 `meta_process_tree` 表供左侧 `tableTree` 组件使用。

| 字段 | 类型 | 说明 |
|------|------|------|
| `innerId` | string | 节点全局唯一标识符（也作为关系表内寻找本体的主键）|
| `code` | string | 节点编号 |
| `name` | string | 节点名称 |
| `type` | string | 层级类型 (`process` / `operation` / `step` / `action-unit`) |
| `targetClassId` | string | 类型标识（兼容字段，用于推导 `type`）|
| `classId` | string | 类型 ID |
| `tabs_top` | string | 选中时上方显示的 Tab 分组 ID |
| `tabs_bottom` | string | 选中时下方显示的 Tab 分组 ID |
| `children` | array | 包含子节点的递归数组 |

> **类型推导**：若 `type` 字段缺失，系统通过 `targetClassId` 自动映射：`Process` → `process`、`Operation` → `operation`、`Step` → `step`、`ActionUnit` → `action-unit`。

#### 骨架树节点对应的类型定义 (`types/process.uts`)

```typescript
export type ProcessTreeNode = {
    innerId: string
    code: string
    name: string
    targetClassId: string
    classId: string
    tabs_top: string
    tabs_bottom: string
    children: ProcessTreeNode[]
}
```

#### 骨架树示例

```json
[
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
          }
        ]
      }
    ]
  }
]
```

### 4.3 `data/process.json` (工艺表 → `t_process`)

标准字段列表（camelCase，按导入代码 `PROCESS_FIELDS` 定义）：

| 字段 | 数据库列名 | 说明 |
|------|-----------|------|
| `innerId` | `inner_id` (PK) | 主键 |
| `code` | `code` | 工艺代码 |
| `name` | `name` | 工艺名称 |
| `classId` | `class_id` | 类型 ID |
| `classId_display` | `class_id_display` | 类型显示名 |
| `classId_business_icon` | `class_id_business_icon` | 业务图标 |
| `classId_icon` | `class_id_icon` | 类型图标 |
| `version` | `version` | 版本号 |
| `fullversionNo` | `fullversion_no` | 完整版本号 |
| `stateName` | `state_name` | 状态名称 |
| `checkoutState` / `checkoutState_display` | `checkout_state` / `checkout_state_display` | 检出状态 |
| `modifyById` / `modifyById_display` | `modify_by_id` / `modify_by_id_display` | 修改人 |
| `modifyTime` | `modify_time` | 修改时间 |
| `createById` / `createById_display` | `create_by_id` / `create_by_id_display` | 创建人 |
| `createTime` / `createTime_display` | `create_time` / `create_time_display` | 创建时间 |
| `contextName` / `contextId` / `contextId_display` | `context_name` / `context_id` / `context_id_display` | 上下文/组织 |
| `departmentName` / `workshopName` | `department_name` / `workshop_name` | 部门/车间 |
| `personalworkspace` / `personalworkspace_display` | 同名 | 个人工作区 |
| `folderPath` | `folder_path` | 文件夹路径 |
| `phaseId` / `phaseId_display` | `phase_id` / `phase_id_display` | 阶段 |
| `secretId` / `secretId_display` | `secret_id` / `secret_id_display` | 密级 |
| `lifeCycleTemplate` / `lifeCycleTemplate_display` | `life_cycle_template` / `life_cycle_template_display` | 生命周期模板 |
| `taskName` / `routeContent` / `mfgNodeName` | 对应 snake_case | 任务名/工艺路线/制造节点 |
| `processCharacteristics` / `note` | 对应 snake_case | 工艺特性/备注 |
| `partCode` / `partName` | `part_code` / `part_name` | 部件代码/名称 |
| `partClassId*` / `partModifyById*` / `partModifyTime` | 对应 snake_case | 部件类型/修改人/时间 |
| `partContextName` / `partPhaseId*` / `partSecretId*` | 对应 snake_case | 部件上下文/阶段/密级 |
| `partStateName` / `partFullversionNo` | `part_state_name` / `part_full_version_no` | 部件状态/版本 |
| `tabs_top` / `tabs_bottom` | `tabs_top` / `tabs_bottom` | UI 关联分组 |
| `sortOrder` | `sort_order` | 排序序号 |

> 数据库还自动附加 `extra_json`、`created_at`、`updated_at` 三列。

### 4.4 `data/operation.json` (工序表 → `t_operation`)

标准字段（`OPERATION_FIELDS`）：

| 字段 | 说明 |
|------|------|
| `innerId` | 主键 |
| `processId` | 外键：所属工艺 |
| `code` / `name` | 工序编号/名称 |
| `serialNumber` | 番号 |
| `classId` / `classId_display` | 工序类型 |
| `isKey` / `isKey_display` | 是否关键工序 |
| `content` | 富文本 HTML 描述 |
| `tabs_top` / `tabs_bottom` | UI 关联分组 |
| `sortOrder` | 排序序号 |

### 4.5 `data/step.json` (工步表 → `t_step`)

标准字段（`STEP_FIELDS`）：

| 字段 | 说明 |
|------|------|
| `innerId` | 主键 |
| `operationId` | 外键：所属工序 |
| `processId` | 外键：所属工艺 |
| `code` / `name` | 工步编号/名称 |
| `serialNumber` | 番号 |
| `classId` / `classId_display` | 工步类型 |
| `note` | 提示信息 |
| `content` | 富文本 HTML 描述 |
| `tabs_top` / `tabs_bottom` | UI 关联分组 |
| `sortOrder` | 排序序号 |

### 4.6 `data/action.json` (动作单元表 → `t_action`)

标准字段（`ACTION_FIELDS`）：

| 字段 | 说明 |
|------|------|
| `innerId` | 主键 |
| `stepId` | 外键：所属工步 |
| `operationId` | 外键：所属工序 |
| `processId` | 外键：所属工艺 |
| `code` / `name` | 动作编号/名称 |
| `serialNumber` | 番号 |
| `classId` / `classId_display` | 动作类型 |
| `note` | 提示信息 |
| `content` | 富文本 HTML 描述 |
| `tabs_top` / `tabs_bottom` | UI 关联分组 |
| `sortOrder` | 排序序号 |

---

## 5. data/attachment.json — 附件资源清单

### 5.1 设计理念

附件数据从工艺树中独立出来，以**平铺数组**的形式存储。每条附件记录通过 `nodeId` 字段关联到工艺树中的某个节点（`innerId`），实现一对多的关系映射。

### 5.2 字段说明

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
| `image` | 图片 | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.bmp` `.svg` |
| `video` | 视频 | `.mp4` `.webm` `.mov` `.avi` `.mkv` `.m4v` |
| `audio` | 音频 | `.mp3` `.wav` `.aac` `.ogg` `.m4a` `.flac` |
| `document` | 文档 | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.txt` `.wps` `.wpt` `.et` `.ett` `.dps` `.dpt` |
| `cad` | CAD 图纸 | `.html` `.htm`（内嵌 3D 查看器） |

> **类型推断**：若 `type` 字段缺失，系统通过 `inferResourceType()` 根据文件扩展名自动推断（定义于 `types/resource.uts`）。

### 5.4 对应类型定义 (`types/resource.uts`)

```typescript
export type ResourceItem = {
    id: string
    type: string
    name: string
    path: string
    originalPath: string    // 原始包内路径
    thumbnail: string
    duration: number
    size: number
    description: string
    nodeId: string
    sortOrder: number
}
```

### 5.5 示例

```json
[
  {
    "id": "res_proc_1_img",
    "nodeId": "proc_1",
    "type": "image",
    "name": "发动机爆炸图",
    "path": "assets/images/engine_exploded.png",
    "description": "发动机总装爆炸视图"
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
```

---

## 6. layout/tabs.json — Tab 分组

定义 UI 中的 Tab 区域分组。每个分组对应界面上的一个 Tab 容器。

### 6.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 分组唯一 ID（被工艺树节点的 `tabs_top` / `tabs_bottom` 引用） |
| `name` | string | ✅ | 分组显示名称 |
| `type` | string | ✅ | 固定为 `"tabGroup"` |
| `description` | string | 否 | 描述信息 |
| `sort_order` | number | ✅ | 排序序号 |

### 6.2 标准分组清单

| sort_order | id | name | 位置 | 说明 |
|------------|------|------|------|------|
| 0 | `group_process_mgmt` | 工艺管理 | 左侧面板 | 工艺结构树和工艺列表所在区域 |
| 1 | `group_process_view` | 工艺视图 | 上方视图区 | 选中 Process 节点时显示 |
| 2 | `group_operation_view` | 工序视图 | 上方视图区 | 选中 Operation 节点时显示 |
| 3 | `group_step_view` | 工步视图 | 上方视图区 | 选中 Step 节点时显示 |
| 4 | `group_bottom_proc` | 工艺详情 | 下方详情区 | 选中 Process 节点时显示 |
| 5 | `group_bottom_op` | 工序详情 | 下方详情区 | 选中 Operation 节点时显示 |
| 6 | `group_bottom_step` | 工步详情 | 下方详情区 | 选中 Step 节点时显示 |

> **注意**：V6 中工序视图分组 ID 已从 `group_procedure_view` 改为 `group_operation_view`，与代码中的 `Operation` 实体命名一致。

### 6.3 分组与界面位置的映射关系

```
┌─────────────────────────────────────────────────────┐
│  左侧面板              │    上方视图区 (tabs_top)     │
│                        │  ┌────────────────────────┐│
│  group_process_mgmt    │  │ group_process_view     ││
│  ├─ 工艺结构树         │  │ group_operation_view   ││
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

---

## 7. layout/tab.json — Tab 页签

定义各分组内的具体 Tab 页签。每个 Tab 属于某个 Group，内部可挂载多个 Component。

### 7.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | Tab 唯一 ID |
| `group_id` | string | ✅ | 所属分组 ID |
| `title` | string | ✅ | Tab 显示标题 |
| `sort_order` | number | ✅ | 排序序号 |
| `visible_condition` | string | 否 | 可见条件表达式 |

### 7.2 标准页签清单

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

#### 上方 — 工序视图（group_operation_view）

| id | title | sort_order |
|----|-------|------------|
| `tab_operation_info` | 工序详情 | 0 |
| `tab_operation_children` | 工步列表 | 1 |

#### 上方 — 工步视图（group_step_view）

| id | title | sort_order |
|----|-------|------------|
| `tab_step_info` | 操作说明 | 0 |

#### 下方 — 工艺详情（group_bottom_proc）

| id | title | sort_order |
|----|-------|------------|
| `tab_bottom_proc_ov` | 概览 | 0 |
| `tab_bottom_proc_product` | 产品信息 | 1 |

#### 下方 — 工序详情（group_bottom_op）

| id | title | sort_order |
|----|-------|------------|
| `tab_bottom_op_ov` | 概览 | 0 |

#### 下方 — 工步详情（group_bottom_step）

| id | title | sort_order |
|----|-------|------------|
| `tab_bottom_step_ov` | 说明 | 0 |

---

## 8. layout/components.json — UI 组件配置

定义挂载在各 Tab 下的具体 UI 组件及其数据绑定方式。

### 8.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 组件唯一 ID |
| `tab_id` | string | ✅ | 所挂载的 Tab ID |
| `type` | string | ✅ | 组件类型，见下表 |
| `title` | string | ✅ | 组件显示标题 |
| `sort_order` | number | ✅ | 排序序号 |
| `config` | object | ✅ | 组件配置，内容因 `type` 而异 |

### 8.2 组件类型枚举

| type 值 | 说明 | 典型用途 |
|---------|------|----------|
| `tableTree` | 工艺树组件 | 左侧导航树、工艺总览表 |
| `table` | 数据表格 | 列表型数据展示（工序/工步列表） |
| `infoView` | 信息视图（键值对） | 节点基本信息展示，支持多列布局 |
| `richText` | 富文本 | 富文本描述、工艺说明等长文本展示 |
| `list` | 简单列表 | 工具/物料清单 |

### 8.3 config 配置详解

#### 获取数据规则（根据组件 type 自动获取）

系统废弃了旧版 `dataSource` 配置字段。中间区域的组件会根据自身的 `type` 自动执行对应的数据库精确查询：

| type | 查询模式 |
|------|---------| 
| `tableTree` | 查询工艺树骨架表全量数据 |
| `infoView`, `richText` | 根据当前选中节点 ID 查其自身记录表 |
| `table`, `list` | 根据当前节点 ID 查其子级记录表 |

#### fields（用于 infoView 类型）

使用 `vModel` 指定数据绑定的字段名（camelCase），`columns` 指定每行列数：

```json
{
  "fields": [
    { "label": "工艺代码", "vModel": "code" },
    { "label": "工艺名称", "vModel": "name" },
    { "label": "版本", "vModel": "fullversionNo" },
    { "label": "状态", "vModel": "stateName" }
  ],
  "columns": 2
}
```

#### columns（用于 table 类型）

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | string | 列标题 |
| `prop` | string | 数据绑定字段名 (camelCase) |
| `width` | number | 列宽（rpx）。-1 表示弹性填充（flex: 1） |
| `type` | string | 单元格渲染附加类型。可选值：`"richText"` |

### 8.4 标准组件清单

| id | tab_id | type | title |
|----|--------|------|-------|
| `comp_process_tree` | `left_panel` | `tableTree` | 工艺树 |
| `comp_process_table` | `tab_process_list` | `tableTree` | 工艺总览表 |
| `comp_proc_info` | `tab_proc_info` | `infoView` | 工艺基本信息 |
| `comp_proc_list` | `tab_proc_children` | `table` | 工序列表 |
| `comp_operation_info` | `tab_operation_info` | `infoView` | 工序详情 |
| `comp_operation_list` | `tab_operation_children` | `table` | 工步列表 |
| `comp_step_basic` | `tab_step_info` | `infoView` | 基本信息 |
| `comp_step_desc` | `tab_step_info` | `richText` | 操作描述 |
| `comp_bottom_proc_info` | `tab_bottom_proc_ov` | `infoView` | 工艺概览 |
| `comp_bottom_proc_desc` | `tab_bottom_proc_ov` | `richText` | 工艺说明 |
| `comp_bottom_proc_product` | `tab_bottom_proc_product` | `infoView` | 关联产品 |
| `comp_bottom_op_info` | `tab_bottom_op_ov` | `infoView` | 工序概览 |
| `comp_bottom_op_desc` | `tab_bottom_op_ov` | `richText` | 工序描述 |
| `comp_bottom_step_info` | `tab_bottom_step_ov` | `infoView` | 工步基本信息 |
| `comp_bottom_step_desc` | `tab_bottom_step_ov` | `richText` | 操作说明 |

---

## 9. layout/icons.json — 图标配置

定义工艺树各节点类型的图标映射。

```json
{
  "nodeIcons": {
    "process": { "icon": "process", "fallback": "📋" },
    "operation": { "icon": "operation", "fallback": "🔧" },
    "step": { "icon": "step", "fallback": "⚙️" },
    "action-unit": { "icon": "action", "fallback": "▶️" },
    "default": { "icon": "default", "fallback": "📄" }
  }
}
```

系统会优先加载 `assets/icons/{icon}.svg`，加载失败时使用 `fallback` 字符。图标配置在 Web 端存入 `t_icon_config` 表。

---

## 10. assets/ — 资源文件目录

| 子目录 | 用途 | 常见文件类型 |
|--------|------|-------------|
| `assets/images/` | 图片资源 | PNG, JPG, GIF, WEBP, BMP, SVG |
| `assets/videos/` | 视频资源 | MP4, WEBM, MOV, AVI, MKV |
| `assets/audios/` | 音频资源 | MP3, WAV, AAC, OGG, M4A |
| `assets/documents/` | PDF 文档 | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT |
| `assets/cad/` | CAD 图纸查看器 | HTML, HTM |
| `assets/icons/` | 节点图标 | SVG（**不被导入**，使用项目静态资源） |

> **路径引用规则**：`attachment.json` 中的 `path` 字段应使用相对于包根目录的路径，如 `"assets/images/engine_exploded.png"`。
>
> **icons 排除规则**：`assets/icons/` 目录下的文件在导入时被显式排除（由 `isAssetFile()` 函数处理），不会复制到本地存储。

---

## 11. 数据库 Schema 总览

### 11.1 业务数据表

| 表名 | 主键 | 索引 | 说明 |
|------|------|------|------|
| `t_process` | `inner_id` | `code` (Web) | 工艺实体（53+ 列） |
| `t_operation` | `inner_id` | `process_id` | 工序实体 |
| `t_step` | `inner_id` | `operation_id`, `process_id` | 工步实体 |
| `t_action` | `inner_id` | `step_id`, `operation_id`, `process_id` | 动作实体 |
| `t_resources` | `id` | `node_id`, `type` (Web) | 附件资源记录 |

### 11.2 UI 元数据表

| 表名 | 主键 | 索引 | 说明 |
|------|------|------|------|
| `meta_tab_groups` | `id` | — | Tab 分组定义 |
| `meta_tabs` | `id` | `group_id` | Tab 页签定义 |
| `meta_components` | `id` | `tab_id` | UI 组件配置 |
| `meta_process_tree` | `id` | — | 工艺树骨架 JSON (KV 存储) |

### 11.3 系统表

| 表名 | 主键 | 说明 |
|------|------|------|
| `t_import_package` | `id` (AUTOINCREMENT) | 导入记录 |
| `t_assets` | `id` | 静态资源二进制/Base64 |
| `t_icon_config` | `node_type` | 图标配置映射 |

### 11.4 数据库平台实现差异

| 方面 | Android | HarmonyOS | Web |
|------|---------|-----------|-----|
| 引擎 | SQLiteDatabase | relationalStore.RdbStore | IndexedDB (IDBDatabase) |
| 数据库名 | `mpm_offline.db` | `mpm_offline.db` | `mpm_offline.db` (v8) |
| 建表方式 | `execSQL()` 同步 | `executeSql()` 顺序异步链 | `onupgradeneeded` 事件 |
| 事务控制 | `beginTransaction()` / `setTransactionSuccessful()` / `endTransaction()` | `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` SQL | 不支持（自动隔离） |

---

## 12. 数据关联关系总览

```
manifest.json
    │
    ├── files.tabs ────────────► layout/tabs.json (→ meta_tab_groups)
    │                               │
    │                               └── groups[].id ◄────── tab[].group_id
    │                                                          │
    ├── files.tab ─────────────► layout/tab.json (→ meta_tabs)
    │                               │
    │                               └── tab[].id ◄───── components[].tab_id
    │                                                          │
    ├── files.components ──────► layout/components.json (→ meta_components)
    │
    ├── files.attachment ──────► data/attachment.json (→ t_resources)
    │                               │
    │                               └── attachment[].nodeId ──► node.innerId
    │
    ├── (隐含) ────────────────► data/process_tree.json (→ meta_process_tree)
    │                               │
    │                               ├── node.tabs_top ──► groups[].id
    │                               └── node.tabs_bottom ──► groups[].id
    │
    ├── data/process.json ─────► t_process (inner_id = PK)
    │       │
    │       └── t_operation (process_id → t_process.inner_id)
    │               │
    │               └── t_step (operation_id → t_operation.inner_id)
    │                       │
    │                       └── t_action (step_id → t_step.inner_id)
    │
    └── files.icons ───────────► layout/icons.json (→ t_icon_config)
```

---

## 13. 导入流程详述

### 13.1 整体流程

```
1. 选择 .srd 文件（通过 uni.chooseFile 或 HTML Input）
2. 读取为 ArrayBuffer
3. 尝试 decryptPackage() 解密（AES-256-CBC），失败则视为明文 ZIP
4. 解压 ZIP 读取 manifest.json → 版本校验（必须 ≥ 6.0）
5. 解析 layout/ 下的 UI 配置 (tabs.json, tab.json, components.json, icons.json)
6. 解析 data/ 下的业务表 (process.json, operation.json, step.json, action.json)
7. 解析 data/process_tree.json → 存入 meta_process_tree
8. 解析 data/attachment.json → 通过 parseAttachmentFile() 构建 ResourceItem[]
9. 提取 assets/ 下的资源文件 → 复制到本地存储 (排除 icons/ 目录)
10. 开启数据库事务 → 依次写入：
    a. UI 配置 (saveUiConfigurationToDatabase)
    b. process_tree (meta_process_tree KV)
    c. 四级业务表 (saveRelationalDataToDatabase × 4)
    d. 资源记录 (saveResource × N)
11. 事务提交 → 导入完成
```

### 13.2 平台差异

| 步骤 | Android | HarmonyOS | Web |
|------|---------|-----------|-----|
| ZIP 解压 | ZipInputStream 流式读取 | unzip → 临时目录 → readFileSync | JSZip 内存加载 |
| 业务表写入 | executeSQL (INSERT OR REPLACE) | executeSql (Promise 链) | webPutData (IndexedDB put) |
| 资源存储 | writeFileBytes → 本地文件 | copyFileSync → 沙箱 | Blob → IndexedDB + BlobURL |
| 字段映射 | camelCase → snake_case (自动) | camelCase → snake_case (自动) | 直接存 camelCase + 补 inner_id |

### 13.3 进度回调状态

| status | progress | 说明 |
|--------|----------|------|
| `reading` | 0% | 读取文件 |
| `decrypting` | 20% | 解密处理 |
| `extracting` | 40%-70% | 解压和解析 |
| `completed` | 100% | 导入完成 |

---

## 14. 服务层架构

### 14.1 服务模块清单

| 文件 | 职责 |
|------|------|
| `services/dataPackage.uts` | 数据包选择、验证、解压、导入全流程 |
| `services/database.uts` | 数据库初始化、SQL 执行、事务控制、Web IndexedDB 封装 |
| `services/processService.uts` | 工艺数据查询（getProcessList/Detail、getOperationsByProcessId、getStepsByOperationId、getActionsByStepId、**queryNodeById**、**queryChildrenByParentId** 等） |
| `services/resourceService.uts` | 资源存储、检索、Blob 缓存管理 |
| `services/fileService.uts` | 文件系统操作辅助 |
| `utils/crypto.uts` | AES-256-CBC 加解密、MD5 校验（三平台原生实现） |

### 14.2 类型定义清单

| 文件 | 定义内容 |
|------|---------| 
| `types/data-package.uts` | PackageManifest, ManifestFileRefs, TabGroup, TabConfig, ComponentConfig, ImportProgress, ImportResult, PackageInfo |
| `types/process.uts` | ProcessTreeNode, ProcessEntity, OperationEntity, StepEntity, ActionEntity, NodeResource, NodeLevel 常量 |
| `types/resource.uts` | ResourceItem, PreviewState, NodeResources, inferResourceType, getResourceTypeIcon/Label, formatDuration/FileSize |
| `types/common.uts` | ApiResponse, PageParams, PageResult, FileInfo |

### 14.3 页面路由

| 页面路径 | 标题 | 说明 |
|----------|------|------|
| `pages/index/index` | (自定义导航栏) | 主工艺预览页面，包含左侧树、中间视图/详情区、右侧资源预览 |
| `pages/process/list` | 工艺列表 | 工艺搜索与列表展示 |
| `pages/import/import` | 数据导入 | 数据包选择、验证、导入操作 |
| `pages/video/player` | 视频播放 | 全屏视频播放器 |
| `pages/settings/settings` | 设置 | 应用设置 |

### 14.4 自定义组件清单

| 组件目录 | 说明 |
|----------|------|
| `components/ux-table/` | 数据表格（支持树形展开、富文本单元格） |
| `components/ux-tabs/` | Tab 选项卡容器 |
| `components/ux-tab-pane/` | Tab 面板 |
| `components/ux-info-view/` | 键值对信息视图（多列布局） |
| `components/ux-richtext/` | 富文本渲染组件 |
| `components/ux-breadcrumb/` | 面包屑导航 |
| `components/ux-collapse/` | 折叠面板容器 |
| `components/ux-collapse-item/` | 折叠面板项 |
| `components/ux-tag/` | 标签组件 |
| `components/resource-list/` | 资源缩略图列表 |
| `components/resource-preview/` | 资源预览组件（图片/视频/音频/文档/CAD） |
| `components/process-card/` | 工艺卡片组件 |
| `components/process-step/` | 工艺步骤组件 |

---

## 15. 组件与数据联动机制

### 15.1 核心设计原则

V6.2 废弃了旧版的 `dataSource` 配置字段，改为**由组件 `type` 自动推导查询模式**。这意味着 `components.json` 中不再需要声明 `dataSource`，系统会根据组件类型直接执行对应的数据库精确查询，所有数据均实时从数据库读取，不再依赖内存中的全量缓存。

### 15.2 初始化阶段（启动/进入页面）

```
导入数据包 / 应用启动
  → initData() 检查数据库是否有内容
  → loadLeftPanel() 加载左侧面板
  → loadDataForGroup(leftGroup)
      → 遍历 Group 下所有组件
      → comp.type == 'tableTree'
          → loadTableTreeFromMeta()  // 从 meta_process_tree 读骨架
          → enrichNodeForDisplay()   // 为每个节点补充显示字段（图标等）
          → 填充左侧工艺树
  → 自动选中第一个节点（或通过 targetNodeId 定位）
```

### 15.3 节点选中阶段（点击树节点）

```
用户点击节点 (handleRowClick)
  → 若节点为骨架树节点（缺少完整业务字段）：
      → queryNodeById(nodeType, nodeId)  // 按主键精确查对应业务表
  → 读取 fullRow.tabs_top / fullRow.tabs_bottom
  → 切换上方/下方可见的 Tab Group
  → bindDataToGroup(group, fullRow)
      → 遍历当前可见 Group 下所有组件
      → 按 comp.type 分发：
          comp.type == 'infoView' or 'richText'
            → queryNodeById(nodeType, nodeId)
            → 按主键从对应业务表查1条完整记录
            → comp.data = [record]
          comp.type == 'table' or 'list'
            → queryChildrenByParentId(nodeType, nodeId)
            → 按外键从子级表查N条记录（已按 sort_order 排序）
            → comp.data = childRecords
  → loadNodeResources(nodeId)
      → 通过 innerId 查 t_resources 表
      → 构建 ResourceItem[] 数组给右侧资源区域
  → 更新面包屑导航（工艺信息/部件信息/状态标签）
```

### 15.4 精确查询函数说明

`processService.uts` 中提供以下通用查询函数，供联动机制使用：

#### `queryNodeById(nodeType, nodeId)`

| 平台 | 实现 |
|------|------|
| Native (Android/HarmonyOS) | `SELECT * FROM t_{type} WHERE inner_id = ?` → `mapRelationalRow()` 转 camelCase |
| Web | 动态 import `database.uts` → `webGetByKey(tableName, nodeId)` |

支持的 `nodeType` 值：`process`、`operation`、`step`、`action`（大小写不敏感）

#### `queryChildrenByParentId(parentType, parentId)`

| parentType | 查询目标表 | 外键条件 |
|-----------|-----------|----------|
| `process` | `t_operation` | `process_id = ?` |
| `operation` | `t_step` | `operation_id = ?` |
| `step` | `t_action` | `step_id = ?` |

Native 端：`SELECT * FROM {table} WHERE {fk} = ? ORDER BY sort_order ASC`  
Web 端：动态 import → `webGetByIndex(table, fkField, parentId)` + 内存按 `sortOrder` 排序

#### 其他专用查询函数

| 函数名 | 说明 |
|--------|------|
| `getProcessList(params)` | 分页查询工艺列表（支持关键字搜索） |
| `getProcessDetail(id)` | 按 ID 查询单条工艺完整记录 |
| `getOperationsByProcessId(processId)` | 按工艺 ID 查工序列表 |
| `getStepsByOperationId(operationId)` | 按工序 ID 查工步列表 |
| `getActionsByStepId(stepId)` | 按工步 ID 查动作列表 |
| `searchProcess(keyword)` | 搜索工艺（限制返回 20 条） |
| `clearAllProcesses()` | 清空所有四级业务表 |

### 15.5 richText 内容字段约定

`richText` 组件固定从数据记录的 `content` 字段读取富文本 HTML 内容：

```
模板取值：comp.data[0]['content']
```

因此，在 `process.json`、`operation.json`、`step.json`、`action.json` 中，富文本内容**必须**存储在 `content` 字段，不再使用已废弃的 `text`、`description_html` 等旧字段名。

### 15.6 附件资源联动

```
节点选中 → 通过 innerId 查询 t_resources 表
  → 构建 ResourceItem[] 数组
  → 传递给 resource-list 组件展示缩略图列表
  → 用户点击资源项 → resource-preview 组件加载预览
  → 支持全屏预览模式：
      → 图片：缩放/旋转/重置工具栏
      → 视频/音频/文档/CAD：使用原组件预览
      → 左右切换资源导航
```

### 15.7 节点导航

主页面提供"上一步/下一步"导航按钮，通过 `flattenTree()` 将树形结构扁平化为有序列表，支持在所有节点间顺序导航。

---

## 16. 数据包生成工具

项目提供 Python 脚本 `scripts/generate_v6_srd.py` 用于生成符合 V6 规范的数据包。

使用方法：

```bash
python scripts/generate_v6_srd.py
```

生成内容包括：manifest.json、工艺树骨架、四级关系表、附件清单、UI 布局全套配置及虚拟资源文件。

同时提供 `scripts/clean_datasource.py` 脚本用于清理旧版数据包中的 `dataSource` 字段。

---

## 17. 版本兼容说明

| 版本 | 变更 |
|------|------|
| V1-V3 | 旧版格式，manifest 中内联所有数据 |
| V4 | 引入四级工艺树、`layout/` 独立目录、`resources` 字段 |
| V5 | 附件从工艺树剥离至独立的 `data/attachment.json` |
| V5.2 | 引入 `data/descriptions.json` |
| V6 | **[重大重构]** 移除嵌套工艺树设计，改为 4 张平面关系表 + 独立骨架树；弃用 descriptions.json，富文本合入对应实体的 `content` 字段；移除遗留 V4 及之前的残存兼容；全面升级为 SQLite/RDB/IndexedDB 平面查询架构；数据包 JSON 统一使用 camelCase 字段名；新增 `group_operation_view` 替代旧的 `group_procedure_view`；ManifestFileRefs 新增 process/operation/step/action 可选路径字段 |
| V6.2 | **[架构优化]** 废弃 `dataSource` 配置字段；UI 组件改为按自身 `type` 自动推导查询模式（`infoView`/`richText` 按主键查自身，`table`/`list` 按外键查子节点），不再依赖内存全表缓存；`processService.uts` 新增 `queryNodeById` 和 `queryChildrenByParentId` 通用查询函数；`richText` 组件统一从 `content` 字段取值 |
| V6.3 | **[功能完善]** 新增 AES-256-CBC 加密支持（三平台原生实现）与 MD5 完整性校验；补充 `targetClassId` → `type` 自动映射机制；完善资源全屏预览（图片变换工具栏、左右切换）；新增面包屑导航与节点上下步导航；新增状态标签映射；processService 新增 `getStepsByOperationId`、`getActionsByStepId` 专用查询函数 |

**注意**：从 V6 版本起，系统不再支持 V5 及更早版本的兼容模式。导入时若 `manifest.version < "6.0"` 将直接报错拒绝。
