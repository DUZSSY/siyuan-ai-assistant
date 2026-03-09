import { OpenAIAdapter } from './openai';
import { ProxyAdapter } from './proxy';
import { isRestrictedEnvironment } from '../utils/environment';
import type { AIProvider, IAIProviderAdapter } from '../types';

export class AdapterFactory {
    private static useProxy: boolean | null = null;

    static createAdapter(provider: AIProvider): IAIProviderAdapter {
        // 环境检测：浏览器或移动端必须使用 ProxyAdapter
        const isRestricted = isRestrictedEnvironment();
        
        // 逻辑调整：
        // 1. 如果是浏览器环境，由于 CORS 限制，强制使用 ProxyAdapter（不含 Electron）
        // 2. 如果是桌面原生端 (Electron)，使用 OpenAI 直接请求 (稳定性更好且无跨域限制)
        if (this.useProxy === null) {
            this.useProxy = isRestricted;
        }

        // 使用代理适配器
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
