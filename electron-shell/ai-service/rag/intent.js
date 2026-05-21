/**
 * 意图识别模块
 * 通过纯本地规则快速判断用户的提问意图，决定检索策略。
 * 耗时 < 1ms，避免调用大模型的开销。
 */

/**
 * 识别意图类型
 * @param {string} question 用户问题
 * @returns {string} 意图类型: 'chitchat' (闲聊) | 'overview' (概览) | 'entity' (实体精确查询) | 'semantic' (语义查询)
 */
function classifyIntent(question) {
    if (!question) return 'semantic';
    
    const lowerQ = question.toLowerCase().trim();

    // 1. 闲聊/系统自我认知类意图：绕过任何知识检索和嵌入向量生成，防止大模型与向量模型在显存/内存中频繁交替切换加载
    const chitchatKeywords = [
        '你是谁', '你是什么', '介绍一下你自己', '你的名字', '谁开发的', '什么模型', '哪个模型',
        '你好', '哈罗', 'hello', 'hi', '再见', '谢谢', '什么版本'
    ];
    for (const kw of chitchatKeywords) {
        if (lowerQ.includes(kw)) {
            return 'chitchat';
        }
    }

    // 2. 概览类意图：询问整体情况、包含哪些、列出等
    const overviewKeywords = [
        '介绍一下', '概览', '有哪些', '列出', '汇总', '总体', '所有工序',
        '基本信息', '整体信息', '包含哪些工序', '工艺信息', '哪些工序'
    ];
    
    for (const kw of overviewKeywords) {
        if (lowerQ.includes(kw)) {
            return 'overview';
        }
    }

    // 3. 默认走 semantic 意图，后续图谱和向量会并行处理
    return 'semantic';
}

module.exports = {
    classifyIntent
};
