import { aiService } from '../services/ai';
import { settingsService } from '../services/settings';
import { blockService } from '../services/block';
import type { AIOperationType, AIProvider } from '../types';

export interface FloatingToolbarOptions {
    onOperation: (type: AIOperationType, originalText: string, modifiedText: string, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) => void;
    onOperationStart: (type: AIOperationType, originalText: string, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) => void;
    onOpenSettings: () => void;
}

export class FloatingToolbar {
    private toolbarElement: HTMLElement | null = null;
    private options: FloatingToolbarOptions;
    private isVisible = false;
    private hideTimeout: number | null = null;
    private currentSelection = '';
    private currentBlockId: string | null = null;
    private currentSelectionStart: number = -1;
    private currentSelectionEnd: number = -1;
    private modelDropdownElement: HTMLElement | null = null;

    // 拖拽相关
    private isDragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private isPinned = false;

    // 事件处理器引用（用于正确移除监听器）
    private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
    private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
    private scrollHandler: (() => void) | null = null;
    private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
    private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    private globalMouseUpHandler: ((e: MouseEvent) => void) | null = null;

    constructor(options: FloatingToolbarOptions) {
        this.options = options;
        this.bindEvents();
    }

    private bindEvents(): void {
        let selectionTimeout: number;

        // 保存处理器引用以便后续移除
        this.mouseUpHandler = (e: MouseEvent) => {
            clearTimeout(selectionTimeout);
            selectionTimeout = window.setTimeout(() => {
                this.handleSelectionChange(e);
            }, 200);
        };

        this.mouseDownHandler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (this.modelDropdownElement && !this.modelDropdownElement.contains(target)) {
                this.hideModelDropdown();
            }
            if (this.toolbarElement && !this.toolbarElement.contains(target)) {
                this.hide();
            }
        };

        this.scrollHandler = () => {
            this.hide();
            this.hideModelDropdown();
        };

        this.keyDownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hideModelDropdown();
                this.hide();
            }
        };

        document.addEventListener('mouseup', this.mouseUpHandler);
        document.addEventListener('mousedown', this.mouseDownHandler);
        document.addEventListener('scroll', this.scrollHandler, true);
        document.addEventListener('keydown', this.keyDownHandler);
    }

    private handleSelectionChange(event: MouseEvent): void {
        const settings = settingsService.getSettings();
        
        if (!settings.showFloatingToolbar) {
            return;
        }

        const target = event.target as HTMLElement;
        if (!target.closest('.protyle-wysiwyg')) {
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            this.hide();
            return;
        }

        const text = selection.toString().trim();
        if (text.length < 1) {
            this.hide();
            return;
        }

        this.currentBlockId = blockService.getCurrentBlockId();

        // 计算选中文字在块内容中的精确位置
        this.calculateSelectionIndices(selection, text);
        
        this.currentSelection = text;
        this.show(event, text);
    }

    /**
     * 计算选中文字在块内容中的起始和结束索引
     */
    private calculateSelectionIndices(selection: Selection, selectedText: string): void {
        // 重置索引
        this.currentSelectionStart = -1;
        this.currentSelectionEnd = -1;

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // 向上查找包含选中文字的块元素
        let element: Element | null = container.nodeType === Node.ELEMENT_NODE 
            ? container as Element 
            : container.parentElement;

        let blockElement: Element | null = null;
        while (element) {
            if (element.classList && element.classList.contains('p')) {
                blockElement = element;
                break;
            }
            element = element.parentElement;
        }

        if (!blockElement) {
            return;
        }

        const blockContent = blockElement.textContent || '';
        const rawSelectedText = selection.toString(); // 使用原始选中文本（不trim）来匹配
        
        // 计算选中文字在块内容中的起始索引
        // 使用 range 的偏移量来计算相对位置
        let startOffset = 0;
        let endOffset = 0;

        // 创建一个范围来选择从块开始到选中开始的内容
        const blockRange = document.createRange();
        blockRange.selectNodeContents(blockElement);
        blockRange.setEnd(range.startContainer, range.startOffset);
        
        // 计算从开始到选中位置的字符数
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(blockRange.cloneContents());
        startOffset = tempDiv.textContent?.length || 0;
        
        // 计算选中文字的结束位置
        endOffset = startOffset + rawSelectedText.length;

        this.currentSelectionStart = startOffset;
        this.currentSelectionEnd = endOffset;

        // 验证计算结果
        const extractedText = blockContent.substring(startOffset, endOffset);
        if (extractedText !== rawSelectedText) {
            // 回退方案：使用 indexOf 查找第一次出现的位置
            const fallbackIndex = blockContent.indexOf(rawSelectedText);
            if (fallbackIndex !== -1) {
                this.currentSelectionStart = fallbackIndex;
                this.currentSelectionEnd = fallbackIndex + rawSelectedText.length;
            }
        }
    }

    private show(event: MouseEvent, selectedText: string): void {
        if (!this.toolbarElement) {
            this.createToolbar();
        }

        if (!this.toolbarElement) return;

        // 如果已经固定，不要重新定位
        if (this.isPinned) {
            this.toolbarElement.style.display = 'block';
            this.toolbarElement.classList.add('show');
            this.isVisible = true;
            return;
        }

        this.refreshToolbar();

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const toolbarHeight = this.toolbarElement.offsetHeight || 50;
        const toolbarWidth = this.toolbarElement.offsetWidth || 300;

        // 计算位置：优先显示在选中文本上方，如果不合适则显示在下方
        let top = rect.top - toolbarHeight - 10;
        let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);

        // 确保不超出视口边界
        if (top < 10) {
            top = rect.bottom + 15; // 显示在选中文本下方，增加间距避免覆盖
        }
        
        // 水平居中，但确保不超出边界
        if (left < 10) {
            left = 10;
        }
        if (left + toolbarWidth > window.innerWidth - 10) {
            left = window.innerWidth - toolbarWidth - 10;
        }

        // 如果下方也不够空间，尝试显示在右侧
        if (top + toolbarHeight > window.innerHeight - 10 && top > rect.bottom + 10) {
            top = rect.top;
            left = rect.right + 10;
            if (left + toolbarWidth > window.innerWidth - 10) {
                left = rect.left - toolbarWidth - 10;
            }
        }

        this.toolbarElement.style.top = `${top + window.scrollY}px`;
        this.toolbarElement.style.left = `${left + window.scrollX}px`;
        this.toolbarElement.style.display = 'block';
        
        this.toolbarElement.classList.add('show');
        this.isVisible = true;

        this.resetHideTimeout();
    }

    private hide(): void {
        if (!this.toolbarElement || !this.isVisible) return;
        
        // 如果已固定，不自动隐藏（但允许手动关闭）
        if (this.isPinned) return;

        this.toolbarElement.classList.remove('show');
        this.toolbarElement.style.display = 'none';
        this.isVisible = false;
        this.currentSelection = '';
        this.currentBlockId = null;
        this.currentSelectionStart = -1;
        this.currentSelectionEnd = -1;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }
    
    /**
     * 强制隐藏（即使已固定）- 用于关闭按钮或操作完成后
     */
    public forceHide(): void {
        if (!this.toolbarElement || !this.isVisible) return;

        this.toolbarElement.classList.remove('show');
        this.toolbarElement.style.display = 'none';
        this.isVisible = false;
        this.isPinned = false; // 取消固定状态
        this.currentSelection = '';
        this.currentBlockId = null;
        this.currentSelectionStart = -1;
        this.currentSelectionEnd = -1;

        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }

    private resetHideTimeout(): void {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = window.setTimeout(() => {
            this.hide();
            this.hideModelDropdown();
        }, 10000);
    }

    private refreshToolbar(): void {
        if (!this.toolbarElement) return;

        const settings = settingsService.getSettings();
        const provider = settingsService.getCurrentProvider();
        const buttons = settings.toolbarButtons;

        const providerNameEl = this.toolbarElement.querySelector('.provider-name');
        if (providerNameEl) {
            providerNameEl.textContent = provider
                ? `${provider.name} : ${provider.model}`
                : '⚠️ 未配置';
        }

        const buttonsContainer = this.toolbarElement.querySelector('.toolbar-buttons');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = '';

            const actions: { type: AIOperationType; label: string; icon: string; enabled: boolean }[] = [
                { type: 'polish', label: '润色', icon: '✨', enabled: buttons.polish },
                { type: 'translate', label: '翻译', icon: '🌐', enabled: buttons.translate },
                { type: 'summarize', label: '总结', icon: '📝', enabled: buttons.summarize },
                { type: 'expand', label: '扩写', icon: '📖', enabled: buttons.expand },
                { type: 'condense', label: '精简', icon: '📄', enabled: buttons.condense },
                { type: 'rewrite', label: '改写', icon: '🔄', enabled: buttons.rewrite },
                { type: 'continue', label: '续写', icon: '➡️', enabled: buttons.continue }
            ];

            settings.customButtons.forEach((btn, index) => {
                if (btn.enabled) {
                    const btnKey = `custom${index + 1}` as keyof typeof buttons;
                    actions.push({
                        type: `custom${index + 1}` as AIOperationType,
                        label: btn.name,
                        icon: btn.icon,
                        enabled: buttons[btnKey] || false
                    });
                }
            });

            actions.filter(a => a.enabled).forEach(action => {
                const btn = document.createElement('button');
                btn.className = 'toolbar-btn';
                btn.innerHTML = `<span class="icon">${action.icon}</span><span>${action.label}</span>`;
                btn.addEventListener('click', () => this.handleOperation(action.type));
                buttonsContainer.appendChild(btn);
            });
        }
    }

    private createModelDropdown(): void {
        if (this.modelDropdownElement) {
            this.modelDropdownElement.remove();
            this.modelDropdownElement = null;
        }

        const settings = settingsService.getSettings();
        const providers = settings.providers;
        const currentProviderId = settings.currentProviderId;

        if (providers.length === 0) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'ai-model-dropdown';
        dropdown.style.cssText = `
            position: fixed;
            z-index: 10000;
            background: var(--b3-theme-background, #fff);
            border: 1px solid var(--b3-border-color, #e0e0e0);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            max-height: 200px;
            overflow-y: auto;
            min-width: 200px;
            padding: 4px 0;
        `;

        providers.forEach(provider => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            const isCurrent = provider.id === currentProviderId;
            item.style.cssText = `
                padding: 10px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                color: var(--b3-theme-on-background, #333);
            `;
            
            if (isCurrent) {
                item.style.background = 'var(--b3-theme-primary-light, rgba(66, 133, 244, 0.1))';
            }
            
            item.innerHTML = `
                <span>${provider.name}</span>
                <span style="color: var(--b3-theme-on-surface, #666); font-size: 12px;">: ${provider.model}</span>
                ${isCurrent ? '<span style="margin-left: auto; color: var(--b3-theme-success, #22c55e);">✓</span>' : ''}
            `;
            
            item.addEventListener('click', async (e) => {
                e.stopPropagation();

                await settingsService.setCurrentProvider(provider.id);
                aiService.setProvider(provider);

                this.refreshToolbar();
                this.hideModelDropdown();
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--b3-theme-hover, rgba(0, 0, 0, 0.05))';
            });
            item.addEventListener('mouseleave', () => {
                if (!isCurrent) {
                    item.style.background = '';
                }
            });
            
            dropdown.appendChild(item);
        });

        document.body.appendChild(dropdown);
        this.modelDropdownElement = dropdown;
    }

    private showModelDropdown(): void {
        if (!this.toolbarElement) return;
        
        this.hideModelDropdown();
        this.createModelDropdown();
        
        if (!this.modelDropdownElement) return;

        const providerBtn = this.toolbarElement.querySelector('.provider-name');
        if (!providerBtn) return;

        const rect = providerBtn.getBoundingClientRect();
        this.modelDropdownElement.style.top = `${rect.bottom + 5}px`;
        this.modelDropdownElement.style.left = `${rect.left}px`;
    }

    private hideModelDropdown(): void {
        if (this.modelDropdownElement) {
            this.modelDropdownElement.remove();
            this.modelDropdownElement = null;
        }
    }

    private createToolbar(): void {
        const toolbar = document.createElement('div');
        toolbar.className = 'ai-floating-toolbar';
        toolbar.style.cssText = `
            position: fixed;
            display: none;
            z-index: 9999;
            background: var(--b3-theme-background, #fff);
            border: 1px solid var(--b3-border-color, #e0e0e0);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            padding: 8px;
            font-family: var(--b3-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            user-select: none;
        `;

        const provider = settingsService.getCurrentProvider();
        const providerInfo = provider
            ? `${provider.name} : ${provider.model}`
            : '⚠️ 未配置';
            
        const header = document.createElement('div');
        header.className = 'toolbar-header';
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--b3-border-color, #e0e0e0); cursor: move;';
        header.innerHTML = `
            <span class="drag-handle" style="cursor: move; padding: 2px 4px; margin-right: 4px; color: var(--b3-theme-on-surface, #999);">⋮⋮</span>
            <span class="provider-name" style="cursor: pointer; font-weight: 500; font-size: 12px; color: var(--b3-theme-on-surface, #666); flex: 1;" title="点击切换模型">${providerInfo}</span>
            <button class="btn-pin" style="background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px 6px; margin-right: 4px; opacity: 0.6;" title="固定位置">📌</button>
            <button class="btn-settings" style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 6px;" title="设置">⚙️</button>
            <button class="btn-close" style="background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px 6px; margin-left: 4px; color: var(--b3-theme-on-surface, #999);" title="关闭">✕</button>
        `;
        
        // 拖拽功能
        const dragHandle = header.querySelector('.drag-handle') as HTMLElement;
        const setupDrag = (element: HTMLElement) => {
            element.addEventListener('mousedown', (e) => {
                if (e.target === element || e.target === header || (e.target as HTMLElement).classList.contains('provider-name')) {
                    e.preventDefault();
                    this.isDragging = true;
                    this.dragOffsetX = e.clientX - toolbar.offsetLeft;
                    this.dragOffsetY = e.clientY - toolbar.offsetTop;
                    toolbar.style.cursor = 'grabbing';
                }
            });
        };
        setupDrag(header);
        if (dragHandle) setupDrag(dragHandle);
        
        // 置顶固定功能
        const pinBtn = header.querySelector('.btn-pin') as HTMLElement;
        if (pinBtn) {
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isPinned = !this.isPinned;
                pinBtn.style.opacity = this.isPinned ? '1' : '0.6';
                pinBtn.textContent = this.isPinned ? '📍' : '📌';
                pinBtn.title = this.isPinned ? '已固定，点击取消固定' : '固定位置';
            });
        }
        
        // 关闭按钮
        const closeBtn = header.querySelector('.btn-close') as HTMLElement;
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.forceHide();
            });
        }
        
        header.querySelector('.provider-name')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showModelDropdown();
        });
        
        header.querySelector('.btn-settings')?.addEventListener('click', () => {
            this.hideModelDropdown();
            this.options.onOpenSettings();
            this.forceHide();
        });
        
        // 打赏按钮
        header.querySelector('.btn-donate')?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open('https://www.yuque.com/g/duzssy/mop740/fm59mkeo86fx5mu9/collaborator/join?token=XSIhleBNwDXcARkx&source=doc_collaborator', '_blank');
        });
        
        toolbar.appendChild(header);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'toolbar-buttons';
        buttonsContainer.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';
        toolbar.appendChild(buttonsContainer);

        this.refreshToolbar();

        document.body.appendChild(toolbar);
        this.toolbarElement = toolbar;

        // 全局鼠标移动和释放事件（用于拖拽）
        this.mouseMoveHandler = (e: MouseEvent) => {
            if (this.isDragging && this.toolbarElement) {
                e.preventDefault();
                const newLeft = e.clientX - this.dragOffsetX;
                const newTop = e.clientY - this.dragOffsetY;

                // 确保不超出视口边界
                const maxLeft = window.innerWidth - this.toolbarElement.offsetWidth - 10;
                const maxTop = window.innerHeight - this.toolbarElement.offsetHeight - 10;

                this.toolbarElement.style.left = `${Math.max(10, Math.min(newLeft, maxLeft))}px`;
                this.toolbarElement.style.top = `${Math.max(10, Math.min(newTop, maxTop))}px`;
            }
        };

        this.globalMouseUpHandler = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.toolbarElement) {
                    this.toolbarElement.style.cursor = 'default';
                }
            }
        };

        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseup', this.globalMouseUpHandler);

        toolbar.addEventListener('mouseenter', () => {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
            }
        });

        toolbar.addEventListener('mouseleave', () => {
            this.resetHideTimeout();
        });
    }

    private async handleOperation(type: AIOperationType): Promise<void> {
        if (!this.currentSelection) return;

        // 确保 AI 提供商已配置
        if (!aiService.isConfigured()) {
            const currentProvider = settingsService.getCurrentProvider();
            if (currentProvider) {
                aiService.setProvider(currentProvider);
            } else {
                alert('AI 提供商未配置，请先点击设置进行配置');
                this.options.onOpenSettings();
                return;
            }
        }

        const settings = settingsService.getSettings();
        const customBtn = settings.customButtons.find((b: any) => b.id === type);
        const prompt = customBtn?.prompt;

        // 获取完整块内容用于差异显示
        let blockContent = '';
        if (this.currentBlockId) {
            const fullBlockContent = await blockService.getBlockContent(this.currentBlockId);
            blockContent = fullBlockContent?.content || '';
        }

        // 如果无法获取完整块内容，从DOM获取
        if (!blockContent) {
            blockContent = this.getFullBlockContentFromDOM();
        }

        // 最终回退方案：使用选中的文字
        if (!blockContent) {
            blockContent = this.currentSelection;
        }

        // 构建提示词：告诉AI只处理选中部分
        let finalPrompt = '';
        const isPartialSelection = blockContent !== this.currentSelection;
        
        if (isPartialSelection) {
            // 只选中部分内容
            const operationPrompts: Record<string, string> = {
                polish: `请润色以下文本的选中部分，只返回润色后的选中部分文本，不要解释：\n\n选中部分：${this.currentSelection}`,
                translate: `请翻译以下文本的选中部分，只返回翻译后的选中部分文本，不要解释：\n\n选中部分：${this.currentSelection}`,
                summarize: `请总结以下文本，只返回总结内容：\n\n${blockContent}`,
                expand: `请扩写以下文本：\n\n${blockContent}`,
                condense: `请精简以下文本：\n\n${blockContent}`,
                rewrite: `请改写以下文本：\n\n${blockContent}`,
                continue: `请续写以下文本：\n\n${blockContent}`,
            };
            finalPrompt = operationPrompts[type] || prompt || `${type}: ${this.currentSelection}`;
        } else {
            // 选中整个块或无法获取完整内容
            finalPrompt = prompt || '';
        }

        this.options.onOperationStart(
            type, 
            blockContent, 
            this.currentBlockId || undefined,
            this.currentSelection,
            this.currentSelectionStart,
            this.currentSelectionEnd
        );

        try {
            this.setLoading(true);

            // 只传给AI选中的文字
            const messages = aiService.buildOperationMessages(
                this.currentSelection,
                type,
                finalPrompt
            );
            const response = await aiService['adapter']?.chatCompletion(messages);

            if (response) {
                // 传递完整块内容用于差异显示，传递选中文字和索引用于精确替换
                this.options.onOperation(
                    type,
                    blockContent,  // 完整内容 - 显示差异用
                    response.content,  // AI结果
                    this.currentBlockId || undefined,
                    this.currentSelection,  // 选中文字
                    this.currentSelectionStart,  // 选中起始索引
                    this.currentSelectionEnd  // 选中结束索引
                );
            }
        } catch (error) {
            alert('操作失败，请检查AI提供商配置');
        } finally {
            this.setLoading(false);
            this.hide();
        }
    }

    /**
     * 从DOM获取包含选中文字的块的完整内容
     * @returns 块的完整文本内容
     */
    private getFullBlockContentFromDOM(): string {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return '';
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // 向上查找包含选中文字的块元素
        let element: Element | null = container.nodeType === Node.ELEMENT_NODE 
            ? container as Element 
            : container.parentElement;

        while (element) {
            // 检查是否是思源笔记的块
            if (element.classList && element.classList.contains('p')) {
                // 获取块内的所有文本内容
                const blockText = element.textContent || '';
                return blockText;
            }
            element = element.parentElement;
        }

        // 如果找不到p标签，返回选中文字
        return this.currentSelection;
    }

    private setLoading(loading: boolean): void {
        if (!this.toolbarElement) return;
        const buttons = this.toolbarElement.querySelectorAll('.toolbar-btn');
        buttons.forEach(btn => {
            (btn as HTMLButtonElement).disabled = loading;
            if (loading) {
                btn.classList.add('loading');
            } else {
                btn.classList.remove('loading');
            }
        });
    }

    public getCurrentSelection(): string {
        return this.currentSelection;
    }

    public getCurrentBlockId(): string | null {
        return this.currentBlockId;
    }

    destroy(): void {
        this.hide();
        this.hideModelDropdown();

        // 移除所有事件监听器
        if (this.mouseUpHandler) {
            document.removeEventListener('mouseup', this.mouseUpHandler);
            this.mouseUpHandler = null;
        }
        if (this.mouseDownHandler) {
            document.removeEventListener('mousedown', this.mouseDownHandler);
            this.mouseDownHandler = null;
        }
        if (this.scrollHandler) {
            document.removeEventListener('scroll', this.scrollHandler, true);
            this.scrollHandler = null;
        }
        if (this.keyDownHandler) {
            document.removeEventListener('keydown', this.keyDownHandler);
            this.keyDownHandler = null;
        }
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
            this.mouseMoveHandler = null;
        }
        if (this.globalMouseUpHandler) {
            document.removeEventListener('mouseup', this.globalMouseUpHandler);
            this.globalMouseUpHandler = null;
        }

        if (this.toolbarElement) {
            this.toolbarElement.remove();
            this.toolbarElement = null;
        }
    }
}
