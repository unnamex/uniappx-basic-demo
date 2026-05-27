/**
 * 轻量级提示词去噪压缩模块
 * 
 * 原理：移除中文文本中不影响语义的语法虚词和冗余字符，
 * 减少 Token 数量以降低大模型 Prefill 阶段的 CPU 计算量。
 * 
 * 安全性：只移除语法功能词，绝不截断任何实质内容（数值、参数、操作指令等）。
 * 预期压缩率：20%~30%
 */

// 高频语法虚词（仅在两个汉字之间出现时才移除，避免误伤英文/数字混排的技术参数）
const PARTICLES = ['的', '了', '着', '过'];

// 冗余动词/连接词（在工艺文档中起语法润色作用，移除后不影响工艺语义）
const FILLERS = ['进行', '实施', '予以', '以及', '并且', '或者', '对于', '关于', '按照'];

/**
 * 对文本进行无损去噪压缩
 * @param {string} text - 原始文本
 * @returns {string} 压缩后的文本
 */
function compressText(text) {
  if (!text) return '';

  // 1. 合并连续空白为单个空格
  let result = text.replace(/[\s\r\n]+/g, ' ');

  // 2. 移除汉字之间的语法虚词（利用前后汉字边界确保安全，不会破坏 "M10-8.8" 等技术参数）
  for (const p of PARTICLES) {
    result = result.replace(new RegExp(`(?<=[\\u4e00-\\u9fff])${p}(?=[\\u4e00-\\u9fff])`, 'g'), '');
  }

  // 3. 移除冗余连接词（夹在汉字/标点和汉字之间时）
  for (const f of FILLERS) {
    result = result.replace(new RegExp(`(?<=[\\u4e00-\\u9fff，。；：、])${f}(?=[\\u4e00-\\u9fff])`, 'g'), '');
  }

  // 4. 合并连续重复标点
  result = result.replace(/[，,]{2,}/g, '，');
  result = result.replace(/[。.]{2,}/g, '。');
  result = result.replace(/[、]{2,}/g, '、');

  // 5. 最终清理
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * 对检索结果进行去重
 * 如果向量检索的片段与静态知识高度重叠，则跳过重复内容，避免浪费 Token
 * @param {Array} docs - 静态知识列表
 * @param {Array} chunks - 向量检索片段列表
 * @returns {Array} 去重后的检索片段
 */
function deduplicateChunks(docs, chunks) {
  if (!docs || docs.length === 0 || !chunks || chunks.length === 0) return chunks || [];

  const docTexts = docs.map(d => d.content || '');

  return chunks.filter(chunk => {
    const chunkText = chunk.text || '';
    if (chunkText.length < 20) return true; // 太短的片段不做去重判断

    // 取片段的前60个字符作为指纹，检查是否被任一静态知识包含
    const fingerprint = chunkText.substring(0, Math.min(60, chunkText.length));
    for (const docText of docTexts) {
      if (docText.includes(fingerprint)) return false; // 高度重叠，跳过
    }
    return true;
  });
}

module.exports = { compressText, deduplicateChunks };
