# 经验教训：文件类型解析与扩展名识别

## 问题背景
在 OnlyOffice / `ranuts-document` 文档预览和编辑模块中，打开 `.ppt` 格式文件时，控制台抛出操作失败异常 `unsupported file format: pot`。

## 原因分析
1. 原程序在获取文件扩展名 `fileExt` 时，使用了如下逻辑：
   ```typescript
   const fileExt = getExtensions(file?.type)[0] || fileName.split('.').pop() || '';
   ```
2. 当打开 `.ppt` 文件时，其 `file.type` (MIME) 通常是 `application/vnd.ms-powerpoint`。
3. `getExtensions` 方法针对 `application/vnd.ms-powerpoint` 会返回可用的候选扩展名数组，其中首个元素为 `pot` (PowerPoint 模板文件)。
4. 这导致真实的 `.ppt` 文件在通过 MIME 反向推导时被错误识别成了 `pot` 扩展名。
5. 在支持的文件格式字典 `DOCUMENT_TYPE_MAP` 中，并未注册 `pot` 格式，从而最终抛出了 `Unsupported file format: pot` 的异常，导致 PPT 文档无法加载。

## 解决方案
- **优先取用文件名自带的扩展名**：文件的真实后缀名可以直接从 `file.name` 提取。通过 MIME 去逆向推理往往是一对多的关系，极易产生偏差。
- 优化后的逻辑：
  ```typescript
  const extFromFileName = fileName.includes('.') ? fileName.split('.').pop() : null;
  const fileExt = extFromFileName || getExtensions(file?.type)[0] || '';
  ```
- 修改 `temp_ranuts/lib/document-converter.ts` 和 `temp_ranuts/lib/converter.ts` 并在修改后重新打包 `temp_ranuts`，将构建出的产物同步到主项目的 `static/ranuts-document/` 下。
