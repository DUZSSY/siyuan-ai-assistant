// ==================== Operation History Types ====================

import type { AIOperationType } from './index';

/**
 * 单个处理版本
 * 不截断保存，完整记录
 */
export interface OperationVersion {
  version: number;              // 版本号（0=原文, 1, 2, 3...）
  text: string;                 // 文本内容（不截断，完整保存）
  operationType: AIOperationType | 'original'; // 操作类型
  timestamp: number;            // 时间戳
  providerId?: string;          // AI提供商
  model?: string;               // 模型
  instruction?: string;         // 重新生成时的指令（完整保存）
}

/**
 * 操作历史记录（完整处理链路）
 */
export interface OperationHistory {
  id: string;                   // 唯一标识
  title: string;                // 标题（原文前30字）
  blockId: string;              // 关联的块ID
  
  // 版本链（智能采样）
  // 策略：总版本<=6时全保存；>6时保存[0,1,2] + [倒数第2,倒数第1,最后]
  versions: OperationVersion[];
  
  // 统计信息
  totalVersions: number;        // 实际总版本数
  finalVersion: number;         // 最终版本号
  
  // 时间戳
  createdAt: number;
  updatedAt: number;
  
  // 状态
  finalApplied: boolean;        // 最终版本是否已应用
}

/**
 * 历史记录存储数据结构
 */
export interface OperationHistoryStore {
  histories: OperationHistory[];
  version: number;              // 存储格式版本，用于未来迁移
}

// 当前存储格式版本
export const HISTORY_STORE_VERSION = 1;

// 存储限制常量
export const MAX_HISTORY_COUNT = 1000;     // 最多1000条历史记录
export const MAX_VERSIONS_PER_HISTORY = 6; // 每条历史最多6个版本
