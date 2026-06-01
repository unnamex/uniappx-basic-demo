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
      
      // 安全地将前端传过来的对象转换为 Node.js Buffer
      let dataBytes;
      if (Buffer.isBuffer(encryptedBuffer)) {
        dataBytes = encryptedBuffer;
      } else if (encryptedBuffer instanceof Uint8Array) {
        dataBytes = Buffer.from(encryptedBuffer.buffer, encryptedBuffer.byteOffset, encryptedBuffer.byteLength);
      } else if (encryptedBuffer instanceof ArrayBuffer) {
        dataBytes = Buffer.from(encryptedBuffer);
      } else {
        // Fallback for weird contextBridge serialized objects
        dataBytes = Buffer.from(new Uint8Array(encryptedBuffer));
      }
      
      if (dataBytes.length < 16) {
        return { success: false, data: null, errorMessage: '数据包格式错误：数据太短 (' + dataBytes.length + ' bytes)' }
      }
      
      const iv = dataBytes.slice(0, 16)
      const cipherText = dataBytes.slice(16)
      
      // 构建密钥（截取前 32 字节）
      const key = Buffer.from(keyString.substring(0, 32), 'utf-8')
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
      const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()])
      
      // 【关键修复】返回一个新的独立 Uint8Array 以避免暴露底层的 Buffer pool
      // 同时 Uint8Array 是 contextBridge 支持最佳的类型
      const resultView = new Uint8Array(decrypted.buffer, decrypted.byteOffset, decrypted.length)
      // 返回深拷贝以确保安全通过 Bridge
      return { success: true, data: new Uint8Array(resultView), errorMessage: '' }
    } catch (e) {
      console.error('Node解密异常:', e)
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
