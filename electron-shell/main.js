const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

// 禁用硬件加速（解决部分麒麟系统上的渲染问题）
// app.disableHardwareAcceleration()

let mainWindow = null
let ranutsDocPort = 0 // ranuts-document 内嵌 HTTP 服务器端口
let tempDocDir = ''   // 临时文档存储目录（系统临时目录，非 asar 内部）

// ---- ranuts-document 内嵌静态文件服务器 ----
// 解决 file:// 协议下 OnlyOffice 编辑器无法正常加载 WASM/Worker/SDK 的问题

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.bin': 'application/octet-stream',
  // Office 文档格式（ranuts-document 需要正确的 Content-Type 来识别文件类型）
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pdf': 'application/pdf',
}

function serveStaticFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
    const stream = fs.createReadStream(filePath)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Content-Length': stats.size
    })
    stream.pipe(res)
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    })
  })
}

function startRanutsDocServer() {
  const ROOT = path.join(__dirname, 'dist', 'static', 'ranuts-document')

  // 检查目录是否存在
  if (!fs.existsSync(ROOT)) {
    console.warn('[ranuts-document] 目录不存在，跳过服务器启动:', ROOT)
    return
  }

  const server = http.createServer((req, res) => {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    let urlPath = req.url.split('?')[0]
    if (urlPath === '/') urlPath = '/index.html'

    // /_tmp/ 路由：从系统临时目录伺服临时文档文件
    if (urlPath.startsWith('/_tmp/') && tempDocDir) {
      const tmpFileName = decodeURIComponent(urlPath.substring(6)) // 去掉 '/_tmp/' 前缀
      const tmpFilePath = path.join(tempDocDir, tmpFileName)
      // 安全检查：防止路径穿越
      if (!tmpFilePath.startsWith(tempDocDir)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }
      serveStaticFile(tmpFilePath, res)
      return
    }

    const filePath = path.join(ROOT, decodeURIComponent(urlPath))

    // 安全检查：防止路径穿越
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        if (!err && stats && stats.isDirectory()) {
          const indexPath = path.join(filePath, 'index.html')
          fs.access(indexPath, fs.constants.F_OK, (err2) => {
            if (!err2) {
              serveStaticFile(indexPath, res)
            } else {
              res.writeHead(404)
              res.end('Not Found')
            }
          })
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
        return
      }
      serveStaticFile(filePath, res)
    })
  })

  // 端口 0 = 让系统自动分配可用端口，避免冲突
  server.listen(0, '127.0.0.1', () => {
    ranutsDocPort = server.address().port
    console.log('[ranuts-document] 内嵌 HTTP 服务器已启动: http://127.0.0.1:' + ranutsDocPort)
  })
}

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
      sandbox: true,            // 安全：启用沙箱
      webSecurity: false        // 允许 file:// 协议加载 module 和跨域 fetch (解决离线文档预览 CORS)
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
    // Menu.setApplicationMenu(null)

    // 禁用开发者工具快捷键
    // mainWindow.webContents.on('before-input-event', (event, input) => {
    //   if (
    //     input.key === 'F12' ||
    //     (input.control && input.shift && input.key === 'I') ||
    //     (input.control && input.shift && input.key === 'J')
    //   ) {
    //     event.preventDefault()
    //   }
    // })
  }

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 监听退出全屏事件（例如用户按下 ESC 键）
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window-leave-full-screen')
  })

  createMenu()
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入数据包',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-action', 'import-data')
          }
        },
        {
          label: '重置数据',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-action', 'reset-data')
          }
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ---- IPC 处理 ----

// 获取应用版本
ipcMain.handle('get-version', () => {
  return app.getVersion()
})

// 获取 ranuts-document 内嵌服务器端口
ipcMain.handle('get-ranuts-doc-port', () => {
  return ranutsDocPort
})

// 保存临时文档到系统临时目录（打包后 asar 内部只读，不能写入）
// HTTP 服务器的 /_tmp/ 路由会从此目录伺服文件
ipcMain.handle('save-temp-doc', async (event, base64Data, fileName) => {
  // 初始化临时目录（使用系统临时目录）
  if (!tempDocDir) {
    tempDocDir = path.join(app.getPath('temp'), 'ranuts-doc-tmp')
  }
  if (!fs.existsSync(tempDocDir)) {
    fs.mkdirSync(tempDocDir, { recursive: true })
  }

  // 清理超过1小时的旧临时文件
  try {
    const files = fs.readdirSync(tempDocDir)
    const now = Date.now()
    for (const f of files) {
      const fp = path.join(tempDocDir, f)
      try {
        const stat = fs.statSync(fp)
        if (now - stat.mtimeMs > 3600000) {
          fs.unlinkSync(fp)
        }
      } catch (e) { /* 忽略单个文件清理错误 */ }
    }
  } catch (e) { /* 忽略清理错误 */ }

  // 生成安全文件名
  const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const filePath = path.join(tempDocDir, safeName)

  // 解码 base64 并写入文件
  const buffer = Buffer.from(base64Data, 'base64')
  fs.writeFileSync(filePath, buffer)

  console.log('[ranuts-document] 临时文档已保存:', filePath, '大小:', buffer.length)
  // 返回 HTTP 服务器可访问的相对路径（对应 /_tmp/ 路由）
  return '/_tmp/' + safeName
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

// 进入/退出沉浸式全屏（隐藏标题栏和菜单栏，最大化内容区域）
ipcMain.on('enter-immersive', () => {
  if (mainWindow != null) {
    mainWindow.setFullScreen(true)
  }
})

ipcMain.on('exit-immersive', () => {
  if (mainWindow != null) {
    mainWindow.setFullScreen(false)
  }
})

// 应用就绪：先启动文档服务器，再创建窗口
app.whenReady().then(() => {
  startRanutsDocServer()
  createWindow()
})

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
