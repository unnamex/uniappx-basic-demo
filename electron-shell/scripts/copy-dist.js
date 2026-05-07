const fs = require('fs')
const path = require('path')

const src = path.resolve(__dirname, '../../unpackage/dist/build/web')
const dest = path.resolve(__dirname, '../dist')

// 递归复制目录
function copyDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }
  for (const item of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, item)
    const destPath = path.join(destDir, item)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

if (!fs.existsSync(src)) {
  console.error('❌ H5 产物不存在，请先在 HBuilderX 中编译 Web 端')
  console.error('   期望路径: ' + src)
  process.exit(1)
}

// 清空目标目录
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true })
}

copyDir(src, dest)
console.log('✅ H5 产物已复制到 electron-shell/dist/')
