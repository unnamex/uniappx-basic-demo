const { contextBridge, ipcRenderer } = require('electron')

// 向渲染进程安全暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getVersion: () => ipcRenderer.invoke('get-version'),

  // 获取平台信息
  getPlatform: () => process.platform,

  // 获取更详细的操作系统信息
  getOsInfo: () => {
    try {
      const os = require('os')
      let type = os.type()
      if (type === 'Windows_NT') type = 'Windows'
      else if (type === 'Darwin') type = 'macOS'
      else if (type === 'Linux') type = 'Linux'
      return `${type} ${os.release()} (${os.arch()})`
    } catch (e) {
      return process.platform
    }
  },

  // 获取系统/应用版本信息
  getVersions: () => process.versions,

  // 最小化窗口
  minimize: () => ipcRenderer.send('window-minimize'),

  // 最大化/还原窗口
  maximize: () => ipcRenderer.send('window-maximize'),

  // 关闭窗口
  close: () => ipcRenderer.send('window-close'),

  // 获取 ranuts-document 内嵌服务器端口
  getRanutsDocPort: () => ipcRenderer.invoke('get-ranuts-doc-port'),

  // 保存临时文档到 HTTP 服务器目录（返回相对 URL 路径）
  saveTempDoc: (base64, filename) => ipcRenderer.invoke('save-temp-doc', base64, filename),

  // 监听菜单操作
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (_event, action) => callback(action)),

  // 沉浸式全屏控制（隐藏标题栏和菜单栏）
  enterImmersive: () => ipcRenderer.send('enter-immersive'),
  exitImmersive: () => ipcRenderer.send('exit-immersive'),
  
  // 监听退出全屏事件
  onLeaveFullScreen: (callback) => ipcRenderer.on('window-leave-full-screen', () => callback())
})
