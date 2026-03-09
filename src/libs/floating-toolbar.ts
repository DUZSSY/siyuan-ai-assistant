import { aiService } from '../services/ai';
import { settingsService } from '../services/settings';
import { blockService } from '../services/block';
import type { AIOperationType, AIProvider } from '../types';

export interface FloatingToolbarOptions {
    onOperation: (type: AIOperationType, originalText: string, modifiedText: string, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) => void;
    onOperationStart: (type: AIOperationType, originalText: string, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) => void;
    onCustomInput?: (selectedText: string, originalText: string, blockId: string | null, selectionStart: number, selectionEnd: number) => void;
    onOpenSettings: () => void;
    onModelChange?: (type: AIOperationType, originalText: string, blockId?: string, selectedText?: string, selectionStart?: number, selectionEnd?: number) => void;
    i18n?: Record<string, any>;
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
    private pinnedPosition: { top: number; left: number } | null = null; // 固定时的位置
    private lastSelectionPosition: { top: number; left: number; width: number; height: number } | null = null; // 上次选中文本位置

    // 事件处理器引用（用于正确移除监听器）
    private mouseUpHandler: ((e: MouseEvent) => void) | null = null;
    private mouseDownHandler: ((e: MouseEvent) => void) | null = null;
    private scrollHandler: ((e: Event) => void) | null = null;
    private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
    private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    private globalMouseUpHandler: ((e: MouseEvent) => void) | null = null;
    private selectionChangeHandler: (() => void) | null = null;

    // 用于防止鼠标和键盘选区事件重复触发
    private lastSelectionText: string = '';
    private lastSelectionTime: number = 0;
    private selectionDebounceTimeout: number | null = null;
    private isMouseDown: boolean = false;  // 追踪鼠标是否按下
    private isSelectingModel: boolean = false;  // 防止选择模型时浮窗关闭
    private currentOperationType: AIOperationType | null = null;  // 当前操作类型，用于模型切换时重新执行

    private i18n: Record<string, any>;

    constructor(options: FloatingToolbarOptions) {
        this.options = options;
        this.i18n = options.i18n || {};
        this.bindEvents();
    }

    private bindEvents(): void {
        let selectionTimeout: number;

        // 保存处理器引用以便后续移除
        this.mouseUpHandler = (e: MouseEvent) => {
            this.isMouseDown = false;  // 鼠标释放
            clearTimeout(selectionTimeout);
            selectionTimeout = window.setTimeout(() => {
                this.handleSelectionChange(e);
            }, 200);
        };

        this.mouseDownHandler = (e: MouseEvent) => {
            this.isMouseDown = true;  // 鼠标按下
            const target = e.target as Node;
            if (this.modelDropdownElement && !this.modelDropdownElement.contains(target)) {
                this.hideModelDropdown();
            }
            if (this.toolbarElement && !this.toolbarElement.contains(target)) {
                this.hide();
            }
        };

        this.scrollHandler = (e: Event) => {
            // 如果正在选择模型，不关闭浮窗
            if (this.isSelectingModel) {
                return;
            }
            // 如果滚动事件来自下拉列表内部，则不关闭浮窗
            if (this.modelDropdownElement && this.modelDropdownElement.contains(e.target as Node)) {
                return;
            }
            this.hide();
            this.hideModelDropdown();
        };

        this.keyDownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hideModelDropdown();
                this.hide();
            }
        };

        // 监听选区变化（支持键盘快捷键如 Ctrl+A）
        // 只在鼠标未按下时响应（避免与 mouseup 重复触发）
        this.selectionChangeHandler = () => {
            // 如果鼠标正在按下状态，说明是鼠标拖拽选中文本，不处理
            // mouseup 事件会处理这种情况
            if (this.isMouseDown) {
                return;
            }

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                return;
            }

            const text = selection.toString().trim();
            if (text.length < 1) {
                return;
            }

            // 检查是否在思源编辑器内
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const element = container.nodeType === Node.ELEMENT_NODE
                ? container as Element
                : container.parentElement;

            if (!element || !element.closest('.protyle-wysiwyg')) {
                return;
            }

            // 防抖处理：避免短时间内重复触发
            const now = Date.now();
            const timeSinceLastSelection = now - this.lastSelectionTime;

            // 如果选中的文字和上次相同，且时间间隔很短，则忽略
            if (text === this.lastSelectionText && timeSinceLastSelection < 300) {
                return;
            }

            // 清除之前的防抖定时器
            if (this.selectionDebounceTimeout) {
                clearTimeout(this.selectionDebounceTimeout);
            }

            // 设置新的防抖定时器
            this.selectionDebounceTimeout = window.setTimeout(() => {
                this.lastSelectionText = text;
                this.lastSelectionTime = Date.now();
                // 对于键盘选区，传递 null 作为事件参数
                this.handleSelectionChange(null as any);
            }, 100);
        };

        document.addEventListener('mouseup', this.mouseUpHandler);
        document.addEventListener('mousedown', this.mouseDownHandler);
        document.addEventListener('scroll', this.scrollHandler, true);
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('selectionchange', this.selectionChangeHandler);
    }

    private handleSelectionChange(event: MouseEvent | null): void {
        const settings = settingsService.getSettings();

        if (!settings.showFloatingToolbar) {
            return;
        }

        // 如果有事件对象，检查是否在思源编辑器内
        if (event) {
            const target = event.target as HTMLElement;
            if (!target.closest('.protyle-wysiwyg')) {
                return;
            }
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

    private show(event: MouseEvent | null, selectedText: string): void {
        if (!this.toolbarElement) {
            this.createToolbar();
        }

        if (!this.toolbarElement) return;

        // 如果已经固定，显示在固定位置
        if (this.isPinned && this.pinnedPosition) {
            this.toolbarElement.style.top = `${this.pinnedPosition.top}px`;
            this.toolbarElement.style.left = `${this.pinnedPosition.left}px`;
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
        
        // 保存选中文本位置
        this.lastSelectionPosition = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };

        const toolbarHeight = this.toolbarElement.offsetHeight || 50;
        const toolbarWidth = this.toolbarElement.offsetWidth || 300;
        
        // 增加偏移距离，确保不遮挡选中文本
        const offsetDistance = 80; // 与选中文本的间距（增大以确保完全可见）

        // 计算位置：优先显示在选中文本上方，如果不合适则显示在下方
        let top = rect.top - toolbarHeight - offsetDistance;
        let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);

        // 确保不超出视口边界
        if (top < offsetDistance) {
            top = rect.bottom + offsetDistance; // 显示在选中文本下方
        }
        
        // 水平居中，但确保不超出边界
        if (left < offsetDistance) {
            left = offsetDistance;
        }
        if (left + toolbarWidth > window.innerWidth - offsetDistance) {
            left = window.innerWidth - toolbarWidth - offsetDistance;
        }

        // 如果下方也不够空间，尝试显示在右侧或左侧
        if (top + toolbarHeight > window.innerHeight - offsetDistance) {
            // 尝试右侧
            if (rect.right + toolbarWidth + offsetDistance < window.innerWidth - offsetDistance) {
                top = rect.top;
                left = rect.right + offsetDistance;
            } 
            // 尝试左侧
            else if (rect.left - toolbarWidth - offsetDistance > offsetDistance) {
                top = rect.top;
                left = rect.left - toolbarWidth - offsetDistance;
            }
            // 实在不行就放在视口底部
            else {
                top = window.innerHeight - toolbarHeight - offsetDistance;
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
     * 强制隐藏（但保留固定状态）- 用于关闭按钮或操作完成后
     * 注意：不再自动取消固定状态，固定状态通过点击按钮手动切换
     */
    public forceHide(): void {
        if (!this.toolbarElement || !this.isVisible) return;

        this.toolbarElement.classList.remove('show');
        this.toolbarElement.style.display = 'none';
        this.isVisible = false;
        // 不再自动取消固定状态，保留 pinnedPosition
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
                : `⚠️ ${this.i18n.messages?.noProvider || '未配置'}`;
        }

        const buttonsContainer = this.toolbarElement.querySelector('.toolbar-buttons');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = '';

            // 1. 渲染7个默认操作按钮
            const defaultActions = [
                { type: 'polish', label: this.i18n.operations?.polish || '润色', icon: '✨', enabled: buttons.polish },
                { type: 'translate', label: this.i18n.operations?.translate || '翻译', icon: '🌐', enabled: buttons.translate },
                { type: 'summarize', label: this.i18n.operations?.summarize || '总结', icon: '📝', enabled: buttons.summarize },
                { type: 'expand', label: this.i18n.operations?.expand || '扩写', icon: '📖', enabled: buttons.expand },
                { type: 'condense', label: this.i18n.operations?.condense || '精简', icon: '📄', enabled: buttons.condense },
                { type: 'rewrite', label: this.i18n.operations?.rewrite || '改写', icon: '🔄', enabled: buttons.rewrite },
                { type: 'continue', label: this.i18n.operations?.continue || '续写', icon: '➡️', enabled: buttons.continue }
            ];

            defaultActions.forEach((action: { type: string; label: string; icon: string; enabled: boolean }) => {
                if (action.enabled) {
                    const btn = document.createElement('button');
                    btn.className = 'toolbar-btn';
                    btn.innerHTML = `<span class="icon">${action.icon}</span><span>${action.label}</span>`;
                    btn.addEventListener('click', () => this.handleOperation(action.type as AIOperationType));
                    buttonsContainer.appendChild(btn);
                }
            });

            // 2. 渲染自定义按钮
            settings.customButtons.forEach((btn: { enabled: boolean; icon: string; name: string }, index: number) => {
                if (btn.enabled) {
                    const btnKey = `custom${index + 1}` as keyof typeof buttons;
                    if (buttons[btnKey]) {
                        const button = document.createElement('button');
                        button.className = 'toolbar-btn';
                        button.innerHTML = `<span class="icon">${btn.icon}</span><span>${btn.name}</span>`;
                        button.addEventListener('click', () => this.handleOperation(btnKey as AIOperationType));
                        buttonsContainer.appendChild(button);
                    }
                }
            });

            // 3. 渲染 customInput 按钮（带分隔符），始终在最后
            if (buttons.customInput !== false) {
                // 添加分隔符
                const separator = document.createElement('span');
                separator.className = 'toolbar-separator';
                separator.textContent = '|';
                separator.style.cssText = 'margin: 0 4px; color: var(--b3-theme-on-surface, #999); font-weight: 300;';
                buttonsContainer.appendChild(separator);

                // 添加 customInput 按钮
                const customInputBtn = document.createElement('button');
                customInputBtn.className = 'toolbar-btn';
                const customInputLabel = this.i18n.operations?.customInput || '对话';
                customInputBtn.innerHTML = `<span class="icon">💬</span><span>${customInputLabel}</span>`;
                customInputBtn.addEventListener('click', () => this.handleOperation('customInput'));
                buttonsContainer.appendChild(customInputBtn);
            }
        }
    }

    /**
     * 更新工具栏显示（当默认提供商变更时调用）
     * 即使工具栏隐藏也会更新内部状态
     */
    public updateToolbar(): void {
        this.refreshToolbar();
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
      max-height: 300px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: var(--b3-theme-on-surface, #ccc) transparent;
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

                // 防止选择模型时浮窗关闭
                this.isSelectingModel = true;

                // 检查是否需要重新执行上一操作
                const shouldReexecute = this.currentOperationType && this.currentSelection;

                await settingsService.setCurrentProvider(provider.id);
                aiService.setProvider(provider);

                this.refreshToolbar();
                this.hideModelDropdown();

                // 操作完成后重置标志
                this.isSelectingModel = false;

                // 如果有之前的操作，触发重新执行回调
                if (shouldReexecute && this.options.onModelChange) {
                    // 获取完整块内容
                    let blockContent = '';
                    if (this.currentBlockId) {
                        const fullBlockContent = await blockService.getBlockContent(this.currentBlockId);
                        blockContent = fullBlockContent?.markdown || fullBlockContent?.content || '';
                    }
                    if (!blockContent) {
                        blockContent = this.getFullBlockContentFromDOM();
                    }
                    if (!blockContent) {
                        blockContent = this.currentSelection;
                    }

                    this.options.onModelChange(
                        this.currentOperationType!,
                        blockContent,
                        this.currentBlockId || undefined,
                        this.currentSelection,
                        this.currentSelectionStart,
                        this.currentSelectionEnd
                    );
                }
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
        
        // 阻止下拉列表的滚动事件冒泡，防止触发页面滚动导致浮窗关闭
        dropdown.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });
        
        dropdown.addEventListener('scroll', (e) => {
            e.stopPropagation();
        }, { passive: true });
    }

    private showModelDropdown(): void {
        if (!this.toolbarElement) return;
        
        this.hideModelDropdown();
        this.createModelDropdown();
        
        if (!this.modelDropdownElement) return;

        const providerBtn = this.toolbarElement.querySelector('.provider-name');
        if (!providerBtn) return;

        const rect = providerBtn.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const dropdownHeight = Math.min(this.modelDropdownElement.scrollHeight, 300); // 增加 max-height 到 300
        
        // 检查下方空间是否足够 (rect.bottom + dropdownHeight + margin)
        if (rect.bottom + dropdownHeight + 10 > viewportHeight) {
            // 空间不足，向上弹出
            this.modelDropdownElement.style.top = 'auto';
            this.modelDropdownElement.style.bottom = `${viewportHeight - rect.top + 5}px`;
        } else {
            // 空间足够，向下弹出
            this.modelDropdownElement.style.top = `${rect.bottom + 5}px`;
            this.modelDropdownElement.style.bottom = 'auto';
        }
        
        // 增加左右边界检测
        const finalLeft = Math.max(10, Math.min(rect.left, window.innerWidth - 210));
        this.modelDropdownElement.style.left = `${finalLeft}px`;
        this.modelDropdownElement.style.maxHeight = `${Math.min(300, viewportHeight - 100)}px`;
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
            : `⚠️ ${this.i18n.messages?.noProvider || '未配置'}`;
            
        const header = document.createElement('div');
        header.className = 'toolbar-header';
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--b3-border-color, #e0e0e0); cursor: move;';
        header.innerHTML = `
            <span class="drag-handle" style="cursor: move; padding: 2px 4px; margin-right: 4px; color: var(--b3-theme-on-surface, #999);">⋮⋮</span>
            <span class="provider-name" style="cursor: pointer; font-weight: 500; font-size: 12px; color: var(--b3-theme-on-surface, #666); flex: 1;" title="${this.i18n.toolbar?.switchModel || '点击切换模型'}">${providerInfo}</span>
            <button class="btn-pin" style="background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px 6px; margin-right: 4px; opacity: 0.6;" title="${this.i18n.toolbar?.pin || '固定位置'}">📌</button>
            <button class="btn-settings" style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 6px;" title="${this.i18n.settings || '设置'}">⚙️</button>
            <button class="btn-close" style="background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px 6px; margin-left: 4px; color: var(--b3-theme-on-surface, #999);" title="${this.i18n.close || '关闭'}">✕</button>
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
                
                if (this.isPinned && this.toolbarElement) {
                    // 保存当前位置
                    const currentTop = parseInt(this.toolbarElement.style.top || '0');
                    const currentLeft = parseInt(this.toolbarElement.style.left || '0');
                    this.pinnedPosition = { top: currentTop, left: currentLeft };
                    pinBtn.style.opacity = '1';
                    pinBtn.textContent = '📍';
                    pinBtn.title = this.i18n.toolbar?.pinned || '已固定，点击取消固定';
                } else {
                    // 取消固定
                    this.pinnedPosition = null;
                    pinBtn.style.opacity = '0.6';
                    pinBtn.textContent = '📌';
                    pinBtn.title = this.i18n.toolbar?.pin || '固定位置';
                }
            });
        }
        
        // 关闭按钮 - 关闭并取消固定
        const closeBtn = header.querySelector('.btn-close') as HTMLElement;
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isPinned = false;  // 关闭时取消固定
                this.pinnedPosition = null;
                this.forceHide();
                // 恢复pin按钮状态
                const pinBtn = header.querySelector('.btn-pin') as HTMLElement;
                if (pinBtn) {
                    pinBtn.style.opacity = '0.6';
                    pinBtn.textContent = '📌';
                    pinBtn.title = this.i18n.toolbar?.pin || '固定位置';
                }
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
                    // 如果已置顶，拖拽结束后更新固定位置
                    if (this.isPinned) {
                        this.pinnedPosition = {
                            top: parseInt(this.toolbarElement.style.top || '0'),
                            left: parseInt(this.toolbarElement.style.left || '0')
                        };
                    }
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

        // 记录当前操作类型，用于模型切换时重新执行
        this.currentOperationType = type;

        // 确保 AI 提供商已配置
        if (!aiService.isConfigured()) {
            const currentProvider = settingsService.getCurrentProvider();
            if (currentProvider) {
                aiService.setProvider(currentProvider);
            } else {
                alert(this.i18n.messages?.noProvider || 'AI 提供商未配置，请先点击设置进行配置');
                this.options.onOpenSettings();
                return;
            }
        }

        // 获取完整块内容用于差异显示和精确替换
        let blockContent = '';
        if (this.currentBlockId) {
            const fullBlockContent = await blockService.getBlockContent(this.currentBlockId);
            // 思源笔记 API 返回的内容通常在 markdown 字段中
            blockContent = fullBlockContent?.markdown || fullBlockContent?.content || '';
        }

        // 如果无法获取完整块内容，从DOM获取
        if (!blockContent) {
            blockContent = this.getFullBlockContentFromDOM();
        }

        // 最终回退方案：使用选中的文字
        if (!blockContent) {
            blockContent = this.currentSelection;
        }

        // 处理自定义输入类型的特殊逻辑
        if (type === 'customInput') {
            if (this.options.onCustomInput) {
                this.options.onCustomInput(
                    this.currentSelection,
                    blockContent,
                    this.currentBlockId,
                    this.currentSelectionStart,
                    this.currentSelectionEnd
                );
            }
            this.hide();
            return;
        }

        await Promise.resolve(this.options.onOperationStart(
            type, 
            blockContent, 
            this.currentBlockId || undefined,
            this.currentSelection,
            this.currentSelectionStart,
            this.currentSelectionEnd
        ));
        this.hide();
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

    /**
     * 恢复显示浮动工具栏（用于 diff 窗口关闭后）
     * 如果有固定位置则显示在固定位置，否则显示在最后选中的位置
     */
    public restoreVisibility(): void {
        if (!this.toolbarElement) {
            this.createToolbar();
        }
        
        if (!this.toolbarElement) return;

        // 如果已固定，显示在固定位置
        if (this.isPinned && this.pinnedPosition) {
            this.toolbarElement.style.top = `${this.pinnedPosition.top}px`;
            this.toolbarElement.style.left = `${this.pinnedPosition.left}px`;
            this.toolbarElement.style.display = 'block';
            this.toolbarElement.classList.add('show');
            this.isVisible = true;
            return;
        }

        // 如果有保存的选中文本位置，恢复到该位置附近
        if (this.lastSelectionPosition) {
            const toolbarHeight = this.toolbarElement.offsetHeight || 50;
            const toolbarWidth = this.toolbarElement.offsetWidth || 300;
            const offsetDistance = 80;
            
            const pos = this.lastSelectionPosition;
            
            // 计算位置：优先在上方
            let top = pos.top - toolbarHeight - offsetDistance;
            let left = pos.left + (pos.width / 2) - (toolbarWidth / 2);

            // 确保不超出边界
            if (top < offsetDistance) {
                top = pos.top + pos.height + offsetDistance;
            }
            if (left < offsetDistance) {
                left = offsetDistance;
            }
            if (left + toolbarWidth > window.innerWidth - offsetDistance) {
                left = window.innerWidth - toolbarWidth - offsetDistance;
            }

            this.toolbarElement.style.top = `${top}px`;
            this.toolbarElement.style.left = `${left}px`;
            this.toolbarElement.style.display = 'block';
            this.toolbarElement.classList.add('show');
            this.isVisible = true;
            this.resetHideTimeout();
        }
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
        if (this.selectionChangeHandler) {
            document.removeEventListener('selectionchange', this.selectionChangeHandler);
            this.selectionChangeHandler = null;
        }

        // 清理防抖定时器
        if (this.selectionDebounceTimeout) {
            clearTimeout(this.selectionDebounceTimeout);
            this.selectionDebounceTimeout = null;
        }

        if (this.toolbarElement) {
            this.toolbarElement.remove();
            this.toolbarElement = null;
        }
    }
}
