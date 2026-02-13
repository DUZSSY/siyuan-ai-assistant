import type { BlockInfo } from '../types';

export class BlockService {
    /**
     * Get selected text from the editor
     */
    getSelectedText(): string {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return '';
        }
        return selection.toString().trim();
    }

    /**
     * Get selected block IDs
     */
    getSelectedBlockIds(): string[] {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return [];
        }

        const range = selection.getRangeAt(0);
        const blocks: Set<string> = new Set();

        // 方法1: 在选区中查找所有块元素
        const container = range.commonAncestorContainer;
        const searchRoot = container.nodeType === Node.ELEMENT_NODE 
            ? container as Element 
            : container.parentElement;
            
        if (searchRoot) {
            const walker = document.createTreeWalker(
                searchRoot,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (node.hasAttribute('data-node-id')) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    }
                }
            );

            let node;
            while (node = walker.nextNode()) {
                const blockId = (node as Element).getAttribute('data-node-id');
                if (blockId) {
                    blocks.add(blockId);
                }
            }
        }

        // 方法2: 如果方法1没找到，尝试从选区起点和终点向上查找
        if (blocks.size === 0) {
            // 从选区起点查找
            let startNode: Node | null = range.startContainer;
            while (startNode) {
                if (startNode.nodeType === Node.ELEMENT_NODE) {
                    const blockId = (startNode as Element).getAttribute('data-node-id');
                    if (blockId) {
                        blocks.add(blockId);
                        break;
                    }
                }
                startNode = startNode.parentElement;
            }

            // 从选区终点查找
            let endNode: Node | null = range.endContainer;
            while (endNode) {
                if (endNode.nodeType === Node.ELEMENT_NODE) {
                    const blockId = (endNode as Element).getAttribute('data-node-id');
                    if (blockId) {
                        blocks.add(blockId);
                        break;
                    }
                }
                endNode = endNode.parentElement;
            }
        }

        // 方法3: 尝试从protyle容器查找当前激活的块
        if (blocks.size === 0) {
            const protyleElement = document.querySelector('.protyle-wysiwyg--select');
            if (protyleElement) {
                const blockId = protyleElement.getAttribute('data-node-id');
                if (blockId) {
                    blocks.add(blockId);
                }
            }
        }

        // 方法4: 查找包含光标位置的最近块
        if (blocks.size === 0) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let element: Element | null = range.startContainer.nodeType === Node.ELEMENT_NODE 
                    ? range.startContainer as Element 
                    : range.startContainer.parentElement;
                    
                while (element) {
                    // 检查是否是思源块容器
                    if (element.classList && (
                        element.classList.contains('p') ||
                        element.classList.contains('h1') ||
                        element.classList.contains('h2') ||
                        element.classList.contains('h3') ||
                        element.classList.contains('h4') ||
                        element.classList.contains('h5') ||
                        element.classList.contains('h6') ||
                        element.classList.contains('li') ||
                        element.classList.contains('blockquote') ||
                        element.classList.contains('code-block')
                    )) {
                        const blockId = element.getAttribute('data-node-id');
                        if (blockId) {
                            blocks.add(blockId);
                            break;
                        }
                    }
                    element = element.parentElement;
                }
            }
        }

        return Array.from(blocks);
    }

    /**
     * Get current focused block ID (single block)
     */
    getCurrentBlockId(): string | null {
        const blockIds = this.getSelectedBlockIds();
        return blockIds.length > 0 ? blockIds[0] : null;
    }

    /**
     * Get block content by ID
     */
    async getBlockContent(blockId: string): Promise<BlockInfo | null> {
        try {
            const response = await fetch('/api/block/getBlockInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: blockId })
            });

            if (!response.ok) {
                throw new Error(`Failed to get block: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.code !== 0 || !data.data) {
                return null;
            }

            const block = data.data;
            return {
                id: block.id,
                type: block.type,
                subtype: block.subtype,
                content: block.content || '',
                markdown: block.markdown
            };
        } catch (error) {
            console.error('[AI Assistant] Failed to get block content:', error);
            return null;
        }
    }

    /**
     * Update block content
     */
    async updateBlock(blockId: string, content: string): Promise<boolean> {
        try {
            const response = await fetch('/api/block/updateBlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: blockId,
                    data: content,
                    dataType: 'markdown'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update block: ${response.statusText}`);
            }

            const data = await response.json();
            return data.code === 0;
        } catch (error) {
            console.error('[AI Assistant] Failed to update block:', error);
            return false;
        }
    }

    /**
     * Insert new block after a block
     */
    async insertBlockAfter(blockId: string, content: string): Promise<string | null> {
        try {
            const response = await fetch('/api/block/insertBlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    previousID: blockId,
                    data: content,
                    dataType: 'markdown'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to insert block: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.code === 0 && data.data && data.data[0]) {
                return data.data[0].id;
            }
            return null;
        } catch (error) {
            console.error('[AI Assistant] Failed to insert block:', error);
            return null;
        }
    }

    /**
     * Get selection range info
     */
    getSelectionRange(): { text: string; rect: DOMRect | null } {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return { text: '', rect: null };
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        return {
            text: selection.toString().trim(),
            rect
        };
    }

    /**
     * Clear current selection
     */
    clearSelection(): void {
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
        }
    }

    /**
     * 智能替换选中文字 - 使用多种匹配策略确保精确替换
     * @param blockId 块ID
     * @param selectedText 原始选中的文字
     * @param newText AI处理后的新文字
     * @returns 替换后的完整内容
     */
    async replaceSelectedText(blockId: string, selectedText: string, newText: string): Promise<{ success: boolean; content?: string; error?: string }> {
        try {
            // 获取块的完整内容
            const blockInfo = await this.getBlockContent(blockId);
            if (!blockInfo) {
                return { success: false, error: '无法获取块内容' };
            }

            let fullContent = blockInfo.content;
            
            if (!selectedText) {
                return { success: true, content: fullContent };
            }

            // 调试日志
            console.log('[AI Assistant] ====== replaceSelectedText 调试 ======');
            console.log('[AI Assistant] blockId:', blockId);
            console.log('[AI Assistant] fullContent (原文):', JSON.stringify(fullContent));
            console.log('[AI Assistant] selectedText (选中):', JSON.stringify(selectedText));
            console.log('[AI Assistant] newText (AI结果):', JSON.stringify(newText));
            console.log('[AI Assistant] fullContent长度:', fullContent.length);
            console.log('[AI Assistant] selectedText长度:', selectedText.length);
            console.log('[AI Assistant] fullContent是否包含selectedText:', fullContent.includes(selectedText));
            
            // 策略1: 精确匹配（用户选中的文字和原文完全一致）
            let escapedSelected = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let regex = new RegExp(escapedSelected, '');
            if (regex.test(fullContent)) {
                const newContent = fullContent.replace(regex, newText);
                console.log('[AI Assistant] 策略1-精确匹配成功');
                return { success: true, content: newContent };
            }
            console.log('[AI Assistant] 策略1-精确匹配失败');

            // 策略2: Trim后匹配（去除前后空格）
            const trimmedSelected = selectedText.trim();
            console.log('[AI Assistant] trimmedSelected:', JSON.stringify(trimmedSelected));
            console.log('[AI Assistant] trimmed全文是否包含trimmed选中:', fullContent.trim().includes(trimmedSelected));
            escapedSelected = trimmedSelected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escapedSelected, '');
            if (regex.test(fullContent)) {
                // 在trim后的位置替换，保留原文的空格格式
                const beforeMatch = fullContent.substring(0, fullContent.indexOf(trimmedSelected));
                const afterMatch = fullContent.substring(fullContent.indexOf(trimmedSelected) + trimmedSelected.length);
                const newContent = beforeMatch + newText + afterMatch;
                console.log('[AI Assistant] 策略2-Trim匹配成功');
                return { success: true, content: newContent };
            }
            console.log('[AI Assistant] 策略2-Trim匹配失败');

            // 策略3: 模糊匹配 - 在trimmed全文中查找trimmed选中文字的位置
            const trimmedFullContent = fullContent.trim();
            const trimmedIndex = trimmedFullContent.indexOf(trimmedSelected);
            console.log('[AI Assistant] trimmedIndex:', trimmedIndex);
            if (trimmedIndex !== -1) {
                // 计算原文中的对应位置
                const beforeTrim = fullContent.substring(0, fullContent.indexOf(trimmedFullContent.substring(0, trimmedIndex > 0 ? trimmedIndex : 0)));
                const afterTrimStart = fullContent.indexOf(trimmedFullContent) + trimmedIndex + trimmedSelected.length;
                const afterTrim = fullContent.substring(afterTrimStart);
                const newContent = beforeTrim + newText + afterTrim;
                console.log('[AI Assistant] 策略3-模糊匹配成功');
                return { success: true, content: newContent };
            }
            console.log('[AI Assistant] 策略3-模糊匹配失败');

            // 策略4: 如果所有策略都失败，使用DOM选区进行精确替换
            console.log('[AI Assistant] 所有字符串匹配策略失败，尝试DOM选区替换');
            return await this.smartReplaceByDOMSelection(blockId, selectedText, newText);

        } catch (error) {
            console.error('[AI Assistant] 智能替换失败:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * 使用DOM选区进行精确替换（最终策略）
     * @param blockId 块ID
     * @param selectedText 原始选中的文字
     * @param newText AI处理后的新文字
     * @returns 替换结果
     */
    async smartReplaceByDOMSelection(blockId: string, selectedText: string, newText: string): Promise<{ success: boolean; content?: string; error?: string }> {
        try {
            const blockInfo = await this.getBlockContent(blockId);
            if (!blockInfo) {
                return { success: false, error: '无法获取块内容' };
            }

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                // 无选区，回退到完整替换
                console.warn('[AI Assistant] 无DOM选区，回退到完整替换');
                return { success: true, content: newText };
            }

            const range = selection.getRangeAt(0);
            
            // 获取选区的精确位置信息
            const startOffset = range.startOffset;
            const endOffset = range.endOffset;
            
            // 获取选区在原文中的精确位置
            // 这里我们使用一个简单的方法：在block content中找到选中文字的位置
            // 如果找不到，说明选区可能已经变化
            
            // 尝试多种匹配方式
            const matchPatterns = [
                selectedText,
                selectedText.trim(),
                selectedText.replace(/\s+/g, ' ')
            ];

            let bestMatch = '';
            let bestIndex = -1;

            for (const pattern of matchPatterns) {
                const index = blockInfo.content.indexOf(pattern);
                if (index !== -1) {
                    bestMatch = pattern;
                    bestIndex = index;
                    break;
                }
            }

            if (bestIndex !== -1) {
                // 找到了匹配，进行精确替换
                const before = blockInfo.content.substring(0, bestIndex);
                const after = blockInfo.content.substring(bestIndex + bestMatch.length);
                const newContent = before + newText + after;
                console.log('[AI Assistant] DOM选区替换成功');
                return { success: true, content: newContent };
            }

            // 如果还是找不到，使用完整的AI结果替换
            console.warn('[AI Assistant] 无法找到选中文字在原文中的位置，回退到完整替换');
            return { success: true, content: newText };

        } catch (error) {
            console.error('[AI Assistant] DOM选区替换失败:', error);
            return { success: false, error: String(error) };
        }
    }
}

export const blockService = new BlockService();
