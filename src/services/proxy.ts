import type { AIProvider, AIChatMessage, AIResponse, AIStreamEvent } from '../types';
import { settingsService } from './settings';

/**
 * 代理服务
 * 浏览器环境使用标准fetch直接请求
 * 依赖服务器端支持CORS
 */
export class ProxyService {
    private static getRequestTimeout(): number {
        const settings = settingsService.getSettings();
        let timeout = Number(settings?.requestTimeout);
        if (isNaN(timeout) || timeout <= 0) {
            timeout = 600000; // 默认10分钟
        }
        return timeout;
    }

    private static buildThinkingControlPayload(provider: AIProvider): Record<string, unknown> {
        const settings = settingsService.getSettings();
        if (settings.enableReasoningOutput !== false) {
            return {};
        }

        // 统一策略：对所有提供商都采用 Ollama 方案（think=false）
        // 某些模型对特殊参数敏感可能会导致 400 错误
        // 对 gpt-oss 模型谨慎使用
        if (provider.model?.startsWith('gpt-oss')) {
            return {};
        }

        return {
            think: false
        };
    }

    /**
     * 发送代理请求
     */
    static async sendRequest(
        url: string,
        method: string,
        headers: Record<string, string>,
        body: unknown
    ): Promise<any> {
        const bodyStr = JSON.stringify(body);
        const timeout = this.getRequestTimeout();

        const useTimeout = timeout > 0 && timeout < 3600000;
        const controller = useTimeout ? new AbortController() : null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        if (controller) {
            timeoutId = setTimeout(() => {
                controller.abort();
            }, timeout);
        }

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: bodyStr,
                ...(controller ? { signal: controller.signal } : {})
            });

            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (!response.ok) {
                let errorDetail = '';
                try {
                    const text = await response.text();
                    try {
                        const errorData = JSON.parse(text);
                        errorDetail = errorData.error?.message || errorData.message || text;
                    } catch {
                        errorDetail = text;
                    }
                } catch (readError) {
                    errorDetail = `(无法读取响应体: ${readError})`;
                }

                let hint = '';
                if (response.status === 502) {
                    hint = ' (502 Bad Gateway: 通常表示代理服务器无法连接到后端 AI 服务，请检查 Ollama 是否正在运行或 BaseURL 是否正确)';
                } else if (response.status === 401) {
                    hint = ' (401 Unauthorized: API Key 无效或缺失)';
                } else if (response.status === 404) {
                    hint = ' (404 Not Found: 请检查 BaseURL 是否包含正确的路径，例如 /v1)';
                } else if (response.status === 504) {
                    hint = ' (504 Gateway Timeout: 响应超时)';
                }

                throw new Error(`HTTP ${response.status} ${response.statusText}${hint}${errorDetail ? ': ' + errorDetail : ''}`);
            }

            return await response.json();
        } catch (error) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`请求超时 (${timeout}ms)：AI 服务响应时间过长或被中止。如果是在加载大模型或处理长文本，请在设置中调大超时时间。`);
            }

            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                const isBrowser = typeof window !== 'undefined' && window.location.protocol.startsWith('http');
                const corsHint = isBrowser ? ' 提示：如果你在浏览器中使用思源，请确保目标服务已开启 CORS。' : '';
                throw new Error(`网络连接失败：请检查 AI 服务是否正在运行，以及 baseURL 是否配置正确。${corsHint}当前 baseURL: ${url}`);
            }

            if (error instanceof Error) {
                throw error;
            }
            throw new Error(String(error));
        }
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
        Object.assign(body, this.buildThinkingControlPayload(provider));

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
     * 代理流式聊天请求（SSE/JSONL）
     */
    static async proxyStreamChatCompletion(
        provider: AIProvider,
        messages: AIChatMessage[],
        onEvent: (event: AIStreamEvent) => void
    ): Promise<void> {
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
            max_tokens: provider.maxTokens ?? 2048,
            stream: true
        };
        Object.assign(body, this.buildThinkingControlPayload(provider));

        const timeout = this.getRequestTimeout();
        const useTimeout = timeout > 0 && timeout < 3600000;
        const controller = useTimeout ? new AbortController() : null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        try {
            if (controller) {
                timeoutId = setTimeout(() => {
                    controller.abort();
                }, timeout);
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                ...(controller ? { signal: controller.signal } : {})
            });

            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ': ' + text : ''}`);
            }

            if (!response.body) {
                throw new Error('流式响应为空');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let doneMarked = false;

            const emitPayload = (payload: any): void => {
                if (!payload) return;
                
                // 常见的推理字段来源（增加更多变体支持）
                const reasoning =
                    payload.choices?.[0]?.delta?.reasoning_content ??
                    payload.choices?.[0]?.delta?.reasoning ??
                    payload.choices?.[0]?.message?.reasoning_content ??
                    payload.choices?.[0]?.message?.reasoning ??
                    payload.choices?.[0]?.delta?.thought ?? // 部分模型使用 thought
                    '';

                if (reasoning) {
                    onEvent({ reasoning });
                }

                // 内容字段获取
                const content = 
                    payload.choices?.[0]?.delta?.content ?? 
                    payload.choices?.[0]?.message?.content ?? 
                    payload.message?.content ?? // 某些非标准格式可能直接在 root.message 下
                    '';

                if (content) {
                    onEvent({ content });
                }
                
                // 结束标记检查
                if (payload.choices?.[0]?.finish_reason || payload.done === true) {
                    doneMarked = true;
                    onEvent({ done: true });
                }
            };

            const processLine = (line: string): void => {
                const trimmed = line.trim();
                if (!trimmed) return;

                let dataStr = trimmed;
                if (trimmed.startsWith('data:')) {
                    dataStr = trimmed.slice(5).trim();
                }

                if (!dataStr) return;

                if (dataStr === '[DONE]') {
                    doneMarked = true;
                    onEvent({ done: true });
                    return;
                }

                try {
                    // 处理可能的 JSON 数据，支持 SSE 格式
                    const payload = JSON.parse(dataStr);
                    emitPayload(payload);
                } catch {
                    // 如果不是 JSON，检查是否是纯文本输出（兼容非标准模型）
                    if (!trimmed.startsWith('data:')) {
                        onEvent({ content: trimmed });
                    }
                }
            };

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';

                for (const line of lines) {
                    processLine(line);
                }
            }

            if (buffer.trim()) {
                processLine(buffer);
            }

            if (!doneMarked) {
                onEvent({ done: true });
            }
        } catch (error) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (error instanceof Error && error.name === 'AbortError') {
                onEvent({
                    error: new Error(`请求超时 (${timeout}ms)：流式响应超时，请在设置中调大超时时间。`),
                    done: true
                });
                return;
            }

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
