# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
