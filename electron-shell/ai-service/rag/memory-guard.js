const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * 获取当前系统内存状态
 * @returns {object} { totalMB, freeMB, usedPercent }
 */
function getSystemMemoryInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const totalMB = Math.round(totalMem / (1024 * 1024));
    const freeMB = Math.round(freeMem / (1024 * 1024));
    const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    
    return { totalMB, freeMB, usedPercent };
}

/**
 * 获取当前的内存压力等级
 * @returns {string} 'low' | 'medium' | 'high' | 'critical'
 */
function getMemoryPressureLevel() {
    const { freeMB } = getSystemMemoryInfo();
    
    if (freeMB < 1500) return 'critical';
    if (freeMB < 3000) return 'high';
    if (freeMB < 6000) return 'medium';
    return 'low';
}

/**
 * 获取当前打包安装的单一模型配置
 * @returns {object} { modelName, tier, displayName, description }
 */
function getPackagedModel() {
    // 生产环境中，模型配置文件位于 resources/models/model-config.json
    // 开发环境中，位于 vendor/models-selected/model-config.json
    // 根据 main.js 的结构，我们可以先尝试开发环境路径，再尝试生产环境路径
    
    let configPath = '';
    const isPackaged = process.defaultApp === false && typeof process.resourcesPath === 'string';
    
    if (isPackaged) {
        configPath = path.join(process.resourcesPath, 'models', 'model-config.json');
    } else {
        configPath = path.join(__dirname, '..', '..', 'vendor', 'models-selected', 'model-config.json');
    }

    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[MemoryGuard] 无法读取打包模型配置:', e.message);
    }
    
    // 默认回退（如果不经过打包脚本直接运行的情况）
    return {
        modelName: 'qwen2.5:7b',
        tier: 'pro',
        displayName: 'Qwen 2.5 7B (专家模式)',
        description: '默认开发调试模型'
    };
}

module.exports = {
    getSystemMemoryInfo,
    getMemoryPressureLevel,
    getPackagedModel
};
