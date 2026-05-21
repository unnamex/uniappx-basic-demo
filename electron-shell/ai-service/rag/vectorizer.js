/**
 * 向量化模块 - 将工艺数据切片并通过 Ollama Embedding 生成向量索引
 * 
 * 切片策略：
 * - 每条工艺记录 = 1个 chunk
 * - 每条工序记录 = 1个 chunk（附带所属工艺信息）
 * - 每条工步记录 = 1个 chunk（附带所属工艺/工序信息）
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Embedding 模型名称
const EMBED_MODEL = 'nomic-embed-text'
// 向量索引文件路径
const INDEX_FILE = path.join(__dirname, '..', 'vector-index.json')

/**
 * 将工艺数据对象转为文本 chunk 列表
 * @param {object} processContext - 从 IndexedDB 读取的原始工艺数据
 * @returns {Array} chunk 列表，每个 chunk 包含 id、type、text、metadata
 */
function buildChunks(processContext) {
  const chunks = []
  if (!processContext) return chunks

  // 工艺级别 chunk
  if (processContext.processes && processContext.processes.length > 0) {
    processContext.processes.forEach((p, idx) => {
      let text = `工艺: ${p.name || '未知'}`
      if (p.code) text += `, 编号: ${p.code}`
      if (p.classId_display) text += `, 类型: ${p.classId_display}`
      if (p.version) text += `, 版本: ${p.version}`
      if (p.stateName) text += `, 状态: ${p.stateName}`
      if (p.partName) text += `, 关联零件: ${p.partName}`
      if (p.partCode) text += ` (${p.partCode})`
      if (p.departmentName) text += `, 所属部门: ${p.departmentName}`
      if (p.note) text += `, 备注: ${p.note}`
      if (p.routeContent) text += `, 工艺路线: ${p.routeContent}`

      chunks.push({
        id: `process-${idx}`,
        type: 'process',
        text: text,
        metadata: {
          processName: p.name || '',
          code: p.code || ''
        }
      })
    })
  }

  // 工序级别 chunk
  if (processContext.operations && processContext.operations.length > 0) {
    // 尝试获取所属工艺名称
    const processName = (processContext.processes && processContext.processes.length > 0)
      ? processContext.processes[0].name || ''
      : ''

    processContext.operations.forEach((op, idx) => {
      let text = `工序${op.serialNumber || idx + 1}: ${op.name || '未知'}`
      if (processName) text = `[${processName}] ` + text
      if (op.code) text += ` (编号: ${op.code})`
      if (op.isKey === 'true' || op.isKey === true) text += ' [关键工序]'
      if (op.content) text += ` | 加工内容: ${op.content}`

      chunks.push({
        id: `operation-${idx}`,
        type: 'operation',
        text: text,
        metadata: {
          processName: processName,
          operationName: op.name || '',
          serialNumber: String(op.serialNumber || idx + 1),
          isKey: op.isKey === 'true' || op.isKey === true
        }
      })
    })
  }

  // 工步级别 chunk
  if (processContext.steps && processContext.steps.length > 0) {
    const processName = (processContext.processes && processContext.processes.length > 0)
      ? processContext.processes[0].name || ''
      : ''

    processContext.steps.forEach((step, idx) => {
      let text = `工步${step.serialNumber || idx + 1}: ${step.name || '未知'}`
      if (processName) text = `[${processName}] ` + text
      if (step.code) text += ` (编号: ${step.code})`
      if (step.content) text += ` | 内容: ${step.content}`
      if (step.note) text += ` | 备注: ${step.note}`

      chunks.push({
        id: `step-${idx}`,
        type: 'step',
        text: text,
        metadata: {
          processName: processName,
          stepName: step.name || '',
          serialNumber: String(step.serialNumber || idx + 1)
        }
      })
    })
  }

  return chunks
}

/**
 * 调用 Ollama Embedding API 获取文本向量
 * @param {string} text - 输入文本
 * @returns {Promise<Array<number>>} 向量数组
 */
async function getEmbedding(text) {
  const response = await axios.post('http://localhost:11434/api/embeddings', {
    model: EMBED_MODEL,
    prompt: text,
    keep_alive: '30m' // 让 Embedding 模型在内存中保持30分钟，避免反复加载
  }, { timeout: 30000 })
  return response.data.embedding
}

/**
 * 对所有 chunk 批量生成 embedding 并保存索引文件
 * @param {Array} chunks - chunk 列表
 * @param {function} onProgress - 进度回调 (current, total)
 * @returns {Promise<object>} 生成的索引对象
 */
async function buildIndex(chunks, onProgress) {
  const indexData = {
    version: 1,
    model: EMBED_MODEL,
    createdAt: new Date().toISOString(),
    chunkCount: chunks.length,
    chunks: []
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      const embedding = await getEmbedding(chunk.text)
      indexData.chunks.push({
        id: chunk.id,
        type: chunk.type,
        text: chunk.text,
        metadata: chunk.metadata,
        embedding: embedding
      })
    } catch (err) {
      console.error(`[Vectorizer] 向量化 chunk "${chunk.id}" 失败:`, err.message)
      // 跳过失败的 chunk，继续处理
    }

    if (onProgress) {
      onProgress(i + 1, chunks.length)
    }
  }

  // 如果没有任何 chunk 成功向量化，不保存空索引
  if (indexData.chunks.length === 0) {
    console.error(`[Vectorizer] 所有 ${chunks.length} 个 chunk 向量化均失败！请检查 Embedding 模型 (${EMBED_MODEL}) 是否已安装。`)
    throw new Error(`向量化全部失败，请先执行 "ollama pull ${EMBED_MODEL}" 安装 Embedding 模型。`)
  }

  // 保存到文件
  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData), 'utf-8')
  console.log(`[Vectorizer] 向量索引已保存: ${INDEX_FILE} (${indexData.chunks.length}/${chunks.length} chunks 成功)`)

  return indexData
}

/**
 * 加载已有的向量索引
 * @returns {object|null} 索引对象，不存在则返回 null
 */
function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return null
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[Vectorizer] 加载索引失败:', e.message)
    return null
  }
}

/**
 * 检查索引文件是否存在且有效（包含非空的 chunks）
 */
function indexExists() {
  if (!fs.existsSync(INDEX_FILE)) return false
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return data.chunks && data.chunks.length > 0
  } catch (e) {
    return false
  }
}

module.exports = {
  buildChunks,
  getEmbedding,
  buildIndex,
  loadIndex,
  indexExists,
  INDEX_FILE
}
