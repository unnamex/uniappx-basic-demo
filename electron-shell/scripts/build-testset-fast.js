const fs = require('fs');

const chunks = JSON.parse(fs.readFileSync('./ai-service/vector-index.json', 'utf8')).chunks;

// 预置领域外
const oobQueries = [
  "今天天气怎么样", "比特币现在多少钱", "帮我写一首关于春天的诗", "怎么做宫保鸡丁", "苹果手机怎么截图",
  "流浪地球2的导演是谁", "推荐几本好看的科幻小说", "怎样缓解颈椎病", "信用卡逾期了怎么办", "C++和Java哪个好",
  "中国的高铁有多快", "如何评价马斯克", "地球到月球有多远", "感冒了吃什么药", "世界上最高的山峰是哪座",
  "世界杯谁是冠军", "怎样快速减肥", "猫咪掉毛怎么办", "如何办理护照", "宇宙是怎么起源的",
  "股票怎么开户", "去日本旅游需要签证吗", "英雄联盟怎么打野", "周杰伦最好听的歌", "汽车机油多久换一次",
  "为什么天空是蓝色的", "怎么申请哈佛大学", "买房子需要注意什么", "电脑经常蓝屏怎么解决", "梦见掉牙是什么意思",
  "怎样做海绵蛋糕", "怎么看自己的星座", "跑步机什么牌子好", "考研复习时间怎么安排", "王者荣耀上分技巧",
  "五险一金怎么交", "飞机票怎么改签", "如何挑选二手车", "怎么腌制酸菜", "怀孕前三个月要注意什么",
  "三国演义是谁写的", "复联4大结局是什么", "什么牌子的防晒霜好用", "怎样清洗洗衣机", "路由器怎么设置密码",
  "去三亚旅游攻略", "狗可以吃巧克力吗", "怎么用烤箱烤地瓜", "如何挑选西瓜", "做俯卧撑的正确姿势"
];

const mockOralTemplates = [
  "这玩意儿怎么整？",
  "师傅，这个地方有什么讲究不？",
  "搞这块要注意点啥安全问题？",
  "这步参数一般设多少合适啊？"
];

const mockProTemplates = [
  "请提供该工序的关键工艺参数及容差范围。",
  "在该工艺步骤中，常见的质量缺陷及其预防措施是什么？",
  "请详述当前操作的标准规程和潜在风险评估。"
];

async function main() {
  const testset = [];
  let idCounter = 1;

  // 1. 生成领域外 (50条)
  for (const q of oobQueries) {
    testset.push({
      id: `q${String(idCounter++).padStart(3, '0')}`,
      type: 'oob',
      query: q,
      expectedChunkIds: [],
      scenario: '领域外'
    });
  }

  console.log(`开始从 ${chunks.length} 个chunk中生成测试题...`);
  
  // 2. 为每个chunk生成2条口语化提问，总计100条 oral
  for (const c of chunks) {
    const title = c.text.substring(0, 15).replace(/\n/g, ' ');
    testset.push({
      id: `q${String(idCounter++).padStart(3, '0')}`,
      type: 'oral',
      query: `关于${title}，${mockOralTemplates[0]}`,
      expectedChunkIds: [c.id],
      scenario: c.type
    });
    testset.push({
      id: `q${String(idCounter++).padStart(3, '0')}`,
      type: 'oral',
      query: `那个${title}，${mockOralTemplates[1]}`,
      expectedChunkIds: [c.id],
      scenario: c.type
    });
  }

  // 3. 为前20个chunk生成1条专业提问，总计20条 pro
  for (let i = 0; i < 20 && i < chunks.length; i++) {
    const c = chunks[i];
    const title = c.text.substring(0, 15).replace(/\n/g, ' ');
    testset.push({
      id: `q${String(idCounter++).padStart(3, '0')}`,
      type: 'pro',
      query: `针对${title}工艺，${mockProTemplates[i % mockProTemplates.length]}`,
      expectedChunkIds: [c.id],
      scenario: c.type
    });
  }

  fs.writeFileSync('testset.json', JSON.stringify(testset, null, 2), 'utf8');
  console.log(`测试集生成完成，共 ${testset.length} 条，已保存到 testset.json`);
}

main();
