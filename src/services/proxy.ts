import type { AIProvider, AIChatMessage, AIResponse, AIStreamEvent } from '../types';

/**
 * 代理服务
 * 浏览器环境使用标准fetch直接请求
 * 依赖服务器端支持CORS
 */
export class ProxyService {
    /**
     * 发送代理请求
     * 优先使用思源内核的fetch（如果暴露），否则使用标准fetch
     */
    static async sendRequest(
        url: string,
        method: string,
        headers: Record<string, string>,
        body: unknown
    ): Promise<any> {
        const bodyStr = JSON.stringify(body);

        // 使用标准 fetch（浏览器环境）
        const response = await fetch(url, {
            method,
            headers,
            body: bodyStr
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * 代理普通聊天请求
     */
    static async proxyChatCompletion(
        provider: AIProvider,
        messages: AIChatMessage[]
    ): Promise<AIResponse> {
        const url = `${provider.baseURL}/chat/completions`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(provider.apiKey && provider.apiKey !== 'ollama' 
                ? { 'Authorization': `Bearer ${provider.apiKey}` } 
                : {})
        };
        
        const body = {
            model: provider.model,
            messages,
            temperature: provider.temperature ?? 0.7,
            max_tokens: provider.maxTokens ?? 2048
        };

        const data = await this.sendRequest(url, 'POST', headers, body);

        return {
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            } : undefined
        };
    }

    /**
     * 代理流式聊天请求
     * 使用非流式请求模拟流式效果
     */
    static async proxyStreamChatCompletion(
        provider: AIProvider,
        messages: AIChatMessage[],
        onEvent: (event: AIStreamEvent) => void
    ): Promise<void> {
        try {
            // 使用非流式请求获取完整响应
            const response = await this.proxyChatCompletion(provider, messages);
            const content = response.content;
            
            // 模拟流式输出
            const chunkSize = 3;
            for (let i = 0; i < content.length; i += chunkSize) {
                onEvent({ content: content.slice(i, i + chunkSize) });
                await new Promise(r => setTimeout(r, 10));
            }
            onEvent({ done: true });
        } catch (error) {
            onEvent({ 
                error: error instanceof Error ? error : new Error(String(error)), 
                done: true 
            });
        }
    }

    /**
     * 测试代理连接
     */
    static async testProxyConnection(provider: AIProvider): Promise<boolean> {
        try {
            await this.proxyChatCompletion(provider, [{ role: 'user', content: 'Hi' }]);
            return true;
        } catch {
            return false;
        }
    }
}
