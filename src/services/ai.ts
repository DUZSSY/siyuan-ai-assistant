import { AdapterFactory } from '../adapters';
import { settingsService } from './settings';
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
    private i18n: Record<string, any> = {};

    setI18n(i18n: Record<string, any>): void {
        this.i18n = i18n || {};
    }

    private getInterfaceLanguageName(): string {
        const fromI18n = this.i18n?.meta?.languageName;
        if (typeof fromI18n === 'string' && fromI18n.trim()) {
            return fromI18n.trim();
        }

        try {
            const lang = (window as any)?.siyuan?.config?.lang;
            if (lang === 'zh_CN' || lang === 'zh-CN') {
                return '简体中文';
            }
            if (lang === 'en_US' || lang === 'en-US') {
                return 'English';
            }
        } catch {
            // ignore
        }

        return '简体中文';
    }

    private getUiLanguageConstraintLine(): string {
        const languageName = this.getInterfaceLanguageName();
        return `【界面语言强制】思考过程（若模型返回）与最终正文，必须使用 ${languageName}。`; 
    }

    private isReasoningEnabled(): boolean {
        return settingsService.getSettings().enableReasoningOutput !== false;
    }

    private getReasoningControlLine(): string {
        if (this.isReasoningEnabled()) {
            return '';
        }
        return '【关闭思考】不要输出思考过程、推理过程、thinking/reasoning字段，只输出最终正文。';
    }

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
        const chunks: string[] = [];
        const response = await this.streamChatCompletion(messages, (chunk) => {
            chunks.push(chunk);
        });

        if (chunks.length === 0 && response.content) {
            yield response.content;
            return;
        }

        for (const chunk of chunks) {
            yield chunk;
        }
    }

    async streamChatCompletion(
        messages: AIChatMessage[],
        onChunk: (chunk: string, accumulated: string) => void,
        onReasoning?: (chunk: string, accumulated: string) => void,
        model?: string
    ): Promise<AIResponse> {
        if (!this.adapter) {
            throw new Error('AI provider not configured');
        }

        let accumulatedContent = '';
        let accumulatedReasoning = '';
        let streamError: Error | null = null;
        let inReasoningBlock = false;
        let parseBuffer = '';

        const openingTags = ['<think>', '<thinking>', '<reasoning>'];
        const closingTags = ['</think>', '</thinking>', '</reasoning>'];
        const maxOpeningTagLength = Math.max(...openingTags.map(tag => tag.length));
        const maxClosingTagLength = Math.max(...closingTags.map(tag => tag.length));

        const emitContent = (text: string) => {
            if (!text) return;
            accumulatedContent += text;
            onChunk(text, accumulatedContent);
        };

        const emitReasoning = (text: string) => {
            if (!this.isReasoningEnabled()) return;
            if (!text || !onReasoning) return;
            accumulatedReasoning += text;
            onReasoning(text, accumulatedReasoning);
        };

        const findFirstTag = (source: string, tags: string[]) => {
            let firstIndex = -1;
            let firstTag = '';
            for (const tag of tags) {
                const idx = source.indexOf(tag);
                if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
                    firstIndex = idx;
                    firstTag = tag;
                }
            }
            return { index: firstIndex, tag: firstTag };
        };

        const processRawContent = (incoming: string) => {
            if (!incoming) return;
            parseBuffer += incoming;

            while (parseBuffer.length > 0) {
                if (inReasoningBlock) {
                    const closing = findFirstTag(parseBuffer, closingTags);
                    if (closing.index !== -1) {
                        const reasoningText = parseBuffer.slice(0, closing.index);
                        emitReasoning(reasoningText);
                        parseBuffer = parseBuffer.slice(closing.index + closing.tag.length);
                        inReasoningBlock = false;
                        continue;
                    }

                    const safeLength = Math.max(0, parseBuffer.length - (maxClosingTagLength - 1));
                    if (safeLength === 0) {
                        break;
                    }

                    emitReasoning(parseBuffer.slice(0, safeLength));
                    parseBuffer = parseBuffer.slice(safeLength);
                    break;
                }

                const opening = findFirstTag(parseBuffer, openingTags);
                if (opening.index !== -1) {
                    emitContent(parseBuffer.slice(0, opening.index));
                    parseBuffer = parseBuffer.slice(opening.index + opening.tag.length);
                    inReasoningBlock = true;
                    continue;
                }

                const safeLength = Math.max(0, parseBuffer.length - (maxOpeningTagLength - 1));
                if (safeLength === 0) {
                    break;
                }

                emitContent(parseBuffer.slice(0, safeLength));
                parseBuffer = parseBuffer.slice(safeLength);
                break;
            }
        };

        await this.adapter.streamChatCompletion(
            messages,
            (event) => {
                if (event.error) {
                    streamError = event.error;
                    return;
                }

                if (event.reasoning) {
                    emitReasoning(event.reasoning);
                }

                if (event.content) {
                    processRawContent(event.content);
                }
            },
            model
        );

        if (parseBuffer) {
            if (inReasoningBlock) {
                emitReasoning(parseBuffer);
            } else {
                emitContent(parseBuffer);
            }
            parseBuffer = '';
        }

        if (streamError) {
            throw streamError;
        }

        return {
            content: this.normalizeSingleTextOutput(accumulatedContent)
        };
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
            { role: 'system', content: this.getSingleTextSystemPrompt() },
            { role: 'user', content: `${prompt}\n\n${text}` }
        ];

        return this.chatCompletion(messages);
    }

    async testConnection(): Promise<boolean> {
        if (!this.adapter) {
            return false;
        }
        try {
            const probeMessages: AIChatMessage[] = [
                { role: 'system', content: this.getSingleTextSystemPrompt() },
                { role: 'user', content: '请回复“连接正常”。' }
            ];
            await this.chatCompletion(probeMessages);
            return true;
        } catch {
            try {
                return await this.adapter.testConnection();
            } catch {
                return false;
            }
        }
    }

    async chatCompletion(messages: AIChatMessage[]): Promise<AIResponse> {
        if (!this.adapter) {
            throw new Error('AI provider not configured');
        }
        const response = await this.adapter.chatCompletion(messages);
        return {
            ...response,
            content: this.normalizeSingleTextOutput(response.content)
        };
    }

    buildOperationMessages(text: string, operation: AIOperationType, customPrompt?: string): AIChatMessage[] {
        // 当 customPrompt 为 undefined 时使用默认 prompt；空字符串是有效值（允许用户设置空 prompt）
        const prompt = customPrompt !== undefined ? customPrompt : DEFAULT_PROMPTS[operation];
        
        const systemPrompt = this.getSingleTextSystemPrompt();
        
        const languageConstraint = this.getUiLanguageConstraintLine();
        const reasoningControl = this.getReasoningControlLine();

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${languageConstraint}${reasoningControl ? `\n${reasoningControl}` : ''}\n\n${prompt}\n\n${text}` }
        ];
    }

    private getSingleTextSystemPrompt(): string {
        const i18nPrompt = this.i18n?.prompts?.singleTextSystemPromptUi || this.i18n?.prompts?.singleTextSystemPrompt;
        const languageConstraint = this.getUiLanguageConstraintLine();
        if (i18nPrompt && typeof i18nPrompt === 'string') {
            return `${i18nPrompt}\n\n${languageConstraint}`;
        }

        return `你是专业写作助手。请严格遵守以下指令，你的输出将被直接用于文本替换：

1. 【绝对禁令】严禁输出任何引导语、寒暄、确认语（如“好的”、“当然”、“没问题”、“以下是请求的内容”等）。
2. 【绝对禁令】严禁输出任何形式的理由说明、修改建议、技术备注、专业术语解释或总结性文字。
3. 【绝对禁令】严禁输出多个候选版本、A/B方案、编号列表（如 版本1、版本2）。
4. 【输出格式】必须且仅输出一个可直接替换原文的最终文本。
5. 【输出格式】禁止使用 Markdown 代码块（\`\`\`）、标题、项目符号等对结果进行任何包裹。
6. 【属性保持】原封不动地保持原文的段落结构、换行符、标点符号规范以及语言风格（除非指令明确要求改变）。
7. 【语言一致】你的思考过程（若模型会返回）与最终正文，必须使用与用户输入一致的语言，不得擅自切换语言。

警告：任何偏离直达结果的文字都会导致系统崩溃。请直接输出结果文本。`;
    }

    public normalizeSingleTextOutput(content: string): string {
        let text = (content || '').trim();
        if (!text) return text;

        // 基础清理：移除 Markdown 代码块包裹
        text = text.replace(/^```[a-zA-Z0-9_-]*\s*\n?/g, '').replace(/\n?```$/g, '').trim();

        return text;
    }
}

export const aiService = new AIService();
