const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRESET_KEY = "MPM_OFFLINE_2026_SECURE_KEY_256B";

function encryptSrdFile(inputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error(`错误: 找不到文件 ${inputPath}`);
        return;
    }

    const outputFileName = path.basename(inputPath, '.srd') + '_encrypted.srd';
    const outputPath = path.join(path.dirname(inputPath), outputFileName);

    try {
        // 读取未加密的 .srd 文件 (实际上是ZIP)
        const zipData = fs.readFileSync(inputPath);

        // 1. 随机生成 16 字节的 IV
        const iv = crypto.randomBytes(16);

        // 2. 构建 AES-256 密钥（取前 32 字节）
        const key = Buffer.from(PRESET_KEY.substring(0, 32), 'utf-8');

        // 3. 执行 AES/CBC/PKCS5Padding 加密 (在 Node 中 aes-256-cbc 默认使用 PKCS7，与 PKCS5 完全兼容)
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        // 执行加密
        const encryptedData = Buffer.concat([cipher.update(zipData), cipher.final()]);

        // 4. 按规范组装文件流：先写 16 字节 IV，再写密文
        const finalBuffer = Buffer.concat([iv, encryptedData]);

        // 输出加密后的文件
        fs.writeFileSync(outputPath, finalBuffer);

        console.log(`✅ 加密成功！`);
        console.log(`📄 原文件大小: ${(zipData.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`🔒 加密后文件: ${outputPath}`);
        console.log(`🔒 加密后大小: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`\n您现在可以尝试在客户端导入 [ ${outputFileName} ] 进行测试了！`);

    } catch (e) {
        console.error('加密失败:', e);
    }
}

// 接收命令行传参
const targetFile = process.argv[2];
if (!targetFile) {
    console.log('使用说明:');
    console.log('node encrypt_srd.js <待加密的.srd文件路径>');
    console.log('示例: node encrypt_srd.js ./test.srd');
} else {
    encryptSrdFile(targetFile);
}
