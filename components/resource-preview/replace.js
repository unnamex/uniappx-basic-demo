const fs = require('fs');
const filePath = 'F:/workProject/avpbc-pop/components/resource-preview/resource-preview.uvue';
let content = fs.readFileSync(filePath, 'utf-8');

// 清理所有的 const res = ...
content = content.replace(/const res = props\.resource.*/g, '');

// 替换 res.path 和 null 判断
content = content.replace(/if \(res == null \|\| res\.path == ''\)/g, "if (resPath.value == '')");
content = content.replace(/res\.path/g, "resPath.value");

// 替换 res.name
content = content.replace(/res\.name/g, "resName.value");

// 替换 res.duration
content = content.replace(/if \(res == null \|\| res\.duration <= 0\)/g, "if (resDuration.value <= 0)");
content = content.replace(/res\.duration/g, "resDuration.value");

fs.writeFileSync(filePath, content, 'utf-8');
console.log('替换完成');
