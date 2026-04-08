# SRD 数据包规范说明 (V3)

> **目标读者**：负责准备和生成 `.srd` 数据包的同事
> **系统名称**：MPM 工艺预览系统（avpbc-pop）

---

## 一、概述

`.srd` 文件是本系统的**离线工艺数据包**格式，本质上是一个 **ZIP 压缩包**（仅修改了扩展名为 `.srd`）。

客户端（Android / HarmonyOS / Web）通过导入此文件来加载 UI 配置、工艺树数据和多媒体资源。

> [!IMPORTANT]
> 文件扩展名必须为 `.srd`，系统仅识别此扩展名。

---

## 二、包格式 & 目录结构

```
my_package.srd (ZIP 格式，可选 AES-256-CBC 加密层)
├── manifest.json              ← 【必需】清单文件，包的入口
├── ui/                        ← 【必需】UI 配置目录
│   ├── groups.json            ← Tab 分组配置
│   ├── tabs.json              ← Tab 页签配置
│   ├── components.json        ← 组件配置
│   └── icons.json             ← 图标映射配置（可选）
├── data/                      ← 【必需】数据记录目录
│   └── records.json           ← 数据记录
├── processes/                 ← 【必需】工艺数据目录
│   ├── proc_001.json          ← 工艺文件 1
│   ├── proc_002.json          ← 工艺文件 2
│   └── ...
└── assets/                    ← 【可选，V3新增】静态资源目录
    ├── images/                ← 图片资源
    │   ├── step_guide.jpg
    │   └── thumb_xxx.jpg
    ├── videos/                ← 视频资源
    │   └── step_demo.mp4
    ├── audios/                ← 音频资源
    │   └── narration.mp3
    └── docs/                  ← 文档资源
        └── spec.pdf
```

---

## 三、各文件详细规范

### 3.1 manifest.json（清单文件）【必需】

清单文件是数据包的"目录"，告诉系统去哪里找各类数据。

```json
{
  "name": "XX产品装配工艺包",
  "version": "3.0",
  "description": "包含工艺数据和多媒体资源",
  "exportTime": "2026-04-08T10:00:00Z",
  "source": "MES系统导出",
  "files": {
    "groups": "ui/groups.json",
    "tabs": "ui/tabs.json",
    "components": "ui/components.json",
    "icons": "ui/icons.json",
    "records": "data/records.json",
    "processes": [
      "processes/proc_001.json",
      "processes/proc_002.json"
    ],
    "assets": "assets/"
  }
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 包名称（显示用） |
| `version` | string | **是** | 格式版本号，当前应使用 `"3.0"` |
| `description` | string | 否 | 描述信息 |
| `exportTime` | string | 否 | 导出时间（ISO 8601） |
| `source` | string | 否 | 数据来源标识 |
| `files` | object | **是（V2/V3）** | 文件引用映射，见下表 |
| `checksum` | string | 否 | MD5 校验值 |

#### `files` 对象字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `groups` | string | 是 | Tab 分组配置文件路径 |
| `tabs` | string | 是 | Tab 配置文件路径 |
| `components` | string | 是 | 组件配置文件路径 |
| `icons` | string | 否 | 图标映射文件路径 |
| `records` | string | 是 | 数据记录文件路径 |
| `processes` | string[] | 是 | 工艺 JSON 文件路径数组 |
| `assets` | string | 否（V3） | 静态资源目录路径 |

---

### 3.2 ui/groups.json（Tab 分组）

定义右侧面板的 Tab 分组。每种工艺节点类型（工艺/工序/工步）可以拥有不同的分组。

```json
[
  {
    "id": "grp_process",
    "name": "工艺信息",
    "description": "工艺级别的信息分组",
    "sort_order": 1
  },
  {
    "id": "grp_step",
    "name": "工步详情",
    "description": "工步级别的信息分组",
    "sort_order": 2
  }
]
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一标识 |
| `name` | string | 是 | 显示名称 |
| `description` | string | 是 | 描述（可为空字符串） |
| `sort_order` | number | 是 | 排序序号（升序） |

---

### 3.3 ui/tabs.json（Tab 配置）

定义每个分组下的具体 Tab 页签。

```json
[
  {
    "id": "tab_basic_info",
    "group_id": "grp_process",
    "title": "基本信息",
    "sort_order": 1,
    "visible_condition": null
  },
  {
    "id": "tab_materials",
    "group_id": "grp_step",
    "title": "物料清单",
    "sort_order": 2,
    "visible_condition": "type=step"
  }
]
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一标识 |
| `group_id` | string | 是 | 所属分组 ID（关联 groups.json） |
| `title` | string | 是 | Tab 标题 |
| `sort_order` | number | 是 | 排序序号 |
| `visible_condition` | string\|null | 是 | 显示条件（null 表示始终可见） |

---

### 3.4 ui/components.json（组件配置）

定义每个 Tab 页签中展示的组件。

```json
[
  {
    "id": "comp_basic_table",
    "tab_id": "tab_basic_info",
    "type": "table",
    "title": "基本信息表",
    "config": {
      "columns": [
        { "field": "name", "label": "名称" },
        { "field": "value", "label": "值" }
      ]
    },
    "sort_order": 1
  }
]
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 唯一标识 |
| `tab_id` | string | 是 | 所属 Tab ID |
| `type` | string | 是 | 组件类型：`table` / `collapse` / `process-tree` |
| `title` | string | 是 | 组件标题 |
| `config` | object/array | 是 | 组件自定义配置（JSON，格式因 type 而异） |
| `sort_order` | number | 是 | 排序序号 |

---

### 3.5 ui/icons.json（图标映射）【可选】

配置工艺树节点的图标映射。

```json
{
  "nodeIcons": {
    "process":   { "icon": "process",   "fallback": "📋" },
    "procedure": { "icon": "procedure", "fallback": "🔧" },
    "step":      { "icon": "step",      "fallback": "⚙️" },
    "default":   { "icon": "default",   "fallback": "📄" }
  }
}
```

> [!NOTE]
> `icon` 字段值对应客户端 `static/icons/{icon}.svg` 文件。图标 SVG 文件**不**放在数据包中，需客户端预置。数据包中只提供映射关系。

---

### 3.6 data/records.json（数据记录）

存储各组件的实际数据内容。

```json
[
  {
    "record_id": "rec_001",
    "component_id": "comp_basic_table",
    "data": {
      "name": "产品型号",
      "value": "ABC-1000"
    }
  }
]
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `record_id` | string | 是 | 记录唯一 ID |
| `component_id` | string | 是 | 关联组件 ID |
| `data` | object | 是 | 数据内容（JSON，结构与组件 config 匹配） |

---

### 3.7 processes/proc_xxx.json（工艺数据）【重点】

每个工艺对应一个 JSON 文件，包含工艺的完整树形结构。

```json
{
  "id": "proc_001",
  "code": "GY-2026-001",
  "name": "XX组件装配工艺",
  "version": "1.0",
  "status": "released",
  "product": {
    "id": "prod_001",
    "name": "XX产品",
    "model": "ABC-1000"
  },
  "steps": [
    {
      "stepNo": 1,
      "name": "准备工序",
      "description": "检查工具和物料",
      "description_html": "<p>检查工具和物料</p>",
      "duration": 300,
      "tools": ["扳手", "螺丝刀"],
      "materials": ["螺栓 M6x20", "垫片"],
      "images": ["assets/images/step_guide.jpg"],
      "videos": ["assets/videos/step_demo.mp4"]
    }
  ],
  "attachments": [
    {
      "type": "document",
      "name": "作业指导书",
      "path": "assets/docs/spec.pdf"
    }
  ],
  "createdAt": "2026-01-15T08:00:00Z",
  "updatedAt": "2026-03-20T10:30:00Z"
}
```

#### 工艺根字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 工艺唯一 ID |
| `code` | string | 是 | 工艺编码 |
| `name` | string | 是 | 工艺名称 |
| `version` | string | 是 | 工艺版本 |
| `status` | string | 是 | 状态（如 released） |
| `product` | object | 是 | 产品信息 |
| `steps` | array | 是 | 工步列表 |
| `attachments` | array | 是 | 附件列表 |
| `createdAt` | string | 是 | 创建时间 |
| `updatedAt` | string | 是 | 更新时间 |

#### `product` 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 产品 ID |
| `name` | string | 产品名称 |
| `model` | string | 产品型号 |

#### `steps[]` 工步对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `stepNo` | number | 工步序号 |
| `name` | string | 工步名称 |
| `description` | string | 纯文本描述 |
| `description_html` | string（可选） | HTML 富文本描述 |
| `duration` | number | 预计时长（秒） |
| `tools` | string[] | 使用工具列表 |
| `materials` | string[] | 使用物料列表 |
| `images` | string[] | 关联图片路径（指向 assets/） |
| `videos` | string[] | 关联视频路径（指向 assets/） |

#### `attachments[]` 附件对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 附件类型 |
| `name` | string | 附件名称 |
| `path` | string | 文件路径（指向 assets/） |

---

### 3.8 工艺节点中的资源引用（V3 扩展）

工步、工序等节点还支持通过 `resources` 字段引用资源，提供更丰富的元数据：

```json
{
  "id": "proc_001_step_01",
  "type": "step",
  "name": "工步名称",
  "resources": [
    {
      "id": "res_001",
      "type": "image",
      "name": "操作示意图",
      "path": "assets/images/step_guide.jpg",
      "thumbnail": "",
      "duration": 0,
      "description": "装配操作示意图"
    },
    {
      "id": "res_002",
      "type": "video",
      "name": "操作演示",
      "path": "assets/videos/step_demo.mp4",
      "thumbnail": "assets/images/thumb_step_demo.jpg",
      "duration": 120,
      "description": "操作演示视频"
    }
  ]
}
```

#### `resources[]` 资源对象

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 资源唯一 ID |
| `type` | string | 是 | `image` / `video` / `audio` / `document` / `cad` |
| `name` | string | 是 | 显示名称 |
| `path` | string | 是 | 包内路径（如 `assets/images/xxx.jpg`） |
| `thumbnail` | string | 否 | 缩略图路径（图片可为空，视频建议提供） |
| `duration` | number | 否 | 时长秒数（视频/音频使用，其他为 0） |
| `description` | string | 否 | 描述 |

---

### 3.9 assets/ 目录（静态资源）

#### 支持的文件格式

| 类型 | 支持的扩展名 |
|------|-------------|
| **图片** | `.jpg` `.jpeg` `.png` `.gif` `.webp` `.bmp` `.svg` |
| **视频** | `.mp4` `.webm` `.avi` `.mov` `.mkv` |
| **音频** | `.mp3` `.wav` `.aac` `.ogg` `.m4a` |
| **文档** | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.txt` |
| **CAD** | `.html` `.htm`（卡伦特供应商的 HTML 封装 CAD） |

> [!WARNING]
> `assets/icons/` 子目录会被自动**跳过**（图标使用客户端预置资源），请勿将需要导入的资源放在此目录下。

---

## 四、加密方式

系统支持**可选加密**。导入时会自动尝试解密，失败则视为未加密的 ZIP 直接处理。

| 项目 | 值 |
|------|---|
| **算法** | AES-256-CBC |
| **填充** | PKCS5/PKCS7 Padding |
| **密钥** | 32 字节预置密钥（UTF-8 编码，截取前 32 字符） |
| **IV** | 16 字节，存储在加密文件的**前 16 字节** |
| **数据布局** | `[16字节 IV][加密后的 ZIP 数据]` |

> [!CAUTION]
> 当前使用硬编码预置密钥 `MPM_OFFLINE_2026_SECURE_KEY_256B`。如需加密打包，需使用相同密钥进行 AES-256-CBC 加密，并将 IV 拼接在密文前面。**未加密的包直接是标准 ZIP 格式即可。**

---

## 五、完整性校验

manifest.json 可包含 `checksum` 字段，值为 ZIP 包数据的 **MD5** 哈希（小写十六进制字符串），客户端可据此校验包完整性。

---

## 六、如何生成 SRD 包

### 方法一：手动打包（PowerShell）

```powershell
# 1. 准备目录结构（参照上文第二节）
# 假设源文件组织在 tmp/srd_gen/ 下：
#   tmp/srd_gen/manifest.json
#   tmp/srd_gen/ui/
#   tmp/srd_gen/data/
#   tmp/srd_gen/processes/
#   tmp/srd_gen/assets/          ← V3：放入多媒体文件

# 2. 打包为 ZIP
Compress-Archive -Force `
  -Path tmp/srd_gen/manifest.json, tmp/srd_gen/ui, tmp/srd_gen/processes, tmp/srd_gen/data, tmp/srd_gen/assets `
  -DestinationPath static/data_package.zip

# 3. 修改扩展名
Move-Item -Path static/data_package.zip -Destination static/data_package_v9_cad.srd -Force
```

### 方法二：程序化生成

用任何支持 ZIP 的编程语言（Python、Java、Node.js 等），按照上述目录结构生成 JSON 文件和资源文件，打包为 ZIP，改名为 `.srd`。

Python 示例：
```python
import zipfile, json, os

with zipfile.ZipFile('data_package.srd', 'w', zipfile.ZIP_DEFLATED) as zf:
    # 写入 manifest
    zf.writestr('manifest.json', json.dumps(manifest_data, ensure_ascii=False))

    # 写入 UI 配置
    zf.writestr('ui/groups.json', json.dumps(groups_data, ensure_ascii=False))
    zf.writestr('ui/tabs.json', json.dumps(tabs_data, ensure_ascii=False))
    zf.writestr('ui/components.json', json.dumps(components_data, ensure_ascii=False))

    # 写入数据记录
    zf.writestr('data/records.json', json.dumps(records_data, ensure_ascii=False))

    # 写入工艺文件
    for proc_file in process_files:
        zf.write(proc_file, f'processes/{os.path.basename(proc_file)}')

    # 写入资源文件（V3）
    for asset_file in asset_files:
        zf.write(asset_file, f'assets/{relative_path}')
```

---

## 七、版本兼容性

系统支持三种数据包版本，**推荐使用 V3**：

| 版本 | `manifest.version` | 数据组织 | 支持资源 |
|------|-------------------|---------|---------|
| **V1** | `"1.0"` | 所有数据内联在 manifest.json 中 | ❌ |
| **V2** | `"2.0"` | `files` 字段引用分离的 JSON 文件 | ❌ |
| **V3** | `"3.0"` | `files` + `assets/` 目录 | ✅ |

> [!TIP]
> V3 向下兼容 V2。区别仅在于 V3 多了 `files.assets` 字段和 `assets/` 目录。

---

## 八、快速检查清单

为同事整理的打包前检查项：

- [ ] `manifest.json` 位于 ZIP 根目录
- [ ] `manifest.json` 的 `version` 字段已设置（推荐 `"3.0"`）
- [ ] `manifest.json` 的 `files` 对象中各路径与实际文件对应
- [ ] 所有 JSON 文件均为 **UTF-8** 编码
- [ ] 每个 `groups.json` 条目都有唯一 `id`
- [ ] `tabs.json` 中的 `group_id` 在 `groups.json` 中存在
- [ ] `components.json` 中的 `tab_id` 在 `tabs.json` 中存在
- [ ] `records.json` 中的 `component_id` 在 `components.json` 中存在
- [ ] 工艺 JSON 文件中引用的资源路径（`path`）与 `assets/` 下的实际文件一致
- [ ] 资源文件格式在支持列表内
- [ ] 文件扩展名为 `.srd`
- [ ] 如需加密，IV（16字节）拼接在加密 ZIP 数据前
