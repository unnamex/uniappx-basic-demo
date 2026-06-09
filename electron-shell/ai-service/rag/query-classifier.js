/**
 * CAS 口语化程度自适应路由模块（Colloquialism-Aware Search Routing）
 * 
 * 论文核心创新点②：
 * 设计口语化程度评分函数 C(q)，根据分数决定检索路径，
 * 在离线低算力场景下避免对所有查询都执行昂贵的 LLM 查询重写。
 * 
 * 公式：
 *   C(q) = α · R_oov(q) + β · R_dict(q) + γ · (1 - R_complete(q))
 * 
 * 路由决策：
 *   C(q) < θ₁  → FAST   直接混合检索（L1，无需预处理）
 *   θ₁ ≤ C(q) < θ₂ → DICT  词典预处理后检索（L2，快速替换）
 *   C(q) ≥ θ₂  → REWRITE LLM查询重写后检索（L3，最精准）
 */

const { matchColloquial, calcDomainCoverage } = require('./colloquial-dict')

// ========== CAS 路由阈值与权重 ==========
// 这些参数可在消融实验中作为变量调优
const CAS_CONFIG = {
  // C(q) 计算权重（α + β + γ = 1）
  alpha: 0.4,   // R_oov 权重：OOV率（非术语词占比）
  beta: 0.35,   // R_dict 权重：口语词典命中率
  gamma: 0.25,  // R_incomplete 权重：句子不完整度

  // 路由阈值
  theta1: 0.30,  // 低于此值 → FAST 路径
  theta2: 0.60,  // 高于此值 → REWRITE 路径
}

/**
 * 评估句子完整度（越不完整 → 越口语化）
 * 
 * 判断依据：
 * - 缺少问号/句号等结束标点 → 不完整
 * - 长度过短（< 6字） → 碎片化表达
 * - 缺少主语/谓语结构的简单判断
 * 
 * @param {string} query - 用户查询
 * @returns {number} 完整度分数 0~1，越高越完整
 */
function calcCompleteness(query) {
  if (!query) return 0

  let score = 0
  const q = query.trim()

  // 1. 长度评分：6字以下视为碎片化（权重0.3）
  if (q.length >= 15) score += 0.3
  else if (q.length >= 10) score += 0.2
  else if (q.length >= 6) score += 0.1
  // else: 0

  // 2. 结尾标点评分（权重0.3）
  if (/[？?。.！!]$/.test(q)) {
    score += 0.3
  } else if (/[，,、；;：:]$/.test(q)) {
    score += 0.1
  }

  // 3. 疑问词/结构完整性评分（权重0.4）
  const hasQuestionWord = /[什么|怎么|如何|为什么|为啥|哪|几|多少|是否|能否|可以]/.test(q)
  const hasVerb = /[是|有|要|需要|应该|可以|能|会|做|用|设|取|控制|检查|测量|处理]/.test(q)

  if (hasQuestionWord && hasVerb) score += 0.4
  else if (hasQuestionWord || hasVerb) score += 0.2
  // else: 碎片化表达

  return Math.min(score, 1.0)
}

/**
 * 计算查询的口语化程度分数 C(q)
 * 
 * @param {string} query - 用户原始查询
 * @returns {{
 *   score: number,        // C(q) 总分 0~1
 *   route: string,        // 路由决策: 'FAST' | 'DICT' | 'REWRITE'
 *   oovRate: number,      // R_oov: 非术语词占比
 *   dictHitRate: number,  // R_dict: 口语词典命中率
 *   incompleteness: number, // 1 - R_complete: 句子不完整度
 *   dictResult: object,   // 词典匹配详情
 *   detail: string        // 可读的决策说明（用于日志）
 * }}
 */
function classifyColloquialism(query) {
  if (!query || query.trim().length === 0) {
    return {
      score: 0,
      route: 'FAST',
      oovRate: 0,
      dictHitRate: 0,
      incompleteness: 0,
      dictResult: { hitCount: 0, hitWords: [], replacedQuery: query },
      detail: '空查询，走 FAST 路径'
    }
  }

  const q = query.trim()

  // 1. 计算 R_oov：查询中非领域术语词的占比
  const coverage = calcDomainCoverage(q)
  const oovRate = coverage.oovRate // 0~1, 越高越口语化

  // 2. 计算 R_dict：口语词典命中率
  const dictResult = matchColloquial(q)
  // 归一化：命中0个=0, 命中1个=0.3, 命中2个=0.6, 命中3个及以上=1.0
  const dictHitRate = Math.min(dictResult.hitCount * 0.33, 1.0)

  // 3. 计算 1 - R_complete：句子不完整度
  const completeness = calcCompleteness(q)
  const incompleteness = 1 - completeness

  // 4. 加权计算 C(q)
  const { alpha, beta, gamma, theta1, theta2 } = CAS_CONFIG
  const score = alpha * oovRate + beta * dictHitRate + gamma * incompleteness

  // 5. 路由决策
  let route, detail
  if (score < theta1) {
    route = 'FAST'
    detail = `C(q)=${score.toFixed(3)} < θ₁=${theta1} → FAST（直接检索）`
  } else if (score < theta2) {
    route = 'DICT'
    detail = `θ₁=${theta1} ≤ C(q)=${score.toFixed(3)} < θ₂=${theta2} → DICT（词典预处理）`
  } else {
    route = 'REWRITE'
    detail = `C(q)=${score.toFixed(3)} ≥ θ₂=${theta2} → REWRITE（LLM重写）`
  }

  console.log(`[CAS] 口语化评分: C(q)=${score.toFixed(3)} [OOV=${oovRate.toFixed(2)}, DICT=${dictHitRate.toFixed(2)}, INCOMP=${incompleteness.toFixed(2)}] → ${route}`)
  if (dictResult.hitCount > 0) {
    console.log(`[CAS] 口语词命中: [${dictResult.hitWords.join(', ')}]`)
  }

  return {
    score,
    route,
    oovRate,
    dictHitRate,
    incompleteness,
    dictResult,
    detail
  }
}

/**
 * 对查询执行 CAS 预处理（根据路由结果决定是否做词典替换）
 * 
 * 注意：REWRITE 路径的实际 LLM 重写由外部调用方执行，
 * 本函数只负责 FAST 和 DICT 路径的处理。
 * 
 * @param {string} query - 原始查询
 * @returns {{ processedQuery: string, casResult: object }}
 */
function preprocessQuery(query) {
  const casResult = classifyColloquialism(query)

  let processedQuery = query

  if (casResult.route === 'DICT' || casResult.route === 'REWRITE') {
    // DICT 和 REWRITE 路径都先做词典预处理
    processedQuery = casResult.dictResult.replacedQuery
    if (processedQuery !== query) {
      console.log(`[CAS] 词典预处理: "${query}" → "${processedQuery}"`)
    }
  }
  // FAST 路径不做任何预处理

  return { processedQuery, casResult }
}

module.exports = {
  CAS_CONFIG,
  classifyColloquialism,
  preprocessQuery,
  calcCompleteness
}
