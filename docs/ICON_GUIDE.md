# 图标管理指南

本项目采用**预置图标 + 配置映射**的方案管理图标资源。

## 目录结构

```
项目根目录/
├── static/
│   └── icons/              ← 图标文件存放目录
│       ├── process.svg     # 工艺图标
│       ├── procedure.svg   # 工序图标
│       ├── step.svg        # 工步图标
│       ├── default.svg     # 默认图标
│       └── [自定义].svg    # 其他自定义图标
└── tmp/srd_gen/
    └── ui/
        └── icons.json      ← 图标配置文件
```

## 如何添加新图标

### 步骤 1：准备图标文件

1. 准备 SVG 格式的图标文件（推荐 24x24 尺寸）
2. 将图标文件放入 `static/icons/tree/` 或相应分类目录
3. 建议使用描述性的文件名，如 `tool.svg`、`material.svg`

**SVG 图标模板：**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" 
     fill="none" stroke="#409EFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- 图标路径 -->
</svg>
```

### 步骤 2：更新图标配置

编辑 `tmp/srd_gen/ui/icons.json`：

```json
{
  "nodeIcons": {
    "process": {
      "icon": "process",      // 对应 static/icons/tree/process.svg
      "fallback": "📋"        // 文本场景的回退 emoji
    },
    "procedure": {
      "icon": "procedure",
      "fallback": "🔧"
    },
    "step": {
      "icon": "step", 
      "fallback": "⚙️"
    },
    "tool": {                  // 新增类型
      "icon": "tool",          // 对应 static/icons/tree/tool.svg
      "fallback": "🔨"
    },
    "default": {
      "icon": "default",
      "fallback": "📄"
    }
  }
}
```

### 步骤 3：重新打包数据包

```powershell
Compress-Archive -Force -Path tmp/srd_gen/manifest.json, tmp/srd_gen/ui, tmp/srd_gen/processes, tmp/srd_gen/data -DestinationPath static/data_package.zip
Move-Item -Path static/data_package.zip -Destination static/data_package.srd -Force
```

### 步骤 4：重新导入

在应用中执行 **Reset + Import** 操作。

---

## 图标使用方式

图标在节点数据中以两种形式存在：

| 字段 | 类型 | 用途 |
|------|------|------|
| `displayName` | `📋 工艺名称` | 文本场景（表格列） |
| `iconPath` | `/static/icons/tree/process.svg` | 图片场景（可扩展） |

### 在表格中使用（当前）

目前使用 `displayName` 字段，包含 emoji + 名称：

```html
<text>{{ node.displayName }}</text>
```

### 在图片组件中使用（可扩展）

```html
<image :src="node.iconPath" style="width: 24px; height: 24px;"></image>
<text>{{ node.name }}</text>
```

---

## 预置图标说明

| 文件名 | 用途 | 颜色 |
|--------|------|------|
| `process.svg` | 工艺/流程 | 蓝色 #409EFF |
| `procedure.svg` | 工序/操作 | 绿色 #67C23A |
| `step.svg` | 工步/步骤 | 橙色 #E6A23C |
| `default.svg` | 默认/未知 | 灰色 #909399 |

---

## 注意事项

1. **图标文件必须在项目中**：与数据包分离，不随导入变化
2. **添加新图标需发版**：如果需要新类型图标，必须在项目中添加文件
3. **fallback 用于兼容**：在不支持图片的场景（如纯文本表格列）使用 emoji
4. **推荐使用 SVG**：矢量格式，跨平台显示一致
