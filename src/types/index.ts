// ==================== AI Provider Types ====================

export interface AIProvider {
    id: string;
    name: string;
    apiKey: string;
    baseURL: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    isDefault: boolean;
}

export interface AIChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIStreamEvent {
    content?: string;
    error?: Error;
    done?: boolean;
}

export interface AIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface IAIProviderAdapter {
    getMetadata(): {
        id: string;
        name: string;
        supportStreaming: boolean;
        maxContextToken: number;
    };
    chatCompletion(messages: AIChatMessage[], model?: string): Promise<AIResponse>;
    streamChatCompletion(
        messages: AIChatMessage[],
        onEvent: (event: AIStreamEvent) => void,
        model?: string
    ): Promise<void>;
    testConnection(): Promise<boolean>;
}

// ==================== Operation Types ====================

export type AIOperationType =
    | 'chat'
    | 'polish'
    | 'translate'
    | 'summarize'
    | 'expand'
    | 'condense'
    | 'rewrite'
    | 'continue'
    | 'custom1'
    | 'custom2'
    | 'custom3'
    | 'customInput';

export interface OperationPrompt {
    type: AIOperationType;
    name: string;
    prompt: string;
    icon?: string;
}

// ==================== UI Configuration ====================

export interface ToolbarButtonConfig {
    polish: boolean;
    translate: boolean;
    summarize: boolean;
    expand: boolean;
    condense: boolean;
    rewrite: boolean;
    continue: boolean;
    custom1: boolean;
    custom2: boolean;
    custom3: boolean;
    customInput: boolean;
}

export interface CustomButton {
    id: string;
    name: string;
    icon: string;
    prompt: string;
    enabled: boolean;
}

// ==================== Conversation Types ====================

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface Conversation {
    id: string;
    title: string;
    messages: ConversationMessage[];
    createdAt: number;
    updatedAt: number;
}

// ==================== Diff Types ====================

export type DiffType = 'equal' | 'delete' | 'insert' | 'replace';

export interface DiffResult {
    type: DiffType;
    original: string;
    modified: string;
    accepted: boolean;
}

export interface DiffStats {
    total: number;
    unchanged: number;
    modified: number;
    accepted: number;
    rejected: number;
}

// 内联差异段落类型
export type InlineSegmentType = 'equal' | 'delete' | 'insert';

export interface InlineDiffSegment {
    type: InlineSegmentType;
    text: string;
}

export interface InlineDiffText {
    fullText: string;
    segments: InlineDiffSegment[];
}

export interface InlineDiffResult {
    original: InlineDiffText;
    modified: InlineDiffText;
}

// ==================== Plugin Settings ====================

export type DiffHighlightStyle = 'word' | 'sentence' | 'paragraph';
export type UIMode = 'floating' | 'dock' | 'both';

export interface PluginSettings {
    // Provider settings
    providers: AIProvider[];
    currentProviderId: string | null;
    
    // Operation prompts
    operationPrompts: Record<AIOperationType, string>;
    
    // UI settings
    uiMode: UIMode;
    diffHighlightStyle: DiffHighlightStyle;
    showFloatingToolbar: boolean;
    showContextMenu: boolean;
    
    // Behavior settings
    autoApplyOnAccept: boolean;
    maxConcurrentRequests: number;
    requestTimeout: number;
    
    // Custom buttons
    customButtons: CustomButton[];
    
    // Toolbar configuration
    toolbarButtons: ToolbarButtonConfig;
    
    // Conversations
    conversations: Conversation[];
    
    // Privacy settings
    enableLocalMode: boolean;
    redactSensitiveInfo: boolean;
    
    // Custom input prompt history
    customInputHistory: string[];
}

// ==================== Block Types ====================

export interface BlockInfo {
    id: string;
    type: string;
    subtype?: string;
    content: string;
    markdown?: string;
}

// ==================== Event Types ====================

export interface AIProcessingEvent {
    type: 'start' | 'progress' | 'complete' | 'error';
    operation: AIOperationType;
    data?: unknown;
    error?: Error;
}

// ==================== Default Templates ====================

export const DEFAULT_PROVIDER_TEMPLATES: Omit<AIProvider, 'id' | 'isDefault'>[] = [
    {
        name: 'Ollama (本地)',
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3.2',
        apiKey: 'ollama',
        temperature: 0.7,
        maxTokens: 4096
    },
    {
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096
    },
    {
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096
    },
    {
        name: 'Moonshot',
        baseURL: 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096
    },
    {
        name: '智谱AI (Z.ai)',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4-flash',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096
    },
    {
        name: 'Claude (Anthropic)',
        baseURL: 'https://api.anthropic.com/v1',
        model: 'claude-3-sonnet-20240229',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096
    },
    {
        name: '自定义 OpenAI 格式',
        baseURL: '',
        model: '',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096
    }
];

export const DEFAULT_PROMPTS: Record<AIOperationType, string> = {
    chat: '',
    polish: '请润色以下文本，优化表达使其更流畅、专业。严格要求：1.保持原意不变；2.仅输出润色后的文本，不要有任何解释或前言；3.不要添加任何额外内容：',
    translate: '请将以下文本翻译成目标语言。严格规则：1.如果文本是中文，翻译成英文；2.如果文本是英文或其他语言，翻译成中文；3.必须只输出翻译结果，禁止输出原文；4.保持原意和专业术语准确；5.不要添加任何解释、前言或额外内容：',
    summarize: '请提炼以下文本的核心要点。严格要求：1.用3-5句话概括关键信息；2.只输出总结内容；3.不要添加任何解释或额外内容：',
    expand: '请基于以下内容进行扩展。严格规则：1.增加相关细节和解释；2.使内容更丰富完整；3.保持主题一致；4.只输出扩展后的内容；5.不要添加任何解释或额外内容：',
    condense: '请精简以下文本。严格规则：1.去除冗余描述和重复信息；2.保留核心观点和关键数据；3.只输出精简后的内容；4.不要添加任何解释或额外内容：',
    rewrite: '请改写以下文本。严格规则：1.调整为正式书面语风格，适用于学术或商务场景；2.保持原意；3.只输出改写后的内容；4.不要添加任何解释或额外内容：',
    continue: '请延续以下文本续写后续内容。严格规则：1.保持风格和主题一致；2.逻辑连贯；3.只输出续写内容；4.不要添加任何解释或额外内容：',
    custom1: '',
    custom2: '',
    custom3: '',
    customInput: ''
};

export const DEFAULT_CUSTOM_BUTTONS: CustomButton[] = [
    { id: 'custom1', name: '自定义1', icon: '✨', prompt: '', enabled: false },
    { id: 'custom2', name: '自定义2', icon: '🔧', prompt: '', enabled: false },
    { id: 'custom3', name: '自定义3', icon: '🎯', prompt: '', enabled: false }
];

export const DEFAULT_TOOLBAR_BUTTONS: ToolbarButtonConfig = {
    polish: true,
    translate: true,
    summarize: true,
    expand: true,
    condense: false,
    rewrite: false,
    continue: false,
    custom1: false,
    custom2: false,
    custom3: false,
    customInput: true
};
