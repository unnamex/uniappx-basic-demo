const fs = require('fs');
let dpPath = 'services/dataPackage.uts';
let dp = fs.readFileSync(dpPath, 'utf8');

const androidTryCatch = `			const executeDbSave = async () => {
				try {
					let resourceCount = 0
					
					await saveProcessesToDatabase(processes)
					
					for (const res of allResources) {
						await saveResource(res)
						resourceCount++
					}
					console.log('Android: Saved resources:', resourceCount)
					
					setTransactionSuccessful()
					resolve({
						success: true,
						message: '导入成功',
						processCount: processes.length,
						uiConfigCount: uiConfigCount,
						resourceCount: resourceCount,
						importTime: 0
					})
				} catch(e: any | null) {
					endTransaction()
					reject(new Error(e != null ? e.toString() : '数据库保存失败'))
				}
			}
			executeDbSave().then(()=>{}).catch((e: any | null)=>{})`;

// Android fix
dp = dp.replace(/			\/\/\s+保存工艺数据\s+saveProcessesToDatabase\(processes\)\s*\.then\(async \(\) => \{\s*\/\/\s+保存资源元数据\s*try\s*\{\s*for\s*\(const\s+res\s+of\s+allResources\)\s*\{\s*await\s+saveResource\(res\)\s*resourceCount\+\+\s*\}\s*console\.log\('Android:\s+Saved\s+resources:',\s*resourceCount\)\s*\}\s*catch\s*\(e\)\s*\{\s*console\.error\('Android:\s+Save\s+resources\s+failed:',\s*e\)\s*\}\s*setTransactionSuccessful\(\)\s*resolve\(\{[\s\S]*?importTime:\s*0\s*\}\)\s*\}\)\s*\.catch\(\(e:\s*any\s*\|\s*null\)\s*=>\s*\{\s*endTransaction\(\)\s*throw\s+e\s*\}\)/, androidTryCatch);

const harmonyTryCatch = `			const executeDbSave = async () => {
				try {
					let resourceCount = 0
					
					await saveProcessesToDatabase(processes)
					
					for (const res of allResources) {
						await saveResource(res)
						resourceCount++
					}
					console.log('Harmony: 保存资源:', resourceCount)
					
					setTransactionSuccessful()
					resolve({
						success: true,
						message: '导入成功',
						processCount: processes.length,
						uiConfigCount: uiConfigCount,
						resourceCount: resourceCount,
						importTime: 0
					})
				} catch(e: any | null) {
					endTransaction()
					reject(new Error(e != null ? e.toString() : 'Harmony: 数据库保存失败'))
				}
			}
			executeDbSave().then(()=>{}).catch((e: any | null)=>{})`;

// Harmony fix
dp = dp.replace(/			\/\/\s+保存工艺数据\s+saveProcessesToDatabase\(processes\)\s*\.then\(async \(\) => \{\s*try\s*\{\s*for\s*\(const\s+res\s+of\s+allResources\)\s*\{\s*await\s+saveResource\(res\)\s*resourceCount\+\+\s*\}\s*console\.log\('Harmony:\s+保存资源:',\s*resourceCount\)\s*\}\s*catch\s*\(e\)\s*\{\s*console\.error\('Harmony:\s+保存资源失败:',\s*e\)\s*\}\s*setTransactionSuccessful\(\)\s*resolve\(\{[\s\S]*?importTime:\s*0\s*\}\)\s*\}\)\s*\.catch\(\(e:\s*any\s*\|\s*null\)\s*=>\s*\{\s*endTransaction\(\)\s*throw\s+e\s*\}\)/, harmonyTryCatch);


// Fix startsWith on implicitly un-typed map entries
dp = dp.replace(/\/\/ V1: 解析 processes 目录下的文件\s+for\s*\(\s*const\s*\[\s*fileName\s*,\s*content\s*\]\s*of\s*jsonFiles\s*\)\s*\{\s*if\s*\(\s*fileName\.startsWith\('processes\/'\)\s*\)\s*\{\s*const\s*processInfo\s*=\s*JSON\.parse\(content\)\s*as\s*ProcessInfo\s*processes\.push\(processInfo\)\s*\}\s*\}/g,
  `// V1: 解析 processes 目录下的文件
			jsonFiles.forEach((content: string, fileName: string) => {
				if (fileName.startsWith('processes/')) {
					const processInfo = JSON.parse(content) as ProcessInfo
					processes.push(processInfo)
				}
			})`);

fs.writeFileSync(dpPath, dp, 'utf8');
console.log('Fixed dataPackage.uts');
