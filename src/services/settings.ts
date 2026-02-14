import type { Plugin } from 'siyuan';
import type {
    PluginSettings,
    AIProvider,
    Conversation,
    CustomButton,
    ToolbarButtonConfig
} from '../types';
import {
    DEFAULT_PROMPTS,
    DEFAULT_CUSTOM_BUTTONS,
    DEFAULT_TOOLBAR_BUTTONS
} from '../types';

const STORAGE_KEY = 'ai-assistant-settings';

export class SettingsService {
    private plugin: Plugin | null = null;
    private settings: PluginSettings = this.getDefaultSettings();

    init(plugin: Plugin): void {
        this.plugin = plugin;
    }

    async loadSettings(): Promise<void> {
        if (!this.plugin) return;

        try {
            const data = await this.plugin.loadData(STORAGE_KEY);
            if (data) {
                this.settings = { ...this.getDefaultSettings(), ...data };
            }
        } catch (error) {
            // 加载设置失败，使用默认设置
        }
    }

    async saveSettings(): Promise<void> {
        if (!this.plugin) return;

        try {
            await this.plugin.saveData(STORAGE_KEY, this.settings);
        } catch (error) {
            // 保存设置失败
        }
    }

    getSettings(): PluginSettings {
        return { ...this.settings };
    }

    async updateSettings(settings: Partial<PluginSettings>): Promise<void> {
        this.settings = { ...this.settings, ...settings };
        await this.saveSettings();
    }

    // Provider Management
    async addProvider(provider: AIProvider): Promise<void> {
        const providers = [...this.settings.providers];
        
        // If this is the first provider or marked as default, update others
        if (provider.isDefault || providers.length === 0) {
            providers.forEach(p => p.isDefault = false);
            provider.isDefault = true;
        }
        
        providers.push(provider);
        this.settings.providers = providers;
        
        if (provider.isDefault) {
            this.settings.currentProviderId = provider.id;
        }
        
        await this.saveSettings();
    }

    async updateProvider(id: string, updates: Partial<AIProvider>): Promise<void> {
        const index = this.settings.providers.findIndex(p => p.id === id);
        if (index === -1) return;

        const provider = this.settings.providers[index];
        
        // Handle default provider change
        if (updates.isDefault && updates.isDefault !== provider.isDefault) {
            this.settings.providers.forEach(p => p.isDefault = false);
            this.settings.currentProviderId = id;
        }

        this.settings.providers[index] = { ...provider, ...updates };
        await this.saveSettings();
    }

    async deleteProvider(id: string): Promise<void> {
        const index = this.settings.providers.findIndex(p => p.id === id);
        if (index === -1) return;

        const wasDefault = this.settings.providers[index].isDefault;
        this.settings.providers.splice(index, 1);

        // If deleted provider was default, set a new default
        if (wasDefault && this.settings.providers.length > 0) {
            this.settings.providers[0].isDefault = true;
            this.settings.currentProviderId = this.settings.providers[0].id;
        } else if (this.settings.providers.length === 0) {
            this.settings.currentProviderId = null;
        }

        await this.saveSettings();
    }

    getProvider(id: string): AIProvider | undefined {
        return this.settings.providers.find(p => p.id === id);
    }

    getCurrentProvider(): AIProvider | null {
        if (!this.settings.currentProviderId) return null;
        return this.getProvider(this.settings.currentProviderId) || null;
    }

    async setCurrentProvider(id: string): Promise<void> {
        const provider = this.getProvider(id);
        if (provider) {
            this.settings.providers.forEach(p => p.isDefault = false);
            provider.isDefault = true;
            this.settings.currentProviderId = id;
            await this.saveSettings();
        }
    }

    // Conversation Management
    getConversations(): Conversation[] {
        return [...this.settings.conversations];
    }

    async addConversation(conversation: Conversation): Promise<void> {
        const index = this.settings.conversations.findIndex(c => c.id === conversation.id);
        if (index >= 0) {
            this.settings.conversations[index] = conversation;
        } else {
            this.settings.conversations.push(conversation);
        }
        await this.saveSettings();
    }

    async deleteConversation(id: string): Promise<void> {
        this.settings.conversations = this.settings.conversations.filter(c => c.id !== id);
        await this.saveSettings();
    }

    // Custom Buttons
    getCustomButtons(): CustomButton[] {
        return [...this.settings.customButtons];
    }

    async updateCustomButtons(buttons: CustomButton[]): Promise<void> {
        this.settings.customButtons = buttons;
        await this.saveSettings();
    }

    // Toolbar Buttons
    getToolbarButtons(): ToolbarButtonConfig {
        return { ...this.settings.toolbarButtons };
    }

    async updateToolbarButtons(buttons: ToolbarButtonConfig): Promise<void> {
        this.settings.toolbarButtons = buttons;
        await this.saveSettings();
    }

    private getDefaultSettings(): PluginSettings {
        // 测试AI连接（默认）- 免费试用，额度有限，仅供测试
        // ID前缀为 test-ai- 用于识别测试AI
        const testProvider: AIProvider = {
            id: 'test-ai-glm',
            name: 'GLM（免费试用-额度有限-仅供测试）',
            apiKey: '',
            baseURL: 'https://zproxy--yiizhao.replit.app/v1',
            model: 'glm-4-flash',
            temperature: 0.7,
            maxTokens: 1000,
            isDefault: true
        };

        // Ollama本地部署选项
        const ollamaProvider: AIProvider = {
            id: 'ollama-default',
            name: 'Ollama (本地)',
            apiKey: 'ollama',
            baseURL: 'http://localhost:11434/v1',
            model: 'llama3.2',
            temperature: 0.7,
            maxTokens: 2048,
            isDefault: false
        };

        return {
            providers: [testProvider, ollamaProvider],
            currentProviderId: testProvider.id,
            conversations: [],
            operationPrompts: DEFAULT_PROMPTS,
            uiMode: 'both',
            diffHighlightStyle: 'word',
            showFloatingToolbar: true,
            showContextMenu: true,
            autoApplyOnAccept: false,
            maxConcurrentRequests: 3,
            requestTimeout: 60000,
            customButtons: DEFAULT_CUSTOM_BUTTONS,
            toolbarButtons: DEFAULT_TOOLBAR_BUTTONS,
            enableLocalMode: true,
            redactSensitiveInfo: false
        };
    }
}

export const settingsService = new SettingsService();
