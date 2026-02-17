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

        // 按字符流式返回（模拟流式效果）
        for (const char of accumulatedContent) {
            yield char;
            // 小延迟以模拟流式效果
            await new Promise(resolve => setTimeout(resolve, 10));
        }
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
        
        return [
            { role: 'system', content: 'You are a helpful writing assistant. Respond only with the processed text, no explanations.' },
            { role: 'user', content: `${prompt}\n\n${text}` }
        ];
    }
}

export const aiService = new AIService();
