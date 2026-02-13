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
        const response = await this.client.chat.completions.create({
            model: this.getRequestModel(model),
            messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
            temperature: this.provider.temperature ?? 0.7,
            max_tokens: this.provider.maxTokens ?? 2048
        });

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
            const stream = await this.client.chat.completions.create({
                model: this.getRequestModel(model),
                messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
                temperature: this.provider.temperature ?? 0.7,
                max_tokens: this.provider.maxTokens ?? 2048,
                stream: true
            });

            // 用于累积流式内容以检测推理标签
            let buffer = '';
            let isInReasoningBlock = false;

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (!content) continue;

                buffer += content;

                // 检测推理块开始
                if (!isInReasoningBlock) {
                    if (buffer.includes('<think>') || buffer.includes('<thinking>') || buffer.includes('<reasoning>')) {
                        isInReasoningBlock = true;
                        // 只发送推理块之前的内容
                        const thinkIndex = Math.min(
                            buffer.indexOf('<think>') !== -1 ? buffer.indexOf('<think>') : Infinity,
                            buffer.indexOf('<thinking>') !== -1 ? buffer.indexOf('<thinking>') : Infinity,
                            buffer.indexOf('<reasoning>') !== -1 ? buffer.indexOf('<reasoning>') : Infinity
                        );
                        if (thinkIndex > 0) {
                            onEvent({ content: buffer.substring(0, thinkIndex) });
                        }
                        continue;
                    }
                }

                // 检测推理块结束
                if (isInReasoningBlock) {
                    if (buffer.includes('</think>') || buffer.includes('</thinking>') || buffer.includes('</reasoning>')) {
                        isInReasoningBlock = false;
                        // 提取结束标签后的内容
                        const endMatch = buffer.match(/<\/(think|thinking|reasoning)>([\s\S]*)/i);
                        if (endMatch && endMatch[2]) {
                            buffer = endMatch[2];
                        } else {
                            buffer = '';
                        }
                        continue;
                    }
                    // 仍在推理块中，跳过
                    continue;
                }

                // 正常内容，直接发送
                if (!isInReasoningBlock) {
                    onEvent({ content });
                    // 保持缓冲区不会无限增长
                    if (buffer.length > 1000) {
                        buffer = buffer.slice(-500);
                    }
                }
            }

            // 流结束时，对累积的内容进行最终过滤（处理可能的残留）
            if (buffer && !isInReasoningBlock) {
                const filtered = this.filterReasoningContent(buffer);
                if (filtered && filtered !== buffer) {
                    // 如果有过滤，发送差异部分
                    onEvent({ content: filtered.replace(buffer, '') });
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
