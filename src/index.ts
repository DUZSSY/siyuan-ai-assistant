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
import './index.scss';

const PLUGIN_ID = 'siyuan-ai-assistant';
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

    async onload() {
        console.log(`[${PLUGIN_ID}] Plugin loading...`);

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

        // Add top bar button
        this.addTopBar({
            icon: 'iconAIAssistant',
            title: this.i18n.title || 'AI助手',
            position: 'right',
            callback: () => this.toggleDock()
        });

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

        // Register commands
        this.addCommand({
            langKey: 'toggleAIAssistant',
            hotkey: 'Alt+Cmd+A',
            callback: () => this.toggleDock()
        });

        console.log(`[${PLUGIN_ID}] Plugin loaded successfully`);
    }

    onLayoutReady() {
        // Re-initialize after layout is ready
        const currentProvider = settingsService.getCurrentProvider();
        if (currentProvider) {
            aiService.setProvider(currentProvider);
        }
    }

    onunload() {
        console.log(`[${PLUGIN_ID}] Plugin unloading...`);
        
        this.floatingToolbar?.destroy();
        this.floatingToolbar = null;
        
        this.settingsDialog?.destroy();
        this.settingsDialog = null;
        
        this.diffDialog?.destroy();
        this.diffDialog = null;

        console.log(`[${PLUGIN_ID}] Plugin unloaded`);
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
                onOpenSettings: () => this.openSettings()
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
            },
            onOperationStart: (type, original, blockId, selectedText, selectionStart, selectionEnd) => {
                this.showDiffViewer(original, '⏳ 正在请求AI处理...', type, blockId, selectedText, selectionStart, selectionEnd);
            },
            onOpenSettings: () => this.openSettings()
        });
    }

    private initContextMenu() {
        this.contextMenuManager = new ContextMenuManager({
            onOperation: async (type, blockId) => {
                const block = await blockService.getBlockContent(blockId);
                if (!block) return;

                try {
                    const response = await aiService.processText(block.content, type);
                    this.showDiffViewer(block.content, response.content, type, blockId);
                } catch (error) {
                    console.error('[AI Assistant] Context menu operation failed:', error);
                    alert('操作失败，请检查AI提供商配置');
                }
            },
            onOpenSettings: () => this.openSettings()
        });

        // Listen for block icon clicks
        this.eventBus.on('click-blockicon', (event: CustomEvent) => {
            this.contextMenuManager?.injectIntoBlockMenu(event);
        });
    }

    private toggleDock() {
        const dock = document.querySelector(`[data-type="${DOCK_TYPE}"]`);
        if (dock) {
            const isHidden = dock.classList.contains('fn__none');
            if (isHidden) {
                dock.classList.remove('fn__none');
            } else {
                dock.classList.add('fn__none');
            }
        }
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
                }
            }
        });

        this.settingsDialog = showDialog({
            title: 'AI助手设置',
            content: container,
            width: '600px',
            height: '500px',
            destroyCallback: () => {
                this.settingsDialog = null;
            }
        });
    }

    private showDiffViewer(original: string, modified: string, operation: AIOperationType, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) {
        if (this.diffDialog) {
            this.diffDialog.destroy();
        }

        const targetBlockId = blockId;
        
        // 保存完整内容和选中文字用于应用修改时精确替换
        // ⚠️ 重要：直接使用保存的内容，不再调用API获取（API可能返回空）
        this.currentOriginalText = original;
        this.currentSelectedText = selectedText || '';
        this.currentSelectionStart = selectionStart ?? -1;
        this.currentSelectionEnd = selectionEnd ?? -1;

        console.log('[AI Assistant] showDiffViewer called:');
        console.log('  - original (完整内容):', original?.substring(0, 50));
        console.log('  - modified (AI结果):', modified?.substring(0, 50));
        console.log('  - selectedText (选中文字):', selectedText);
        console.log('  - selectionStart (起始索引):', this.currentSelectionStart);
        console.log('  - selectionEnd (结束索引):', this.currentSelectionEnd);
        console.log('  - this.currentOriginalText 已保存:', this.currentOriginalText?.substring(0, 50));

        const container = document.createElement('div');

        this.currentDiffViewer = new DiffViewer({
            target: container,
            props: {
                original,
                modified,
                selectedText: selectedText || '',
                operationType: operation,
                blockId: blockId || ''
            }
        });

        // 使用$on监听Svelte事件
        this.currentDiffViewer.$on('apply', async (event: CustomEvent<string>) => {
            const result = event.detail;
            console.log('[AI Assistant] Applying changes');
            console.log('  - result (DiffViewer返回):', result?.substring(0, 50));
            console.log('  - this.currentOriginalText:', this.currentOriginalText?.substring(0, 50));
            console.log('  - this.currentSelectionStart:', this.currentSelectionStart);
            console.log('  - this.currentSelectionEnd:', this.currentSelectionEnd);
            
            if (this.currentOriginalText) {
                let newContent: string;
                
                // 优先使用索引进行精确替换（解决多相同字符的问题）
                if (this.currentSelectionStart >= 0 && this.currentSelectionEnd > this.currentSelectionStart) {
                    // 使用索引进行精确替换
                    const beforeSelection = this.currentOriginalText.substring(0, this.currentSelectionStart);
                    const afterSelection = this.currentOriginalText.substring(this.currentSelectionEnd);
                    newContent = beforeSelection + result + afterSelection;
                    
                    console.log('[AI Assistant] 使用索引精确替换成功:');
                    console.log('  - 前缀:', beforeSelection?.substring(0, 30) + '...');
                    console.log('  - 替换后:', result?.substring(0, 30) + '...');
                    console.log('  - 后缀:', afterSelection?.substring(0, 30) + '...');
                } else {
                    // 回退方案：使用正则替换（向后兼容）
                    console.warn('[AI Assistant] 索引信息不可用，使用回退方案');
                    
                    // ⚠️ 重要：实时从 DOM 获取选中文字，而不是依赖保存的值
                    const domSelectedText = blockService.getSelectedText();
                    console.log('  - DOM选中文字:', domSelectedText);
                    
                    // 优先使用 DOM 中的选中文字，如果为空则使用保存的值
                    const textToReplace = domSelectedText || this.currentSelectedText || this.currentOriginalText;
                    console.log('  - 最终用于替换的文字:', textToReplace);
                    
                    // 直接在保存的原文上进行替换，不调用API
                    newContent = this.currentOriginalText;
                    
                    // 尝试精确匹配并替换
                    const escapedSelected = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedSelected, '');
                    
                    if (regex.test(newContent)) {
                        newContent = newContent.replace(regex, result);
                        console.log('[AI Assistant] 正则替换成功:', newContent);
                    } else {
                        // 如果找不到匹配，尝试trim后匹配
                        const trimmedSelected = textToReplace.trim();
                        const trimmedRegex = new RegExp(trimmedSelected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '');
                        if (trimmedRegex.test(newContent)) {
                            newContent = newContent.replace(trimmedRegex, result);
                            console.log('[AI Assistant] Trim替换成功:', newContent);
                        } else {
                            // 如果 trim 后还是找不到，说明选中的文字不在原文中
                            console.warn('[AI Assistant] 无法找到选中文字在原文中的位置');
                            console.warn('[AI Assistant] 原文:', newContent);
                            console.warn('[AI Assistant] 要替换的文字:', textToReplace);
                            // 回退到 AI 结果（只替换选中的部分，保持原文其他内容）
                            // 方案：在原文中找到最接近的位置进行替换
                            if (domSelectedText && newContent.includes(domSelectedText.substring(0, 10))) {
                                // 找到部分匹配，尝试模糊替换
                                const partialMatch = domSelectedText.substring(0, Math.min(10, domSelectedText.length));
                                const partialIndex = newContent.indexOf(partialMatch);
                                if (partialIndex !== -1) {
                                    const beforePartial = newContent.substring(0, partialIndex);
                                    // 找到选中文字在原文中的结束位置
                                    let endOffset = partialIndex + partialMatch.length;
                                    while (endOffset < newContent.length && endOffset < partialIndex + domSelectedText.length) {
                                        endOffset++;
                                    }
                                    const afterPartial = newContent.substring(endOffset);
                                    newContent = beforePartial + result + afterPartial;
                                    console.log('[AI Assistant] 模糊替换成功:', newContent);
                                }
                            } else {
                                // 完全无法匹配，回退到完整替换（但保留原文）
                                console.error('[AI Assistant] 严重错误：选中文字不在原文中！');
                                alert('应用失败：无法在原文中找到选中的文字');
                                this.diffDialog?.destroy();
                                this.diffDialog = null;
                                return;
                            }
                        }
                    }
                }
                
                // 直接更新块内容
                if (targetBlockId) {
                    console.log('[AI Assistant] Updating block:', targetBlockId);
                    console.log('[AI Assistant] 最终内容:', newContent);
                    const success = await blockService.updateBlock(targetBlockId, newContent);
                    if (success) {
                        console.log('[AI Assistant] Block updated successfully');
                    } else {
                        console.error('[AI Assistant] Failed to update block');
                        alert('应用修改失败，请重试');
                    }
                } else {
                    console.error('[AI Assistant] No block ID found');
                    alert('无法确定要更新的文本块');
                }
            } else {
                // 如果没有保存的内容，回退到AI结果
                console.warn('[AI Assistant] 没有保存的内容，使用AI结果');
                if (targetBlockId) {
                    const success = await blockService.updateBlock(targetBlockId, result);
                    if (!success) {
                        alert('应用修改失败，请重试');
                    }
                }
            }
            
            this.diffDialog?.destroy();
            this.diffDialog = null;
        });

        this.currentDiffViewer.$on('cancel', () => {
            this.diffDialog?.destroy();
            this.diffDialog = null;
            this.currentDiffViewer = null;
        });

        // 重新生成请求
        this.currentDiffViewer.$on('regenerate', async (event: CustomEvent<{ instruction: string; original: string; currentModified: string }>) => {
            const { instruction, original, currentModified } = event.detail;
            console.log('[AI Assistant] Regenerating:', instruction);
            
            this.updateDiffViewer('⏳ 正在重新生成...');
            
            try {
                const messages = [
                    { 
                        role: 'system' as const, 
                        content: '你是一位专业的写作助手。请根据用户的要求，结合原文，生成更好的内容。只输出生成后的文本，不要有任何解释。' 
                    },
                    { 
                        role: 'user' as const, 
                        content: `【原文】
${original}

【用户要求】
${instruction}

请根据要求重新生成内容，直接输出文本，无需解释。` 
                    }
                ];
                
                const response = await aiService['adapter']?.chatCompletion(messages);
                
                if (response && response.content) {
                    console.log('[AI Assistant] Regenerated successfully');
                    this.updateDiffViewer(response.content);
                } else {
                    console.error('[AI Assistant] Regeneration failed: empty response');
                    alert('重新生成失败，请重试');
                    this.updateDiffViewer(currentModified);
                }
            } catch (error) {
                console.error('[AI Assistant] Regeneration error:', error);
                alert('重新生成时出错，请检查AI提供商配置');
                this.updateDiffViewer(currentModified);
            }
        });

        // 模型切换请求
        this.currentDiffViewer.$on('switchModel', async (event: CustomEvent<string>) => {
            const providerId = event.detail;
            console.log('[AI Assistant] Switching model to:', providerId);
            
            try {
                await settingsService.setCurrentProvider(providerId);
                aiService.setProvider(settingsService.getCurrentProvider());
                
                // 使用当前provider重新处理
                this.updateDiffViewer('⏳ 正在使用新模型重新处理...');
                
                const messages = aiService.buildOperationMessages(original, operation);
                const response = await aiService['adapter']?.chatCompletion(messages);
                
                if (response && response.content) {
                    console.log('[AI Assistant] Model switch and reprocess completed');
                    this.updateDiffViewer(response.content);
                } else {
                    console.error('[AI Assistant] Reprocess failed');
                    alert('使用新模型处理失败，请重试');
                }
            } catch (error) {
                console.error('[AI Assistant] Model switch error:', error);
                alert('切换模型失败');
            }
        });

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

        this.diffDialog = showDialog({
            title: `${operationNames[operation] || 'AI'}结果 - 差异对比`,
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
            console.log('[AI Assistant] Updating diff viewer with new content');
            
            // 构建要更新的 props
            const updateProps: any = { modified };
            if (selectedText !== undefined) {
                updateProps.selectedText = selectedText;
            }
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
