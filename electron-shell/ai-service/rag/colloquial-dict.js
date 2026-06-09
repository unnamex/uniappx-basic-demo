/**
 * 工艺领域口语-术语映射词典（Colloquial-Term Dictionary）
 * 
 * 论文创新点支撑模块：
 * 1. 为 CAS（口语化程度自适应路由）提供口语词命中率计算
 * 2. 为 L1/L2 级口语查询提供快速词典预处理（无需调用LLM）
 * 3. 工艺术语集合用于计算查询中的 OOV（Out-Of-Vocabulary）率
 */

// ========== 口语词 → 标准工艺术语映射 ==========
// 分类整理，便于后续扩展和论文中展示
const COLLOQUIAL_MAP = {
  // --- 切削加工相关 ---
  '烫': '过热',
  '烧刀': '刀具热磨损',
  '刀老是烫': '刀具热积累过热',
  '吃刀': '切削深度',
  '走量': '进给量',
  '走刀': '进给运动',
  '转速': '主轴转速',
  '刀钝了': '刀具磨损',
  '换刀': '刀具更换',
  '打刀': '崩刃',
  '啃刀': '切削振动',
  '扎刀': '扎入切削',
  '让刀': '让刀变形',
  '跑偏': '加工偏差',

  // --- 热处理相关 ---
  '烧了': '过热变形',
  '退火': '退火处理',
  '淬火': '淬火处理',
  '回火': '回火处理',
  '变形了': '热变形',

  // --- 装配相关 ---
  '拧紧': '紧固操作',
  '拧不动': '紧固力矩过大',
  '装不上': '配合干涉',
  '松了': '连接松动',
  '对不齐': '装配偏差',
  '卡住了': '配合卡滞',
  '间隙大': '配合间隙超差',

  // --- 测量检验相关 ---
  '量一下': '尺寸测量',
  '超差': '超出公差范围',
  '不合格': '检验不合格',
  '粗糙': '表面粗糙度不达标',

  // --- 口语化代词/简称 ---
  '那个料': '该材料',
  '这个料': '该材料',
  '那个件': '该工件',
  '这个件': '该工件',
  '搞几遍': '重复次数',
  '弄几下': '重复次数',
  '做几次': '重复次数',
  '咋整': '如何处理',
  '咋办': '如何处理',
  '咋弄': '如何操作',
  '啥意思': '含义说明',
  '干啥': '操作目的',
  '为啥': '原因分析',
  '多少度': '温度参数',
  '多大力': '力矩/力参数',
  '多长时间': '时间参数',
  '多快': '速度参数',
}

// ========== 工艺领域核心术语集合 ==========
// 用于计算查询中的 OOV（非术语词）占比
// 如果查询中的分词大部分不在这个集合中，则口语化程度高
const DOMAIN_TERMS = new Set([
  // 基础工艺术语
  '工艺', '工序', '工步', '动作', '工艺路线', '工艺规程',
  '加工', '切削', '铣削', '车削', '钻削', '磨削', '刨削', '镗削',
  '热处理', '退火', '淬火', '回火', '正火', '固溶', '时效',
  '装配', '安装', '紧固', '焊接', '铆接', '粘接',
  '检验', '测量', '检测', '校准',

  // 参数术语
  '切削速度', '进给量', '切削深度', '主轴转速', '进给速度',
  '温度', '压力', '力矩', '扭矩', '公差', '精度',
  '粗糙度', '表面粗糙度', '尺寸精度', '形位公差',

  // 材料术语
  'TC4', '钛合金', '不锈钢', '304', '铝合金', '高温合金',
  '碳钢', '合金钢', '铸铁', '铜合金',

  // 设备工具术语
  '刀具', '夹具', '量具', '机床', '车床', '铣床', '磨床',
  '数控', 'CNC', '涂层刀具', '硬质合金', '高速钢',
  '切削液', '冷却液', '润滑',

  // 质量术语
  '变形', '裂纹', '气孔', '夹渣', '磨损', '腐蚀',
  '残余应力', '硬度', '强度', '塑性', '韧性', '疲劳',

  // V8发动机装配相关
  '发动机', '缸体', '缸盖', '活塞', '连杆', '曲轴',
  '凸轮轴', '气门', '油封', '密封垫', '螺栓', '螺母',
])

/**
 * 在查询中查找并统计口语词命中情况
 * @param {string} query - 用户原始查询
 * @returns {{ hitCount: number, hitWords: string[], replacedQuery: string }}
 */
function matchColloquial(query) {
  if (!query) return { hitCount: 0, hitWords: [], replacedQuery: query }

  let replaced = query
  const hitWords = []

  // 按词长度降序匹配，避免短词误替换长词子串
  const sortedEntries = Object.entries(COLLOQUIAL_MAP)
    .sort((a, b) => b[0].length - a[0].length)

  for (const [colloquial, formal] of sortedEntries) {
    if (replaced.includes(colloquial)) {
      hitWords.push(colloquial)
      replaced = replaced.replace(new RegExp(escapeRegex(colloquial), 'g'), formal)
    }
  }

  return {
    hitCount: hitWords.length,
    hitWords,
    replacedQuery: replaced
  }
}

/**
 * 计算查询中的领域术语覆盖率
 * @param {string} query - 用户查询
 * @returns {{ totalTokens: number, domainHits: number, oovRate: number }}
 */
function calcDomainCoverage(query) {
  if (!query) return { totalTokens: 0, domainHits: 0, oovRate: 1.0 }

  // 简单分词：按标点、空格切分，取长度>=2的中文词
  const tokens = query
    .replace(/[，。？！、；：""''（）\[\]{},.;:!?()\s]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 2)

  if (tokens.length === 0) return { totalTokens: 0, domainHits: 0, oovRate: 1.0 }

  let domainHits = 0
  for (const token of tokens) {
    // 检查token是否被任一领域术语包含，或token包含任一领域术语
    for (const term of DOMAIN_TERMS) {
      if (token.includes(term) || term.includes(token)) {
        domainHits++
        break
      }
    }
  }

  const oovRate = 1 - (domainHits / tokens.length)
  return { totalTokens: tokens.length, domainHits, oovRate }
}

// 正则转义工具
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  COLLOQUIAL_MAP,
  DOMAIN_TERMS,
  matchColloquial,
  calcDomainCoverage
}
