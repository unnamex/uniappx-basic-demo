/**
 * 向量化模块 - 将工艺数据切片并通过 Ollama Embedding 生成向量索引
 * 
 * 切片策略：
 * - 每条工艺记录 = 1个 chunk
 * - 每条工序记录 = 1个 chunk（附带所属工艺信息）
 * - 每条工步记录 = 1个 chunk（附带所属工艺/工序信息）
 */

const { pipeline, env } = require('@xenova/transformers')
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

// Embedding 模型配置
// 指向内嵌的本地模型，禁止联网下载
const modelDir = app && app.isPackaged
  ? path.join(process.resourcesPath, 'embed-models')
  : path.join(__dirname, '..', '..', 'vendor', 'embed-models')

env.allowRemoteModels = false   // 禁止联网，强制使用本地
env.localModelPath = modelDir   // 指向内嵌模型目录
env.cacheDir = modelDir

// 向量索引文件路径
const INDEX_FILE = path.join(__dirname, '..', 'vector-index.json')

let extractor = null

// 懒加载嵌入模型
async function getExtractor() {
  if (extractor != null) return extractor
  console.log('[LocalEmbed] 正在初始化本地 bge-small-zh 模型...')
  extractor = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5', { quantized: true })
  console.log('[LocalEmbed] 嵌入模型初始化完成 ✓')
  return extractor
}

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
      if (p.creator) text += `, 创建人: ${p.creator}`
      if (p.createTime) text += `, 创建时间: ${p.createTime}`
      if (p.modifier) text += `, 修改人: ${p.modifier}`
      if (p.modifyTime) text += `, 修改时间: ${p.modifyTime}`
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
      if (op.creator) text += ` | 创建人: ${op.creator}`
      if (op.createTime) text += ` | 创建时间: ${op.createTime}`
      if (op.modifier) text += ` | 修改人: ${op.modifier}`
      if (op.modifyTime) text += ` | 修改时间: ${op.modifyTime}`

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
      if (step.creator) text += ` | 创建人: ${step.creator}`
      if (step.createTime) text += ` | 创建时间: ${step.createTime}`
      if (step.modifier) text += ` | 修改人: ${step.modifier}`
      if (step.modifyTime) text += ` | 修改时间: ${step.modifyTime}`
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

  // 动作级别 chunk
  if (processContext.actions && processContext.actions.length > 0) {
    const processName = (processContext.processes && processContext.processes.length > 0)
      ? processContext.processes[0].name || ''
      : ''

    processContext.actions.forEach((act, idx) => {
      let text = `动作${act.serialNumber || idx + 1}: ${act.name || '未知'}`
      if (processName) text = `[${processName}] ` + text
      if (act.code) text += ` (编号: ${act.code})`
      if (act.content) text += ` | 内容: ${act.content}`
      if (act.creator) text += ` | 创建人: ${act.creator}`
      if (act.createTime) text += ` | 创建时间: ${act.createTime}`
      if (act.modifier) text += ` | 修改人: ${act.modifier}`
      if (act.modifyTime) text += ` | 修改时间: ${act.modifyTime}`
      if (act.note) text += ` | 备注: ${act.note}`

      chunks.push({
        id: `action-${idx}`,
        type: 'action',
        text: text,
        metadata: {
          processName: processName,
          actionName: act.name || '',
          serialNumber: String(act.serialNumber || idx + 1)
        }
      })
    })
  }

  return chunks
}

/**
 * 本地获取文本向量 (替代原先依赖 Ollama 的 API 调用)
 * @param {string} text - 输入文本
 * @returns {Promise<Array<number>>} 向量数组
 */
async function getEmbedding(text) {
  try {
    const ext = await getExtractor()
    // bge-small-zh 对 query 格式要求加前缀，对 passage 要求加前缀。为了方便检索时兼容，做以下处理
    // 由于既用于建库，又用于检索，我们统一使用 query 前缀可以得到最好的匹配结果。
    const output = await ext(`query: ${text}`, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  } catch (err) {
    console.error('[Vectorizer] 向量化计算异常:', err)
    throw err
  }
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
    model: 'Xenova/bge-small-zh-v1.5',
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
    console.error(`[Vectorizer] 所有 ${chunks.length} 个 chunk 向量化均失败！请检查本地 bge-small-zh 模型是否完整。`)
    throw new Error(`向量化全部失败，无法加载本地嵌入模型，请检查环境。`)
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
  indexExists
}
