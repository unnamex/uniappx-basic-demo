/**
 * 模型配置映射表 (Model Profiles)
 * 根据不同规模的模型（1.5B vs 3B）动态适配最佳的推理参数与检索策略
 */

const MODEL_PROFILES = {
    'qwen2.5:1.5b': {
        tier: 'lite',
        // 1.5B 容易产生幻觉，降低 temperature，严格约束输出
        chat: { num_ctx: 1024, num_predict: 300, temperature: 0.1, top_p: 0.85, repeat_penalty: 1.2 },
        analysis: { num_ctx: 1024, num_predict: 400, temperature: 0.1, top_p: 0.85, repeat_penalty: 1.3 },
        quality: { num_ctx: 1024, num_predict: 400, temperature: 0.1, top_p: 0.85, repeat_penalty: 1.2 },
        // 1.5B 上下文窗口小，处理速度快但理解力有限，减少送入的上下文长度
        rag: { maxContextChars: 600, topK: 1, contextTruncate: 1000, hydeTimeout: 1200, vectorTimeout: 1200, minSimilarity: 0.60 },
        hyde: { num_predict: 20, temperature: 0.1 },
    },
    'qwen2.5:3b': {
        tier: 'standard',
        // 3B 模型如果设为 2048 会导致内存不足 (unable to allocate CPU buffer)，恢复为 1024
        // 极低 temperature 约束，防止幻觉
        chat: { num_ctx: 1024, num_predict: 500, temperature: 0.0, top_p: 0.1, repeat_penalty: 1.15 },
        analysis: { num_ctx: 1024, num_predict: 600, temperature: 0.0, top_p: 0.1, repeat_penalty: 1.15 },
        quality: { num_ctx: 1024, num_predict: 600, temperature: 0.0, top_p: 0.1, repeat_penalty: 1.15 },
        // 降低检索要求，防止超长上下文崩溃
        rag: { maxContextChars: 800, topK: 1, contextTruncate: 1000, hydeTimeout: 2000, vectorTimeout: 2000, minSimilarity: 0.55 },
        hyde: { num_predict: 30, temperature: 0.0 },
    },
    'qwen2.5:7b': {
        tier: 'pro',
        // 7B 模型能力强，上下文长，可提升参数限制并允许一定的发散，因为其具备较强的推理能力不易幻觉
        chat: { num_ctx: 2048, num_predict: 800, temperature: 0.1, top_p: 0.8, repeat_penalty: 1.1 },
        analysis: { num_ctx: 2048, num_predict: 1000, temperature: 0.1, top_p: 0.8, repeat_penalty: 1.1 },
        quality: { num_ctx: 2048, num_predict: 1000, temperature: 0.1, top_p: 0.8, repeat_penalty: 1.1 },
        // 检索可以给更多内容
        rag: { maxContextChars: 1500, topK: 3, contextTruncate: 1500, hydeTimeout: 3000, vectorTimeout: 3000, minSimilarity: 0.50 },
        hyde: { num_predict: 50, temperature: 0.1 },
    }
}

/**
 * 获取指定模型的配置参数，默认回退到 3B
 * @param {string} modelName 模型名称
 */
function getModelProfile(modelName) {
    if (!modelName) return MODEL_PROFILES['qwen2.5:7b']
    
    // 如果找到了直接返回，否则返回一个带默认安全参数的版本
    // 由于我们默认有 1.5b/3b/7b，基本覆盖
    // 如果传入模型不在上述列表，默认用打包的主模型或 7B 的配置
    return MODEL_PROFILES[modelName] || MODEL_PROFILES['qwen2.5:7b']
}

module.exports = {
    MODEL_PROFILES,
    getModelProfile
}
