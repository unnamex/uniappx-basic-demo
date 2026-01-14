# MPM 离线工艺预览系统

这是一个基于 uni-app x 开发的 Android + HarmonyOS + Web 跨平台工艺预览系统。

## 功能特性

* **数据包导入**：支持导入加密的 MPM 工艺数据包（.mpm）。
* **工艺列表**：展示所有导入的工艺，支持搜索和分页。
* **工艺详情**：查看工艺的基本信息、详细步骤、工具/材料清单。
* **多媒体预览**：支持预览工艺步骤中的图片和视频。
* **离线存储**：所有数据和资源文件均存储在本地，支持离线使用。
* **安全加密**：数据包采用 AES-256 加密保护。

## 项目结构

* `pages/`: 页面文件
  * `index/`: 首页，包含统计和快捷入口。
  * `import/`: 数据导入页面。
  * `process/`: 工艺列表和详情页面。
  * `video/`: 视频播放页面。
  * `settings/`: 设置页面。
* `services/`: 核心服务
  * `database.uts`: SQLite/IndexedDB 数据库操作。
  * `dataPackage.uts`: 数据包解密、解压和解析。
  * `processService.uts`: 工艺数据的查询服务。
  * `fileService.uts`: 资源文件的管理服务。
* `components/`: 自定义组件
  * `process-card`: 工艺列表卡片。
  * `process-step`: 工艺步骤组件。
* `utils/`: 工具类
  * `crypto.uts`: 加解密工具。

## 运行说明

1. 使用 HBuilderX 打开项目目录。
2. 运行到 Android 模拟器或真机。
3. Web 端运行需要现代浏览器支持。

## 注意事项

* Web 端目前仅支持部分功能（数据包解压依赖浏览器 API，可能受限）。
* HarmonyOS 端加解密功能暂为占位实现，需根据鸿蒙 SDK 补充。
