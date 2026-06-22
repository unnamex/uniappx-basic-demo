const fs = require('fs');
const axios = require('axios');

const chunks = JSON.parse(fs.readFileSync('./ai-service/vector-index.json', 'utf8')).chunks;

// 负样本（领域外）
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

async function generateQuestions(chunk, count, isPro) {
  const prompt = isPro
    ? `你是一个车间技术专家。根据以下工艺内容，生成${count}个专业、术语准确的提问，模拟工程师或技术员的提问方式。
工艺内容: "${chunk.text.substring(0, 300)}"
直接输出问题列表，每行一个，不要任何序号或前缀。`
    : `你是一个车间的一线工人。根据以下工艺内容，生成${count}个高度口语化、接地气、甚至带点抱怨或俚语的提问。
工艺内容: "${chunk.text.substring(0, 300)}"
直接输出问题列表，每行一个，不要任何序号或前缀。`;

  try {
    const res = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: 'qwen2.5:7b',
      prompt: prompt,
      stream: false,
      options: { temperature: 0.7 }
    });
    return res.data.response.split('\n').map(q => q.trim().replace(/^[-*0-9.]+\s*/, '')).filter(q => q.length > 5);
  } catch (e) {
    console.error('LLM生成失败:', e.message);
    return [];
  }
}

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

  // 2. 遍历chunks生成领域内
  console.log(`开始从 ${chunks.length} 个chunk中生成测试题...`);
  
  // 选前25个chunk生成口语题，每个4题 = 100条 oral
  for (let i = 0; i < 25 && i < chunks.length; i++) {
    const c = chunks[i];
    console.log(`正在生成 oral: ${c.id}`);
    const qs = await generateQuestions(c, 4, false);
    for (const q of qs.slice(0, 4)) {
      testset.push({
        id: `q${String(idCounter++).padStart(3, '0')}`,
        type: 'oral',
        query: q,
        expectedChunkIds: [c.id],
        scenario: c.type
      });
    }
  }

  // 选剩下的chunk生成专业题，每个1-2题，凑够20条 pro
  let proCount = 0;
  for (let i = 25; i < chunks.length && proCount < 20; i++) {
    const c = chunks[i];
    console.log(`正在生成 pro: ${c.id}`);
    const qs = await generateQuestions(c, 2, true);
    for (const q of qs.slice(0, 2)) {
      testset.push({
        id: `q${String(idCounter++).padStart(3, '0')}`,
        type: 'pro',
        query: q,
        expectedChunkIds: [c.id],
        scenario: c.type
      });
      proCount++;
      if (proCount >= 20) break;
    }
  }

  fs.writeFileSync('testset.json', JSON.stringify(testset, null, 2), 'utf8');
  console.log(`测试集生成完成，共 ${testset.length} 条，已保存到 testset.json`);
}

main();
