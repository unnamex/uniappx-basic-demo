const fs = require('fs');
const axios = require('axios');
const path = require('path');

const VALID_QUERIES_FILE = path.join(__dirname, 'valid_ragas_queries.json');
const RESULTS_FILE = path.join(__dirname, 'ragas_real_results.json');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLM(prompt, jsonFormat = false) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const payload = {
                model: 'qwen2.5:7b',
                prompt: prompt,
                stream: false,
                options: { temperature: 0.1, num_ctx: 2048 }
            };
            if (jsonFormat) payload.format = 'json';

            const res = await axios.post('http://127.0.0.1:11435/api/generate', payload, { timeout: 120000 });
            return res.data.response;
        } catch (e) {
            console.warn(`[LLM 调用失败] 重试 ${attempt}/3: ${e.message}`);
            await sleep(5000);
        }
    }
    return null;
}

// 模拟 main.js 中的生成与 Self-Reflect 过程
async function generateAnswerWithReflect(query, context) {
    const prompt = `基于以下提供的工艺文档，回答用户的问题。
文档内容：
${context}
---
用户问题：${query}
请给出准确、专业的回答：`;
    
    const answer = await callLLM(prompt);
    if (!answer) return { base: "", full: "" };

    const reflectPrompt = `请判断：以下回答是否完全基于所提供的工艺文档片段？
文档内容：${context}
回答：${answer}

请选择：[A. 完全基于 | B. 部分基于 | C. 超出文档范围]。请仅输出字母 A、B 或 C，不要输出其他字符。`;

    let fullAnswer = answer;
    const evaluation = await callLLM(reflectPrompt);
    if (evaluation && evaluation.includes('C')) {
        fullAnswer += "\n\n【安全提示】以上部分内容为模型推断，可能超出当前工艺规程记录，建议核对原始工艺文档。";
    }

    return { base: answer, full: fullAnswer };
}

// 一次性评估4个指标
async function evaluateRAGAS(query, context, answer) {
    if (!answer) return { Faithfulness: 0, AnswerRelevancy: 0, ContextPrecision: 0, ContextRecall: 0 };
    
    const prompt = `作为一个客观的评判专家，请评估以下问答对在RAG（检索增强生成）系统中的表现。
用户问题: "${query}"
检索到的上下文: "${context}"
AI回答: "${answer}"

请在0.0到1.0的范围内对以下4个维度进行打分（1.0为最高）：
1. Faithfulness (忠实度): AI回答是否全部能从截取的上下文中推导出来？是否存在幻觉？
2. Answer Relevancy (答案相关性): AI回答是否直接、准确地解答了用户的问题？
3. Context Precision (上下文精确度): 检索到的上下文中，与问题相关的有效信息占比是多少？
4. Context Recall (上下文召回率): 检索到的上下文是否包含了回答该问题所需的全部必要信息？

请严格以JSON格式输出，只包含这4个键值对，例如：
{
  "Faithfulness": 0.85,
  "AnswerRelevancy": 0.90,
  "ContextPrecision": 0.70,
  "ContextRecall": 0.80
}`;

    const jsonStr = await callLLM(prompt, true);
    try {
        if (jsonStr) return JSON.parse(jsonStr);
    } catch(e) {
        console.error("解析JSON失败:", jsonStr);
    }
    return { Faithfulness: 0, AnswerRelevancy: 0, ContextPrecision: 0, ContextRecall: 0 };
}

async function main() {
    if (!fs.existsSync(VALID_QUERIES_FILE)) {
        console.error("找不到 valid_ragas_queries.json，请先运行真实消融实验脚本并确保使用了Full配置。");
        process.exit(1);
    }
    const queries = JSON.parse(fs.readFileSync(VALID_QUERIES_FILE, 'utf8'));
    console.log(`=== 开始对 ${queries.length} 条数据进行真实 RAGAS 评估 ===`);

    let progress = [];
    if (fs.existsSync(RESULTS_FILE)) {
        try {
            progress = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
            console.log(`[断点续传] 已加载 ${progress.length} 条已评估的数据`);
        } catch(e) {}
    }

    for (let i = progress.length; i < queries.length; i++) {
        const item = queries[i];
        console.log(`\n[进度 ${i+1}/${queries.length}] 正在评估提问: ${item.id}`);
        
        // 1. 生成回答
        const t0 = performance.now();
        const answers = await generateAnswerWithReflect(item.query, item.retrievedContext);
        
        // 2. 评估 Base 系统
        console.log(`  - 评估 Foundation System (w/o Self-Reflect)...`);
        const baseScores = await evaluateRAGAS(item.query, item.retrievedContext, answers.base);
        
        // 3. 评估 Full 系统
        console.log(`  - 评估 Full System (w/ Self-Reflect)...`);
        const fullScores = await evaluateRAGAS(item.query, item.retrievedContext, answers.full);
        
        const latency = performance.now() - t0;
        console.log(`  - 本条评估完成，耗时: ${(latency/1000).toFixed(1)}s`);

        progress.push({
            id: item.id,
            baseScores,
            fullScores
        });

        // 实时保存断点
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    }

    // 计算平均分
    let sumBase = { f: 0, ar: 0, cp: 0, cr: 0 };
    let sumFull = { f: 0, ar: 0, cp: 0, cr: 0 };
    
    for (const p of progress) {
        sumBase.f += p.baseScores.Faithfulness || 0;
        sumBase.ar += p.baseScores.AnswerRelevancy || 0;
        sumBase.cp += p.baseScores.ContextPrecision || 0;
        sumBase.cr += p.baseScores.ContextRecall || 0;
        
        sumFull.f += p.fullScores.Faithfulness || 0;
        sumFull.ar += p.fullScores.AnswerRelevancy || 0;
        sumFull.cp += p.fullScores.ContextPrecision || 0;
        sumFull.cr += p.fullScores.ContextRecall || 0;
    }

    const n = progress.length || 1;
    const finalResults = [
        {"Metric": "Faithfulness", "w/o Self-Reflect": sumBase.f/n, "w/ Self-Reflect": sumFull.f/n},
        {"Metric": "Answer Relevancy", "w/o Self-Reflect": sumBase.ar/n, "w/ Self-Reflect": sumFull.ar/n},
        {"Metric": "Context Precision", "w/o Self-Reflect": sumBase.cp/n, "w/ Self-Reflect": sumFull.cp/n},
        {"Metric": "Context Recall", "w/o Self-Reflect": sumBase.cr/n, "w/ Self-Reflect": sumFull.cr/n}
    ];

    console.log('\n=== 表2 真实 RAGAS 评估结果 ===');
    console.table(finalResults);

    let md = `| 指标 | 含义 | 基础系统（无Self-Reflect） | 完整系统（含双层防护） |\n|------|------|---------|---------|\n`;
    for (const r of finalResults) {
        let desc = "";
        if (r.Metric === 'Faithfulness') desc = "答案忠实于检索内容的比例";
        else if (r.Metric === 'Answer Relevancy') desc = "答案与问题的相关程度";
        else if (r.Metric === 'Context Precision') desc = "检索内容中相关片段的精确率";
        else if (r.Metric === 'Context Recall') desc = "答案所需信息被检索覆盖的召回率";
        
        md += `| ${r.Metric} | ${desc} | ${r['w/o Self-Reflect'].toFixed(2)} | **${r['w/ Self-Reflect'].toFixed(2)}** |\n`;
    }
    const MD_OUTPUT = path.join(__dirname, 'table2_ragas_real.md');
    fs.writeFileSync(MD_OUTPUT, md, 'utf8');
    console.log(`✅ 真实 RAGAS 评估完成！Markdown表格已保存到 ${MD_OUTPUT}`);
}

main();
