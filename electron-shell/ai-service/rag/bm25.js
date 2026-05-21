/**
 * 轻量级 BM25 关键词检索实现
 * 用于补充向量检索的词汇盲区（如具体的型号、编号等精确匹配）
 */

const fs = require('fs');
const path = require('path');
const INDEX_FILE = path.join(__dirname, '..', 'bm25-index.json');

// 简单的分词：按空格、标点符号切分，并转小写
function tokenize(text) {
    if (!text) return [];
    // 移除 HTML 标签
    const cleanText = text.replace(/<[^>]*>?/gm, ' ');
    return cleanText.toLowerCase().split(/[\s,.;:!?()\[\]{}'"]+/).filter(token => token.length > 0);
}

// 构建 BM25 索引
function buildBM25Index(chunks) {
    const documents = [];
    const df = {}; // Document frequency
    const docLengths = [];
    let totalLength = 0;

    chunks.forEach((chunk, index) => {
        const tokens = tokenize(chunk.text);
        docLengths.push(tokens.length);
        totalLength += tokens.length;

        const tf = {};
        tokens.forEach(token => {
            tf[token] = (tf[token] || 0) + 1;
        });

        // 更新 DF
        Object.keys(tf).forEach(token => {
            df[token] = (df[token] || 0) + 1;
        });

        documents.push({
            id: chunk.id,
            type: chunk.type,
            text: chunk.text,
            metadata: chunk.metadata,
            tf: tf
        });
    });

    const avgdl = totalLength / (chunks.length || 1);

    const indexData = {
        version: 1,
        createdAt: new Date().toISOString(),
        documents: documents,
        df: df,
        avgdl: avgdl,
        totalDocs: chunks.length
    };

    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData), 'utf-8');
    console.log(`[BM25] 索引构建完成，共 ${chunks.length} 个文档`);
    return indexData;
}

// 加载 BM25 索引
let cachedBM25Index = null;
function loadBM25Index() {
    if (cachedBM25Index) return cachedBM25Index;
    if (!fs.existsSync(INDEX_FILE)) return null;
    
    try {
        const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
        cachedBM25Index = JSON.parse(raw);
        return cachedBM25Index;
    } catch (e) {
        console.error('[BM25] 加载索引失败:', e.message);
        return null;
    }
}

// BM25 搜索参数
const k1 = 1.5;
const b = 0.75;

// 执行 BM25 搜索
function searchBM25(question, topK = 5) {
    const index = loadBM25Index();
    if (!index || index.documents.length === 0) return [];

    const queryTokens = tokenize(question);
    if (queryTokens.length === 0) return [];

    const scores = index.documents.map((doc, idx) => {
        let score = 0;
        const dl = index.documents[idx].tf; // 文档的词频映射预先算好的长度等信息，这里用前面预存的
        const docLen = Object.values(doc.tf).reduce((sum, count) => sum + count, 0);

        queryTokens.forEach(token => {
            if (!index.df[token]) return; // 词库中没有这个词

            // 计算 IDF
            const idf = Math.log((index.totalDocs - index.df[token] + 0.5) / (index.df[token] + 0.5) + 1.0);
            
            // 计算 TF
            const tf = doc.tf[token] || 0;
            
            // BM25 公式
            if (tf > 0) {
                const numerator = tf * (k1 + 1);
                const denominator = tf + k1 * (1 - b + b * (docLen / index.avgdl));
                score += idf * (numerator / denominator);
            }
        });

        return {
            id: doc.id,
            type: doc.type,
            text: doc.text,
            metadata: doc.metadata,
            score: score
        };
    });

    // 过滤掉分数为 0 的
    const validScores = scores.filter(item => item.score > 0);
    // 降序排序
    validScores.sort((a, b) => b.score - a.score);

    return validScores.slice(0, topK);
}

function clearBM25Cache() {
    cachedBM25Index = null;
}

module.exports = {
    buildBM25Index,
    searchBM25,
    clearBM25Cache
};
