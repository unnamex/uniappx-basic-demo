/**
 * 轻量级日志持久化模块
 * 
 * 功能：
 * - 将主进程的 console.log / warn / error 同时输出到本地日志文件
 * - 按日期自动分文件（如 2026-05-30.log）
 * - 自动清理超过 7 天的旧日志
 * - 日志存放在用户数据目录: %APPDATA%/应用名/logs/
 * 
 * 用法：在 main.js 顶部调用 require('./logger').init()
 */

const { app } = require('electron')
const path = require('path')
const fs = require('fs')

let logDir = ''
let currentLogDate = ''
let currentLogStream = null
const MAX_LOG_DAYS = 7 // 日志保留天数

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 */
function getDateStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 获取当前时间戳字符串 (HH:mm:ss.SSS)
 */
function getTimeStr() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${h}:${min}:${s}.${ms}`
}

/**
 * 确保日志目录存在
 */
function ensureLogDir() {
  if (!logDir) {
    logDir = path.join(app.getPath('userData'), 'logs')
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
}

/**
 * 获取或切换日志写入流（按天切分）
 */
function getLogStream() {
  const today = getDateStr()
  if (today !== currentLogDate) {
    // 日期切换，关闭旧流
    if (currentLogStream) {
      currentLogStream.end()
    }
    currentLogDate = today
    const logFile = path.join(logDir, `${today}.log`)
    currentLogStream = fs.createWriteStream(logFile, { flags: 'a' })
  }
  return currentLogStream
}

/**
 * 写入一行日志
 */
function writeLine(level, args) {
  try {
    const time = getTimeStr()
    const msg = args.map(a => {
      if (a instanceof Error) return a.stack || a.message
      if (typeof a === 'object') {
        try { return JSON.stringify(a) } catch { return String(a) }
      }
      return String(a)
    }).join(' ')

    const line = `[${currentLogDate} ${time}] [${level}] ${msg}\n`
    const stream = getLogStream()
    if (stream) {
      stream.write(line)
    }
  } catch (_) {
    // 日志模块自身不能抛异常影响主流程
  }
}

/**
 * 清理超期日志文件
 */
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(logDir)
    const now = Date.now()
    const maxAge = MAX_LOG_DAYS * 24 * 60 * 60 * 1000

    files.forEach(file => {
      if (!file.endsWith('.log')) return
      const filePath = path.join(logDir, file)
      try {
        const stat = fs.statSync(filePath)
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath)
          console.log('[Logger] 已清理过期日志:', file)
        }
      } catch (_) {}
    })
  } catch (_) {}
}

/**
 * 初始化日志模块，劫持 console 方法
 */
function init() {
  ensureLogDir()

  // 保存原始方法
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  // 重写 console.log
  console.log = function (...args) {
    originalLog.apply(console, args)
    writeLine('INFO', args)
  }

  // 重写 console.warn
  console.warn = function (...args) {
    originalWarn.apply(console, args)
    writeLine('WARN', args)
  }

  // 重写 console.error
  console.error = function (...args) {
    originalError.apply(console, args)
    writeLine('ERROR', args)
  }

  // 捕获未处理的异常和 Promise 拒绝
  process.on('uncaughtException', (err) => {
    writeLine('FATAL', ['未捕获异常:', err])
  })

  process.on('unhandledRejection', (reason) => {
    writeLine('FATAL', ['未处理的 Promise 拒绝:', reason])
  })

  // 启动时清理旧日志
  cleanOldLogs()

  console.log('[Logger] 日志模块已初始化, 日志目录:', logDir)
}

/**
 * 获取日志目录路径（供外部查询）
 */
function getLogDir() {
  return logDir
}

module.exports = { init, getLogDir }
