const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Transform } = require('stream');
const unzipper = require('unzipper');

/**
 * 流式解密并解压 SRD 包
 * @param {string} filePath 原始文件路径
 * @param {string} keyString 密钥字符串
 * @returns {Promise<{tempDir: string, isEncrypted: boolean}>}
 */
async function extractSRD(filePath, keyString) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(os.tmpdir(), 'srd_extract_' + Date.now());
    
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 判断是否为ZIP文件（读取前4字节）
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    fs.closeSync(fd);

    const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
    const isEncrypted = !isZip;

    const readStream = fs.createReadStream(filePath);
    
    // 如果没有加密，直接解压
    if (!isEncrypted) {
      readStream
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', () => resolve({ tempDir, isEncrypted: false }))
        .on('error', (err) => reject(new Error('ZIP解压失败: ' + err.message)));
      return;
    }

    // 如果加密了，先进行流式解密，然后流式解压
    let iv = null;
    let decipher = null;
    let headerRead = false;
    let decryptedChunks = Buffer.alloc(0);
    const key = Buffer.from(keyString.substring(0, 32), 'utf-8');

    const decryptTransform = new Transform({
      transform(chunk, encoding, callback) {
        if (!headerRead) {
          decryptedChunks = Buffer.concat([decryptedChunks, chunk]);
          if (decryptedChunks.length >= 16) {
            iv = decryptedChunks.slice(0, 16);
            const remaining = decryptedChunks.slice(16);
            headerRead = true;
            try {
              decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
              if (remaining.length > 0) {
                this.push(decipher.update(remaining));
              }
            } catch (e) {
              return callback(new Error('初始化解密器失败: ' + e.message));
            }
          }
          callback();
        } else {
          try {
            this.push(decipher.update(chunk));
            callback();
          } catch (e) {
            callback(new Error('解密块失败: ' + e.message));
          }
        }
      },
      flush(callback) {
        if (decipher) {
          try {
            this.push(decipher.final());
          } catch (e) {
            return callback(new Error('解密结束失败(可能是密钥错误): ' + e.message));
          }
        }
        callback();
      }
    });

    readStream
      .pipe(decryptTransform)
      .on('error', (err) => {
         reject(new Error('解密流失败: ' + err.message));
      })
      .pipe(unzipper.Extract({ path: tempDir }))
      .on('close', () => resolve({ tempDir, isEncrypted: true }))
      .on('error', (err) => {
         reject(new Error('解压流失败: ' + err.message));
      });
  });
}

/**
 * 从临时目录读取解析后的数据
 * @param {string} tempDir 临时目录路径
 */
function readExtractedData(tempDir) {
  // 1. 读取 manifest.json
  const manifestPath = path.join(tempDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('未找到 manifest.json');
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const files = manifest.files || {};
  
  // 辅助函数，处理正反斜杠兼容
  const findDiskFile = (relPath) => {
    if (!relPath) return null;
    let p = path.join(tempDir, relPath);
    if (fs.existsSync(p)) return p;
    
    p = path.join(tempDir, relPath.replace(/\//g, '\\'));
    if (fs.existsSync(p)) return p;
    
    p = path.join(tempDir, relPath.replace(/\\/g, '/'));
    if (fs.existsSync(p)) return p;
    
    return null;
  };
  
  const readJson = (relPath, defPath) => {
    const diskPath = findDiskFile(relPath) || findDiskFile(defPath);
    if (diskPath) {
      try {
        return JSON.parse(fs.readFileSync(diskPath, 'utf-8'));
      } catch (e) {
        console.warn('Failed to parse ' + diskPath, e);
      }
    }
    return null;
  };

  const readText = (relPath, defPath) => {
    const diskPath = findDiskFile(relPath) || findDiskFile(defPath);
    if (diskPath) {
      try {
        return fs.readFileSync(diskPath, 'utf-8');
      } catch (e) {
        console.warn('Failed to read text ' + diskPath, e);
      }
    }
    return '';
  };

  const groups = readJson(files.tabs, null) || [];
  const tabs = readJson(files.tab, null) || [];
  const components = readJson(files.components, null) || [];
  
  const processTreeStr = readText(files['process_tree'], 'data/process_tree.json');
  const processRecords = readJson(files['process'], 'data/process.json') || [];
  const operationRecords = readJson(files['operation'], 'data/operation.json') || [];
  const stepRecords = readJson(files['step'], 'data/step.json') || [];
  const actionRecords = readJson(files['action'], 'data/action.json') || [];
  const nodeDatasetRecords = readJson(files['nodeDatasets'], 'data/node_datasets.json') || [];
  
  // 附件和资源处理
  let attachmentRecords = [];
  const attPath = findDiskFile(files.attachment);
  if (attPath) {
    try {
      attachmentRecords = JSON.parse(fs.readFileSync(attPath, 'utf-8'));
    } catch(e) {}
  }
  
  const assetFiles = [];
  for (const res of attachmentRecords) {
    if (res.path) {
       const diskPath = findDiskFile(res.path);
       if (diskPath) assetFiles.push({ originalPath: res.path, diskPath });
    }
    if (res.thumbnail) {
       const diskPath = findDiskFile(res.thumbnail);
       if (diskPath) assetFiles.push({ originalPath: res.thumbnail, diskPath });
    }
  }

  return {
    manifest,
    jsonFiles: {
      groups, tabs, components, processTreeStr, processRecords, operationRecords, stepRecords, actionRecords, nodeDatasetRecords
    },
    assetFiles,
    attachmentRecords
  };
}

/**
 * 提取单个文件为 Base64
 * @param {string} filePath 
 */
function readAssetAsBase64(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'base64');
  }
  return null;
}

/**
 * 提取单个文件为 Buffer (用于大文件，性能更好)
 * @param {string} filePath 
 */
function readAssetAsBuffer(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  return null;
}

/**
 * 清理临时目录
 * @param {string} tempDir 
 */
function cleanupTempDir(tempDir) {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  extractSRD,
  readExtractedData,
  readAssetAsBase64,
  readAssetAsBuffer,
  cleanupTempDir
};
