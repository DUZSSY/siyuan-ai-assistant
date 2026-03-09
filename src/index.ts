import { Plugin, Dialog } from 'siyuan';
import ChatPanel from './components/ChatPanel.svelte';
import SettingsPanel from './components/SettingsPanel.svelte';
import DiffViewer from './components/DiffViewer.svelte';
import DiffHistoryReadonlyViewer from './components/DiffHistoryReadonlyViewer.svelte';
import CustomPromptDialog from './components/CustomPromptDialog.svelte';
import { settingsService } from './services/settings';
import { aiService } from './services/ai';
import { blockService } from './services/block';
import { historyService } from './services/history';
import { FloatingToolbar } from './libs/floating-toolbar';
import { ContextMenuManager } from './libs/context-menu';
import { showDialog, updateDialogTitle } from './libs/dialog';
import type { AIOperationType } from './types';
import type { AIChatMessage } from './types';
import type { AIResponse } from './types';
import { DEFAULT_PROMPTS } from './types';
import './index.scss';

const PLUGIN_ID = 'siyuan-ai-assistant';
const STORAGE_KEY = 'ai-assistant-settings';
const HISTORY_STORAGE_KEY = 'ai-assistant-operation-history';
const DOCK_TYPE = 'ai_assistant_dock';

export default class AIAssistantPlugin extends Plugin {
    private floatingToolbar: FloatingToolbar | null = null;
    private contextMenuManager: ContextMenuManager | null = null;
    private settingsDialog: Dialog | null = null;
    private settingsPanelComponent: SettingsPanel | null = null;
    private diffDialog: Dialog | null = null;
    private historyDialog: Dialog | null = null;
    private historyViewerComponent: DiffHistoryReadonlyViewer | null = null;
    private customInputDialog: Dialog | null = null;
    private customPromptDialogComponent: any = null;
    private chatPanelComponent: ChatPanel | null = null;
    private currentDiffViewer: any = null;
    private currentOriginalText: string = '';  // 完整块内容用于差异显示
    private currentSelectedText: string = '';  // 选中的文字用于精确替换
    private currentSelectionStart: number = -1;  // 选中文字在原文中的起始索引
    private currentSelectionEnd: number = -1;  // 选中文字在原文中的结束索引
    private displayTextForDiff: string = '';  // 用于Diff窗口显示的原文（选中文字或整个块）
    private isFullBlockReplace: boolean = false;  // 标记是否为整块替换（右键菜单场景）
    private currentOperation: AIOperationType = 'polish';  // 当前操作类型，用于模型切换时重新处理
    private currentHistoryId: string | null = null;  // 当前历史记录ID
    private currentDiffSessionId: number = 0; // 当前Diff会话ID（防止旧异步结果覆盖新会话）
    private operationRunToken: number = 0; // 当前操作令牌（防止并发竞态）
    private currentInitialPrompt: string = ''; // 当前会话的初始提示词
    private currentInitialOriginalText: string = ''; // 当前会话的初始原文（用于重新生成）
    private lastDiffRequestMessages: AIChatMessage[] | null = null; // 当前Diff最近一次请求上下文（用于切换模型重放）
    private reliabilityCheckToken: number = 0; // 模型可靠性检查令牌（防止旧检查误报）
    private silentlyCheckedProviderIds: Set<string> = new Set(); // 已做过静默连通性探测的提供商
    private blockIconClickHandler: ((event: CustomEvent) => void) | null = null; // eventBus监听器引用
    private i18nWatchTimer: number | null = null;
    private currentLangCode: 'zh_CN' | 'en_US' = 'zh_CN';

    async onload() {
        await this.syncRuntimeI18n(true);

        // Initialize settings service
        settingsService.init(this);
        await settingsService.loadSettings();

        // Initialize history service
        historyService.init(this);

        // Initialize AI service with current provider
        const currentProvider = settingsService.getCurrentProvider();
        if (currentProvider) {
            aiService.setProvider(currentProvider);
        }
        aiService.setI18n(this.i18n || {});

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

        this.startI18nWatch();
    }

    onLayoutReady() {
        // Re-initialize after layout is ready
        const currentProvider = settingsService.getCurrentProvider();
        if (currentProvider) {
            aiService.setProvider(currentProvider);
        }
        aiService.setI18n(this.i18n || {});
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

        if (this.historyDialog) {
            this.historyDialog.destroy();
            this.historyDialog = null;
        }

        // Clean up chat panel
        if (this.chatPanelComponent) {
            this.chatPanelComponent.$destroy();
            this.chatPanelComponent = null;
        }

        if (this.settingsPanelComponent) {
            this.settingsPanelComponent.$destroy();
            this.settingsPanelComponent = null;
        }

        if (this.historyViewerComponent) {
            this.historyViewerComponent.$destroy();
            this.historyViewerComponent = null;
        }

        if (this.i18nWatchTimer) {
            clearInterval(this.i18nWatchTimer);
            this.i18nWatchTimer = null;
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
        // Clean up operation history data - must match HISTORY_STORAGE_KEY in history.ts
        await this.removeData(HISTORY_STORAGE_KEY);
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
            onOperationStart: async (type, original, blockId, selectedText, selectionStart, selectionEnd) => {
                const runToken = ++this.operationRunToken;
                // 0. 重置当前历史ID
                this.currentHistoryId = null;

                const settings = settingsService.getSettings();
                const customBtn = settings.customButtons.find((b: any) => b.id === type);
                const prompt = customBtn?.prompt;

                // 固定本次会话的初始上下文（用于重新生成）
                if (type.startsWith('custom')) {
                    this.currentInitialPrompt = prompt || '';
                } else {
                    this.currentInitialPrompt = settings.operationPrompts?.[type] || DEFAULT_PROMPTS[type] || '';
                }
                this.currentInitialOriginalText = selectedText || original;

                // 1. 显示加载中
                this.showDiffViewer(original, '⏳ ' + (this.i18n?.messages?.processing || '正在请求AI处理...'), type, blockId, selectedText, selectionStart, selectionEnd);
                const sessionId = this.currentDiffSessionId;
                // 开始操作时隐藏浮动工具栏
                this.floatingToolbar?.forceHide();

                try {
                    // 2. 创建或重置历史记录
                    let historyIdForRun: string | null = null;
                    if (blockId && settings.enableOperationHistory) {
                        const history = await historyService.createHistory(
                            blockId,
                            selectedText || original,
                            type,
                            {
                                providerId: aiService.getCurrentProvider()?.id,
                                model: aiService.getCurrentProvider()?.model,
                                instruction: customBtn?.name // 记录按钮名称作为初次指令内容
                            }
                        );
                        if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                            return;
                        }
                        historyIdForRun = history.id;
                        this.currentHistoryId = historyIdForRun;
                        // 操作后立即同步历史ID以启用历史按钮
                        if (this.currentDiffViewer) {
                            this.currentDiffViewer.$set({ historyId: this.currentHistoryId });
                        }
                    }

                    // 3. 执行 AI 请求
                    const messages = aiService.buildOperationMessages(
                        selectedText || original,
                        type,
                        prompt
                    );
                    this.lastDiffRequestMessages = messages.map(msg => ({ ...msg }));

                    const response = await this.requestAIResponse(messages, (accumulated) => {
                        if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                            return;
                        }
                        this.updateDiffViewer(accumulated, original, selectedText, selectionStart, selectionEnd, sessionId);
                    }, (accumulatedReasoning) => {
                        if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                            return;
                        }
                        this.updateDiffReasoning(accumulatedReasoning, sessionId);
                    });

                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }

                    if (response && response.content) {
                        // 4. 添加到历史版本
                        if (historyIdForRun) {
                            await historyService.addVersion(
                                historyIdForRun,
                                response.content,
                                type,
                                {
                                    providerId: aiService.getCurrentProvider()?.id,
                                    model: aiService.getCurrentProvider()?.model,
                                    instruction: customBtn?.name
                                }
                            );
                        }
                        
                        // 5. 更新视图
                        this.updateDiffViewer(response.content, original, selectedText, selectionStart, selectionEnd, sessionId);
                    } else {
                        this.currentDiffViewer?.$set({ isLoading: false });
                        alert(this.i18n?.messages?.modelError || '模型处理失败，请重试或更换模型');
                    }
                } catch (error) {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    alert(this.i18n?.messages?.error || '处理失败');
                    this.currentDiffViewer?.$set({ isLoading: false });
                }
            },
            onCustomInput: (selectedText, originalText, blockId, selectionStart, selectionEnd) => {
                // 显示自定义输入对话框
                this.showCustomInputDialog(selectedText, originalText, blockId, selectionStart, selectionEnd);
                // 隐藏浮动工具栏
                this.floatingToolbar?.forceHide();
            },
            onOpenSettings: () => this.openSettings(),
            onModelChange: async (type, original, blockId, selectedText, selectionStart, selectionEnd) => {
                // 模型切换后重新执行上一操作
                await this.handleModelChangeOperation(type, original, blockId, selectedText, selectionStart, selectionEnd);
            },
            i18n: this.i18n
        });
    }

    // 处理模型切换后的重新操作
    private async handleModelChangeOperation(
        type: AIOperationType,
        original: string,
        blockId?: string,
        selectedText?: string,
        selectionStart?: number,
        selectionEnd?: number
    ): Promise<void> {
        const runToken = ++this.operationRunToken;
        // 显示处理中状态
        this.showDiffViewer(original, '⏳ ' + (this.i18n?.messages?.processing || '正在请求AI处理...'), type, blockId, selectedText, selectionStart, selectionEnd);
        const sessionId = this.currentDiffSessionId;

        try {
            const settings = settingsService.getSettings();
            let messages: AIChatMessage[];

            if (this.lastDiffRequestMessages && this.lastDiffRequestMessages.length > 0) {
                messages = this.lastDiffRequestMessages.map(msg => ({ ...msg }));
            } else {
                const customBtn = settings.customButtons.find((b: any) => b.id === type);
                const prompt = customBtn?.prompt;
                messages = aiService.buildOperationMessages(
                    selectedText || original,
                    type,
                    prompt
                );
            }

            this.lastDiffRequestMessages = messages.map(msg => ({ ...msg }));

            const response = await this.requestAIResponse(messages, (accumulated) => {
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                this.updateDiffViewer(accumulated, original, selectedText, selectionStart, selectionEnd, sessionId);
            }, (accumulatedReasoning) => {
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                this.updateDiffReasoning(accumulatedReasoning, sessionId);
            });

            if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                return;
            }
                
                if (response && response.content) {
                    // 添加新版本到历史记录
                    const currentProvider = aiService.getCurrentProvider();
                    if (this.currentHistoryId) {
                        await historyService.addVersion(
                            this.currentHistoryId,
                            response.content,
                            type,
                            {
                                providerId: currentProvider?.id,
                                model: currentProvider?.model
                            }
                        );
                    }

                    // 显示结果
                    this.updateDiffViewer(response.content, original, selectedText, selectionStart, selectionEnd, sessionId);
                }
            } catch (error) {
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                alert(this.i18n?.messages?.error || '处理失败');
            }
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

    private isStreamingEnabled(): boolean {
        return !!settingsService.getSettings().enableStreamingOutput;
    }

    private async requestAIResponse(
        messages: AIChatMessage[],
        onProgress?: (accumulated: string) => void,
        onReasoning?: (accumulated: string) => void
    ): Promise<AIResponse> {
        if (!this.isStreamingEnabled()) {
            if (onReasoning) {
                onReasoning('');
            }
            return aiService.chatCompletion(messages);
        }

        try {
            if (onReasoning) {
                onReasoning('');
            }

            const streamResponse = await aiService.streamChatCompletion(messages, (_chunk, accumulated) => {
                if (onProgress) {
                    onProgress(accumulated);
                }
            }, (_chunk, accumulatedReasoning) => {
                if (onReasoning) {
                    onReasoning(accumulatedReasoning);
                }
            });

            if (!streamResponse?.content || !streamResponse.content.trim()) {
                console.warn('[AI Assistant] Streaming returned empty final content, fallback to non-streaming once.');
                return aiService.chatCompletion(messages);
            }

            return streamResponse;
        } catch (streamError) {
            console.warn('[AI Assistant] Streaming failed, fallback to non-streaming:', streamError);
            if (onReasoning) {
                onReasoning('');
            }
            return aiService.chatCompletion(messages);
        }
    }

    private isLocalOrLanUrl(url: string): boolean {
        return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(url);
    }

    /**
     * 静默可用性探测（非必要不检测）：
     * - 本地/LAN（如 Ollama）：发送一次极小 warmup 请求触发模型加载
     * - 远程提供商：执行 /models 连通性探测
     * - 每个提供商会话内仅检测一次
     * - 失败仅记录日志，不弹窗打扰
     */
    private async checkModelReliabilitySilently() {
        const provider = settingsService.getCurrentProvider();
        if (!provider) {
            return;
        }

        // 非必要不重复检测：同一提供商当前会话只做一次轻量探测
        if (this.silentlyCheckedProviderIds.has(provider.id)) {
            return;
        }

        const checkToken = ++this.reliabilityCheckToken;
        const providerIdAtStart = provider.id;

        const isStale = () => {
            const currentProvider = aiService.getCurrentProvider();
            const currentProviderId = currentProvider?.id;
            return checkToken !== this.reliabilityCheckToken || providerIdAtStart !== currentProviderId;
        };

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 30000);

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (provider.apiKey && provider.apiKey !== 'ollama') {
                headers['Authorization'] = `Bearer ${provider.apiKey}`;
            }

            const baseURL = provider.baseURL.replace(/\/+$/, '');
            const isLocalProvider = this.isLocalOrLanUrl(provider.baseURL);

            if (isLocalProvider) {
                // 本地模型 warmup：请求体尽量小，仅用于触发模型加载
                const warmupResponse = await fetch(`${baseURL}/chat/completions`, {
                    method: 'POST',
                    headers,
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: provider.model,
                        messages: [{ role: 'user', content: 'hi' }],
                        max_tokens: 1,
                        temperature: 0
                    })
                });

                if (!warmupResponse.ok) {
                    throw new Error(`Warmup failed: HTTP ${warmupResponse.status} ${warmupResponse.statusText}`);
                }
            } else {
                const testResponse = await fetch(`${baseURL}/models`, {
                    method: 'GET',
                    headers,
                    signal: controller.signal
                });

                if (!testResponse.ok) {
                    throw new Error(`HTTP ${testResponse.status} ${testResponse.statusText}`);
                }
            }

            if (isStale()) {
                return;
            }

            this.silentlyCheckedProviderIds.add(provider.id);
        } catch (error) {
            if (isStale()) {
                return;
            }

            // 静默检测失败不弹窗，避免干扰正常使用
            console.warn('[AI Assistant] Silent connectivity check skipped/fail:', {
                provider: `${provider.name} (${provider.model})`,
                baseURL: provider.baseURL,
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    private initContextMenu() {
        this.contextMenuManager = new ContextMenuManager({
            onOperation: async (type, blockId, blockContentFromDOM) => {
                const runToken = ++this.operationRunToken;
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

                // 0. 重置当前历史ID
                this.currentHistoryId = null;

                try {
                    let blockContent: string;

                    // 优先使用 blockService 获取块内容，确保与最终写回格式一致
                    const blockInfo = await blockService.getBlockContent(blockId);
                    if (blockInfo && (blockInfo.markdown || blockInfo.content)) {
                        blockContent = blockInfo.markdown || blockInfo.content;
                    } else {
                        // DOM 内容仅作为兜底
                        blockContent = (blockContentFromDOM || '').trim();
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
                    const sessionId = this.currentDiffSessionId;

                    // 固定会话上下文
                    if (type.startsWith('custom')) {
                        const customBtnForCtx = settings.customButtons.find((b: any) => b.id === type);
                        this.currentInitialPrompt = customBtnForCtx?.prompt || '';
                    } else {
                        this.currentInitialPrompt = settings.operationPrompts?.[type] || DEFAULT_PROMPTS[type] || '';
                    }
                    this.currentInitialOriginalText = blockContent;
                    
                    // 为右键菜单操作也创建历史记录
                    let historyIdForRun: string | null = null;
                    if (blockId && settingsService.getSettings().enableOperationHistory) {
                        const history = await historyService.createHistory(
                            blockId,
                            blockContent,
                            type,
                            {
                                providerId: aiService.getCurrentProvider()?.id,
                                model: aiService.getCurrentProvider()?.model
                            }
                        );
                        if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                            return;
                        }
                        historyIdForRun = history.id;
                        this.currentHistoryId = historyIdForRun;
                        // 更新 DiffViewer 以包含 historyId（显示历史按钮）
                        if (this.currentDiffViewer) {
                            this.currentDiffViewer.$set({ historyId: this.currentHistoryId });
                        }
                    }

                    // 然后执行 AI 处理
                    const messages = aiService.buildOperationMessages(blockContent, type, customPrompt);
                    this.lastDiffRequestMessages = messages.map(msg => ({ ...msg }));
                    const response = await this.requestAIResponse(messages, (accumulated) => {
                        if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                            return;
                        }
                        this.updateDiffViewer(accumulated, undefined, undefined, undefined, undefined, sessionId);
                    }, (accumulatedReasoning) => {
                        if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                            return;
                        }
                        this.updateDiffReasoning(accumulatedReasoning, sessionId);
                    });

                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }

                    if (response && response.content && historyIdForRun) {
                        await historyService.addVersion(
                            historyIdForRun,
                            response.content,
                            type,
                            {
                                providerId: aiService.getCurrentProvider()?.id,
                                model: aiService.getCurrentProvider()?.model
                            }
                        );
                    }

                    if (response && response.content) {
                        // 更新 Diff 窗口显示结果
                        this.updateDiffViewer(response.content, undefined, undefined, undefined, undefined, sessionId);
                    } else {
                        this.currentDiffViewer?.$set({ isLoading: false });
                        alert(this.i18n?.messages?.modelError || '模型处理失败，请重试或更换模型');
                    }
                } catch (error) {
                    if (runToken !== this.operationRunToken) {
                        return;
                    }
                    let errorMsg = this.i18n?.messages?.error || '处理失败';
                    
                    if (error instanceof Error) {
                        const errorText = error.message.toLowerCase();
                        const timeoutSec = Math.max(1, Math.round((settingsService.getSettings()?.requestTimeout || 600000) / 1000));
                        
                        // 超时错误
                        if (errorText.includes('timeout') || errorText.includes('aborted') || errorText.includes('etimedout')) {
                            errorMsg = this.i18n?.messages?.timeoutError || `请求超时（${timeoutSec}秒），请检查网络连接或稍后重试`;
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
            onCustomInput: async (blockId, blockContent) => {
                // 右键菜单的自定义输入处理：优先使用 API 块内容，DOM 内容仅兜底
                let safeBlockContent = (blockContent || '').trim();
                const blockInfo = await blockService.getBlockContent(blockId);
                if (blockInfo && (blockInfo.markdown || blockInfo.content)) {
                    safeBlockContent = blockInfo.markdown || blockInfo.content;
                }
                this.showCustomInputDialogForBlock(blockId, safeBlockContent);
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

        this.settingsPanelComponent = new SettingsPanel({
            target: container,
            props: {
                onClose: () => {
                    this.settingsPanelComponent?.$destroy();
                    this.settingsDialog?.destroy();
                    this.settingsDialog = null;
                    this.settingsPanelComponent = null;
                },
                onProviderChange: () => {
                    // 同步 AI 服务提供商
                    const currentProvider = settingsService.getCurrentProvider();
                    if (currentProvider) {
                        aiService.setProvider(currentProvider);
                    }
                    // 提供商变更时更新浮动工具栏显示
                    this.floatingToolbar?.updateToolbar();
                    // 异步静默检查模型可用性
                    this.checkModelReliabilitySilently();
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
                this.settingsPanelComponent?.$destroy();
                this.settingsDialog = null;
                this.settingsPanelComponent = null;
            }
        });
    }

    /**
     * 显示历史版本对话框
     */
    private showHistoryDialog(historyId: string) {
        const container = document.createElement('div');
        container.style.height = '100%';

        if (this.historyDialog) {
            this.historyDialog.destroy();
        }

        this.historyViewerComponent = new DiffHistoryReadonlyViewer({
            target: container,
            props: {
                historyId,
                i18n: this.i18n
            }
        });

        this.historyDialog = showDialog({
            title: this.i18n.history?.viewHistory || '历史版本',
            content: container,
            width: '800px',
            height: '600px',
            destroyCallback: () => {
                this.historyViewerComponent?.$destroy();
                this.historyViewerComponent = null;
                this.historyDialog = null;
            }
        });
        
        this.historyViewerComponent.$on('close', () => {
            this.historyDialog?.destroy();
        });

        // 监听版本回退事件
        this.historyViewerComponent.$on('rollback', async (event: CustomEvent<{ version: OperationVersion }>) => {
            const version = event.detail.version;
            
            try {
                // 1. 记录回退操作到历史记录 (作为新版本添加，类型为 rollback)
                await historyService.addVersion(
                    historyId,
                    version.text,
                    'rollback',
                    { 
                        instruction: `v${version.version}` // 记录回退的版本号作为指令参考
                    }
                );

                // 2. 更新 Diff Viewer
                if (this.currentDiffViewer) {
                    this.currentDiffViewer.$set({
                        modified: version.text
                    });
                }

                // 3. 关闭对话框
                this.historyDialog?.destroy();
                
            } catch (error) {
                // 回退失败，静默处理
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
        this.currentOperation = operation; // 保存操作类型，用于模型切换时重新处理
        this.currentDiffSessionId += 1;
        const sessionId = this.currentDiffSessionId;

        // 设置用于Diff显示的原文：优先使用选中文字，否则使用整个块内容
        // 右键菜单场景（isFullBlock=true）：始终显示整个块内容
        this.displayTextForDiff = isFullBlock ? original : ((selectedText && selectedText.length > 0) ? selectedText : original);

        const container = document.createElement('div');

        this.currentDiffViewer = new DiffViewer({
            target: container,
            props: {
                original,
                modified,
                reasoning: '',
                hasReasoning: false,
                selectedText: this.displayTextForDiff,  // 使用中间变量
                operationType: operation,
                blockId: blockId || '',
                i18n: this.i18n,
                historyId: this.currentHistoryId  // 传递当前历史ID
            }
        });

        // 监听查看历史事件
        this.currentDiffViewer.$on('viewHistory', async () => {
            if (!this.currentHistoryId) {
                alert(this.i18n.history?.noHistory || '暂无历史记录');
                return;
            }
            
            const history = await historyService.getHistory(this.currentHistoryId);
            if (!history) {
                alert(this.i18n.history?.noHistory || '暂无历史记录');
                return;
            }

            this.showHistoryDialog(history.id);
        });

        // 使用$on监听Svelte事件
        this.currentDiffViewer.$on('apply', async (event: CustomEvent<string>) => {
            const result = event.detail;
            
            if (this.currentOriginalText) {
                let newContent: string;
                let appliedSelectionStart = -1;
                
// 右键菜单场景：整块替换，直接使用 AI 结果作为新内容
          if (this.isFullBlockReplace) {
            newContent = result;
            // 将多段内容转换为假换行（单换行），避免触发思源重建索引
            newContent = newContent.replace(/\n\n+/g, '\n');
                } else {
                    const selectedText = this.currentSelectedText;
                    if (!selectedText || selectedText.length === 0) {
                        alert(this.i18n?.messages?.selectionContextLost || this.i18n?.messages?.applyFailedSelection || 'Apply failed: selected text context is missing');
                        this.diffDialog?.destroy();
                        this.diffDialog = null;
                        return;
                    }

                    let replaceStart = this.currentSelectionStart;
                    let replaceEnd = this.currentSelectionEnd;
                    const hasValidRange = replaceStart >= 0 && replaceEnd > replaceStart && replaceEnd <= this.currentOriginalText.length;

                    if (hasValidRange) {
                        const indexedText = this.currentOriginalText.substring(replaceStart, replaceEnd);
                        const isIndexedMatch = indexedText === selectedText || indexedText.trim() === selectedText.trim();
                        if (!isIndexedMatch) {
                            const bestIndex = this.findBestSelectionIndex(this.currentOriginalText, selectedText, this.currentSelectionStart);
                            if (bestIndex >= 0) {
                                replaceStart = bestIndex;
                                replaceEnd = bestIndex + selectedText.length;
                            } else {
                                // 索引已失效且无法重新定位，禁止继续使用旧索引
                                replaceStart = -1;
                                replaceEnd = -1;
                            }
                        }
                    } else {
                        const bestIndex = this.findBestSelectionIndex(this.currentOriginalText, selectedText, this.currentSelectionStart);
                        if (bestIndex >= 0) {
                            replaceStart = bestIndex;
                            replaceEnd = bestIndex + selectedText.length;
                        } else {
                            replaceStart = -1;
                            replaceEnd = -1;
                        }
                    }

                    // 二次校验：即使有索引，也必须能映射回原选中文字
                    if (replaceStart >= 0 && replaceEnd > replaceStart) {
                        const candidateText = this.currentOriginalText.substring(replaceStart, replaceEnd);
                        const isCandidateMatch = candidateText === selectedText || candidateText.trim() === selectedText.trim();
                        if (!isCandidateMatch) {
                            replaceStart = -1;
                            replaceEnd = -1;
                        }
                    }

if (replaceStart >= 0 && replaceEnd > replaceStart) {
              const beforeSelection = this.currentOriginalText.substring(0, replaceStart);
              const afterSelection = this.currentOriginalText.substring(replaceEnd);
              newContent = beforeSelection + result + afterSelection;
              // 将多段内容转换为假换行（单换行），避免触发思源重建索引
              newContent = newContent.replace(/\n\n+/g, '\n');
              appliedSelectionStart = replaceStart;
} else if (targetBlockId) {
              const fallbackReplace = await blockService.replaceSelectedText(targetBlockId, selectedText, result);
              if (fallbackReplace.success && fallbackReplace.content !== undefined) {
                newContent = fallbackReplace.content;
                // 将多段内容转换为假换行（单换行），避免触发思源重建索引
                newContent = newContent.replace(/\n\n+/g, '\n');
                appliedSelectionStart = this.findBestSelectionIndex(newContent, result, this.currentSelectionStart);
                        } else {
                            alert(this.i18n?.messages?.applyFailedSelection || 'Apply failed: selected text not found in original');
                            this.diffDialog?.destroy();
                            this.diffDialog = null;
                            return;
                        }
                    } else {
                        alert(this.i18n?.messages?.applyFailedSelection || 'Apply failed: selected text not found in original');
                        this.diffDialog?.destroy();
                        this.diffDialog = null;
                        return;
                    }
                }
                
                // 直接更新块内容
                if (targetBlockId) {
                    const success = await blockService.updateBlock(targetBlockId, newContent);
                    if (!success) {
                        alert(this.i18n?.messages?.applyFailed || '应用修改失败，请重试');
                    } else {
                        // 更新保存的原始文本为最新内容，以便后续重新生成或切换模型时使用
                        this.currentOriginalText = newContent;
                        if (this.currentHistoryId) {
                            await historyService.markAsApplied(this.currentHistoryId);
                        }
                        if (this.isFullBlockReplace) {
                            this.currentSelectedText = '';
                            this.currentSelectionStart = -1;
                            this.currentSelectionEnd = -1;
                        } else {
                            this.currentSelectedText = result;
                            if (appliedSelectionStart >= 0) {
                                this.currentSelectionStart = appliedSelectionStart;
                                this.currentSelectionEnd = appliedSelectionStart + result.length;
                            } else {
                                const resultStart = newContent.indexOf(result);
                                this.currentSelectionStart = resultStart;
                                this.currentSelectionEnd = resultStart >= 0 ? (resultStart + result.length) : -1;
                            }
                        }
                    }
                } else {
                    alert(this.i18n?.messages?.unknownBlock || '无法确定要更新的文本块');
                }
            } else {
                if (targetBlockId) {
                    const success = await blockService.updateBlock(targetBlockId, result);
                    if (!success) {
                        alert(this.i18n?.messages?.applyFailed || '应用修改失败，请重试');
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
            const runToken = ++this.operationRunToken;
            const { instruction, original, currentModified } = event.detail;
            const historyIdForRequest = this.currentHistoryId;
            const originalForRequest = this.currentInitialOriginalText || original;
            const originalPromptForRequest = this.currentInitialPrompt;

            // 显示加载状态，改善用户体验，避免看到中间提示文本
            this.currentDiffViewer?.$set({ isLoading: true });
            this.updateDiffReasoning('', sessionId);

            try {
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }

                const systemPrompt = this.i18n?.prompts?.regenerateSystemPromptUi || this.i18n?.prompts?.regenerateSystemPrompt || `你是专业写作助手。请严格遵守：
1. 【绝对禁止】输出"好的"、"以下是"、"修改结果"等任何前导或后继语
2. 【绝对禁止】解释修改理由、提及"改进要求"或添加总结
3. 【必须直接】同时结合原始指令、原文、当前修改稿和新改进要求输出结果
4. 【格式保持】保持原文的段落、换行、标点格式
5. 【语言一致】你的思考过程（若模型会返回）与最终正文，必须使用与思源界面语言一致的语言

输出必须是且仅是修改后的纯文本。`;

                const currentUiLang = (this.i18n?.meta?.languageName)
                    || (((window as any)?.siyuan?.config?.lang === 'en_US' || (window as any)?.siyuan?.config?.lang === 'en-US') ? 'English' : '简体中文');
                const languageConstraint = `【界面语言强制】思考过程（若模型返回）与最终正文，必须使用 ${currentUiLang}。`;

                const messages = [
                    {
                        role: 'system' as const,
                        content: `${systemPrompt}\n\n${languageConstraint}`
                    },
                    {
                        role: 'user' as const,
                        content: `${languageConstraint}\n\n原始指令：${originalPromptForRequest || '无'}
原文：${originalForRequest}
当前修改稿：${currentModified}
新的改进要求：${instruction}

请综合上述信息，直接输出最终修改后的文本：`
                    }
                ];
                this.lastDiffRequestMessages = messages.map(msg => ({ ...msg }));
                
                const response = await this.requestAIResponse(messages, (accumulated) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffViewer(accumulated, undefined, undefined, undefined, undefined, sessionId);
                }, (accumulatedReasoning) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffReasoning(accumulatedReasoning, sessionId);
                });

                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                
                if (response && response.content) {
                    // 添加到历史版本
                    if (historyIdForRequest) {
                        const currentProvider = aiService.getCurrentProvider();
                        await historyService.addVersion(
                            historyIdForRequest,
                            response.content,
                            'regenerate',
                            {
                                providerId: currentProvider?.id,
                                model: currentProvider?.model,
                                instruction: instruction // 记录改进要求
                            }
                        );
                    }
                    this.updateDiffViewer(response.content, undefined, undefined, undefined, undefined, sessionId);
                } else {
                    alert(this.i18n?.messages?.regenerateFailed || '重新生成失败，请重试');
                    this.updateDiffViewer(currentModified, undefined, undefined, undefined, undefined, sessionId);
                }
            } catch (error) {
                alert(this.i18n?.messages?.regenerateError || '重新生成时出错，请检查AI提供商配置');
                this.updateDiffViewer(currentModified, undefined, undefined, undefined, undefined, sessionId);
            } finally {
                // 关闭加载状态
                if (runToken === this.operationRunToken && sessionId === this.currentDiffSessionId) {
                    this.currentDiffViewer?.$set({ isLoading: false });
                }
            }
        });

        // 模型切换请求
        this.currentDiffViewer.$on('switchModel', async (event: CustomEvent<string>) => {
            const runToken = ++this.operationRunToken;
            const providerId = event.detail;
            const historyIdForRequest = this.currentHistoryId;
            const messagesForRequest = this.lastDiffRequestMessages ? this.lastDiffRequestMessages.map(msg => ({ ...msg })) : null;
            
            // 显示加载状态
            this.currentDiffViewer?.$set({ isLoading: true });
            this.updateDiffReasoning('', sessionId);

            try {
                await settingsService.setCurrentProvider(providerId);
                aiService.setProvider(settingsService.getCurrentProvider());

                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }

                if (!messagesForRequest || messagesForRequest.length === 0) {
                    alert(this.i18n?.messages?.switchModelFailed || '使用新模型处理失败，请重试');
                    return;
                }

                this.lastDiffRequestMessages = messagesForRequest.map(msg => ({ ...msg }));
                const response = await this.requestAIResponse(messagesForRequest, (accumulated) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffViewer(accumulated, undefined, undefined, undefined, undefined, sessionId);
                }, (accumulatedReasoning) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffReasoning(accumulatedReasoning, sessionId);
                });

                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                
                if (response && response.content) {
                    // 添加到历史版本
                    if (historyIdForRequest) {
                        const currentProvider = aiService.getCurrentProvider();
                        await historyService.addVersion(
                            historyIdForRequest,
                            response.content,
                            'switchModel',
                            {
                                providerId: currentProvider?.id,
                                model: currentProvider?.model
                            }
                        );
                    }
                    this.updateDiffViewer(response.content, undefined, undefined, undefined, undefined, sessionId);
                } else {
                    alert(this.i18n?.messages?.switchModelFailed || '使用新模型处理失败，请重试');
                }
            } catch (error) {
                alert(this.i18n?.messages?.switchModelError || '切换模型失败');
            } finally {
                // 关闭加载状态
                if (runToken === this.operationRunToken && sessionId === this.currentDiffSessionId) {
                    this.currentDiffViewer?.$set({ isLoading: false });
                }
            }
        });

        // 监听直接编辑事件
        this.currentDiffViewer.$on('directEdit', async (event: CustomEvent<string>) => {
            const editedContent = event.detail;
            const historyIdForRequest = this.currentHistoryId;
            
            if (historyIdForRequest) {
                await historyService.addVersion(
                    historyIdForRequest,
                    editedContent,
                    'directEdit' as any, // 使用 directEdit 作为操作类型
                    {
                        instruction: '手动编辑'
                    }
                );
            }
        });

        this.diffDialog = showDialog({
            title: this.getDiffDialogTitle(operation),
            content: container,
            width: '800px',
            height: '600px',
            destroyCallback: () => {
                this.diffDialog = null;
                this.currentDiffViewer = null;
            }
        });
    }

    private updateDiffViewer(modified: string, original?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number, expectedSessionId?: number, reasoning?: string) {
        if (expectedSessionId !== undefined && expectedSessionId !== this.currentDiffSessionId) {
            return;
        }

        if (this.currentDiffViewer) {
            // 更新用于Diff显示的原文（使用中间变量）
            // 只有当 selectedText 有实际内容时才更新，否则保持当前的 displayTextForDiff
            if (selectedText !== undefined && selectedText.length > 0) {
                this.displayTextForDiff = selectedText;
            }
            // 注意：如果 selectedText 为空或 undefined，不改变 displayTextForDiff，保持之前的值

            // 构建要更新的 props
            const updateProps: any = { modified };
            if (reasoning !== undefined) {
                updateProps.reasoning = reasoning;
            }
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

    private updateDiffReasoning(reasoning: string, expectedSessionId?: number) {
        if (expectedSessionId !== undefined && expectedSessionId !== this.currentDiffSessionId) {
            return;
        }

        if (!this.currentDiffViewer) {
            return;
        }

        const reasoningEnabled = settingsService.getSettings().enableReasoningOutput !== false;
        const normalizedReasoning = reasoningEnabled ? (reasoning || '').trim() : '';
        this.currentDiffViewer.$set({
            reasoning: reasoningEnabled ? (reasoning || '') : '',
            hasReasoning: normalizedReasoning.length > 0
        });
    }

    private startI18nWatch(): void {
        this.currentLangCode = this.getUiLangCode();
        this.i18nWatchTimer = window.setInterval(() => {
            void this.syncRuntimeI18n();
        }, 1000);
    }

    private getUiLangCode(): 'zh_CN' | 'en_US' {
        const lang = (window as any)?.siyuan?.config?.lang;
        return lang === 'en_US' || lang === 'en-US' ? 'en_US' : 'zh_CN';
    }

    private async loadRuntimeI18n(langCode: 'zh_CN' | 'en_US'): Promise<Record<string, any> | null> {
        try {
            const baseUrl = new URL('.', import.meta.url).href;
            const response = await fetch(`${baseUrl}i18n/${langCode}.json`, { cache: 'no-cache' });
            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch {
            return null;
        }
    }

    private async syncRuntimeI18n(force = false): Promise<void> {
        const nextLangCode = this.getUiLangCode();
        if (!force && nextLangCode === this.currentLangCode) {
            return;
        }

        const nextI18n = await this.loadRuntimeI18n(nextLangCode);
        if (!nextI18n) {
            this.currentLangCode = nextLangCode;
            return;
        }

        this.currentLangCode = nextLangCode;
        this.i18n = nextI18n;
        this.applyI18nToOpenViews();
    }

    private applyI18nToOpenViews(): void {
        aiService.setI18n(this.i18n || {});
        this.chatPanelComponent?.$set({ i18n: this.i18n });
        this.settingsPanelComponent?.$set({ i18n: this.i18n });
        this.customPromptDialogComponent?.$set?.({ i18n: this.i18n });
        this.currentDiffViewer?.$set({ i18n: this.i18n });
        this.historyViewerComponent?.$set({ i18n: this.i18n });

        this.floatingToolbar?.setI18n(this.i18n);
        this.contextMenuManager?.setI18n(this.i18n);

        if (this.diffDialog) {
            updateDialogTitle(this.diffDialog, this.getDiffDialogTitle(this.currentOperation));
        }

        if (this.historyDialog) {
            updateDialogTitle(this.historyDialog, this.i18n.history?.viewHistory || '历史版本');
        }

        if (this.customInputDialog) {
            updateDialogTitle(this.customInputDialog, this.i18n?.customInput?.title || '💬 对话');
        }
    }

    private getOperationNameForDialog(op: AIOperationType): string {
        const staticNames: Record<string, string> = {
            chat: this.i18n.operations?.chat || 'Chat',
            polish: this.i18n.operations?.polish || 'Polish',
            translate: this.i18n.operations?.translate || 'Translate',
            summarize: this.i18n.operations?.summarize || 'Summarize',
            expand: this.i18n.operations?.expand || 'Expand',
            condense: this.i18n.operations?.condense || 'Condense',
            rewrite: this.i18n.operations?.rewrite || 'Rewrite',
            continue: this.i18n.operations?.continue || 'Continue',
            custom1: this.i18n.operations?.custom1 || 'Custom 1',
            custom2: this.i18n.operations?.custom2 || 'Custom 2',
            custom3: this.i18n.operations?.custom3 || 'Custom 3',
            customInput: this.i18n.operations?.customInput || 'Chat',
            directEdit: this.i18n.diff?.directEdit || 'Direct Edit',
            rollback: this.i18n.history?.rollback || 'Rollback',
            original: this.i18n.history?.original || 'Original'
        };

        const opStr = op as string;
        if (opStr.startsWith('custom')) {
            const settings = settingsService.getSettings();
            const customBtn = settings.customButtons.find(button => button.id === opStr);
            if (customBtn) {
                return customBtn.name;
            }
        }

        return staticNames[opStr] || opStr;
    }

    private getDiffDialogTitle(operation: AIOperationType): string {
        return `${this.getOperationNameForDialog(operation)} - ${this.i18n.diff?.title || 'Diff View'}`;
    }

    /**
     * 在内容中寻找最接近原始位置的选中文字索引
     */
    private findBestSelectionIndex(content: string, selectedText: string, preferredStart: number = -1): number {
        if (!content || !selectedText) {
            return -1;
        }

        if (preferredStart >= 0) {
            const preferredSlice = content.substring(preferredStart, preferredStart + selectedText.length);
            if (preferredSlice === selectedText || preferredSlice.trim() === selectedText.trim()) {
                return preferredStart;
            }
        }

        const allMatches: number[] = [];
        let cursor = 0;
        while (cursor <= content.length) {
            const foundIndex = content.indexOf(selectedText, cursor);
            if (foundIndex === -1) {
                break;
            }
            allMatches.push(foundIndex);
            cursor = foundIndex + 1;
        }

        if (allMatches.length === 0) {
            const trimmed = selectedText.trim();
            if (!trimmed) {
                return -1;
            }
            return content.indexOf(trimmed);
        }

        if (preferredStart < 0) {
            return allMatches[0];
        }

        let best = allMatches[0];
        let minDistance = Math.abs(allMatches[0] - preferredStart);
        for (let i = 1; i < allMatches.length; i++) {
            const distance = Math.abs(allMatches[i] - preferredStart);
            if (distance < minDistance) {
                minDistance = distance;
                best = allMatches[i];
            }
        }

        return best;
    }

    /**
     * 显示自定义输入对话框（浮动工具栏版本）
     */
    private showCustomInputDialog(selectedText: string, blockContent: string, blockId: string | null, selectionStart: number, selectionEnd: number): void {
        if (this.customInputDialog) {
            this.customInputDialog.destroy();
            this.customInputDialog = null;
        }

        const container = document.createElement('div');

        this.customPromptDialogComponent = new CustomPromptDialog({
            target: container,
            props: {
                selectedText: selectedText,
                i18n: this.i18n
            }
        });

        // 监听确认事件
        this.customPromptDialogComponent.$on('confirm', async (event: CustomEvent<string>) => {
            const customPrompt = event.detail;
            const runToken = ++this.operationRunToken;
            this.currentHistoryId = null;
            this.customInputDialog?.destroy();
            this.customInputDialog = null;

            // 保存当前状态用于后续处理（遵循快捷工具逻辑）
            this.currentOriginalText = blockContent;
            this.currentSelectedText = selectedText;
            this.currentSelectionStart = selectionStart;
            this.currentSelectionEnd = selectionEnd;
            this.isFullBlockReplace = false;
            this.displayTextForDiff = selectedText;
            this.currentInitialPrompt = customPrompt;
            this.currentInitialOriginalText = selectedText;

            // 显示 Diff 窗口（显示"正在处理"状态）
            this.showDiffViewer(blockContent, '⏳ ' + (this.i18n?.messages?.processing || '正在请求AI处理...'), 'customInput', blockId || undefined, selectedText, selectionStart, selectionEnd);
            const sessionId = this.currentDiffSessionId;

            // 创建历史记录（仅记录当前选中文本范围）
            let historyIdForRun: string | null = null;
            const settings = settingsService.getSettings();
            if (blockId && settings.enableOperationHistory) {
                const history = await historyService.createHistory(
                    blockId,
                    selectedText,
                    'customInput',
                    {
                        providerId: aiService.getCurrentProvider()?.id,
                        model: aiService.getCurrentProvider()?.model,
                        instruction: customPrompt
                    }
                );
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                historyIdForRun = history.id;
                this.currentHistoryId = historyIdForRun;
                if (this.currentDiffViewer) {
                    this.currentDiffViewer.$set({ historyId: this.currentHistoryId });
                }
            }

            // 执行 AI 处理（遵循快捷工具的统一 prompt 逻辑）
            try {
                // 使用 aiService.buildOperationMessages 以应用统一的系统 Prompt 和输出约束
                const messages = aiService.buildOperationMessages(selectedText, 'customInput', customPrompt);
                this.lastDiffRequestMessages = messages.map(msg => ({ ...msg }));
                
                const response = await this.requestAIResponse(messages, (accumulated) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffViewer(accumulated, undefined, undefined, undefined, undefined, sessionId);
                }, (accumulatedReasoning) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffReasoning(accumulatedReasoning, sessionId);
                });

                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                
                if (response && response.content) {
                    if (historyIdForRun) {
                        await historyService.addVersion(
                            historyIdForRun,
                            response.content,
                            'customInput',
                            {
                                providerId: aiService.getCurrentProvider()?.id,
                                model: aiService.getCurrentProvider()?.model,
                                instruction: customPrompt
                            }
                        );
                    }
                    this.updateDiffViewer(response.content, undefined, undefined, undefined, undefined, sessionId);
                } else {
                    this.currentDiffViewer?.$set({ isLoading: false });
                    alert(this.i18n?.messages?.modelError || '模型处理失败，请重试或更换模型');
                }
            } catch (error) {
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                alert(this.i18n?.messages?.error || '处理失败');
                this.currentDiffViewer?.$set({ isLoading: false });
            }
        });

        // 监听取消事件
        this.customPromptDialogComponent.$on('cancel', () => {
            this.customInputDialog?.destroy();
            this.customInputDialog = null;
        });

        this.customInputDialog = showDialog({
            title: this.i18n?.customInput?.title || '💬 对话',
            content: container,
            width: '520px',
            height: 'auto',
            destroyCallback: () => {
                this.customInputDialog = null;
                this.customPromptDialogComponent = null;
            }
        });
    }

    /**
     * 显示自定义输入对话框（右键菜单版本 - 整块替换）
     */
    private showCustomInputDialogForBlock(blockId: string, blockContent: string): void {
        if (this.customInputDialog) {
            this.customInputDialog.destroy();
            this.customInputDialog = null;
        }

        const container = document.createElement('div');

        this.customPromptDialogComponent = new CustomPromptDialog({
            target: container,
            props: {
                selectedText: blockContent,
                i18n: this.i18n
            }
        });

        // 监听确认事件
        this.customPromptDialogComponent.$on('confirm', async (event: CustomEvent<string>) => {
            const customPrompt = event.detail;
            const runToken = ++this.operationRunToken;
            this.currentHistoryId = null;
            this.customInputDialog?.destroy();
            this.customInputDialog = null;

            // 保存当前状态
            this.currentOriginalText = blockContent;
            this.currentSelectedText = '';
            this.currentSelectionStart = -1;
            this.currentSelectionEnd = -1;
            this.isFullBlockReplace = true;
            this.displayTextForDiff = blockContent;
            this.currentInitialPrompt = customPrompt;
            this.currentInitialOriginalText = blockContent;

            // 显示 Diff 窗口（整块替换模式）
            this.showDiffViewer(blockContent, '⏳ ' + (this.i18n?.messages?.processing || '正在请求AI处理...'), 'customInput', blockId, '', -1, -1, true);
            const sessionId = this.currentDiffSessionId;

            // 创建历史记录（整块上下文）
            let historyIdForRun: string | null = null;
            if (blockId && settingsService.getSettings().enableOperationHistory) {
                const history = await historyService.createHistory(
                    blockId,
                    blockContent,
                    'customInput',
                    {
                        providerId: aiService.getCurrentProvider()?.id,
                        model: aiService.getCurrentProvider()?.model,
                        instruction: customPrompt
                    }
                );
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                historyIdForRun = history.id;
                this.currentHistoryId = historyIdForRun;
                if (this.currentDiffViewer) {
                    this.currentDiffViewer.$set({ historyId: this.currentHistoryId });
                }
            }

            // 执行 AI 处理
            try {
                // 使用 aiService.buildOperationMessages 以应用统一的系统 Prompt 和输出约束
                const messages = aiService.buildOperationMessages(blockContent, 'customInput', customPrompt);
                this.lastDiffRequestMessages = messages.map(msg => ({ ...msg }));
                
                const response = await this.requestAIResponse(messages, (accumulated) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffViewer(accumulated, undefined, undefined, undefined, undefined, sessionId);
                }, (accumulatedReasoning) => {
                    if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                        return;
                    }
                    this.updateDiffReasoning(accumulatedReasoning, sessionId);
                });

                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                
                if (response && response.content) {
                    if (historyIdForRun) {
                        await historyService.addVersion(
                            historyIdForRun,
                            response.content,
                            'customInput',
                            {
                                providerId: aiService.getCurrentProvider()?.id,
                                model: aiService.getCurrentProvider()?.model,
                                instruction: customPrompt
                            }
                        );
                    }
                    this.updateDiffViewer(response.content, undefined, undefined, undefined, undefined, sessionId);
                }
            } catch (error) {
                if (runToken !== this.operationRunToken || sessionId !== this.currentDiffSessionId) {
                    return;
                }
                alert(this.i18n?.messages?.error || '处理失败');
            }
        });

        // 监听取消事件
        this.customPromptDialogComponent.$on('cancel', () => {
            this.customInputDialog?.destroy();
            this.customInputDialog = null;
        });

        this.customInputDialog = showDialog({
            title: this.i18n?.customInput?.title || '💬 对话',
            content: container,
            width: '520px',
            height: 'auto',
            destroyCallback: () => {
                this.customInputDialog = null;
                this.customPromptDialogComponent = null;
            }
        });
    }
}
