const { contextBridge, ipcRenderer } = require('electron')

// 向渲染进程安全暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getVersion: () => ipcRenderer.invoke('get-version'),

  // 获取平台信息
  getPlatform: () => process.platform,

  // 检测当前是否包含完整的 AI 功能模块
  checkAiFeature: () => ipcRenderer.invoke('check-ai-feature'),

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

  // 高效保存临时文档（使用 ArrayBuffer 绕过 Base64 转换以提升大文件加载速度）
  saveTempDocBuffer: (buffer, filename) => ipcRenderer.invoke('save-temp-doc-buffer', buffer, filename),

  // 监听菜单操作
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (_event, action) => callback(action)),

  // 沉浸式全屏控制（隐藏标题栏和菜单栏）
  enterImmersive: () => ipcRenderer.send('enter-immersive'),
  exitImmersive: () => ipcRenderer.send('exit-immersive'),
  
  // 监听退出全屏事件
  onLeaveFullScreen: (callback) => ipcRenderer.on('window-leave-full-screen', () => callback()),

  // 同步解密 AES-256-CBC (供前端解密 SRD 离线包使用)
  decryptAES_CBC_Sync: (encryptedBuffer, keyString) => {
    try {
      const crypto = require('crypto')
      // encryptedBuffer 从前端传过来可能被 contextBridge 处理为普通对象或 Uint8Array
      const dataBytes = new Uint8Array(encryptedBuffer)
      
      if (dataBytes.length < 16) {
        return { success: false, data: null, errorMessage: '数据包格式错误：数据太短' }
      }
      
      const iv = dataBytes.slice(0, 16)
      const cipherText = dataBytes.slice(16)
      
      // 构建密钥（截取前 32 字节）
      const key = Buffer.from(keyString.substring(0, 32), 'utf-8')
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
      // 注意：加密后端使用了 PKCS5Padding，在 Node.js 中 aes-256-cbc 默认就是启用 autoPadding (PKCS7/5) 的
      const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()])
      
      // 返回 ArrayBuffer 给渲染进程
      return { success: true, data: new Uint8Array(decrypted).buffer, errorMessage: '' }
    } catch (e) {
      return { success: false, data: null, errorMessage: 'Node 解密失败：' + e.message }
    }
  },

  // 同步验证 MD5 (供前端校验 SRD 离线包使用)
  verifyMD5_Sync: (buffer, expectedChecksum) => {
    try {
      const crypto = require('crypto')
      const hash = crypto.createHash('md5').update(new Uint8Array(buffer)).digest('hex')
      return hash.toLowerCase() === expectedChecksum.toLowerCase()
    } catch (e) {
      console.error('Node MD5 校验失败：', e.message)
      return false
    }
  }
})
