import type { CommitAnalysis } from '../types/index.js';
export declare function parseConventionalCommit(message: string): CommitAnalysis | null;
export declare function parseCommitMessages(messages: string[]): CommitAnalysis | null;
export interface CommitParseResult {
    analysis: CommitAnalysis | null;
    hasConventionalCommits: boolean;
    totalCommits: number;
    conventionalCommitCount: number;
}
export declare function analyzeCommitMessages(messages: string[]): CommitParseResult;
//# sourceMappingURL=ConventionalCommitParser.d.ts.map