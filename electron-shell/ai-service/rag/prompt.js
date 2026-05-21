/**
 * Prompt 模块 - 分离 System Prompt 与 User Prompt
 * 
 * 核心设计（主流 RAG 做法）：
 * - System Prompt：固定的角色定义 + 硬约束 → 通过 Ollama 的 system 参数传入
 *   Ollama 会缓存 system prompt 的 KV cache，后续请求不再重复计算（关键提速点）
 * - User Prompt：动态的检索上下文 + 用户问题 → 通过 prompt 参数传入
 *   每次只需 eval 这部分，内容越短首字越快
 */

// 固定的 System Prompt - Ollama 会对其进行 KV cache 缓存
// 首次请求后，后续相同 system prompt 的请求直接复用缓存，跳过 eval
const SYSTEM_PROMPT = `你是一位专门指导车间生产的AI工艺助理。

【回答约束】
1. 请只回答与工业制造、工艺规程、生产操作相关的问题。
2. 对于与工业完全无关的问题（如历史、娱乐等），请礼貌拒绝。
3. 请直接回答用户的核心问题，不要说诸如“我是工艺专用助手...”之类的长篇套话，要简洁专业。
4. 优先使用 <context> 标签内系统提供的工艺数据或概览进行解答。
5. 如果 <context> 中包含了 <process_summary>，请根据它直接做概览性回答。`

/**
 * 构建 User Prompt（仅包含动态部分：检索上下文 + 用户问题）
 * 不包含角色定义，角色定义通过 SYSTEM_PROMPT 在 Ollama 的 system 参数中传入
 * 
 * @param {string} question 用户问题
 * @param {Array} docs 关键词匹配到的静态知识库文档列表
 * @param {Array} retrievedChunks 向量检索到的相关工艺片段列表
 * @returns {string} 拼装后的 user prompt
 */
function buildUserPrompt(question, docs, retrievedChunks, processSummary = null) {
    let context = '<context>\n'

    // 如果有工艺库的整体概览，注入进来
    if (processSummary) {
        context += `<process_summary>\n${processSummary}\n</process_summary>\n`
    }

    let hasData = false;
    let dataStr = '<retrieved_data>\n';

    // 静态知识库上下文
    if (docs && docs.length > 0) {
        hasData = true;
        docs.forEach((doc, index) => {
            dataStr += `[静态知识 ${index + 1}] (${doc.part || '未知'}, ${doc.procedure || '未知'}): ${doc.content}\n`
        })
    }

    // 向量/图谱/BM25 检索到的工艺片段
    if (retrievedChunks && retrievedChunks.length > 0) {
        hasData = true;
        retrievedChunks.forEach((chunk, idx) => {
            dataStr += `[检索记录 ${idx + 1}] ${chunk.text}\n\n`
        })
    }

    dataStr += '</retrieved_data>\n';

    if (hasData) {
        context += dataStr;
    }
    
    context += '</context>\n'

    // 如果完全没有上下文（既没概览也没数据），就不加 context 标签
    if (!processSummary && !hasData) {
        context = '';
    }

    return `${context}\n<question>${question}</question>`
}

const NODE_ANALYSIS_PROMPT = `你是一位专门指导车间生产的AI工艺知识专家。
你的任务是对当前工艺节点进行结构化分析，并且**只输出纯 JSON 格式**，不要包含任何 Markdown 标记（如 \`\`\`json 等）或其他多余的文本说明。

请根据以下提供的节点信息，分析并输出对应 JSON。如果某项没有相关信息，请输出空数组 []。

要求的 JSON 格式如下：
{
  "summary": "一句话总结该节点核心目标",
  "keyPoints": ["操作要点1", "操作要点2"],
  "risks": [
    { "level": "high", "desc": "高风险描述" },
    { "level": "medium", "desc": "中风险描述" },
    { "level": "low", "desc": "低风险描述" }
  ],
  "params": [
    { "name": "参数名", "recommend": "推荐值", "range": "范围" }
  ],
  "checklist": ["检查项1", "检查项2"],
  "faq": [
    { "q": "常见问题1", "a": "答案1" }
  ],
  "suggestions": ["追问建议1", "追问建议2"]
}`;

function buildNodeAnalysisPrompt(nodeName, nodeType, processName) {
    return `${NODE_ANALYSIS_PROMPT}

当前节点信息：
- 所属工艺：${processName || '未知'}
- 节点类型：${nodeType || '节点'}
- 节点名称：${nodeName || '未命名'}

请输出 JSON：`;
}

const QUALITY_CHECK_PROMPT = `你是一位专门指导车间生产的AI质量诊断专家。
你的任务是根据用户提供的质量缺陷或现象进行诊断，并且**只输出纯 JSON 格式**，不要包含任何 Markdown 标记（如 \`\`\`json 等）或其他多余的文本说明。

要求的 JSON 格式如下：
{
  "diagnosis": "一句话的诊断结论",
  "possibleCauses": ["可能的原因1", "可能的原因2"],
  "solutions": ["解决方案1", "解决方案2"],
  "preventionTips": ["预防措施1", "预防措施2"]
}`;

function buildQualityCheckPrompt(symptom, nodeName, nodeType) {
    return `${QUALITY_CHECK_PROMPT}

当前节点信息：
- 节点类型：${nodeType || '节点'}
- 节点名称：${nodeName || '未命名'}

用户描述的现象：
${symptom}

请输出 JSON：`;
}

module.exports = {
    SYSTEM_PROMPT,
    buildUserPrompt,
    NODE_ANALYSIS_PROMPT,
    QUALITY_CHECK_PROMPT,
    buildNodeAnalysisPrompt,
    buildQualityCheckPrompt
}
