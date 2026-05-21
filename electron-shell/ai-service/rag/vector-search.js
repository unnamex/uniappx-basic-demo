/**
 * 混合检索模块 (Hybrid Search)
 * 结合 知识图谱精准实体提取 (Graph Search) 与 向量相似度检索 (Vector Search)
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

/**
 * 混合检索：根据用户问题提取 Graph 实体系与 Vector 相似块
 * @param {string} question - 用户问题
 * @param {number} topK - 返回的最大向量结果数，默认 3
 * @returns {Promise<Array>} 融合后的 Context Chunk 列表
 */
async function searchSimilar(question, topK = 3) {
  if (!question || question.trim() === '') return []

  // 如果缓存在 1 分钟内已经被预加载过该问题的结果，直接返回！偷走几百毫秒
  if (prefetchCache.has(question)) {
    console.log(`[Hybrid Search] 命中预查询缓存: "${question}"`)
    return prefetchCache.get(question)
  }

  // 懒加载缓存
  if (cachedVectorIndex == null) cachedVectorIndex = loadIndex()
  if (cachedGraphIndex == null) cachedGraphIndex = loadGraphIndex()

  let graphResults = []
  
  // 1. 图谱实体精确提取与模糊容错 (Graph Search) 同步执行
  if (cachedGraphIndex && cachedGraphIndex.entities) {
    const matchedEntities = cachedGraphIndex.entities.filter(ent => {
      return fuzzyMatchKeyword(question, ent.keyword)
    })
    
    if (matchedEntities.length > 0) {
      console.log(`[Hybrid Search] 命中图谱实体: ${matchedEntities.map(e => e.keyword).join(', ')}`)
      graphResults = matchedEntities.map(e => ({
        id: `graph-${e.keyword}`,
        type: e.type,
        text: e.context,
        score: 1.0 // 图谱命中赋予最高权重
      }))
      
      // 【关键优化】：如果命中图谱实体，仍然可以和 BM25 结果做个融合，但这里为了避免打断大段完整上下文
      // 如果只想要精确实体，可以提前返回。为了保持 RRF 的统一性，我们这里继续往下走。
      // 但对于图谱强制排在最前面，我们给予额外的 boost
    }
  }

  // 2. BM25 检索 (同步)
  const bm25Results = searchBM25(question, topK * 2);

  // 3. 向量检索 (异步)
  let vectorResults = []
  if (cachedVectorIndex && cachedVectorIndex.chunks && cachedVectorIndex.chunks.length > 0) {
    try {
      const questionEmbedding = await getEmbedding(question)
      const scored = cachedVectorIndex.chunks.map(chunk => ({
        id: chunk.id,
        type: chunk.type,
        text: chunk.text,
        metadata: chunk.metadata,
        score: cosineSimilarity(questionEmbedding, chunk.embedding)
      }))
      
      scored.sort((a, b) => b.score - a.score)
      const MIN_SIMILARITY_THRESHOLD = 0.55
      const validResults = scored.filter(item => item.score >= MIN_SIMILARITY_THRESHOLD)
      vectorResults = validResults.slice(0, topK * 2)
      
      if (scored.length > 0) {
        console.log(`[Hybrid Search] 向量最高相似度: ${scored[0].score.toFixed(4)}`)
      }
    } catch (err) {
      console.error('[Hybrid Search] 问题向量化失败:', err.message)
    }
  }

  // 4. 三路 RRF 融合 (Graph, BM25, Vector)
  let combined = [];
  if (graphResults.length > 0 || bm25Results.length > 0 || vectorResults.length > 0) {
    // 为保证图谱的绝对优先级，我们让图谱列表在前，使得它在融合时 rank 高
    combined = reciprocalRankFusion([graphResults, bm25Results, vectorResults]);
    console.log(`[Hybrid Search] RRF 融合完成，共获取 ${combined.length} 条去重记录`);
  }
  
  // 返回融合后的上下文片段，并根据总 Token 长度（近似控制在 1000 字符内）进行截断
  const finalResults = [];
  let totalLength = 0;
  for (const item of combined) {
    if (totalLength + item.text.length > 1500 && finalResults.length > 0) {
       break; // 超过字符长度限制
    }
    finalResults.push(item);
    totalLength += item.text.length;
  }
  
  // 放入缓存 (最多保留50条防止内存泄漏)
  if (prefetchCache.size > 50) prefetchCache.clear()
  prefetchCache.set(question, finalResults)
  
  return finalResults
}

/**
 * 清除缓存的索引（在重建索引后调用）
 */
function clearCache() {
  cachedVectorIndex = null
  cachedGraphIndex = null
  const { clearBM25Cache } = require('./bm25')
  clearBM25Cache()
  console.log('[Hybrid Search] 混合索引缓存已清除')
}

module.exports = {
  searchSimilar,
  clearCache,
  cosineSimilarity
}
