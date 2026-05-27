# CraftX — 离线工艺预览系统

基于 **uni-app x** 开发的跨平台离线工艺预览系统，支持 Android、HarmonyOS、Web 和 **Windows 桌面端**（Electron + 离线 AI 工艺助手）。

---

## 功能特性

- **工艺数据包导入**：支持导入 AES-256 加密的 `.mpm` 工艺数据包
- **工艺浏览**：工艺列表、详情、步骤查看，支持搜索和分页
- **多媒体预览**：图片、视频、Office 文档（Word/Excel/PPT）在线预览
- **离线 AI 助手**：内嵌 Ollama + Qwen2.5 大模型，支持工艺问答、节点分析、RAG 检索增强
- **离线运行**：所有数据和 AI 模型均在本地运行，无需联网
- **跨平台**：Android / HarmonyOS / Web / Windows Desktop

---

## 技术架构

```
┌──────────────────────────────────────────────┐
│              CraftX 应用架构                  │
├──────────────┬───────────────────────────────┤
│  前端 (UI)   │ uni-app x (Vue3 + UTS)       │
│              │ 编译为 H5 / Android / 鸿蒙    │
├──────────────┼───────────────────────────────┤
│  桌面壳      │ Electron 42                   │
│  (仅PC端)    │ Express API 中转层            │
├──────────────┼───────────────────────────────┤
│  AI 引擎     │ Ollama (本地推理)             │
│              │ qwen2.5 (对话) + nomic (嵌入) │
│              │ BGE-small-zh (语义向量)        │
├──────────────┼───────────────────────────────┤
│  文档预览    │ ranuts-document (OnlyOffice)  │
└──────────────┴───────────────────────────────┘
```

---

## 环境要求

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| [HBuilderX](https://www.dcloud.io/hbuilderx.html) | 4.61+ | uni-app x 编译 |
| [Node.js](https://nodejs.org/) | 18+ | Electron 运行和构建 |
| npm | 随 Node.js 安装 | 依赖管理 |

**Windows 桌面端额外要求：**

| 资源 | 说明 |
|------|------|
| 内存 | lite: 2GB+, standard: 4GB+, **pro: 8GB+** |
| 磁盘 | 约 5~12 GB（Ollama 引擎 + AI 模型） |
| GPU（可选） | NVIDIA / AMD 独立显卡可加速推理 |

---

## 项目结构

```
avpbc-pop/
├── pages/                    # 页面文件
│   ├── index/                #   首页（统计和快捷入口）
│   ├── import/               #   数据导入页面
│   ├── process/              #   工艺列表和详情
│   ├── video/                #   视频播放
│   └── settings/             #   设置页面
├── components/               # 自定义组件
├── services/                 # 核心服务
│   ├── database.uts          #   SQLite / IndexedDB 数据库
│   ├── dataPackage.uts       #   数据包解密、解压、解析
│   ├── processService.uts    #   工艺数据查询
│   └── fileService.uts       #   资源文件管理
├── utils/                    # 工具类
├── static/                   # 静态资源
├── electron-shell/           # Electron 桌面端壳工程
│   ├── main.js               #   主进程入口
│   ├── preload.js            #   预加载脚本
│   ├── ai-service/           #   AI 助手服务（RAG、意图识别等）
│   ├── scripts/              #   构建和工具脚本
│   ├── vendor/               #   (gitignore) Ollama + AI 模型
│   ├── setup-vendor.ps1      #   ⭐ 一键初始化脚本
│   └── setup-vendor.bat      #   ⭐ 双击运行的启动器
├── manifest.json             # uni-app x 配置
├── pages.json                # 页面路由配置
└── .gitignore
```

---

## 快速开始

### 一、移动端 / Web 端（Android / HarmonyOS / H5）

```bash
# 1. 用 HBuilderX 打开项目根目录

# 2. 安装根项目依赖
npm install

# 3. 在 HBuilderX 中选择目标平台运行
#    - Android: 运行 → 运行到手机或模拟器
#    - HarmonyOS: 运行 → 运行到鸿蒙
#    - Web/H5: 运行 → 运行到浏览器
```

### 二、Windows 桌面端（Electron + AI）

桌面端需要额外下载 Ollama 引擎和 AI 模型（约 5~12 GB），项目提供了**一键初始化脚本**。

#### 步骤 1：初始化 AI 环境

**方式 A：双击运行（推荐）**

双击 `electron-shell/setup-vendor.bat`，按提示选择模型规格即可。

**方式 B：命令行**

```powershell
cd electron-shell

# 默认 pro 规格（qwen2.5:7b，推荐 8GB+ 内存）
.\setup-vendor.ps1

# 或选择其他规格
.\setup-vendor.ps1 -Tier lite       # 轻量版 qwen2.5:1.5b（2GB+ 内存）
.\setup-vendor.ps1 -Tier standard   # 标准版 qwen2.5:3b（4GB+ 内存）
```

脚本会自动完成：
1. ✅ 下载 Ollama v0.5.7 引擎 → `vendor/ollama/`
2. ✅ 拉取 qwen2.5 + nomic-embed-text 模型 → `vendor/models/`
3. ✅ 下载 BGE 嵌入模型 → `vendor/embed-models/`
4. ✅ 安装 electron-shell 的 npm 依赖
5. ✅ 安装根项目的 npm 依赖

#### 步骤 2：编译 H5 产物

在 **HBuilderX** 中：
1. 打开项目根目录
2. 点击菜单：**发行 → 网站-PC Web 或手机 H5**
3. 等待编译完成，产物输出到 `unpackage/dist/build/web/`

#### 步骤 3：拷贝产物到 Electron

```bash
cd electron-shell
npm run copy:dist
```

> 这会将 `unpackage/dist/build/web/` 复制到 `electron-shell/dist/`。

#### 步骤 4：启动应用

```bash
cd electron-shell
npm start
```

---

## 生产打包（Electron）

```bash
cd electron-shell

# 完整版（包含 NVIDIA + AMD + CPU 推理支持）
npm run pack:win

# 或按 GPU 类型单独打包（缩小体积）
npm run pack:win:cpu       # 纯 CPU（最小体积）
npm run pack:win:nvidia    # NVIDIA 显卡
npm run pack:win:amd       # AMD 显卡
```

打包产物输出到 `electron-shell/release/` 目录。

---

## AI 模型规格说明

| 规格 | 模型 | 模型大小 | 内存要求 | 推理速度 | 适用场景 |
|------|------|----------|----------|----------|----------|
| **lite** | qwen2.5:1.5b | ~1 GB | 2 GB+ | 最快 | 低配电脑、快速测试 |
| **standard** | qwen2.5:3b | ~2 GB | 4 GB+ | 较快 | 日常使用 |
| **pro** | qwen2.5:7b | ~4.5 GB | 8 GB+ | 中等 | 最佳效果（推荐） |

所有规格均包含 `nomic-embed-text` 嵌入模型（用于 RAG 检索）和 `bge-small-zh-v1.5`（用于中文语义向量）。

---

## 常用命令速查

```bash
# ---- 根项目 ----
npm install                          # 安装根项目依赖

# ---- Electron 桌面端（在 electron-shell/ 下执行）----
.\setup-vendor.ps1                   # 一键初始化 AI 环境
npm install                          # 安装 Electron 依赖
npm run copy:dist                    # 拷贝 H5 编译产物
npm start                            # 启动 Electron 应用
npm run pack:win                     # 打包 Windows 安装包
npm run prepare:lite                 # 切换为轻量版模型
npm run prepare:standard             # 切换为标准版模型
npm run prepare:pro                  # 切换为专业版模型
```

---

## 注意事项

- `electron-shell/vendor/` 目录已加入 `.gitignore`，**不会提交到 Git**。新同事需运行初始化脚本下载。
- Web 端部分功能受浏览器 API 限制（如数据包解压）。
- HarmonyOS 端需 HBuilderX 4.61+ 编译到鸿蒙真机/模拟器验证。
- AI 功能仅在 Electron 桌面端可用。
