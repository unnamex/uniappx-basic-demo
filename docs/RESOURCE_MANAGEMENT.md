# 工艺静态资源管理设计文档

## 一、概述

本文档描述了工艺/工序/工步静态资源（视频、图片、音频、文档）的数据包结构设计和UI交互方案。

## 二、数据包结构 (V3)

### 1. 目录结构

```
my_package.srd (ZIP格式)
├── manifest.json           # 清单文件
├── ui/
│   ├── groups.json         # Tab分组配置
│   ├── tabs.json           # Tab配置
│   ├── components.json     # 组件配置
│   └── icons.json          # 图标配置
├── data/
│   └── records.json        # 数据记录
├── processes/
│   └── proc_xxx.json       # 工艺树数据（含资源引用）
└── assets/                 # 静态资源目录
    ├── images/             # 图片资源
    ├── videos/             # 视频资源
    ├── audios/             # 音频资源
    └── docs/               # 文档资源
```

### 2. manifest.json 配置

```json
{
  "name": "工艺包名称",
  "version": "3.0",
  "description": "包含工艺数据和多媒体资源",
  "files": {
    "groups": "ui/groups.json",
    "tabs": "ui/tabs.json",
    "components": "ui/components.json",
    "icons": "ui/icons.json",
    "records": "data/records.json",
    "processes": ["processes/proc_xxx.json"],
    "assets": "assets/"
  }
}
```

### 3. 资源引用格式

工艺节点中通过 `resources` 字段引用资源：

```json
{
  "id": "proc_xxx_op01_s01",
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
      "description": "详细描述"
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

## 三、资源类型定义

### 类型文件: `types/resource.uts`

```typescript
export type ResourceItem = {
  id: string              // 唯一ID
  type: string            // image | video | audio | document
  name: string            // 显示名称
  path: string            // 本地路径（导入后更新）
  originalPath: string    // 原始包内路径
  thumbnail: string       // 缩略图路径
  duration: number        // 时长（视频/音频，秒）
  size: number            // 文件大小
  description: string     // 描述
  nodeId: string          // 关联节点ID
  sortOrder: number       // 排序序号
}
```

## 四、数据库表设计

### t_resources 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 资源唯一ID |
| node_id | TEXT NOT NULL | 关联节点ID |
| type | TEXT NOT NULL | 资源类型 |
| name | TEXT NOT NULL | 显示名称 |
| path | TEXT NOT NULL | 本地存储路径 |
| original_path | TEXT | 原始包内路径 |
| thumbnail | TEXT | 缩略图路径 |
| duration | INTEGER | 时长（秒） |
| size | INTEGER | 文件大小 |
| description | TEXT | 描述 |
| sort_order | INTEGER | 排序序号 |
| created_at | TIMESTAMP | 创建时间 |

## 五、UI 组件

### 1. 资源预览组件 `resource-preview.uvue`

位置: `components/resource-preview/`

功能:

- 图片预览: 使用 `<image>` 组件
- 视频预览: 使用 `<video>` 组件，支持播放控制
- 音频预览: 自定义播放器界面
- 文档预览: 显示图标，提供打开按钮

### 2. 资源列表组件 `resource-list.uvue`

位置: `components/resource-list/`

功能:

- 横向滚动展示资源卡片
- 显示缩略图/类型图标
- 显示资源名称和时长
- 支持选中状态高亮
- 滚动进度指示器

## 六、交互流程

```
┌─────────────────────────────────────────────────────────────┐
│                    用户点击左侧树节点                         │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              handleRowClick 处理函数                         │
│                                                              │
│  1. 更新选中状态                                             │
│  2. 加载节点对应的 Tab Group                                 │
│  3. 调用 loadNodeResources(nodeId)                          │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            从数据库查询节点关联的资源                         │
│            getResourcesByNodeId(nodeId)                      │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│        更新 nodeResources 和 previewResource                 │
│        默认预览第一个资源                                     │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            右侧区域显示资源预览和列表                         │
│   ┌───────────────────────────────────────────────────┐     │
│   │              资源预览区 (70%)                       │     │
│   │   显示选中资源的预览（图片/视频/音频/文档）          │     │
│   ├───────────────────────────────────────────────────┤     │
│   │              资源列表区 (30%)                       │     │
│   │   横向滚动展示所有关联资源                          │     │
│   └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 七、导入流程

1. **选择数据包** - 用户选择 .srd 文件
2. **解压 ZIP** - 使用平台对应的 ZIP 解压库
3. **解析 manifest** - 检测版本和配置
4. **导入 UI 配置** - 保存到 meta_* 表
5. **导入工艺数据** - 保存到 t_process 表
6. **提取资源** - 将 assets/ 目录下的文件复制到应用沙盒
7. **保存资源元数据** - 保存到 t_resources 表，更新 path 为本地路径

## 八、文件说明

| 文件 | 说明 |
|------|------|
| `types/resource.uts` | 资源类型定义 |
| `types/data-package.uts` | 数据包类型定义（已扩展） |
| `services/resourceService.uts` | 资源服务 |
| `services/database.uts` | 数据库服务（已扩展） |
| `components/resource-preview/resource-preview.uvue` | 资源预览组件 |
| `components/resource-list/resource-list.uvue` | 资源列表组件 |
| `pages/index/index.uvue` | 主页面（已修改） |

## 九、平台兼容性

| 功能 | H5 | Android | HarmonyOS |
|------|-----|---------|-----------|
| ZIP 解压 | JSZip | java.util.zip | 待实现 |
| 资源存储 | IndexedDB + Blob | 文件系统 | 文件系统 |
| 图片预览 | ✅ | ✅ | ✅ |
| 视频播放 | ✅ | ✅ | ✅ |
| 音频播放 | Web Audio | InnerAudioContext | ✅ |
| 文档打开 | window.open | uni.openDocument | ✅ |

## 十、后续优化建议

1. **缩略图自动生成** - 视频首帧提取，减少包体积
2. **资源缓存策略** - LRU 缓存，控制内存占用
3. **分页加载** - 大量资源时分页显示
4. **资源搜索** - 支持按名称搜索
5. **资源分类筛选** - 按类型过滤显示
