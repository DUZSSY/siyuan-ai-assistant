# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
