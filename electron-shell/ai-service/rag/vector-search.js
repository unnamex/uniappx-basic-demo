/**
 * 混合检索模块 (Hybrid Search) v2.0
 * 
 * 集成三个论文创新点：
 * ① H2R  - 工艺层次感知两阶段检索
 * ② CAS  - 口语化程度自适应路由（在调用方集成）
 * ③ JCS  - 联合置信度驱动的安全拦截
 * 
 * 原有功能保持兼容：Graph + BM25 + Vector 三路融合 + RRF排序
 */

const { getEmbedding, loadIndex } = require('./vectorizer')
const { loadGraphIndex } = require('./graph-builder')
const { searchBM25 } = require('./bm25')

// 缓存已加载的索引
let cachedVectorIndex = null
let cachedGraphIndex = null

// 用于打字防抖预查询的上下文缓存，question -> results
const prefetchCache = new Map()

/**
 * 计算两个字符串的编辑距离（Levenshtein Distance）
 */
function levenshteinDistance(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
    }
  }
  return arr[t.length][s.length];
}

/**
 * 模糊匹配关键词：支持容错 1-2 个错别字
 */
function fuzzyMatchKeyword(question, keyword) {
  if (!keyword || keyword.length < 2) return false
  if (question.includes(keyword)) return true
  
  // 长度小于3的词不开启模糊匹配，避免误杀
  if (keyword.length < 3) return false

  const kLen = keyword.length
  // 允许的错别字数量：3-5个字允许错1个，6个字以上允许错2个
  const maxErrors = kLen >= 6 ? 2 : 1

  // 滑动窗口检查
  for (let i = 0; i <= question.length - kLen; i++) {
    const windowStr = question.substring(i, i + kLen)
    const dist = levenshteinDistance(windowStr, keyword)
    if (dist <= maxErrors) {
      return true
    }
  }
  return false
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * RRF (Reciprocal Rank Fusion) 融合排序
 * 将多路召回的结果根据排名进行倒数加权融合
 */
function reciprocalRankFusion(resultsLists, k = 60) {
  const rrfScores = new Map(); // id -> score
  const itemsMap = new Map();  // id -> item

  resultsLists.forEach(list => {
    list.forEach((item, index) => {
      const rank = index + 1;
      const score = 1.0 / (k + rank);
      
      if (!rrfScores.has(item.id)) {
        rrfScores.set(item.id, 0);
        itemsMap.set(item.id, item);
      }
      
      rrfScores.set(item.id, rrfScores.get(item.id) + score);
    });
  });

  const fusedResults = Array.from(rrfScores.entries()).map(([id, score]) => {
    return {
      ...itemsMap.get(id),
      rrfScore: score
    };
  });

  // 按 RRF score 降序排序
  fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);
  
  return fusedResults;
}


// ========== H2R 两阶段检索（论文创新点①）==========

/**
 * H2R 第一阶段：工序级粗检索
 * 在工序级向量索引中定位相关工序
 * 
 * @param {Array} questionEmbedding - 查询向量
 * @param {Array} operationChunks - 工序级 chunk 列表
 * @param {number} topN - 返回的工序数量
 * @param {number} minSim - 最低相似度阈值
 * @returns {Array} 命中的工序 id 列表
 */
function h2rStage1(questionEmbedding, operationChunks, topN = 3, minSim = 0.30) {
  if (!operationChunks || operationChunks.length === 0) return []

  const scored = operationChunks.map(chunk => ({
    id: chunk.id,
    score: cosineSimilarity(questionEmbedding, chunk.embedding)
  }))

  scored.sort((a, b) => b.score - a.score)

  // 只返回超过最低阈值的工序
  const hits = scored.filter(s => s.score >= minSim).slice(0, topN)
  
  if (hits.length > 0) {
    console.log(`[H2R Stage1] 粗检索命中 ${hits.length} 个工序: ${hits.map(h => `${h.id}(${h.score.toFixed(3)})`).join(', ')}`)
  }

  return hits.map(h => h.id)
}

/**
 * H2R 第二阶段：工步级精细检索
 * 仅在命中工序的子集中进行精细检索
 * 
 * @param {Array} questionEmbedding - 查询向量
 * @param {object} childMap - 工序→子chunk映射
 * @param {Array} hitOperationIds - 第一阶段命中的工序id
 * @param {number} topK - 返回的最大结果数
 * @param {number} minSim - 最低相似度阈值
 * @returns {Array} 精细检索结果列表
 */
function h2rStage2(questionEmbedding, childMap, hitOperationIds, topK = 2, minSim = 0.35) {
  if (!childMap || hitOperationIds.length === 0) return []

  // 收集所有命中工序的子chunk
  const candidateChunks = []
  for (const opId of hitOperationIds) {
    const children = childMap[opId]
    if (children && children.length > 0) {
      candidateChunks.push(...children)
    }
  }

  if (candidateChunks.length === 0) return []

  // 在缩小的候选集中做精细检索
  const scored = candidateChunks.map(chunk => ({
    id: chunk.id,
    type: chunk.type,
    text: chunk.text,
    metadata: chunk.metadata,
    score: cosineSimilarity(questionEmbedding, chunk.embedding)
  }))

  scored.sort((a, b) => b.score - a.score)
  const results = scored.filter(s => s.score >= minSim).slice(0, topK)

  if (results.length > 0) {
    console.log(`[H2R Stage2] 从 ${candidateChunks.length} 个候选中精细检索，命中 ${results.length} 条 (最高: ${results[0].score.toFixed(4)})`)
  }

  return results
}


// ========== JCS 联合置信度安全拦截（论文创新点③）==========

/**
 * JCS 权重配置
 * 三个维度的权重可在实验中调优
 */
const JCS_CONFIG = {
  w1: 0.35,       // 图谱命中权重
  w2: 0.45,       // 向量最高相似度权重
  w3: 0.20,       // BM25 归一化分数权重
  theta: 0.25,    // 安全阈值：低于此值拒绝回答
  nMax: 3         // 图谱命中数量归一化上限
}

/**
 * 计算联合置信度分数 JCS(q)
 * 
 * 公式：JCS(q) = w₁·min(N_graph/N_max, 1) + w₂·max_sim + w₃·BM25_norm
 * 
 * @param {number} graphHitCount - 图谱实体命中数量
 * @param {number} maxVectorSim - 向量检索最高余弦相似度（0~1）
 * @param {number} maxBM25Score - BM25最高分数（需归一化）
 * @returns {{ score: number, isReliable: boolean, detail: string }}
 */
function calcJointConfidence(graphHitCount, maxVectorSim, maxBM25Score) {
  const { w1, w2, w3, theta, nMax } = JCS_CONFIG

  // 归一化各维度
  const graphNorm = Math.min(graphHitCount / nMax, 1.0)
  const vectorNorm = Math.max(0, Math.min(maxVectorSim, 1.0))
  // BM25分数归一化：实践中BM25分数通常在0~15范围，除以10做软归一化
  const bm25Norm = Math.min(maxBM25Score / 10.0, 1.0)

  // 加权求和
  const score = w1 * graphNorm + w2 * vectorNorm + w3 * bm25Norm
  const isReliable = score >= theta

  const detail = `JCS=${score.toFixed(3)} [Graph=${graphNorm.toFixed(2)}×${w1}, Vec=${vectorNorm.toFixed(2)}×${w2}, BM25=${bm25Norm.toFixed(2)}×${w3}] θ=${theta} → ${isReliable ? '可靠' : '拒绝'}`
  console.log(`[JCS] ${detail}`)

  return { score, isReliable, detail }
}


// ========== 主检索函数（集成 H2R + JCS）==========

/**
 * 混合检索：集成 H2R 层次检索、三路融合、JCS 安全拦截
 * 
 * @param {string} question - 用户问题（已经过 CAS 预处理）
 * @param {number} topK - 返回的最大向量结果数，默认 2
 * @param {number} maxContextLength - 返回结果的最大合并字符长度限制
 * @param {Object} profile - 模型配置
 * @param {Object} options - 扩展选项
 * @param {boolean} options.useH2R - 是否使用 H2R 层次检索（默认 true）
 * @param {boolean} options.useJCS - 是否使用 JCS 联合置信度（默认 true）
 * @returns {Promise<{ results: Array, jcsScore: number, jcsReliable: boolean }>}
 */
async function searchSimilar(question, topK = 2, maxContextLength = 1500, profile = null, options = {}) {
  const useH2R = options.useH2R !== false
  const useJCS = options.useJCS !== false

  if (!question || question.trim() === '') {
    return { results: [], jcsScore: 0, jcsReliable: false }
  }

  // 如果缓存在 1 分钟内已经被预加载过该问题的结果，直接返回
  if (prefetchCache.has(question)) {
    console.log(`[Hybrid Search] 命中预查询缓存: "${question}"`)
    const cached = prefetchCache.get(question)
    return { results: cached, jcsScore: 1.0, jcsReliable: true }
  }

  // 懒加载缓存
  if (cachedVectorIndex == null) cachedVectorIndex = loadIndex()
  if (cachedGraphIndex == null) cachedGraphIndex = loadGraphIndex()

  let graphResults = []
  let graphHitCount = 0
  
  // 1. 图谱实体精确提取与模糊容错 (Graph Search)
  if (cachedGraphIndex && cachedGraphIndex.entities) {
    const matchedEntities = cachedGraphIndex.entities.filter(ent => {
      return fuzzyMatchKeyword(question, ent.keyword)
    })
    
    graphHitCount = matchedEntities.length

    if (matchedEntities.length > 0) {
      console.log(`[Hybrid Search] 命中图谱实体: ${matchedEntities.map(e => e.keyword).join(', ')}`)
      graphResults = matchedEntities.map(e => ({
        id: `graph-${e.keyword}`,
        type: e.type,
        text: e.context,
        score: 1.0
      }))
    }
  }

  // 2. BM25 检索 (同步)
  const bm25Results = searchBM25(question, 1);
  const maxBM25Score = bm25Results.length > 0 ? bm25Results[0].score : 0

  // 3. 向量检索（支持 H2R 两阶段）
  let vectorResults = []
  let maxVectorSim = 0

  if (cachedVectorIndex && cachedVectorIndex.chunks && cachedVectorIndex.chunks.length > 0) {
    try {
      const questionEmbedding = await getEmbedding(question)
      const MIN_SIMILARITY_THRESHOLD = profile?.rag?.minSimilarity ?? 0.35

      // ===== H2R 层次检索 + 扁平检索 融合策略 =====
      // 核心思路：H2R 作为「增强」而非「替代」
      // 始终执行扁平检索保证覆盖面，H2R 命中的结果获得加权优势
      const hasH2RIndex = useH2R && cachedVectorIndex.h2rIndex 
        && cachedVectorIndex.h2rIndex.operationChunks 
        && cachedVectorIndex.h2rIndex.operationChunks.length > 0

      // 扁平检索（始终执行，作为基础召回保障）
      const flatResults = flatVectorSearch(questionEmbedding, cachedVectorIndex.chunks, topK * 2, MIN_SIMILARITY_THRESHOLD)

      if (hasH2RIndex) {
        // H2R 两阶段检索（论文创新点①）
        console.log(`[H2R] 使用层次化两阶段检索（增强模式）`)
        
        // 第一阶段：工序级粗检索
        const hitOpIds = h2rStage1(
          questionEmbedding, 
          cachedVectorIndex.h2rIndex.operationChunks,
          3,   // 最多命中3个工序
          0.30 // 工序级阈值（粗筛）
        )

        if (hitOpIds.length > 0) {
          // 第二阶段：在命中工序的子集中精细检索
          const h2rResults = h2rStage2(
            questionEmbedding,
            cachedVectorIndex.h2rIndex.childMap,
            hitOpIds,
            topK * 2,
            MIN_SIMILARITY_THRESHOLD
          )

          // 命中工序本身也加入候选
          const hitOpChunks = cachedVectorIndex.h2rIndex.operationChunks
            .filter(c => hitOpIds.includes(c.id))
            .map(c => ({
              id: c.id,
              type: c.type,
              text: c.text,
              metadata: c.metadata,
              score: cosineSimilarity(questionEmbedding, c.embedding)
            }))


          // H2R 命中的结果打标记（排在扁平结果前面，天然获得 RRF 排名优势）
          // 注意：不做 score boost，避免影响 JCS 基于真实分数的可靠性判断
          const h2rCandidates = [...h2rResults, ...hitOpChunks].map(r => ({
            ...r,
            isH2RHit: true
          }))

          // 合并：H2R 命中优先排前 + 扁平结果补全（去重）
          const seenIds = new Set()
          vectorResults = []
          for (const item of [...h2rCandidates, ...flatResults]) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id)
              vectorResults.push(item)
            }
          }
          console.log(`[H2R] 增强合并完成: H2R命中 ${h2rCandidates.length} 条 + 扁平 ${flatResults.length} 条 → 去重后 ${vectorResults.length} 条`)

        } else {
          vectorResults = flatResults
        }
      } else {
        // 消融实验中关闭H2R时，仅使用扁平检索
        vectorResults = flatResults
      }

      // 记录最高向量相似度（供 JCS 使用）
      if (vectorResults.length > 0) {
        maxVectorSim = Math.max(...vectorResults.map(r => r.score))
        console.log(`[Hybrid Search] 向量最高相似度: ${maxVectorSim.toFixed(4)}`)
      }
    } catch (err) {
      console.error('[Hybrid Search] 问题向量化失败:', err.message)
    }
  }

  // ===== JCS 联合置信度安全拦截（论文创新点③）=====
  let jcsScore = 1.0
  let jcsReliable = true

  if (useJCS) {
    const jcs = calcJointConfidence(graphHitCount, maxVectorSim, maxBM25Score)
    jcsScore = jcs.score
    jcsReliable = jcs.isReliable

    if (!jcsReliable) {
      console.log(`[JCS] 置信度不足，触发安全拦截，返回零召回`)
      // 放入缓存（防止重复查询）
      if (prefetchCache.size > 50) prefetchCache.clear()
      prefetchCache.set(question, [])
      return { results: [], jcsScore, jcsReliable: false }
    }
  } else {
    // 不使用 JCS 时，回退到原有硬规则（消融实验用）
    if (graphResults.length === 0 && vectorResults.length === 0) {
      console.log(`[Hybrid Search] 图谱与向量均未命中（硬规则拦截）`)
      return { results: [], jcsScore: 0, jcsReliable: false }
    }
  }

  // 4. 三路 RRF 融合 (Graph, BM25, Vector)
  let combined = [];
  
  if (graphResults.length > 0 || bm25Results.length > 0 || vectorResults.length > 0) {
    combined = reciprocalRankFusion([graphResults, bm25Results, vectorResults]);
    console.log(`[Hybrid Search] RRF 融合完成，共获取 ${combined.length} 条去重记录`);
  }
  
  // 返回融合后的上下文片段，根据 maxContextLength 截断
  const finalResults = [];
  let totalLength = 0;
  for (const item of combined) {
    if (totalLength + item.text.length > maxContextLength && finalResults.length > 0) {
       break;
    }
    finalResults.push(item);
    totalLength += item.text.length;
  }
  
  // 放入缓存 (最多保留50条防止内存泄漏)
  if (prefetchCache.size > 50) prefetchCache.clear()
  prefetchCache.set(question, finalResults)
  
  return { results: finalResults, jcsScore, jcsReliable }
}


/**
 * 扁平向量检索（原有逻辑，作为 H2R 关闭时的回退/消融对比基线）
 */
function flatVectorSearch(questionEmbedding, chunks, topK, minSimilarity) {
  const scored = chunks.map(chunk => ({
    id: chunk.id,
    type: chunk.type,
    text: chunk.text,
    metadata: chunk.metadata,
    score: cosineSimilarity(questionEmbedding, chunk.embedding)
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.filter(item => item.score >= minSimilarity).slice(0, topK)
}


/**
 * 清除缓存的索引（在重建索引后调用）
 */
function clearCache() {
  cachedVectorIndex = null
  cachedGraphIndex = null
  prefetchCache.clear()
  const { clearBM25Cache } = require('./bm25')
  clearBM25Cache()
  console.log('[Hybrid Search] 混合索引缓存已清除')
}

module.exports = {
  searchSimilar,
  clearCache,
  // 导出供消融实验和论文评估脚本使用
  calcJointConfidence,
  JCS_CONFIG,
  h2rStage1,
  h2rStage2,
  flatVectorSearch,
  cosineSimilarity
}
