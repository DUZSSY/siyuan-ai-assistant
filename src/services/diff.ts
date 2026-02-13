import DiffMatchPatch from 'diff-match-patch';
import type { DiffResult, DiffStats, InlineDiffSegment, InlineDiffResult } from '../types';

export class DiffService {
    private dmp: DiffMatchPatch;

    constructor() {
        this.dmp = new DiffMatchPatch();
    }

    /**
     * Compute diff between original and modified text
     */
    computeDiff(original: string, modified: string): DiffResult[] {
        const diffs = this.dmp.diff_main(original, modified);
        this.dmp.diff_cleanupSemantic(diffs);

        return diffs.map(([type, text]) => {
            let diffType: DiffResult['type'];
            
            switch (type) {
                case DiffMatchPatch.DIFF_EQUAL:
                    diffType = 'equal';
                    break;
                case DiffMatchPatch.DIFF_DELETE:
                    diffType = 'delete';
                    break;
                case DiffMatchPatch.DIFF_INSERT:
                    diffType = 'insert';
                    break;
                default:
                    diffType = 'equal';
            }

            return {
                type: diffType,
                original: type === DiffMatchPatch.DIFF_INSERT ? '' : text,
                modified: type === DiffMatchPatch.DIFF_DELETE ? '' : text,
                accepted: true // 默认全部接受AI修改
            };
        });
    }

    /**
     * Compute line-based diff for better readability
     */
    computeLineDiff(original: string, modified: string): DiffResult[] {
        const diffs = this.dmp.diff_linesToChars_(original, modified);
        const lineDiffs = this.dmp.diff_main(diffs.chars1, diffs.chars2);
        this.dmp.diff_charsToLines_(lineDiffs, diffs.lineArray);
        this.dmp.diff_cleanupSemantic(lineDiffs);

        return lineDiffs.map(([type, text]) => {
            let diffType: DiffResult['type'];
            
            switch (type) {
                case DiffMatchPatch.DIFF_EQUAL:
                    diffType = 'equal';
                    break;
                case DiffMatchPatch.DIFF_DELETE:
                    diffType = 'delete';
                    break;
                case DiffMatchPatch.DIFF_INSERT:
                    diffType = 'insert';
                    break;
                default:
                    diffType = 'equal';
            }

            return {
                type: diffType,
                original: type === DiffMatchPatch.DIFF_INSERT ? '' : text,
                modified: type === DiffMatchPatch.DIFF_DELETE ? '' : text,
                accepted: true // 默认全部接受AI修改
            };
        });
    }

    /**
     * Compute inline diff - returns segments with type for rendering
     * 用于段落式内联差异展示
     */
    computeInlineDiff(original: string, modified: string): InlineDiffResult {
        const diffs = this.dmp.diff_main(original, modified);
        this.dmp.diff_cleanupSemantic(diffs);

        // 构建原文和修改文的内联段
        const originalSegments: InlineDiffSegment[] = [];
        const modifiedSegments: InlineDiffSegment[] = [];

        for (const [type, text] of diffs) {
            switch (type) {
                case DiffMatchPatch.DIFF_EQUAL:
                    // 相同部分，两边都显示
                    originalSegments.push({ type: 'equal', text });
                    modifiedSegments.push({ type: 'equal', text });
                    break;
                case DiffMatchPatch.DIFF_DELETE:
                    // 删除部分，只在原文显示（带删除线）
                    originalSegments.push({ type: 'delete', text });
                    break;
                case DiffMatchPatch.DIFF_INSERT:
                    // 新增部分，只在修改文显示（绿色高亮）
                    modifiedSegments.push({ type: 'insert', text });
                    break;
            }
        }

        return {
            original: {
                fullText: original,
                segments: originalSegments
            },
            modified: {
                fullText: modified,
                segments: modifiedSegments
            }
        };
    }

    /**
     * Get statistics for inline diff
     */
    getInlineStats(inlineResult: InlineDiffResult): DiffStats {
        const originalDeletions = inlineResult.original.segments.filter((s: InlineDiffSegment) => s.type === 'delete').length;
        const modifiedInsertions = inlineResult.modified.segments.filter((s: InlineDiffSegment) => s.type === 'insert').length;
        const equalSegments = inlineResult.original.segments.filter((s: InlineDiffSegment) => s.type === 'equal').length;

        return {
            total: inlineResult.original.segments.length + inlineResult.modified.segments.length,
            unchanged: equalSegments,
            modified: originalDeletions + modifiedInsertions,
            accepted: originalDeletions + modifiedInsertions,
            rejected: 0
        };
    }

    /**
     * Get statistics about the diff
     */
    getStats(diffs: DiffResult[]): DiffStats {
        const stats: DiffStats = {
            total: diffs.length,
            unchanged: 0,
            modified: 0,
            accepted: 0,
            rejected: 0
        };

        for (const diff of diffs) {
            if (diff.type === 'equal') {
                stats.unchanged++;
            } else {
                stats.modified++;
            }

            if (diff.accepted) {
                stats.accepted++;
            } else {
                stats.rejected++;
            }
        }

        return stats;
    }

    /**
     * Accept all changes
     */
    acceptAll(diffs: DiffResult[]): DiffResult[] {
        return diffs.map(diff => ({
            ...diff,
            accepted: diff.type !== 'delete'
        }));
    }

    /**
     * Reject all changes
     */
    rejectAll(diffs: DiffResult[]): DiffResult[] {
        return diffs.map(diff => ({
            ...diff,
            accepted: diff.type === 'delete'
        }));
    }

    /**
     * Toggle acceptance at a specific index
     */
    toggleAtIndex(diffs: DiffResult[], index: number): DiffResult[] {
        if (index < 0 || index >= diffs.length) {
            return diffs;
        }

        const newDiffs = [...diffs];
        newDiffs[index] = {
            ...newDiffs[index],
            accepted: !newDiffs[index].accepted
        };
        return newDiffs;
    }

    /**
     * Merge accepted changes into final text
     */
    mergeAcceptedChanges(diffs: DiffResult[]): string {
        return diffs
            .map(diff => {
                if (diff.accepted) {
                    // If accepted, use the modified version
                    return diff.modified || '';
                } else {
                    // If rejected, use the original version
                    return diff.original || '';
                }
            })
            .join('');
    }

    /**
     * Create a patch that can be applied later
     */
    createPatch(original: string, modified: string): string {
        const diffs = this.dmp.diff_main(original, modified);
        const patch = this.dmp.patch_make(original, diffs);
        return this.dmp.patch_toText(patch);
    }

    /**
     * Apply a patch to text
     */
    applyPatch(text: string, patchText: string): { result: string; applied: boolean } {
        const patches = this.dmp.patch_fromText(patchText);
        const result = this.dmp.patch_apply(patches, text);
        return {
            result: result[0],
            applied: result[1].every(Boolean)
        };
    }
}

export const diffService = new DiffService();
