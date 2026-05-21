const express = require('express')
const axios = require('axios')
const cors = require('cors')
const { searchKnowledge } = require('./rag/search')
const { SYSTEM_PROMPT, buildUserPrompt } = require('./rag/prompt')

const app = express()

// 开启跨域和JSON解析
app.use(cors())
app.use(express.json())

// 默认大模型，可根据传入参数或本地配置调整
const DEFAULT_MODEL = 'qwen2.5:7b'

// AI对话接口
app.post('/chat', async (req, res) => {
    try {
        const question = req.body.prompt || req.body.question
        const clientModel = req.body.model || DEFAULT_MODEL
        
        if (!question) {
            return res.status(400).json({ error: '提问内容(prompt/question)不能为空' })
        }
        
        console.log(`[AI Service] 收到提问: "${question}", 请求模型: "${clientModel}"`)
        
        // 1. 本地知识库检索 (RAG)
        const docs = searchKnowledge(question)
        
        // 2. 拼接 Prompt
        const finalPrompt = buildUserPrompt(question, docs, [])
        
        console.log(`[AI Service] 正在请求 Ollama (http://localhost:11434)...`)

        // 设置 Response Headers 开启 Chunked Streaming
        res.setHeader('Content-Type', 'application/x-ndjson')
        res.setHeader('Transfer-Encoding', 'chunked')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        // 写入初始状态和文档检索结果
        res.write(JSON.stringify({ type: 'status', stage: 'retrieving' }) + '\n')
        res.write(JSON.stringify({ type: 'docs', docs: docs }) + '\n')
        res.write(JSON.stringify({ type: 'status', stage: 'retrieved' }) + '\n')
        
        // 3. 向本地 Ollama 服务发起流式对话请求
        const response = await axios.post(
            'http://localhost:11434/api/generate',
            {
                model: clientModel,
                system: SYSTEM_PROMPT,
                prompt: finalPrompt,
                stream: true
            },
            {
                responseType: 'stream',
                timeout: 60000 // 60秒超时
            }
        )
        
        console.log(`[AI Service] Ollama 流式请求成功，开始转发。`)
        
        response.data.on('data', chunk => {
            res.write(chunk)
        })

        response.data.on('end', () => {
            console.log(`[AI Service] Ollama 流式发送结束。`)
            res.end()
        })

        response.data.on('error', err => {
            console.error('[AI Service] Ollama 流式读取出错:', err.message)
            res.write(JSON.stringify({ type: 'error', error: 'Ollama 流式读取出错: ' + err.message }) + '\n')
            res.end()
        })
        
    } catch (error) {
        console.error('[AI Service] 发生错误:', error.message)
        
        let errorMessage = '本地 AI 服务处理异常，请检查本地 Ollama 是否已启动且模型正常。'
        if (error.code === 'ECONNREFUSED') {
            errorMessage = '无法连接到 Ollama 服务，请确认已经在本地终端启动了 Ollama 服务（默认端口 11434）。'
        } else if (error.response && error.response.data) {
            errorMessage = `Ollama 服务返回错误: ${JSON.stringify(error.response.data)}`
        }
        
        // 如果已经发送了部分 chunk，直接写错误，否则发 500
        if (res.headersSent) {
            res.write(JSON.stringify({ type: 'error', error: errorMessage }) + '\n')
            res.end()
        } else {
            res.status(500).json({
                success: false,
                error: errorMessage,
                details: error.message
            })
        }
    }
})

// 状态检查接口
app.get('/status', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:11434/')
        res.json({
            status: 'running',
            ollama: 'connected',
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
app.listen(PORT, () => {
    console.log(`[AI Service] 离线AI工艺助手中转服务启动成功，监听端口: ${PORT}`)
})
