<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte';
  import { diffService } from '../services/diff';
  import { settingsService } from '../services/settings';
  import type { InlineDiffResult, InlineDiffSegment, DiffStats, AIOperationType, AIProvider } from '../types';

  export let original: string;  // 完整块内容（用于应用修改时）
  export let modified: string;
  export let selectedText: string = '';  // 选中的文字（作为原文显示）
  export let showActions: boolean = true;
  export let operationType: AIOperationType = 'polish';
  export let blockId: string = '';
  export let i18n: Record<string, any> = {};
  export let reasoning: string = '';
  export let hasReasoning: boolean = false;
  
  export let historyId: string | null = null;
  export let isLoading: boolean = false;

  // 用于显示的原文：优先使用 selectedText（如果有实际内容），否则使用 original
  $: displayOriginal = (selectedText && selectedText.length > 0) ? selectedText : original;
  
  // 响应式逻辑：根据 modified 内容自动更新加载状态，或者由外部 isLoading prop 控制
  $: {
    if (typeof modified === 'string') {
      isLoading = modified.startsWith('⏳');
    }
  }

  // 只有在非加载状态下才计算差异结果，避免在加载提示（如⏳）上计算差异
  $: if (!isLoading && modified && !modified.startsWith('⏳')) {
    inlineResult = diffService.computeInlineDiff(displayOriginal, modified);
    stats = diffService.getInlineStats(inlineResult);
  } else {
    // 加载状态下，如果没有旧的 inlineResult，则显示基础内容
    if (!inlineResult) {
      inlineResult = {
        original: { segments: [{ type: 'equal', text: displayOriginal }] },
        modified: { segments: [] }
      };
    }
    stats = stats || { added: 0, removed: 0, equal: displayOriginal.length, modified: 0 };
  }

  const dispatch = createEventDispatcher<{
    apply: string;
    cancel: void;
    regenerate: { instruction: string; original: string; currentModified: string; operationType: AIOperationType };
    switchModel: string;
    viewHistory: void;
    directEdit: string;
  }>();

  let inlineResult: InlineDiffResult;
  let stats: DiffStats;
  let regenerateInstruction: string = '';
  let showRegeneratePanel: boolean = false;
  let isEditing: boolean = false;
  let editedModified: string = '';
  let showModelDropdown: boolean = false;
  let reasoningContentEl: HTMLDivElement | null = null;
  let lastReasoningLength = 0;
  let reasoningCollapsed: boolean = false;
  
  let providers: AIProvider[] = [];
  let currentProvider: AIProvider | null = null;
  let customButtonNames: Record<string, string> = {};

  // 获取操作名称：自定义按钮从设置中读取实际名称
  function getOperationName(op: AIOperationType): string {
    const staticNames: Record<AIOperationType, string> = {
      chat: i18n.operations?.chat || '对话',
      polish: i18n.operations?.polish || '润色',
      translate: i18n.operations?.translate || '翻译',
      summarize: i18n.operations?.summarize || '总结',
      expand: i18n.operations?.expand || '扩写',
      condense: i18n.operations?.condense || '精简',
      rewrite: i18n.operations?.rewrite || '改写',
      continue: i18n.operations?.continue || '续写',
      customInput: i18n.operations?.customInput || '对话',
      custom1: '自定义 1',
      custom2: '自定义 2',
      custom3: '自定义 3'
    };
    
    if (op.startsWith('custom') && customButtonNames[op]) {
      return customButtonNames[op];
    }
    
    return staticNames[op];
  }

  onMount(() => {
    refreshProviderInfo();
    loadCustomButtonNames();
  });

  function refreshProviderInfo() {
    const settings = settingsService.getSettings();
    providers = settings.providers;
    currentProvider = settingsService.getCurrentProvider();
  }
  
  function loadCustomButtonNames() {
    const settings = settingsService.getSettings();
    customButtonNames = {};
    settings.customButtons.forEach(btn => {
      // 加载所有自定义按钮的名称，无论是否启用
      customButtonNames[btn.id] = btn.name;
    });
  }

  function startEdit() {
    editedModified = modified;
    isEditing = true;
    refreshProviderInfo();
  }

  function saveEdit() {
    modified = editedModified;
    isEditing = false;
    inlineResult = diffService.computeInlineDiff(original, modified);
    stats = diffService.getInlineStats(inlineResult);
    
    // 触发事件，通知外部保存了直接编辑的内容
    dispatch('directEdit', modified);
  }

  function cancelEdit() {
    isEditing = false;
    editedModified = '';
  }

  function applyChanges() {
    dispatch('apply', modified);
  }

  function cancel() {
    dispatch('cancel');
  }

  function handleRegenerate() {
    if (!regenerateInstruction.trim()) {
      alert(i18n.diff?.regeneratePlaceholder || 'Please enter your modification requirements');
      return;
    }
    dispatch('regenerate', {
      instruction: regenerateInstruction,
      original: displayOriginal,
      currentModified: modified,
      operationType: operationType
    });
    regenerateInstruction = '';
    showRegeneratePanel = false;
  }

  function handleSwitchModel(providerId: string) {
    dispatch('switchModel', providerId);
    showModelDropdown = false;
    refreshProviderInfo();
  }

  function toggleModelDropdown() {
    showModelDropdown = !showModelDropdown;
    refreshProviderInfo();
  }

  function getSegmentClass(type: InlineDiffSegment['type']): string {
    switch (type) {
      case 'equal': return 'equal';
      case 'delete': return 'delete';
      case 'insert': return 'insert';
      default: return 'equal';
    }
  }

  afterUpdate(() => {
    if (!reasoningContentEl) {
      return;
    }

    if ((reasoning || '').length >= lastReasoningLength) {
      reasoningContentEl.scrollTop = reasoningContentEl.scrollHeight;
    }
    lastReasoningLength = (reasoning || '').length;
  });
</script>

<div class="diff-viewer">
  <!-- Header -->
  <div class="diff-header">
    <div class="diff-title">
      <span>📊 {getOperationName(operationType)}</span>
      
      <!-- 模型选择器 -->
      <div class="model-selector">
        <button class="model-btn" on:click={toggleModelDropdown}>
          {currentProvider ? currentProvider.name + ' : ' + currentProvider.model : (i18n.diff?.notConfigured || 'Not Configured')}
        </button>
        {#if showModelDropdown}
          <div class="model-dropdown">
            {#each providers as provider}
              <div 
                class="dropdown-item"
                class:active={provider.id === currentProvider?.id}
                on:click={() => handleSwitchModel(provider.id)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && handleSwitchModel(provider.id)}
              >
                <span>{provider.name}</span>
                <span class="model-name">: {provider.model}</span>
                {#if provider.id === currentProvider?.id}
                  <span class="check">✓</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    
      {#if showActions && !isLoading}
      <div class="diff-actions">
        {#if historyId}
          <button class="btn-history" on:click={() => dispatch('viewHistory')} title={i18n.history?.viewHistory || 'View History'}>
            <span class="icon">📜</span> {i18n.history?.viewHistory || 'History'}
          </button>
        {/if}
        <button class="btn-edit" on:click={isEditing ? cancelEdit : startEdit}>
          {isEditing ? '✕ ' + (i18n.diff?.cancelEdit || 'Cancel Edit') : '✏️ ' + (i18n.diff?.directEdit || 'Direct Edit')}
        </button>
        <button class="btn-regenerate" on:click={() => showRegeneratePanel = !showRegeneratePanel}>
          🔄 {i18n.diff?.regenerate || 'Regenerate'}
        </button>
        <button class="btn-apply" on:click={applyChanges}>
          ✓ {i18n.diff?.applyChanges || 'Apply Changes'}
        </button>
        <button class="btn-cancel" on:click={cancel}>
          {i18n.diff?.cancel || 'Cancel'}
        </button>
      </div>
    {/if}
  </div>

  <!-- 重新生成面板 -->
  {#if showRegeneratePanel && !isLoading && !isEditing}
    <div class="regenerate-panel">
      <div class="regenerate-header">
        <span>💬 {i18n.diff?.regenerateTitle || 'Regenerate - Adjust results based on your requirements'}</span>
        <button class="btn-close" on:click={() => showRegeneratePanel = false}>✕</button>
      </div>
      <div class="regenerate-content">
        <p class="regenerate-hint">
          {i18n.diff?.regenerateHint || '💡 Enter your requirements, AI will adjust based on the original and current results. For example: "Make it more concise", "Add more technical details", "More formal tone", etc.'}
        </p>
        <textarea
          bind:value={regenerateInstruction}
          placeholder={i18n.diff?.regeneratePlaceholder || 'Enter your modification requirements...'}
          rows="3"
          class="regenerate-input"
        ></textarea>
        <div class="regenerate-actions">
          <button class="btn-secondary" on:click={() => showRegeneratePanel = false}>{i18n.diff?.cancel || 'Cancel'}</button>
          <button 
            class="btn-primary" 
            on:click={handleRegenerate}
            disabled={!regenerateInstruction.trim()}
          >
            {i18n.diff?.sendRequest || 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if hasReasoning && reasoning && reasoning.trim().length > 0}
    <div class="reasoning-panel" aria-live="polite">
      <div class="reasoning-header">
        <span>🧠 {i18n.diff?.reasoningTitle || 'Thinking Process (streaming)'}</span>
        <button
          class="reasoning-toggle"
          type="button"
          on:click={() => reasoningCollapsed = !reasoningCollapsed}
        >
          {reasoningCollapsed
            ? (i18n.diff?.expandReasoning || 'Expand')
            : (i18n.diff?.collapseReasoning || 'Collapse')}
        </button>
      </div>
      {#if !reasoningCollapsed}
        <div class="reasoning-content" bind:this={reasoningContentEl}>{reasoning}</div>
      {/if}
    </div>
  {/if}

  <!-- 内容区域 -->
  <div class="diff-content-inline">
    <!-- 原文栏 -->
    <div class="diff-panel original">
      <div class="panel-header">
        <span>📝 {i18n.diff?.original || 'Original'}</span>
      </div>
      <div class="panel-content">
        <div class="text-content">
          {#each inlineResult.original.segments as segment}
            <span class="segment {getSegmentClass(segment.type)}">{segment.text}</span>
          {/each}
        </div>
      </div>
    </div>

    <!-- 修改后栏 -->
    <div class="diff-panel modified" class:editing={isEditing}>
      <div class="panel-header">
        <span>✨ {i18n.diff?.modified || 'Modified'}{isEditing ? ' (' + (i18n.diff?.cancelEdit?.replace('Cancel ', '') || 'Editing') + ')' : ''}</span>
      </div>
      <div class="panel-content">
        {#if isLoading}
          <div class="panel-loading">
            <div class="loading-spinner"></div>
            <p class="loading-hint">{i18n.messages?.processing || '正在请求AI处理...'}</p>
          </div>
        {:else if isEditing}
          <textarea
            class="edit-textarea"
            bind:value={editedModified}
            placeholder={i18n.diff?.editPlaceholder || 'Edit the modified content here...'}
            rows={Math.max(10, editedModified.split('\n').length)}
          ></textarea>
          <div class="edit-actions">
            <button class="btn-secondary" on:click={cancelEdit}>{i18n.diff?.cancel || 'Cancel'}</button>
            <button class="btn-primary" on:click={saveEdit}>{i18n.diff?.save || 'Save'}</button>
          </div>
        {:else}
          <div class="text-content">
            {#each inlineResult.modified.segments as segment}
              <span class="segment {getSegmentClass(segment.type)}">{segment.text}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

    <!-- 图例和统计 -->
  <div class="diff-legend">
    <span class="legend-item"><span class="legend-color equal"></span>{i18n.diff?.unchanged || 'Unchanged'}</span>
    <span class="legend-item"><span class="legend-color delete"></span>{i18n.diff?.delete || 'Deleted'}</span>
    <span class="legend-item"><span class="legend-color insert"></span>{i18n.diff?.insert || 'Inserted'}</span>
    {#if stats}
      <span class="stats-total">{i18n.diff?.modificationCount?.replace('{count}', String(stats.modified)) || stats.modified + ' modifications'}</span>
    {/if}
  </div>
</div>

<style lang="scss">
  .diff-viewer { display: flex; flex-direction: column; background: var(--b3-theme-background, #fff); border: 1px solid var(--b3-border-color, #e0e0e0); border-radius: 8px; overflow: visible; }
  .diff-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--b3-theme-surface, #f5f5f5); border-bottom: 1px solid var(--b3-border-color, #e0e0e0); flex-wrap: wrap; gap: 12px; }
  .diff-title { display: flex; align-items: center; gap: 12px; font-weight: 600; flex-wrap: wrap; }

  .reasoning-panel {
    margin: 10px 12px 0;
    border: 1px dashed var(--b3-border-color, #d0d7de);
    border-radius: 8px;
    background: var(--b3-theme-surface, #f8fafc);
    overflow: hidden;

    .reasoning-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--b3-theme-on-surface, #666);
      border-bottom: 1px dashed var(--b3-border-color, #d0d7de);
    }

    .reasoning-toggle {
      border: 1px solid var(--b3-border-color, #d0d7de);
      background: var(--b3-theme-background, #fff);
      color: var(--b3-theme-on-surface, #666);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 11px;
      cursor: pointer;
    }

    .reasoning-content {
      max-height: 140px;
      overflow: auto;
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.65;
      white-space: pre-wrap;
      color: var(--b3-theme-on-surface, #5f6368);
      opacity: 0.92;
    }
  }
  
  .model-selector { position: relative; }
  .model-btn { 
    background: var(--b3-theme-background, #fff); border: 1px solid var(--b3-border-color, #e0e0e0); 
    border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    &:hover { background: var(--b3-theme-hover, #f0f0f0); }
  }
  
.model-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 10000;
  background: var(--b3-theme-background, #fff); border: 1px solid var(--b3-border-color, #e0e0e0);
  border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 180px; max-height: 350px; overflow-y: auto; margin-top: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--b3-theme-on-surface, #ccc) transparent;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--b3-theme-on-surface, #ccc);
    border-radius: 3px;
  }
}
  
  .dropdown-item {
    padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px;
    &:hover { background: var(--b3-theme-hover, #f5f5f5); }
    &.active { background: var(--b3-theme-primary-light, rgba(66,133,244,0.1)); }
    .model-name { color: var(--b3-theme-on-surface, #666); font-size: 12px; }
    .check { margin-left: auto; color: var(--b3-theme-success, #22c55e); }
  }
  
  .diff-actions { display: flex; gap: 8px; }
  .diff-actions button { padding: 6px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 13px; transition: opacity 0.2s; }
  .diff-actions button:hover { opacity: 0.9; }
  .btn-edit { background: var(--b3-theme-surface, #f5f5f5); color: var(--b3-theme-on-surface, #333); border: 1px solid var(--b3-border-color, #e0e0e0); }
  .btn-regenerate { background: #f59e0b; color: white; }
  .btn-apply { background: var(--b3-theme-primary, #4285f4); color: white; }
  .btn-cancel { background: var(--b3-theme-surface, #f5f5f5); color: var(--b3-theme-on-surface, #333); border: 1px solid var(--b3-border-color, #e0e0e0); }
  
  .diff-content-inline { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--b3-border-color, #e0e0e0); max-height: 500px; overflow: auto; }
  .diff-panel { background: var(--b3-theme-background, #fff); display: flex; flex-direction: column; min-width: 0; }
  .diff-panel.editing { background: var(--b3-theme-surface, #f9f9f9); }
  .panel-header { padding: 10px 12px; background: var(--b3-theme-surface, #f5f5f5); font-weight: 500; font-size: 13px; border-bottom: 1px solid var(--b3-border-color, #e0e0e0); position: sticky; top: 0; z-index: 1; }
  .panel-content { padding: 16px; font-family: var(--b3-font-family, -apple-system, BlinkMacSystemFont); font-size: 14px; line-height: 1.8; flex: 1; overflow: auto; }
  .text-content { white-space: pre-wrap; word-wrap: break-word; }
  
  .segment.equal { color: inherit; }
  .segment.delete { background: rgba(239, 68, 68, 0.15); text-decoration: line-through; color: #dc2626; padding: 1px 2px; border-radius: 2px; }
  .segment.insert { background: rgba(34, 197, 94, 0.2); color: #166534; font-weight: 500; padding: 1px 2px; border-radius: 2px; }
  
  .edit-textarea { width: 100%; min-height: 200px; padding: 12px; border: 2px solid var(--b3-theme-primary, #4285f4); border-radius: 6px; background: var(--b3-theme-background, #fff); color: var(--b3-theme-on-background, #333); font-family: inherit; font-size: 14px; line-height: 1.8; resize: vertical; }
  .edit-textarea:focus { outline: none; box-shadow: 0 0 0 2px rgba(66,133,244,0.2); }
  .diff-actions {
    display: flex;
    gap: 8px;
    align-items: center;

    .btn-history {
      padding: 6px 14px;
      border: 1px solid var(--b3-theme-primary);
      border-radius: 6px;
      background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
      color: var(--b3-theme-primary);
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);

      &:hover {
        background: var(--b3-theme-primary);
        color: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .icon {
        font-size: 14px;
      }
    }
  }

  .btn-edit { background: none; border: 1px solid var(--b3-border-color, #e0e0e0); border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 13px; }
  
  .diff-legend { 
    display: flex; 
    align-items: center; 
    gap: 16px; 
    padding: 8px 16px; 
    background: var(--b3-theme-surface, #f5f5f5); 
    border-top: 1px solid var(--b3-border-color, #e0e0e0); 
    font-size: 12px; 
    color: var(--b3-theme-on-surface, #666);
    flex-wrap: wrap;
  }
  
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-color { width: 12px; height: 12px; border-radius: 2px; }
  .legend-color.equal { background: transparent; border: 1px solid var(--b3-border-color, #ccc); }
  .legend-color.delete { background: rgba(239, 68, 68, 0.4); }
  .legend-color.insert { background: rgba(34, 197, 94, 0.4); }
  .stats-total { margin-left: auto; font-weight: 500; opacity: 0.8; }
  
  .loading-content { padding: 60px; text-align: center; }
  .panel-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    background: var(--b3-theme-background-light, #fafafa);
    border-radius: 4px;
    gap: 16px;
  }
  .loading-spinner { 
    width: 42px;
    height: 42px;
    border: 3px solid rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1);
    border-top: 3px solid var(--b3-theme-primary, #4285f4);
    border-radius: 50%;
    animation: spin-anim 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    margin-bottom: 8px;
  }
  @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .loading-hint { font-size: 13px; color: var(--b3-theme-on-surface, #666); font-weight: 500; }
  
  .regenerate-panel { background: var(--b3-theme-surface, #f5f5f5); border-top: 1px solid var(--b3-border-color, #e0e0e0); padding: 16px; }
  .regenerate-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 600; font-size: 14px; }
  .btn-close { background: none; border: none; cursor: pointer; font-size: 16px; opacity: 0.6; }
  .btn-close:hover { opacity: 1; }
  .regenerate-content { display: flex; flex-direction: column; gap: 12px; }
  .regenerate-hint { font-size: 12px; color: var(--b3-theme-on-surface, #666); margin: 0; line-height: 1.6; }
  .regenerate-input { width: 100%; padding: 10px 12px; border: 1px solid var(--b3-border-color, #e0e0e0); border-radius: 6px; background: var(--b3-theme-background, #fff); color: var(--b3-theme-on-background, #333); font-family: inherit; font-size: 14px; resize: vertical; }
  .regenerate-input:focus { outline: none; border-color: var(--b3-theme-primary, #4285f4); }
  .regenerate-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn-secondary { padding: 8px 16px; border: 1px solid var(--b3-border-color, #e0e0e0); border-radius: 4px; background: var(--b3-theme-surface, #f5f5f5); cursor: pointer; }
  .btn-secondary:hover { background: var(--b3-theme-hover, #eee); }
  .btn-primary { padding: 8px 16px; border: none; border-radius: 4px; background: var(--b3-theme-primary, #4285f4); color: white; cursor: pointer; }
  .btn-primary:hover:not(:disabled) { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
