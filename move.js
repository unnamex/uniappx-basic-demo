const fs = require('fs');

try {
  const content = fs.readFileSync('pages/index/index.uvue', 'utf8');

  // Block to move: from 'const enrichNodeForDisplay =' until the end of 'onFullscreenImageLoad'
  const startStr = '\t// 为节点添加显示字段';
  const endStr = '\t\t}\n\t}\n\t\n\n\t\n\t\n\t// ============ 生命周期钩子';

  const startIdx = content.indexOf(startStr);
  const endIdx = content.indexOf('\t// ============ 生命周期钩子', startIdx);

  if (startIdx === -1 || endIdx === -1) {
    console.log('Cannot find markers');
    process.exit(1);
  }

  // 抽出从 enrichNodeForDisplay 到最后的所有方法
  const methodsChunk = content.substring(startIdx, endIdx);

  // 余下的文件内容（没有这部分）
  const remainder = content.substring(0, startIdx) + content.substring(endIdx);

  // 插入位置: flattenTree 之前
  const insertTarget = '\t// ====== 树节点扁平化及导航 ======';
  const insertIdx = remainder.indexOf(insertTarget);

  if (insertIdx === -1) {
    console.log('Cannot find insert target');
    process.exit(1);
  }

  const finalContent = remainder.substring(0, insertIdx) +
    '\n\t// =============== 已提升的方法 ===============\n' +
    methodsChunk +
    '\n\t// =============== \n' +
    remainder.substring(insertIdx);

  fs.writeFileSync('pages/index/index.uvue', finalContent, 'utf8');
  console.log('Moved methods up successfully.');

} catch (e) {
  console.error('Error:', e);
}
