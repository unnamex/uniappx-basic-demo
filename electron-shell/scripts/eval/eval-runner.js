/**
 * 消融实验评测运行器 v2
 * 
 * 直接调用 CAS、searchSimilar（含 H2R + JCS），
 * 统计 Recall@5、JCS 拦截率和响应延迟
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
const { searchSimilar } = require('../../ai-service/rag/vector-search')

const DATASET_FILE = path.join(__dirname, 'eval-dataset.json')
const RESULTS_FILE = path.join(__dirname, 'eval-results.csv')
const SUMMARY_FILE = path.join(__dirname, 'eval-summary.json')

const profile = {
  rag: { topK: 5, contextTruncate: 3000, vectorTimeout: 5000 }
}

async function runEvaluation() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║        消融实验评测运行器 v2                    ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  const dataset = JSON.parse(fs.readFileSync(DATASET_FILE, 'utf-8'))
  const results = []

  // 按类型分组统计
  const stats = {
    synth: { total: 0, r1Hit: 0, r5Hit: 0, totalLatency: 0 },
    real:  { total: 0, r1Hit: 0, r5Hit: 0, totalLatency: 0 },
    oos:   { total: 0, intercepted: 0, totalLatency: 0 },
    casRoutes: { FAST: 0, DICT: 0, REWRITE: 0 }
  }

  const testItems = dataset.filter(d => !d.query.includes('[请人工填入'))
  console.log(`共加载 ${dataset.length} 条数据，实际测试 ${testItems.length} 条（跳过未填写的留白题）\n`)
  console.log('─'.repeat(90))

  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i]
    const startTime = Date.now()

    // 1. CAS 预处理
    const { processedQuery, casResult } = preprocessQuery(item.query)
    stats.casRoutes[casResult.route] = (stats.casRoutes[casResult.route] || 0) + 1

    // 2. 向量检索（含 H2R + JCS）
    let retrievedChunks = []
    let jcsReliable = true
    let jcsScore = 0
    try {
      const searchRes = await searchSimilar(
        processedQuery,
        profile.rag.topK,
        profile.rag.contextTruncate,
        profile
      )
      retrievedChunks = searchRes.results || []
      jcsReliable = searchRes.jcsReliable !== false
      jcsScore = searchRes.jcsScore || 0
    } catch (e) {
      // 静默
    }

    const latency = Date.now() - startTime
    const isIntercepted = !jcsReliable

    let statusStr = ''
    let r1 = 0, r5 = 0

    if (item.expected_action === 'intercept') {
      // 越界题
      stats.oos.total++
      stats.oos.totalLatency += latency
      if (isIntercepted) {
        stats.oos.intercepted++
        statusStr = '✓ 拦截成功'
      } else {
        statusStr = '✗ 漏拦截'
      }
    } else {
      // 工艺题：Recall 评估
      const keywords = item.ground_truth_keywords || []
      const statKey = item.type === 'colloquial_real' ? 'real' : 'synth'
      stats[statKey].total++
      stats[statKey].totalLatency += latency

      // 检查 Top-1 命中
      if (retrievedChunks.length > 0 && keywords.some(kw => retrievedChunks[0].text && retrievedChunks[0].text.includes(kw))) {
        r1 = 1
      }
      // 检查 Top-5 命中
      for (const chunk of retrievedChunks.slice(0, 5)) {
        if (keywords.some(kw => chunk.text && chunk.text.includes(kw))) {
          r5 = 1
          break
        }
      }
      stats[statKey].r1Hit += r1
      stats[statKey].r5Hit += r5
      statusStr = r5 ? `✓ R@5命中 (R@1=${r1})` : '✗ 未命中'
    }

    // 简洁输出
    const shortQuery = item.query.length > 25 ? item.query.substring(0, 25) + '...' : item.query
    console.log(`[${String(i+1).padStart(3)}] ${shortQuery.padEnd(30)} | ${String(latency).padStart(4)}ms | ${casResult.route.padEnd(7)} | ${statusStr}`)

    results.push({
      id: item.id,
      query: item.query,
      type: item.type,
      cas_route: casResult.route,
      cas_score: casResult.score,
      jcs_score: jcsScore,
      latency_ms: latency,
      is_intercepted: isIntercepted,
      recall_r1: r1,
      recall_r5: r5,
      chunks_count: retrievedChunks.length
    })
  }

  console.log('─'.repeat(90))

  // ===== 结果汇总 =====
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║               实验结果汇总                      ║')
  console.log('╠══════════════════════════════════════════════════╣')

  const totalTestCount = stats.synth.total + stats.real.total + stats.oos.total
  const totalLatency = stats.synth.totalLatency + stats.real.totalLatency + stats.oos.totalLatency

  console.log(`║ 总测试数:  ${totalTestCount} 条`)
  console.log(`║ 平均延迟:  ${(totalLatency / totalTestCount).toFixed(2)} ms`)
  console.log('║')

  if (stats.synth.total > 0) {
    console.log(`║ [合成工艺题] Recall@1: ${((stats.synth.r1Hit / stats.synth.total) * 100).toFixed(1)}%  (${stats.synth.r1Hit}/${stats.synth.total})`)
    console.log(`║ [合成工艺题] Recall@5: ${((stats.synth.r5Hit / stats.synth.total) * 100).toFixed(1)}%  (${stats.synth.r5Hit}/${stats.synth.total})`)
    console.log(`║ [合成工艺题] 平均延迟: ${(stats.synth.totalLatency / stats.synth.total).toFixed(2)} ms`)
  }
  if (stats.real.total > 0) {
    console.log(`║ [人工真题]   Recall@1: ${((stats.real.r1Hit / stats.real.total) * 100).toFixed(1)}%  (${stats.real.r1Hit}/${stats.real.total})`)
    console.log(`║ [人工真题]   Recall@5: ${((stats.real.r5Hit / stats.real.total) * 100).toFixed(1)}%  (${stats.real.r5Hit}/${stats.real.total})`)
  }
  if (stats.oos.total > 0) {
    console.log(`║ [越界拦截]   拦截率:   ${((stats.oos.intercepted / stats.oos.total) * 100).toFixed(1)}%  (${stats.oos.intercepted}/${stats.oos.total})`)
    console.log(`║ [越界拦截]   平均延迟: ${(stats.oos.totalLatency / stats.oos.total).toFixed(2)} ms`)
  }
  console.log('║')
  console.log(`║ CAS 路由分布: FAST=${stats.casRoutes.FAST || 0}  DICT=${stats.casRoutes.DICT || 0}  REWRITE=${stats.casRoutes.REWRITE || 0}`)
  console.log('╚══════════════════════════════════════════════════╝')

  // 保存 CSV
  const csvHeader = 'ID,Query,Type,CAS_Route,CAS_Score,JCS_Score,Latency_ms,Intercepted,R@1,R@5,ChunkCount\n'
  const csvRows = results.map(r =>
    `${r.id},"${r.query.replace(/"/g, '""')}",${r.type},${r.cas_route},${r.cas_score.toFixed(3)},${r.jcs_score.toFixed(3)},${r.latency_ms},${r.is_intercepted},${r.recall_r1},${r.recall_r5},${r.chunks_count}`
  ).join('\n')
  fs.writeFileSync(RESULTS_FILE, csvHeader + csvRows, 'utf-8')

  // 保存 JSON 汇总
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify({ stats, totalTestCount, avgLatency: totalLatency / totalTestCount }, null, 2), 'utf-8')

  console.log(`\n详细数据: ${RESULTS_FILE}`)
  console.log(`汇总数据: ${SUMMARY_FILE}`)

  // 清理 mock 文件
  if (fs.existsSync(mockElectronPath)) fs.unlinkSync(mockElectronPath)
}

runEvaluation()
