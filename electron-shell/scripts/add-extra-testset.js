/**
 * 根据网易文章新增行话，补充测试集：
 * - 3条 slang 正样本（个/端平面/巩丝）
 * - 5条 oob 负样本（焙烧/浸出/轧钢/铸坯/轧辊）
 */
const fs = require('fs');
const path = require('path');

const testsetPath = path.join(__dirname, 'testset_real.json');
const testset = JSON.parse(fs.readFileSync(testsetPath, 'utf-8'));

// 3条 slang 正样本（行话嵌入，知识库可回答）
const newSlang = [
  {
    id: 'q196',
    type: 'slang',
    slangWord: '个（=毫米）',
    standardTerm: '毫米',
    query: '精车完了量了下，内孔还差3个量，是继续切还是直接送检？',
    expectedChunkIds: ['operation-2', 'step-1'], // 精车内孔 + 首件全检
    scenario: 'cnc-turning'
  },
  {
    id: 'q197',
    type: 'slang',
    slangWord: '端平面（=车平面）',
    standardTerm: '车端面',
    query: '壳体端平面光了一刀之后用百分表打，还是朴的，是转速不够还是走刀量太大？',
    expectedChunkIds: ['operation-0', 'step-0'], // 粗车外圆及端面 + 三爪卡盘校正
    scenario: 'cnc-turning'
  },
  {
    id: 'q198',
    type: 'slang',
    slangWord: '巩丝（=攻丝）',
    standardTerm: '攻丝',
    query: '减速机箱体螺纹孔要巩丝，巩完之后螺钉拧进去发涩是什么问题？',
    expectedChunkIds: ['operation-3'], // 箱体密封及注油（含螺纹连接）
    scenario: 'reducer-asm'
  }
];

// 5条 oob 负样本（冶金/炼钢行话，系统应拒绝回答）
const newOob = [
  {
    id: 'q199',
    type: 'oob',
    query: '焙烧温度控制在多少？焙烧时间和铁矿石粒度有什么关系？',
    note: '冶金/矿石焙烧，不在机加工艺范围'
  },
  {
    id: 'q200',
    type: 'oob',
    query: '浸出率不够怎么提升？用酸浸法还是助浸法？液固比要调多少？',
    note: '湿法冶炼浸出工艺，不在机加工艺范围'
  },
  {
    id: 'q201',
    type: 'oob',
    query: '轧钢机轧辊磨损了怎么换？换辊周期一般是多少？',
    note: '冶金/轧钢工艺，不在机加工艺范围'
  },
  {
    id: 'q202',
    type: 'oob',
    query: '铸坯从连铸机出来之后要怎么处理？铸坯的温度是多少？',
    note: '炼钢/连铸工艺，不在机加工艺范围'
  },
  {
    id: 'q203',
    type: 'oob',
    query: '高炉渣怎么处理？可以做水泥吗？',
    note: '炼铁/冶金副产品处理，不在机加工艺范围'
  }
];

const allNew = [...newSlang, ...newOob];
const updated = [...testset, ...allNew];

fs.writeFileSync(testsetPath, JSON.stringify(updated, null, 2), 'utf-8');

// 统计
const byType = {};
updated.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; });

console.log('✅ 写入完成！');
console.log('📊 最终测试集分布:');
Object.entries(byType).forEach(([k, v]) => {
  const bar = '█'.repeat(Math.round(v / 2));
  console.log(`  ${k.padEnd(6)} ${String(v).padStart(3)}条  ${bar}`);
});
console.log(`  ${'合计'.padEnd(6)} ${String(updated.length).padStart(3)}条`);
console.log('\n新增内容:');
newSlang.forEach(q => console.log(`  [slang +] ${q.id} 「${q.slangWord}」 ${q.query.substring(0, 25)}...`));
newOob.forEach(q => console.log(`  [oob   +] ${q.id} ${q.query.substring(0, 30)}...`));
