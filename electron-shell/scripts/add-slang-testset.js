/**
 * 将车间行话嵌入的口语化测试用例写入 testset_real.json
 * 类型标记为 "slang"（行话），属于高压力CAS路由测试
 * 这些题目要求系统识别行话 -> REWRITE路由 -> 改写成标准术语 -> 正确检索
 */
const fs = require('fs');
const path = require('path');

const testsetPath = path.join(__dirname, 'testset_real.json');
const testset = JSON.parse(fs.readFileSync(testsetPath, 'utf-8'));

// 25条行话嵌入的工艺操作问题
// 行话 -> 标准术语 -> 对应知识库chunk
const slangQueries = [
  // ===== 热处理场景（蘸火=淬火，闷火=回火）=====
  {
    id: 'q171',
    type: 'slang',
    slangWord: '蘸火',
    standardTerm: '淬火',
    query: '齿轮渗碳完了之后要立刻蘸火吗？还是要等炉温降下来再蘸？',
    expectedChunkIds: ['operation-2'], // 淬火工序
    scenario: 'gear-ht'
  },
  {
    id: 'q172',
    type: 'slang',
    slangWord: '蘸火',
    standardTerm: '淬火',
    query: '蘸火的时候油温要控制在多少？油太凉了会不会蘸不硬？',
    expectedChunkIds: ['step-1'], // 淬火油温监控
    scenario: 'gear-ht'
  },
  {
    id: 'q173',
    type: 'slang',
    slangWord: '闷火',
    standardTerm: '回火',
    query: '蘸火完了要马上闷火吗？最长能等几个小时？闷火温度是多少？',
    expectedChunkIds: ['operation-3'], // 低温回火工序
    scenario: 'gear-ht'
  },
  {
    id: 'q174',
    type: 'slang',
    slangWord: '闷火',
    standardTerm: '回火',
    query: '这批齿轮闷火完了硬度还是不够，是不是闷火温度太高了把硬度给闷回去了？',
    expectedChunkIds: ['operation-3'],
    scenario: 'gear-ht'
  },

  // ===== TC4铣削场景（开粗=粗加工，打刀/勒刀=刀具故障，光=精加工，道/丝=0.01mm）=====
  {
    id: 'q175',
    type: 'slang',
    slangWord: '开粗',
    standardTerm: '粗铣',
    query: '叶片开粗用什么刀？转速和进给量怎么设？',
    expectedChunkIds: ['operation-1'], // 粗铣叶身型面
    scenario: 'tc4-milling'
  },
  {
    id: 'q176',
    type: 'slang',
    slangWord: '打刀',
    standardTerm: '刀具崩裂',
    query: '精铣叶身的时候打刀了，是不是转速设太高了？还是刀具磨损量超了？',
    expectedChunkIds: ['operation-3'], // 精铣叶身
    scenario: 'tc4-milling'
  },
  {
    id: 'q177',
    type: 'slang',
    slangWord: '勒刀',
    standardTerm: '铣刀塑变',
    query: '叶片铣了一半铣刀勒了，换刀还是换参数？是不是冷却液没开够？',
    expectedChunkIds: ['operation-1', 'operation-2'],
    scenario: 'tc4-milling'
  },
  {
    id: 'q178',
    type: 'slang',
    slangWord: '光一刀',
    standardTerm: '精铣最后一刀',
    query: '叶身型面最后光一刀，用什么刀具？转速要提到多少？',
    expectedChunkIds: ['operation-3'], // 精铣
    scenario: 'tc4-milling'
  },
  {
    id: 'q179',
    type: 'slang',
    slangWord: '道',
    standardTerm: '0.01mm',
    query: '精铣叶身型面公差是多少道？超了几道算废品？',
    expectedChunkIds: ['operation-3'],
    scenario: 'tc4-milling'
  },
  {
    id: 'q180',
    type: 'slang',
    slangWord: '朴',
    standardTerm: '形位精度不合格',
    query: '叶片装夹定位后百分表检查朴了，是夹具问题还是工件问题？',
    expectedChunkIds: ['step-0'], // 装夹定位工步
    scenario: 'tc4-milling'
  },

  // ===== 7075铝合金车削场景（扒外圆/扒黑皮=粗车外圆，光活=精加工，丝=0.01mm）=====
  {
    id: 'q181',
    type: 'slang',
    slangWord: '扒黑皮',
    standardTerm: '粗车毛坯外圆',
    query: '铝合金壳体扒黑皮的时候转速多少合适？一刀能吃多深？',
    expectedChunkIds: ['operation-0'], // 粗车外圆
    scenario: 'cnc-turning'
  },
  {
    id: 'q182',
    type: 'slang',
    slangWord: '扒外圆',
    standardTerm: '车外圆',
    query: '扒完外圆检查了跳动，百分表打着朴，是三爪卡盘没校正好吗？',
    expectedChunkIds: ['step-0'], // 三爪卡盘校正
    scenario: 'cnc-turning'
  },
  {
    id: 'q183',
    type: 'slang',
    slangWord: '光活',
    standardTerm: '精加工',
    query: '铝合金壳体内孔光活用什么刀？精车后表面粗糙度能到多少？',
    expectedChunkIds: ['operation-2'], // 精车外圆及内孔
    scenario: 'cnc-turning'
  },
  {
    id: 'q184',
    type: 'slang',
    slangWord: '丝',
    standardTerm: '0.01mm',
    query: '内孔精车留了几丝量，直接光活还是要再量一下？',
    expectedChunkIds: ['operation-2'],
    scenario: 'cnc-turning'
  },
  {
    id: 'q185',
    type: 'slang',
    slangWord: '崴刀',
    standardTerm: '刀具扎入工件',
    query: '车内孔的时候崴刀了，工件缺了一块，这种情况能不能补救？',
    expectedChunkIds: ['operation-1'], // 粗车内孔
    scenario: 'cnc-turning'
  },

  // ===== 精密减速机总装场景（公斤扳手=扭矩扳手，赶活=手动控制）=====
  {
    id: 'q186',
    type: 'slang',
    slangWord: '公斤扳手',
    standardTerm: '扭矩扳手',
    query: '减速机螺栓紧固要用公斤扳手，公斤扳手用之前要校准吗？怎么校？',
    expectedChunkIds: ['step-0'], // 力矩扳手校准
    scenario: 'reducer-asm'
  },
  {
    id: 'q187',
    type: 'slang',
    slangWord: '公斤扳手',
    standardTerm: '扭矩扳手',
    query: '针齿壳的螺栓用公斤扳手拧，扭矩值是多少？超了会不会把壳体拧裂？',
    expectedChunkIds: ['operation-2'], // 针齿壳装配
    scenario: 'reducer-asm'
  },
  {
    id: 'q188',
    type: 'slang',
    slangWord: '摇把',
    standardTerm: '手轮',
    query: '总装跑合试验时摇把转起来有异响，是轴承预紧力太大了吗？',
    expectedChunkIds: ['operation-4', 'step-1'], // 跑合试验+轴承预紧
    scenario: 'reducer-asm'
  },

  // ===== 304不锈钢TIG焊接场景（勒=挤压精加工/这里转义为焊缝打磨）=====
  {
    id: 'q189',
    type: 'slang',
    slangWord: '梢',
    standardTerm: '锥度',
    query: '焊接完管口有点梢，坡口角度没对上，重新打坡口要注意什么？',
    expectedChunkIds: ['operation-0'], // 焊前管口准备
    scenario: 'tig-welding'
  },
  {
    id: 'q190',
    type: 'slang',
    slangWord: '蘸火',
    standardTerm: '固溶热处理',
    query: '304不锈钢管路焊完要做固溶，和蘸火是一个意思吗？温度控制在多少？',
    expectedChunkIds: ['operation-3'], // 焊后固溶热处理
    scenario: 'tig-welding'
  },

  // ===== 伺服驱动器检测场景（弯尺=直角尺，道=精度单位）=====
  {
    id: 'q191',
    type: 'slang',
    slangWord: '弯尺',
    standardTerm: '直角尺',
    query: '驱动器外壳检验，用弯尺量了几个面，有个面朴了，这个能出货吗？',
    expectedChunkIds: ['operation-0'], // 外观及装配检查
    scenario: 'servo-test'
  },
  {
    id: 'q192',
    type: 'slang',
    slangWord: '打刀',
    standardTerm: '设备故障',
    query: '老化试验做了30小时，驱动器突然打刀（跳闸故障），要从头重新来吗？',
    expectedChunkIds: ['operation-4'], // 72小时老化试验
    scenario: 'servo-test'
  },

  // ===== 跨场景综合行话题 =====
  {
    id: 'q193',
    type: 'slang',
    slangWord: '开壳',
    standardTerm: '磨断屑槽',
    query: '车削铝合金壳体时切屑缠刀，需要给刀具开壳吗？还是换个带壳的刀？',
    expectedChunkIds: ['operation-0', 'operation-2'], // 车削工序
    scenario: 'cnc-turning'
  },
  {
    id: 'q194',
    type: 'slang',
    slangWord: '拉荒',
    standardTerm: '粗加工',
    query: '叶片先拉荒还是先蘸火？工艺路线上这两道工序哪个在前？',
    expectedChunkIds: ['operation-1', 'operation-2'], // 粗铣+热处理
    scenario: 'tc4-milling'
  },
  {
    id: 'q195',
    type: 'slang',
    slangWord: '朴',
    standardTerm: '同轴度超差',
    query: '减速机装好之后输出轴朴得厉害，同轴度超差，是轴承安装有问题吗？',
    expectedChunkIds: ['step-1'], // 轴承预紧调整
    scenario: 'reducer-asm'
  }
];

// 合并写入
const updated = [...testset, ...slangQueries];
fs.writeFileSync(testsetPath, JSON.stringify(updated, null, 2), 'utf-8');

// 统计
const byType = {};
updated.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; });
console.log('✅ 写入完成！');
console.log('📊 测试集分布:', JSON.stringify(byType));
console.log('📝 总计:', updated.length, '条');
console.log('\n行话测试用例列表:');
slangQueries.forEach(q => {
  console.log(`  ${q.id} [${q.slangWord}→${q.standardTerm}] ${q.query.substring(0, 30)}...`);
});
