import { Dialog } from 'siyuan';

export function showDialog(options: {
    title: string;
    content: HTMLElement | string;
    width?: string;
    height?: string;
    destroyCallback?: () => void;
}): Dialog {
    const { title, content, width = '600px', height = 'auto', destroyCallback } = options;

    // 创建内容容器
    let contentHTML: string;
    
    if (typeof content === 'string') {
        contentHTML = content;
    } else {
        // 对于HTMLElement，我们需要在Dialog创建后手动挂载
        // 先使用占位符，然后替换
        contentHTML = '<div class="ai-dialog-content-placeholder"></div>';
    }

    const dialog = new Dialog({
        title,
        content: contentHTML,
        width,
        height,
        destroyCallback
    });

    // 如果是HTMLElement，在Dialog创建后挂载
    if (typeof content !== 'string') {
        // 尝试多种可能的选择器
        const possibleSelectors = [
            '.b3-dialog__body',
            '.b3-dialog__content', 
            '.b3-dialog .b3-dialog__body',
            '.b3-dialog .b3-dialog__content'
        ];
        
        let dialogContent: Element | null = null;
        
        for (const selector of possibleSelectors) {
            dialogContent = dialog.element.querySelector(selector);
            if (dialogContent) break;
        }
        
        // 如果找不到特定选择器，使用Dialog的element本身
        if (!dialogContent) {
            dialogContent = dialog.element;
        }
        
        // 查找占位符并替换
        const placeholder = dialogContent.querySelector('.ai-dialog-content-placeholder');
        if (placeholder) {
            placeholder.replaceWith(content);
        } else {
            // 如果没有占位符，直接追加到内容区域
            dialogContent.appendChild(content);
        }
    }

    return dialog;
}

export function showConfirmDialog(options: {
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}): void {
    const { title, content, confirmText = '确定', cancelText = '取消', onConfirm, onCancel } = options;

    const dialog = new Dialog({
        title,
        content: `
            <div class="b3-dialog__content">
                <div style="padding: 20px;">${content}</div>
            </div>
            <div class="b3-dialog__action">
                <button class="b3-button b3-button--cancel">${cancelText}</button>
                <button class="b3-button b3-button--text">${confirmText}</button>
            </div>
        `,
        width: '400px'
    });

    const cancelBtn = dialog.element.querySelector('.b3-button--cancel');
    const confirmBtn = dialog.element.querySelector('.b3-button--text');

    cancelBtn?.addEventListener('click', () => {
        dialog.destroy();
        onCancel?.();
    });

    confirmBtn?.addEventListener('click', () => {
        dialog.destroy();
        onConfirm();
    });
}
