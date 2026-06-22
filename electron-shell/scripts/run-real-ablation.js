const fs = require('fs');
const path = require('path');
const { searchSimilar } = require('../ai-service/rag/vector-search');
const { preprocessQuery } = require('../ai-service/rag/query-classifier');
const { getModelProfile } = require('../ai-service/rag/model-profiles');

const TESTSET_FILE = path.join(__dirname, 'testset_real.json');
const RESULTS_FILE = path.join(__dirname, 'ablation_real_results.json');
const MD_OUTPUT = path.join(__dirname, 'table1_ablation_real.md');
const VALID_RAGAS_FILE = path.join(__dirname, 'valid_ragas_queries.json');

const profile = getModelProfile('qwen2.5:7b');
const variants = [
    { name: 'Baseline', useCAS: false, useH2R: false, useJCS: false },
    { name: '+CAS', useCAS: true, useH2R: false, useJCS: false },
    { name: '+CAS+H2R', useCAS: true, useH2R: true, useJCS: false },
    { name: 'Full（本文）', useCAS: true, useH2R: true, useJCS: true, useBayes: true }
];

async function runAblation() {
    if (!fs.existsSync(TESTSET_FILE)) {
        console.error("找不到 testset_real.json，请先运行生成脚本。");
        process.exit(1);
    }
    const testset = JSON.parse(fs.readFileSync(TESTSET_FILE, 'utf8'));
    console.log(`=== 开始对 ${testset.length} 条真实提问进行消融实验 ===`);
    
    let results = [];
    if (fs.existsSync(RESULTS_FILE)) {
        try {
            results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
            console.log(`[断点续传] 已加载 ${results.length} 个已有变体的结果`);
        } catch(e) {}
    }

    for (let i = results.length; i < variants.length; i++) {
        const v = variants[i];
        console.log(`\n正在测试配置: ${v.name}`);
        
        let inDomainQueries = 0;
        let hitCountFull = 0;
        let hitCountAccurate = 0;
        let passedInDomain = 0;
        let safeIntercepts = 0;
        let oobQueries = 0;
        let totalTime = 0;
        let validRagasQueries = [];

        for (let j = 0; j < testset.length; j++) {
            const test = testset[j];
            process.stdout.write(`\r[进度 ${j+1}/${testset.length}] 检索: ${test.id}`);
            
            const t0 = performance.now();
            let searchKeyword = test.query;
            if (v.useCAS) {
                searchKeyword = preprocessQuery(test.query).processedQuery;
            }

            const customProfile = { ...profile, rag: { ...profile.rag, topK: 5, useH2R: v.useH2R } };
            const options = { useH2R: v.useH2R, useJCS: v.useJCS, useBayes: v.useBayes || false };
            
            const res = await searchSimilar(searchKeyword, 5, 2000, customProfile, options);
            const latency = performance.now() - t0;
            totalTime += latency;
            
            const retrievedIds = res.results.map(r => r.chunkId || r.id);
            const isReliable = res.jcsReliable;

            if (test.type !== 'oob') {
                inDomainQueries++;
                const isHit = test.expectedChunkIds.some(id => retrievedIds.includes(id));
                if (isHit) hitCountFull++;
                if (isReliable) {
                    passedInDomain++;
                    if (isHit) hitCountAccurate++;
                    
                    // 为RAGAS保留验证过的数据（仅在Full配置时收集）
                    if (v.name === 'Full（本文）') {
                        validRagasQueries.push({
                            id: test.id,
                            query: test.query,
                            scenario: test.scenario,
                            expectedChunkIds: test.expectedChunkIds,
                            retrievedContext: res.results.map(r => r.text).join('\n\n')
                        });
                    }
                }
            } else {
                oobQueries++;
                if (!isReliable) safeIntercepts++;
            }
        }
        console.log(`\n`);

        const fullRecall = inDomainQueries > 0 ? (hitCountFull / inDomainQueries * 100) : 0;
        const accRecall = passedInDomain > 0 ? (hitCountAccurate / passedInDomain * 100) : fullRecall;
        const interceptRate = oobQueries > 0 ? (safeIntercepts / oobQueries * 100) : 0;
        const avgLatency = totalTime / testset.length;

        results.push({
            配置: v.name,
            '全量R@5': fullRecall.toFixed(1) + '%',
            '精准R@5*': accRecall.toFixed(1) + '%',
            'JCS拦截率': interceptRate.toFixed(1) + '%',
            '延迟(ms)': avgLatency.toFixed(2)
        });

        // 写入结果，支持断点续传
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');
        
        if (v.name === 'Full（本文）') {
            fs.writeFileSync(VALID_RAGAS_FILE, JSON.stringify(validRagasQueries, null, 2), 'utf8');
            console.log(`已将 ${validRagasQueries.length} 条 JCS放行 的提问保存至 valid_ragas_queries.json`);
        }
    }

    console.log('\n=== 表1 真实消融实验结果 ===');
    console.table(results);

    // 输出 Markdown
    let md = `| 配置 | 全量R@5 | **精准R@5\\*** | JCS拦截率 | 延迟(ms) |\n|------|---------|--------------|---------|---------|\n`;
    for (const r of results) {
        md += `| ${r['配置']} | ${r['全量R@5']} | ${r['配置']==='Full（本文）'?`**${r['精准R@5*']}**`:r['精准R@5*']} | ${r['配置']==='Full（本文）'?`**${r['JCS拦截率']}**`:r['JCS拦截率']} | ${r['延迟(ms)']} |\n`;
    }
    fs.writeFileSync(MD_OUTPUT, md, 'utf8');
    console.log(`✅ 真实消融实验完成！Markdown表格已保存到 ${MD_OUTPUT}`);
    process.exit(0);
}

runAblation();
