<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsService } from '../services/settings';
  import { aiService } from '../services/ai';
  import type { AIProvider, CustomButton, ToolbarButtonConfig } from '../types';
  import { DEFAULT_PROVIDER_TEMPLATES } from '../types';

  // Props
  export let onClose: () => void = () => {};
  export let onProviderChange: () => void = () => {};

  // State
  let activeTab: 'providers' | 'ui' | 'prompts' | 'toolbar' = 'providers';
  let providers: AIProvider[] = [];
  let customButtons: CustomButton[] = [];
  let toolbarButtons: ToolbarButtonConfig = {
    polish: true,
    translate: true,
    summarize: true,
    expand: true,
    condense: false,
    rewrite: false,
    continue: false,
    custom1: false,
    custom2: false,
    custom3: false
  };

  // Editing states
  let editingProvider: AIProvider | null = null;
  let isAddingProvider = false;
  let testStatus: 'idle' | 'testing' | 'success' | 'error' = 'idle';
  let testMessage: string = '';
  let isTestPassed: boolean = false;

  onMount(() => {
    loadSettings();
  });

  function loadSettings() {
    const settings = settingsService.getSettings();
    providers = settings.providers;
    customButtons = settings.customButtons;
    toolbarButtons = settings.toolbarButtons;
  }

  function startAddProvider() {
    isAddingProvider = true;
    editingProvider = {
      id: generateId(),
      name: '',
      apiKey: '',
      baseURL: '',
      model: '',
      temperature: 0.7,
      maxTokens: 2048,
      isDefault: providers.length === 0
    };
    testStatus = 'idle';  // 添加新提供商时清除测试状态
  }

  function startEditProvider(provider: AIProvider) {
    isAddingProvider = false;
    editingProvider = { ...provider };
    testStatus = 'idle';  // 开始编辑时清除测试状态
  }

  function cancelEdit() {
    editingProvider = null;
    isAddingProvider = false;
    testStatus = 'idle';
  }

  // 判断是否为测试AI（测试AI不允许修改API地址、温度、最大Token）
  // 通过ID前缀识别，支持多个测试AI（如 test-ai-glm, test-ai-claude 等）
  function isTestAI(provider: AIProvider | null): boolean {
    if (!provider) return false;
    return provider.id.startsWith('test-ai-');
  }

  async function saveProvider() {
    if (!editingProvider) return;
    
    if (!editingProvider.name || !editingProvider.baseURL || !editingProvider.model) {
      alert('请填写所有必填字段');
      return;
    }

    if (isAddingProvider) {
      await settingsService.addProvider(editingProvider);
    } else {
      await settingsService.updateProvider(editingProvider.id, editingProvider);
    }

    // 保存后立即更新 aiService 的 provider，确保配置生效
    aiService.setProvider(editingProvider);

    loadSettings();
    editingProvider = null;
    isAddingProvider = false;
  }

  async function deleteProvider(id: string) {
    if (confirm('确定要删除这个提供商吗？')) {
      await settingsService.deleteProvider(id);
      loadSettings();
    }
  }

  async function testConnection() {
    if (!editingProvider) return;
    
    testStatus = 'testing';
    testMessage = '';
    isTestPassed = false;
    
    // 临时设置provider进行测试
    const originalProvider = aiService.getCurrentProvider();
    aiService.setProvider(editingProvider);
    
    try {
      // 发送测试消息
      const testPrompt = '你好，这是测试';
      const messages = [
        { role: 'system' as const, content: '你是一个有帮助的AI助手。' },
        { role: 'user' as const, content: testPrompt }
      ];
      
      const response = await aiService['adapter']?.chatCompletion(messages);
      
      if (response && response.content && response.content.length > 0) {
        testStatus = 'success';
        testMessage = response.content;
        isTestPassed = true;
      } else {
        testStatus = 'error';
        testMessage = 'AI返回空内容';
        isTestPassed = false;
      }
    } catch (error) {
      testStatus = 'error';
      testMessage = error instanceof Error ? error.message : '连接失败';
      isTestPassed = false;
    } finally {
      // 恢复原来的provider
      if (originalProvider) {
        aiService.setProvider(originalProvider);
      }
    }
  }

  async function setDefaultProvider(id: string) {
    await settingsService.setCurrentProvider(id);
    loadSettings();
    testStatus = 'idle';  // 切换默认提供商时清除测试状态
    // 通知外部提供商已变更
    onProviderChange();
  }

  function applyTemplate(template: typeof DEFAULT_PROVIDER_TEMPLATES[0]) {
    if (!editingProvider) return;
    editingProvider = {
      ...editingProvider,
      name: template.name,
      baseURL: template.baseURL,
      model: template.model,
      apiKey: template.apiKey,
      temperature: template.temperature,
      maxTokens: template.maxTokens
    };
  }

  async function saveCustomButtons() {
    await settingsService.updateCustomButtons(customButtons);
    // 自动同步到工具栏配置
    await syncCustomButtonsToToolbar();
    // 显示保存提示
    showSaveMessage('自定义按钮配置已保存');
  }

  async function saveToolbarButtons() {
    await settingsService.updateToolbarButtons(toolbarButtons);
    showSaveMessage('工具栏配置已保存');
  }

  // 同步自定义按钮启用状态到工具栏配置
  async function syncCustomButtonsToToolbar() {
    const buttons = settingsService.getSettings().toolbarButtons;
    
    customButtons.forEach((btn, index) => {
      const toolbarKey = `custom${index + 1}` as keyof typeof toolbarButtons;
      if (toolbarKey in buttons) {
        toolbarButtons[toolbarKey] = btn.enabled;
      }
    });
    
    // 保存工具栏配置
    await settingsService.updateToolbarButtons(toolbarButtons);
  }

  // 显示保存提示
  let saveMessage: string = '';
  let saveMessageTimeout: number | null = null;
  
  function showSaveMessage(message: string) {
    saveMessage = message;
    if (saveMessageTimeout) {
      clearTimeout(saveMessageTimeout);
    }
    saveMessageTimeout = window.setTimeout(() => {
      saveMessage = '';
    }, 2000);
  }

  // 监听自定义按钮启用状态变化，自动同步
  function handleCustomButtonEnabledChange(index: number) {
    const toolbarKey = `custom${index + 1}` as keyof typeof toolbarButtons;
    if (toolbarKey in toolbarButtons) {
      toolbarButtons[toolbarKey] = customButtons[index].enabled;
    }
    // 自动保存
    Promise.all([
      settingsService.updateCustomButtons(customButtons),
      settingsService.updateToolbarButtons(toolbarButtons)
    ]).then(() => {
      showSaveMessage('已自动保存');
    });
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
</script>

<div class="settings-panel">
  <div class="settings-header">
    <h2>⚙️ AI助手设置</h2>
    <div class="header-buttons">
      <button class="btn-donate" on:click={() => window.open('https://www.yuque.com/duzssy/mop740/fm59mkeo86fx5mu9?singleDoc', '_blank')} title="打赏支持">❤️</button>
      <button class="btn-close" on:click={onClose}>✕</button>
    </div>
  </div>

  <div class="settings-tabs">
    <button 
      class="tab-btn" 
      class:active={activeTab === 'providers'}
      on:click={() => activeTab = 'providers'}
    >
      AI提供商
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'toolbar'}
      on:click={() => activeTab = 'toolbar'}
    >
      工具栏
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'ui'}
      on:click={() => activeTab = 'ui'}
    >
      界面设置
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'prompts'}
      on:click={() => activeTab = 'prompts'}
    >
      自定义提示词
    </button>
  </div>

  <div class="settings-content">
    {#if activeTab === 'providers'}
      <div class="providers-section">
        {#if editingProvider}
          <div class="provider-form">
            <h3>{isAddingProvider ? '添加提供商' : '编辑提供商'}</h3>
            
            {#if isAddingProvider}
              <div class="template-buttons">
                <label>快速模板：</label>
                {#each DEFAULT_PROVIDER_TEMPLATES as template}
                  <button 
                    class="template-btn"
                    on:click={() => applyTemplate(template)}
                  >
                    {template.name}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="form-group">
              <label>名称 *</label>
              <input 
                type="text" 
                bind:value={editingProvider.name}
                placeholder="例如：Ollama本地"
              />
            </div>

            <!-- 测试AI隐藏API地址等配置 -->
            {#if !isTestAI(editingProvider)}
              <div class="form-group">
                <label>API地址 *</label>
                <input 
                  type="text" 
                  bind:value={editingProvider.baseURL}
                  placeholder="http://localhost:11434/v1"
                />
              </div>

              <div class="form-group">
                <label>API密钥</label>
                <input 
                  type="password" 
                  bind:value={editingProvider.apiKey}
                  placeholder="sk-..."
                />
              </div>
            {/if}

            <div class="form-group">
              <label>模型名称 *</label>
              <input 
                type="text" 
                bind:value={editingProvider.model}
                placeholder="llama3.2"
                disabled={isTestAI(editingProvider)}
              />
            </div>

            {#if !isTestAI(editingProvider)}
              <div class="form-row">
                <div class="form-group">
                  <label>温度 (0-2)</label>
                  <input 
                    type="number" 
                    bind:value={editingProvider.temperature}
                    min="0" max="2" step="0.1"
                  />
                </div>

                <div class="form-group">
                  <label>最大Token</label>
                  <input 
                    type="number" 
                    bind:value={editingProvider.maxTokens}
                    min="100" max="8192"
                  />
                </div>
              </div>
            {/if}

            <!-- 测试结果显示 -->
            {#if testStatus === 'success'}
              <div class="test-result success">
                <div class="test-result-header">✅ 连接成功</div>
                <div class="test-result-content">{testMessage}</div>
              </div>
            {:else if testStatus === 'error'}
              <div class="test-result error">
                <div class="test-result-header">❌ 连接失败</div>
                <div class="test-result-content">{testMessage}</div>
              </div>
            {/if}

            <div class="form-actions">
              <button 
                class="btn-test"
                on:click={testConnection}
                disabled={testStatus === 'testing'}
              >
                {#if testStatus === 'testing'}
                  测试中...
                {:else}
                  测试连接
                {/if}
              </button>
              <button class="btn-secondary" on:click={cancelEdit}>取消</button>
              <button 
                class="btn-primary" 
                on:click={saveProvider}
                disabled={!isTestPassed}
                title={!isTestPassed ? '请先通过连接测试' : ''}
              >
                保存
              </button>
            </div>
            
            {#if !isTestPassed}
              <div class="test-warning">
                ⚠️ 请先点击"测试连接"按钮，测试通过后才能保存
              </div>
            {/if}
          </div>
        {:else}
          <div class="providers-list">
            <div class="section-header">
              <h3>已配置的提供商</h3>
              <button class="btn-primary" on:click={startAddProvider}>
                + 添加提供商
              </button>
            </div>

            {#if providers.length === 0}
              <div class="empty-state">
                <p>暂无配置的AI提供商</p>
                <button class="btn-primary" on:click={startAddProvider}>
                  添加第一个提供商
                </button>
              </div>
            {:else}
              {#each providers as provider}
                <div class="provider-card" class:default={provider.isDefault}>
                  <div class="provider-info">
                    <div class="provider-name">
                      {provider.name}
                      {#if provider.isDefault}
                        <span class="badge">默认</span>
                      {/if}
                    </div>
                    <div class="provider-details">
                      {#if isTestAI(provider)}
                        {provider.model}（测试AI）
                      {:else}
                        {provider.model} @ {provider.baseURL}
                      {/if}
                    </div>
                  </div>
                  <div class="provider-actions">
                    {#if !provider.isDefault}
                      <button 
                        class="btn-text"
                        on:click={() => setDefaultProvider(provider.id)}
                      >
                        设为默认
                      </button>
                    {/if}
                    <button 
                      class="btn-icon"
                      on:click={() => startEditProvider(provider)}
                    >
                      ✏️
                    </button>
                    <button 
                      class="btn-icon"
                      on:click={() => deleteProvider(provider.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'toolbar'}
      <div class="toolbar-section">
        <h3>浮动工具栏按钮</h3>
        <p class="section-desc">选择在浮动工具栏中显示哪些按钮</p>

        <div class="checkbox-list">
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.polish} on:change={() => saveToolbarButtons()} />
            <span>✨ 润色</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.translate} on:change={() => saveToolbarButtons()} />
            <span>🌐 翻译</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.summarize} on:change={() => saveToolbarButtons()} />
            <span>📝 总结</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.expand} on:change={() => saveToolbarButtons()} />
            <span>📖 扩写</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.condense} on:change={() => saveToolbarButtons()} />
            <span>📄 精简</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.rewrite} on:change={() => saveToolbarButtons()} />
            <span>🔄 改写</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.continue} on:change={() => saveToolbarButtons()} />
            <span>➡️ 续写</span>
          </label>
        </div>

        <h4>自定义按钮</h4>
        <p class="section-desc">在"自定义提示词"Tab中配置后会自动同步到这里</p>
        
        <div class="checkbox-list">
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.custom1} on:change={() => saveToolbarButtons()} />
            <span>{customButtons[0]?.name || '自定义1'} {customButtons[0]?.icon || '✨'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.custom2} on:change={() => saveToolbarButtons()} />
            <span>{customButtons[1]?.name || '自定义2'} {customButtons[1]?.icon || '🔧'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.custom3} on:change={() => saveToolbarButtons()} />
            <span>{customButtons[2]?.name || '自定义3'} {customButtons[2]?.icon || '🎯'}</span>
          </label>
        </div>

        {#if saveMessage}
          <div class="save-message">{saveMessage}</div>
        {/if}
      </div>

    {:else if activeTab === 'ui'}
      <div class="ui-section">
        <h3>界面设置</h3>
        <p class="section-desc">MVP版本暂不支持界面自定义</p>
      </div>

    {:else if activeTab === 'prompts'}
      <div class="prompts-section">
        <h3>自定义按钮配置</h3>
        <p class="section-desc">配置三个自定义操作按钮（启用后会自动同步到工具栏）</p>

        {#each customButtons as button, index}
          <div class="custom-button-form">
            <h4>自定义按钮 {index + 1}</h4>
            
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                bind:checked={button.enabled} 
                on:change={() => handleCustomButtonEnabledChange(index)}
              />
              <span>启用此按钮</span>
            </label>

            <div class="form-group">
              <label>按钮名称</label>
              <input 
                type="text" 
                bind:value={button.name}
                placeholder="按钮显示名称"
                on:input={() => saveCustomButtons()}
              />
            </div>

            <div class="form-group">
              <label>图标 (emoji)</label>
              <input 
                type="text" 
                bind:value={button.icon}
                placeholder="✨"
                maxlength="2"
                on:input={() => saveCustomButtons()}
              />
            </div>

            <div class="form-group">
              <label>AI提示词</label>
              <textarea 
                bind:value={button.prompt}
                placeholder="输入AI提示词，例如：请将以下内容转换成表格形式："
                rows="3"
                on:input={() => saveCustomButtons()}
              ></textarea>
            </div>
          </div>
        {/each}

        {#if saveMessage}
          <div class="save-message">{saveMessage}</div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .settings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--b3-border-color);

    h2 {
      margin: 0;
      font-size: 18px;
    }
  }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-donate {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: var(--b3-border-color);
    }
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }

  .settings-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    overflow-x: auto;
  }

  .tab-btn {
    padding: 8px 16px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 6px;
    white-space: nowrap;
    color: var(--b3-theme-on-surface);
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-hover);
    }

    &.active {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
    }
  }

  .section-desc {
    color: var(--b3-theme-on-surface);
    margin-bottom: 16px;
    font-size: 14px;
  }

  // Provider Form
  .provider-form {
    max-width: 500px;

    h3 {
      margin-top: 0;
    }
  }

  .template-buttons {
    margin-bottom: 20px;
    padding: 12px;
    background: var(--b3-theme-surface);
    border-radius: 8px;

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
  }

  .template-btn {
    margin: 4px;
    padding: 6px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 16px;
    background: var(--b3-theme-background);
    cursor: pointer;
    font-size: 12px;

    &:hover {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }

  .form-group {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
    }

    input, textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--b3-border-color);
      border-radius: 6px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      font-size: 14px;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
      }
    }
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;

    button {
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
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

  .btn-primary {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
  }

  .btn-secondary {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
  }

  .btn-test {
    background: var(--b3-theme-success);
    color: white;
    border: none;
  }

  .test-result {
    margin: 16px 0;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;

    &.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);

      .test-result-header {
        color: #16a34a;
        font-weight: 600;
        margin-bottom: 8px;
      }
    }

    &.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);

      .test-result-header {
        color: #dc2626;
        font-weight: 600;
        margin-bottom: 8px;
      }
    }

    .test-result-content {
      color: var(--b3-theme-on-surface);
      line-height: 1.5;
      max-height: 100px;
      overflow-y: auto;
      padding: 8px;
      background: var(--b3-theme-background);
      border-radius: 4px;
      font-size: 13px;
    }
  }

  .test-warning {
    margin-top: 12px;
    padding: 10px;
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: 6px;
    color: #ca8a04;
    font-size: 13px;
    text-align: center;
  }

  // Providers List
  .providers-list {
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--b3-theme-on-surface);

      p {
        margin-bottom: 16px;
      }
    }
  }

  .provider-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    margin-bottom: 12px;
    background: var(--b3-theme-background);

    &.default {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-surface);
    }
  }

  .provider-name {
    font-weight: 500;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;

    .badge {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
    }
  }

  .provider-details {
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .provider-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--b3-theme-primary);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;

    &:hover {
      text-decoration: underline;
    }
  }

  .btn-icon {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    border-radius: 4px;
    opacity: 0.6;

    &:hover {
      opacity: 1;
      background: var(--b3-theme-hover);
    }
  }

  // Toolbar Section
  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
  }

  // Custom Buttons
  .custom-button-form {
    padding: 16px;
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    margin-bottom: 16px;
    background: var(--b3-theme-surface);

    h4 {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 14px;
    }
  }

  .save-message {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
