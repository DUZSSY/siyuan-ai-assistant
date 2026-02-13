# AI Assistant Plugin

**Block-level AI text editing plugin for SiYuan Note** — Select, Edit, Done.

## Core Features

- 📝 **Block-Level AI Editing**: Select any text block and polish, translate, or summarize with one click
- 🤖 **Multi-AI Provider Support**: OpenAI, Ollama, DeepSeek, Moonshot, Zhipu AI, etc.
- ✨ **7 Smart Text Operations**: Polish, translate, summarize, expand, condense, rewrite, continue
- 📊 **Visual Diff Comparison**: Clearly shows modifications (deletions in red, additions in green)
- 🎯 **Precise Text Replacement**: Accurate positioning, supports multiple identical characters
- 🎨 **Smart Floating Toolbar**: Auto-appears on text selection, draggable and pinnable
- 🔒 **Privacy First**: API keys stored locally, supports Ollama local deployment

## Installation

1. Download `package.zip`
2. Extract to SiYuan Note's `data/plugins/siyuan-ai-assistant/` directory
3. Restart SiYuan Note
4. Configure AI provider in settings

## Quick Start

### Method 1: Floating Toolbar (Recommended)
1. Select any text in SiYuan Note
2. The floating toolbar automatically appears near the selected text
3. Click the AI operation you need (polish/translate/summarize, etc.)
4. View modifications in the Diff popup, then apply

### Method 2: Context Menu
1. Right-click the block icon
2. Select AI operation
3. View Diff comparison, then apply

### Method 3: Keyboard Shortcut
- `Alt+Cmd+A`: Open/close AI Assistant settings panel

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

### Other AI Providers

Supported services:
- **OpenAI** (GPT-3.5/4)
- **DeepSeek**
- **Moonshot (Kimi)**
- **Zhipu AI (GLM)**
- **Custom OpenAI-compatible API**

Add corresponding API keys in plugin settings.

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

## 📄 License

MIT License
