# AI Assistant Plugin

**Block-level AI text editing plugin for SiYuan Note** — Select, Edit, Done.

## Core Features

- 📝 **Block-Level AI Editing**: Select any text block and polish, translate, or summarize with one click
- 💬 **Direct Chat Dialog**: Chat with AI using natural language for custom text modifications
- 🤖 **Multi-AI Provider Support**: OpenAI, Ollama, DeepSeek, Moonshot, Zhipu AI, etc.
- ✨ **7 Smart Text Operations**: Polish, translate, summarize, expand, condense, rewrite, continue
- 🔧 **3 Custom Buttons**: Configure your own AI operations with custom prompts
- 📊 **Visual Diff Comparison**: Clearly shows modifications (deletions in red, additions in green)
- 🎯 **Precise Text Replacement**: Accurate positioning, supports multiple identical characters
- 🎨 **Smart Floating Toolbar**: Auto-appears on text selection, draggable and pinnable
- 🔒 **Privacy First**: API keys stored locally, supports Ollama local deployment

## Quick Start

### Method 1: Floating Toolbar (Recommended)

1. Select any text in SiYuan Note
2. The floating toolbar automatically appears near the selected text
3. Click the AI operation you need:
   - **Quick Actions**: Polish, Translate, Summarize, Expand, Condense, Rewrite, Continue
   - **💬 Chat**: Open chat dialog for natural language text modification
   - **Custom Buttons**: Your configured custom operations
4. View modifications in the Diff popup, then apply

**Diff Viewer Features**:
- Accept/reject individual changes or apply all at once
- Directly edit the modified text before applying
- Regenerate with custom instructions

**Chat Mode**:
- Type natural language instructions (e.g., "make it more concise", "add technical details")
- Access conversation history and previous sessions
- Use quick action buttons within the chat interface

- ⚠️ **Known Issue**: The "original text" displayed on the left side of the Diff window may occasionally include content beyond the selected range. This is a display issue and does not affect the actual replacement

### Method 2: Context Menu

1. Right-click the block icon
2. Select AI operation
3. View Diff comparison, then apply

### Method 3: Chat Panel

1. Click the "💬 Chat" button in the floating toolbar
2. Enter your modification request in natural language
3. View results in Diff viewer and apply changes

## Configuration

### Recommended: Ollama Local Deployment (Free & Private)

1. Install [Ollama](https://ollama.com)
2. Pull a model:
   ```bash
   ollama pull llama3.2
   # or
   ollama pull qwen2.5
   ```
3. Select Ollama provider in plugin settings
4. Use default configuration (API: http://localhost:11434)

**🌐 Free Cloud Models Recommended** (No local deployment needed, available as of Feb 14, 2026):
- **GPT-OSS 120B** - OpenAI's open-source large model
- **Qwen3** - Latest version of Tongyi Qianwen
- **GLM-5** - Zhipu AI's next-generation model
- **Gemini 3 Flash** - Google's lightweight fast model

> 💡 These cloud models can be used via OpenAI API-compatible services. Please refer to each provider's documentation for specific configuration.

### Other AI Providers

Supported services:
- **OpenAI** (GPT-5.2 Instant ⭐recommended / GPT-5.2 Thinking / GPT-5.2 Pro)
- **Claude** (Claude Sonnet 4.5 ⭐recommended / Claude Opus 4.6)
- **DeepSeek** (DeepSeek-V3.2 / DeepSeek-R1)
- **Moonshot (Kimi)** (Kimi K2.5)
- **Zhipu AI (Z.ai)** (GLM-4-Flash ⭐free tier / GLM-4.7 / GLM-5)
- **Custom OpenAI-compatible API** (supports any OpenAI API format service)

**💡 Model Selection Guide:**
- **Daily use (polish/translate/chat)**: GPT-5.2 Instant, Claude Sonnet 4.5, GLM-4-Flash (free tier)
- **Professional writing/complex reasoning**: GPT-5.2 Thinking, Claude Opus 4.6, GLM-5
- **Maximum performance/coding**: GPT-5.2 Pro, Kimi K2.5

Add corresponding API keys in plugin settings.

### Toolbar Configuration

Customize which buttons appear in the floating toolbar:

1. Open plugin settings → **Toolbar** tab
2. Enable/disable standard operation buttons (polish, translate, etc.)
3. Custom buttons configured in "Custom Prompts" tab will auto-sync here

### Custom Buttons Configuration

Create up to 3 personalized AI operation buttons:

1. Open plugin settings → **Custom Prompts** tab
2. Enable and configure each custom button:
   - **Button Name**: Display name (e.g., "Convert to Table")
   - **Icon**: Emoji icon (e.g., 📊)
   - **AI Prompt**: Instructions for AI (e.g., "Convert the following content to table format")
3. Save to auto-sync to the floating toolbar

**💡 About Claude Support**
Claude is supported through OpenAI API-compatible interface. Configuration:
- API URL: `https://api.anthropic.com/v1`
- Model: `claude-3-sonnet-20240229` or `claude-3-opus-20240229`
- Requires Anthropic API Key

## ⚠️ Disclaimer

**Please read the following statements carefully before using this plugin:**

1. **AI-Generated Content Risk**: This plugin uses AI technology to generate content. AI results may be inaccurate, incomplete, or contain errors.

2. **Data Loss Risk**: Plugin operations may modify or delete your note content. We recommend backing up important data before use.

3. **Caution When Operating**: Please carefully review AI-generated content before using "Apply Changes" feature.

4. **API Provider Liability**: When using third-party AI services, please comply with respective service terms.

5. **Local Deployment Recommendation**: To protect data privacy, we recommend using **Ollama local deployment**.

**By using this plugin, you acknowledge and accept the above risks.**

## 🛡️ Privacy

- ✅ API keys stored locally only, never uploaded to any server
- ✅ Supports local Ollama deployment, data stays local
- ✅ Optional sensitive information masking
- ✅ Open source, auditable code

## 📝 Recent Updates

### v0.1.17
- 💬 **New: Direct Chat Dialog** — Added standalone chat interface alongside existing quick action buttons
  - "💬 Chat" button positioned at the far right with visual separator for clear distinction
  - Supports real-time intelligent text modification through natural language instructions
  - Chat history tracking with persistent conversation storage
  - Smart input with customizable prompt suggestions
- 🔗 Optimized connection stability and display performance
- ⚡ Accelerated result display speed for smoother experience

### v0.1.16
- ⏱️ Increased timeout from 60s to 180s for better large model support
- 📝 Increased default max_tokens from 2048 to 4096 to avoid truncation
- 🏷️ Fixed DiffViewer title to show custom button names
- ⚠️ Added detailed error messages (timeout, network, auth, rate limit, etc.)
- 🔧 Fixed empty prompt handling for custom buttons
- 🛡️ Added non-empty validation for custom button configuration
- 📜 Fixed model dropdown scroll issue for long provider lists

### v0.1.15
- ✨ Added mobile proxy support for tablets and phones (tested on Huawei MatePad)
- ✨ Extended platform support: backends added android, ios; frontends added browser-mobile, mobile
- 🐛 Fixed custom buttons not receiving selected text
- ⚠️ Mobile devices recommended to use AI provider APIs; Ollama LAN deployment requires CORS configuration

[View full changelog](https://github.com/DUZSSY/siyuan-ai-assistant/blob/main/CHANGELOG.md)

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

MIT License

## 🔗 Links

- [GitHub Repository](https://github.com/DUZSSY/siyuan-ai-assistant)
- [SiYuan Note Official](https://b3log.org/siyuan)
- [SiYuan Community](https://ld246.com/tags/siyuan)

MIT License

---

## 💝 Support Development

If this plugin helps you, consider supporting the author to continue development and maintenance!

[![Support](https://img.shields.io/badge/❤️-Support-red)](https://www.yuque.com/duzssy/mop740/fm59mkeo86fx5mu9?singleDoc)

Your support motivates me to keep improving the plugin! ❤️
