import type { AIOperationType } from '../types';
import { settingsService } from '../services/settings';

export interface ContextMenuOptions {
    onOperation: (type: AIOperationType, blockId: string) => void;
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

    /**
     * Inject AI menu into block icon menu
     */
    injectIntoBlockMenu(event: CustomEvent): void {
        // 使用 settingsService 获取设置，而不是 window.siyuan.config
        const settings = settingsService.getSettings();
        if (!settings.showContextMenu) {
            return;
        }

        const detail = event.detail;
        if (!detail?.menu?.element) return;

        const menu = detail.menu;
        const blockId = detail.blockId;

        if (!blockId) return;

        // Add separator
        menu.addItem({
            type: 'separator'
        });

        // Add AI submenu
        const aiSubmenu = [
            {
                label: `✨ ${this.i18n.operations?.polish || '润色'}`,
                click: () => this.options.onOperation('polish', blockId)
            },
            {
                label: `🌐 ${this.i18n.operations?.translate || '翻译'}`,
                click: () => this.options.onOperation('translate', blockId)
            },
            {
                label: `📝 ${this.i18n.operations?.summarize || '总结'}`,
                click: () => this.options.onOperation('summarize', blockId)
            },
            {
                label: `📖 ${this.i18n.operations?.expand || '扩写'}`,
                click: () => this.options.onOperation('expand', blockId)
            },
            {
                type: 'separator'
            },
            {
                label: `⚙️ ${this.i18n.settings?.title || 'AI助手设置'}`,
                click: () => this.options.onOpenSettings()
            }
        ];

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
