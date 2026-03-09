<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { diffService } from '../services/diff';
  import { historyService } from '../services/history';
  import type { AIOperationType } from '../types';
  import type { OperationHistory, OperationVersion } from '../types/history';

  export let historyId: string | null = null;
  export let i18n: Record<string, any> = {};

  const dispatch = createEventDispatcher<{
    close: void;
    rollback: { version: OperationVersion };
  }>();

  let history: OperationHistory | null = null;
  let selectedVersionIndex: number = -1;
  let showTimeline: boolean = true;
  let isLoading: boolean = true;

  let originalText = '';
  let modifiedText = '';
  let currentVersion: OperationVersion | null = null;
  let renderKey = 'empty';
  let diffResult = diffService.computeInlineDiff('', '');

  $: if (history && history.versions.length > 0) {
    originalText = history.versions[0]?.text || '';
    currentVersion = selectedVersionIndex === -1
      ? history.versions[history.versions.length - 1]
      : history.versions[selectedVersionIndex] || null;
    modifiedText = currentVersion?.text || '';
    renderKey = `${history.id}:${currentVersion?.version ?? -1}:${currentVersion?.timestamp ?? 0}`;
  } else {
    originalText = '';
    modifiedText = '';
    currentVersion = null;
    renderKey = 'empty';
  }

  $: diffResult = diffService.computeInlineDiff(originalText, modifiedText);

  onMount(async () => {
    await loadHistory();
  });

  async function loadHistory(): Promise<void> {
    if (!historyId) {
      isLoading = false;
      return;
    }

    isLoading = true;
    try {
      history = await historyService.getHistory(historyId);
      selectedVersionIndex = -1;
    } catch (error) {
      history = null;
    } finally {
      isLoading = false;
    }
  }

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

  function getVersionLabel(version: OperationVersion, index: number, total: number): string {
    if (version.operationType === 'original') {
      return i18n.history?.original || '原文';
    }
    if (index === total - 1) {
      return `${i18n.history?.final || '最终'} v${version.version}`;
    }
    return `v${version.version}`;
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function hasSkippedVersions(): boolean {
    if (!history) return false;
    return history.totalVersions > history.versions.length;
  }

  function getComparisonTitle(): string {
    if (!history || !currentVersion) return '';
    if (selectedVersionIndex === -1) {
      return `${i18n.history?.original || '原文'} ↔ ${i18n.history?.final || '最终'} (v${currentVersion.version})`;
    }
    return `${i18n.history?.original || '原文'} ↔ ${getVersionLabel(currentVersion, selectedVersionIndex, history.versions.length)}`;
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
      <button class="btn-close-simple" on:click={() => dispatch('close')}>关闭</button>
    </div>
  {:else}
    <div class="history-header">
      <div class="history-title">
        <span class="icon">📜</span>
        <span class="title-text">{history.title || ''}</span>
      </div>
      <div class="history-meta">
        <span class="version-count">{history.totalVersions} {i18n.history?.versions || '个版本'}</span>
        {#if hasSkippedVersions()}
          <span class="skip-badge">({i18n.history?.skipped || '省略'} {history.totalVersions - history.versions.length})</span>
        {/if}
      </div>
      <button class="btn-close" on:click={() => dispatch('close')} title={i18n.history?.close || '关闭'}>✕</button>
    </div>

    <div class="timeline-section" class:collapsed={!showTimeline}>
      <button class="timeline-toggle" on:click={() => showTimeline = !showTimeline}>
        <span class="toggle-icon">{showTimeline ? '▼' : '▶'}</span>
        <span class="toggle-text">{i18n.history?.processTimeline || '处理过程'}</span>
      </button>

      {#if showTimeline}
        <div class="timeline-content">
          <div class="timeline-list">
            {#each history.versions as version, index (version.version)}
              <button
                class="timeline-item"
                class:active={selectedVersionIndex === index}
                class:final={index === history.versions.length - 1}
                class:original={index === 0}
                on:click={() => selectedVersionIndex = index}
                title={`${getOperationName(version.operationType)} - ${formatTime(version.timestamp)}`}
              >
                <span class="version-badge">v{version.version}</span>
                <span class="operation-name">{getOperationName(version.operationType)}</span>
                <span class="timestamp">{formatTime(version.timestamp)}</span>
              </button>
            {/each}
          </div>

          {#if selectedVersionIndex !== -1}
            <div class="timeline-footer">
              <button class="btn-back-final" on:click={() => selectedVersionIndex = -1}>
                {i18n.history?.backToFinal || '查看最终对比'} →
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#key renderKey}
      <div class="diff-container">
        <div class="diff-header-bar">
          <span class="comparison-title">{getComparisonTitle()}</span>
          <div class="header-right">
            {#if currentVersion}
              <div class="version-info-pills">
                {#if currentVersion.operationType === 'directEdit'}
                  <span class="pill model direct-edit">✍️ {i18n.history?.directEdit || '直接编辑'}</span>
                {:else if currentVersion.operationType === 'rollback'}
                  <span class="pill model rollback">⏪ {i18n.history?.rollbackLabel || '版本回退'}</span>
                {:else if currentVersion.model}
                  <span class="pill model">🤖 {currentVersion.model}</span>
                {/if}
                {#if currentVersion.instruction}
                  <span class="pill prompt">📝 {currentVersion.instruction}</span>
                {/if}
              </div>
            {/if}
            {#if currentVersion && (selectedVersionIndex !== -1 || currentVersion.version < (history?.finalVersion ?? 0))}
              <button
                class="btn-rollback"
                on:click={() => dispatch('rollback', { version: currentVersion })}
                title={i18n.history?.rollbackTip || '将此版本设为最新版本'}
              >
                {i18n.history?.rollback || '版本回退'}
              </button>
            {/if}
            <span class="readonly-badge">{i18n.history?.readonly || '只读查看'}</span>
          </div>
        </div>

        <div class="diff-panels">
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

          <div class="diff-panel modified-panel">
            <div class="panel-header">
              <span class="panel-title">
                {#if selectedVersionIndex === -1}
                  {i18n.history?.final || '最终'}
                {:else if currentVersion}
                  {getVersionLabel(currentVersion, selectedVersionIndex, history.versions.length)}
                {/if}
              </span>
              <span class="panel-info">v{currentVersion?.version ?? 0}</span>
            </div>
            <div class="panel-content">
              {#each diffResult.modified.segments as segment}
                <span class="diff-segment {segment.type}">{segment.text}</span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/key}
  {/if}
</div>

<style>
  .history-viewer { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .history-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--b3-border-color); padding-bottom: 8px; }
  .history-title { display: flex; gap: 6px; align-items: center; font-weight: 600; min-width: 0; }
  .title-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px; }
  .history-meta { font-size: 12px; color: var(--b3-theme-on-surface-light); display: flex; gap: 8px; }
  .btn-close, .btn-close-simple { border: 1px solid var(--b3-border-color); background: var(--b3-theme-background); border-radius: 6px; cursor: pointer; }
  .btn-close { width: 28px; height: 28px; }
  .btn-close-simple { padding: 6px 12px; }

  .timeline-section { border: 1px solid var(--b3-border-color); border-radius: 8px; overflow: hidden; }
  .timeline-toggle { width: 100%; border: none; background: var(--b3-theme-surface); text-align: left; padding: 8px 10px; cursor: pointer; display: flex; gap: 8px; align-items: center; }
  .timeline-content { padding: 8px; }
  .timeline-list { display: grid; gap: 8px; max-height: 180px; overflow: auto; }
  .timeline-item { text-align: left; border: 1px solid var(--b3-border-color); background: var(--b3-theme-background); border-radius: 8px; padding: 8px; display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; cursor: pointer; }
  .timeline-item.active { border-color: var(--b3-theme-primary); background: var(--b3-theme-primary-lightest); }
  .version-badge { font-size: 12px; padding: 2px 6px; border-radius: 999px; background: var(--b3-theme-surface-lighter); }
  .operation-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .timestamp { font-size: 12px; color: var(--b3-theme-on-surface-light); }
  .timeline-footer { margin-top: 8px; display: flex; justify-content: flex-end; }
  .btn-back-final { border: 1px solid var(--b3-border-color); background: var(--b3-theme-background); padding: 6px 10px; border-radius: 6px; cursor: pointer; }

  .diff-container { border: 1px solid var(--b3-border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
  .diff-header-bar { padding: 8px 10px; border-bottom: 1px solid var(--b3-border-color); display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .comparison-title { font-size: 13px; font-weight: 600; }
  .header-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .version-info-pills { display: flex; gap: 6px; min-width: 0; }
  .pill { font-size: 12px; padding: 3px 8px; border-radius: 999px; background: var(--b3-theme-surface-lighter); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
  .pill.direct-edit { background: var(--b3-theme-primary-lightest); color: var(--b3-theme-primary); }
  .pill.rollback { background: var(--b3-theme-error-lightest); color: var(--b3-theme-error); }
  .readonly-badge { font-size: 12px; color: var(--b3-theme-on-surface-light); }

  .btn-rollback {
    padding: 3px 10px;
    border: 1px solid var(--b3-theme-primary);
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
  }
  .btn-rollback:hover {
    background: var(--b3-theme-primary-hover);
    border-color: var(--b3-theme-primary-hover);
  }
  .btn-rollback:active {
    background: var(--b3-theme-primary-active);
  }

  .diff-panels { display: grid; grid-template-columns: 1fr 1fr; min-height: 260px; }
  .diff-panel { display: flex; flex-direction: column; min-height: 0; }
  .diff-panel + .diff-panel { border-left: 1px solid var(--b3-border-color); }
  .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--b3-border-color); font-size: 13px; }
  .panel-content { padding: 10px; overflow: auto; white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 13px; }

  .diff-segment.equal { background: transparent; }
  .diff-segment.insert { background: var(--b3-card-success-background); color: var(--b3-card-success-color); }
  .diff-segment.delete { background: var(--b3-card-error-background); color: var(--b3-card-error-color); text-decoration: line-through; }

  .loading-container, .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--b3-theme-on-surface-light); }
</style>