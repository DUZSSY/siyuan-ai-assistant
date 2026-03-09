import OpenAI from 'openai';
import { BaseProviderAdapter } from './base';
import type { AIChatMessage, AIStreamEvent, AIResponse } from '../types';
import { settingsService } from '../services/settings';

export class OpenAIAdapter extends BaseProviderAdapter {
    private client: OpenAI;

    constructor(provider: import('../types').AIProvider) {
        super(provider);
        this.client = new OpenAI({
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
            dangerouslyAllowBrowser: true,
            maxRetries: 2,
            timeout: 600000
        });
    }

    private buildThinkingControlPayload(model?: string): Record<string, unknown> {
        const settings = settingsService.getSettings();
        if (settings.enableReasoningOutput !== false) {
            return {};
        }

        // 统一策略：对所有提供商都采用 Ollama 方案（think=false）
        // 某些模型对特殊参数敏感可能会导致报错（如 gpt-oss）
        const requestModel = this.getRequestModel(model);
        if (requestModel?.startsWith('gpt-oss')) {
            return {};
        }

        return {
            think: false
        };
    }

    /**
     * 过滤推理模型的思考过程（如 <think>、<thinking> 标签内容）
     * 支持 DeepSeek-R1、Qwen3、Claude 等推理模型
     */
    private filterReasoningContent(content: string): string {
        if (!content) return '';

        // 移除 <think>...</think> 标签及其内容（DeepSeek-R1 等）
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

        // 移除 <thinking>...</thinking> 标签及其内容（其他推理模型）
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

        // 移除 <reasoning>...</reasoning> 标签及其内容
        content = content.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

        // 清理多余空行
        content = content.replace(/\n{3,}/g, '\n\n');

        return content.trim();
    }

    getMetadata() {
        return {
            id: 'openai-compatible',
            name: this.provider.name,
            supportStreaming: true,
            maxContextToken: 4096
        };
    }

    async chatCompletion(messages: AIChatMessage[], model?: string): Promise<AIResponse> {
        const requestPayload: any = {
            model: this.getRequestModel(model),
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            temperature: this.provider.temperature ?? 0.7,
            max_tokens: this.provider.maxTokens ?? 4096
        };
        Object.assign(requestPayload, this.buildThinkingControlPayload(model));

        const response = await this.client.chat.completions.create(requestPayload);

        const rawContent = response.choices[0]?.message?.content || '';
        const content = this.filterReasoningContent(rawContent);
        const usage = response.usage;

        return {
            content,
            usage: usage ? {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens
            } : undefined
        };
    }

    async streamChatCompletion(
        messages: AIChatMessage[],
        onEvent: (event: AIStreamEvent) => void,
        model?: string
    ): Promise<void> {
        try {
            const requestPayload: any = {
                model: this.getRequestModel(model),
                messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                temperature: this.provider.temperature ?? 0.7,
                max_tokens: this.provider.maxTokens ?? 4096,
                stream: true
            };
            Object.assign(requestPayload, this.buildThinkingControlPayload(model));

            const stream = await this.client.chat.completions.create(requestPayload);
            for await (const chunk of stream) {
                const delta = (chunk.choices[0]?.delta || {}) as Record<string, any>;
                const content = typeof delta.content === 'string' ? delta.content : '';
                
                // 增加更多推理字段支持，适配不同版本的 Ollama 和推理模型
                const reasoning =
                    (typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '') ||
                    (typeof delta.reasoning === 'string' ? delta.reasoning : '') ||
                    (typeof delta.thought === 'string' ? delta.thought : '');

                if (reasoning) {
                    onEvent({ reasoning });
                }

                if (content) {
                    onEvent({ content });
                }
            }

            onEvent({ done: true });
        } catch (error) {
            onEvent({
                error: error instanceof Error ? error : new Error(String(error)),
                done: true
            });
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.chat.completions.create({
                model: this.getRequestModel(),
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}
