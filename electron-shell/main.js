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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: 'rgba(0, 0, 0, 0)',
      symbolColor: '#334155',
      height: 36
    },
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
  // 不再使用原生菜单，改为使用自定义标题栏内的菜单
  Menu.setApplicationMenu(null)
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

// 内存缓存字典，格式 fileName_size -> safeName
const tempFileCache = new Map()

// 高效保存临时文档（接收原生 Buffer 以绕过 Base64）
ipcMain.handle('save-temp-doc-buffer', async (event, bufferData, fileName) => {
  // 初始化临时目录
  if (!tempDocDir) {
    tempDocDir = path.join(app.getPath('temp'), 'ranuts-doc-tmp')
  }
  if (!fs.existsSync(tempDocDir)) {
    fs.mkdirSync(tempDocDir, { recursive: true })
  }

  const buffer = Buffer.from(bufferData)
  const cacheKey = fileName + '_' + buffer.length
  
  // 主进程写盘去重：如果同名同大小的文件已经在临时目录，直接复用路径
  if (tempFileCache.has(cacheKey)) {
    const cachedName = tempFileCache.get(cacheKey)
    const cachedPath = path.join(tempDocDir, cachedName)
    if (fs.existsSync(cachedPath)) {
      console.log('[ranuts-document] 极速临时文档(Buffer)命中主进程缓存:', cachedPath)
      return '/_tmp/' + cachedName
    } else {
      tempFileCache.delete(cacheKey)
    }
  }

  // 简单清理旧文件（改为完全异步不阻塞主进程）
  fs.readdir(tempDocDir, (err, files) => {
    if (!err && files) {
      const now = Date.now()
      files.forEach(f => {
        const fp = path.join(tempDocDir, f)
        fs.stat(fp, (err, stat) => {
          if (!err && stat && (now - stat.mtimeMs > 3600000)) {
            fs.unlink(fp, () => {})
          }
        })
      })
    }
  })

  const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')
  const filePath = path.join(tempDocDir, safeName)

  // 改为异步非阻塞写入，防止写大文件时界面卡顿
  await fs.promises.writeFile(filePath, buffer)
  tempFileCache.set(cacheKey, safeName)

  console.log('[ranuts-document] 极速临时文档(Buffer)已异步保存:', filePath, '大小:', buffer.length)
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

// ---- 离线AI工艺助手中转服务（直接在主进程中启动） ----
let aiServer = null

function startAiService() {
  const aiServicePath = path.join(__dirname, 'ai-service', 'server.js')
  if (!fs.existsSync(aiServicePath)) {
    console.warn('[AI Service] 找不到AI中转服务文件，跳过启动:', aiServicePath)
    return
  }

  try {
    // 直接在 Electron 主进程中加载并启动 Express 服务
    // 避免 fork 子进程在 Electron 中的兼容性问题
    const express = require('express')
    const axios = require('axios')
    const cors = require('cors')

    const aiApp = express()
    aiApp.use(cors())
    aiApp.use(express.json())

    // 加载 RAG 模块
    const { classifyIntent } = require('./ai-service/rag/intent')
    const { buildBM25Index } = require('./ai-service/rag/bm25')
    const { searchKnowledge } = require('./ai-service/rag/search')
    const { SYSTEM_PROMPT, buildUserPrompt } = require('./ai-service/rag/prompt')
    const { buildChunks, buildIndex, loadIndex, indexExists, getEmbedding } = require('./ai-service/rag/vectorizer')
    const { buildGraphIndex, loadGraphIndex, buildProcessSummary } = require('./ai-service/rag/graph-builder')
    const { searchSimilar, clearCache } = require('./ai-service/rag/vector-search')

    const DEFAULT_MODEL = 'qwen2.5:3b'

    // AI 对话接口
    aiApp.post('/chat', async (req, res) => {
      try {
        const question = req.body.prompt || req.body.question
        const clientModel = req.body.model || DEFAULT_MODEL
        const history = req.body.history || []

        if (!question) {
          return res.status(400).json({ error: '提问内容(prompt/question)不能为空' })
        }

        console.log(`[AI Service] 收到提问: "${question}", 请求模型: "${clientModel}"`)

        // 设置响应头为 Chunked 传输，以便流式推送状态和回答
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 1. 意图识别 (耗时 < 1ms)
        const intent = classifyIntent(question)
        console.log(`[AI Service] 意图识别结果: ${intent}`)

        // 推送：开始检索状态
        res.write(JSON.stringify({ type: 'status', stage: 'retrieving' }) + '\n');

        let finalPrompt = '';
        let docs = [];

        if (intent === 'chitchat') {
            // 闲聊/自我认知类问题：直接进入模型对话，完全绕过本地检索和 embedding 生成，防止由于模型交替加载导致的 20-30s 卡顿
            finalPrompt = buildUserPrompt(question, [], [], null);
            // 推送：直接跳过检索状态
            res.write(JSON.stringify({ type: 'status', stage: 'retrieved', count: 0 }) + '\n');
        } else if (intent === 'overview') {
            // 概览类问题，直接注入系统摘要，跳过耗时的向量检索
            const graphIndex = loadGraphIndex();
            const summary = buildProcessSummary(graphIndex);
            finalPrompt = buildUserPrompt(question, [], [], summary);
            
            // 推送：检索完成状态
            res.write(JSON.stringify({ type: 'status', stage: 'retrieved', count: graphIndex ? graphIndex.entityCount : 0 }) + '\n');
        } else {
            // 语义/实体类问题，走混合检索
            docs = searchKnowledge(question); // 静态知识库

            const VECTOR_SEARCH_TIMEOUT = 1500 // 缩短超时到 1.5s
            let timerId = null

            const timeoutPromise = new Promise((resolve) => {
              timerId = setTimeout(() => {
                console.warn(`[AI Service] 混合检索超时（>${VECTOR_SEARCH_TIMEOUT}ms）`)
                resolve([]) 
              }, VECTOR_SEARCH_TIMEOUT)
            })

            let retrievedChunks = []
            try {
              retrievedChunks = await Promise.race([
                searchSimilar(question, 3), // 并行混合检索
                timeoutPromise
              ])
            } catch (e) {
              console.error('[AI Service] 混合检索异常:', e.message)
            } finally {
              if (timerId) clearTimeout(timerId)
            }

            finalPrompt = buildUserPrompt(question, docs, retrievedChunks, null);
            
            // 推送：检索完成状态
            res.write(JSON.stringify({ type: 'status', stage: 'retrieved', count: retrievedChunks.length }) + '\n');
        }

        console.log(`[AI Service] 正在请求 Ollama (http://localhost:11434)... (流式)`)

        // 先发送检索到的静态知识库 docs，保证前端一开始就能展示参考来源
        if (docs.length > 0) {
            res.write(JSON.stringify({ type: 'docs', docs: docs }) + '\n');
        }

        // 组装带历史记录的多轮对话请求
        const chatMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: finalPrompt }
        ];

        // 向本地 Ollama 服务发起流式对话请求
        const response = await axios.post(
          'http://localhost:11434/api/chat',
          {
            model: clientModel,
            messages: chatMessages,
            stream: true,
            keep_alive: '5m', // 缩短默认常驻时间至5分钟，依赖客户端主动释放
            options: {
              num_ctx: 2048,     // 缩小上下文窗口
              num_predict: 512,  // 限制最大输出
              // 移除 num_thread，让 Ollama 针对 Intel 异构 CPU 自动调度大小核
              temperature: 0.7   
            }
          },
          {
            responseType: 'stream',
            timeout: 300000 // 5分钟超时
          }
        )

        // 将流数据 pipe 到前端响应中
        response.data.on('data', (chunk) => {
          res.write(chunk);
        });

        response.data.on('end', () => {
          console.log(`[AI Service] Ollama 流式响应完毕。`)
          res.end();
        });

        response.data.on('error', (err) => {
          console.error(`[AI Service] Ollama 流发生异常:`, err);
          res.write(JSON.stringify({ type: 'error', error: '模型流中断: ' + err.message }) + '\n');
          res.end();
        });

      } catch (error) {
        console.error('[AI Service] 发生错误:', error.message)

        let errorMessage = '本地 AI 服务处理异常，请检查本地 Ollama 是否已启动且模型正常。'
        if (error.code === 'ECONNREFUSED') {
          errorMessage = '无法连接到 Ollama 服务，请确认已经在本地终端启动了 Ollama 服务（默认端口 11434）。'
        } else if (error.response && error.response.data) {
          errorMessage = `Ollama 服务返回错误: ${JSON.stringify(error.response.data)}`
        }

        // 如果头还没发出去，可以直接返回 HTTP 500
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: errorMessage,
            details: error.message
          })
        } else {
          // 如果流已经开始了，就在流中插入一个特殊的 error 结构
          res.write(JSON.stringify({ type: 'error', error: errorMessage }) + '\n');
          res.end();
        }
    }
    })

    // 预查询接口 (防抖触发，提前计算 Embedding 并加载上下文)
    aiApp.post('/chat-prefetch', async (req, res) => {
      try {
        const { question } = req.body
        if (!question) {
          return res.status(400).json({ error: 'Question is required' })
        }
        // 调用 searchSimilar，内部会自动走一遍检索逻辑并缓存结果
        await searchSimilar(question)
        res.json({ success: true })
      } catch (e) {
        console.error('[AI Service] Prefetch error:', e.message)
        res.status(500).json({ error: e.message })
      }
    })

    // 重建向量索引接口
    aiApp.post('/rebuild-index', async (req, res) => {
      try {
        console.log('[AI Service] 开始重建向量索引...')

        // 从渲染进程 IndexedDB 中读取工艺数据
        let processContext = null
        if (mainWindow && !mainWindow.isDestroyed()) {
          processContext = await mainWindow.webContents.executeJavaScript(`
            new Promise((resolve) => {
              const request = indexedDB.open('mpm_offline.db');
              request.onerror = () => resolve(null);
              request.onsuccess = (event) => {
                const db = event.target.result;
                const result = { processes: [], operations: [], steps: [], resources: [], processTree: [] };
                const needed = [];
                if (db.objectStoreNames.contains('t_process')) needed.push('t_process');
                if (db.objectStoreNames.contains('t_operation')) needed.push('t_operation');
                if (db.objectStoreNames.contains('t_step')) needed.push('t_step');
                if (db.objectStoreNames.contains('t_resources')) needed.push('t_resources');
                if (db.objectStoreNames.contains('meta_process_tree')) needed.push('meta_process_tree');
                if (needed.length === 0) { resolve(result); return; }
                const tx = db.transaction(needed, 'readonly');
                let pending = needed.length;
                const done = () => { if (--pending <= 0) resolve(result); };
                if (needed.includes('t_process')) {
                  const g = tx.objectStore('t_process').getAll();
                  g.onsuccess = () => { result.processes = (g.result || []).map(p => ({ inner_id: p.inner_id || p.innerId, code: p.code, name: p.name, classId_display: p.classId_display || p.class_id_display, version: p.version || p.fullversionNo || p.fullversion_no, stateName: p.stateName || p.state_name, partCode: p.partCode || p.part_code, partName: p.partName || p.part_name, departmentName: p.departmentName || p.department_name, note: p.note, routeContent: p.routeContent || p.route_content })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('t_operation')) {
                  const g = tx.objectStore('t_operation').getAll();
                  g.onsuccess = () => { result.operations = (g.result || []).map(o => ({ inner_id: o.inner_id || o.innerId, process_id: o.process_id || o.processId, name: o.name, code: o.code, serialNumber: o.serial_number || o.serialNumber, content: o.content, isKey: o.is_key || o.isKey })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('t_step')) {
                  const g = tx.objectStore('t_step').getAll();
                  g.onsuccess = () => { result.steps = (g.result || []).map(s => ({ inner_id: s.inner_id || s.innerId, name: s.name, code: s.code, serialNumber: s.serial_number || s.serialNumber, content: s.content, note: s.note, operation_id: s.operation_id || s.operationId, process_id: s.process_id || s.processId })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('t_resources')) {
                  const g = tx.objectStore('t_resources').getAll();
                  g.onsuccess = () => { result.resources = (g.result || []).map(r => ({ id: r.id, node_id: r.node_id || r.nodeId, type: r.type, name: r.name, description: r.description })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('meta_process_tree')) {
                  const g = tx.objectStore('meta_process_tree').getAll();
                  g.onsuccess = () => { result.processTree = g.result || []; done(); };
                  g.onerror = done;
                }
              };
            })
          `)
        }

        if (!processContext) {
          return res.json({ success: false, error: '无法从 IndexedDB 读取工艺数据' })
        }

        // 切片
        const chunks = buildChunks(processContext)
        console.log(`[AI Service] 数据切片完成: ${chunks.length} 个 chunk`)

        if (chunks.length === 0) {
          return res.json({ success: false, error: '没有可索引的工艺数据，请先导入 SRD 数据包' })
        }

        // 向量化并建立索引
        const indexData = await buildIndex(chunks, (current, total) => {
          console.log(`[AI Service] 向量化进度: ${current}/${total}`)
        })

        // 构建图谱索引
        let graphIndexData = null
        try {
          graphIndexData = buildGraphIndex(processContext)
        } catch(e) {
          console.error('[AI Service] 构建图谱索引失败:', e)
        }

        // 构建 BM25 索引
        try {
          buildBM25Index(chunks)
        } catch(e) {
          console.error('[AI Service] 构建 BM25 索引失败:', e)
        }

        // 清除检索缓存，使新索引立即生效
        clearCache()

        res.json({
          success: true,
          message: `向量与图谱索引构建完成`,
          chunkCount: indexData.chunks.length,
          entityCount: graphIndexData ? graphIndexData.entityCount : 0
        })
      } catch (error) {
        console.error('[AI Service] 重建索引失败:', error)
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // 预热模型接口 (客户端打开抽屉时触发)
    aiApp.post('/prewarm-models', async (req, res) => {
      try {
        console.log('[AI Service] 收到客户端预热请求，开始拉起模型...')
        // 预热对话模型
        axios.post('http://localhost:11434/api/generate', {
          model: 'qwen2.5:3b',
          prompt: '',
          keep_alive: '5m',
          options: { num_predict: 1 }
        }).catch(() => {})
        
        // 预热 Embedding 模型
        axios.post('http://localhost:11434/api/embeddings', {
          model: 'nomic-embed-text',
          prompt: 'prewarm',
          keep_alive: '5m'
        }).catch(() => {})
        
        res.json({ success: true, message: '模型预热指令已发送' })
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // 释放模型接口 (客户端关闭抽屉时触发)
    aiApp.post('/unload-models', async (req, res) => {
      try {
        console.log('[AI Service] 收到客户端释放内存请求，正在卸载模型...')
        // 卸载对话模型
        await axios.post('http://localhost:11434/api/generate', {
          model: 'qwen2.5:3b',
          prompt: '',
          keep_alive: 0
        }).catch(() => {})
        
        // 卸载 Embedding 模型
        await axios.post('http://localhost:11434/api/embeddings', {
          model: 'nomic-embed-text',
          prompt: 'unload',
          keep_alive: 0
        }).catch(() => {})
        
        res.json({ success: true, message: '模型已成功从内存卸载' })
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // 状态检查接口
    aiApp.get('/status', async (req, res) => {
      const hasIndex = indexExists()
      try {
        await axios.get('http://localhost:11434/')
        res.json({
          status: 'running',
          ollama: 'connected',
          indexReady: hasIndex,
          message: '本地 AI 中转服务及 Ollama 服务均运行正常'
        })
      } catch (error) {
        res.json({
          status: 'running',
          ollama: 'disconnected',
          message: '本地 AI 中转服务运行正常，但无法连接到本地 Ollama 服务，请确认其是否启动。'
        })
      }
    })

    const PORT = 3001
    aiServer = aiApp.listen(PORT, () => {
      console.log(`[AI Service] 离线AI工艺助手中转服务启动成功，监听端口: ${PORT}`)
    })

    aiServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[AI Service] 端口 ${PORT} 已被占用，AI 中转服务跳过启动。`)
      } else {
        console.error('[AI Service] 启动失败:', err)
      }
    })

    // 模型检测：在服务启动后，先检测并尝试拉起 Ollama，不再执行启动预热以节省资源
    aiServer.on('listening', async () => {
      const started = await ensureOllamaService(axios)
      if (started) {
        console.log('[AI Service] Ollama 守护进程已就绪。为保证启动性能和降低内存占用，取消全局模型预热。')
        // warmupModels(axios) // 取消全局启动预热
      } else {
        console.warn('[AI Service] 无法自动拉起 Ollama 服务，请手动开启。')
      }
    })
  } catch (error) {
    console.error('[AI Service] 加载AI服务模块失败:', error)
  }
}

/**
 * 确保 Ollama 服务处于运行状态，如果没有运行，尝试自动拉起进程
 */
async function ensureOllamaService(axios) {
  try {
    // 检查 Ollama 服务是否已经在线
    await axios.get('http://localhost:11434/', { timeout: 1500 })
    console.log('[AI Service] 检测到 Ollama 服务已在运行。')
    return true
  } catch (error) {
    console.log('[AI Service] 未检测到运行中的 Ollama 服务，尝试自动启动...')
    
    try {
      const { spawn } = require('child_process')
      const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local')
      const ollamaPath = path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe')
      
      let spawnedProcess = null
      
      if (fs.existsSync(ollamaPath)) {
        console.log(`[AI Service] 找到 Ollama 可执行文件，正在静默拉起: ${ollamaPath}`)
        spawnedProcess = spawn(ollamaPath, ['serve'], {
          detached: true,
          stdio: 'ignore'
        })
      } else {
        console.log('[AI Service] 未在用户目录下找到 Ollama 安装文件，尝试通过全局环境变量启动...')
        spawnedProcess = spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore'
        })
      }
      
      if (spawnedProcess) {
        // 解除与 Electron 主进程的关联，让其独立在后台长驻运行
        spawnedProcess.unref()
        
        // 轮询等待 Ollama 接口就绪（最多等15秒）
        console.log('[AI Service] 正在等待 Ollama 服务就绪 (最多等待 15s)...')
        for (let i = 1; i <= 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          try {
            await axios.get('http://localhost:11434/', { timeout: 1000 })
            console.log('[AI Service] Ollama 服务已成功拉起并准备就绪！✓')
            return true
          } catch (e) {
            // 继续等待
          }
        }
        console.warn('[AI Service] Ollama 启动指令已发送，但 15 秒内未检测到服务就绪。')
      }
    } catch (launchError) {
      console.error('[AI Service] 自动拉起 Ollama 失败:', launchError.message)
    }
    return false
  }
}

/**
 * 预热模型 - 向 Ollama 发送预加载请求，让模型提前驻留内存
 * 注意：两种模型必须用各自正确的 API 端点预热，否则无效
 * - 对话模型 → /api/generate (prompt为空, num_predict:0)
 * - Embedding模型 → /api/embeddings
 */
async function warmupModels(axios) {
  console.log('[AI Service] 开始预热模型，提升首次响应速度...')

  // 预热对话模型（qwen2.5:3b）
  try {
    console.log('[AI Service] 正在预热对话模型: qwen2.5:3b...')
    await axios.post('http://localhost:11434/api/generate', {
      model: 'qwen2.5:3b',
      prompt: '你好',
      keep_alive: 0,   // 仅检测，不常驻内存
      options: {
        num_predict: 1,    // 只生成1个token，尽快结束预热
        num_thread: 16
      }
    }, { timeout: 60000 })
    console.log('[AI Service] 对话模型 qwen2.5:3b 预热完成 ✓')
  } catch (e) {
    console.warn('[AI Service] 对话模型预热失败:', e.message)
  }

  // 预热 Embedding 模型（nomic-embed-text）
  try {
    console.log('[AI Service] 正在预热 Embedding 模型: nomic-embed-text...')
    await axios.post('http://localhost:11434/api/embeddings', {
      model: 'nomic-embed-text',
      prompt: '预热',
      keep_alive: 0   // 仅检测，不常驻内存
    }, { timeout: 60000 })
    console.log('[AI Service] Embedding 模型 nomic-embed-text 预热完成 ✓')
  } catch (e) {
    console.warn('[AI Service] Embedding 模型预热失败（可能未安装）:', e.message)
  }

  console.log('[AI Service] 所有模型预热完毕 ✓ 首次提问将快速响应')
}

function stopAiService() {
  if (aiServer) {
    console.log('[AI Service] 正在停止AI服务...')
    aiServer.close()
    aiServer = null
  }
}

// 应用就绪：先启动文档服务器，再创建窗口
app.whenReady().then(() => {
  startRanutsDocServer()
  
  // 延迟启动 AI 中转服务，优先保障前端页面及基础文档服务的 CPU 资源和加载速度
  setTimeout(() => {
    console.log('[App] 延迟启动 AI 服务...')
    startAiService() 
  }, 3000)

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
  stopAiService() // 关闭 AI 服务
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  stopAiService() // 确保退出时关闭服务
})

