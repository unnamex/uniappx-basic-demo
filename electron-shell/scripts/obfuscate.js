const JavaScriptObfuscator = require('javascript-obfuscator')
const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '../dist')

function obfuscateDir(dir) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item)
    if (fs.statSync(fullPath).isDirectory()) {
      obfuscateDir(fullPath)
    } else if (fullPath.endsWith('.js')) {
      const code = fs.readFileSync(fullPath, 'utf8')
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.3,
        stringArray: true,
        stringArrayThreshold: 0.5,
        target: 'browser'
      })
      fs.writeFileSync(fullPath, result.getObfuscatedCode())
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error('❌ dist 目录不存在，请先运行 copy-dist.js')
  process.exit(1)
}

obfuscateDir(distDir)
console.log('✅ JS 文件混淆完成')
