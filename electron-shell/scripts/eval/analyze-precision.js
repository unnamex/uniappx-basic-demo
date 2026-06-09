const fs = require('fs')
const path = require('path')

const csvPath = path.join(__dirname, 'ablation-results.csv')
const lines = fs.readFileSync(csvPath, 'utf-8').split('\n')
const header = lines[0].split(',')
const rows = []

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  // 解析 CSV（query 字段含引号，需特殊处理）
  const parts = []
  let inQuote = false
  let cell = ''
  for (const ch of lines[i]) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { parts.push(cell); cell = '' }
    else { cell += ch }
  }
  parts.push(cell)

  rows.push({
    exp: parts[0],
    id: parts[1],
    query: parts[2],
    type: parts[3],
    cas_route: parts[4],
    latency: +parts[5],
    intercepted: parts[6] === 'true',
    r1: +parts[7],
    r5: +parts[8],
    chunks: +parts[9]
  })
}

console.log('=== 消融实验 — 完整精准度分析 ===\n')

const experiments = ['Baseline', '+CAS', '+CAS+H2R', 'Full(CAS+H2R+JCS)']

for (const exp of experiments) {
  const synth = rows.filter(r => r.exp === exp && r.type === 'colloquial_synth')
  const oos   = rows.filter(r => r.exp === exp && r.type === 'out_of_scope')

  // 全量 Recall（含被拦截的，计为未命中）
  const allR5 = synth.filter(r => r.r5 === 1).length

  // 仅计算放行查询的精准度（Precision among answered）
  const answered = synth.filter(r => !r.intercepted)
  const answeredR1 = answered.filter(r => r.r1 === 1).length
  const answeredR5 = answered.filter(r => r.r5 === 1).length

  // 拦截率
  const intercepted = oos.filter(r => r.intercepted).length

  // 平均延迟
  const avgLatency = (synth.reduce((s, r) => s + r.latency, 0) / synth.length).toFixed(2)

  console.log(`【${exp}】`)
  console.log(`  全量 R@5 (含拦截):     ${(allR5/synth.length*100).toFixed(1)}%`)
  console.log(`  放行率:                 ${(answered.length/synth.length*100).toFixed(1)}%  (${answered.length}/${synth.length})`)
  if (answered.length > 0) {
    console.log(`  精准 R@1 (仅放行):     ${(answeredR1/answered.length*100).toFixed(1)}%  (${answeredR1}/${answered.length})`)
    console.log(`  精准 R@5 (仅放行):     ${(answeredR5/answered.length*100).toFixed(1)}%  (${answeredR5}/${answered.length})`)
  }
  console.log(`  JCS 安全拦截率:         ${(intercepted/oos.length*100).toFixed(1)}%  (${intercepted}/${oos.length})`)
  console.log(`  平均延迟:               ${avgLatency} ms`)
  console.log()
}

// 最终对比表（论文用）
console.log('─'.repeat(80))
console.log('           ★ 论文用最终数据表 ★')
console.log('─'.repeat(80))
console.log('配置              | 全量R@5 | 精准R@5* | 拦截率  | 延迟(ms)')
console.log('─'.repeat(80))

for (const exp of experiments) {
  const synth = rows.filter(r => r.exp === exp && r.type === 'colloquial_synth')
  const oos   = rows.filter(r => r.exp === exp && r.type === 'out_of_scope')
  const allR5 = (synth.filter(r => r.r5 === 1).length / synth.length * 100).toFixed(1)
  const answered = synth.filter(r => !r.intercepted)
  const precR5 = answered.length > 0
    ? (answered.filter(r => r.r5 === 1).length / answered.length * 100).toFixed(1)
    : '-'
  const interceptRate = (oos.filter(r => r.intercepted).length / oos.length * 100).toFixed(1)
  const avgLatency = (synth.reduce((s, r) => s + r.latency, 0) / synth.length).toFixed(2)
  console.log(`${exp.padEnd(18)}| ${(allR5+'%').padStart(7)} | ${(precR5+'%').padStart(8)} | ${(interceptRate+'%').padStart(7)} | ${avgLatency.padStart(8)}`)
}
console.log('─'.repeat(80))
console.log('* 精准R@5：仅统计 JCS 放行（系统确信有答案）的查询中 Top-5 命中率')
