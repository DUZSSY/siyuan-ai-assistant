<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { diffService } from '../services/diff';
  import { historyService } from '../services/history';
  import type { OperationHistory, OperationVersion } from '../types/history';
  import type { AIOperationType } from '../types';

  // Props
  export let historyId: string | null = null;
  export let i18n: Record<string, any> = {};

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    close: void;
    rollback: { text: string; version: number };
  }>();

  // State
  let history: OperationHistory | null = null;
  let selectedVersionIndex: number = -1; // -1表示显示最终对比
  let showTimeline: boolean = true;
  let isLoading: boolean = true;

  onMount(async () => {
    if (historyId) {
      await refreshHistory();
    }
    // 默认显示最终对比
    selectedVersionIndex = -1;
  });

  async function refreshHistory() {
    if (!historyId) return;
    isLoading = true;
    try {
      history = await historyService.getHistory(historyId);
    } catch (e) {
      // 失败静默处理
    } finally {
      isLoading = false;
    }
  }

  function getLocale(): string {
    return i18n.meta?.languageName === 'English' ? 'en-US' : 'zh-CN';
  }

  // 获取操作名称
  function getOperationName(op: AIOperationType | 'original'): string {
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
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(getLocale(), { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }

  // 获取原文
  function getOriginalText(): string {
    if (!history || history.versions.length === 0) return '';
    return history.versions[0].text;
  }

  // 获取选中的版本文本
  function getSelectedVersionText(): string {
    if (!history) return '';
    if (selectedVersionIndex === -1) {
      // 显示最终版本
      return history.versions[history.versions.length - 1]?.text || '';
    }
    return history.versions[selectedVersionIndex]?.text || '';
  }

  // 计算diff
  function computeDiff(original: string, modified: string) {
    return diffService.computeInlineDiff(original, modified);
  }

  // 执行回退
  function handleRollback(versionIndex: number) {
    if (!history) return;
    const version = history.versions[versionIndex];
    if (version) {
       dispatch('rollback', { 
         text: version.text,
         version: version.version
       });
    }
  }

  // 获取版本标签
  function getVersionLabel(version: OperationVersion, index: number, total: number): string {
    if (version.operationType === 'original') {
      return i18n.history?.original || '原文';
    }
    if (index === total - 1) {
      return `${i18n.history?.final || '最终'} v${version.version}`;
    }
    return `v${version.version}`;
  }

  // 是否有省略版本
  function hasSkippedVersions(): boolean {
    if (!history) return false;
    return history.totalVersions > history.versions.length;
  }

  // 获取跳过的版本数
  function getSkippedCount(): number {
    if (!history) return 0;
    return history.totalVersions - history.versions.length;
  }

  // 获取对比标题
  function getComparisonTitle(): string {
    if (!history) return '';
    const totalVersions = history.versions.length;
    
    if (selectedVersionIndex === -1) {
      // 最终对比
      return `${i18n.history?.original || '原文'} ↔ ${i18n.history?.final || '最终'} (v${history.versions[totalVersions - 1]?.version || 0})`;
    } else {
      // 特定版本对比
      const version = history.versions[selectedVersionIndex];
      return `${i18n.history?.original || '原文'} ↔ ${getVersionLabel(version, selectedVersionIndex, totalVersions)}`;
    }
  }
</script>

<div class="history-viewer">
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner">⏳</div>
      <p>{i18n.history?.loading || '加载中...'}</p>
    </div>
  {:else if !history}
    <div class="empty-state">
      <p>{i18n.history?.noHistory || '未发现历史记录'}</p>
      <button class="btn-close-simple" on:click={() => dispatch('close')}>{i18n.history?.close || i18n.close || '关闭'}</button>
    </div>
  {:else}
    <!-- Header -->
    <div class="history-header">
      <div class="history-title">
        <span class="icon">📜</span>
        <span class="title-text">{history?.title || ''}</span>
        {#if history?.finalApplied}
          <span class="applied-badge" title={i18n.history?.applied || '已应用'}>✓</span>
        {/if}
      </div>
      <div class="history-meta">
        <span class="version-count">{history?.totalVersions || 0} {i18n.history?.versions || '个版本'}</span>
        {#if hasSkippedVersions()}
          <span class="skip-badge" title={i18n.history?.someVersionsSkipped || '部分版本已省略'}>
            ({i18n.history?.skipped || '省略'} {getSkippedCount()})
          </span>
        {/if}
      </div>
      <button class="btn-close" on:click={() => dispatch('close')} title={i18n.history?.close || '关闭'}>
        ✕
      </button>
    </div>

    <!-- Timeline Section (Top) -->
    <div class="timeline-section" class:collapsed={!showTimeline}>
      <button class="timeline-toggle" on:click={() => showTimeline = !showTimeline}>
        <span class="toggle-icon">{showTimeline ? '▼' : '▶'}</span>
        <span class="toggle-text">{i18n.history?.processTimeline || '处理过程'}</span>
      </button>
      
      {#if showTimeline}
        <div class="timeline-content">
          <div class="timeline-list">
            {#each history?.versions || [] as version, index}
              <button 
                class="timeline-item" 
                class:active={selectedVersionIndex === index}
                class:final={index === (history?.versions.length || 0) - 1}
                class:original={index === 0}
                on:click={() => selectedVersionIndex = index}
                title={`${getOperationName(version.operationType)} - ${formatTime(version.timestamp)}`}
              >
                <span class="version-badge">v{version.version}</span>
                <span class="operation-name">{getOperationName(version.operationType)}</span>
                <span class="timestamp">{formatTime(version.timestamp)}</span>
                {#if index > 0}
                <button 
                  class="btn-rollback-icon" 
                  title={i18n.history?.rollback || '回退到此版本'}
                  on:click|stopPropagation={() => handleRollback(index)}
                >
                  ↩️
                </button>
                {/if}
              </button>
            {/each}
          </div>
          
          <!-- Back to final button -->
          {#if selectedVersionIndex !== -1}
            <div class="timeline-footer">
              <button class="btn-back-final" on:click={() => selectedVersionIndex = -1}>
                {i18n.history?.backToFinal || '查看最终对比'} →
              </button>
              {#if selectedVersionIndex > 0}
                <button class="btn-rollback-main" on:click={() => handleRollback(selectedVersionIndex)}>
                  ↩️ {i18n.history?.rollbackToThis || '回退到选中版本'}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Two-Column Diff View -->
    <div class="diff-container">
      <div class="diff-header-bar">
        <span class="comparison-title">{getComparisonTitle()}</span>
        <div class="header-right">
          {#if selectedVersionIndex !== -1 && history && history.versions[selectedVersionIndex]}
            {@const version = history.versions[selectedVersionIndex]}
            <div class="version-info-pills">
              {#if version.operationType === 'directEdit'}
                <span class="pill model direct-edit" title={i18n.history?.directEdit || '直接编辑'}>✍️ {i18n.history?.directEdit || '直接编辑'}</span>
              {:else if version.model}
                <span class="pill model" title={i18n.providers?.model || '模型'}>🤖 {version.model}</span>
              {/if}
              {#if version.instruction}
                <span class="pill prompt" title={i18n.history?.instruction || '指令及上下文'}>📝 {version.instruction}</span>
              {/if}
            </div>
          {/if}
          <span class="readonly-badge">{i18n.history?.readonly || '只读查看'}</span>
        </div>
      </div>
      
      <div class="diff-panels">
        {#if history}
          {@const originalText = getOriginalText()}
          {@const modifiedText = getSelectedVersionText()}
          {@const diffResult = computeDiff(originalText, modifiedText)}
          
          <!-- Original Panel -->
          <div class="diff-panel original-panel">
            <div class="panel-header">
              <span class="panel-title">{i18n.history?.original || '原文'}</span>
              <span class="panel-info">v0</span>
            </div>
            <div class="panel-content">
              {#each diffResult.original.segments as segment}
                <span class="diff-segment {segment.type}">{segment.text}</span>
              {/each}
            </div>
          </div>
          
          <!-- Modified Panel -->
          <div class="diff-panel modified-panel">
            <div class="panel-header">
              <span class="panel-title">
                {#if selectedVersionIndex === -1}
                  {i18n.history?.final || '最终'}
                {:else}
                  {getVersionLabel(history.versions[selectedVersionIndex], selectedVersionIndex, history.versions.length)}
                {/if}
              </span>
              <span class="panel-info">
                {#if selectedVersionIndex === -1}
                  v{history.versions[history.versions.length - 1]?.version || 0}
                {:else}
                  v{history.versions[selectedVersionIndex]?.version || 0}
                {/if}
              </span>
            </div>
            <div class="panel-content">
              {#each diffResult.modified.segments as segment}
                <span class="diff-segment {segment.type}">{segment.text}</span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Legend -->
      <div class="diff-legend-bar">
        <span class="legend-item">
          <span class="legend-color unchanged"></span>
          {i18n.diff?.unchanged || '未修改'}
        </span>
        <span class="legend-item">
          <span class="legend-color delete"></span>
          {i18n.diff?.delete || '删除'}
        </span>
        <span class="legend-item">
          <span class="legend-color insert"></span>
          {i18n.diff?.insert || '新增'}
        </span>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .history-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-background, #fff);
    border-radius: 8px;
    overflow: hidden;

    .loading-container, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 300px;
      gap: 16px;
      color: var(--b3-theme-on-surface);

      .spinner {
        font-size: 32px;
        animation: rotate 2s linear infinite;
      }

      p {
        font-size: 16px;
        opacity: 0.8;
      }
    }

    .btn-close-simple {
      padding: 6px 16px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        opacity: 0.9;
      }
    }
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  // Header
  .history-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
    background: var(--b3-theme-surface, #f5f5f5);

    .history-title {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;

      .icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      .title-text {
        font-size: 15px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .applied-badge {
        color: var(--b3-theme-success, #22c55e);
        font-size: 14px;
        flex-shrink: 0;
      }
    }

    .history-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--b3-theme-on-surface, #666);
      flex-shrink: 0;

      .skip-badge {
        color: var(--b3-theme-warning, #f59e0b);
      }
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      color: var(--b3-theme-on-surface, #666);
      flex-shrink: 0;

      &:hover {
        color: var(--b3-theme-error, #ef4444);
      }
    }
  }

  // Timeline Section
  .timeline-section {
    border-bottom: 1px solid var(--b3-border-color, #e0e0e0);
    background: var(--b3-theme-surface-light, #fafafa);

    &.collapsed {
      .timeline-content {
        display: none;
      }
    }

    .timeline-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: var(--b3-theme-on-surface, #666);

      &:hover {
        background: var(--b3-theme-hover, rgba(0, 0, 0, 0.02));
      }

      .toggle-icon {
        font-size: 10px;
      }

      .toggle-text {
        font-weight: 500;
      }
    }

    .timeline-content {
      padding: 0 16px 12px;
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
          border-color: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.3));
        }

        &.active {
          background: var(--b3-theme-primary-light, rgba(66, 133, 244, 0.1));
          border-color: var(--b3-theme-primary, #4285f4);
        }

        &.final {
          border-color: var(--b3-theme-success, #22c55e);
          background: rgba(34, 197, 94, 0.05);
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

        .btn-rollback-icon {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--b3-theme-surface);
          border: 1px solid var(--b3-border-color);
          border-radius: 4px;
          font-size: 10px;
          opacity: 0;
          transition: all 0.2s;
          cursor: pointer;

          &:hover {
            background: var(--b3-theme-primary);
            color: #fff;
            border-color: var(--b3-theme-primary);
          }
        }

        &:hover .btn-rollback-icon {
          opacity: 1;
        }
      }
    }

    .timeline-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      width: 100%;
    }

    .btn-rollback-main {
      width: 100%;
      padding: 8px;
      background: var(--b3-theme-secondary, #f59e0b);
      border: 1px solid var(--b3-theme-secondary);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #fff;
      font-weight: 500;

      &:hover {
        filter: brightness(1.1);
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

  // Two-Column Diff Container
  .diff-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .diff-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: var(--b3-theme-surface, #f5f5f5);
      border-bottom: 1px solid var(--b3-border-color, #e0e0e0);

      .comparison-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--b3-theme-on-background, #333);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .version-info-pills {
        display: flex;
        align-items: center;
        gap: 6px;

        .pill {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          background: var(--b3-theme-background, #fff);
          border: 1px solid var(--b3-border-color, #e0e0e0);

          &.model {
            color: var(--b3-theme-primary, #4285f4);

            &.direct-edit {
              color: var(--b3-theme-secondary, #f59e0b);
              background: var(--b3-theme-secondary-light, rgba(245, 158, 11, 0.1));
            }
          }

          &.prompt {
            color: var(--b3-theme-warning, #f59e0b);
          }
        }
      }

      .readonly-badge {
        font-size: 11px;
        color: var(--b3-theme-on-surface, #666);
        background: var(--b3-theme-surface-light, #eee);
        padding: 2px 8px;
        border-radius: 4px;
      }
    }

    .diff-panels {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: var(--b3-border-color, #e0e0e0);
      overflow: hidden;

      .diff-panel {
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

          .panel-title {
            font-size: 13px;
            font-weight: 600;
          }

          .panel-info {
            font-size: 12px;
            color: var(--b3-theme-on-surface, #666);
            background: var(--b3-theme-surface, #f0f0f0);
            padding: 2px 8px;
            border-radius: 4px;
          }
        }

        .version-meta-info {
          padding: 8px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-bottom: 1px solid var(--b3-border-color);
          background: var(--b3-theme-background);

          .meta-tag {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            line-height: 1;
            background: var(--b3-theme-background-light);
            border: 1px solid var(--b3-border-color);
            color: var(--b3-theme-on-background);
            opacity: 0.8;

            .icon {
              margin-right: 4px;
              font-size: 12px;
            }

            &.model-tag {
              background: rgba(var(--b3-theme-primary-rgb, 63, 81, 181), 0.1);
              color: var(--b3-theme-primary);
              border-color: rgba(var(--b3-theme-primary-rgb, 63, 81, 181), 0.2);
            }

            &.instruction-tag {
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
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
            &.delete {
              background: rgba(239, 68, 68, 0.15);
              text-decoration: line-through;
              color: #dc2626;
              padding: 1px 2px;
              border-radius: 2px;
            }

            &.insert {
              background: rgba(34, 197, 94, 0.2);
              color: #166534;
              font-weight: 500;
              padding: 1px 2px;
              border-radius: 2px;
            }

            &.equal {
              color: var(--b3-theme-on-background, #333);
            }
          }
        }
      }

      .original-panel {
        .panel-header {
          border-right: 1px solid var(--b3-border-color, #e0e0e0);
        }
      }
    }

    .diff-legend-bar {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 10px 16px;
      background: var(--b3-theme-surface, #f5f5f5);
      border-top: 1px solid var(--b3-border-color, #e0e0e0);
      font-size: 12px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--b3-theme-on-surface, #666);

        .legend-color {
          width: 14px;
          height: 14px;
          border-radius: 3px;

          &.unchanged {
            background: transparent;
            border: 1px solid var(--b3-border-color, #ccc);
          }

          &.delete {
            background: rgba(239, 68, 68, 0.2);
          }

          &.insert {
            background: rgba(34, 197, 94, 0.2);
          }
        }
      }
    }
  }
</style>
