const { contextBridge, ipcRenderer } = require('electron')

// 向渲染进程安全暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getVersion: () => ipcRenderer.invoke('get-version'),

  // 获取平台信息
  getPlatform: () => process.platform,

  // 最小化窗口
  minimize: () => ipcRenderer.send('window-minimize'),

  // 最大化/还原窗口
  maximize: () => ipcRenderer.send('window-maximize'),

  // 关闭窗口
  close: () => ipcRenderer.send('window-close'),

  // 获取 ranuts-document 内嵌服务器端口
  getRanutsDocPort: () => ipcRenderer.invoke('get-ranuts-doc-port'),

  // 保存临时文档到 HTTP 服务器目录（返回相对 URL 路径）
  saveTempDoc: (base64, filename) => ipcRenderer.invoke('save-temp-doc', base64, filename)
})
