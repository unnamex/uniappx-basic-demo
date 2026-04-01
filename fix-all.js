const fs = require('fs');

// 1. Fix resource-preview.uvue
let rpPath = 'components/resource-preview/resource-preview.uvue';
let rp = fs.readFileSync(rpPath, 'utf8');
rp = rp.replace(/resource\!\.type/g, 'resType');
rp = rp.replace(/resource\!\.path/g, 'resPath');
rp = rp.replace(/resource\!\.name/g, 'resName');
rp = rp.replace(/resource\!\.duration/g, 'resDuration');
rp = rp.replace(/resource\!\.description/g, 'resDescription');
rp = rp.replace(/resource\!\.thumbnail/g, 'resThumbnail');
rp = rp.replace(/resource\!\.id/g, 'resId');

// Replace resource != null with template checking
rp = rp.replace(/v-if="resource == null"/g, 'v-if="resType == \'\'"');
// Note: we can keep v-else-if="resType == 'image'" etc directly.

const rpScriptAdd = `
	const resType = computed((): string => props.resource?.type ?? '')
	const resPath = computed((): string => props.resource?.path ?? '')
	const resName = computed((): string => props.resource?.name ?? '')
	const resDuration = computed((): number => props.resource?.duration ?? 0)
	const resThumbnail = computed((): string => props.resource?.thumbnail ?? '')
	const resDescription = computed((): string => props.resource?.description ?? '')
	const resId = computed((): string => props.resource?.id ?? '')
`;
rp = rp.replace(/const isPlaying = ref\(false\)/, rpScriptAdd + '\n	const isPlaying = ref(false)');
fs.writeFileSync(rpPath, rp, 'utf8');
console.log('Fixed resource-preview.uvue');

// 2. Fix index.uvue
let indPath = 'pages/index/index.uvue';
let ind = fs.readFileSync(indPath, 'utf8');
// Fix all (obj['key'] as string) ?? '' to (obj['key'] as string | null) ?? ''
ind = ind.replace(/\(node\['([^']+)'\] as string\)\s*\?\?\s*''/g, "(node['$1'] as string | null) ?? ''");
ind = ind.replace(/\(node\['([^']+)'\] as string\)/g, "(node['$1'] as string | null)");
// specially fix the ?? (node['status'] as string | null) ?? '' where it might be double
ind = ind.replace(/\(node\['status'\] as string \| null\) \?\?/g, "(node['status'] as string | null) ??");
ind = ind.replace(/\(node\['version'\] as string \| null\) \?\?/g, "(node['version'] as string | null) ??");
ind = ind.replace(/\(res\[0\]\['count'\] as number\)/g, "(res[0]['count'] as number | null) ?? 0");
ind = ind.replace(/selectedRow\.value!\['id'\] as string/g, "selectedRow.value!['id'] as string | null");
ind = ind.replace(/getString\(data\[0\], key as string\)/g, "getString(data[0], key as string | null ?? '')");

// Move enrichNodeForDisplay, loadGroupWeb, loadGroupSQL
const extractFn = (name) => {
    let r = new RegExp('(\/\/ #ifdef WEB\\s*)?async function ' + name + '\\s*\\([\\s\\S]*?\\n\\t}(\n\\t\/\/ #endif)?', 'g');
    if (!r.test(ind)) {
        r = new RegExp('(\/\/ #ifndef WEB\\s*)?async function ' + name + '\\s*\\([\\s\\S]*?\\n\\t}(\n\\t\/\/ #endif)?', 'g');
        if (!r.test(ind)) {
            r = new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\t}', 'g');
        }
    }
    let match = ind.match(r);
    if (match) {
        ind = ind.replace(match[0], '');
        return match[0] + '\n';
    }
    return '';
};
let fn1 = extractFn('enrichNodeForDisplay');
let fn2 = extractFn('loadGroupWeb');
let fn3 = extractFn('loadGroupSQL');

ind = ind.replace('	// 将节点数据绑定到 Group 中的各个组件', fn1 + fn2 + fn3 + '\n	// 将节点数据绑定到 Group 中的各个组件');

// Replace previewResource!.id etc in template (they are safe but compiler might complain)
ind = ind.replace(/previewResource!\./g, 'previewResource?.');

fs.writeFileSync(indPath, ind, 'utf8');
console.log('Fixed index.uvue');

// 3. Fix import.uvue
let impPath = 'pages/import/import.uvue';
let imp = fs.readFileSync(impPath, 'utf8');
imp = imp.replace(/v-if="!packageInfo.fileName"/g, 'v-if="packageInfo.fileName == \'\'"');
fs.writeFileSync(impPath, imp, 'utf8');
console.log('Fixed import.uvue');

// 4. Fix detail.uvue
let detPath = 'pages/process/detail.uvue';
let det = fs.readFileSync(detPath, 'utf8');
det = det.replace(/processInfo!\./g, 'processInfo?.');
fs.writeFileSync(detPath, det, 'utf8');
console.log('Fixed detail.uvue');

// 5. Fix dataPackage.uts
let dpPath = 'services/dataPackage.uts';
let dp = fs.readFileSync(dpPath, 'utf8');

const androidTryCatch = `			const executeDbSave = async () => {
				try {
					const uiConfigCount = saveUiConfigurationToDatabase(fullManifest)
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
dp = dp.replace(/try\s*\{\s*\/\/ 保存 UI 配置\s*let uiConfigCount = saveUiConfigurationToDatabase[\s\S]*?\}\s*\}\s*catch \(e: any\) \{\s*endTransaction\(\)\s*reject\(new Error\('数据库保存失败: ' \+ e\.toString\(\)\)\)\s*\}/, androidTryCatch);

const harmonyTryCatch = `			const executeDbSave = async () => {
				try {
					const uiConfigCount = saveUiConfigurationToDatabase(fullManifest)
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
dp = dp.replace(/try {\s*const uiConfigCount = saveUiConfigurationToDatabase\(fullManifest\)[\s\S]*?catch \(e: any\) {\s*endTransaction\(\)\s*reject\(new Error\('Harmony: 数据库保存失败: ' \+ e\.toString\(\)\)\)\s*\}/, harmonyTryCatch);


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
