const fs = require('fs');

try {
  let content = fs.readFileSync('pages/index/index.uvue', 'utf8');

  // Extract initData block
  let s1 = content.indexOf('\tconst initData = async () => {\n');
  let e1 = content.indexOf('\n\t}\n', s1) + 4;
  let b1 = content.substring(s1, e1);
  content = content.substring(0, s1) + content.substring(e1);

  // Extract isSettingsMenuVisible and toggleSettingsMenu
  let s2 = content.indexOf('\t// 设置菜单显示状态\n');
  let e2 = content.indexOf('\n\t}\n', s2) + 4;
  let b2 = content.substring(s2, e2);
  content = content.substring(0, s2) + content.substring(e2);

  // Extract goSettings
  let s3 = content.indexOf('\t/**\n\t * 跳转到设置页面\n\t */\n\tconst goSettings = () => {\n');
  let e3 = content.indexOf('\n\t}\n', s3) + 4;
  let b3 = content.substring(s3, e3);
  content = content.substring(0, s3) + content.substring(e3);

  // Extract resetData
  let s4 = content.indexOf('\t/**\n\t * 重置数据（测试用）\n\t */\n\tconst resetData = async () => {\n');
  let e4 = content.indexOf('\n\t}\n', s4) + 4;
  let b4 = content.substring(s4, e4);
  content = content.substring(0, s4) + content.substring(e4);

  // Extract goToPrevNode and goToNextNode
  let s5 = content.indexOf('\tconst goToPrevNode = () => {\n');
  let e5 = content.indexOf('\n\t}\n\n\tconst goToNextNode', s5);
  let b5 = content.substring(s5, e5);
  content = content.substring(0, s5) + content.substring(e5);

  let s6 = content.indexOf('\n\tconst goToNextNode = () => {\n');
  let e6 = content.indexOf('\n\t}\n', s6) + 4;
  let b6 = content.substring(s6, e6);
  content = content.substring(0, s6) + content.substring(e6);

  const eof = content.indexOf('\t// ============ 生命周期钩子');

  let append = '\n\t// ======== 移到底部的依懒方法 ========\n' + b5 + b6 + b1 + b2 + b3 + b4 + '\n';

  const finalContent = content.substring(0, eof) + append + content.substring(eof);

  fs.writeFileSync('pages/index/index.uvue', finalContent, 'utf8');
  console.log('Moved all dependent methods to the bottom successfully.');

} catch (e) {
  console.error('Error:', e);
}
