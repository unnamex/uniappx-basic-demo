# UniApp + Electron 离线AI工艺助手集成实施方案

适用场景：

-  UniApp 工艺查看器 
-  Electron Windows客户端 
-  无公网车间环境 
-  单机PC部署 
-  本地AI大模型 
-  工艺知识问答 
-  工艺知识增强（RAG） 

目标：

# 在现有工艺查看器基础上，集成离线AI工艺助手能力。

------

# 一、项目最终形态

最终系统：



```
工艺查看器（UniApp）        ↓Electron客户端        ↓本地AI服务(Node)        ↓本地工艺知识库        ↓Ollama        ↓Qwen / DeepSeek
```



最终能力：

-  AI工艺问答 
-  工艺知识查询 
-  风险提示 
-  工艺解释 
-  工艺推荐 
-  离线运行 
-  数据不出车间 

------

# 二、整体技术选型

# 前端

## 已有

-  UniApp 

------

# 客户端

## 已有

-  Electron 

------

# AI运行框架

## 推荐

# Ollama

原因：

-  本地部署简单 
-  API简单 
-  支持Windows 
-  支持CPU 
-  社区成熟 

------

# 本地模型

## 推荐

### 第一推荐

# Qwen2.5:7B

------

### 第二推荐

# DeepSeek-R1-Distill-Qwen-7B

------

# 本地知识库

第一阶段：

-  SQLite 
-  JSON 

第二阶段：

-  ChromaDB 
-  Milvus 

------

# 知识图谱

## 推荐

# Neo4j

------

# 本地AI服务

## 推荐

# Node.js

原因：

-  Electron天然支持 
-  开发速度快 
-  易于集成 
-  与UniApp通信方便 

------

# 三、项目目录结构（重要）

# 推荐结构



```
project-root│├── electron│   ├── main.js│   ├── preload.js│   └── ai-service│       ├── rag│       ├── llm│       ├── knowledge│       ├── graph│       └── routes│├── uniapp│├── local-data│   ├── process│   ├── vector-db│   └── graph-db│└── models
```



------

# 四、第一阶段目标（最重要）

注意：

# 第一阶段不要做复杂AI。

目标：

# “让AI先懂工艺”

必须完成：

-  本地模型 
-  AI聊天 
-  本地知识检索 
-  工艺问答 

------

# 五、实施步骤（核心）

# Step1：安装Ollama

下载：

[Ollama官网](https://ollama.com?utm_source=chatgpt.com)

------

# Windows安装完成后验证

终端执行：



```
ollama -v
```



------

# Step2：下载模型

推荐：



```
ollama run qwen2.5:7b
```



或者：



```
ollama run deepseek-r1:7b
```



------

# Step3：测试本地AI

执行：



```
curl http://localhost:11434/api/generate
```



------

# 测试Body



```
{  "model": "qwen2.5:7b",  "prompt": "什么是工艺规程？",  "stream": false}
```



------

# Step4：Electron集成本地AI服务

# 新建目录



```
electron/ai-service
```



------

# 安装依赖



```
npm install express axios cors
```



------

# 创建服务

# ai-service/server.js



```
const express = require('express')const axios = require('axios')const app = express()app.use(express.json())app.post('/chat', async (req, res) => {    const prompt = req.body.prompt    const result = await axios.post(        'http://localhost:11434/api/generate',        {            model: 'qwen2.5:7b',            prompt,            stream: false        }    )    res.json(result.data)})app.listen(3001, () => {    console.log('AI Service Running')})
```



------

# 启动服务



```
node server.js
```



------

# Step5：UniApp调用AI接口

# 示例



```
uni.request({    url: 'http://localhost:3001/chat',    method: 'POST',    data: {        prompt: 'TC4材料为什么不能高速切削？'    },    success(res) {        console.log(res.data)    }})
```



------

# 至此：

# AI已经接入完成。

------

# 六、第二阶段（真正关键）

# 加入工艺知识增强（RAG）

否则：

模型不懂你们企业工艺。

------

# 七、RAG实施方案（重点）

# 目标

让AI：

# “基于企业工艺知识回答问题”

------

# 八、知识来源

整理：

-  工艺规程 
-  工序说明 
-  工步说明 
-  风险提示 
-  注意事项 
-  PDF 
-  Word 
-  历史经验 

------

# 九、知识标准化（重要）

# 推荐格式



```
{  "id": 1,  "part": "XX结构件",  "procedure": "热处理",  "content": "TC4热处理温度不宜过高，避免材料变形"}
```



------

# 十、实现轻量RAG（推荐）

第一阶段：

# 不要向量数据库。

------

# 推荐：

# 关键词检索

------

# 实现流程



```
用户问题    ↓关键词提取    ↓本地知识搜索    ↓拼接Prompt    ↓发送给AI
```



------

# 示例

## 用户问题



```
TC4切削为什么容易烧刀？
```



------

# 检索结果



```
TC4导热性差，高速切削会导致热量集中，容易刀具磨损。
```



------

# 拼Prompt



```
你是一名工艺专家。以下是企业工艺知识：TC4导热性差，高速切削会导致热量集中，容易刀具磨损。请基于上述知识回答问题。用户问题：TC4切削为什么容易烧刀？
```



------

# 十一、Node实现RAG（核心）

# rag/search.js



```
const fs = require('fs')function searchKnowledge(question) {    const data = JSON.parse(        fs.readFileSync('./knowledge.json')    )    return data.filter(item => {        return question.includes(item.keyword)    })}module.exports = {    searchKnowledge}
```



------

# 十二、拼接Prompt

# rag/prompt.js



```
function buildPrompt(question, docs) {    let context = ''    docs.forEach(doc => {        context += doc.content + '\\n'    })    return `你是一名工艺专家。以下是企业工艺知识：${context}请基于上述知识回答用户问题。用户问题：${question}`}module.exports = {    buildPrompt}
```



------

# 十三、最终AI接口

# routes/chat.js



```
const express = require('express')const axios = require('axios')const { searchKnowledge } = require('../rag/search')const { buildPrompt } = require('../rag/prompt')const router = express.Router()router.post('/chat', async (req, res) => {    const question = req.body.question    const docs = searchKnowledge(question)    const prompt = buildPrompt(question, docs)    const result = await axios.post(        'http://localhost:11434/api/generate',        {            model: 'qwen2.5:7b',            prompt,            stream: false        }    )    res.json(result.data)})module.exports = router
```



------

# 十四、第三阶段（比赛高级版）

# 增加工艺知识图谱

------

# 推荐

# Neo4j

------

# 图谱实体



```
零件工艺路线工序工步材料设备风险缺陷
```



------

# 图谱关系



```
零件 -> 工艺路线工艺路线 -> 工序工序 -> 工步工序 -> 风险工序 -> 材料
```



------

# 十五、比赛重点展示功能（重要）

# 1. AI工艺问答

例如：



```
该工序注意事项是什么？
```



------

# 2. 工艺风险提醒

例如：



```
当前参数存在烧刀风险
```



------

# 3. AI解释工艺

例如：



```
为什么需要热处理？
```



------

# 4. AI推荐类似工艺

例如：



```
历史上类似零件工艺如下
```



------

# 十六、Electron最终部署方案（重要）

# 推荐最终安装包



```
工艺查看器.exe
```



内部包含：

-  Electron 
-  AI服务 
-  Ollama 
-  本地模型 
-  工艺知识库 

------

# 十七、推荐部署方式（非常重要）

# 方案A（推荐）

用户：

# 单独安装Ollama

优点：

-  简单 
-  稳定 
-  易维护 

------

# 方案B（高级）

Electron启动时：

# 自动拉起AI服务

------

# 十八、性能建议（重点）

# 推荐硬件

## 最低

-  i5 
-  16GB内存 

------

## 推荐

-  i7 
-  32GB内存 

------

# 模型建议

## 16GB内存

推荐：

# 7B模型

------

## 8GB内存

推荐：

# 3B模型

------

# 十九、开发优先级（非常重要）

# 第一优先级

必须完成：

-  Ollama 
-  AI聊天 
-  RAG 
-  本地知识检索 

------

# 第二优先级

建议完成：

-  Neo4j 
-  风险规则 
-  工艺推荐 

------

# 第三优先级

加分项：

-  鸿蒙语音 
-  多Agent 
-  数字孪生 

------

# 二十、最终项目定位（比赛用）

# 项目名称推荐

## 推荐1

# 《离线工艺知识智能助手》

------

## 推荐2

# 《基于本地大模型的工艺AI辅助平台》

------

## 推荐3

# 《面向车间场景的离线工艺智能系统》

------

# 二十一、你现在真正要做的事情（非常重要）

你不是：

# “接入一个聊天机器人”

而是：

# “让工艺知识智能化”

这才是整个项目真正的价值。