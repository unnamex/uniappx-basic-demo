const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')


let mainWindow = null
let ranutsDocPort = 0 // ranuts-document 内嵌 HTTP 服务器端口
let tempDocDir = ''   // 临时文档存储目录（系统临时目录，非 asar 内部）

let DEFAULT_MODEL = 'qwen2.5:7b'
try {
  const mg = require('./ai-service/rag/memory-guard')
  if (mg && mg.getPackagedModel) {
    DEFAULT_MODEL = mg.getPackagedModel().modelName || 'qwen2.5:7b'
  }
} catch(e) {}

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
    title: 'CraftX',
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
    // 安全配置预留
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
let ollamaProcess = null

function startAiService() {
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
    const { 
      getSystemPrompt, 
      buildUserPrompt, 
      buildNodeAnalysisPrompt, 
      buildQualityCheckPrompt,
      buildHyDEPrompt
    } = require('./ai-service/rag/prompt')
    const { getModelProfile } = require('./ai-service/rag/model-profiles')
    const { buildChunks, buildIndex, indexExists } = require('./ai-service/rag/vectorizer')
    const { buildGraphIndex, loadGraphIndex, buildProcessSummary } = require('./ai-service/rag/graph-builder')
    const { getSystemMemoryInfo, getMemoryPressureLevel, getPackagedModel } = require('./ai-service/rag/memory-guard')
    const { searchSimilar, clearCache } = require('./ai-service/rag/vector-search')

    function getOllamaErrorMessage(error) {
      if (error.code === 'ECONNREFUSED') {
        return '无法连接到本地大模型服务，请确认 Ollama 已启动。';
      }
      if (error.response && error.response.data) {
        const data = error.response.data;
        
        // 如果 data 是流 (Stream)，直接返回状态码错误，避免 JSON.stringify 导致循环引用崩溃
        if (data && typeof data.pipe === 'function') {
          return `模型加载失败或内存不足，引擎退出 (HTTP ${error.response.status})。请关闭其他占用内存的程序后重试。`;
        }

        let details = '';
        try {
          details = typeof data === 'object' ? (data.error || JSON.stringify(data)) : String(data);
        } catch (e) {
          details = '未知格式错误';
        }
        
        if (typeof details === 'string') {
          if (details.includes('unable to allocate CPU buffer') || details.includes('exit status 2') || details.includes('GGML_ASSERT')) {
            return '您的电脑内存不足以运行当前模型。请关闭其他程序释放内存后重试，或联系管理员获取更小体积的安装包。';
          }
          if (details.includes('not found')) {
            return '未找到该模型，请确认是否已正确下载安装。';
          }
        }
        return `模型引擎返回错误: ${details}`;
      }
      return error.message;
    }

    // AI 对话接口
    aiApp.post('/chat', async (req, res) => {
      try {
        // 核心修改：分离真实的提问与背景上下文
        const question = req.body.prompt || req.body.question
        const explicitContext = req.body.context || ''
        const clientModel = req.body.model || DEFAULT_MODEL
        const history = req.body.history || []

        if (!question) {
          return res.status(400).json({ error: '提问内容(prompt/question)不能为空' })
        }

        console.log(`[AI Service] 收到提问: "${question}", 请求模型: "${clientModel}"`)

        // 强行打断后台预热释放算力
        if (currentPrefetchAbortController) {
           console.log(`[AI Service] 🚨 检测到前台聊天高优请求，紧急打断后台预热任务释放算力！`)
           currentPrefetchAbortController.abort()
           currentPrefetchAbortController = null
        }

        // 设置响应头为 Chunked 传输，以便流式推送状态和回答
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 1. 意图识别 (耗时 < 1ms)
        const profile = getModelProfile(clientModel);
        const intent = classifyIntent(question, profile)
        console.log(`[AI Service] 意图识别结果: ${intent}`)

        // 推送：开始检索状态
        res.write(JSON.stringify({ type: 'status', stage: 'retrieving' }) + '\n');

        let finalPrompt = '';
        let docs = [];

        if (intent === 'chitchat') {
            // 闲聊/自我认知类问题：不再浪费算力请求大模型，直接毫秒级硬拦截
            const chitchatReply = "你好！我是你的专属工艺辅助系统。请问有关于当前工艺步骤、设备操作或者质检方面的疑问吗？"
            res.write(JSON.stringify({ type: 'status', stage: 'retrieved', count: 0 }) + '\n');
            res.write(JSON.stringify({ response: chitchatReply, done: true }) + '\n');
            res.end();
            processPrefetchQueue();
            return;
        } else if (intent === 'overview') {
            // 概览类问题，直接注入系统摘要，跳过耗时的向量检索
            const graphIndex = loadGraphIndex();
            const summary = buildProcessSummary(graphIndex);
            finalPrompt = buildUserPrompt(question, [], [], summary, profile);
            
            // 推送：检索完成状态
            res.write(JSON.stringify({ type: 'status', stage: 'retrieved', count: graphIndex ? graphIndex.entityCount : 0 }) + '\n');
        } else {
            // 语义/实体类问题，走混合检索
            
            // 智能指代消解：如果当前有明确的讨论节点（上下文），提取出来为主语补全代词问题
            // 例如把 "这个需要注意什么" 补全为 "V8发动机组装工艺 的 这个需要注意什么"
            let topic = '';
            const nodeMatch = explicitContext.match(/工艺节点\[(.*?)\]/);
            const processMatch = explicitContext.match(/全局工艺背景是：(.*?)$/m);
            if (nodeMatch) topic = nodeMatch[1];
            else if (processMatch) topic = processMatch[1];
            
            const enhancedQuestion = topic ? `${topic}的${question}` : question;
            console.log(`[AI Service] 检索词增强: ${enhancedQuestion}`);

            docs = searchKnowledge(enhancedQuestion); // 静态知识库

            let searchKeyword = enhancedQuestion;
            try {
              // HyDE: 生成假设工艺文档
              const hydePrompt = buildHyDEPrompt(enhancedQuestion, profile);
              const hydeRes = await axios.post(
                'http://127.0.0.1:11435/api/generate',
                {
                  model: clientModel,
                  prompt: hydePrompt,
                  stream: false,
                  options: profile.hyde
                },
                { timeout: profile.rag.hydeTimeout } // 动态超时，避免阻塞太久
              )
              if (hydeRes.data && hydeRes.data.response) {
                searchKeyword = hydeRes.data.response;
                console.log(`[HyDE] 生成假设文档完成`)
              }
            } catch (e) {
              console.warn('[HyDE] 极速生成失败，降级使用原问题:', e.message)
            }

            const VECTOR_SEARCH_TIMEOUT = profile.rag.vectorTimeout // 动态超时
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
                searchSimilar(searchKeyword, profile.rag.topK, profile.rag.contextTruncate, profile), // 动态 TopK 和截断
                timeoutPromise
              ])
            } catch (e) {
              console.error('[AI Service] 混合检索异常:', e.message)
            } finally {
              if (timerId) clearTimeout(timerId)
            }

            // 推送：检索完成状态
            res.write(JSON.stringify({ type: 'status', stage: 'retrieved', count: retrievedChunks.length }) + '\n');

            // 核心安全防线：如果用户问了与工业毫无关系的问题（如“鲁迅是谁”），向量检索相似度必定低于阈值导致召回数为0。
            // 此时直接硬拦截，不让大模型自行发挥幻觉知识，同时节省大量的思考和生成时间！
            if (retrievedChunks.length === 0 && docs.length === 0) {
                const outOfScopeReply = "抱歉，这个问题超出了当前工艺的范畴。为了确保车间生产安全，咱们还是聊聊具体的工艺步骤、设备参数或者质检问题吧。"
                res.write(JSON.stringify({ response: outOfScopeReply, done: true }) + '\n');
                res.end();
                processPrefetchQueue();
                return;
            }
            
            // 组装最终 prompt 时，把前端传递的前置语境 explicitContext 拼进去，保证大模型能够承接上下文
            let mergedContext = explicitContext
            if (retrievedChunks && retrievedChunks.length > 0) {
                const docText = retrievedChunks.map((c, i) => `[参考文档${i+1}]\n${c.text}`).join('\n\n')
                mergedContext += `\n\n=== 检索到的系统受控资料 ===\n${docText}\n`
            }
            if (docs && docs.length > 0) {
                const staticDocs = docs.map((d, i) => `[静态规则${i+1}]\n${d.content || d.context}`).join('\n\n')
                mergedContext += `\n\n=== 静态规则库 ===\n${staticDocs}\n`
            }

            finalPrompt = buildUserPrompt(question, [], [], mergedContext, profile);
        }

        console.log(`[AI Service] 正在请求 Ollama (http://localhost:11435)... (流式)`)

        // 先发送检索到的静态知识库 docs，保证前端一开始就能展示参考来源
        if (docs.length > 0) {
            res.write(JSON.stringify({ type: 'docs', docs: docs }) + '\n');
        }

        // 组装带历史记录的多轮对话请求
        const chatMessages = [
          { role: 'system', content: getSystemPrompt(profile.tier) },
          ...history,
          { role: 'user', content: finalPrompt }
        ];

        // 向本地 Ollama 服务发起流式对话请求
        const response = await axios.post(
          'http://127.0.0.1:11435/api/chat',
          {
            model: clientModel,
            messages: chatMessages,
            stream: true,
            keep_alive: '30m', // 对话模型常驻内存30分钟，减少冷启动频率
            options: profile.chat
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
          // 前台高优请求（chat）已完成，恢复后台的空闲预热
          processPrefetchQueue();
        });

        response.data.on('error', (err) => {
          console.error(`[AI Service] Ollama 流发生异常:`, err);
          res.write(JSON.stringify({ type: 'error', error: '模型流中断: ' + err.message }) + '\n');
          res.end();
          // 哪怕失败也尝试恢复预热
          processPrefetchQueue();
        });

      } catch (error) {
        console.error('[AI Service] 发生错误:', error.message)

        let errorMessage = getOllamaErrorMessage(error);
        const isOOM = errorMessage.includes('内存不足');

        // 如果头还没发出去，可以直接返回 HTTP 500 或 fallback JSON
        if (!res.headersSent) {
          if (isOOM) {
             return res.status(500).json({ success: false, error: '当前模型需要更多内存，请关闭其他程序后重试。' })
          }
          res.status(500).json({
            success: false,
            error: errorMessage,
            details: error.message
          })
        } else {
          if (isOOM) {
             res.write(JSON.stringify({ type: 'error', error: '当前模型需要更多内存，请关闭其他程序后重试。' }) + '\n');
          } else {
             // 如果流已经开始了，就在流中插入一个特殊的 error 结构
             res.write(JSON.stringify({ type: 'error', error: errorMessage }) + '\n');
          }
          res.end();
        }
    }
    })

    // 节点分析缓存
    const analysisCache = new Map()

    // 预热队列与打断机制
    const prefetchTaskQueue = []
    let currentPrefetchAbortController = null
    let isPrefetching = false
    let prefetchQueueVersion = 0

    async function processPrefetchQueue() {
      if (isPrefetching || prefetchTaskQueue.length === 0) return
      isPrefetching = true
      while (prefetchTaskQueue.length > 0) {
        const task = prefetchTaskQueue.shift()
        const cacheKey = `${task.model || DEFAULT_MODEL}:${task.nodeType}:${task.nodeName}`
        if (analysisCache.has(cacheKey)) continue

        currentPrefetchAbortController = new AbortController()
        try {
          const profile = getModelProfile(task.model || DEFAULT_MODEL)
          const docs = searchKnowledge(task.nodeName)
          const searchKeyword = task.nodeName
          let retrievedChunks = [];
          try {
            retrievedChunks = await Promise.race([
              searchSimilar(searchKeyword, profile.rag.topK, profile.rag.contextTruncate, profile),
              new Promise((resolve) => setTimeout(() => resolve([]), profile.rag.vectorTimeout))
            ]);
          } catch (e) {}

          const prompt = buildNodeAnalysisPrompt(task.nodeName, task.nodeType, task.processName, docs, retrievedChunks, profile)
          const chatMessages = [{ role: 'user', content: prompt }]

          const response = await axios.post(
            'http://127.0.0.1:11435/api/chat',
            {
              model: task.model || DEFAULT_MODEL,
              messages: chatMessages,
              stream: false,
              keep_alive: '30m',
              format: 'json',
              options: profile.analysis
            },
            { 
              timeout: 300000,
              signal: currentPrefetchAbortController.signal
            }
          )

          const aiResponse = response.data.message?.content || ''
          if (aiResponse) {
             let parsed = null;
             try { parsed = JSON.parse(aiResponse); } catch(e){}
             if (parsed) {
                 if (analysisCache.size >= 50) analysisCache.delete(analysisCache.keys().next().value)
                 analysisCache.set(cacheKey, parsed)
                 console.log(`[AI Service] 预热缓存完成: ${cacheKey}`)
             }
          }
        } catch (e) {
           if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') {
              console.log(`[AI Service] 预热被强行中止 (算力让给前台): ${cacheKey}`)
              // 将中断的任务重新塞回队首，但前提是该任务所在的队列批次没有被抛弃（例如用户未切换节点）
              if (task.version === prefetchQueueVersion) {
                  prefetchTaskQueue.unshift(task)
              } else {
                  console.log(`[AI Service] 抛弃过期的预热任务: ${cacheKey}`)
              }
              // 关键：发生中止时必须跳出 while 循环暂停整个预热进程，否则会陷入无限重启并和前台抢夺算力
              break
           } else {
              console.error(`[AI Service] 预热失败 ${cacheKey}:`, e.message)
           }
        } finally {
          currentPrefetchAbortController = null
        }
      }
      isPrefetching = false
    }

    aiApp.post('/analyze-node', async (req, res) => {
      try {
        if (currentPrefetchAbortController) {
           console.log(`[AI Service] 🚨 检测到前台高优请求，紧急打断后台预热任务释放算力！`)
           currentPrefetchAbortController.abort()
           currentPrefetchAbortController = null
        }

        const { nodeName, nodeType, processName, model, force } = req.body
        const clientModel = model || DEFAULT_MODEL
        const cacheKey = `${clientModel}:${nodeType}:${nodeName}`

        if (force === true) {
          analysisCache.delete(cacheKey)
          console.log(`[AI Service] 强制刷新，已清除缓存: ${cacheKey}`)
        } else if (analysisCache.has(cacheKey)) {
          console.log(`[AI Service] 命中节点分析缓存: ${cacheKey}`)
          res.setHeader('Content-Type', 'application/json');
          res.write(JSON.stringify({ success: true, data: analysisCache.get(cacheKey) }) + '\n');
          res.end();
          return;
        }

        const profile = getModelProfile(clientModel);

        const searchKeyword = nodeName;
        const docs = searchKnowledge(searchKeyword);
        const VECTOR_SEARCH_TIMEOUT = profile.rag.vectorTimeout;
        let timerId = null;
        const timeoutPromise = new Promise((resolve) => {
          timerId = setTimeout(() => {
            console.warn(`[AI Service] 节点混合检索超时（>${VECTOR_SEARCH_TIMEOUT}ms）`);
            resolve([]);
          }, VECTOR_SEARCH_TIMEOUT);
        });

        let retrievedChunks = [];
        try {
          retrievedChunks = await Promise.race([
            searchSimilar(searchKeyword, profile.rag.topK, profile.rag.contextTruncate, profile),
            timeoutPromise
          ]);
        } catch (e) {
          console.error('[AI Service] 节点分析检索异常:', e.message);
        } finally {
          if (timerId) clearTimeout(timerId);
        }

        const prompt = buildNodeAnalysisPrompt(nodeName, nodeType, processName, docs, retrievedChunks, profile)

        // 开启 SSE 流式输出
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        // 节点分析拥有自己独立的短小系统提示词（包含在 prompt 中），不需要庞大且无关的全局 SYSTEM_PROMPT
        const chatMessages = [
          { role: 'user', content: prompt }
        ];

        const response = await axios.post(
          'http://127.0.0.1:11435/api/chat',
          {
            model: clientModel,
            messages: chatMessages,
            stream: true,
            keep_alive: '30m',
            format: 'json',
            options: profile.analysis
          },
          {
            responseType: 'stream',
            timeout: 300000 // 允许最长 5 分钟的流式生成，防止 CPU 慢导致被强杀
          }
        )

        let fullText = '';
        response.data.on('data', (chunk) => {
          // 尝试解析 JSON chunk 缓存完整结果
          try {
             const str = chunk.toString();
             const lines = str.split('\n');
             for (const line of lines) {
                if(line.trim()) {
                   const obj = JSON.parse(line);
                   let token = ''
                   if (obj.response) token = obj.response;
                   else if (obj.message && obj.message.content) token = obj.message.content;
                   
                   if (token) {
                      fullText += token;
                      res.write(JSON.stringify({ type: 'token', response: token }) + '\n');
                      
                      // 智能流式 JSON 残缺修复算法（状态机自动补全机制）
                      let partial = null;
                      try {
                        let jsonStr = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
                        let startIdx = jsonStr.indexOf('{');
                        if (startIdx >= 0) {
                          jsonStr = jsonStr.substring(startIdx);
                          let result = '';
                          let inString = false;
                          let escapeNext = false;
                          let stack = [];
                          for (let i = 0; i < jsonStr.length; i++) {
                            let char = jsonStr[i];
                            if (inString) {
                              if (escapeNext) { escapeNext = false; result += char; }
                              else if (char === '\\') { escapeNext = true; result += char; }
                              else if (char === '"') { inString = false; result += char; }
                              else if (char === '\n') { result += '\\n'; }
                              else if (char === '\r') { }
                              else { result += char; }
                            } else {
                              if (char === '"') { inString = true; result += char; }
                              else if (char === '{') { stack.push('}'); result += char; }
                              else if (char === '[') { stack.push(']'); result += char; }
                              else if (char === '}' || char === ']') {
                                if (stack.length > 0 && stack[stack.length - 1] === char) { stack.pop(); result += char; }
                              } else { result += char; }
                            }
                          }
                          if (inString) result += '"';
                          let trimmed = result.trimEnd();
                          if (trimmed.endsWith(',')) trimmed = trimmed.substring(0, trimmed.length - 1);
                          result = trimmed;
                          while (stack.length > 0) {
                            let expected = stack.pop();
                            let t = result.trimEnd();
                            if (t.endsWith(',')) result = t.substring(0, t.length - 1);
                            result += expected;
                          }
                          partial = JSON.parse(result);
                        }
                      } catch(e) {}

                      // 如果修复成功，组装成安全的完整结构下发给严谨的强类型前端
                      if (partial && typeof partial === 'object') {
                         const safeData = {
                           summary: partial.summary || '',
                           keyPoints: Array.isArray(partial.keyPoints) ? partial.keyPoints : [],
                           risks: Array.isArray(partial.risks) ? partial.risks : [],
                           params: Array.isArray(partial.params) ? partial.params : [],
                           checklist: Array.isArray(partial.checklist) ? partial.checklist : [],
                           faq: Array.isArray(partial.faq) ? partial.faq : [],
                           suggestions: Array.isArray(partial.suggestions) ? partial.suggestions : []
                         };
                         res.write(JSON.stringify({ type: 'partial_data', data: safeData }) + '\n');
                      }
                   }
                }
             }
          } catch(e){}
        })

        response.data.on('end', () => {
          // 流结束：先尝试解析完整 JSON，推送最终 partial_data 给前端后再 end
          // 这样前端在 onChunkReceived 中就能设置 analysisData，卡片立刻出现，无需等 success 回调
          let cacheValue = null;
          try {
            let cleaned = fullText.replace(/^```(?:json)?\s*/g, '').replace(/\s*```$/g, '');
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
            }
            cacheValue = JSON.parse(cleaned);

            // 执行后置正则拦截校验（防止严重的安全数值幻觉）
            const numRegex = /\d+(?:\.\d+)?\s*(?:℃|mm\/min|rpm|MPa|kg|mm|s|min|h)/gi;
            let hasHallucination = false;
            let hallucinatedValues = [];
            
            // 把原始文档拼起来用于比对
            const fullSourceText = (docs.map(d=>d.content).join('\n') + '\n' + retrievedChunks.map(c=>c.text).join('\n')).toLowerCase();
            
            // 检查 params 中的数值
            if (cacheValue.params && Array.isArray(cacheValue.params)) {
               cacheValue.params.forEach(p => {
                  const txt = (p.recommend + ' ' + p.range).toLowerCase();
                  const matches = txt.match(numRegex);
                  if (matches) {
                     matches.forEach(m => {
                        const numStr = m.match(/\d+(?:\.\d+)?/)[0]; // 仅取数字部分检查
                        if (!fullSourceText.includes(numStr)) {
                           hasHallucination = true;
                           hallucinatedValues.push(m);
                           p.recommend += ' ⚠️数值存疑';
                        }
                     })
                  }
               })
            }
            if (hasHallucination) {
               console.warn(`[AI Service] 🚨 安全预警：拦截到疑似捏造参数: ${hallucinatedValues.join(', ')}`);
               if (!Array.isArray(cacheValue.risks)) cacheValue.risks = [];
               cacheValue.risks.unshift({ level: 'high', desc: `系统安全警告：AI 给出的数值 [${hallucinatedValues.join(', ')}] 在工艺规程原文档中不存在，存在极高安全风险，请以技术员和原始文档为准！` });
            }

            // 推送最终完整 partial_data，让前端立即渲染卡片
            const finalSafeData = {
              summary: cacheValue.summary || '',
              keyPoints: Array.isArray(cacheValue.keyPoints) ? cacheValue.keyPoints : [],
              risks: Array.isArray(cacheValue.risks) ? cacheValue.risks : [],
              params: Array.isArray(cacheValue.params) ? cacheValue.params : [],
              checklist: Array.isArray(cacheValue.checklist) ? cacheValue.checklist : [],
              faq: Array.isArray(cacheValue.faq) ? cacheValue.faq : [],
              suggestions: Array.isArray(cacheValue.suggestions) ? cacheValue.suggestions : []
            };
            res.write(JSON.stringify({ type: 'partial_data', data: finalSafeData }) + '\n');
            console.log(`[AI Service] 推送最终 partial_data 完成: ${cacheKey}`);
          } catch(e) {
            console.warn('[AI Service] /analyze-node 最终 JSON 解析失败:', e.message);
          }
          res.end();

          // 缓存解析后的 JSON 对象，供下次秒回（必须缓存对象而非字符串，否则前端会显示原始 JSON 文本）
          if (cacheValue != null) {
            if (analysisCache.size >= 50) {
              const firstKey = analysisCache.keys().next().value
              analysisCache.delete(firstKey)
            }
            analysisCache.set(cacheKey, cacheValue);
            console.log(`[AI Service] 节点分析结果已缓存(JSON对象): ${cacheKey}`);
          }

          // 前台高优请求（analyze-node）已完成，恢复后台的空闲预热
          processPrefetchQueue();
        })

        response.data.on('error', (err) => {
          console.error('[AI Service] /analyze-node 流读取异常:', err.message)
          res.end();
          // 哪怕失败也尝试恢复预热
          processPrefetchQueue();
        })
      } catch (error) {
        const errorMessage = getOllamaErrorMessage(error);
        console.error('[AI Service] /analyze-node 错误:', error.message, '详情:', errorMessage)
        const isOOM = errorMessage.includes('内存不足');
        const clientModel = (req.body && req.body.model) ? req.body.model : DEFAULT_MODEL;
        
        if (isOOM) {
            res.status(500).json({ success: false, error: '当前模型需要更多内存，请关闭其他程序后重试。' })
        } else {
            res.status(500).json({ success: false, error: errorMessage })
        }
      }
    })

    aiApp.post('/prefetch-pipeline', async (req, res) => {
      try {
        const { nodes, processName, model } = req.body
        const clientModel = model || DEFAULT_MODEL
        if (!Array.isArray(nodes)) return res.json({ success: false })

        // 立即响应前端，不阻塞用户操作
        res.json({ success: true, message: 'pipeline added to queue' })

        // 覆盖现有队列，防止用户来回切换不同工艺节点积累陈旧无用的请求
        prefetchQueueVersion++
        prefetchTaskQueue.length = 0

        nodes.forEach(n => {
           prefetchTaskQueue.push({
             nodeName: n.name,
             nodeType: n.type,
             processName,
             model: clientModel,
             version: prefetchQueueVersion
           })
        })
        processPrefetchQueue()
      } catch (error) {
        console.error('[AI Service] /prefetch-pipeline 错误:', error.message)
        if (!res.headersSent) {
          const errorMessage = getOllamaErrorMessage(error);
          res.status(500).json({ success: false, error: errorMessage })
        }
      }
    })

    aiApp.post('/check-quality', async (req, res) => {
      try {
        const { symptom, nodeName, nodeType, model } = req.body
        const clientModel = model || DEFAULT_MODEL
        const profile = getModelProfile(clientModel);
        const prompt = buildQualityCheckPrompt(symptom, nodeName, nodeType, profile)

        // 强行打断后台预热释放算力
        if (currentPrefetchAbortController) {
           console.log(`[AI Service] 🚨 检测到前台质检高优请求，紧急打断后台预热任务释放算力！`)
           currentPrefetchAbortController.abort()
           currentPrefetchAbortController = null
        }

        const response = await axios.post(
          'http://127.0.0.1:11435/api/generate',
          {
            model: clientModel,
            prompt: prompt,
            stream: false,
            format: 'json',
            options: profile.quality
          },
          { timeout: 60000 }
        )

        const aiResponse = response.data.response
        let parsedJSON = null
        try {
          let jsonStr = aiResponse
          const match = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (match) {
            jsonStr = match[1]
          }
          parsedJSON = JSON.parse(jsonStr)
          res.json({ success: true, data: parsedJSON })
        } catch (e) {
          res.json({ success: true, rawText: aiResponse, data: null })
        }
        
        // 恢复空闲预热
        processPrefetchQueue()
      } catch (error) {
        console.error('[AI Service] /check-quality 错误:', error.message)
        const errorMessage = getOllamaErrorMessage(error);
        const isOOM = errorMessage.includes('内存不足');
        
        if (isOOM) {
            res.status(500).json({ success: false, error: '当前模型需要更多内存，请关闭其他程序后重试。' })
        } else {
            res.status(500).json({ success: false, error: errorMessage })
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
                if (db.objectStoreNames.contains('t_action')) needed.push('t_action');
                if (db.objectStoreNames.contains('t_resources')) needed.push('t_resources');
                if (db.objectStoreNames.contains('meta_process_tree')) needed.push('meta_process_tree');
                if (needed.length === 0) { resolve(result); return; }
                const tx = db.transaction(needed, 'readonly');
                let pending = needed.length;
                const done = () => { if (--pending <= 0) resolve(result); };
                if (needed.includes('t_process')) {
                  const g = tx.objectStore('t_process').getAll();
                  g.onsuccess = () => { result.processes = (g.result || []).map(p => ({ inner_id: p.inner_id || p.innerId, code: p.code, name: p.name, classId_display: p.classId_display || p.class_id_display, version: p.version || p.fullversionNo || p.fullversion_no, stateName: p.stateName || p.state_name, partCode: p.partCode || p.part_code, partName: p.partName || p.part_name, departmentName: p.departmentName || p.department_name, note: p.note, routeContent: p.routeContent || p.route_content, creator: p.createById_display || p.create_by_id_display, createTime: p.createTime || p.create_time, modifier: p.modifyById_display || p.modify_by_id_display, modifyTime: p.modifyTime || p.modify_time })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('t_operation')) {
                  const g = tx.objectStore('t_operation').getAll();
                  g.onsuccess = () => { result.operations = (g.result || []).map(o => ({ inner_id: o.inner_id || o.innerId, process_id: o.process_id || o.processId, name: o.name, code: o.code, serialNumber: o.serial_number || o.serialNumber, content: o.content, isKey: o.is_key || o.isKey, creator: o.creator, createTime: o.createTime || o.create_time, modifier: o.modifier, modifyTime: o.modifyTime || o.modify_time })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('t_step')) {
                  const g = tx.objectStore('t_step').getAll();
                  g.onsuccess = () => { result.steps = (g.result || []).map(s => ({ inner_id: s.inner_id || s.innerId, name: s.name, code: s.code, serialNumber: s.serial_number || s.serialNumber, content: s.content, note: s.note, operation_id: s.operation_id || s.operationId, process_id: s.process_id || s.processId, creator: s.creator, createTime: s.createTime || s.create_time, modifier: s.modifier, modifyTime: s.modifyTime || s.modify_time })); done(); };
                  g.onerror = done;
                }
                if (needed.includes('t_action')) {
                  const g = tx.objectStore('t_action').getAll();
                  g.onsuccess = () => { result.actions = (g.result || []).map(a => ({ inner_id: a.inner_id || a.innerId, name: a.name, code: a.code, serialNumber: a.serial_number || a.serialNumber, content: a.content, note: a.note, step_id: a.step_id || a.stepId, operation_id: a.operation_id || a.operationId, process_id: a.process_id || a.processId, creator: a.creator, createTime: a.createTime || a.create_time, modifier: a.modifier, modifyTime: a.modifyTime || a.modify_time })); done(); };
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
        let clientModel = req.body.model || DEFAULT_MODEL;
        
        // 移除多模型降级逻辑，直接使用打包模型
        const memInfo = getSystemMemoryInfo();
        if (memInfo.freeMB < 2000) {
            console.warn(`[AI Service] 内存紧张(可用 ${memInfo.freeMB}MB)，预热可能会失败`);
        }

        console.log(`[AI Service] 收到客户端预热请求，开始拉起模型: ${clientModel}...`)
        // 预热对话模型：keep_alive设为30m，确保模型在内存中保持足够时间
        axios.post('http://127.0.0.1:11435/api/generate', {
          model: clientModel,
          prompt: '',
          keep_alive: '30m', // 保持30分钟
          options: { num_predict: 1 }
        }).catch(() => {})
        
        res.json({ success: true, message: '模型预热指令已发送', actualModel: clientModel })
      } catch (error) {
        res.status(500).json({ success: false, error: error.message })
      }
    })

    // 内存状态查询接口
    aiApp.get('/memory-status', (req, res) => {
      try {
        const memoryInfo = getSystemMemoryInfo();
        const pressureLevel = getMemoryPressureLevel();
        const packagedModel = getPackagedModel();
        res.json({
            success: true,
            totalMB: memoryInfo.totalMB,
            freeMB: memoryInfo.freeMB,
            usedPercent: memoryInfo.usedPercent,
            pressureLevel,
            currentModel: packagedModel.modelName
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    })

    // 释放模型接口 (客户端关闭抽屉时触发)
    aiApp.post('/unload-models', async (req, res) => {
      try {
        const clientModel = req.body.model || DEFAULT_MODEL;
        console.log(`[AI Service] 收到客户端释放内存请求，正在卸载模型: ${clientModel}...`)
        // 卸载对话模型
        await axios.post('http://127.0.0.1:11435/api/generate', {
          model: clientModel,
          prompt: '',
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
      const packagedModel = getPackagedModel()
      try {
        await axios.get('http://127.0.0.1:11435/')
        res.json({
          status: 'running',
          ollama: 'connected',
          indexReady: hasIndex,
          currentModel: packagedModel.modelName,
          message: '本地 AI 中转服务及 Ollama 服务均运行正常'
        })
      } catch (error) {
        res.json({
          status: 'running',
          ollama: 'disconnected',
          currentModel: packagedModel.modelName,
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

    // 模型检测：在服务启动后，先检测并尝试拉起 Ollama，然后自动预热模型
    aiServer.on('listening', async () => {
      const started = await ensureOllamaService(axios)
      if (started) {
        console.log('[AI Service] Ollama 守护进程已就绪，开始自动预热模型以消除冷启动延迟...')
        // 恢复启动预热：消除首次对话的冷启动延迟（3~30秒），TTFT优化关键步骤
        warmupModels(axios)
      } else {
        console.warn('[AI Service] 无法自动拉起 Ollama 服务，请手动开启。')
      }
    })
  } catch (error) {
    console.error('[AI Service] 加载AI服务模块失败:', error)
  }
}

function getOllamaConfig() {
  if (app.isPackaged) {
    // 生产模式：使用内嵌 ollama.exe，所有配置代码注入，客户无需手动配置
    return {
      exePath: path.join(process.resourcesPath, 'ollama', 'ollama.exe'),
      env: {
        OLLAMA_MODELS: path.join(process.resourcesPath, 'models'),
        OLLAMA_FLASH_ATTENTION: '1',      // 优化TTFT
        OLLAMA_NUM_PARALLEL: '1',         // 强制单路推理，把所有算力全部集中给当前请求，大幅降低 TTFT
        OLLAMA_KV_CACHE_TYPE: 'q4_0',    // 节省内存
        OLLAMA_KEEP_ALIVE: '30m',          // 保持30分钟自动释放，节省内存
        OLLAMA_MAX_LOADED_MODELS: '1',   // 强制单模型加载，防止多模型争抢内存
        OLLAMA_HOST: '127.0.0.1:11435'   // 仅本机访问，安全
      }
    }
  } else {
    // 开发模式：优先使用我们刚下载的内嵌最新版引擎，确保开发调试不会因为系统老引擎而崩溃
    const vendorOllama = path.join(__dirname, 'vendor', 'ollama', 'ollama.exe')
    if (fs.existsSync(vendorOllama)) {
      return { 
        exePath: vendorOllama,
        env: {
          OLLAMA_HOST: '127.0.0.1:11435',
          OLLAMA_MODELS: path.join(__dirname, 'vendor', 'models'),
          OLLAMA_FLASH_ATTENTION: '1',
          OLLAMA_NUM_PARALLEL: '1',
          OLLAMA_KEEP_ALIVE: '30m'
        }
      }
    }
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local')
    const ollamaPath = path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe')
    return { 
      exePath: fs.existsSync(ollamaPath) ? ollamaPath : 'ollama', 
      env: {
        OLLAMA_HOST: '127.0.0.1:11435'
      } 
    }
  }
}

/**
 * 确保 Ollama 服务处于运行状态，如果没有运行，尝试自动拉起进程
 */
async function ensureOllamaService(axios) {
  try {
    // 检查 Ollama 服务是否已经在线
    await axios.get('http://127.0.0.1:11435/')
    console.log('[AI Service] 检测到 Ollama 服务已在运行。')
    return true
  } catch (error) {
    console.log('[AI Service] 未检测到运行中的 Ollama 服务，尝试自动启动...')
    
    try {
      const { spawn } = require('child_process')
      const config = getOllamaConfig()
      const env = { ...process.env, ...config.env }
      
      console.log(`[AI Service] 正在静默拉起: ${config.exePath}`)
      const spawnedProcess = spawn(config.exePath, ['serve'], {
        env,
        stdio: 'ignore',
        windowsHide: true // 强制隐藏 Windows 的 CMD 黑窗口
      })
      
      if (spawnedProcess) {
        ollamaProcess = spawnedProcess
        
        // 轮询等待 Ollama 接口就绪（最多等15秒）
        console.log('[AI Service] 正在等待 Ollama 服务就绪 (最多等待 15s)...')
        for (let i = 1; i <= 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          try {
            await axios.get('http://127.0.0.1:11435/', { timeout: 1000 })
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
 * - 对话模型 → /api/generate (prompt为空, num_predict:0)
 */
async function warmupModels(axios) {
  console.log('[AI Service] 开始预热模型，提升首次响应速度...')
  
  let targetModel = DEFAULT_MODEL;
  
  const os = require('os');
  const freeMB = Math.round(os.freemem() / (1024 * 1024));
  if (freeMB < 2000) {
      console.warn(`[AI Service] 系统可用内存极低(${freeMB}MB)，跳过模型自动预热以保证系统稳定`);
      return;
  }

  // 预热对话模型
  try {
    console.log(`[AI Service] 正在预热对话模型: ${targetModel}...`)
    await axios.post('http://127.0.0.1:11435/api/generate', {
      model: targetModel,
      prompt: '你好',
      keep_alive: '30m',
      options: {
        num_predict: 1
      }
    }, { timeout: 60000 })
    console.log(`[AI Service] 对话模型 ${targetModel} 预热完成，将在内存中保持30分钟 ✓`)
  } catch (e) {
    console.warn('[AI Service] 对话模型预热失败:', e.message)
  }

  console.log('[AI Service] 对话模型预热完毕 ✓ 冷启动延迟已消除，首次提问将快速响应')
}

function stopAiService() {
  if (aiServer) {
    console.log('[AI Service] 正在停止AI服务...')
    aiServer.close()
    aiServer = null
  }
  
  console.log('[AI Service] 正在强制结束内嵌的 Ollama 引擎进程...')
  try {
    const { execSync } = require('child_process')
    if (process.platform === 'win32') {
      // 1. 如果有绑定的子进程，直接通过进程树杀死
      if (ollamaProcess) {
        try { execSync(`taskkill /F /PID ${ollamaProcess.pid} /T`) } catch(e) {}
      }
      
      // 2. 兜底策略：查找占用 11435 端口的孤儿 ollama 进程并杀死
      try {
        const output = execSync('netstat -ano | findstr :11435').toString()
        const lines = output.trim().split('\n')
        const pids = new Set()
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 5 && parts[1].includes(':11435') && parts[3] === 'LISTENING') {
            pids.add(parts[4])
          }
        })
        pids.forEach(pid => {
          if (pid !== '0') {
            console.log(`[AI Service] 发现占用 11435 端口的幽灵进程 PID: ${pid}，正在强杀...`)
            execSync(`taskkill /F /PID ${pid} /T`)
          }
        })
      } catch (e) {}
      
    } else {
      if (ollamaProcess) {
        ollamaProcess.kill('SIGKILL')
      }
      try {
        execSync('lsof -t -i:11435 | xargs kill -9')
      } catch (e) {}
    }
  } catch (e) {
    console.warn('[AI Service] 结束 Ollama 进程时出错:', e.message)
  }
  ollamaProcess = null
}

// 应用就绪：先启动文档服务器，再创建窗口
app.whenReady().then(() => {
  startRanutsDocServer()
  
  // 延迟启动 AI 中转服务，优先保障前端页面及基础文档服务的 CPU 资源和加载速度
  setTimeout(() => {
    // 检测是否为无AI模式（判断依据：Ollama 运行时是否存在）
    const ollamaPath = app.isPackaged
      ? path.join(process.resourcesPath, 'ollama', 'ollama.exe')
      : path.join(__dirname, 'vendor', 'ollama', 'ollama.exe')
    if (fs.existsSync(ollamaPath)) {
      console.log('[App] 延迟启动 AI 服务...')
      startAiService() 
    } else {
      console.log('[App] 未检测到 AI 运行时，以无AI模式运行')
    }
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

