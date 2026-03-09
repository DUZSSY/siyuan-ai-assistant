<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { historyService } from '../services/history';
  import { diffService } from '../services/diff';
  import type { OperationHistory, OperationVersion } from '../types/history';
  import type { AIOperationType } from '../types';

  // Props
  export let i18n: Record<string, any> = {};

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  // State
  let histories: OperationHistory[] = [];
  let selectedHistory: OperationHistory | null = null;
  let selectedVersionIndex: number = -1; // -1表示显示最终对比
  let isLoading: boolean = true;

  // 优化：使用响应式变量存储当前显示的文本，避免重复计算
  $: originalText = selectedHistory && selectedHistory.versions.length > 0 
    ? selectedHistory.versions[0].text 
    : '';
    
  $: modifiedText = selectedHistory 
    ? (selectedVersionIndex === -1 
        ? (selectedHistory.versions[selectedHistory.versions.length - 1]?.text || '') 
        : (selectedHistory.versions[selectedVersionIndex]?.text || ''))
    : '';

  $: currentVer = selectedHistory 
    ? (selectedVersionIndex === -1 
        ? selectedHistory.versions[selectedHistory.versions.length - 1] 
        : selectedHistory.versions[selectedVersionIndex])
    : null;

  onMount(async () => {
    await loadHistories();
  });

  async function loadHistories() {
    isLoading = true;
    histories = await historyService.getHistories();
    isLoading = false;
  }

  function getLocale(): string {
    return i18n.meta?.languageName === 'English' ? 'en-US' : 'zh-CN';
  }

  // 获取操作名称
  function getOperationName(op: AIOperationType | 'original' | 'regenerate' | 'switchModel'): string {
    if (op === 'original') return i18n.history?.original || '原文';
    
    const names: Record<string, string> = {
      chat: i18n.operations?.chat || '对话',
      polish: i18n.operations?.polish || '润色',
      translate: i18n.operations?.translate || '翻译',
      summarize: i18n.operations?.summarize || '总结',
      expand: i18n.operations?.expand || '扩写',
      condense: i18n.operations?.condense || '精简',
      rewrite: i18n.operations?.rewrite || '改写',
      continue: i18n.operations?.continue || '续写',
      customInput: i18n.operations?.customInput || '对话',
      custom1: i18n.customButtons?.custom1 || '自定义1',
      custom2: i18n.customButtons?.custom2 || '自定义2',
      custom3: i18n.customButtons?.custom3 || '自定义3',
      regenerate: i18n.history?.regenerate || '重新生成',
      switchModel: i18n.history?.switchModel || '切换模型',
      directEdit: i18n.history?.directEdit || '直接编辑',
      rollback: i18n.history?.rollbackLabel || '版本回退'
    };
    return names[op] || op;
  }

  // 格式化时间
  function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString(getLocale(), { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }

  // 选择历史记录
  function selectHistory(history: OperationHistory) {
    selectedHistory = history;
    selectedVersionIndex = -1; // 默认显示最终对比
  }

  // 返回列表
  function backToList() {
    selectedHistory = null;
    selectedVersionIndex = -1;
  }

  // 计算diff
  function computeDiff(original: string, modified: string) {
    return diffService.computeInlineDiff(original, modified);
  }

  // 删除历史记录
  async function deleteHistory(historyId: string, event: Event) {
    event.stopPropagation();
    if (confirm(i18n.history?.deleteConfirm || '确定要删除这条历史记录吗？')) {
      await historyService.deleteHistory(historyId);
      histories = histories.filter(h => h.id !== historyId);
      if (selectedHistory?.id === historyId) {
        selectedHistory = null;
      }
    }
  }

  // 清空所有历史
  async function clearAllHistories() {
    if (confirm(i18n.history?.clearAllConfirm || '确定要清空所有历史记录吗？此操作不可恢复。')) {
      await historyService.clearAllHistories();
      histories = [];
      selectedHistory = null;
    }
  }

  // 获取版本标签
  function getVersionLabel(version: any, index: number, total: number): string {
    if (version.operationType === 'original') {
      return i18n.history?.original || '原文';
    }
    if (index === total - 1) {
      return `${i18n.history?.final || '最终'} v${version.version}`;
    }
    return `v${version.version}`;
  }

  // 计算差异统计
  function getDiffStats(diffResult: any): { added: number; removed: number } {
    let added = 0;
    let removed = 0;
    
    diffResult.modified.segments.forEach((seg: any) => {
      if (seg.type === 'added') added += seg.text.length;
    });
    
    diffResult.original.segments.forEach((seg: any) => {
      if (seg.type === 'removed') removed += seg.text.length;
    });
    
    return { added, removed };
  }
</script>

<div class="global-history-viewer">
  <!-- Header -->
  <div class="history-header">
    <div class="header-title">
      <span class="icon">📜</span>
      <span>{i18n.history?.globalTitle || '操作历史记录'}</span>
      {#if !selectedHistory}
        <span class="count-badge">{histories.length}</span>
      {/if}
    </div>
    <div class="header-actions">
      {#if selectedHistory}
        <button class="btn-back" on:click={backToList}>
          ← {i18n.history?.backToList || '返回列表'}
        </button>
      {/if}
      <button class="btn-close" on:click={() => dispatch('close')} title={i18n.history?.close || '关闭'}>
        ✕
      </button>
    </div>
  </div>

  <!-- Content -->
  <div class="history-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner">⏳</div>
        <p>{i18n.history?.loading || '加载中...'}</p>
      </div>
    {:else if selectedHistory}
      <!-- 单条历史详情视图 -->
      <div class="history-detail">
        <!-- 时间线 -->
        <div class="timeline-section">
          <div class="timeline-header">
            <span class="history-title-text">{selectedHistory.title}</span>
            {#if selectedHistory.finalApplied}
              <span class="applied-badge" title={i18n.history?.applied || '已应用'}>✓ {i18n.history?.applied || '已应用'}</span>
            {/if}
          </div>
          
          <div class="timeline-list">
            {#each selectedHistory.versions as version, index (version.timestamp)}
              <button 
                class="timeline-item" 
                class:active={selectedVersionIndex === index}
                class:final={index === selectedHistory.versions.length - 1}
                class:original={index === 0}
                on:click={() => selectedVersionIndex = index}
              >
                <span class="version-badge">v{version.version}</span>
                <span class="operation-name">{getOperationName(version.operationType)}</span>
                <span class="timestamp">{formatDateTime(version.timestamp)}</span>
              </button>
            {/each}
          </div>
          
          {#if selectedVersionIndex !== -1}
            <button class="btn-back-final" on:click={() => selectedVersionIndex = -1}>
              {i18n.history?.backToFinal || '查看最终对比'} →
            </button>
          {/if}
        </div>

        <!-- 版本对比 -->
        {#key modifiedText}
        <div class="version-comparison">
          <div class="comparison-header">
            {#if selectedVersionIndex === -1}
              {i18n.history?.original || '原文'} ↔ {i18n.history?.final || '最终'} (v{selectedHistory.versions[selectedHistory.versions.length - 1]?.version || 0})
            {:else}
              {i18n.history?.original || '原文'} ↔ {getVersionLabel(selectedHistory.versions[selectedVersionIndex], selectedVersionIndex, selectedHistory.versions.length)}
            {/if}
          </div>

          {#if currentVer && (currentVer.operationType === 'directEdit' || currentVer.model || currentVer.instruction)}
            <div class="version-meta-info">
              {#if currentVer.operationType === 'directEdit'}
                <div class="meta-tag direct-edit-tag" title={i18n.history?.directEdit || '直接编辑'}>
                  <span class="icon">✍️</span>
                  {i18n.history?.directEdit || '直接编辑'}
                </div>
              {:else if currentVer.model}
                <div class="meta-tag model-tag" title={i18n.history?.model || '模型'}>
                  <span class="icon">🤖</span>
                  {currentVer.model}
                </div>
              {/if}
              {#if currentVer.instruction}
                <div class="meta-tag instruction-tag" title={i18n.history?.instruction || '指令'}>
                  <span class="icon">💬</span>
                  {currentVer.instruction}
                </div>
              {/if}
            </div>
          {/if}
          
          {#if originalText && modifiedText}
            {@const diffResult = computeDiff(originalText, modifiedText)}
            {@const stats = getDiffStats(diffResult)}
            <div class="comparison-panels">
              <div class="panel original-panel">
                <div class="panel-header">
                  <span>{i18n.history?.original || '原文'}</span>
                  <span class="char-count">{originalText.length} {i18n.history?.chars || '字'}</span>
                </div>
                <div class="panel-content">
                  {#each diffResult.original.segments as segment}
                    <span class="diff-segment {segment.type}">{segment.text}</span>
                  {/each}
                </div>
              </div>
              
              <div class="panel modified-panel">
                <div class="panel-header">
                  <span>
                    {#if selectedVersionIndex === -1}
                      {i18n.history?.final || '最终'}
                    {:else}
                      {getVersionLabel(selectedHistory.versions[selectedVersionIndex], selectedVersionIndex, selectedHistory.versions.length)}
                    {/if}
                  </span>
                  <span class="char-count">{modifiedText.length} {i18n.history?.chars || '字'}</span>
                </div>
                <div class="panel-content">
                  {#each diffResult.modified.segments as segment}
                    <span class="diff-segment {segment.type}">{segment.text}</span>
                  {/each}
                </div>
              </div>
            </div>
            
            <!-- 统计信息 -->
            <div class="comparison-stats">
              {#if stats.added > 0}
                <span class="stat added">+{stats.added} {i18n.history?.charsAdded || '字新增'}</span>
              {/if}
              {#if stats.removed > 0}
                <span class="stat removed">-{stats.removed} {i18n.history?.charsRemoved || '字删除'}</span>
              {/if}
              {#if stats.added === 0 && stats.removed === 0}
                <span class="stat unchanged">{i18n.history?.noChange || '无变化'}</span>
              {/if}
            </div>
          {/if}
        </div>
        {/key}
      </div>
    {:else}
      <!-- 历史列表视图 -->
      <div class="history-list-view">
        {#if histories.length === 0}
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>{i18n.history?.noHistory || '暂无历史记录'}</p>
            <p class="empty-hint">{i18n.history?.noHistoryHint || '使用AI处理文本后，历史记录将显示在这里'}</p>
          </div>
        {:else}
          <div class="history-list">
            {#each histories as history (history.id)}
              <div 
                class="history-item"
                on:click={() => selectHistory(history)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectHistory(history)}
              >
                <div class="item-main">
                  <div class="item-header">
                    <span class="item-title">{history.title}</span>
                    {#if history.finalApplied}
                      <span class="applied-mini-badge" title={i18n.history?.applied || '已应用'}>✓</span>
                    {/if}
                  </div>
                  <div class="item-meta">
                    <span class="item-date">{formatDateTime(history.createdAt)}</span>
                    <span class="item-versions">{history.totalVersions} {i18n.history?.versions || '个版本'}</span>
                  </div>
                </div>
                <div class="item-actions">
                  <button 
                    class="btn-delete" 
                    on:click={(e) => deleteHistory(history.id, e)}
                    title={i18n.history?.delete || '删除'}
                  >
                    🗑️
                  </button>
                  <span class="item-arrow">→</span>
                </div>
              </div>
            {/each}
          </div>
          
          <!-- 底部操作栏 -->
          <div class="list-footer">
            <button class="btn-clear-all" on:click={clearAllHistories}>
              🗑️ {i18n.history?.clearAll || '清空所有历史'}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .global-history-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-background, #fff);
    border-radius: 8px;
    overflow: hidden;
  }

  // Header
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
    background: var(--b3-theme-surface, #f5f5f5);

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 16px;

      .icon {
        font-size: 20px;
      }

      .count-badge {
        background: var(--b3-theme-primary, #4285f4);
        color: white;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: normal;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-back {
      background: none;
      border: 1px solid var(--b3-border-color, #e0e0e0);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--b3-theme-on-surface, #333);

      &:hover {
        background: var(--b3-theme-hover, #f0f0f0);
      }
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      color: var(--b3-theme-on-surface, #666);

      &:hover {
        color: var(--b3-theme-error, #ef4444);
      }
    }
  }

  // Content
  .history-content {
    flex: 1;
    overflow: hidden;
  }

  // Loading
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--b3-theme-on-surface, #666);

    .loading-spinner {
      font-size: 48px;
      margin-bottom: 16px;
      animation: spin 2s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  }

  // Empty State
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
    text-align: center;

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    p {
      margin: 0 0 8px 0;
      color: var(--b3-theme-on-surface, #666);
    }

    .empty-hint {
      font-size: 13px;
      opacity: 0.7;
    }
  }

  // History List View
  .history-list-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 4px;
    transition: background 0.2s;
    border: 1px solid transparent;

    &:hover {
      background: var(--b3-theme-surface, #f5f5f5);
      border-color: var(--b3-border-color, #e0e0e0);
    }

    &:focus {
      outline: none;
      border-color: var(--b3-theme-primary, #4285f4);
    }

    .item-main {
      flex: 1;
      min-width: 0;

      .item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;

        .item-title {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .applied-mini-badge {
          color: var(--b3-theme-success, #22c55e);
          font-size: 14px;
        }
      }

      .item-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--b3-theme-on-surface, #666);

        .item-versions {
          color: var(--b3-theme-primary, #4285f4);
        }
      }
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .btn-delete {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        opacity: 0.5;
        font-size: 16px;

        &:hover {
          opacity: 1;
        }
      }

      .item-arrow {
        color: var(--b3-theme-on-surface, #999);
        font-size: 16px;
      }
    }
  }

  .list-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--b3-border-color, #e0e0e0);
    display: flex;
    justify-content: center;

    .btn-clear-all {
      background: none;
      border: 1px solid var(--b3-border-color, #e0e0e0);
      border-radius: 6px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 13px;
      color: var(--b3-theme-on-surface, #333);
      transition: all 0.2s;

      &:hover {
        background: var(--b3-theme-error-light, rgba(239, 68, 68, 0.1));
        border-color: var(--b3-theme-error, #ef4444);
        color: var(--b3-theme-error, #ef4444);
      }
    }
  }

  // History Detail View
  .history-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .timeline-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
    background: var(--b3-theme-surface-light, #fafafa);

    .timeline-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;

      .history-title-text {
        font-weight: 600;
        font-size: 14px;
      }

      .applied-badge {
        color: var(--b3-theme-success, #22c55e);
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }

    .timeline-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;

      .timeline-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid var(--b3-border-color, #e0e0e0);
        border-radius: 6px;
        background: var(--b3-theme-background, #fff);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;

        &:hover {
          background: var(--b3-theme-hover, #f5f5f5);
        }

        &.active {
          background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.1));
          border-color: var(--b3-theme-primary, #4285f4);
        }

        &.final {
          border-color: var(--b3-theme-success, #22c55e);
        }

        &.original {
          border-color: var(--b3-theme-on-surface, #999);
        }

        .version-badge {
          font-weight: 600;
          color: var(--b3-theme-primary, #4285f4);
        }

        .operation-name {
          color: var(--b3-theme-on-background, #333);
        }

        .timestamp {
          color: var(--b3-theme-on-surface, #999);
          font-size: 11px;
        }
      }
    }

    .btn-back-final {
      width: 100%;
      padding: 8px;
      background: var(--b3-theme-surface, #f0f0f0);
      border: 1px dashed var(--b3-theme-primary, #4285f4);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--b3-theme-primary, #4285f4);

      &:hover {
        background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.1));
      }
    }
  }

  .version-comparison {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .comparison-header {
      padding: 10px 16px;
      background: var(--b3-theme-surface, #f5f5f5);
      border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
      font-size: 13px;
      font-weight: 500;
    }

    .version-meta-info {
      padding: 8px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      border-bottom: 1px solid var(--b3-border-color);
      background: var(--b3-theme-background-light);

      .meta-tag {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        line-height: 1;
        background: var(--b3-theme-surface);
        border: 1px solid var(--b3-border-color);
        color: var(--b3-theme-on-background);
        opacity: 0.8;

        .icon {
          margin-right: 4px;
          font-size: 12px;
        }

        &.model-tag {
          background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1);
          color: var(--b3-theme-primary);
          border-color: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.2);
        }

        &.instruction-tag {
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .comparison-panels {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--b3-border-color, #e0e0e0);
      overflow: hidden;

      .panel {
        background: var(--b3-theme-background, #fff);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: var(--b3-theme-surface-light, #fafafa);
          border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
          font-size: 13px;
          font-weight: 600;

          .char-count {
            font-weight: normal;
            font-size: 11px;
            color: var(--b3-theme-on-surface, #666);
            background: var(--b3-theme-surface, #f0f0f0);
            padding: 2px 6px;
            border-radius: 4px;
          }
        }

        .panel-content {
          flex: 1;
          padding: 16px;
          overflow: auto;
          font-size: 14px;
          line-height: 1.8;
          white-space: pre-wrap;
          word-wrap: break-word;

          .diff-segment {
            &.added {
              background-color: var(--b3-theme-success-light, rgba(34, 197, 94, 0.15));
              border-bottom: 2px solid var(--b3-theme-success, #22c55e);
              color: var(--b3-theme-on-background);
            }
            &.removed {
              background-color: var(--b3-theme-error-light, rgba(239, 68, 68, 0.15));
              text-decoration: line-through;
              color: var(--b3-theme-on-surface, #999);
            }
          }
        }
      }
    }

    .comparison-stats {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 10px 16px;
      background: var(--b3-theme-surface, #f5f5f5);
      border-top: 1px solid var(--b3-border-color, #e0e0e0);
      font-size: 13px;

      .stat {
        &.added {
          color: var(--b3-theme-success, #22c55e);
        }

        &.removed {
          color: var(--b3-theme-error, #ef4444);
        }

        &.unchanged {
          color: var(--b3-theme-on-surface, #666);
        }
      }
    }
  }
</style>
