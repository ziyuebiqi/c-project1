const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config(); // 如果你用 .env 文件存 token

const app = express();
const port = 3000; // 后端运行在 3000 端口

// 中间件
app.use(cors()); // 允许前端跨域请求
app.use(express.json()); // 解析 JSON 请求体

// 初始化魔塔 API 客户端
// 注意：把你完整的 ms- 令牌填在这里，或者写在 .env 文件里
const client = new OpenAI({
    apiKey: 'ms-c2b22f8d-7325-4228-9c09-6a2b7f75b628', // 替换为你的真实令牌
    baseURL: 'https://api-inference.modelscope.cn/v1'
});

// 处理聊天接口
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: '请求参数缺失，请提供 message' });
    }

    try {
        console.log(`收到前端消息: ${message}`);

        // 调用 deepseek-ai/DeepSeek-V4.1-Flash 模型
        const response = await client.chat.completions.create({
            model: 'Qwen/Qwen3.5-35B-A3B',
            messages: [
                { role: 'system', content: '你是一个专业的C语言AI小助手，负责解答C语言问题、批改代码。回答请简洁明了。' },
                { role: 'user', content: message }
            ],
            temperature: 0.6,
            max_tokens: 2048,
        });

        // 提取回复内容
        const aiReply = response.choices[0].message.content;
        
        // 返回给前端
        res.json({ reply: aiReply });

    } catch (error) {
        console.error('调用 API 出错:', error);
        res.status(500).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }
});

// 启动服务
app.listen(port, () => {
    console.log(`后端服务已启动: http://localhost:${port}`);
});

