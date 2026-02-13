import { OpenAIAdapter } from './openai';
import type { AIProvider, IAIProviderAdapter } from '../types';

export class AdapterFactory {
    static createAdapter(provider: AIProvider): IAIProviderAdapter {
        // 目前使用统一的OpenAI适配器，因为大多数服务都是OpenAI兼容的
        return new OpenAIAdapter(provider);
    }
}

export { BaseProviderAdapter } from './base';
export { OpenAIAdapter } from './openai';
