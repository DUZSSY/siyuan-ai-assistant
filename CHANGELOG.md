# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.12] - 2026-02-14

### ✨ Added
- Floating toolbar offset feature added, no longer covers selected text (80px offset)
- Floating toolbar pin feature optimized: dragging after pinning updates fixed position
- Floating toolbar pin feature optimized: automatically restore position after Diff viewer closes
- Floating toolbar updates automatically when default provider changed in settings (even when pinned)
- Test AI settings optimization: hidden API URL, API key, temperature, maxTokens
- Test AI identification optimized: use ID prefix (test-ai-) for easy extension
- Clear test connection status when switching/editing providers
- Built API proxy service (api-proxy/) for testing

### ⚠️ Important Notice
- Test AI has limited quota, availability not guaranteed, only glm-4-flash model supported

### 📝 Changed
- Version bump (0.1.11 → 0.1.12)

## [0.1.11] - 2026-02-14

### ✨ Added
- Built API proxy service (api-proxy/) for testing
- Added GLM test AI connection (free trial)

### ⚠️ Important Notice
- Test AI has limited quota, availability not guaranteed
- Test AI only supports glm-4-flash model with max 1000 tokens

### 📝 Changed
- Updated test AI name to indicate limited quota (for testing only)
- Version bump (0.1.10 → 0.1.11)

## [0.1.10] - 2026-02-14

### 📝 Changed
- Updated prompts with stricter output format requirements
- Version bump (0.1.9 → 0.1.10)

### 🐛 Fixed
- Optimized Diff viewer original text display: shows selected text instead of full block content

## [0.1.9] - 2026-02-14

### 🐛 Fixed
- Fixed AI provider configuration logic bug that caused random "AI error, please check provider configuration" alerts
- Added pre-operation configuration check to ensure provider is properly loaded

### 📝 Changed
- Version bump (0.1.8 → 0.1.9)
- Updated Zhipu AI template name from "GLM-4-Flash" to "Z.ai"
- Added Claude (Anthropic) provider template

### 🎨 Improved
- Removed donate button from floating toolbar
- Enhanced translation prompt for better language detection
- Auto-hide floating toolbar when diff viewer opens

### ⚠️ Known Issues
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
