import type {
    AIProvider,
    AIChatMessage,
    AIStreamEvent,
    AIResponse,
    IAIProviderAdapter
} from '../types';

export abstract class BaseProviderAdapter implements IAIProviderAdapter {
    protected provider: AIProvider;

    constructor(provider: AIProvider) {
        this.provider = provider;
    }

    abstract getMetadata(): {
        id: string;
        name: string;
        supportStreaming: boolean;
        maxContextToken: number;
    };

    abstract chatCompletion(messages: AIChatMessage[], model?: string): Promise<AIResponse>;
    
    abstract streamChatCompletion(
        messages: AIChatMessage[],
        onEvent: (event: AIStreamEvent) => void,
        model?: string
    ): Promise<void>;

    abstract testConnection(): Promise<boolean>;

    protected getRequestModel(model?: string): string {
        return model || this.provider.model;
    }

    protected createSystemMessage(content: string): AIChatMessage {
        return { role: 'system', content };
    }

    protected createUserMessage(content: string): AIChatMessage {
        return { role: 'user', content };
    }

    protected createAssistantMessage(content: string): AIChatMessage {
        return { role: 'assistant', content };
    }
}
