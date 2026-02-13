# AI助手插件

思源笔记AI助手插件，支持多种AI提供商，提供智能文本处理功能。

## 功能特性

- 🤖 多AI提供商支持（OpenAI、Ollama、DeepSeek、Moonshot等）
- ✨ 文本润色、翻译、总结、扩写
- 💬 对话式AI交互
- 📊 差异对比和接受/拒绝修改
- 🎯 浮动工具栏和右键菜单集成
- 📝 对话历史管理

## 安装

1. 下载 `package.zip`
2. 解压到思源笔记的 `data/plugins/siyuan-ai-assistant/` 目录
3. 重启思源笔记
4. 在设置中配置AI提供商

## 快速开始

1. 点击顶部栏的 🤖 图标打开AI助手面板
2. 或选中文本使用浮动工具栏
3. 配置AI提供商（推荐使用Ollama本地部署）

## 配置Ollama（推荐）

1. 安装 [Ollama](https://ollama.com)
2. 拉取模型：`ollama pull llama3.2`
3. 插件设置中使用默认Ollama配置

## 快捷键

- `Alt+Cmd+A`: 打开/关闭AI助手面板

## 隐私说明

- API密钥本地存储，不会上传到任何服务器
- 支持本地Ollama部署，数据完全本地处理
- 可选敏感信息脱敏

## 许可证

MIT
