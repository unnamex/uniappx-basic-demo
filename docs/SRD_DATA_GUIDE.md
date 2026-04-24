# SRD 数据包制作指南

> **文档版本**: 6.3  
> **最后更新**: 2026-04-24  
> **适用对象**: 负责制作和维护 SRD 数据包的内容编辑人员及后端开发

---

## 一、SRD 包是什么？

SRD 包是一个 **ZIP 压缩文件**，后缀名改为 `.srd`。  
系统导入后，里面的数据会存进设备本地数据库（Android/HarmonyOS/Web），供**完全离线**查看。

你需要按规定的文件夹结构组织数据，最后压缩成 `.srd` 文件交给客户端导入。

---

## 二、文件夹结构总览

```
你的数据包名称.srd（实际上是个ZIP）
│
├── manifest.json           ← ① 包的说明文件（必须有）
│
├── data/                   ← ② 工艺数据（核心）
│   ├── process_tree.json   ← 工艺树结构（导航用，必须）
│   ├── process.json        ← 工艺详细信息
│   ├── operation.json      ← 工序详细信息
│   ├── step.json           ← 工步详细信息
│   ├── action.json         ← 动作单元（可选，无数据时填 []）
│   └── attachment.json     ← 附件资源清单
│
├── layout/                 ← ③ 页面布局配置（由开发提供模板，通常不用自己改动）
│   ├── tabs.json
│   ├── tab.json
│   ├── components.json
│   └── icons.json
│
└── assets/                 ← ④ 实际的图片、视频、文档等文件
    ├── images/
    ├── videos/
    ├── audios/
    ├── documents/
    └── cad/
```

> **重点**：你主要负责填写 `data/` 目录下的 6 个 JSON 文件，以及准备 `assets/` 里的素材文件。  
> `layout/` 文件夹由开发定义一次后，通常不需要改动。

---

## 三、① manifest.json — 基本信息

这是整个包的"封面"，填写包名、版本等基本信息。

**格式如下：**

```json
{
  "name": "V8发动机总装工艺包",
  "version": "6.0",
  "description": "V8发动机总装线工艺操作指导",
  "exportTime": "2026-04-24T10:00:00+08:00",
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

**注意事项：**
- `version` 必须填 `"6.0"` 或更高，否则系统**拒绝导入**
- `name` 填你的工艺包名称
- `files` 中的 `process`/`operation`/`step`/`action` 四个路径**建议显式声明**（如上所示）

> **关于数据文件路径：**  
> `process`、`operation`、`step`、`action`、`process_tree` 这五个字段若省略不写，三端（Android/HarmonyOS/Web）均有 fallback 机制，会自动从固定路径 `data/*.json` 加载。但**强烈建议显式声明**，尤其在鸿蒙端，显式声明可避免模糊匹配到 `files` 中其他含 `process` 字符串的 key，导致路径解析错误。

---

## 四、② 工艺树骨架 `data/process_tree.json`

这个文件决定**左侧树形导航的层级结构**，层次关系为：

```
工艺（process）
  └── 工序（operation）
        └── 工步（step）
              └── 动作（action-unit）—— 可选
```

> ⚠️ **重要**：`process_tree.json` 中的节点**不需要包含业务详情字段**（如 content、版本号等），只需包含以下骨架字段。详细业务信息由对应的 `process.json`、`operation.json` 等关系表提供。

**格式如下：**

```json
[
  {
    "innerId": "proc_001",
    "type": "process",
    "code": "ASM-ENG-001",
    "name": "发动机总装",
    "tabs_top": "group_process_view",
    "tabs_bottom": "group_bottom_proc",
    "children": [
      {
        "innerId": "op_001",
        "type": "operation",
        "code": "OP-010",
        "name": "缸体准备",
        "tabs_top": "group_operation_view",
        "tabs_bottom": "group_bottom_op",
        "children": [
          {
            "innerId": "step_001",
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

**字段说明：**

| 字段 | 是否必填 | 说明 |
|------|---------|------|
| `innerId` | ✅ 必填 | 全局唯一ID，自己定义，不能重复，建议用有意义的编号 |
| `type` | ✅ 必填 | 层级类型，只能填 `process` / `operation` / `step` / `action-unit` |
| `code` | ✅ 必填 | 节点编号（如工艺号、工序号） |
| `name` | ✅ 必填 | 节点显示名称 |
| `tabs_top` | ✅ 必填 | 固定填写，见下面的对照表 |
| `tabs_bottom` | ✅ 必填 | 固定填写，见下面的对照表 |
| `children` | ✅ 必填 | 子节点数组，没有子节点时填 `[]` |

**📌 tabs_top / tabs_bottom 固定对照表（直接复制填写）：**

| 节点类型 | `tabs_top` 填写 | `tabs_bottom` 填写 |
|---------|---------------|-----------------|
| `process`（工艺） | `"group_process_view"` | `"group_bottom_proc"` |
| `operation`（工序） | `"group_operation_view"` | `"group_bottom_op"` |
| `step`（工步） | `"group_step_view"` | `"group_bottom_step"` |

---

## 五、③ 工艺数据 `data/process.json`

存放每个工艺的**详细信息**，是一个数组，每条对应工艺树里的一个 `process` 节点。

> ⚠️ **`innerId` 必须与工艺树中的 `innerId` 完全一致！**  
> ⚠️ **此文件中不能有 `children` 字段**，子级工序通过 `operation.json` 中的 `processId` 关联。

**所有支持的字段（共 56 个）：**

> 标 ✅ 的是必填字段；其余字段如果你的系统有对应数据就尽量填，没有可以留空字符串 `""` 或直接不写该字段。

| 字段 | 必填 | 说明 |
|------|------|------|
| `innerId` | ✅ | 全局唯一ID，必须与工艺树一致 |
| `code` | ✅ | 工艺编号 |
| `name` | ✅ | 工艺名称 |
| `tabs_top` | ✅ | 固定填 `"group_process_view"` |
| `tabs_bottom` | ✅ | 固定填 `"group_bottom_proc"` |
| `sortOrder` | ✅ | 排序号，从 0 开始 |
| `classId` | 否 | 工艺类型 ID |
| `classId_display` | 否 | 工艺类型显示名（如"装配工艺"） |
| `classId_business_icon` | 否 | 业务图标 |
| `classId_icon` | 否 | 类型图标 |
| `version` | 否 | 版本号 |
| `fullversionNo` | 否 | 完整版本号（如"ENG-V8-V1.0"） |
| `stateName` | 否 | 状态（如"正式版"、"草稿"） |
| `checkoutState` | 否 | 检出状态 ID |
| `checkoutState_display` | 否 | 检出状态显示名 |
| `modifyById` | 否 | 最后修改人 ID |
| `modifyById_display` | 否 | 最后修改人姓名 |
| `modifyTime` | 否 | 修改时间 |
| `createById` | 否 | 创建人 ID |
| `createById_display` | 否 | 创建人姓名 |
| `createTime` | 否 | 创建时间 |
| `createTime_display` | 否 | 创建时间（格式化显示用） |
| `contextName` | 否 | 组织/上下文名称 |
| `contextId` | 否 | 组织/上下文 ID |
| `contextId_display` | 否 | 组织显示名 |
| `departmentName` | 否 | 部门名称 |
| `workshopName` | 否 | 车间名称 |
| `personalworkspace` | 否 | 个人工作区 ID |
| `personalworkspace_display` | 否 | 个人工作区显示名 |
| `folderPath` | 否 | 文件夹路径 |
| `phaseId` | 否 | 阶段 ID |
| `phaseId_display` | 否 | 阶段显示名 |
| `secretId` | 否 | 密级 ID |
| `secretId_display` | 否 | 密级显示名（如"内部"、"公开"） |
| `lifeCycleTemplate` | 否 | 生命周期模板 ID |
| `lifeCycleTemplate_display` | 否 | 生命周期模板名称 |
| `taskName` | 否 | 任务名称 |
| `routeContent` | 否 | 工艺路线内容 |
| `mfgNodeName` | 否 | 制造节点名称 |
| `processCharacteristics` | 否 | 工艺特性说明 |
| `note` | 否 | 备注信息 |
| `content` | 否 | 富文本工艺说明（HTML格式） |
| `partCode` | 否 | 关联部件编号 |
| `partName` | 否 | 关联部件名称 |
| `partClassId` | 否 | 部件类型 ID |
| `partClassId_display` | 否 | 部件类型显示名 |
| `partClassId_business_icon` | 否 | 部件业务图标 |
| `partModifyById` | 否 | 部件修改人 ID |
| `partModifyById_display` | 否 | 部件修改人姓名 |
| `partModifyTime` | 否 | 部件修改时间 |
| `partContextName` | 否 | 部件组织名称 |
| `partPhaseId` | 否 | 部件阶段 ID |
| `partPhaseId_display` | 否 | 部件阶段显示名 |
| `partSecretId` | 否 | 部件密级 ID |
| `partSecretId_display` | 否 | 部件密级显示名 |
| `partStateName` | 否 | 部件状态名称 |
| `partFullversionNo` | 否 | 部件完整版本号 |

**JSON 示例（包含常用字段）：**

```json
[
  {
    "innerId": "proc_001",
    "code": "ASM-ENG-001",
    "name": "发动机总装",
    "classId_display": "装配工艺",
    "version": "1",
    "fullversionNo": "ASM-ENG-001-V1",
    "stateName": "正式版",
    "modifyById_display": "张三",
    "modifyTime": "2026-04-01",
    "secretId_display": "内部",
    "departmentName": "发动机事业部",
    "workshopName": "总装车间",
    "partCode": "ENG-V8-001",
    "partName": "V8发动机",
    "partStateName": "已发布",
    "content": "<h3>工艺总览</h3><p>V8发动机总装工艺，包含缸体准备、曲轴安装等关键工序。</p>",
    "note": "适用于V8发动机全系列",
    "tabs_top": "group_process_view",
    "tabs_bottom": "group_bottom_proc",
    "sortOrder": 0
  }
]
```

---

## 六、④ 工序数据 `data/operation.json`

存放每个工序（operation）的详细信息，通过 `processId` 关联到上级工艺。

> ⚠️ **此文件中不能有 `children` 字段**，子级工步通过 `step.json` 中的 `operationId` 关联。

```json
[
  {
    "innerId": "op_001",
    "processId": "proc_001",
    "code": "OP-010",
    "name": "缸体准备",
    "serialNumber": "010",
    "classId_display": "装配工序",
    "isKey": "0",
    "isKey_display": "普通工序",
    "content": "<p>本工序负责对缸体进行预处理，包括清洁、检测等操作。</p>",
    "tabs_top": "group_operation_view",
    "tabs_bottom": "group_bottom_op",
    "sortOrder": 0
  }
]
```

**关键字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `innerId` | ✅ | 唯一ID，必须与工艺树一致 |
| `processId` | ✅ | 填写所属工艺的 `innerId` |
| `tabs_top` | ✅ | 固定填 `"group_operation_view"` |
| `tabs_bottom` | ✅ | 固定填 `"group_bottom_op"` |
| `sortOrder` | ✅ | 排序号，从 0 开始 |
| `serialNumber` | 否 | 工序番号（如 "010"、"020"） |
| `isKey_display` | 否 | 是否关键工序（"关键工序" / "普通工序"） |
| `content` | 否 | 富文本描述，支持 HTML 格式 |

---

## 七、⑤ 工步数据 `data/step.json`

存放每个工步（step）的详细信息。

> ⚠️ **此文件中不能有 `children` 字段**，子级动作通过 `action.json` 中的 `stepId` 关联。

```json
[
  {
    "innerId": "step_001",
    "operationId": "op_001",
    "processId": "proc_001",
    "code": "S-010-01",
    "name": "缸体清洁",
    "serialNumber": "01",
    "classId_display": "清洁工步",
    "note": "使用专用清洗液，注意戴防护手套",
    "content": "<p>使用工业清洗剂对缸体进行清洁：</p><ol><li>喷涂清洗剂</li><li>静置10分钟</li><li>高压水枪冲洗</li><li>压缩空气吹干</li></ol>",
    "tabs_top": "group_step_view",
    "tabs_bottom": "group_bottom_step",
    "sortOrder": 0
  }
]
```

**关键字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `innerId` | ✅ | 唯一ID，必须与工艺树一致 |
| `operationId` | ✅ | 填写所属工序的 `innerId` |
| `processId` | ✅ | 填写所属工艺的 `innerId` |
| `tabs_top` | ✅ | 固定填 `"group_step_view"` |
| `tabs_bottom` | ✅ | 固定填 `"group_bottom_step"` |
| `sortOrder` | ✅ | 排序号，从 0 开始 |
| `note` | 否 | 简短的注意事项提示 |
| `content` | 否 | 详细操作说明，支持 HTML 富文本 |

---

## 八、⑥ 动作数据 `data/action.json`（可选）

如果工步下还需要更细的操作步骤，可以添加动作单元。

```json
[
  {
    "innerId": "act_001",
    "stepId": "step_001",
    "operationId": "op_001",
    "processId": "proc_001",
    "code": "ACT-010-01-01",
    "name": "喷涂清洗剂",
    "serialNumber": "01",
    "content": "<p>均匀喷涂清洗剂，用量约50ml。</p>",
    "tabs_top": "group_step_view",
    "tabs_bottom": "group_bottom_step",
    "sortOrder": 0
  }
]
```

**关键字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `innerId` | ✅ | 唯一ID |
| `stepId` | ✅ | 填写所属工步的 `innerId` |
| `operationId` | ✅ | 填写所属工序的 `innerId` |
| `processId` | ✅ | 填写所属工艺的 `innerId` |
| `tabs_top` | ✅ | 固定填 `"group_step_view"` |
| `tabs_bottom` | ✅ | 固定填 `"group_bottom_step"` |
| `sortOrder` | ✅ | 排序号，从 0 开始 |
| `content` | 否 | 详细动作说明，支持 HTML 富文本 |

**如果没有动作数据，文件内容填 `[]` 即可。**

---

## 九、⑦ 附件清单 `data/attachment.json`

告诉系统每个节点关联了哪些图片、视频等素材，以及这些素材在 `assets/` 目录下的路径。

```json
[
  {
    "id": "res_001",
    "nodeId": "proc_001",
    "type": "image",
    "name": "发动机爆炸图",
    "path": "assets/images/engine_exploded.png",
    "description": "V8发动机总装爆炸视图"
  },
  {
    "id": "res_002",
    "nodeId": "step_001",
    "type": "video",
    "name": "缸体清洁操作视频",
    "path": "assets/videos/clean_process.mp4",
    "description": "演示缸体清洁全过程"
  }
]
```

**字段说明：**

| 字段 | 是否必填 | 说明 |
|------|---------|------|
| `id` | ✅ | 全局唯一ID，自己定义 |
| `nodeId` | ✅ | 关联的节点 `innerId`（这个附件属于哪个工艺/工序/工步） |
| `type` | ✅ | 资源类型，见下表 |
| `name` | ✅ | 显示名称 |
| `path` | ✅ | 文件在包内的路径（相对路径，从包根目录开始） |
| `description` | 否 | 描述说明 |

**资源类型对照：**

| `type` 值 | 说明 | 常见格式 |
|-----------|------|---------| 
| `image` | 图片 | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.bmp` `.svg` |
| `video` | 视频 | `.mp4` `.webm` `.mov` `.avi` `.mkv` |
| `audio` | 音频 | `.mp3` `.wav` `.aac` `.ogg` `.m4a` |
| `document` | 文档 | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.txt` `.wps` |
| `cad` | CAD图纸（HTML格式查看器） | `.html` `.htm` |

> **提示**：如果 `type` 字段填写不准确或省略，系统会根据文件扩展名自动推断资源类型。

---

## 十、⑧ 素材文件放置规则

将实际的图片、视频等文件放到 `assets/` 对应子目录下：

```
assets/
├── images/      ← 图片放这里
├── videos/      ← 视频放这里
├── audios/      ← 音频放这里
├── documents/   ← PDF和文档放这里
└── cad/         ← CAD图纸（HTML格式）放这里
```

- 文件名**不要包含中文和特殊字符**，建议用英文+数字+下划线
- `assets/icons/` 目录下的文件（图标SVG）在导入时会被**自动跳过**，不会占用存储空间

---

## 十一、关于 `content` 富文本字段

`process.json`、`operation.json`、`step.json`、`action.json` 中的 `content` 字段用于展示详细操作说明，支持 HTML 格式。

**常用 HTML 标签：**

```html
<!-- 段落 -->
<p>这是一段说明文字。</p>

<!-- 有序列表（操作步骤）-->
<ol>
  <li>第一步：做什么</li>
  <li>第二步：做什么</li>
</ol>

<!-- 无序列表（注意事项）-->
<ul>
  <li>注意事项一</li>
  <li>注意事项二</li>
</ul>

<!-- 粗体强调 -->
<p><strong>重要提示：</strong>操作前必须断电。</p>

<!-- 标题 -->
<h3>工艺总览</h3>
```

如果没有特别的排版需求，简单的文字内容也可以直接用：
```html
"content": "<p>使用专用工具按顺序拧紧螺栓，扭矩35N·m。</p>"
```

---

## 十二、数据准备核对清单

在交付前请核对以下内容：

- [ ] `manifest.json` 中 `version` 填写了 `"6.0"` 或以上
- [ ] 所有节点的 `innerId` 在整个包内全局唯一，没有重复
- [ ] `process_tree.json` 中每个节点都有 `tabs_top` 和 `tabs_bottom` 字段
- [ ] `process.json`、`operation.json`、`step.json`、`action.json` 中**没有 `children` 字段**
- [ ] `operation.json` 中每条记录的 `processId` 与工艺树中对应工艺的 `innerId` 一致
- [ ] `step.json` 中每条记录的 `operationId` 与对应工序的 `innerId` 一致
- [ ] `action.json` 中每条记录的 `stepId` 与对应工步的 `innerId` 一致
- [ ] 四张关系表（process/operation/step/action）中都包含 `tabs_top` 和 `tabs_bottom` 字段
- [ ] `attachment.json` 中每个 `path` 对应的文件真实存在于 `assets/` 目录下
- [ ] 所有 JSON 文件格式正确（可用在线工具如 [jsonlint.com](https://jsonlint.com) 验证）
- [ ] 整体打包为 ZIP 后将扩展名改为 `.srd`

---

## 十三、快速参考：`innerId` 关联关系图

```
process_tree.json                  关系表数据文件
─────────────────         ─────────────────────────────────
proc_001 (process)    ←→  process.json  中 innerId = "proc_001"
  │
  └── op_001 (operation) ←→  operation.json 中 innerId = "op_001"
                                              processId = "proc_001"
        │
        └── step_001 (step) ←→  step.json 中 innerId = "step_001"
                                             operationId = "op_001"
                                             processId = "proc_001"
                │
                └── act_001 (action) ←→  action.json 中 innerId = "act_001"
                                                         stepId = "step_001"
                                                         operationId = "op_001"
                                                         processId = "proc_001"
```

**一句话记住：树里的 `innerId` = 数据表里的 `innerId`，子节点数据表里还要填所有上级父节点的 `innerId` 作为外键。**

---

## 十四、为什么关系表也需要 `tabs_top` / `tabs_bottom`？

你可能会疑问：工艺树骨架 (`process_tree.json`) 里已经有了 `tabs_top`/`tabs_bottom`，为什么工序/工步等关系表里也要填一遍？

**因为用户不只会点树节点。** 当用户在工艺视图的"工序列表"表格中直接点击某一行工序时，该行数据来自 `t_operation` 数据库查询结果，系统需要依靠该记录自身的 `tabs_top` 字段来判断应该渲染哪组 UI 视图。如果关系表中缺少这两个字段，点击列表中的工序将导致 UI 区域变空白，什么也不显示。

**结论**：`tabs_top` / `tabs_bottom` 是每个业务实体自带的"UI路由声明"，无论该实体从哪个入口被访问（树节点点击/列表点击/搜索结果点击），系统都能正确切换视图。请务必在四张关系表中一并提供这两个字段。

---

## 十五、数据包加密打包规范（后端开发参考）

V6 引入了可选的 **AES-256-CBC** 加密机制，用于防止 U 盘传输过程中工艺数据被直接解压查看。

### 15.1 加密文件格式

加密后的文件**不含任何魔数头部**，直接按如下两段式结构组织：

```
[0~15字节]   IV（16字节随机数）
[16字节~结尾] AES-256-CBC 密文（原始ZIP数据）
```

> ⚠️ 注意：与部分旧版设计文档描述不同，当前客户端实现（`utils/crypto.uts`）**不含 SRDE 魔数或 SHA-256 校验头**，只有 IV + 密文两段结构。请严格按本文档实现。

### 15.2 加密密钥

```
MPM_OFFLINE_2026_SECURE_KEY_256B
```
（取前32字节作为AES-256密钥，加解密双端必须完全一致）

### 15.3 Java 加密实现

```java
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.io.ByteArrayOutputStream;

public class SrdEncryptor {
    private static final String PRESET_KEY = "MPM_OFFLINE_2026_SECURE_KEY_256B";

    public static byte[] encryptZip(byte[] zipData) throws Exception {
        // 1. 随机生成 16 字节 IV
        byte[] iv = new byte[16];
        new SecureRandom().nextBytes(iv);

        // 2. 构建 AES-256 密钥（取前 32 字节）
        byte[] keyBytes = PRESET_KEY.substring(0, 32)
                .getBytes(StandardCharsets.UTF_8);
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");
        IvParameterSpec ivSpec = new IvParameterSpec(iv);

        // 3. AES/CBC/PKCS5Padding 加密
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);
        byte[] encryptedData = cipher.doFinal(zipData);

        // 4. 组装：IV（16字节）+ 密文
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(iv);
        out.write(encryptedData);
        return out.toByteArray();
    }
}
```

### 15.4 集成方式

```java
// 正常构建 ZIP
byte[] zipArray = buildZip();

// 可选：加密封装
byte[] srdArray = SrdEncryptor.encryptZip(zipArray);

// 写入文件
Files.write(Paths.get("V8发动机总装工艺包.srd"), srdArray);
```

> **兼容说明**：加密是在打出原始 ZIP 后追加的"外壳"，不影响包内的任何 JSON 结构和文件路径。客户端解密失败时会自动回退按未加密 ZIP 处理，因此**不加密的 ZIP 改扩展名为 `.srd` 同样可以正常导入**。

---

## 附：完整目录结构示例

```
V8发动机工艺包/
├── manifest.json
├── data/
│   ├── process_tree.json
│   ├── process.json
│   ├── operation.json
│   ├── step.json
│   ├── action.json
│   └── attachment.json
├── layout/                  ← 开发提供，不用改动
│   ├── tabs.json
│   ├── tab.json
│   ├── components.json
│   └── icons.json
└── assets/
    ├── images/
    │   ├── engine_exploded.png
    │   └── block_clean.jpg
    ├── videos/
    │   └── clean_process.mp4
    └── documents/
        └── assembly_spec.pdf
```

将 `V8发动机工艺包/` 整个文件夹压缩为 ZIP，然后将扩展名从 `.zip` 改为 `.srd`，交付即可。
