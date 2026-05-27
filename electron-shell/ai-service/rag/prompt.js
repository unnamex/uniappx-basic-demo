const { compressText, deduplicateChunks } = require('./compress');

// 固定的 System Prompt - Ollama 会对其进行 KV cache 缓存
function getSystemPrompt(tier) {
    if (tier === 'lite') {
        // 1.5B 需要极强的约束，防止幻觉，特别强调生产安全
        return `你是车间工艺AI助理。车间生产安全第一！你必须绝对忠于<context>中的数据。如果上下文中没有明确答案，请直接回复“当前工艺库中未找到相关数据”，严禁编造任何工艺参数或操作步骤，避免安全事故。无关问题一律拒绝。禁止在回答中提及“参考文档”、“静态知识”、“检索记录”等系统内部词汇，请直接给出解答。`
    }
    if (tier === 'pro') {
        // 7B 推理能力最强，允许一定发散分析
        return `你是资深车间工艺领域专家AI。你将依据<context>中的数据进行专业、准确且深入的解答。在保证数据严谨准确的前提下，利用你强大的推理能力进行深入的关联分析，并提供极具专业洞见和操作指导的建议。无关问题礼貌拒绝。禁止在回答中提及“参考文档”、“静态知识”、“检索记录”等系统内部词汇，请直接给出解答。`
    }
    // 3B 理解力更强，在确保准确的基础上可以进行专业解答
    return `你是车间工艺AI助理。你将依据<context>中的数据进行专业、准确的解答。在保证数据严谨准确（不编造参数）的前提下，可以给出详尽的分析。无关问题礼貌拒绝。禁止在回答中提及“参考文档”、“静态知识”、“检索记录”等系统内部词汇，请直接给出解答。`
}

/**
 * 构建 User Prompt（仅包含动态部分：检索上下文 + 用户问题）
 * 
 * @param {string} question 用户问题
 * @param {Array} docs 关键词匹配到的静态知识库文档列表
 * @param {Array} retrievedChunks 向量检索到的相关工艺片段列表
 * @param {string} processSummary 工艺整体概览
 * @param {Object} profile 模型配置
 * @returns {string} 拼装后的 user prompt
 */
function buildUserPrompt(question, docs, retrievedChunks, processSummary = null, profile = null) {
    let context = '<context>\n'
    // 根据模型动态调整上下文截断长度
    const MAX_CONTEXT_CHARS = profile?.rag?.maxContextChars ?? 800;
    let contextLen = 0;

    // 如果有工艺库的整体概览，注入进来
    if (processSummary) {
        const trimmedSummary = processSummary.substring(0, 300);
        context += `<process_summary>\n${trimmedSummary}\n</process_summary>\n`
        contextLen += trimmedSummary.length;
    }

    let hasData = false;
    let dataStr = '<retrieved_data>\n';

    // 静态知识库上下文
    if (docs && docs.length > 0) {
        hasData = true;
        docs.forEach((doc, index) => {
            const docStr = `[静态知识 ${index + 1}] (${doc.part || '未知'}, ${doc.procedure || '未知'}): ${doc.content}\n`
            if (contextLen + docStr.length <= MAX_CONTEXT_CHARS) {
                dataStr += docStr;
                contextLen += docStr.length;
            }
        })
    }

    // 向量/图谱/BM25 检索到的工艺片段
    if (retrievedChunks && retrievedChunks.length > 0) {
        hasData = true;
        retrievedChunks.forEach((chunk, idx) => {
            const chunkStr = `[检索记录 ${idx + 1}] ${chunk.text}\n\n`
            if (contextLen + chunkStr.length <= MAX_CONTEXT_CHARS) {
                dataStr += chunkStr;
                contextLen += chunkStr.length;
            }
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

function getNodeAnalysisPrompt(tier) {
    if (tier === 'lite') {
        // 1.5B 简化指令，避免长 prompt 占用过多窗口，同时严格约束幻觉
        return `【最高指令】
分析工艺节点并输出JSON。生产安全第一！绝对不要编造参数或操作！在上下文中未找到明确信息，相关字段必须严格使用空数组[]。

严格按以下JSON格式输出（注意 checklist 只能是纯文本字符串数组），不要输出其他废话：
{
  "summary": "（这里写一句话工艺总结，如果没有则写暂无）",
  "keyPoints": ["（提取的操作要点文字）"],
  "risks": [{"level": "high或medium或low", "desc": "（风险描述）"}],
  "params": [{"name": "（参数名）", "recommend": "（数值）", "range": "（范围）"}],
  "checklist": ["（纯文本检查项一）", "（纯文本检查项二）"],
  "faq": [{"q": "（问题）", "a": "（解答）"}],
  "suggestions": ["（结合当前工艺的具体技术追问，必须包含具体的工艺名词，严禁'加强培训'、'提高效率'、'自动化'等通用套话）"]
}
（再次警告：如果参考资料中没提到某项，该项对应的数组必须写成 [] ）`;
    }

    if (tier === 'pro') {
        // 7B 专家版：输出更深入的见解
        return `【专家指令】
深入分析工艺节点并输出JSON。基于上下文信息进行深度推理，发现潜在风险和深层次逻辑。绝对不编造无依据的参数！上下文中未找到明确信息时相关数组严格填空数组[]。

示例输入: 节点名称=某工艺步骤，节点类型=工步
示例输出:
{"summary":"深入的总结提炼","keyPoints":["核心要点一","核心要点二"],"risks":[{"level":"high","desc":"深层次的风险剖析"}],"params":[{"name":"工艺参数名称","recommend":"推荐数值及单位","range":"允许的范围"}],"checklist":["专业维度的检查事项一"],"faq":[{"q":"高阶的疑难解答？","a":"深度剖析解答"}],"suggestions":["基于当前工艺特性的具体技术优化点或深层次的疑问句，必须包含具体的工艺名词，严禁'定期培训'、'升级设备'、'引入自动化'等放之四海皆准的空泛套话"]}

请严格按上述JSON结构输出。没有明确依据的字段一律用空数组[]。`;
    }

    // 3B 标准版
    return `【最高指令】
分析工艺节点并输出JSON。绝对不要编造参数或操作！如果在上下文中未找到明确的信息，相关字段必须严格使用空数组 [] 或暂无。

示例输入: 节点名称=某工艺步骤，节点类型=工步
示例输出:
{"summary":"该步骤的主要目的或摘要说明","keyPoints":["操作要点一","操作要点二"],"risks":[{"level":"medium","desc":"某种潜在风险的描述"}],"params":[{"name":"某个工艺参数名称","recommend":"推荐数值及单位","range":"允许的范围"}],"checklist":["检查事项一","检查事项二"],"faq":[{"q":"常见问题一？","a":"对应的解答"}],"suggestions":["结合具体工序场景的具体疑问或建议，必须包含具体的工艺名词，拒绝'加强培训'、'规范操作'等空泛的通用套话"]}

严格按上述JSON结构输出。再次强调：没有明确依据的字段一律用空数组[]。`;
}

function buildNodeAnalysisPrompt(nodeName, nodeType, processName, docs = [], retrievedChunks = [], profile = null) {
    // 去重：过滤掉与静态知识高度重叠的向量检索结果，避免浪费 Token
    const uniqueChunks = deduplicateChunks(docs, retrievedChunks);

    let context = '<context>\n'
    let hasData = false;
    let dataStr = '<retrieved_data>\n';
    let originalLen = 0;
    let compressedContentLen = 0;

    if (docs && docs.length > 0) {
        hasData = true;
        docs.forEach((doc, index) => {
            const raw = doc.content || '';
            originalLen += raw.length;
            const compressed = compressText(raw);
            compressedContentLen += compressed.length;
            dataStr += `[静态知识 ${index + 1}] (${doc.part || '未知'}): ${compressed}\n`
        })
    }

    if (uniqueChunks && uniqueChunks.length > 0) {
        hasData = true;
        uniqueChunks.forEach((chunk, idx) => {
            const raw = chunk.text || '';
            originalLen += raw.length;
            const compressed = compressText(raw);
            compressedContentLen += compressed.length;
            dataStr += `[检索记录 ${idx + 1}] ${compressed}\n\n`
        })
    }
    dataStr += '</retrieved_data>\n';
    if (hasData) {
        context += dataStr;
        const saved = originalLen - compressedContentLen;
        const ratio = originalLen > 0 ? Math.round((saved / originalLen) * 100) : 0;
        console.log(`[Prompt压缩] 纯内容 ${originalLen} 字 → ${compressedContentLen} 字, 节省 ${saved} 字 (${ratio}%)`);
    }
    context += '</context>\n'

    if (!hasData) { context = ''; }

    const promptTemplate = getNodeAnalysisPrompt(profile?.tier ?? 'lite');

    return `${promptTemplate}

当前节点信息：
- 所属工艺：${processName || '未知'}
- 节点类型：${nodeType || '节点'}
- 节点名称：${nodeName || '未命名'}

${context}

请结合上述信息，输出符合要求的 JSON：`;
}

function getQualityCheckPromptTemplate(tier) {
    if (tier === 'lite') {
        return `诊断工艺质量问题，输出JSON。
严格防幻觉！没有明确依据的内容全部填空数组[]。
示例输入: 现象=表面粗糙度不达标，节点=精车外圆
示例输出:
{"diagnosis":"简短结论","possibleCauses":["原因一"],"solutions":["方案一"],"preventionTips":["预防一"]}
请严格按此JSON格式输出。`;
    }
    if (tier === 'pro') {
        return `作为资深工艺专家，诊断质量问题，输出JSON。
基于工艺原理进行深入推理，提供系统性解决方案和前瞻性预防措施。
示例输入: 现象=表面粗糙度不达标，节点=精车外圆
示例输出:
{"diagnosis":"深度诊断结论分析","possibleCauses":["深层次原因一","原因二"],"solutions":["针对性落地方案一"],"preventionTips":["前瞻性系统预防措施一"]}
请严格按此JSON格式输出。`;
    }
    return `诊断工艺质量问题，输出JSON。
示例输入: 现象=表面粗糙度不达标，节点=精车外圆
示例输出:
{"diagnosis":"切削参数不当导致表面质量差","possibleCauses":["进给量过大","刀具磨损严重","主轴转速偏低"],"solutions":["减小进给量至0.05-0.1mm/r","更换新刀具","提高转速至800-1200rpm"],"preventionTips":["定期检查刀具磨损量","建立切削参数标准卡"]}
请严格按此JSON格式输出。`;
}

function buildQualityCheckPrompt(symptom, nodeName, nodeType, profile = null) {
    const tier = profile?.tier ?? 'standard';
    const template = getQualityCheckPromptTemplate(tier);
    return `${template}

当前节点信息：
- 节点类型：${nodeType || '节点'}
- 节点名称：${nodeName || '未命名'}

用户描述的现象：
${symptom}

请输出 JSON：`;
}

function buildHyDEPrompt(question, profile = null) {
    const tier = profile?.tier ?? 'standard';
    if (tier === 'lite') {
        return `请想象你是一份操作文档。针对问题"${question}"，写一段假设性回答（约30字）：`;
    }
    if (tier === 'pro') {
        return `请想象你是一份资深工艺指导文档。针对问题"${question}"，写一段包含丰富工艺关键词的假设性回答（约100字）：`;
    }
    return `请想象你是一份车间工艺操作指导文档。针对问题"${question}"，写一段简短的假设性回答文档（约50字）：`;
}

module.exports = {
    getSystemPrompt,
    buildUserPrompt,
    buildNodeAnalysisPrompt,
    buildQualityCheckPrompt,
    buildHyDEPrompt
}
