import type { AIOperationType } from '../types';
import { settingsService } from '../services/settings';

export interface ContextMenuOptions {
    onOperation: (type: AIOperationType, blockId: string, blockContent: string) => void;
    onCustomInput?: (blockId: string, blockContent: string) => void;
    onOpenSettings: () => void;
    i18n?: Record<string, any>;
}

export class ContextMenuManager {
    private options: ContextMenuOptions;
    private menuElement: HTMLElement | null = null;
    private i18n: Record<string, any>;

    constructor(options: ContextMenuOptions) {
        this.options = options;
        this.i18n = options.i18n || {};
    }

    setI18n(i18n: Record<string, any>): void {
        this.i18n = i18n || {};
    }

    /**
     * Inject AI menu into block icon menu
     */
    injectIntoBlockMenu(event: CustomEvent): void {
        // 使用 settingsService 获取设置
        const settings = settingsService.getSettings();
        
        if (!settings.showContextMenu) {
            return;
        }

        const detail = event.detail;
        
        // 兼容新旧版本：menu 对象可能有不同的结构
        const menu = detail?.menu;
        
        if (!menu || typeof menu.addItem !== 'function') {
            return;
        }

        // 从 blockElements 数组中获取块 ID 和内容（新版本思源笔记）
        // 或者从 blockId 属性获取（旧版本兼容）
        let blockId: string | null = null;
        let blockContent: string = '';

        if (detail.blockElements && detail.blockElements.length > 0) {
            // 新版本的思源笔记使用 blockElements 数组
            const blockElement = detail.blockElements[0];
            blockId = blockElement.getAttribute('data-node-id');
            // 直接从 DOM 获取块内容
            const editElement = blockElement.querySelector('[contenteditable="true"]');
            blockContent = editElement ? editElement.textContent || '' : blockElement.textContent || '';
        } else if (detail.blockId) {
            // 旧版本兼容
            blockId = detail.blockId;
        } else if (detail.data?.id) {
            // 其他可能的结构
            blockId = detail.data.id;
        }

        if (!blockId) {
            return;
        }

        // Add separator
        menu.addItem({
            type: 'separator'
        });

        // 根据工具栏按钮设置动态生成 AI 子菜单
        const aiSubmenu: any[] = [];
        
        // 7 个默认操作
        const defaultActions = [
            { type: 'polish', icon: '✨', label: this.i18n.operations?.polish || '润色' },
            { type: 'translate', icon: '🌐', label: this.i18n.operations?.translate || '翻译' },
            { type: 'summarize', icon: '📝', label: this.i18n.operations?.summarize || '总结' },
            { type: 'expand', icon: '📖', label: this.i18n.operations?.expand || '扩写' },
            { type: 'condense', icon: '📄', label: this.i18n.operations?.condense || '精简' },
            { type: 'rewrite', icon: '🔄', label: this.i18n.operations?.rewrite || '改写' },
            { type: 'continue', icon: '➡️', label: this.i18n.operations?.continue || '续写' }
        ];
        
        defaultActions.forEach(action => {
            if (settings.toolbarButtons[action.type as keyof typeof settings.toolbarButtons]) {
                aiSubmenu.push({
                    label: `${action.icon} ${action.label}`,
                    click: () => this.options.onOperation(action.type as AIOperationType, blockId!, blockContent)
                });
            }
        });
        
        // 3 个自定义按钮
        settings.customButtons.forEach((btn: any, index: number) => {
            if (btn.enabled) {
                const customKey = `custom${index + 1}` as keyof typeof settings.toolbarButtons;
                if (settings.toolbarButtons[customKey]) {
                    aiSubmenu.push({
                        label: `${btn.icon} ${btn.name}`,
                        click: () => this.options.onOperation(customKey as AIOperationType, blockId!, blockContent)
                    });
                }
            }
        });
        
        // 如果没有启用的按钮，至少显示设置
        if (aiSubmenu.length === 0 && settings.toolbarButtons.customInput === false) {
            aiSubmenu.push({
                label: `⚠️ ${this.i18n.messages?.noButtonsEnabled || '未启用任何按钮'}`,
                click: () => {}
            });
        }
        
        // 添加分隔线 + 自定义输入按钮（对话）+ 分隔线
        if (settings.toolbarButtons.customInput !== false && this.options.onCustomInput) {
            aiSubmenu.push({
                type: 'separator'
            });
            aiSubmenu.push({
                label: `💬 ${this.i18n.operations?.customInput || '对话'}`,
                click: () => this.options.onCustomInput!(blockId!, blockContent)
            });
            aiSubmenu.push({
                type: 'separator'
            });
        }
        
        // 添加设置选项
        aiSubmenu.push({
            label: `⚙️ ${this.i18n.settings?.title || '设置'}`,
            click: () => this.options.onOpenSettings()
        });

        menu.addItem({
            label: `🤖 ${this.i18n.title || 'AI助手'}`,
            submenu: aiSubmenu
        });
    }

    /**
     * Create a standalone context menu for selected text
     */
    showForSelection(event: MouseEvent, selectedText: string, callbacks: {
        onPolish: () => void;
        onTranslate: () => void;
        onSummarize: () => void;
        onExpand: () => void;
    }): void {
        this.hide();

        const menu = document.createElement('div');
        menu.className = 'ai-context-menu';
        menu.style.cssText = `
            position: fixed;
            z-index: 9999;
            background: var(--b3-theme-background);
            border: 1px solid var(--b3-border-color);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 4px 0;
            min-width: 160px;
            font-family: var(--b3-font-family);
            font-size: 14px;
        `;

        const items = [
            { label: `✨ ${this.i18n.operations?.polish || '润色'}`, action: callbacks.onPolish },
            { label: `🌐 ${this.i18n.operations?.translate || '翻译'}`, action: callbacks.onTranslate },
            { label: `📝 ${this.i18n.operations?.summarize || '总结'}`, action: callbacks.onSummarize },
            { label: `📖 ${this.i18n.operations?.expand || '扩写'}`, action: callbacks.onExpand }
        ];

        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'ai-context-menu-item';
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                transition: background 0.15s;
            `;
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'var(--b3-theme-hover)';
            });
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            menuItem.addEventListener('click', () => {
                item.action();
                this.hide();
            });
            menu.appendChild(menuItem);
        });

        // Position menu
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        // Boundary checks
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${event.clientX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${event.clientY - rect.height}px`;
        }

        document.body.appendChild(menu);
        this.menuElement = menu;

        // Close on outside click
        const closeHandler = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                this.hide();
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        setTimeout(() => {
            document.addEventListener('mousedown', closeHandler);
        }, 0);
    }

    hide(): void {
        if (this.menuElement) {
            this.menuElement.remove();
            this.menuElement = null;
        }
    }

    /**
     * Destroy the context menu manager
     */
    destroy(): void {
        this.hide();
    }
}
