<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { aiService } from '../services/ai';
  import { settingsService } from '../services/settings';
  import { blockService } from '../services/block';
  import type { AIChatMessage, Conversation, ConversationMessage, AIOperationType } from '../types';
  import { DEFAULT_PROMPTS } from '../types';

  // Props
  export let onOpenSettings: () => void = () => {};
  export let i18n: Record<string, any> = {};

  // State
  let messages: ConversationMessage[] = [];
  let inputText = '';
  let isStreaming = false;
  let currentConversationId: string | null = null;
  let conversations: Conversation[] = [];
  let showHistory = false;
  let messagesContainer: HTMLDivElement;

  // Quick actions
  $: quickActions = [
  { type: 'polish' as AIOperationType, label: i18n.chat?.quickActions?.polish || i18n.operations?.polish || 'Polish', icon: '✨' },
  { type: 'translate' as AIOperationType, label: i18n.chat?.quickActions?.translate || i18n.operations?.translate || 'Translate', icon: '🌐' },
  { type: 'summarize' as AIOperationType, label: i18n.chat?.quickActions?.summarize || i18n.operations?.summarize || 'Summarize', icon: '📝' },
  { type: 'expand' as AIOperationType, label: i18n.chat?.quickActions?.expand || i18n.operations?.expand || 'Expand', icon: '📖' }
  ];

  onMount(() => {
    loadConversations();
    const currentProvider = settingsService.getCurrentProvider();
    if (currentProvider) {
      aiService.setProvider(currentProvider);
    }
  });

  function loadConversations() {
    conversations = settingsService.getConversations();
  }

  function isStreamingEnabled(): boolean {
    return !!settingsService.getSettings().enableStreamingOutput;
  }

  function getInterfaceLanguageName(): string {
    const fromI18n = i18n?.meta?.languageName;
    if (typeof fromI18n === 'string' && fromI18n.trim()) {
      return fromI18n.trim();
    }

    try {
      const lang = (window as any)?.siyuan?.config?.lang;
      if (lang === 'en_US' || lang === 'en-US') {
        return 'English';
      }
    } catch {
      // ignore
    }

    return '简体中文';
  }

  async function requestWithMode(
    aiMessages: AIChatMessage[],
    onProgress?: (accumulated: string) => void
  ) {
    if (!isStreamingEnabled()) {
      return aiService.chatCompletion(aiMessages);
    }

    try {
      return await aiService.streamChatCompletion(aiMessages, (_chunk, accumulated) => {
        if (onProgress) {
          onProgress(accumulated);
        }
      });
    } catch (streamError) {
      console.warn('[AI Assistant] Chat streaming failed, fallback to non-streaming:', streamError);
      return aiService.chatCompletion(aiMessages);
    }
  }

  async function sendMessage() {
    if (!inputText.trim() || isStreaming) return;

    const userMessage: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now()
    };

    messages = [...messages, userMessage];
    inputText = '';
    isStreaming = true;

    scrollToBottom();

    try {
      const aiMessages: AIChatMessage[] = [
        { 
          role: 'system', 
          content: `${i18n.chat?.strictSystemPromptUi || i18n.chat?.strictSystemPrompt || `你是专业写作助手。请严格遵守：

【核心规则】
1. 【绝对禁止】输出"好的"、"以下是"、"修改结果"等任何引导语
2. 【绝对禁止】解释修改理由、添加总结、或提供示例
3. 【绝对禁止】在结果后附加额外说明（如"如果您需要...请告诉我"）
4. 【必须直接】只给出可替换原文的纯文本结果
5. 【格式保持】保持原文的段落、换行、标点格式
6. 【绝对禁止】输出多个候选版本（如版本1/版本2、A/B方案、Option 1/2）
7. 【必须仅输出】单一最终版本，不能让用户二次选择
8. 【语言一致】你的思考过程（若模型会返回）与最终正文必须与思源界面语言一致

【禁止示例】
❌ "这句话翻译成英文是："
❌ "**This is a test.**"
❌ "如果您需要翻译成其他语言..."
❌ "以下是修改后的内容："
❌ "修改完成，以上结果保持了原文风格"

【正确示例】
原文：你好世界
输出：Hello World

输出必须是纯文本，用户应可直接复制使用，无需二次处理或删除任何内容。`}\n\n【界面语言强制】思考过程（若模型返回）与最终正文，必须使用 ${getInterfaceLanguageName()}。`
        },
        ...messages.map(m => ({ role: m.role, content: m.content }) as AIChatMessage)
      ];

      let accumulatedContent = '';
      const assistantMessage: ConversationMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      messages = [...messages, assistantMessage];

      const response = await requestWithMode(aiMessages, (content) => {
        const index = messages.findIndex(m => m.id === assistantMessage.id);
        if (index >= 0) {
          messages[index] = { ...assistantMessage, content };
          messages = [...messages];
        }
      });

      accumulatedContent = response.content;
      
      const index = messages.findIndex(m => m.id === assistantMessage.id);
      if (index >= 0) {
        messages[index] = { ...assistantMessage, content: accumulatedContent };
        messages = [...messages];
      }

      await saveConversation();
    } catch (error) {
      messages = [...messages, {
        id: generateId(),
        role: 'assistant',
        content: i18n.messages?.error || 'Processing failed, please check configuration',
        timestamp: Date.now()
      }];
    } finally {
      isStreaming = false;
      scrollToBottom();
    }
  }

  async function handleQuickAction(type: AIOperationType) {
    const selectedText = blockService.getSelectedText();
    if (!selectedText) {
      inputText = DEFAULT_PROMPTS[type];
      return;
    }

    const userMessage: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content: `[${type}] ${selectedText.substring(0, 50)}...`,
      timestamp: Date.now()
    };

    messages = [...messages, userMessage];
    isStreaming = true;
    scrollToBottom();

    try {
      const assistantMessage: ConversationMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      messages = [...messages, assistantMessage];

      const operationPrompt = settingsService.getSettings().operationPrompts?.[type] || DEFAULT_PROMPTS[type];
      const aiMessages = aiService.buildOperationMessages(selectedText, type, operationPrompt);
      const response = await requestWithMode(aiMessages, (content) => {
        const index = messages.findIndex(m => m.id === assistantMessage.id);
        if (index >= 0) {
          messages[index] = { ...assistantMessage, content };
          messages = [...messages];
        }
      });
      
      const index = messages.findIndex(m => m.id === assistantMessage.id);
      if (index >= 0) {
        messages[index] = { ...assistantMessage, content: response.content };
        messages = [...messages];
      }

      await saveConversation();
    } catch (error) {
      messages = [...messages, {
        id: generateId(),
        role: 'assistant',
        content: i18n.messages?.error || 'Processing failed, please check configuration',
        timestamp: Date.now()
      }];
    } finally {
      isStreaming = false;
      scrollToBottom();
    }
  }

  async function saveConversation() {
    if (messages.length === 0) return;

    const title = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '');
    
    const conversation: Conversation = {
      id: currentConversationId || generateId(),
      title,
      messages: [...messages],
      createdAt: currentConversationId ? conversations.find(c => c.id === currentConversationId)?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now()
    };

    currentConversationId = conversation.id;
    await settingsService.addConversation(conversation);
    loadConversations();
  }

  function startNewChat() {
    if (messages.length > 0) {
      saveConversation();
    }
    messages = [];
    currentConversationId = null;
  }

  function loadConversation(id: string) {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      messages = [...conversation.messages];
      currentConversationId = id;
      showHistory = false;
      scrollToBottom();
    }
  }

  async function deleteConversation(id: string, event: Event) {
    event.stopPropagation();
    if (confirm(i18n.chat?.deleteConfirm || 'Are you sure you want to delete this conversation?')) {
      await settingsService.deleteConversation(id);
      if (currentConversationId === id) {
        startNewChat();
      }
      loadConversations();
    }
  }
  
  async function clearAllConversations() {
    if (confirm(i18n.chat?.clearAllConfirm || 'Are you sure you want to clear all conversation history?')) {
      await settingsService.clearAllConversations();
      conversations = [];
      if (currentConversationId) {
        startNewChat();
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function scrollToBottom() {
    tick().then(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function getLocale(): string {
    return i18n.meta?.languageName === 'English' ? 'en-US' : 'zh-CN';
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(getLocale(), {
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
</script>

<div class="ai-chat-panel">
  <!-- Header -->
<div class="chat-header">
    <div class="header-title">
      <span class="icon">🤖</span>
      <span>{i18n.title || 'AI Assistant'}</span>
    </div>
    <div class="header-actions">
      <button class="btn-icon" on:click={() => showHistory = !showHistory} title={i18n.chat?.history || 'History'}>
        📚
      </button>
      <button class="btn-icon" on:click={startNewChat} title={i18n.chat?.newChat || 'New Chat'}>
        ➕
      </button>
      <button class="btn-icon" on:click={onOpenSettings} title={i18n.settings?.title || 'Settings'}>
        ⚙️
      </button>
    </div>
  </div>

  <!-- History Sidebar -->
  {#if showHistory}
    <div class="history-sidebar">
      <div class="history-header">
        <h3>{i18n.chat?.history || 'History'}</h3>
        <button class="btn-close" on:click={() => showHistory = false}>✕</button>
      </div>
      <div class="history-list">
        {#each conversations as conversation}
          <div 
            class="history-item" 
            class:active={conversation.id === currentConversationId}
            on:click={() => loadConversation(conversation.id)}
          >
            <div class="history-title">{conversation.title}</div>
            <div class="history-meta">
              {new Date(conversation.updatedAt).toLocaleDateString()}
              <button 
                class="btn-delete" 
                on:click={(e) => deleteConversation(conversation.id, e)}
              >
                🗑️
              </button>
            </div>
          </div>
        {/each}
        {#if conversations.length === 0}
          <div class="history-empty">{i18n.chat?.noHistory || 'No conversation history'}</div>
        {/if}
      </div>
      {#if conversations.length > 0}
        <div class="history-footer">
          <button class="btn-clear-all" on:click={clearAllConversations}>
            🗑️ {i18n.chat?.clearAll || 'Clear All'}
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Messages -->
  <div class="messages-container" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="welcome-message">
        <div class="welcome-icon">🤖</div>
        <h2>{i18n.title || 'AI Assistant'}</h2>
        <p>{i18n.chat?.welcome || 'Select text and use quick actions, or start chatting directly'}</p>
        
        <div class="quick-actions">
          {#each quickActions as action}
            <button 
              class="quick-action-btn"
              on:click={() => handleQuickAction(action.type)}
            >
              <span class="icon">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      {#each messages as message}
        <div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
          <div class="message-avatar">
            {message.role === 'user' ? '👤' : '🤖'}
          </div>
          <div class="message-content">
            <div class="message-text">{message.content}</div>
            <div class="message-time">{formatTime(message.timestamp)}</div>
          </div>
        </div>
      {/each}
      {#if isStreaming}
        <div class="message assistant streaming">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Quick Actions Bar -->
  {#if messages.length > 0}
    <div class="quick-actions-bar">
      {#each quickActions as action}
        <button 
          class="quick-action-chip"
          on:click={() => handleQuickAction(action.type)}
          disabled={isStreaming}
        >
          {action.icon} {action.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Input Area -->
  <div class="input-area">
    <textarea
      bind:value={inputText}
      on:keydown={handleKeyDown}
      placeholder={i18n.chat?.placeholder || 'Type a message... (Enter to send, Shift+Enter for new line)'}
      disabled={isStreaming}
      rows="2"
    ></textarea>
    <button 
      class="send-btn"
      on:click={sendMessage}
      disabled={!inputText.trim() || isStreaming}
    >
      {isStreaming ? '⏳' : '➤'}
    </button>
  </div>
</div>

<style lang="scss">
  .ai-chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 16px;

      .icon {
        font-size: 20px;
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }
  }

  .btn-icon {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    border-radius: 6px;
    font-size: 16px;
    transition: background 0.2s;

    &:hover {
      background: var(--b3-theme-hover);
    }
  }

  .history-sidebar {
    position: absolute;
    top: 50px;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--b3-theme-background);
    z-index: 10;
    display: flex;
    flex-direction: column;

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--b3-border-color);

      h3 {
        margin: 0;
        font-size: 14px;
      }
    }

    .history-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .history-item {
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 4px;
      transition: background 0.2s;

      &:hover, &.active {
        background: var(--b3-theme-surface);
      }

      .history-title {
        font-size: 14px;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .history-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: var(--b3-theme-on-surface);
      }
    }

    .history-empty {
      text-align: center;
      padding: 40px 20px;
      color: var(--b3-theme-on-surface);
    }

    .btn-close, .btn-delete {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      opacity: 0.6;

      &:hover {
        opacity: 1;
      }
    }

    .history-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--b3-border-color);
      display: flex;
      justify-content: center;

      .btn-clear-all {
        background: none;
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
        color: var(--b3-theme-on-surface);
        transition: all 0.2s;

        &:hover {
          background: var(--b3-theme-error-light, rgba(239, 68, 68, 0.1));
          border-color: var(--b3-theme-error, #ef4444);
          color: var(--b3-theme-error, #ef4444);
        }
      }
    }
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .welcome-message {
    text-align: center;
    padding: 40px 20px;

    .welcome-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
    }

    p {
      color: var(--b3-theme-on-surface);
      margin-bottom: 24px;
    }
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .quick-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--b3-border-color);
    border-radius: 20px;
    background: var(--b3-theme-surface);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border-color: var(--b3-theme-primary);
    }
  }

  .message {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;

    &.user {
      flex-direction: row-reverse;

      .message-content {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);
      }
    }

    &.assistant .message-content {
      background: var(--b3-theme-surface);
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--b3-theme-surface);
      flex-shrink: 0;
    }

    .message-content {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      word-wrap: break-word;
    }

    .message-text {
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .message-time {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
    }
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 0;

    span {
      width: 8px;
      height: 8px;
      background: var(--b3-theme-on-surface);
      border-radius: 50%;
      animation: typing 1.4s infinite;

      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
  }

  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-10px); }
  }

  .quick-actions-bar {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid var(--b3-border-color);
    overflow-x: auto;
  }

  .quick-action-chip {
    padding: 6px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 16px;
    background: var(--b3-theme-surface);
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .input-area {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);

    textarea {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--b3-border-color);
      border-radius: 8px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      resize: none;
      font-family: inherit;
      font-size: 14px;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
      }

      &:disabled {
        opacity: 0.6;
      }
    }

    .send-btn {
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      cursor: pointer;
      font-size: 16px;
      transition: opacity 0.2s;

      &:hover:not(:disabled) {
        opacity: 0.9;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
</style>
