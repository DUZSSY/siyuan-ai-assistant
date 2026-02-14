# 智谱 AI API 代理服务 用于在保护API key的情况下提供一条直接可用的测试线路

## 重要声明

**本服务仅供测试使用**：
- 免费额度有限，不保证服务可用性
- 不确保一直可用
- 建议用户尽快配置自己的 API Key

## 功能

- 代理智谱 AI API（glm-4-flash 模型）
- 保护 API Key（服务端存储）
- 限制 max_tokens（最大 1000）
- 强制使用 glm-4-flash 模型

## 部署

### Replit（推荐） 
当前使用了免费层级，该线路至多可维持至 3/16/2026

1. 注册/登录 [replit.com](https://replit.com)
2. 创建 Node.js 项目
3. 复制 `index.js` 和 `package.json`
4. 在 Secrets 中添加 `ZHIPU_API_KEY`
5. 点击 Deploy

### 环境变量

- `ZHIPU_API_KEY`：智谱 AI API Key（必需）
- `PORT`：服务端口（可选，默认 3000）

## API 端点

- `GET /` - 健康检查
- `POST /v1/chat/completions` - 聊天补全（OpenAI 兼容格式）

## 限制

| 参数 | 限制 |
|------|------|
| 模型 | 强制 glm-4-flash |
| max_tokens | ≤ 1000 |
| temperature | 0-1.0 |
| stream | false |

## 许可

MIT License
