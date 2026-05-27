const { pipeline, env } = require('@xenova/transformers')
const path = require('path')
const fs = require('fs')

// 指定保存目录
const saveDir = path.join(__dirname, 'vendor', 'embed-models')
fs.mkdirSync(saveDir, { recursive: true })

env.cacheDir = saveDir       // 下载到 vendor/embed-models/
env.allowRemoteModels = true // 允许联网下载

console.log('正在下载 bge-small-zh-v1.5 模型（约45MB）...')
pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5', { quantized: true })
  .then(extractor => {
    console.log('下载完成，模型已保存到 vendor/embed-models/')
    process.exit(0)
  })
  .catch(err => {
    console.error('下载失败:', err)
    process.exit(1)
  })
