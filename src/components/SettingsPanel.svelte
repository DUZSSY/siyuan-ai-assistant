<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsService } from '../services/settings';
  import { aiService } from '../services/ai';
  import type { AIProvider, CustomButton, ToolbarButtonConfig } from '../types';
  import { DEFAULT_PROVIDER_TEMPLATES } from '../types';
  import { Dialog } from 'siyuan';

  // Props
  export let onClose: () => void = () => {};
  export let onProviderChange: () => void = () => {};
  export let i18n: Record<string, any> = {};

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
    // 创建新数组引用，强制 Svelte 响应式更新
    providers = [...settings.providers];
    customButtons = [...settings.customButtons];
    toolbarButtons = { ...settings.toolbarButtons };
  }

  // Provider name to i18n key mapping
  const providerNameKeys: Record<string, string> = {
    'Ollama (本地)': 'ollama',
    'OpenAI': 'openai',
    'DeepSeek': 'deepseek',
    'Moonshot': 'moonshot',
    '智谱AI (Z.ai)': 'zhipu',
    'Claude (Anthropic)': 'claude',
    '自定义 OpenAI 格式': 'customOpenAI',
    'GLM（免费试用-额度有限-仅供测试）': 'testGLM'
  };

  function getProviderName(name: string): string {
    const key = providerNameKeys[name];
    if (key) {
      return i18n.providerNames?.[key] || name;
    }
    return name;
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
      alert(i18n.settingsPanel?.alerts?.fillRequired || 'Please fill in all required fields');
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
    if (confirm(i18n.settingsPanel?.alerts?.confirmDelete || 'Are you sure you want to delete this provider?')) {
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
      const testPrompt = i18n.chat?.testPrompt || 'Hello, this is a test';
      const messages = [
        { role: 'system' as const, content: i18n.chat?.systemPrompt || 'You are a helpful AI assistant.' },
        { role: 'user' as const, content: testPrompt }
      ];
      
      const response = await aiService['adapter']?.chatCompletion(messages);
      
      if (response && response.content && response.content.length > 0) {
        testStatus = 'success';
        testMessage = response.content;
        isTestPassed = true;
      } else {
        testStatus = 'error';
        testMessage = i18n.settingsPanel?.alerts?.testEmptyResponse || 'AI returned empty content';
        isTestPassed = false;
      }
    } catch (error) {
      testStatus = 'error';
      testMessage = error instanceof Error ? error.message : (i18n.settingsPanel?.alerts?.connectionFailed || 'Connection failed');
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
  // 校验：启用的自定义按钮名称和 Prompt 不能为空
  for (let i = 0; i < customButtons.length; i++) {
    const btn = customButtons[i];
    if (btn.enabled) {
      if (!btn.name || btn.name.trim() === '') {
        const msg = i18n.settingsPanel?.alerts?.customButtonNameRequired || '自定义按钮 {index} 的名称不能为空';
        alert(msg.replace('{index}', String(i + 1)));
        return;
      }
      if (!btn.prompt || btn.prompt.trim() === '') {
        const msg = i18n.settingsPanel?.alerts?.customButtonPromptRequired || '自定义按钮 {index} 的 AI Prompt 不能为空';
        alert(msg.replace('{index}', String(i + 1)));
        return;
      }
    }
  }

  await settingsService.updateCustomButtons(customButtons);
  // 自动同步到工具栏配置
  await syncCustomButtonsToToolbar();
  // 显示保存提示
  showSaveMessage(i18n.settingsPanel?.alerts?.customSaved || 'Custom button configuration saved');
}

  async function saveToolbarButtons() {
    await settingsService.updateToolbarButtons(toolbarButtons);
    // 通知外部工具栏按钮已变更，需要刷新工具栏显示
    onProviderChange();
    showSaveMessage(i18n.settingsPanel?.alerts?.toolbarSaved || 'Toolbar configuration saved');
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
  let importFileInput: HTMLInputElement | null = null;
  
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
      showSaveMessage(i18n.settingsPanel?.alerts?.autoSaved || 'Auto saved');
    });
  }

  // 内置混淆密钥（长期固定）
  const OBFUSCATION_KEY = 'SYAI2026Config';
  
  // 简单的混淆加密：Base64 + 固定字符串
  function obfuscateConfig(data: any): string {
    const jsonStr = JSON.stringify(data);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    // 在Base64中间插入固定字符串
    const mid = Math.floor(base64.length / 2);
    return base64.slice(0, mid) + OBFUSCATION_KEY + base64.slice(mid);
  }
  
  // 解密混淆的配置
  function deobfuscateConfig(obfuscated: string): any {
    // 移除固定字符串
    const cleaned = obfuscated.replace(OBFUSCATION_KEY, '');
    const jsonStr = decodeURIComponent(escape(atob(cleaned)));
    return JSON.parse(jsonStr);
  }
  
  // 导出配置
  function exportConfig() {
    const settings = settingsService.getSettings();
    const exportData = {
      version: '0.1.16',
      exportDate: new Date().toISOString(),
      // 排除 test-ai- 前缀的提供商（测试线路）
      // 导出时清除 isDefault 标记，避免导入时出现多个默认模型
      providers: settings.providers.filter(p => !p.id.startsWith('test-ai-')).map(p => ({
        ...p,
        isDefault: false
      })),
      toolbarButtons: settings.toolbarButtons,
      customButtons: settings.customButtons,
      operationPrompts: settings.operationPrompts,
      showFloatingToolbar: settings.showFloatingToolbar,
      showContextMenu: settings.showContextMenu,
      uiMode: settings.uiMode,
      diffHighlightStyle: settings.diffHighlightStyle,
      autoApplyOnAccept: settings.autoApplyOnAccept,
      requestTimeout: settings.requestTimeout
    };
    
    // 混淆加密
    const obfuscated = obfuscateConfig(exportData);
    const blob = new Blob([obfuscated], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-assistant-config-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSaveMessage(i18n.settingsPanel?.configManagement?.exportSuccess || '配置已导出');
  }
  
  // 触发导入文件选择
  function triggerImport() {
    importFileInput?.click();
  }
  
  // 处理导入文件
  async function handleImportFile(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    try {
      const text = await file.text();
      let importData: any;
      
      // 尝试解密（如果是混淆格式）
      try {
        importData = deobfuscateConfig(text);
      } catch {
        // 如果不是混淆格式，尝试直接解析JSON（向后兼容）
        try {
          importData = JSON.parse(text);
        } catch {
          alert(i18n.settingsPanel?.configManagement?.importError || '配置文件格式错误');
          return;
        }
      }
      
      // 验证数据结构
      if (!importData.providers || !importData.toolbarButtons || !importData.customButtons) {
        alert(i18n.settingsPanel?.configManagement?.importError || '配置文件格式错误');
        return;
      }
      
      // 获取当前设置
      const currentSettings = settingsService.getSettings();
      
      // 合并设置
      await mergeSettings(importData, currentSettings);
      
    } catch (error) {
      alert(i18n.settingsPanel?.configManagement?.importError || '配置文件格式错误');
    } finally {
      // 清空 input 以便可以再次选择同一文件
      target.value = '';
    }
  }
  
  // 比较两个提供商是否完全相同
  function isProviderEqual(p1: any, p2: any): boolean {
    return p1.id === p2.id &&
           p1.name === p2.name &&
           p1.baseURL === p2.baseURL &&
           p1.model === p2.model &&
           p1.apiKey === p2.apiKey &&
           p1.temperature === p2.temperature &&
           p1.maxTokens === p2.maxTokens &&
           p1.isDefault === p2.isDefault;
  }
  
  // 比较两个自定义按钮是否完全相同
  function isCustomButtonEqual(b1: any, b2: any): boolean {
    return b1.id === b2.id &&
           b1.name === b2.name &&
           b1.icon === b2.icon &&
           b1.prompt === b2.prompt &&
           b1.enabled === b2.enabled;
  }
  
  // 比较工具栏按钮配置是否完全相同
  function isToolbarButtonsEqual(t1: any, t2: any): boolean {
    const keys = ['polish', 'translate', 'summarize', 'expand', 'condense', 'rewrite', 'continue', 'custom1', 'custom2', 'custom3'];
    return keys.every(key => t1[key] === t2[key]);
  }
  
  // 合并设置（处理冲突）
  async function mergeSettings(importData: any, currentSettings: any) {
    const newSettings: any = {};
    let userPrompted = false; // 标记是否已经提示过用户
    
    // 1. 合并提供商（处理冲突）
    const mergedProviders = [...currentSettings.providers];
    let providersChanged = false;
    
    for (const importProvider of importData.providers) {
      const existingIndex = mergedProviders.findIndex(p => p.id === importProvider.id);
      if (existingIndex >= 0) {
        // ID 已存在，检查内容是否完全一致
        if (!isProviderEqual(importProvider, mergedProviders[existingIndex])) {
          // 内容不一致，需要提示用户
          userPrompted = true;
          const currentProvider = mergedProviders[existingIndex];
          let message = i18n.settingsPanel?.configManagement?.providerConflict || 
            `提供商 "{name}" 已存在但配置不同，是否用导入的配置覆盖当前配置？\n\n当前: {currentModel} @ {currentURL}\n导入: {importModel} @ {importURL}`;
          // 替换占位符
          message = message
            .replace('{name}', importProvider.name)
            .replace('{currentModel}', currentProvider.model)
            .replace('{currentURL}', currentProvider.baseURL)
            .replace('{importModel}', importProvider.model)
            .replace('{importURL}', importProvider.baseURL);
          
          const useImport = await showConfirmDialogAsync(
            i18n.settingsPanel?.configManagement?.providerConflictTitle || '提供商配置冲突',
            message,
            i18n.settingsPanel?.configManagement?.useImport || '使用导入配置',
            i18n.settingsPanel?.configManagement?.keepCurrent || '保留当前配置'
          );
          
          if (useImport) {
            mergedProviders[existingIndex] = importProvider;
            providersChanged = true;
          }
          // 否则保留当前配置（不做任何操作）
        }
        // 如果内容完全一致，自动跳过，用户无感知
      } else {
        // ID 不存在，直接添加
        mergedProviders.push(importProvider);
        providersChanged = true;
      }
    }
    
    newSettings.providers = mergedProviders;
    
    // 2. 合并自定义按钮
    const mergedCustomButtons = [...currentSettings.customButtons];
    let customButtonsChanged = false;
    
    if (importData.customButtons && Array.isArray(importData.customButtons)) {
      for (let i = 0; i < importData.customButtons.length; i++) {
        const importBtn = importData.customButtons[i];
        if (i < mergedCustomButtons.length) {
          const currentBtn = mergedCustomButtons[i];
          // 检查是否完全一致
          if (!isCustomButtonEqual(importBtn, currentBtn)) {
            // 不一致，显示自定义冲突对话框
            userPrompted = true;
            const useImport = await showCustomButtonConflictDialog(i, currentBtn, importBtn);
            
            if (useImport) {
              mergedCustomButtons[i] = { ...importBtn };
              customButtonsChanged = true;
            }
            // 否则保留当前配置（不做任何操作）
          }
          // 如果完全一致，自动跳过
        } else {
          // 超出当前按钮数量，添加新按钮
          mergedCustomButtons.push({ ...importBtn });
          customButtonsChanged = true;
        }
      }
    }
    newSettings.customButtons = mergedCustomButtons;
    
    // 3. 合并工具栏按钮设置
    let toolbarButtonsChanged = false;
    if (importData.toolbarButtons) {
      if (!isToolbarButtonsEqual(importData.toolbarButtons, currentSettings.toolbarButtons)) {
        // 不一致，提示用户
        userPrompted = true;
        const message = i18n.settingsPanel?.configManagement?.toolbarButtonsConflict ||
          '导入的工具栏按钮设置与当前不同，是否使用导入的设置覆盖当前设置？';
        const useImport = await showConfirmDialogAsync(
          i18n.settingsPanel?.configManagement?.toolbarButtonsConflictTitle || '工具栏按钮配置冲突',
          message,
          i18n.settingsPanel?.configManagement?.useImport || '使用导入设置',
          i18n.settingsPanel?.configManagement?.keepCurrent || '保留当前设置'
        );
        if (useImport) {
          newSettings.toolbarButtons = importData.toolbarButtons;
          toolbarButtonsChanged = true;
        } else {
          newSettings.toolbarButtons = currentSettings.toolbarButtons;
        }
      } else {
        // 完全一致，自动使用当前设置
        newSettings.toolbarButtons = currentSettings.toolbarButtons;
      }
    }
    
    // 4. 导入其他设置（其他设置直接导入，通常不会冲突）
    let otherSettingsChanged = false;
    if (importData.operationPrompts) {
      newSettings.operationPrompts = importData.operationPrompts;
      otherSettingsChanged = true;
    }
    if (importData.showFloatingToolbar !== undefined && importData.showFloatingToolbar !== currentSettings.showFloatingToolbar) {
      newSettings.showFloatingToolbar = importData.showFloatingToolbar;
      otherSettingsChanged = true;
    }
    if (importData.showContextMenu !== undefined && importData.showContextMenu !== currentSettings.showContextMenu) {
      newSettings.showContextMenu = importData.showContextMenu;
      otherSettingsChanged = true;
    }
    if (importData.uiMode && importData.uiMode !== currentSettings.uiMode) {
      newSettings.uiMode = importData.uiMode;
      otherSettingsChanged = true;
    }
    if (importData.diffHighlightStyle && importData.diffHighlightStyle !== currentSettings.diffHighlightStyle) {
      newSettings.diffHighlightStyle = importData.diffHighlightStyle;
      otherSettingsChanged = true;
    }
    if (importData.autoApplyOnAccept !== undefined && importData.autoApplyOnAccept !== currentSettings.autoApplyOnAccept) {
      newSettings.autoApplyOnAccept = importData.autoApplyOnAccept;
      otherSettingsChanged = true;
    }
    if (importData.requestTimeout && importData.requestTimeout !== currentSettings.requestTimeout) {
      newSettings.requestTimeout = importData.requestTimeout;
      otherSettingsChanged = true;
    }
    
    // 5. 如果没有变化且没有提示过用户，显示静默导入成功
    const hasChanges = providersChanged || customButtonsChanged || toolbarButtonsChanged || otherSettingsChanged;
    
    if (!hasChanges && !userPrompted) {
      // 所有导入内容与当前配置完全一致，无感知导入
      showSaveMessage(i18n.settingsPanel?.configManagement?.importNoChanges || '导入的配置与当前配置完全一致，无需更改');
      return;
    }
    
    // 6. 如果没有变化但曾经提示过用户，显示导入完成
    if (!hasChanges && userPrompted) {
      showSaveMessage(i18n.settingsPanel?.configManagement?.importKeptCurrent || '已保留当前配置');
      return;
    }
    
    // 7. 设置 currentProviderId
    const defaultProvider = newSettings.providers.find((p: any) => p.isDefault);
    if (defaultProvider) {
      newSettings.currentProviderId = defaultProvider.id;
    } else if (newSettings.providers.length > 0) {
      newSettings.currentProviderId = newSettings.providers[0].id;
    }
    
    // 8. 批量更新所有设置
    await settingsService.updateSettings(newSettings);
    
    // 9. 重新加载设置
    loadSettings();
    
    // 10. 通知外部提供商已变更
    onProviderChange();
    
    showSaveMessage(i18n.settingsPanel?.configManagement?.importSuccess || '配置已导入');
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 通用的异步确认对话框，替代 confirm()
  function showConfirmDialogAsync(
    title: string,
    content: string,
    confirmText: string,
    cancelText: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new Dialog({
        title,
        content: `<div style="padding: 20px; max-width: 500px;">
          <div style="margin-bottom: 20px; white-space: pre-wrap; word-wrap: break-word;">${content}</div>
          <div class="b3-dialog__action" style="justify-content: flex-end; padding: 0;">
            <button class="cancel-btn b3-button b3-button--cancel" style="margin-right: 8px;">${cancelText}</button>
            <button class="confirm-btn b3-button b3-button--text">${confirmText}</button>
          </div>
        </div>`,
        width: '500px'
      });

      dialog.element.querySelector('.cancel-btn')?.addEventListener('click', () => {
        dialog.destroy();
        resolve(false);
      });

      dialog.element.querySelector('.confirm-btn')?.addEventListener('click', () => {
        dialog.destroy();
        resolve(true);
      });
    });
  }

  // 显示自定义按钮冲突对话框，返回 Promise，resolve(true) 表示使用导入版本，resolve(false) 表示使用当前版本
  function showCustomButtonConflictDialog(
    index: number,
    currentBtn: CustomButton,
    importBtn: CustomButton
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const dialog = new Dialog({
        title: i18n.settingsPanel?.configManagement?.customButtonConflictTitle || `自定义按钮 ${index + 1} 配置冲突`,
        content: `<div class="custom-button-conflict-dialog" style="padding: 20px; min-width: 500px;">
          <p style="margin-bottom: 16px; color: var(--b3-theme-on-surface);">
            ${i18n.settingsPanel?.configManagement?.customButtonConflictDesc || '检测到配置冲突，请选择要使用的版本：'}
          </p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <!-- 当前版本 -->
            <div style="border: 2px solid var(--b3-border-color); border-radius: 8px; padding: 16px; background: var(--b3-theme-surface);">
              <h4 style="margin: 0 0 12px 0; color: var(--b3-theme-primary); font-size: 14px;">
                ${i18n.settingsPanel?.configManagement?.currentVersion || '当前版本'}
              </h4>
              <div style="margin-bottom: 8px;">
                <strong>${currentBtn.name}</strong> ${currentBtn.icon}
              </div>
              <div style="font-size: 12px; color: var(--b3-theme-on-surface); margin-bottom: 12px; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
                <strong>提示词:</strong> ${currentBtn.prompt || '(空)'}
              </div>
              <button class="view-full-prompt-current b3-button b3-button--outline" style="width: 100%; font-size: 12px;">
                ${i18n.settingsPanel?.configManagement?.viewFullPrompt || '查看完整提示词'}
              </button>
            </div>
            
            <!-- 导入版本 -->
            <div style="border: 2px solid var(--b3-theme-primary); border-radius: 8px; padding: 16px; background: var(--b3-theme-primary-light, rgba(66,133,244,0.05));">
              <h4 style="margin: 0 0 12px 0; color: var(--b3-theme-primary); font-size: 14px;">
                ${i18n.settingsPanel?.configManagement?.importVersion || '导入版本'}
              </h4>
              <div style="margin-bottom: 8px;">
                <strong>${importBtn.name}</strong> ${importBtn.icon}
              </div>
              <div style="font-size: 12px; color: var(--b3-theme-on-surface); margin-bottom: 12px; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
                <strong>提示词:</strong> ${importBtn.prompt || '(空)'}
              </div>
              <button class="view-full-prompt-import b3-button b3-button--outline" style="width: 100%; font-size: 12px;">
                ${i18n.settingsPanel?.configManagement?.viewFullPrompt || '查看完整提示词'}
              </button>
            </div>
          </div>
          
          <div class="b3-dialog__action" style="justify-content: flex-end; padding: 0;">
            <button class="use-current-btn b3-button b3-button--cancel" style="margin-right: 8px;">
              ${i18n.settingsPanel?.configManagement?.useCurrent || '使用当前版本'}
            </button>
            <button class="use-import-btn b3-button b3-button--text">
              ${i18n.settingsPanel?.configManagement?.useImport || '使用导入版本'}
            </button>
          </div>
        </div>`,
        width: '600px'
      });

      // 查看当前版本完整提示词
      dialog.element.querySelector('.view-full-prompt-current')?.addEventListener('click', () => {
        alert(`${i18n.settingsPanel?.configManagement?.currentPromptTitle || '当前版本完整提示词'}:\n\n${currentBtn.prompt || '(空)'}`);
      });

      // 查看导入版本完整提示词
      dialog.element.querySelector('.view-full-prompt-import')?.addEventListener('click', () => {
        alert(`${i18n.settingsPanel?.configManagement?.importPromptTitle || '导入版本完整提示词'}:\n\n${importBtn.prompt || '(空)'}`);
      });

      // 使用当前版本
      dialog.element.querySelector('.use-current-btn')?.addEventListener('click', () => {
        dialog.destroy();
        resolve(false);
      });

      // 使用导入版本
      dialog.element.querySelector('.use-import-btn')?.addEventListener('click', () => {
        dialog.destroy();
        resolve(true);
      });
    });
  }
</script>

<div class="settings-panel">
  <div class="settings-header">
    <h2>⚙️ {i18n.settingsPanel?.title || 'AI Assistant Settings'}</h2>
    <div class="header-buttons">
      <button class="btn-donate" on:click={() => window.open('https://www.yuque.com/duzssy/mop740/fm59mkeo86fx5mu9?singleDoc', '_blank')} title={i18n.settingsPanel?.donate || 'Support with Donation'}>❤️</button>
      <button class="btn-close" on:click={onClose}>✕</button>
    </div>
  </div>

  <div class="settings-tabs">
    <button 
      class="tab-btn" 
      class:active={activeTab === 'providers'}
      on:click={() => activeTab = 'providers'}
    >
      {i18n.settingsPanel?.tabs?.providers || 'AI Providers'}
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'toolbar'}
      on:click={() => activeTab = 'toolbar'}
    >
      {i18n.settingsPanel?.tabs?.toolbar || 'Toolbar'}
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'ui'}
      on:click={() => activeTab = 'ui'}
    >
      {i18n.settingsPanel?.tabs?.ui || 'UI Settings'}
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'prompts'}
      on:click={() => activeTab = 'prompts'}
    >
      {i18n.settingsPanel?.tabs?.prompts || 'Custom Prompts'}
    </button>
  </div>

  <div class="settings-content">
    {#if activeTab === 'providers'}
      <div class="providers-section">
        {#if editingProvider}
          <div class="provider-form">
          <h3>{isAddingProvider ? (i18n.settingsPanel?.providers?.addNew || 'Add Provider') : (i18n.settingsPanel?.providers?.edit || 'Edit Provider')}</h3>
          
          {#if isAddingProvider}
            <div class="template-buttons">
              <label>{i18n.settingsPanel?.providers?.quickTemplate || 'Quick Template:'}</label>
                {#each DEFAULT_PROVIDER_TEMPLATES as template}
                  <button 
                    class="template-btn"
                    on:click={() => applyTemplate(template)}
                  >
                    {getProviderName(template.name)}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="form-group">
              <label>{i18n.settingsPanel?.providers?.name || 'Name *'}</label>
              <input 
                type="text" 
                bind:value={editingProvider.name}
                placeholder={i18n.settingsPanel?.providers?.namePlaceholder || 'e.g., Ollama Local'}
              />
            </div>

            <!-- 测试AI隐藏API地址等配置 -->
            {#if !isTestAI(editingProvider)}
              <div class="form-group">
                <label>{i18n.settingsPanel?.providers?.apiAddress || 'API URL *'}</label>
                <input 
                  type="text" 
                  bind:value={editingProvider.baseURL}
                  placeholder={i18n.settingsPanel?.providers?.apiAddressPlaceholder || 'http://localhost:11434/v1'}
                />
              </div>

              <div class="form-group">
                <label>{i18n.settingsPanel?.providers?.apiKey || 'API Key'}</label>
                <input 
                  type="password" 
                  bind:value={editingProvider.apiKey}
                  placeholder={i18n.settingsPanel?.providers?.apiKeyPlaceholder || 'sk-...'}
                />
              </div>
            {/if}

            <div class="form-group">
              <label>{i18n.settingsPanel?.providers?.modelName || 'Model Name *'}</label>
              <input 
                type="text" 
                bind:value={editingProvider.model}
                placeholder={i18n.settingsPanel?.providers?.modelPlaceholder || 'llama3.2'}
                disabled={isTestAI(editingProvider)}
              />
            </div>

            {#if !isTestAI(editingProvider)}
              <div class="form-row">
                <div class="form-group">
            <label>{i18n.settingsPanel?.providers?.temperature || 'Temperature (0-2)'}</label>
            <input 
              type="number" 
              bind:value={editingProvider.temperature}
              min="0"
              max="2"
              step="0.1"
            />
          </div>

          <div class="form-group">
            <label>{i18n.settingsPanel?.providers?.maxTokens || 'Max Tokens'}</label>
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
                <div class="test-result-header">✅ {i18n.settingsPanel?.providers?.testSuccess || 'Connection Successful'}</div>
                <div class="test-result-content">{testMessage}</div>
              </div>
            {:else if testStatus === 'error'}
              <div class="test-result error">
                <div class="test-result-header">❌ {i18n.settingsPanel?.providers?.testFailed || 'Connection Failed'}</div>
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
                  {i18n.settingsPanel?.providers?.testing || 'Testing...'}
                {:else}
                  {i18n.settingsPanel?.providers?.testConnection || 'Test Connection'}
                {/if}
              </button>
              <button class="btn-secondary" on:click={cancelEdit}>{i18n.settingsPanel?.providers?.cancel || 'Cancel'}</button>
              <button 
                class="btn-primary" 
                on:click={saveProvider}
                disabled={!isTestPassed}
                title={!isTestPassed ? (i18n.settingsPanel?.providers?.testRequired || 'Please test connection first') : ''}
              >
                {i18n.save || 'Save'}
              </button>
            </div>
            
            {#if !isTestPassed}
              <div class="test-warning">
                ⚠️ {i18n.settingsPanel?.providers?.testRequired || 'Please click "Test Connection" first, save only allowed after test passes'}
              </div>
            {/if}
          </div>
        {:else}
          <div class="providers-list">
            <div class="section-header">
              <h3>{i18n.settingsPanel?.providers?.configuredProviders || 'Configured Providers'}</h3>
              <button class="btn-primary" on:click={startAddProvider}>
                + {i18n.settingsPanel?.providers?.addNew || 'Add Provider'}
              </button>
            </div>

            {#if providers.length === 0}
              <div class="empty-state">
                <p>{i18n.settingsPanel?.providers?.noProviders || 'No configured AI providers'}</p>
                <button class="btn-primary" on:click={startAddProvider}>
                  {i18n.settingsPanel?.providers?.addFirst || 'Add First Provider'}
                </button>
              </div>
            {:else}
              {#each providers as provider}
                <div class="provider-card" class:default={provider.isDefault}>
                  <div class="provider-info">
                    <div class="provider-name">
                      {provider.name}
                      {#if provider.isDefault}
                        <span class="badge">{i18n.providers?.default || 'Default'}</span>
                      {/if}
                    </div>
                    <div class="provider-details">
                      {#if isTestAI(provider)}
                        {provider.model} ({i18n.settingsPanel?.providers?.testAI || 'Test AI'})
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
                          {i18n.settingsPanel?.providers?.setAsDefault || 'Set as Default'}
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

        <!-- 配置导入导出 -->
        <div class="config-management">
          <h3>{i18n.settingsPanel?.configManagement?.title || '配置管理'}</h3>
          <p class="section-desc">{i18n.settingsPanel?.configManagement?.desc || '导出或导入所有配置（包括AI提供商、工具栏设置、自定义提示词）'}</p>
          
          <div class="config-actions">
            <button class="btn-secondary" on:click={exportConfig}>
              📥 {i18n.settingsPanel?.configManagement?.export || '导出配置'}
            </button>
            <button class="btn-secondary" on:click={triggerImport}>
              📤 {i18n.settingsPanel?.configManagement?.import || '导入配置'}
            </button>
          </div>
          
          <input 
            type="file" 
            accept=".txt,.json" 
            bind:this={importFileInput}
            on:change={handleImportFile}
            style="display: none;"
          />
        </div>
      </div>

    {:else if activeTab === 'toolbar'}
      <div class="toolbar-section">
        <h3>{i18n.settingsPanel?.toolbar?.buttons || 'Floating Toolbar Buttons'}</h3>
        <p class="section-desc">{i18n.settingsPanel?.toolbar?.selectButtons || 'Select which buttons to show in floating toolbar'}</p>

        <div class="checkbox-list">
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.polish} on:change={() => saveToolbarButtons()} />
            <span>✨ {i18n.operations?.polish || 'Polish'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.translate} on:change={() => saveToolbarButtons()} />
            <span>🌐 {i18n.operations?.translate || 'Translate'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.summarize} on:change={() => saveToolbarButtons()} />
            <span>📝 {i18n.operations?.summarize || 'Summarize'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.expand} on:change={() => saveToolbarButtons()} />
            <span>📖 {i18n.operations?.expand || 'Expand'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.condense} on:change={() => saveToolbarButtons()} />
            <span>📄 {i18n.operations?.condense || 'Condense'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.rewrite} on:change={() => saveToolbarButtons()} />
            <span>🔄 {i18n.operations?.rewrite || 'Rewrite'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.continue} on:change={() => saveToolbarButtons()} />
            <span>➡️ {i18n.operations?.continue || 'Continue'}</span>
          </label>
        </div>

        <h4>{i18n.settingsPanel?.toolbar?.customButtons || 'Custom Buttons'}</h4>
        <p class="section-desc">{i18n.settingsPanel?.toolbar?.customSync || 'Auto-synced from "Custom Prompts" tab after configuration'}</p>
        
        <div class="checkbox-list">
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.custom1} on:change={() => saveToolbarButtons()} />
            <span>{customButtons[0]?.name || i18n.operations?.custom1 || 'Custom 1'} {customButtons[0]?.icon || '✨'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.custom2} on:change={() => saveToolbarButtons()} />
            <span>{customButtons[1]?.name || i18n.operations?.custom2 || 'Custom 2'} {customButtons[1]?.icon || '🔧'}</span>
          </label>
          <label class="checkbox-item">
            <input type="checkbox" bind:checked={toolbarButtons.custom3} on:change={() => saveToolbarButtons()} />
            <span>{customButtons[2]?.name || i18n.operations?.custom3 || 'Custom 3'} {customButtons[2]?.icon || '🎯'}</span>
          </label>
        </div>

        {#if saveMessage}
          <div class="save-message">{saveMessage}</div>
        {/if}
      </div>

    {:else if activeTab === 'ui'}
      <div class="ui-section">
        <h3>{i18n.settingsPanel?.ui?.title || 'UI Settings'}</h3>
        <p class="section-desc">{i18n.settingsPanel?.ui?.notSupported || 'UI customization not supported in MVP version'}</p>
      </div>

    {:else if activeTab === 'prompts'}
      <div class="prompts-section">
        <h3>{i18n.settingsPanel?.prompts?.title || 'Custom Button Configuration'}</h3>
        <p class="section-desc">{i18n.settingsPanel?.prompts?.desc || 'Configure three custom operation buttons (auto-sync to toolbar after enabled)'}</p>

        {#each customButtons as button, index}
          <div class="custom-button-form">
            <h4>{i18n.settingsPanel?.prompts?.buttonNumber?.replace('{n}', String(index + 1)) || 'Custom Button ' + (index + 1)}</h4>
            
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                bind:checked={button.enabled} 
                on:change={() => handleCustomButtonEnabledChange(index)}
              />
              <span>{i18n.settingsPanel?.prompts?.enable || 'Enable this button'}</span>
            </label>

            <div class="form-group">
              <label>{i18n.settingsPanel?.prompts?.buttonName || 'Button Name'}</label>
              <input 
                type="text" 
                bind:value={button.name}
                placeholder={i18n.settingsPanel?.prompts?.buttonNamePlaceholder || 'Button display name'}
                on:input={() => saveCustomButtons()}
              />
            </div>

            <div class="form-group">
              <label>{i18n.settingsPanel?.prompts?.icon || 'Icon (emoji)'}</label>
              <input 
                type="text" 
                bind:value={button.icon}
                placeholder={i18n.settingsPanel?.prompts?.iconPlaceholder || '✨'}
                maxlength="2"
                on:input={() => saveCustomButtons()}
              />
            </div>

            <div class="form-group">
              <label>{i18n.settingsPanel?.prompts?.prompt || 'AI Prompt'}</label>
              <textarea 
                bind:value={button.prompt}
                placeholder={i18n.settingsPanel?.prompts?.promptPlaceholder || 'Enter AI prompt, e.g., Convert the following content to table format:'}
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

  // Config Management
  .config-management {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 2px solid var(--b3-border-color);

    h3 {
      margin-top: 0;
      margin-bottom: 8px;
      color: var(--b3-theme-on-background);
    }
  }

  .config-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;

    button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
    }
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
