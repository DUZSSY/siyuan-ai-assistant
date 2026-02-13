import type { AIOperationType } from '../types';

export interface ContextMenuOptions {
    onOperation: (type: AIOperationType, blockId: string) => void;
    onOpenSettings: () => void;
}

export class ContextMenuManager {
    private options: ContextMenuOptions;
    private menuElement: HTMLElement | null = null;

    constructor(options: ContextMenuOptions) {
        this.options = options;
    }

    /**
     * Inject AI menu into block icon menu
     */
    injectIntoBlockMenu(event: CustomEvent): void {
        const settings = window.siyuan?.config?.pluginSettings?.['siyuan-ai-assistant'];
        if (settings && !settings.showContextMenu) {
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
                label: '✨ 润色文本',
                click: () => this.options.onOperation('polish', blockId)
            },
            {
                label: '🌐 翻译文本',
                click: () => this.options.onOperation('translate', blockId)
            },
            {
                label: '📝 总结内容',
                click: () => this.options.onOperation('summarize', blockId)
            },
            {
                label: '📖 扩写内容',
                click: () => this.options.onOperation('expand', blockId)
            },
            {
                type: 'separator'
            },
            {
                label: '⚙️ AI助手设置',
                click: () => this.options.onOpenSettings()
            }
        ];

        menu.addItem({
            label: '🤖 AI助手',
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
            { label: '✨ 润色', action: callbacks.onPolish },
            { label: '🌐 翻译', action: callbacks.onTranslate },
            { label: '📝 总结', action: callbacks.onSummarize },
            { label: '📖 扩写', action: callbacks.onExpand }
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
}
