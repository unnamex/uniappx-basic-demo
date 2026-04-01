const fs = require('fs');
let c = fs.readFileSync('pages/index/index.uvue', 'utf8');

c = c.replace('const iconConfigs = reactive(new Map<string, UTSJSONObject>())', '');

c = c.replace('<script setup lang="uts">', '<script setup lang="uts">\n\n\t// hoisted config\n\tconst iconConfigs = reactive(new Map<string, UTSJSONObject>())\n');

c = c.replace(/const enrichNodeForDisplay = \(node: UTSJSONObject\): UTSJSONObject => \{/g, 'function enrichNodeForDisplay(node: UTSJSONObject): UTSJSONObject {');

c = c.replace(/const loadGroupSQL = async \(groupId: string\): Promise<GroupVM \| null> => \{/g, 'async function loadGroupSQL(groupId: string): Promise<GroupVM | null> {');

c = c.replace(/const bindDataToGroup = \(group: GroupVM, node: UTSJSONObject\) => \{/g, 'function bindDataToGroup(group: GroupVM, node: UTSJSONObject) {');

c = c.replace(/const updateSelectedNodeInfo = \(node: UTSJSONObject\) => \{/g, 'function updateSelectedNodeInfo(node: UTSJSONObject) {');

c = c.replace(/const loadNodeResources = async \(nodeId: string, nodeName: string, nodeType: string\) => \{/g, 'async function loadNodeResources(nodeId: string, nodeName: string, nodeType: string) {');

c = c.replace(/const resetImageTransform = \(\) => \{/g, 'function resetImageTransform() {');

c = c.replace(/const flattenTree = \(nodes: UTSJSONObject\[\]\): UTSJSONObject\[\] => \{/g, 'function flattenTree(nodes: UTSJSONObject[]): UTSJSONObject[] {');

c = c.replace(/const resetData = async \(\) => \{/g, 'async function resetData() {');

c = c.replace(/const loadLeftPanel = async \(\) => \{/g, 'async function loadLeftPanel() {');

c = c.replace(/const loadDataForGroup = async \(group: GroupVM\) => \{/g, 'async function loadDataForGroup(group: GroupVM) {');

c = c.replace(/const loadTableData = async \(tableName: string\): Promise<UTSJSONObject\[\]> => \{/g, 'async function loadTableData(tableName: string): Promise<UTSJSONObject[]> {');

c = c.replace(/const loadIconConfigs = async \(\) => \{/g, 'async function loadIconConfigs() {');

c = c.replace(/const getIconPath = \(iconName: string\): string => \{/g, 'function getIconPath(iconName: string): string {');

fs.writeFileSync('pages/index/index.uvue', c, 'utf8');
console.log('Fixed script hoisting in index.uvue');
