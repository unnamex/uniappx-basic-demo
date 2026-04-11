import sys

path = r'f:\workProject\avpbc-pop\services\dataPackage.uts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("console.log('Web: DB Save success');")
if idx == -1:
    print('Error: not found')
    sys.exit(1)

new_text = text[:idx] + """console.log('Web: DB Save success');
				resolve({
					success: true,
					message: '导入成功',
					nodeCount: processNode != null ? 1 : 0,
					uiConfigCount: uiConfigCount,
					resourceCount: resourceCount,
					importTime: 0
				})
			} catch (e: any) {
				console.error('Web: DB Save failed', e);
				reject(new Error('数据库保存失败: ' + e.message))
			}
			
		} catch (e: any) {
			console.error('Web: Extraction error', e);
			reject(new Error("Web 导入处理失败: " + e.message))
		}
	}).catch((e: any) => {
		console.error('Web: ZIP load failed in extraction', e);
		reject(new Error("ZIP 加载失败: " + e.message))
	})
}
// #endif


/**
 * 保存 UI 配置到数据库
 */
function saveUiConfigurationToDatabase(manifest: PackageManifest): number {
	let count = 0
	
	// 导入分组
	const groups = manifest.groups
	if (groups != null) {
		for (let i = 0; i < groups.length; i++) {
			const g = groups[i]
			executeSQL(
				"INSERT OR REPLACE INTO meta_tab_groups (id, name, description, sort_order) VALUES (?, ?, ?, ?)",
				[g.id, g.name, g.description, g.sort_order]
			)
			count++
		}
	}
	
	// 导入 Tab
	const tabs = manifest.tabs
	if (tabs != null) {
		for (let i = 0; i < tabs.length; i++) {
			const t = tabs[i]
			executeSQL(
				"INSERT OR REPLACE INTO meta_tabs (id, group_id, title, sort_order, visible_condition) VALUES (?, ?, ?, ?, ?)",
				[t.id, t.group_id, t.title, t.sort_order, t.visible_condition]
			)
			count++
		}
	}
	
	// 导入组件
	const components = manifest.components
	if (components != null) {
		for (let i = 0; i < components.length; i++) {
			const c = components[i]
			const configJson = c.config != null ? JSON.stringify(c.config) : ''
			
			executeSQL(
				"INSERT OR REPLACE INTO meta_components (id, tab_id, type, title, config_json, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
				[c.id, c.tab_id, c.type, c.title, configJson, c.sort_order]
			)
			count++
		}
	}
	
	// 导入数据记录
	const records = manifest.records
	if (records != null) {
		for (let i = 0; i < records.length; i++) {
			const r = records[i]
			const dataJson = r.data != null ? JSON.stringify(r.data) : ''
			
			executeSQL(
				"INSERT OR REPLACE INTO data_records (record_id, component_id, data_json, created_at) VALUES (?, ?, ?, ?)",
				[r.record_id, r.component_id, dataJson, Date.now()]
			)
			count++
		}
	}
	
	return count
}

/**
 * 保存工艺数据到数据库
 */
function saveProcessTreeToDatabase(processNode: ProcessNode): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const insertProcessSQL = `
			INSERT OR REPLACE INTO t_process 
			(inner_id, class_id, code, name, created_at, updated_at, data_json)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`

		const processParams: any[] = [
			processNode.innerId,
			processNode.classId,
			processNode.code,
			processNode.name,
			Date.now().toString(),
			Date.now().toString(),
			JSON.stringify(processNode)
		]

		executeSQL(insertProcessSQL, processParams)
			.then((_) => {
				resolve()
			})
			.catch((e: any) => {
				reject(new Error(e.toString()))
			})
	})
}
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Success')
