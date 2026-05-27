const fs = require('fs')
const path = require('path')
const INDEX_FILE = path.join(__dirname, '..', 'graph-index.json')

/**
 * 构建工艺知识图谱索引
 * 将工序及其挂载的工步、资源打平成一棵精准的文本树，供实体查询注入
 * @param {object} processContext - 从 IndexedDB 提取的完整工艺数据
 * @returns {object} 生成的图谱索引
 */

// 清除 HTML 标签，提取纯文本
function cleanHtml(html) {
  if (!html) return '';
  // 移除 style 标签及其内容
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // 移除所有 HTML 标签
  text = text.replace(/<[^>]+>/g, ' ');
  // 合并多个空格和换行
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function buildGraphIndex(processContext) {
  const resourceMap = {} // nodeId -> [resources]
  if (processContext.resources) {
    processContext.resources.forEach(r => {
      if (!resourceMap[r.node_id]) resourceMap[r.node_id] = []
      resourceMap[r.node_id].push(r)
    })
  }

  const stepMap = {} // operationId -> [steps]
  if (processContext.steps) {
    processContext.steps.forEach(s => {
      if (!stepMap[s.operation_id]) stepMap[s.operation_id] = []
      stepMap[s.operation_id].push(s)
    })
  }

  const actionMap = {} // stepId -> [actions]
  if (processContext.actions) {
    processContext.actions.forEach(a => {
      if (!actionMap[a.step_id]) actionMap[a.step_id] = []
      actionMap[a.step_id].push(a)
    })
  }

  const operations = processContext.operations || []
  const graphEntities = []

  operations.forEach(op => {
    let contextStr = `工序: ${op.name}`
    if (op.code) contextStr += ` (编号: ${op.code})`
    if (op.content) contextStr += `\n加工内容: ${cleanHtml(op.content)}`

    // 挂载工序级资源
    const opRes = resourceMap[op.inner_id]
    if (opRes && opRes.length > 0) {
      contextStr += `\n此工序挂载了以下资源附件:`
      opRes.forEach(r => {
        contextStr += `\n  - [${r.type}] ${r.name} ${r.description ? '(' + r.description + ')' : ''}`
      })
    }

    // 挂载下属工步及工步级资源
    const childSteps = stepMap[op.inner_id]
    if (childSteps && childSteps.length > 0) {
      contextStr += `\n此工序包含以下工步:`
      childSteps.forEach((s, idx) => {
        contextStr += `\n  ${idx + 1}. ${s.name}: ${cleanHtml(s.content || '')}`
        if (s.note) contextStr += ` (备注: ${cleanHtml(s.note)})`
        // 挂载下属动作
        const childActions = actionMap[s.inner_id]
        if (childActions && childActions.length > 0) {
          childActions.forEach((a, aIdx) => {
             contextStr += `\n     └─ 动作${aIdx + 1}: ${a.name} ${cleanHtml(a.content || '')}`
             if (a.note) contextStr += ` (备注: ${cleanHtml(a.note)})`
          })
        }

        // 挂载工步级资源
        if (s.inner_id) {
          const stepRes = resourceMap[s.inner_id]
          if (stepRes && stepRes.length > 0) {
            stepRes.forEach(r => {
              contextStr += `\n     └─ 附件资源: [${r.type}] ${r.name}`
            })
          }
        }
      })
    }

    if (op.name) {
      graphEntities.push({
        keyword: op.name,     // 实体名，用于精准匹配（如"附件安装"）
        type: 'operation_tree',
        context: contextStr
      })
    }
  })

  // 我们将“工步”也作为独立的图谱查询节点，以防用户直接查询某个工步（如：活塞安装）
  const steps = processContext.steps || []
  steps.forEach(s => {
    let contextStr = `工步名称: ${s.name}`
    if (s.code) contextStr += ` (编号: ${s.code})`
    if (s.content) contextStr += `\n操作说明: ${cleanHtml(s.content)}`
    if (s.note) contextStr += `\n备注: ${cleanHtml(s.note)}`

    // 挂载下属动作
    const childActions = actionMap[s.inner_id]
    if (childActions && childActions.length > 0) {
      contextStr += `\n此工步包含以下具体操作动作:`
      childActions.forEach((a, aIdx) => {
         contextStr += `\n  ${aIdx + 1}. ${a.name}: ${cleanHtml(a.content || '')}`
         if (a.note) contextStr += ` (备注: ${cleanHtml(a.note)})`
         
         // 动作级也可以挂载资源
         if (a.inner_id) {
           const actionRes = resourceMap[a.inner_id]
           if (actionRes && actionRes.length > 0) {
             actionRes.forEach(r => {
               contextStr += `\n     └─ 附件资源: [${r.type}] ${r.name}`
             })
           }
         }
      })
    }

    if (s.inner_id) {
      const stepRes = resourceMap[s.inner_id]
      if (stepRes && stepRes.length > 0) {
        contextStr += `\n此工步包含资源附件:`
        stepRes.forEach(r => {
          contextStr += `\n  - [${r.type}] ${r.name} ${r.description ? '(' + r.description + ')' : ''}`
        })
      }
    }

    if (s.name) {
      graphEntities.push({
        keyword: s.name,
        type: 'step_tree',
        context: contextStr
      })
    }
  })

  // 最细粒度：动作也作为图谱节点
  const actions = processContext.actions || []
  actions.forEach(a => {
    let contextStr = `操作动作: ${a.name}`
    if (a.code) contextStr += ` (编号: ${a.code})`
    if (a.content) contextStr += `\n具体要求: ${cleanHtml(a.content)}`
    if (a.note) contextStr += `\n备注: ${cleanHtml(a.note)}`

    if (a.inner_id) {
      const actionRes = resourceMap[a.inner_id]
      if (actionRes && actionRes.length > 0) {
        contextStr += `\n此动作使用资源附件:`
        actionRes.forEach(r => {
          contextStr += `\n  - [${r.type}] ${r.name} ${r.description ? '(' + r.description + ')' : ''}`
        })
      }
    }

    if (a.name) {
      graphEntities.push({
        keyword: a.name,
        type: 'action_tree',
        context: contextStr
      })
    }
  })

  // 同时，我们将“工艺”本身也作为一个图谱节点
  const processes = processContext.processes || []
  processes.forEach(p => {
    let contextStr = `工艺名称: ${p.name}`
    if (p.code) contextStr += ` (编号: ${p.code})`
    if (p.partName) contextStr += `\n生产零件: ${p.partName} (${p.partCode || ''})`
    if (p.routeContent) contextStr += `\n工艺路线: ${cleanHtml(p.routeContent)}`
    
    // 找出该工艺下的工序名称列表
    const pOps = operations.filter(o => o.process_id === p.inner_id)
    if (pOps.length > 0) {
      contextStr += `\n包含以下工序:`
      pOps.forEach((o, idx) => {
         contextStr += `\n  ${idx + 1}. ${o.name}`
      })
    }

    if (p.name) {
      graphEntities.push({
        keyword: p.name,
        type: 'process_tree',
        context: contextStr
      })
    }
  })

  const indexData = {
    version: 1,
    createdAt: new Date().toISOString(),
    entityCount: graphEntities.length,
    entities: graphEntities
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData), 'utf-8')
  console.log(`[Graph Builder] 图谱索引构建完成，包含 ${graphEntities.length} 个核心实体节点`)
  return indexData
}

function loadGraphIndex() {
  if (!fs.existsSync(INDEX_FILE)) return null
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[Graph Builder] 加载图谱索引失败:', e.message)
    return null
  }
}

/**
 * 根据图谱生成当前工艺库的全量摘要
 * 用于概览类意图的兜底响应
 */
function buildProcessSummary(graphIndex) {
  if (!graphIndex || !graphIndex.entities || graphIndex.entities.length === 0) {
    return '当前系统尚未加载任何工艺数据。';
  }

  const processes = graphIndex.entities.filter(e => e.type === 'process_tree');
  if (processes.length === 0) {
    return '工艺库中暂无完整的工艺记录。';
  }

  let summary = `【工艺库全局概览】\n当前系统共包含 ${processes.length} 个工艺：\n\n`;
  processes.forEach((p, idx) => {
    summary += `[工艺 ${idx + 1}]\n${p.context}\n\n`;
  });

  return summary.trim();
}

module.exports = {
  buildGraphIndex,
  loadGraphIndex,
  buildProcessSummary
}
