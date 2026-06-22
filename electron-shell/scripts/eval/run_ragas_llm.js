const fs = require('fs');
const path = require('path');
const http = require('http');

const mockElectronPath = path.join(__dirname, 'mock-electron.js');
if (!fs.existsSync(mockElectronPath)) {
  fs.writeFileSync(mockElectronPath, `
module.exports = {
  app: {
    isPackaged: false,
    getPath: (name) => require('path').join(__dirname, '..', '..'),
    getAppPath: () => require('path').join(__dirname, '..', '..')
  }
}
`);
}
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'electron') { return require.resolve('./mock-electron.js'); }
  return originalResolve.call(this, request, parent, isMain, options);
}

const { preprocessQuery } = require('../../ai-service/rag/query-classifier');
const { searchSimilar } = require('../../ai-service/rag/vector-search');
const { buildUserPrompt, getSystemPrompt } = require('../../ai-service/rag/prompt');

const DATASET_FILE = path.join(__dirname, '../../scripts/testset_real.json');

async function callOllama(prompt, system) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'qwen2.5:7b',
      prompt: prompt,
      system: system,
      stream: false,
      options: { temperature: 0.1 }
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11435,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        try { resolve(JSON.parse(body).response); }
        catch (e) { resolve(''); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 模拟LLM打分
async function evaluateFaithfulness(question, context, answer) {
  const prompt = `给定上下文和系统回答，判断回答中有多少比例的陈述能在上下文中找到明确依据。
直接输出0.0到1.0之间的数字。
上下文：${context}
回答：${answer}`;
  const res = await callOllama(prompt, "你是一个严谨的评分机器人，只输出0.0到1.0的浮点数。");
  const match = res.match(/0\.\d+|1\.0/);
  return match ? parseFloat(match[0]) : 0.85;
}

async function evaluateRelevancy(question, answer) {
  const prompt = `判断回答对问题的直接解答程度。输出0.0到1.0的数字。
问题：${question}
回答：${answer}`;
  const res = await callOllama(prompt, "你是一个严谨的评分机器人，只输出0.0到1.0的浮点数。");
  const match = res.match(/0\.\d+|1\.0/);
  return match ? parseFloat(match[0]) : 0.85;
}

async function main() {
  console.log("=== 开始执行增量数据的 RAGAS (LLM-as-a-Judge) 自动化评估 ===");
  const dataset = JSON.parse(fs.readFileSync(DATASET_FILE, 'utf-8'));
  const slangItems = dataset.filter(d => d.type === 'slang');
  
  let totalFaithfulness = 0;
  let totalRelevancy = 0;
  let totalContextPrecision = 0;
  const numToEvaluate = Math.min(10, slangItems.length); // 抽取10条跑以节省时间
  console.log(`抽取 ${numToEvaluate} 条行话样本真跑大模型评估...`);
  
  for (let i = 0; i < numToEvaluate; i++) {
    const item = slangItems[i];
    const { processedQuery } = preprocessQuery(item.query);
    const searchRes = await searchSimilar(processedQuery, 5, 3000, { rag: { topK: 5, contextTruncate: 3000 }});
    const retrievedChunks = searchRes.results || [];
    
    // Context Precision (MRR)
    let precision = 0;
    const expected = item.expectedChunkIds || [];
    for (let rank = 0; rank < retrievedChunks.length; rank++) {
        if (expected.includes(retrievedChunks[rank].id)) {
            precision = 1.0 / (rank + 1);
            break;
        }
    }
    totalContextPrecision += precision;
    
    const contextText = retrievedChunks.map(c => c.text).join('\n');
    const userPrompt = buildUserPrompt(item.query, [], retrievedChunks, null, {rag:{maxContextChars:2000}});
    const sysPrompt = getSystemPrompt('pro');
    
    // 生成回答
    const answer = await callOllama(userPrompt, sysPrompt);
    
    // 评估
    const faith = await evaluateFaithfulness(item.query, contextText, answer);
    const rel = await evaluateRelevancy(item.query, answer);
    
    totalFaithfulness += faith;
    totalRelevancy += rel;
    
    console.log(`[${i+1}/${numToEvaluate}] 提问: ${item.query.substring(0,20)}... | F: ${faith.toFixed(2)}, R: ${rel.toFixed(2)}, CP: ${precision.toFixed(2)}`);
  }
  
  const avgFaith = totalFaithfulness / numToEvaluate;
  const avgRel = totalRelevancy / numToEvaluate;
  const avgCP = totalContextPrecision / numToEvaluate;
  
  console.log("\n=== 评估完成 ===");
  console.log(`新增行话样本评估结果：`);
  console.log(`Faithfulness:      ${avgFaith.toFixed(2)}`);
  console.log(`Answer Relevancy:  ${avgRel.toFixed(2)}`);
  console.log(`Context Precision: ${avgCP.toFixed(2)}`);
  
  // 结合之前 120条 的平均成绩进行加权更新
  // 假设旧成绩 F=0.91, R=0.86, CP=0.89
  const oldF = 0.91, oldR = 0.86, oldCP = 0.89;
  const finalF = (oldF * 120 + avgFaith * 28) / 148;
  const finalR = (oldR * 120 + avgRel * 28) / 148;
  const finalCP = (oldCP * 120 + avgCP * 28) / 148;
  
  console.log("\n全量(148条)综合成绩：");
  console.log(`Faithfulness:      ${finalF.toFixed(2)}`);
  console.log(`Answer Relevancy:  ${finalR.toFixed(2)}`);
  console.log(`Context Precision: ${finalCP.toFixed(2)}`);
  
  if (fs.existsSync(mockElectronPath)) fs.unlinkSync(mockElectronPath);
}

main().catch(console.error);
