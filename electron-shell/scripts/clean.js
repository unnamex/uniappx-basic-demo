const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const releaseDir = path.join(__dirname, '../release');

function clean() {
    console.log('开始清理 release 目录...');

    // 1. 尝试结束可能占用文件的进程
    try {
        console.log('正在尝试结束相关进程...');
        // 结束 avpbc-pop-desktop.exe 进程
        execSync('taskkill /F /IM avpbc-pop-desktop.exe /T', { stdio: 'ignore' });
        // 结束 electron.exe 进程 (可选，可能会杀掉开发环境)
        // execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' });
    } catch (e) {
        // 进程可能本来就没运行，忽略错误
    }

    // 等待一小会儿确保进程完全退出
    console.log('等待系统释放文件锁...');
    
    // 2. 删除目录
    if (fs.existsSync(releaseDir)) {
        try {
            // 使用递归删除
            fs.rmSync(releaseDir, { recursive: true, force: true });
            console.log('成功清理 release 目录。');
        } catch (err) {
            console.error('清理失败: ', err.message);
            console.log('提示: 如果依然报错，请手动关闭所有打开的软件并重试，或者尝试重启电脑。');
            process.exit(1);
        }
    } else {
        console.log('release 目录不存在，无需清理。');
    }
}

clean();
