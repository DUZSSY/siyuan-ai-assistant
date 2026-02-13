import OpenAI from 'openai';
import { BaseProviderAdapter } from './base';
import type { AIChatMessage, AIStreamEvent, AIResponse } from '../types';

export class OpenAIAdapter extends BaseProviderAdapter {
    private client: OpenAI;

    constructor(provider: import('../types').AIProvider) {
        super(provider);
        this.client = new OpenAI({
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
            dangerouslyAllowBrowser: true,
            maxRetries: 2,
            timeout: 60000
        });
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
        const response = await this.client.chat.completions.create({
            model: this.getRequestModel(model),
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            temperature: this.provider.temperature ?? 0.7,
            max_tokens: this.provider.maxTokens ?? 2048
        });

        const content = response.choices[0]?.message?.content || '';
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
            const stream = await this.client.chat.completions.create({
                model: this.getRequestModel(model),
                messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                temperature: this.provider.temperature ?? 0.7,
                max_tokens: this.provider.maxTokens ?? 2048,
                stream: true
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
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
