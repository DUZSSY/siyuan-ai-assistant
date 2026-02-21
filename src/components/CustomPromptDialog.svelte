<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { settingsService } from '../services/settings';

  // Props
  export let selectedText: string = '';
  export let i18n: Record<string, any> = {};

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    confirm: string;
    cancel: void;
  }>();

  // State
  let inputValue: string = '';
  let history: string[] = [];
  let showHistory: boolean = false;
  let inputElement: HTMLTextAreaElement;
  let errorMessage: string = '';

  function handleConfirm() {
    const trimmedValue = inputValue.trim();
    
    // 输入验证
    if (!trimmedValue) {
      errorMessage = i18n.customInput?.emptyError || '请输入修改要求';
      return;
    }

    // 保存到历史记录
    settingsService.addCustomInputHistory(trimmedValue);
    
    dispatch('confirm', trimmedValue);
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function selectFromHistory(item: string) {
    inputValue = item;
    showHistory = false;
    if (inputElement) {
      inputElement.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Enter 发送（不包含 Shift）
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleConfirm();
    }
    // Esc 取消
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }

  function clearError() {
    errorMessage = '';
  }
  
  async function clearHistory() {
    if (confirm(i18n.customInput?.clearHistoryConfirm || '确定要清空所有历史记录吗？')) {
      await settingsService.clearCustomInputHistory();
      history = [];
      showHistory = false;
    }
  }
  
  // 拖拽功能
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dialogElement: HTMLDivElement;
  let dialogPosition = { x: 0, y: 0 };
  
  function handleDragStart(event: MouseEvent) {
    // 只有点击标题栏时才启动拖拽
    const target = event.target as HTMLElement;
    if (!target.closest('.dialog-header')) return;
    
    isDragging = true;
    const rect = dialogElement.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    // 防止文本选择
    event.preventDefault();
  }
  
  function handleDragMove(event: MouseEvent) {
    if (!isDragging) return;
    
    const x = event.clientX - dragOffsetX;
    const y = event.clientY - dragOffsetY;
    
    // 限制在视窗内
    const maxX = window.innerWidth - (dialogElement?.offsetWidth || 500);
    const maxY = window.innerHeight - (dialogElement?.offsetHeight || 400);
    
    dialogPosition.x = Math.max(0, Math.min(x, maxX));
    dialogPosition.y = Math.max(0, Math.min(y, maxY));
    
    dialogElement.style.transform = `translate(${dialogPosition.x}px, ${dialogPosition.y}px)`;
    dialogElement.style.margin = '0';
  }
  
  function handleDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  }
  
  onMount(() => {
    history = settingsService.getCustomInputHistory();
    if (inputElement) {
      inputElement.focus();
    }
    // 添加拖拽事件监听
    if (dialogElement) {
      dialogElement.addEventListener('mousedown', handleDragStart);
    }
  });
  
  onDestroy(() => {
    // 清理拖拽事件监听
    if (dialogElement) {
      dialogElement.removeEventListener('mousedown', handleDragStart);
    }
    // 清理全局拖拽事件
    if (isDragging) {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    }
  });
</script>

<div class="custom-prompt-dialog-overlay" on:click={handleCancel}>
  <div class="custom-prompt-dialog" bind:this={dialogElement} on:click|stopPropagation>
    <div class="dialog-header">
      <span class="dialog-title">{i18n.customInput?.title || '💬 自定义指令'}</span>
      <button class="btn-close" on:click={handleCancel}>✕</button>
    </div>

    <div class="dialog-content">
      <!-- 显示当前选中的文字 -->
      {#if selectedText}
        <div class="selected-text-section">
          <label>{i18n.customInput?.selectedText || '选中的文字：'}</label>
          <div class="selected-text-preview">
            {selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}
          </div>
        </div>
      {/if}

      <!-- 输入框 -->
      <div class="input-section">
        <label>{i18n.customInput?.instruction || '请输入您的修改要求：'}</label>
        <textarea
          bind:this={inputElement}
          bind:value={inputValue}
          on:keydown={handleKeyDown}
          on:input={clearError}
          placeholder={i18n.customInput?.placeholder || '例如：简化语言、增加技术细节、改为正式语气...'}
          rows="4"
          class:error={!!errorMessage}
        ></textarea>
        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}
      </div>

      <!-- 历史记录 -->
      {#if history.length > 0}
        <div class="history-section">
          <div class="history-header">
            <button
              class="btn-toggle-history"
              on:click={() => showHistory = !showHistory}
            >
              {showHistory ? '▼' : '▶'} {i18n.customInput?.history || '历史记录'} ({history.length})
            </button>
            <button
              class="btn-clear-history"
              on:click={clearHistory}
              title={i18n.customInput?.clearHistory || '清空历史'}
            >
              🗑️
            </button>
          </div>
          
          {#if showHistory}
            <div class="history-list">
              {#each history as item}
                <button 
                  class="history-item" 
                  on:click={() => selectFromHistory(item)}
                  title={item}
                >
                  {item.length > 30 ? item.substring(0, 30) + '...' : item}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- 快捷键提示 -->
      <div class="shortcuts-hint">
        <span>Enter {i18n.customInput?.send || '发送'}</span>
        <span>Shift+Enter {i18n.customInput?.newline || '换行'}</span>
        <span>Esc {i18n.customInput?.cancel || '取消'}</span>
      </div>
    </div>

    <div class="dialog-footer">
      <button class="btn-secondary" on:click={handleCancel}>
        {i18n.customInput?.cancelBtn || '取消'}
      </button>
      <button class="btn-primary" on:click={handleConfirm}>
        {i18n.customInput?.confirmBtn || '确认'}
      </button>
    </div>
  </div>
</div>

<style lang="scss">
  .custom-prompt-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .custom-prompt-dialog {
    background: var(--b3-theme-background, #fff);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
    cursor: move; // 表示可拖拽
    user-select: none; // 防止拖拽时选中文本

    .dialog-title {
      font-size: 16px;
      font-weight: 600;
    }

    .btn-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: var(--b3-theme-on-surface, #666);
      padding: 4px;
      
      &:hover {
        color: var(--b3-theme-on-background, #333);
      }
    }
  }

  .dialog-content {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .selected-text-section {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 13px;
      color: var(--b3-theme-on-surface, #666);
      margin-bottom: 6px;
    }

    .selected-text-preview {
      padding: 10px 12px;
      background: var(--b3-theme-surface, #f5f5f5);
      border-radius: 6px;
      font-size: 13px;
      color: var(--b3-theme-on-surface, #666);
      max-height: 80px;
      overflow-y: auto;
      line-height: 1.5;
    }
  }

  .input-section {
    margin-bottom: 16px;

    label {
      display: block;
      font-size: 13px;
      color: var(--b3-theme-on-surface, #666);
      margin-bottom: 6px;
    }

    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--b3-border-color, #e0e0e0);
      border-radius: 6px;
      background: var(--b3-theme-background, #fff);
      color: var(--b3-theme-on-background, #333);
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      min-height: 80px;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary, #4285f4);
      }

      &.error {
        border-color: #ef4444;
      }
    }

    .error-message {
      color: #ef4444;
      font-size: 12px;
      margin-top: 6px;
    }
  }

    .history-section {
    margin-bottom: 16px;

    .history-header {
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .btn-toggle-history {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 13px;
        color: var(--b3-theme-on-surface, #666);
        padding: 4px 0;

        &:hover {
          color: var(--b3-theme-on-background, #333);
        }
      }

      .btn-clear-history {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        opacity: 0.6;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
          color: var(--b3-theme-error, #ef4444);
        }
      }
    }

    .history-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .history-item {
        padding: 4px 10px;
        background: var(--b3-theme-surface, #f5f5f5);
        border: 1px solid var(--b3-border-color, #e0e0e0);
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        color: var(--b3-theme-on-surface, #666);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &:hover {
          background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.1));
          border-color: var(--b3-theme-primary, #4285f4);
          color: var(--b3-theme-primary, #4285f4);
        }
      }
    }
  }

  .shortcuts-hint {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--b3-theme-on-surface, #999);

    span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--b3-border-color, #e0e0e0);

    button {
      padding: 8px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.9;
      }
    }

    .btn-secondary {
      background: var(--b3-theme-surface, #f5f5f5);
      border: 1px solid var(--b3-border-color, #e0e0e0);
      color: var(--b3-theme-on-surface, #666);

      &:hover {
        background: var(--b3-theme-hover, #eee);
      }
    }

    .btn-primary {
      background: var(--b3-theme-primary, #4285f4);
      border: none;
      color: white;
    }
  }
</style>
