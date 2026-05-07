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
  close: () => ipcRenderer.send('window-close')
})
