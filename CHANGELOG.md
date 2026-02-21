# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.17] - 2026-02-20

### ✨ Added / 新增
- 💬 **新增直接对话功能** — 在原有快捷按钮基础上增加独立对话界面
  - "💬 对话"按钮显示在最右侧并带分隔符，与其他功能清晰区分
  - 支持通过自然语言指令进行实时智能文本修改
  - 对话历史记录功能，支持持久化存储多轮对话
  - 智能输入框，支持自定义提示词和历史记录快速填充
  - **New: Direct Chat Dialog** — Added standalone chat interface alongside existing quick action buttons
  - "💬 Chat" button positioned at the far right with visual separator
  - Supports real-time intelligent text modification through natural language
  - Chat history tracking with persistent conversation storage
  - Smart input with customizable prompt suggestions

### 🔧 Improved / 优化
- 🔗 优化连接稳定性和显示效果 / Optimized connection stability and display performance
- ⚡ 加速结果显示速度，体验更流畅 / Accelerated result display speed
- 🎯 对话模式采用严格的AI输出控制，避免无关引导语 / Stricter AI output control in chat mode

### 🐛 Fixed / 修复
- 修复 DiffViewer 中 customInput 操作标题显示为 undefined 的问题
- Fixed DiffViewer title showing undefined for customInput operations
- 修复自定义输入对话框标题为空的问题
- Fixed empty dialog title in custom input dialogs

## [0.1.16] - 2026-02-17

### ✨ Added / 新增
- 超时时间增加到180秒，支持大模型处理 / Increased timeout to 180s for large model support
- 默认 max_tokens 增加到4096，避免文本截断 / Default max_tokens increased to 4096 to avoid truncation
- 增加8种详细错误提示 / Added 8 detailed error messages
- 自定义按钮配置增加非空校验 / Added non-empty validation for custom button configuration

### 🐛 Fixed / 修复
- 修复 DiffViewer 标题显示问题 / Fixed DiffViewer title display issue
- 修复右键菜单获取块内容为空的问题 / Fixed context menu empty content issue
- 修复自定义按钮空 prompt 处理问题 / Fixed custom button empty prompt handling
- 修复模型列表过长无法滚动问题（支持鼠标滚轮和触摸滚动）/ Fixed model dropdown scroll issue

## [0.1.15] - 2026-02-16

### ✨ Added
- 新增移动端代理支持，可在平板、手机等设备使用（已在华为MatePad测试，iOS未测试）
- Added mobile proxy support for tablets and phones (tested on Huawei MatePad, iOS not tested)
- 扩展支持的平台：后端增加 android、ios；前端增加 browser-mobile、mobile
- Extended platform support: backends added android, ios; frontends added browser-mobile, mobile

### 🐛 Fixed
- 修复自定义按钮无法读取选中文字的问题
- Fixed custom buttons not receiving selected text

### ⚠️ Notes
- 移动设备建议使用AI提供商的API服务
- Ollama局域网部署需注意CORS配置
- Mobile devices recommended to use AI provider APIs
- Ollama LAN deployment requires CORS configuration

## [0.1.14] - 2026-02-15

### 🐛 Fixed
- 修复右键菜单不显示的问题（适配新版思源事件结构）
- Fixed context menu not showing issue (adapted to new SiYuan event structure)
- 增强 Ctrl/Cmd+A 选中块弹出浮窗的逻辑
- Enhanced Ctrl/Cmd+A selection logic for floating toolbar popup
- 修复右键菜单获取块内容为空的问题
- Fixed right-click menu getting empty block content
- 右键菜单根据工具栏设置动态显示按钮
- Right-click menu now dynamically displays buttons based on toolbar settings

### ✨ Added
- 增加第二种测试AI线路作为备用方案
- Added second test AI connection as fallback option

### 📝 Changed
- 版本升级 (0.1.13 → 0.1.14)
- Version bump (0.1.13 → 0.1.14)

## [0.1.13] - 2026-02-15

### 🐛 Fixed
- 修复 i18n 问题：插件现在能根据思源笔记的语言设置正确显示中文/英文
- Fixed i18n issue: plugin now correctly displays in English/Chinese based on SiYuan Note's language settings
- 修复浮动工具栏按钮文本、右键菜单项、聊天面板、Diff 查看器和设置面板的国际化支持
- Fixed floating toolbar button text, context menu items, chat panel, diff viewer, and settings panel all support internationalization
- 修复工具栏提示文字、弹窗和对话框标题的国际化问题
- Fixed toolbar tooltips, alerts, and dialog titles now use i18n properly

### 📝 Changed
- 版本升级 (0.1.12 → 0.1.13)
- Version bump (0.1.12 → 0.1.13)

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
- 更新插件图片以符合市场要求
- Updated plugin images to meet bazaar requirements
- 修复 icon.png 和 preview.png 尺寸问题
- Fixed icon.png and preview.png size issues
- 更新描述和文档
- Updated description and documentation

### 📝 Changed
- 版本号更新 (0.1.7 → 0.1.8)
- Version bump (0.1.7 → 0.1.8)

## [0.1.7] - 2025-02-13

### 🐛 Fixed
- 更新插件图片以符合市场要求
- Updated plugin images to meet bazaar requirements
- 修复 icon.png 和 preview.png 尺寸问题
- Fixed icon.png and preview.png size issues
- 更新描述和文档
- Updated description and documentation

### 📝 Changed
- 版本号更新
- Version bump for bazaar submission

## [0.1.6] - 2025-02-13

### 🐛 Fixed
- 修复浮动工具栏在禁用后仍可唤起的 Bug
- Fixed floating toolbar still working after plugin disabled in bazaar
- 修复右键菜单不显示的问题
- Fixed context menu not showing (wrong settings retrieval method)
- 修复 ContextMenuManager 缺少 destroy 方法导致的错误
- Fixed ContextMenuManager missing destroy() method causing TypeError on unload
- 修复浮动工具栏事件监听器泄露导致的重复工具栏问题
- Fixed FloatingToolbar event listener leak causing multiple toolbars on plugin toggle
- 修复 eventBus 监听器未正确移除的问题
- Fixed eventBus listener not being removed on plugin unload
- 修复 uninstall 方法使用错误的存储键名
- Fixed uninstall() using wrong storage key (PLUGIN_ID → STORAGE_KEY)
- 移除所有调试日志（45处）
- Removed all debug console logs (45 instances)
- 清理打包的多余文件 icon.png.txt
- Cleaned up packaged icon.png.txt file

### 📝 Changed
- 版本号遵循 semver 规范（0.1.5.1 → 0.1.6）
- Version number now follows semver (0.1.5.1 → 0.1.6)

## [0.1.5.1] - 2025-02-13

### 🐛 Fixed
- 移除未使用的 toggleDock() 方法和顶部栏按钮
- Removed unused toggleDock() method and top bar button
- 移除调试 console.log 语句
- Removed debug console.log statements
- 添加正确的 uninstall() 方法用于清理配置
- Added proper uninstall() method for config cleanup
- 修复插件禁用时组件清理问题（不再出现重复工具栏）
- Fixed component cleanup on plugin disable (no more duplicate toolbars)

### ✨ Added
- 添加 disabledInPublish 到 plugin.json
- Added disabledInPublish to plugin.json

### 📝 Changed
- README.md 更新为英文
- README.md updated to English
- LICENSE 替换为正确的 MIT 文本
- LICENSE replaced with proper MIT text

## [0.1.5] - 2025-02-13

### ✨ Added
- 新增可拖拽浮动工具栏和置顶功能
- Draggable floating toolbar with pin functionality
- 置顶按钮保持工具栏固定位置
- Pin button to keep toolbar fixed in position
- 关闭按钮 (✕) 用于手动关闭工具栏
- Close button (✕) for manual toolbar dismissal
- 拖拽手柄 (⋮⋮) 方便工具栏重新定位
- Drag handle (⋮⋮) for easy toolbar repositioning

### 🐛 Fixed
- 基于索引定位的精准文本替换
- Precise text replacement with index-based positioning
- 修复 Diff 查看器显示整个块而非选中文本的问题
- Fixed Diff viewer showing full block instead of selected text
- 支持多相同字符定位
- Multiple same-character positioning support
- 置顶时工具栏自动隐藏
- Toolbar auto-hide when pinned

### 🎨 Improved
- 优化工具栏位置避免遮挡选中文本
- Better toolbar positioning to avoid covering selected text
- Diff 弹窗现在将选中文本显示为"原文"
- Diff popup now shows selected text as "original"
- 增强浮动工具栏用户体验
- Enhanced user experience with floating toolbar

## [0.1.0] - 2025-02-12

### 🎉 初始版本发布
- 支持多AI提供商（OpenAI、Ollama、DeepSeek、Moonshot、智谱AI）
- Multi-AI provider support (OpenAI, Ollama, DeepSeek, Moonshot, Zhipu AI)
- 文本处理：润色、翻译、总结、扩写、精简、改写、续写
- Text processing: polish, translate, summarize, expand, condense, rewrite, continue
- 支持历史保存的对话式AI
- Conversational AI with history saving
- Diff 查看器支持逐段接受/拒绝
- Diff viewer with accept/reject per segment
- 快速访问浮动工具栏
- Floating toolbar for quick access
- 右键菜单集成
- 右键菜单集成
- Context menu integration
- 聊天界面顶部面板
- Top panel for chat interface
- 提供商配置设置面板
- Settings panel for provider configuration
- i18n 支持（中文和英文）
- i18n support (Chinese and English)
