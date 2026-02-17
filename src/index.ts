import { Plugin, Dialog } from 'siyuan';
import ChatPanel from './components/ChatPanel.svelte';
import SettingsPanel from './components/SettingsPanel.svelte';
import DiffViewer from './components/DiffViewer.svelte';
import { settingsService } from './services/settings';
import { aiService } from './services/ai';
import { blockService } from './services/block';
import { FloatingToolbar } from './libs/floating-toolbar';
import { ContextMenuManager } from './libs/context-menu';
import { showDialog } from './libs/dialog';
import type { AIOperationType } from './types';
import { DEFAULT_PROMPTS } from './types';
import './index.scss';

const PLUGIN_ID = 'siyuan-ai-assistant';
const STORAGE_KEY = 'ai-assistant-settings';
const DOCK_TYPE = 'ai_assistant_dock';

export default class AIAssistantPlugin extends Plugin {
    private floatingToolbar: FloatingToolbar | null = null;
    private contextMenuManager: ContextMenuManager | null = null;
    private settingsDialog: Dialog | null = null;
    private diffDialog: Dialog | null = null;
    private chatPanelComponent: ChatPanel | null = null;
    private currentDiffViewer: any = null;
    private currentOriginalText: string = '';  // 完整块内容用于差异显示
    private currentSelectedText: string = '';  // 选中的文字用于精确替换
    private currentSelectionStart: number = -1;  // 选中文字在原文中的起始索引
    private currentSelectionEnd: number = -1;  // 选中文字在原文中的结束索引
    private displayTextForDiff: string = '';  // 用于Diff窗口显示的原文（选中文字或整个块）
    private isFullBlockReplace: boolean = false;  // 标记是否为整块替换（右键菜单场景）
    private blockIconClickHandler: ((event: CustomEvent) => void) | null = null; // eventBus监听器引用

    async onload() {
        // Initialize settings service
        settingsService.init(this);
        await settingsService.loadSettings();

        // Initialize AI service with current provider
        const currentProvider = settingsService.getCurrentProvider();
        if (currentProvider) {
            aiService.setProvider(currentProvider);
        }

        // Add icons
        this.addIcons(`
            <symbol id="iconAIAssistant" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </symbol>
            <symbol id="iconSparkles" viewBox="0 0 24 24">
                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </symbol>
        `);

        // Add dock
        this.addDock({
            config: {
                position: 'RightBottom',
                size: { width: 320, height: 500 },
                icon: 'iconAIAssistant',
                title: this.i18n.title || 'AI助手'
            },
            data: {
                text: this.i18n.title || 'AI助手'
            },
            type: DOCK_TYPE,
            init: (dock) => {
                this.initChatPanel(dock.element);
            }
        });

        // Initialize floating toolbar
        this.initFloatingToolbar();

        // Initialize context menu
        this.initContextMenu();
    }

    onLayoutReady() {
        // Re-initialize after layout is ready
        const currentProvider = settingsService.getCurrentProvider();
        if (currentProvider) {
            aiService.setProvider(currentProvider);
        }
    }

    onunload() {
        // Clean up floating toolbar
        if (this.floatingToolbar) {
            this.floatingToolbar.destroy();
            this.floatingToolbar = null;
        }

        // Clean up context menu
        if (this.contextMenuManager) {
            this.contextMenuManager.destroy();
            this.contextMenuManager = null;
        }

        // Clean up dialogs
        if (this.settingsDialog) {
            this.settingsDialog.destroy();
            this.settingsDialog = null;
        }

        if (this.diffDialog) {
            this.diffDialog.destroy();
            this.diffDialog = null;
        }

        // Clean up chat panel
        if (this.chatPanelComponent) {
            this.chatPanelComponent.$destroy();
            this.chatPanelComponent = null;
        }

        // Remove eventBus listener
        if (this.blockIconClickHandler) {
            this.eventBus.off('click-blockicon', this.blockIconClickHandler);
            this.blockIconClickHandler = null;
        }
    }

    /**
     * Uninstall plugin - remove config files
     */
    async uninstall() {
        // Clean up settings data - must match STORAGE_KEY in settings.ts
        await this.removeData(STORAGE_KEY);
    }

    /**
     * 打开设置面板 - 供集市调用
     */
    openSetting(): void {
        this.openSettings();
    }

    private initChatPanel(element: HTMLElement) {
        element.style.height = '100%';
        element.style.overflow = 'hidden';

        const chatPanel = new ChatPanel({
            target: element,
            props: {
                onOpenSettings: () => this.openSettings(),
                i18n: this.i18n
            }
        });

        this.chatPanelComponent = chatPanel;
    }

    private initFloatingToolbar() {
        this.floatingToolbar = new FloatingToolbar({
            onOperation: (type, original, modified, blockId, selectedText, selectionStart, selectionEnd) => {
                // selectedText 是原始选中的文字（用于精确替换）
                // original 是完整块内容（用于显示差异）
                // selectionStart/selectionEnd 是选中文字在原文中的精确索引
                this.updateDiffViewer(modified, original, selectedText, selectionStart, selectionEnd);
                // 操作完成后隐藏浮动工具栏
                this.floatingToolbar?.forceHide();
            },
            onOperationStart: (type, original, blockId, selectedText, selectionStart, selectionEnd) => {
                this.showDiffViewer(original, '⏳ ' + (this.i18n?.messages?.processing || '正在请求AI处理...'), type, blockId, selectedText, selectionStart, selectionEnd);
                // 开始操作时隐藏浮动工具栏
                this.floatingToolbar?.forceHide();
            },
            onOpenSettings: () => this.openSettings(),
            i18n: this.i18n
        });
    }

    private async ensureProviderConfigured(): Promise<boolean> {
        if (!aiService.isConfigured()) {
            const currentProvider = settingsService.getCurrentProvider();
            if (currentProvider) {
                aiService.setProvider(currentProvider);
                return true;
            }
            return false;
        }
        return true;
    }

    private initContextMenu() {
        this.contextMenuManager = new ContextMenuManager({
            onOperation: async (type, blockId, blockContentFromDOM) => {
                // 确保 AI 提供商已配置
                if (!await this.ensureProviderConfigured()) {
                    alert(this.i18n?.messages?.noProvider || 'AI 提供商未配置，请先点击设置进行配置');
                    this.openSettings();
                    return;
                }

                if (!blockId) {
                    alert(this.i18n?.messages?.blockContentEmpty || '无法获取块ID');
                    return;
                }

                try {
                    let blockContent: string;
                    
                    // 优先使用从 DOM 传递的内容（右键菜单点击时从 DOM 获取）
                    if (blockContentFromDOM && blockContentFromDOM.trim().length > 0) {
                        blockContent = blockContentFromDOM;
                    } else {
                        // 尝试使用 blockService 获取块内容（备用方案）
                        const blockInfo = await blockService.getBlockContent(blockId);
                        if (!blockInfo || (!blockInfo.markdown && !blockInfo.content)) {
                            alert(this.i18n?.messages?.blockContentEmpty || '块内容为空');
                            return;
                        }
                        // 优先使用 markdown，其次使用 content
                        blockContent = blockInfo.markdown || blockInfo.content;
                    }
                    
                    if (!blockContent || blockContent.trim().length === 0) {
                        alert(this.i18n?.messages?.blockContentEmpty || '块内容为空');
                        return;
                    }

                    // 获取自定义按钮的 prompt
                    const settings = settingsService.getSettings();
                    // 从 type (custom1, custom2, custom3) 提取索引获取对应按钮
                    let customPrompt: string | undefined;
                    if (type.startsWith('custom')) {
                        const customIndex = parseInt(type.replace('custom', '')) - 1;
                        if (customIndex >= 0 && customIndex < settings.customButtons.length) {
                            customPrompt = settings.customButtons[customIndex]?.prompt;
                        }
                    }
                    
                    // 先显示 Diff 窗口，显示"正在处理"状态
                    this.showDiffViewer(blockContent, '⏳ ' + (this.i18n?.messages?.processing || '正在请求AI处理...'), type, blockId, '', -1, -1, true);
                    
                    // 然后执行 AI 处理
                    const response = await aiService.processText(blockContent, type, customPrompt);
                    
                    // 更新 Diff 窗口显示结果
                    this.updateDiffViewer(response.content);
                } catch (error) {
                    let errorMsg = this.i18n?.messages?.error || '处理失败';
                    
                    if (error instanceof Error) {
                        const errorText = error.message.toLowerCase();
                        
                        // 超时错误
                        if (errorText.includes('timeout') || errorText.includes('aborted') || errorText.includes('etimedout')) {
                            errorMsg = this.i18n?.messages?.timeoutError || '请求超时（180秒），请检查网络连接或稍后重试';
                        }
                        // 网络错误
                        else if (errorText.includes('network') || errorText.includes('fetch') || errorText.includes('enetunreach') || errorText.includes('econnrefused')) {
                            errorMsg = this.i18n?.messages?.networkError || '网络错误，请检查网络连接';
                        }
                        // 未配置
                        else if (errorText.includes('not configured')) {
                            errorMsg = this.i18n?.messages?.noProvider || 'AI 提供商未配置，请先点击设置进行配置';
                        }
                        // 认证错误
                        else if (errorText.includes('auth') || errorText.includes('api key') || errorText.includes('unauthorized') || errorText.includes('401')) {
                            errorMsg = this.i18n?.messages?.authError || 'API密钥无效或已过期，请检查配置';
                        }
                        // 频率限制
                        else if (errorText.includes('rate limit') || errorText.includes('too many') || errorText.includes('429')) {
                            errorMsg = this.i18n?.messages?.rateLimitError || '请求过于频繁，请稍后再试';
                        }
                        // AI提供商错误
                        else if (errorText.includes('500') || errorText.includes('502') || errorText.includes('503') || errorText.includes('bad gateway') || errorText.includes('service unavailable')) {
                            errorMsg = this.i18n?.messages?.providerError || 'AI提供商服务异常，请稍后重试';
                        }
                        // 模型错误
                        else if (errorText.includes('model') || errorText.includes('invalid model') || errorText.includes('model not found')) {
                            errorMsg = this.i18n?.messages?.modelError || '模型处理失败，请重试或更换模型';
                        }
                        // 其他错误
                        else {
                            errorMsg = `${this.i18n?.messages?.error || '处理失败'}：${error.message}`;
                        }
                    }
                    
                    alert(errorMsg);
                }
            },
            onOpenSettings: () => this.openSettings(),
            i18n: this.i18n
        });

        // Listen for block icon clicks
        this.blockIconClickHandler = (event: CustomEvent) => {
            this.contextMenuManager?.injectIntoBlockMenu(event);
        };
        this.eventBus.on('click-blockicon', this.blockIconClickHandler);
    }

    private openSettings() {
        if (this.settingsDialog) {
            this.settingsDialog.destroy();
        }

        const container = document.createElement('div');
        container.style.height = '500px';

        new SettingsPanel({
            target: container,
            props: {
                onClose: () => {
                    this.settingsDialog?.destroy();
                    this.settingsDialog = null;
                },
                onProviderChange: () => {
                    // 提供商变更时更新浮动工具栏显示
                    this.floatingToolbar?.updateToolbar();
                },
                i18n: this.i18n
            }
        });

        this.settingsDialog = showDialog({
            title: '',
            content: container,
            width: '600px',
            height: '500px',
            destroyCallback: () => {
                this.settingsDialog = null;
            }
        });
    }

    private showDiffViewer(original: string, modified: string, operation: AIOperationType, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number, isFullBlock: boolean = false) {
        if (this.diffDialog) {
            this.diffDialog.destroy();
            this.diffDialog = null;
        }

        const targetBlockId = blockId;
        
        // 保存完整内容和选中文字用于应用修改时精确替换
        this.currentOriginalText = original;
        this.currentSelectedText = selectedText || '';
        this.currentSelectionStart = selectionStart ?? -1;
        this.currentSelectionEnd = selectionEnd ?? -1;
        this.isFullBlockReplace = isFullBlock; // 标记是否为整块替换

        // 设置用于Diff显示的原文：优先使用选中文字，否则使用整个块内容
        // 右键菜单场景（isFullBlock=true）：始终显示整个块内容
        this.displayTextForDiff = isFullBlock ? original : ((selectedText && selectedText.length > 0) ? selectedText : original);

        const container = document.createElement('div');

        this.currentDiffViewer = new DiffViewer({
            target: container,
            props: {
                original,
                modified,
                selectedText: this.displayTextForDiff,  // 使用中间变量
                operationType: operation,
                blockId: blockId || '',
                i18n: this.i18n
            }
        });

        // 使用$on监听Svelte事件
        this.currentDiffViewer.$on('apply', async (event: CustomEvent<string>) => {
            const result = event.detail;
            
            if (this.currentOriginalText) {
                let newContent: string;
                
                // 右键菜单场景：整块替换，直接使用 AI 结果作为新内容
                if (this.isFullBlockReplace) {
                    newContent = result;
                } else if (this.currentSelectionStart >= 0 && this.currentSelectionEnd > this.currentSelectionStart) {
                    // 浮动工具栏场景：使用索引进行精确替换
                    const beforeSelection = this.currentOriginalText.substring(0, this.currentSelectionStart);
                    const afterSelection = this.currentOriginalText.substring(this.currentSelectionEnd);
                    newContent = beforeSelection + result + afterSelection;
                } else {
                    // 回退方案：使用 DOM 中的选中文字
                    const domSelectedText = blockService.getSelectedText();
                    const textToReplace = domSelectedText || this.currentSelectedText || this.currentOriginalText;
                    newContent = this.currentOriginalText;
                    
                    const escapedSelected = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedSelected, '');
                    
                    if (regex.test(newContent)) {
                        newContent = newContent.replace(regex, result);
                    } else {
                        const trimmedSelected = textToReplace.trim();
                        const trimmedRegex = new RegExp(trimmedSelected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '');
                        if (trimmedRegex.test(newContent)) {
                            newContent = newContent.replace(trimmedRegex, result);
                        } else {
                            alert('应用失败：无法在原文中找到选中的文字');
                            this.diffDialog?.destroy();
                            this.diffDialog = null;
                            return;
                        }
                    }
                }
                
                // 直接更新块内容
                if (targetBlockId) {
                    const success = await blockService.updateBlock(targetBlockId, newContent);
                    if (!success) {
                        alert('应用修改失败，请重试');
                    }
                } else {
                    alert('无法确定要更新的文本块');
                }
            } else {
                if (targetBlockId) {
                    const success = await blockService.updateBlock(targetBlockId, result);
                    if (!success) {
                        alert('应用修改失败，请重试');
                    }
                }
            }
            
            this.diffDialog?.destroy();
            this.diffDialog = null;
            // 应用修改后，恢复浮动工具栏的显示
            this.floatingToolbar?.restoreVisibility();
        });

        this.currentDiffViewer.$on('cancel', () => {
            this.diffDialog?.destroy();
            this.diffDialog = null;
            this.currentDiffViewer = null;
            // diff 窗口关闭后，恢复浮动工具栏的显示
            this.floatingToolbar?.restoreVisibility();
        });

        // 重新生成请求
        this.currentDiffViewer.$on('regenerate', async (event: CustomEvent<{ instruction: string; original: string; currentModified: string; operationType: AIOperationType }>) => {
            const { instruction, original, currentModified, operationType } = event.detail;

            this.updateDiffViewer('⏳ ' + (this.i18n?.regenerating || '正在重新生成...'));

            try {
                // 获取原始操作提示词
                const settings = settingsService.getSettings();
                let originalPrompt = '';

                if (operationType.startsWith('custom')) {
                    // 自定义按钮：从 customButtons 中获取
                    const customBtnIndex = parseInt(operationType.replace('custom', '')) - 1;
                    if (customBtnIndex >= 0 && customBtnIndex < settings.customButtons.length) {
                        originalPrompt = settings.customButtons[customBtnIndex].prompt;
                    }
                } else {
                    // 内置操作：优先使用用户设置的，否则使用默认
                    originalPrompt = settings.operationPrompts?.[operationType] || DEFAULT_PROMPTS[operationType] || '';
                }

                const messages = [
                    {
                        role: 'system' as const,
                        content: '你是一位专业的写作助手。请根据用户的原始指令和要求，结合原文和当前已修改的版本，生成更好的内容。只输出生成后的文本，不要有任何解释。'
                    },
                    {
                        role: 'user' as const,
                        content: `【原始指令】（这是最初触发操作的AI提示词）
${originalPrompt || '（无特定指令）'}

【原文】
${original}

【当前版本】（这是之前AI根据原始指令生成的结果，用户觉得需要改进）
${currentModified}

【用户改进要求】
${instruction}

请综合原始指令、原文内容和当前版本，根据用户的改进要求生成更好的内容。直接输出文本，无需解释。`
                    }
                ];
                
                const response = await aiService['adapter']?.chatCompletion(messages);
                
                if (response && response.content) {
                    this.updateDiffViewer(response.content);
                } else {
                    alert('重新生成失败，请重试');
                    this.updateDiffViewer(currentModified);
                }
            } catch (error) {
                alert('重新生成时出错，请检查AI提供商配置');
                this.updateDiffViewer(currentModified);
            }
        });

        // 模型切换请求
        this.currentDiffViewer.$on('switchModel', async (event: CustomEvent<string>) => {
            const providerId = event.detail;
            
            try {
                await settingsService.setCurrentProvider(providerId);
                aiService.setProvider(settingsService.getCurrentProvider());
                
                this.updateDiffViewer('⏳ 正在使用新模型重新处理...');
                
                const messages = aiService.buildOperationMessages(original, operation);
                const response = await aiService['adapter']?.chatCompletion(messages);
                
                if (response && response.content) {
                    this.updateDiffViewer(response.content);
                } else {
                    alert('使用新模型处理失败，请重试');
                }
            } catch (error) {
                alert('切换模型失败');
            }
        });

        // 获取操作名称：自定义按钮从设置中读取实际名称
        const getOperationName = (op: AIOperationType): string => {
            const staticNames: Record<AIOperationType, string> = {
                chat: '对话',
                polish: '润色',
                translate: '翻译',
                summarize: '总结',
                expand: '扩写',
                condense: '精简',
                rewrite: '改写',
                continue: '续写',
                custom1: '自定义 1',
                custom2: '自定义 2',
                custom3: '自定义 3'
            };
            
            // 如果是自定义按钮，从设置中读取实际名称
            if (op.startsWith('custom')) {
                const settings = settingsService.getSettings();
                const customBtn = settings.customButtons.find(b => b.id === op);
                if (customBtn) {
                    return customBtn.name;
                }
            }
            
            return staticNames[op];
        };

        this.diffDialog = showDialog({
            title: `${getOperationName(operation)}结果 - 差异对比`,
            content: container,
            width: '800px',
            height: '600px',
            destroyCallback: () => {
                this.diffDialog = null;
                this.currentDiffViewer = null;
            }
        });
    }

    private updateDiffViewer(modified: string, original?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) {
        if (this.currentDiffViewer) {
            // 更新用于Diff显示的原文（使用中间变量）
            // 只有当 selectedText 有实际内容时才更新，否则保持当前的 displayTextForDiff
            if (selectedText !== undefined && selectedText.length > 0) {
                this.displayTextForDiff = selectedText;
            }
            // 注意：如果 selectedText 为空或 undefined，不改变 displayTextForDiff，保持之前的值

            // 构建要更新的 props
            const updateProps: any = { modified };
            // 始终更新 selectedText，使用当前保存的 displayTextForDiff
            updateProps.selectedText = this.displayTextForDiff;
            if (original !== undefined) {
                updateProps.original = original;
            }
            
            this.currentDiffViewer.$set(updateProps);
            
            // 更新保存的选中文字和索引
            if (selectedText) {
                this.currentSelectedText = selectedText;
            }
            if (original) {
                this.currentOriginalText = original;
            }
            if (selectionStart !== undefined && selectionStart >= 0) {
                this.currentSelectionStart = selectionStart;
            }
            if (selectionEnd !== undefined && selectionEnd >= 0) {
                this.currentSelectionEnd = selectionEnd;
            }
        }
    }
}
