import { OpenAIAdapter } from './openai';
import { ProxyAdapter } from './proxy';
import { isRestrictedEnvironment } from '../utils/environment';
import type { AIProvider, IAIProviderAdapter } from '../types';

export class AdapterFactory {
    private static useProxy: boolean | null = null;

    static createAdapter(provider: AIProvider): IAIProviderAdapter {
        // 检测是否需要使用代理（只在第一次运行时检测）
        if (this.useProxy === null) {
            this.useProxy = isRestrictedEnvironment();
        }

        // 受限环境（浏览器/移动端）使用代理适配器
        if (this.useProxy) {
            return new ProxyAdapter(provider);
        }
        
        // 桌面客户端使用直接请求
        return new OpenAIAdapter(provider);
    }

    /**
     * 重置代理检测（用于测试）
     */
    static resetProxyDetection(): void {
        this.useProxy = null;
    }

    /**
     * 强制使用指定模式
     */
    static forceMode(mode: 'direct' | 'proxy'): void {
        this.useProxy = mode === 'proxy';
    }

    /**
     * 获取当前模式
     */
    static getCurrentMode(): 'direct' | 'proxy' | 'unknown' {
        if (this.useProxy === null) return 'unknown';
        return this.useProxy ? 'proxy' : 'direct';
    }
}

export { BaseProviderAdapter } from './base';
export { OpenAIAdapter } from './openai';
export { ProxyAdapter } from './proxy';
