import { BaseProviderAdapter } from './base';
import { ProxyService } from '../services/proxy';
import type { AIChatMessage, AIStreamEvent, AIResponse } from '../types';

/**
 * 代理适配器
 * 用于浏览器环境和移动端App的WebView环境
 * 通过思源内核转发请求，绕过CORS限制
 */
export class ProxyAdapter extends BaseProviderAdapter {
    getMetadata() {
        return {
            id: 'proxy-openai-compatible',
            name: this.provider.name,
            supportStreaming: true,
            maxContextToken: 4096
        };
    }

    /**
     * 非流式聊天请求
     */
    async chatCompletion(messages: AIChatMessage[]): Promise<AIResponse> {
        return ProxyService.proxyChatCompletion(this.provider, messages);
    }

    /**
     * 流式聊天请求
     * 使用非流式请求模拟流式效果
     */
    async streamChatCompletion(
        messages: AIChatMessage[],
        onEvent: (event: AIStreamEvent) => void
    ): Promise<void> {
        return ProxyService.proxyStreamChatCompletion(this.provider, messages, onEvent);
    }

    /**
     * 测试连接
     */
    async testConnection(): Promise<boolean> {
        return ProxyService.testProxyConnection(this.provider);
    }
}
