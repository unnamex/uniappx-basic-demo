const fs = require('fs')
const path = require('path')

/**
 * 检索匹配的工艺知识
 * @param {string} question 用户输入的问题
 * @returns {Array} 匹配到的知识列表
 */
function searchKnowledge(question) {
    if (!question) return []
    
    try {
        const knowledgePath = path.join(__dirname, '..', 'knowledge.json')
        if (!fs.existsSync(knowledgePath)) {
            console.error('[RAG Search] 知识库文件不存在:', knowledgePath)
            return []
        }
        
        const data = JSON.parse(fs.readFileSync(knowledgePath, 'utf-8'))
        const lowerQuestion = question.toLowerCase()
        
        // 过滤包含关键词的条目
        const matched = data.filter(item => {
            if (!item.keyword) return false
            return lowerQuestion.includes(item.keyword.toLowerCase())
        })
        
        console.log(`[RAG Search] 问题: "${question}", 匹配到条目数: ${matched.length}`)
        return matched
    } catch (error) {
        console.error('[RAG Search] 检索知识库出错:', error)
        return []
    }
}

module.exports = {
    searchKnowledge
}
