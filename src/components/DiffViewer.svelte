<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { diffService } from '../services/diff';
  import { settingsService } from '../services/settings';
  import type { InlineDiffResult, InlineDiffSegment, DiffStats, AIOperationType, AIProvider } from '../types';

  export let original: string;  // 完整块内容（用于应用修改时）
  export let modified: string;
  export let selectedText: string = '';  // 选中的文字（作为原文显示）
  export let showActions: boolean = true;
  export let operationType: AIOperationType = 'polish';
  export let blockId: string = '';
  
  // 用于显示的原文：优先使用 selectedText（如果有实际内容），否则使用 original
  $: displayOriginal = (selectedText && selectedText.length > 0) ? selectedText : original;
  
  $: isLoading = modified.startsWith('⏳') || modified === '' || modified === null || modified === undefined;

  const dispatch = createEventDispatcher<{
    apply: string;
    cancel: void;
    regenerate: { instruction: string; original: string; currentModified: string };
    switchModel: string;
  }>();

  let inlineResult: InlineDiffResult;
  let stats: DiffStats;
  let regenerateInstruction: string = '';
  let showRegeneratePanel: boolean = false;
  let isEditing: boolean = false;
  let editedModified: string = '';
  let showModelDropdown: boolean = false;
  
  let providers: AIProvider[] = [];
  let currentProvider: AIProvider | null = null;

  // 操作类型名称映射
  const operationNames: Record<AIOperationType, string> = {
    chat: '对话',
    polish: '润色',
    translate: '翻译',
    summarize: '总结',
    expand: '扩写',
    condense: '精简',
    rewrite: '改写',
    continue: '续写',
    custom1: '自定义1',
    custom2: '自定义2',
    custom3: '自定义3'
  };

  onMount(() => {
    refreshProviderInfo();
  });

  function refreshProviderInfo() {
    const settings = settingsService.getSettings();
    providers = settings.providers;
    currentProvider = settingsService.getCurrentProvider();
  }

  $: {
    inlineResult = diffService.computeInlineDiff(displayOriginal, modified);
    stats = diffService.getInlineStats(inlineResult);
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
      alert('请输入修改要求');
      return;
    }
    dispatch('regenerate', {
      instruction: regenerateInstruction,
      original: displayOriginal,
      currentModified: modified
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
</script>

<div class="diff-viewer">
  <!-- Header -->
  <div class="diff-header">
    <div class="diff-title">
      <span>📊 {operationNames[operationType] || 'AI处理'}</span>
      
      <!-- 模型选择器 -->
      <div class="model-selector">
        <button class="model-btn" on:click={toggleModelDropdown}>
          {currentProvider ? currentProvider.name + ' : ' + currentProvider.model : '未配置'}
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
        <button class="btn-edit" on:click={isEditing ? cancelEdit : startEdit}>
          {isEditing ? '✕ 取消编辑' : '✏️ 直接编辑'}
        </button>
        <button class="btn-regenerate" on:click={() => showRegeneratePanel = !showRegeneratePanel}>
          🔄 重新生成
        </button>
        <button class="btn-apply" on:click={applyChanges}>
          ✓ 应用修改
        </button>
        <button class="btn-cancel" on:click={cancel}>
          取消
        </button>
      </div>
    {/if}
  </div>

  <!-- 重新生成面板 -->
  {#if showRegeneratePanel && !isLoading && !isEditing}
    <div class="regenerate-panel">
      <div class="regenerate-header">
        <span>💬 重新生成 - 根据您的要求调整结果</span>
        <button class="btn-close" on:click={() => showRegeneratePanel = false}>✕</button>
      </div>
      <div class="regenerate-content">
        <p class="regenerate-hint">
          💡 输入您的要求，AI将基于原文和当前结果进行调整。<br/>
          例如："请更简洁一些"、"增加更多技术细节"、"语气更正式"等。
        </p>
        <textarea
          bind:value={regenerateInstruction}
          placeholder="请输入您的修改要求..."
          rows="3"
          class="regenerate-input"
        ></textarea>
        <div class="regenerate-actions">
          <button class="btn-secondary" on:click={() => showRegeneratePanel = false}>取消</button>
          <button 
            class="btn-primary" 
            on:click={handleRegenerate}
            disabled={!regenerateInstruction.trim()}
          >
            发送请求
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- 内容区域 -->
  {#if isLoading}
    <div class="loading-content">
      <div class="loading-spinner">⏳</div>
      <p>正在处理中...</p>
    </div>
  {:else}
    <div class="diff-content-inline">
      <!-- 原文栏 -->
      <div class="diff-panel original">
        <div class="panel-header">
          <span>📝 原文</span>
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
          <span>✨ 修改后 {isEditing ? '（编辑模式）' : ''}</span>
        </div>
        <div class="panel-content">
          {#if isEditing}
            <textarea
              class="edit-textarea"
              bind:value={editedModified}
              placeholder="在此直接编辑修改后的内容..."
              rows={Math.max(10, editedModified.split('\n').length)}
            ></textarea>
            <div class="edit-actions">
              <button class="btn-secondary" on:click={cancelEdit}>取消</button>
              <button class="btn-primary" on:click={saveEdit}>保存</button>
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
  {/if}

    <!-- 图例和统计 -->
  <div class="diff-legend">
    <span class="legend-item"><span class="legend-color equal"></span>未改变</span>
    <span class="legend-item"><span class="legend-color delete"></span>删除</span>
    <span class="legend-item"><span class="legend-color insert"></span>新增</span>
    {#if stats}
      <span class="stats-total">共 {stats.modified} 处修改</span>
    {/if}
  </div>
</div>

<style lang="scss">
  .diff-viewer { display: flex; flex-direction: column; background: var(--b3-theme-background, #fff); border: 1px solid var(--b3-border-color, #e0e0e0); border-radius: 8px; overflow: hidden; }
  .diff-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--b3-theme-surface, #f5f5f5); border-bottom: 1px solid var(--b3-border-color, #e0e0e0); flex-wrap: wrap; gap: 12px; }
  .diff-title { display: flex; align-items: center; gap: 12px; font-weight: 600; flex-wrap: wrap; }
  
  .model-selector { position: relative; }
  .model-btn { 
    background: var(--b3-theme-background, #fff); border: 1px solid var(--b3-border-color, #e0e0e0); 
    border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    &:hover { background: var(--b3-theme-hover, #f0f0f0); }
  }
  
  .model-dropdown {
    position: absolute; top: 100%; left: 0; z-index: 100;
    background: var(--b3-theme-background, #fff); border: 1px solid var(--b3-border-color, #e0e0e0);
    border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 180px; max-height: 200px; overflow-y: auto; margin-top: 4px;
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
  .edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  
  .diff-legend { display: flex; gap: 16px; padding: 12px 16px; background: var(--b3-theme-surface, #f5f5f5); border-top: 1px solid var(--b3-border-color, #e0e0e0); font-size: 12px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-color { width: 16px; height: 16px; border-radius: 3px; }
  .legend-color.equal { background: transparent; border: 1px solid var(--b3-border-color, #e0e0e0); }
  .legend-color.delete { background: rgba(239, 68, 68, 0.3); }
  .legend-color.insert { background: rgba(34, 197, 94, 0.3); }
  
  .loading-content { padding: 60px; text-align: center; }
  .loading-spinner { font-size: 48px; margin-bottom: 16px; }
  
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
