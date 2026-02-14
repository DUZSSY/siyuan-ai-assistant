/**
 * 智谱 AI API 代理服务
 * 
 * 重要说明：
 * - 本服务仅供测试使用
 * - 免费额度有限，不保证服务可用性
 * - 强制使用 glm-4-flash 模型
 * - max_tokens 限制为 1000
 * 
 * 部署平台：Replit / Cloudflare Workers / Vercel 等
 */

const express = require('express');
const https = require('https');
const app = express();

app.use(express.json());

// CORS 中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 健康检查
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Zhipu AI Proxy',
    model: 'glm-4-flash',
    version: '1.0.0',
    notice: 'Free tier - Limited quota - Test only'
  });
});

// 使用原生 https 模块
function makeRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(requestOptions, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          text: () => Promise.resolve(data)
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// 主要 API 端点
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, max_tokens = 300, temperature = 0.7 } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Missing or invalid 'messages' field"
      });
    }

    const apiKey = process.env.ZHIPU_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Server configuration error: ZHIPU_API_KEY not set'
      });
    }

    const requestBody = JSON.stringify({
      model: 'glm-4-flash',
      messages: messages,
      max_tokens: Math.min(max_tokens, 1000),
      temperature: Math.min(Math.max(temperature, 0), 1.0),
      stream: false
    });

    const response = await makeRequest(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(requestBody)
        }
      },
      requestBody
    );

    const responseText = await response.text();
    
    if (!response.ok) {
      return res.status(502).json({
        error: `Zhipu API error: ${responseText}`,
        status: response.status
      });
    }

    const data = JSON.parse(responseText);
    
    if (data.error) {
      return res.status(400).json({
        error: data.error.message || data.error
      });
    }

    const openAIFormat = {
      id: data.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'glm-4-flash',
      choices: data.choices ? data.choices.map(choice => ({
        index: choice.index || 0,
        message: {
          role: choice.message?.role || 'assistant',
          content: choice.message?.content || ''
        },
        finish_reason: choice.finish_reason || 'stop'
      })) : [],
      usage: data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    res.json(openAIFormat);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message,
      type: 'server_error'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`API endpoint: http://localhost:${PORT}/v1/chat/completions`);
});
