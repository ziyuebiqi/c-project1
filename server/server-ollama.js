// 最顶部加这一行，兼容 pdf-parse v2 在 Node 环境的依赖
require('pdf-parse/worker'); 

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001; 

app.use(cors());
app.use(express.json());

// ===== 文件上传配置 =====
const upload = multer({ dest: path.join(__dirname, 'uploads_tmp') });
const tmpDir = path.join(__dirname, 'uploads_tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const OLLAMA_URL = 'http://localhost:11434/api/chat';
// 确认此处是你现在测试的模型名称
const OLLAMA_MODEL = 'qwen3:4b'; //换成8b的pdf会对接错误

// ================= PDF 解析接口 =================
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '未收到 PDF 文件' });
    const filePath = req.file.path;
    
    try {
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy(); 
        
        const text = (result.text || '').trim();
        if (!text) return res.status(400).json({ error: 'PDF 中未提取到文本' });
        
        const MAX_LEN = 12000;
        const trimmed = text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '\n...(内容过长已截断)' : text;
        res.json({ text: trimmed });
    } catch (err) {
        console.error('PDF 解析失败:', err);
        res.status(500).json({ error: 'PDF 解析失败：' + err.message });
    } finally {
        fs.unlink(filePath, () => {});
    }
});

// ================= 聊天接口 =================
app.post('/api/ollama', async (req, res) => {
    const { message, pdfText } = req.body;

    if (!message) return res.status(400).json({ error: '请求参数缺失，请提供 message' });

    try {
        console.log(`收到前端消息: ${message}${pdfText ? ' [附带PDF上下文]' : ''}`);

        const systemContent = pdfText
            ? `你是一个专业的C语言AI小助手，负责解答C语言问题、批改代码。下面是一份用户上传的PDF资料，请结合它回答问题：\n\n【PDF资料开始】\n${pdfText}\n【PDF资料结束】`
            : '你是一个专业的C语言AI小助手，负责解答C语言问题、批改代码。回答请简洁明了。';

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: message }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Ollama 返回错误:', response.status, errText);
            return res.status(500).json({ error: 'Ollama 服务返回错误，请检查模型是否已加载' });
        }

        const data = await response.json();
        const aiReply = data.message && data.message.content ? data.message.content : '（模型未返回内容）';
        res.json({ reply: aiReply });

    } catch (error) {
        console.error('调用 Ollama 出错:', error);
        res.status(500).json({ error: '本地 AI 服务暂时不可用，请确认 Ollama 已启动并已拉取对应模型' });
    }
});

app.listen(port, () => {
    console.log(`Ollama 后端服务已启动: http://localhost:${port}`);
});

