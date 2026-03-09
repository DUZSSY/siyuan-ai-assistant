# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.18] - 2026-02-21

### ✨ Added / 新增
- 📜 **新增操作历史记录功能** — 完整记录文本处理过程
  - 保存每次AI处理的原文和修改后文本（不截断）
  - 支持记录重新生成和切换模型的完整链路
  - 智能采样策略：最多保存8条历史，每条6个版本（前3+后3）
  - 只读查看模式：显示原文与任意版本的diff对比
  - 时间线展示：清晰显示处理过程和各版本操作类型
  - **New: Operation History** — Complete record of text processing workflow
  - Save original and modified text for each AI operation (no truncation)
  - Support recording regenerate and model switch chains
  - Smart sampling: max 8 histories, 6 versions each (first 3 + last 3)
  - Read-only view: display diff between original and any version
  - Timeline view: show processing steps and operation types
- 🌊 **新增流式响应支持** — 实时显示AI生成内容
  - 支持SSE流式传输，内容实时逐字显示
  - 支持推理模型的思维链展示（reasoning_content）
  - 兼容多种流式格式（OpenAI、DeepSeek等）
  - **New: Streaming Response Support** — Real-time AI content display
  - SSE streaming with character-by-character display
  - Support reasoning model chain-of-thought display
  - Compatible with multiple streaming formats

### 🔧 Improved / 优化
- 🎯 优化AI系统提示词，更严格控制输出格式 / Optimized AI system prompts for better output control
- 🔧 改进DiffViewer模型下拉列表滚动体验 / Improved DiffViewer model dropdown scrolling
- 🛡️ 增强错误处理和边界情况处理 / Enhanced error handling and edge case processing

### 🐛 Fixed / 修复
- 修复浮动工具栏下拉列表滚动时浮窗消失的问题
- Fixed floating toolbar disappearing when scrolling model dropdown
- 修复多轮对话后位置追踪不准确的问题
- Fixed position tracking issues after multiple dialogue rounds


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

