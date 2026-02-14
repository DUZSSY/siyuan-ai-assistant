# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.12] - 2026-02-14

### ✨ Added
- 浮动工具栏增加位置偏移功能，不再遮挡选中文本（偏移距离80px）
- Floating toolbar offset feature added, no longer covers selected text (70px offset)
- 浮动工具栏置顶功能优化：置顶后手动拖拽可更新固定位置
- Floating toolbar pin feature optimized: dragging after pinning updates fixed position
- 浮动工具栏置顶功能优化：Diff窗口关闭后自动恢复到固定位置或原位置
- Floating toolbar: automatically restore position after Diff viewer closes
- 设置中切换默认模型后，浮动工具栏（置顶状态）自动更新显示
- Floating toolbar updates automatically when default provider changed in settings (even when pinned)

### 🎨 Improved
- 测试AI配置优化：隐藏API地址、API密钥，温度、最大Token等敏感/受限配置
- Test AI settings optimization: hidden API URL, API key, temperature, maxTokens
- 测试AI标识优化：通过ID前缀（test-ai-）识别，支持扩展多个测试AI
- Test AI identification optimized: use ID prefix (test-ai-) for easy extension
- 切换/编辑提供商时自动清除上次的测试连接状态
- Clear test connection status when switching/editing providers

### ⚠️ Important Notice
- 测试AI免费额度有限，不保证可用性，仅支持glm-4-flash模型
- Test AI has limited quota, availability not guaranteed, only glm-4-flash model supported

### 📝 Changed
- 搭建 API 中转服务（api-proxy/）供测试使用
- Built API proxy service (api-proxy/) for testing
- 版本号更新 (0.1.11 → 0.1.12)
- Version bump (0.1.11 → 0.1.12)

## [0.1.11] - 2026-02-14

### ✨ Added
- 搭建 API 中转服务（api-proxy/）供测试使用
- Built API proxy service (api-proxy/) for testing
- 新增 GLM 测试 AI 连接（免费试用）
- Added GLM test AI connection (free trial)

### ⚠️ Important Notice
- 测试 AI 免费额度有限，不保证可用性
- Test AI has limited quota, availability not guaranteed
- 测试 AI 仅支持 glm-4-flash 模型，max_tokens 限制为 1000
- Test AI only supports glm-4-flash model with max 1000 tokens

### 📝 Changed
- 更新测试 AI 名称为 "GLM（免费试用-额度有限-仅供测试）"
- Updated test AI name to indicate limited quota (for testing only)
- 版本号更新 (0.1.10 → 0.1.11)
- Version bump (0.1.10 → 0.1.11)

## [0.1.10] - 2026-02-14

### 📝 Changed
- 更新了提示词，增强输出格式要求（强调仅输出处理结果，不添加解释）
- Updated prompts with stricter output format requirements
- 版本号更新 (0.1.9 → 0.1.10)
- Version bump (0.1.9 → 0.1.10)

### 🐛 Fixed
- 优化了Diff窗口原文显示逻辑：优先显示选中的文字，而非整个块内容
- Optimized Diff viewer original text display: shows selected text instead of full block content

## [0.1.9] - 2026-02-14

### 🐛 Fixed
- 修复了AI提供商配置逻辑的bug，解决了"AI错误请检查提供商配置"有概率弹出的问题
- Fixed AI provider configuration logic bug that caused random "AI error, please check provider configuration" alerts
- 在每次AI操作前增加配置检查，确保provider正确加载
- Added pre-operation configuration check to ensure provider is properly loaded

### 📝 Changed
- 版本号更新 (0.1.8 → 0.1.9)
- Version bump (0.1.8 → 0.1.9)
- 智谱AI模板名称从"智谱AI (GLM-4-Flash)"改为"智谱AI (Z.ai)"
- Updated Zhipu AI template name from "GLM-4-Flash" to "Z.ai"
- 新增 Claude (Anthropic) 提供商模板
- Added Claude (Anthropic) provider template

### 🎨 Improved
- 移除浮动工具栏打赏按钮
- Removed donate button from floating toolbar
- 优化翻译提示词，加强语言检测和翻译要求
- Enhanced translation prompt for better language detection
- 对比窗口弹出后自动隐藏浮动工具栏
- Auto-hide floating toolbar when diff viewer opens

### ⚠️ Known Issues
- 原文显示偶尔超出选中文字范围（不影响实际替换功能）
- Original text display may occasionally show content beyond selection (does not affect replacement)

## [0.1.8] - 2025-02-13

### 🐛 Fixed
- Updated plugin images to meet bazaar requirements
- Fixed icon.png and preview.png size issues
- Updated description and documentation
- Version bump for bazaar submission

### 📝 Changed
- Version bump (0.1.7 → 0.1.8)

## [0.1.7] - 2025-02-13

### 🐛 Fixed
- Updated plugin images to meet bazaar requirements
- Fixed icon.png and preview.png size issues
- Updated description and documentation

### 📝 Changed
- Version bump for bazaar submission

## [0.1.6] - 2025-02-13

### 🐛 Fixed
- Fixed floating toolbar still working after plugin disabled in bazaar
- Fixed context menu not showing (wrong settings retrieval method)
- Fixed ContextMenuManager missing destroy() method causing TypeError on unload
- Fixed FloatingToolbar event listener leak causing multiple toolbars on plugin toggle
- Fixed eventBus listener not being removed on plugin unload
- Fixed uninstall() using wrong storage key (PLUGIN_ID → STORAGE_KEY)
- Removed all debug console logs (45 instances)
- Cleaned up packaged icon.png.txt file

### 📝 Changed
- Version number now follows semver (0.1.5.1 → 0.1.6)

## [0.1.5.1] - 2025-02-13

### 🐛 Fixed
- Removed unused toggleDock() method and top bar button
- Removed debug console.log statements
- Added proper uninstall() method for config cleanup
- Fixed component cleanup on plugin disable (no more duplicate toolbars)

### ✨ Added
- Added disabledInPublish to plugin.json

### 📝 Changed
- README.md updated to English
- LICENSE replaced with proper MIT text

## [0.1.5] - 2025-02-13

### ✨ Added
- Draggable floating toolbar with pin functionality
- Pin button to keep toolbar fixed in position
- Close button (✕) for manual toolbar dismissal
- Drag handle (⋮⋮) for easy toolbar repositioning

### 🐛 Fixed
- Precise text replacement with index-based positioning
- Fixed Diff viewer showing full block instead of selected text
- Multiple same-character positioning support
- Toolbar auto-hide when pinned

### 🎨 Improved
- Better toolbar positioning to avoid covering selected text
- Diff popup now shows selected text as "original"
- Enhanced user experience with floating toolbar

## [0.1.0] - 2025-02-12

### 🎉 Initial Release
- Multi-AI provider support (OpenAI, Ollama, DeepSeek, Moonshot, Zhipu AI)
- Text processing: polish, translate, summarize, expand, condense, rewrite, continue
- Conversational AI with history saving
- Diff viewer with accept/reject per segment
- Floating toolbar for quick access
- Context menu integration
- Top panel for chat interface
- Settings panel for provider configuration
- i18n support (Chinese and English)
