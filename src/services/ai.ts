import { AdapterFactory } from '../adapters';
import type {
    AIProvider,
    AIChatMessage,
    AIOperationType,
    AIResponse,
    IAIProviderAdapter
} from '../types';
import { DEFAULT_PROMPTS } from '../types';

export class AIService {
    static readonly DEFAULT_PROMPTS = DEFAULT_PROMPTS;
    
    private adapter: IAIProviderAdapter | null = null;
    private provider: AIProvider | null = null;

    setProvider(provider: AIProvider): void {
        this.provider = provider;
        this.adapter = AdapterFactory.createAdapter(provider);
    }

    getCurrentProvider(): AIProvider | null {
        return this.provider;
    }

    isConfigured(): boolean {
        return this.adapter !== null && this.provider !== null;
    }

    async *streamChat(messages: AIChatMessage[]): AsyncGenerator<string> {
        if (!this.adapter) {
            throw new Error('AI provider not configured');
        }

        let accumulatedContent = '';
        
        await this.adapter.streamChatCompletion(
            messages,
            (event) => {
                if (event.content) {
                    accumulatedContent += event.content;
                }
                if (event.error) {
                    throw event.error;
                }
            }
        );

        // 直接返回完整内容，无人工延迟
        yield accumulatedContent;
    }

    async processText(text: string, operation: AIOperationType, customPrompt?: string): Promise<AIResponse> {
        if (!this.adapter) {
            throw new Error('AI provider not configured');
        }

        if (operation === 'chat') {
            throw new Error('Use streamChat for chat operation');
        }

        // 使用自定义 prompt 或默认 prompt（允许空字符串，用于自定义按钮）
        const prompt = customPrompt !== undefined ? customPrompt : DEFAULT_PROMPTS[operation];
        
        // 仅当 prompt 为 undefined 时才报错（表示未知操作类型）
        if (prompt === undefined) {
            throw new Error(`Unknown operation: ${operation}`);
        }

        const messages: AIChatMessage[] = [
            { role: 'system', content: 'You are a helpful writing assistant.' },
            { role: 'user', content: `${prompt}\n\n${text}` }
        ];

        return this.adapter.chatCompletion(messages);
    }

    async testConnection(): Promise<boolean> {
        if (!this.adapter) {
            return false;
        }
        return this.adapter.testConnection();
    }

    buildOperationMessages(text: string, operation: AIOperationType, customPrompt?: string): AIChatMessage[] {
        // 当 customPrompt 为 undefined 时使用默认 prompt；空字符串是有效值（允许用户设置空 prompt）
        const prompt = customPrompt !== undefined ? customPrompt : DEFAULT_PROMPTS[operation];
        
        const systemPrompt = `你是专业写作助手。请严格遵守：
1. 【绝对禁止】输出"好的"、"以下是"、"修改结果"等任何引导语
2. 【绝对禁止】解释修改理由或添加总结
3. 【必须直接】给出可替换原文的纯文本结果
4. 【格式保持】保持原文的段落、换行、标点格式

输出必须是纯文本，用户应可直接复制使用，无需二次处理。`;
        
        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${prompt}\n\n${text}` }
        ];
    }
}

export const aiService = new AIService();
