const fs = require('fs');
const axios = require('axios');
const path = require('path');

const CHUNKS_FILE = path.join(__dirname, '../ai-service/vector-index.json');
const TESTSET_FILE = path.join(__dirname, 'testset_real.json');

const chunks = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf8')).chunks;

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateQuestionsWithRetry(chunk, count, isPro, maxRetries = 5) {
  const prompt = isPro
    ? `你是一个车间技术专家。根据以下工艺内容，生成${count}个专业、术语准确的提问，模拟工程师或技术员的提问方式。
工艺内容: "${chunk.text.substring(0, 300)}"
要求：直接输出问题列表，每行一个，不要任何序号、前缀或多余的说明文字。`
    : `你是一个车间的一线工人。根据以下工艺内容，生成${count}个高度口语化、接地气、甚至带点抱怨或俚语的提问。
工艺内容: "${chunk.text.substring(0, 300)}"
要求：直接输出问题列表，每行一个，不要任何序号、前缀或多余的说明文字。`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post('http://127.0.0.1:11435/api/generate', {
        model: 'qwen2.5:7b',
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7, num_ctx: 1024 }
      }, { timeout: 60000 }); // 60s 超时

      const qs = res.data.response
        .split('\n')
        .map(q => q.trim().replace(/^[-*0-9.]+\s*/, ''))
        .filter(q => q.length > 5);
      
      if (qs.length > 0) return qs;
    } catch (e) {
      console.warn(`[重试 ${attempt}/${maxRetries}] LLM生成失败: ${e.message}。10秒后重试...`);
      await sleep(10000);
    }
  }
  console.error(`无法生成针对 chunk ${chunk.id} 的问题，已跳过。`);
  return [];
}

async function main() {
  let testset = [];
  let idCounter = 1;
  let oralProcessedChunks = 0;
  let proProcessedChunks = 0;

  // 1. 读取断点续传记录
  if (fs.existsSync(TESTSET_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(TESTSET_FILE, 'utf8'));
      if (Array.isArray(existing) && existing.length > 0) {
        testset = existing;
        idCounter = testset.length + 1;
        oralProcessedChunks = testset.filter(t => t.type === 'oral').length / 4;
        proProcessedChunks = testset.filter(t => t.type === 'pro').length / 2;
        console.log(`[断点续传] 已加载 ${testset.length} 条已有记录。oral进度:${oralProcessedChunks}/25, pro进度:${proProcessedChunks}/10`);
      }
    } catch(e) {
      console.warn("读取 testset_real.json 失败，将从头开始重新生成。");
    }
  }

  // 如果连领域外都没生成，先生成领域外
  if (testset.filter(t => t.type === 'oob').length === 0) {
    console.log("正在生成领域外负样本 (OOB)...");
    for (const q of oobQueries) {
      testset.push({
        id: `q${String(idCounter++).padStart(3, '0')}`,
        type: 'oob',
        query: q,
        expectedChunkIds: [],
        scenario: '领域外'
      });
    }
    fs.writeFileSync(TESTSET_FILE, JSON.stringify(testset, null, 2));
  }

  console.log("=== 开始生成领域内提问 ===");

  // 2. 生成 Oral (选前25个chunk，每个生成4题)
  for (let i = Math.floor(oralProcessedChunks); i < 25 && i < chunks.length; i++) {
    const c = chunks[i];
    console.log(`[Oral ${i+1}/25] 正在为 ${c.id} 生成4条口语化提问...`);
    const qs = await generateQuestionsWithRetry(c, 4, false);
    for (const q of qs.slice(0, 4)) {
      testset.push({
        id: `q${String(idCounter++).padStart(3, '0')}`,
        type: 'oral',
        query: q,
        expectedChunkIds: [c.id],
        scenario: c.type
      });
    }
    fs.writeFileSync(TESTSET_FILE, JSON.stringify(testset, null, 2)); // 每完成一个chunk实时存档
  }

  // 3. 生成 Pro (选后续的chunk，生成20题，约需要10个chunk)
  for (let i = 25 + Math.floor(proProcessedChunks); i < 35 && i < chunks.length; i++) {
    const c = chunks[i];
    console.log(`[Pro ${i-24}/10] 正在为 ${c.id} 生成2条专业提问...`);
    const qs = await generateQuestionsWithRetry(c, 2, true);
    for (const q of qs.slice(0, 2)) {
      testset.push({
        id: `q${String(idCounter++).padStart(3, '0')}`,
        type: 'pro',
        query: q,
        expectedChunkIds: [c.id],
        scenario: c.type
      });
    }
    fs.writeFileSync(TESTSET_FILE, JSON.stringify(testset, null, 2));
  }

  console.log(`\n✅ 真实测试集生成全部完成！共计 ${testset.length} 条记录。`);
  process.exit(0);
}

main();
