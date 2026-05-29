const { execSync } = require('child_process');
const target = process.argv[2] || 'all';

// 设置环境变量，供 electron-builder.js 和 InnoSetup 使用
process.env.GPU_TARGET = target;

console.log(`\n==============================================`);
console.log(`[build-gpu] 开始打包流程 (目标: ${target.toUpperCase()})`);
console.log(`==============================================\n`);

try {
  if (target === 'noai') {
    console.log(`[1/3] 跳过 AI 模型准备（无AI模式）...`);
  } else {
    console.log(`[1/3] 准备 AI 模型...`);
    execSync('npm run prepare:pro', { stdio: 'inherit' });
  }
  
  console.log(`\n[2/3] 清理旧产物...`);
  execSync('npm run clean', { stdio: 'inherit' });
  
  console.log(`\n[3/3] 运行 electron-builder 进行打包...`);
  // 修复：直接使用 node_modules 下的命令路径，绕过 npx 在 Windows execSync 中的进程静默退出问题
  const isWin = process.platform === 'win32';
  const builderPath = isWin ? '.\\node_modules\\.bin\\electron-builder.cmd' : './node_modules/.bin/electron-builder';
  execSync(`${builderPath} --win --x64 --config electron-builder.js`, { stdio: 'inherit' });
  
  console.log(`\n==============================================`);
  console.log(`[build-gpu] 打包完成！(目标: ${target.toUpperCase()})`);
  console.log(`==============================================\n`);
} catch (error) {
  console.error(`\n[!] 打包过程发生错误:`, error.message);
  process.exit(1);
}
