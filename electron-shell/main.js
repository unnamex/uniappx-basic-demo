const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')

// 禁用硬件加速（解决部分麒麟系统上的渲染问题）
// app.disableHardwareAcceleration()

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: '开物',
    icon: path.join(__dirname, 'icons/icon.png'),
    show: false, // 先隐藏，等加载完成后再显示（避免白屏闪烁）
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 安全：隔离上下文
      nodeIntegration: false,   // 安全：禁用 Node 集成
      sandbox: true             // 安全：启用沙箱
    }
  })

  // 加载 H5 产物
  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))

  // 页面加载完成后再显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 生产环境安全配置
  if (app.isPackaged) {
    // 移除默认菜单
    Menu.setApplicationMenu(null)

    // 禁用开发者工具快捷键
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.key === 'F12' ||
        (input.control && input.shift && input.key === 'I') ||
        (input.control && input.shift && input.key === 'J')
      ) {
        event.preventDefault()
      }
    })
  }

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---- IPC 处理 ----

// 获取应用版本
ipcMain.handle('get-version', () => {
  return app.getVersion()
})

// 窗口控制
ipcMain.on('window-minimize', () => {
  if (mainWindow != null) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (mainWindow != null) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow != null) mainWindow.close()
})

// 应用就绪
app.whenReady().then(createWindow)

// macOS 点击 dock 图标重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
