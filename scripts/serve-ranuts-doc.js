/**
 * 独立静态文件服务器 - 用于伺服 ranuts-document 构建产物
 * 解决 Vite dev server 无法正确处理 ranuts-document 复杂目录结构的问题
 * 
 * 使用方法: node scripts/serve-ranuts-doc.js
 * 默认端口: 5163
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5163;
const ROOT = path.resolve(__dirname, '..', 'static', 'ranuts-document');

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 解析请求路径（去掉 query string）
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, decodeURIComponent(urlPath));

  // 安全检查：防止路径穿越
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 尝试加 index.html
      const indexPath = path.join(filePath, 'index.html');
      if (!err && stats && stats.isDirectory()) {
        fs.access(indexPath, fs.constants.F_OK, (err2) => {
          if (!err2) {
            serveFile(indexPath, res);
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
      return;
    }
    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 
    'Content-Type': contentType,
    'Content-Disposition': 'inline', // 强制内联显示，防止浏览器或下载工具(如迅雷、IDM)拦截 .bin 等后缀强行弹窗下载
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' // 禁用缓存，确保开发时能拿到最新修改
  });
  stream.pipe(res);
  stream.on('error', () => {
    res.writeHead(500);
    res.end('Internal Server Error');
  });
}

server.listen(PORT, () => {
  console.log(`[ranuts-document] 静态文件服务器已启动: http://localhost:${PORT}`);
  console.log(`[ranuts-document] 根目录: ${ROOT}`);
});
