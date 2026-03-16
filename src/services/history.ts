import type { Plugin } from 'siyuan';
import type { AIOperationType } from '../types';
import type {
  OperationHistory,
  OperationVersion,
  OperationHistoryStore,
  HistoryExportData
} from '../types/history';
import { HISTORY_STORE_VERSION, MAX_HISTORY_COUNT, MAX_VERSIONS_PER_HISTORY, HISTORY_EXPORT_VERSION } from '../types/history';
import { settingsService } from './settings';

const HISTORY_STORAGE_KEY = 'ai-assistant-operation-history';

/**
 * 操作历史记录服务
 * 独立存储，不依赖settings，避免影响主配置
 */
export class HistoryService {
  private plugin: Plugin | null = null;
  private cache: OperationHistoryStore | null = null;

  init(plugin: Plugin): void {
    this.plugin = plugin;
  }

  /**
   * 加载历史记录存储
   * 失败时返回空存储，不影响主功能
   */
  async loadStore(): Promise<OperationHistoryStore> {
    if (this.cache) {
      return this.cache;
    }

    if (!this.plugin) {
      return this.getEmptyStore();
    }

try {
    const data = await this.plugin.loadData(HISTORY_STORAGE_KEY);
    if (data && this.isValidStore(data)) {
      this.cache = data;
      return data;
    }
  } catch (error) {
    console.error('[AI Assistant] Failed to load history store:', error);
  }

    return this.getEmptyStore();
  }

  /**
   * 保存历史记录存储
   * 失败时静默处理，不影响主功能
   */
  async saveStore(store: OperationHistoryStore): Promise<void> {
    if (!this.plugin) return;

try {
    await this.plugin.saveData(HISTORY_STORAGE_KEY, store);
    this.cache = store;
  } catch (error) {
    console.error('[AI Assistant] Failed to save history store:', error);
  }
  }

  /**
   * 获取所有历史记录
   */
  async getHistories(): Promise<OperationHistory[]> {
    const store = await this.loadStore();
    return store.histories;
  }

  /**
   * 创建新的历史记录（开始处理时调用）
   */
  async createHistory(
    blockId: string,
    originalText: string,
    operationType: AIOperationType,
    metadata?: { instruction?: string; providerId?: string; model?: string }
  ): Promise<OperationHistory> {
    const store = await this.loadStore();
    
    const history: OperationHistory = {
      id: this.generateId(),
      title: this.generateTitle(originalText),
      blockId,
      versions: [{
        version: 0,
        text: originalText,
        operationType: 'original',
        timestamp: Date.now(),
        ...metadata
      }],
      totalVersions: 1,
      finalVersion: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      finalApplied: false
    };

    // 添加到头部，保持最多历史记录条数
    store.histories.unshift(history);
    if (store.histories.length > MAX_HISTORY_COUNT) {
      store.histories = store.histories.slice(0, MAX_HISTORY_COUNT);
    }

    await this.saveStore(store);
    return history;
  }

  /**
   * 添加新版本（重新生成或切换模型时调用）
   * 使用智能采样：前3个 + 后3个
   */
  async addVersion(
    historyId: string,
    text: string,
    operationType: AIOperationType,
    metadata?: { instruction?: string; providerId?: string; model?: string }
  ): Promise<void> {
    const store = await this.loadStore();
    const history = store.histories.find(h => h.id === historyId);
    
    if (!history) return;

    const newVersion: OperationVersion = {
      version: history.totalVersions,
      text,
      operationType,
      timestamp: Date.now(),
      ...metadata
    };

    // 智能采样策略（根据设置决定是否限制）
    const versions = history.versions;
    const settings = settingsService.getSettings();
    const shouldLimitVersions = settings.historyVersionLimit === '6versions';
    
    if (!shouldLimitVersions || versions.length < MAX_VERSIONS_PER_HISTORY) {
      // 不限制或6个以内全保存
      versions.push(newVersion);
    } else {
      // 超过6个：保存开头3个 + 最后3个
      const startVersions = versions.slice(0, 3);
      const endVersions = versions.slice(-2); // 取倒数第2、第1
      // 重建 versions，尽量使用副本避免引用共享带来的副作用
      history.versions = [
        ...startVersions.map(v => ({ ...v })),
        ...endVersions.map(v => ({ ...v })),
        { ...newVersion }
      ];
    }

    history.totalVersions++;
    history.finalVersion = newVersion.version;
    history.updatedAt = Date.now();

    await this.saveStore(store);
  }

  /**
   * 标记最终版本已应用
   */
  async markAsApplied(historyId: string): Promise<void> {
    const store = await this.loadStore();
    const history = store.histories.find(h => h.id === historyId);
    
    if (history) {
      history.finalApplied = true;
      history.updatedAt = Date.now();
      await this.saveStore(store);
    }
  }

  /**
   * 删除单条历史记录
   */
  async deleteHistory(historyId: string): Promise<void> {
    const store = await this.loadStore();
    store.histories = store.histories.filter(h => h.id !== historyId);
    await this.saveStore(store);
  }

  /**
   * 清空所有历史记录
   */
  async clearAllHistories(): Promise<void> {
    const store = this.getEmptyStore();
    await this.saveStore(store);
  }

  /**
   * 获取单条历史记录
   */
  async getHistory(historyId: string): Promise<OperationHistory | null> {
    const store = await this.loadStore();
    return store.histories.find(h => h.id === historyId) || null;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成标题（原文前30字）
   */
  private generateTitle(text: string): string {
    const cleanText = text.replace(/\n/g, ' ').trim();
    if (cleanText.length <= 30) return cleanText;
    return cleanText.substring(0, 30) + '...';
  }

  /**
   * 获取空存储结构
   */
  private getEmptyStore(): OperationHistoryStore {
    return {
      version: HISTORY_STORE_VERSION,
      histories: []
    };
  }

  /**
   * 验证存储数据格式
   */
  private isValidStore(data: unknown): data is OperationHistoryStore {
    if (!data || typeof data !== 'object') return false;
    const store = data as OperationHistoryStore;
    return (
      store.version === HISTORY_STORE_VERSION &&
      Array.isArray(store.histories)
    );
  }

  // ==================== 导入导出功能 ====================

  /**
   * 导出历史记录
   * 返回导出数据对象，供上层处理文件保存
   */
  async exportHistories(): Promise<HistoryExportData> {
    const store = await this.loadStore();
    return {
      version: HISTORY_EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      histories: store.histories
    };
  }

  /**
   * 导入历史记录（智能合并）
   * - 相同ID的记录：保留更新时间较新的版本
   * - 不同ID的记录：直接合并
   * - 用户无感知，自动处理冲突
   * @returns 返回导入结果统计
   */
  async importHistories(
    importData: HistoryExportData,
    onProgress?: (message: string) => void
  ): Promise<{ added: number; updated: number; skipped: number }> {
    // 验证导入数据格式
    if (!this.isValidExportData(importData)) {
      throw new Error('Invalid history export data format');
    }

    const currentStore = await this.loadStore();
    const result = { added: 0, updated: 0, skipped: 0 };

    // 创建ID到历史记录的映射，便于快速查找
    const historyMap = new Map<string, OperationHistory>();
    currentStore.histories.forEach(h => historyMap.set(h.id, h));

    for (const importHistory of importData.histories) {
      // 验证单条历史记录格式
      if (!this.isValidHistory(importHistory)) {
        result.skipped++;
        continue;
      }

      const existingHistory = historyMap.get(importHistory.id);

      if (!existingHistory) {
        // 新记录，直接添加
        historyMap.set(importHistory.id, importHistory);
        result.added++;
      } else {
        // 已存在，比较更新时间，保留较新的
        if (importHistory.updatedAt > existingHistory.updatedAt) {
          historyMap.set(importHistory.id, importHistory);
          result.updated++;
        } else {
          result.skipped++;
        }
      }
    }

    // 转换回数组并按更新时间排序（最新的在前）
    const mergedHistories = Array.from(historyMap.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_HISTORY_COUNT); // 确保不超过最大数量

    // 保存合并后的数据
    const newStore: OperationHistoryStore = {
      version: HISTORY_STORE_VERSION,
      histories: mergedHistories
    };
    await this.saveStore(newStore);

    const message = `导入完成: 新增 ${result.added} 条, 更新 ${result.updated} 条, 跳过 ${result.skipped} 条`;
    onProgress?.(message);

    return result;
  }

  /**
   * 验证导出数据格式
   */
  private isValidExportData(data: unknown): data is HistoryExportData {
    if (!data || typeof data !== 'object') return false;
    const exportData = data as HistoryExportData;
    return (
      typeof exportData.version === 'number' &&
      exportData.version >= 1 &&
      typeof exportData.exportDate === 'string' &&
      Array.isArray(exportData.histories)
    );
  }

  /**
   * 验证单条历史记录格式
   */
  private isValidHistory(data: unknown): data is OperationHistory {
    if (!data || typeof data !== 'object') return false;
    const history = data as OperationHistory;
    return (
      typeof history.id === 'string' &&
      typeof history.title === 'string' &&
      typeof history.blockId === 'string' &&
      Array.isArray(history.versions) &&
      history.versions.length > 0 &&
      typeof history.totalVersions === 'number' &&
      typeof history.createdAt === 'number' &&
      typeof history.updatedAt === 'number' &&
      typeof history.finalApplied === 'boolean'
    );
  }
}

// 导出单例
export const historyService = new HistoryService();
