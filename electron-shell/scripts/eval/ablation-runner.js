/**
 * 消融实验运行器 (Ablation Study Runner)
 * 
 * 4 组实验配置：
 *   A. Baseline  — 无 CAS / 无 H2R / 无 JCS（原始扁平检索 + 硬规则拦截）
 *   B. +CAS      — 仅开启口语化路由，检索和拦截沿用旧逻辑
 *   C. +CAS+H2R  — 口语化路由 + 层次检索，拦截沿用旧硬规则
 *   D. Full      — CAS + H2R + JCS 全部启用（完整系统）
 * 
 * 每组跑完同一份 170 条测试集后输出对比表
 */

// ===== Mock Electron =====
const Module = require('module')
const fs = require('fs')
const path = require('path')

const mockElectronPath = path.join(__dirname, 'mock-electron.js')
if (!fs.existsSync(mockElectronPath)) {
  fs.writeFileSync(mockElectronPath, `
module.exports = {
  app: {
    isPackaged: false,
    getPath: (name) => require('path').join(__dirname, '..', '..'),
    getAppPath: () => require('path').join(__dirname, '..', '..')
  }
}
`)
}

const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'electron') {
    return require.resolve('./mock-electron.js')
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

const { preprocessQuery } = require('../../ai-service/rag/query-classifier')
const { searchSimilar, clearCache } = require('../../ai-service/rag/vector-search')

const DATASET_FILE = path.join(__dirname, 'eval-dataset.json')
const ABLATION_CSV = path.join(__dirname, 'ablation-results.csv')
const ABLATION_SUMMARY = path.join(__dirname, 'ablation-summary.json')

const profile = {
  rag: { topK: 5, contextTruncate: 3000, vectorTimeout: 5000 }
}

// ===== 4 组实验配置 =====
const experiments = [
  {
    name: 'Baseline',
    label: '原始系统(无创新模块)',
    useCAS: false,   // 不做口语化预处理，直接用原始 query
    useH2R: false,   // 关闭层次检索，使用扁平向量检索
    useJCS: false    // 关闭 JCS，使用硬规则（零召回 = 拦截）
  },
  {
    name: '+CAS',
    label: '仅口语化路由',
    useCAS: true,
    useH2R: false,
    useJCS: false
  },
  {
    name: '+CAS+H2R',
    label: '口语化路由+层次检索',
    useCAS: true,
    useH2R: true,
    useJCS: false
  },
  {
    name: 'Full(CAS+H2R+JCS)',
    label: '完整系统',
    useCAS: true,
    useH2R: true,
    useJCS: true
  }
]

async function runSingleExperiment(config, testItems) {
  const stats = {
    synth: { total: 0, r1: 0, r5: 0, latency: 0 },
    real:  { total: 0, r1: 0, r5: 0, latency: 0 },
    oos:   { total: 0, intercepted: 0, latency: 0 },
    routes: { FAST: 0, DICT: 0, REWRITE: 0 }
  }
  const details = []

  for (const item of testItems) {
    const start = Date.now()

    // 清除搜索缓存，保证每组实验独立
    if (typeof clearCache === 'function') clearCache()

    // 1. CAS 预处理（可关闭）
    let queryForSearch = item.query
    let casRoute = 'NONE'
    let casScore = 0

    if (config.useCAS) {
      const { processedQuery, casResult } = preprocessQuery(item.query)
      queryForSearch = processedQuery
      casRoute = casResult.route
      casScore = casResult.score
      stats.routes[casRoute] = (stats.routes[casRoute] || 0) + 1
    }

    // 2. 检索（通过 options 控制 H2R 和 JCS）
    let retrievedChunks = []
    let jcsReliable = true
    let jcsScore = 0
    try {
      const searchRes = await searchSimilar(
        queryForSearch,
        profile.rag.topK,
        profile.rag.contextTruncate,
        profile,
        { useH2R: config.useH2R, useJCS: config.useJCS }
      )
      retrievedChunks = searchRes.results || []
      jcsReliable = searchRes.jcsReliable !== false
      jcsScore = searchRes.jcsScore || 0
    } catch (e) { /* 静默 */ }

    const latency = Date.now() - start
    const isIntercepted = !jcsReliable

    let r1 = 0, r5 = 0

    if (item.expected_action === 'intercept') {
      stats.oos.total++
      stats.oos.latency += latency
      if (isIntercepted) stats.oos.intercepted++
    } else {
      const keywords = item.ground_truth_keywords || []
      const key = item.type === 'colloquial_real' ? 'real' : 'synth'
      stats[key].total++
      stats[key].latency += latency

      if (retrievedChunks.length > 0 && keywords.some(kw => retrievedChunks[0].text?.includes(kw))) r1 = 1
      for (const chunk of retrievedChunks.slice(0, 5)) {
        if (keywords.some(kw => chunk.text?.includes(kw))) { r5 = 1; break }
      }
      stats[key].r1 += r1
      stats[key].r5 += r5
    }

    details.push({
      id: item.id,
      experiment: config.name,
      query: item.query,
      type: item.type,
      cas_route: casRoute,
      latency_ms: latency,
      intercepted: isIntercepted,
      r1, r5,
      chunks: retrievedChunks.length
    })
  }

  return { stats, details }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           消 融 实 验 (Ablation Study)                     ║')
  console.log('║    CAS口语化路由 × H2R层次检索 × JCS联合置信度安全拦截     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  const dataset = JSON.parse(fs.readFileSync(DATASET_FILE, 'utf-8'))
  const testItems = dataset.filter(d => !d.query.includes('[请人工填入'))
  console.log(`数据集: ${dataset.length} 条，实际测试: ${testItems.length} 条\n`)

  const allResults = []
  const summaryRows = []
  let allDetails = []

  for (let i = 0; i < experiments.length; i++) {
    const config = experiments[i]
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`▶ 实验 ${String.fromCharCode(65 + i)}: ${config.name}`)
    console.log(`  配置: CAS=${config.useCAS ? '✓' : '✗'}  H2R=${config.useH2R ? '✓' : '✗'}  JCS=${config.useJCS ? '✓' : '✗'}`)
    console.log(`${'─'.repeat(60)}`)

    const { stats, details } = await runSingleExperiment(config, testItems)
    allDetails = allDetails.concat(details)

    const synthR1 = stats.synth.total > 0 ? (stats.synth.r1 / stats.synth.total * 100).toFixed(1) : '-'
    const synthR5 = stats.synth.total > 0 ? (stats.synth.r5 / stats.synth.total * 100).toFixed(1) : '-'
    const realR1  = stats.real.total > 0  ? (stats.real.r1 / stats.real.total * 100).toFixed(1)   : '-'
    const realR5  = stats.real.total > 0  ? (stats.real.r5 / stats.real.total * 100).toFixed(1)   : '-'
    const oosRate = stats.oos.total > 0   ? (stats.oos.intercepted / stats.oos.total * 100).toFixed(1) : '-'
    const totalTests = stats.synth.total + stats.real.total + stats.oos.total
    const totalLatency = stats.synth.latency + stats.real.latency + stats.oos.latency
    const avgLatency = totalTests > 0 ? (totalLatency / totalTests).toFixed(2) : '-'

    console.log(`  合成题 R@1: ${synthR1}%  R@5: ${synthR5}%`)
    console.log(`  人工题 R@1: ${realR1}%   R@5: ${realR5}%`)
    console.log(`  越界拦截率: ${oosRate}%  (${stats.oos.intercepted}/${stats.oos.total})`)
    console.log(`  平均延迟:   ${avgLatency} ms`)

    summaryRows.push({
      experiment: config.name,
      label: config.label,
      cas: config.useCAS,
      h2r: config.useH2R,
      jcs: config.useJCS,
      synth_r1: synthR1,
      synth_r5: synthR5,
      real_r1: realR1,
      real_r5: realR5,
      oos_rate: oosRate,
      avg_latency: avgLatency,
      cas_routes: config.useCAS ? stats.routes : null
    })
  }

  // ===== 输出最终对比表 =====
  console.log(`\n\n${'═'.repeat(80)}`)
  console.log('                        消 融 实 验 对 比 表')
  console.log(`${'═'.repeat(80)}`)
  console.log(`${'配置'.padEnd(25)} | ${'R@1'.padStart(6)} | ${'R@5'.padStart(6)} | ${'拦截率'.padStart(7)} | ${'延迟(ms)'.padStart(8)}`)
  console.log(`${'─'.repeat(25)}-+-${'─'.repeat(6)}-+-${'─'.repeat(6)}-+-${'─'.repeat(7)}-+-${'─'.repeat(8)}`)

  for (const row of summaryRows) {
    console.log(`${row.experiment.padEnd(25)} | ${(row.synth_r1 + '%').padStart(6)} | ${(row.synth_r5 + '%').padStart(6)} | ${(row.oos_rate + '%').padStart(7)} | ${row.avg_latency.padStart(8)}`)
  }
  console.log(`${'═'.repeat(80)}\n`)

  // 增量分析
  console.log('▎ 增量分析:')
  if (summaryRows.length >= 4) {
    const base = parseFloat(summaryRows[0].synth_r5) || 0
    const cas  = parseFloat(summaryRows[1].synth_r5) || 0
    const h2r  = parseFloat(summaryRows[2].synth_r5) || 0
    const full = parseFloat(summaryRows[3].synth_r5) || 0

    console.log(`  CAS 口语化路由贡献:     R@5 ${base.toFixed(1)}% → ${cas.toFixed(1)}%  (+${(cas - base).toFixed(1)}pp)`)
    console.log(`  H2R 层次检索贡献:       R@5 ${cas.toFixed(1)}% → ${h2r.toFixed(1)}%  (+${(h2r - cas).toFixed(1)}pp)`)
    console.log(`  JCS 联合置信度贡献:     R@5 ${h2r.toFixed(1)}% → ${full.toFixed(1)}%  (+${(full - h2r).toFixed(1)}pp)`)
    
    const baseOos = parseFloat(summaryRows[0].oos_rate) || 0
    const fullOos = parseFloat(summaryRows[3].oos_rate) || 0
    console.log(`  安全拦截率提升:         ${baseOos.toFixed(1)}% → ${fullOos.toFixed(1)}%  (+${(fullOos - baseOos).toFixed(1)}pp)`)
  }

  // 保存 CSV 明细
  const header = 'Experiment,ID,Query,Type,CAS_Route,Latency_ms,Intercepted,R@1,R@5,Chunks\n'
  const rows = allDetails.map(d =>
    `${d.experiment},${d.id},"${d.query.replace(/"/g, '""')}",${d.type},${d.cas_route},${d.latency_ms},${d.intercepted},${d.r1},${d.r5},${d.chunks}`
  ).join('\n')
  fs.writeFileSync(ABLATION_CSV, header + rows, 'utf-8')

  // 保存 JSON 汇总
  fs.writeFileSync(ABLATION_SUMMARY, JSON.stringify(summaryRows, null, 2), 'utf-8')

  console.log(`\n逐条明细: ${ABLATION_CSV}`)
  console.log(`汇总数据: ${ABLATION_SUMMARY}`)

  // 清理
  if (fs.existsSync(mockElectronPath)) fs.unlinkSync(mockElectronPath)
}

main().catch(err => {
  console.error('消融实验失败:', err)
  process.exit(1)
})
