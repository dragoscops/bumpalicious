import { Readable } from 'node:stream';
import { GitCommit, RepositoryInfo } from '../types/git.js';
import type { WorkspaceNode, WorkspaceWithVersion } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';
export type ChangelogPreset = 'conventionalcommits' | 'angular' | 'atom' | 'codemirror' | 'ember' | 'eslint' | 'express' | 'jquery' | 'jshint';
interface ParsedCommit {
    type?: string;
    scope?: string;
    subject?: string;
    body?: string;
    footer?: string;
    hash?: string;
    notes?: Array<{
        title: string;
        text: string;
    }>;
    [key: string]: unknown;
}
export interface GenerateChangelogOptions {
    readonly workspace: WorkspaceWithVersion;
    readonly changelogPath: string;
    readonly preset?: ChangelogPreset;
    readonly childWorkspaces?: ReadonlyArray<WorkspaceNode>;
    readonly repository: RepositoryInfo;
    readonly lastTag?: string | null;
    readonly commits?: ReadonlyArray<GitCommit>;
}
export interface ChangelogResult {
    readonly content: string;
    readonly path: string;
    readonly created: boolean;
}
export declare class ChangelogService extends Loggable {
    constructor();
    protected commitsToParseStream(commits: ReadonlyArray<GitCommit>): Readable;
    protected parseGitCommits(commits: ReadonlyArray<GitCommit>, parserOpts: any): Promise<ReadonlyArray<ParsedCommit>>;
    protected commitsToWriteStream(commits: ReadonlyArray<ParsedCommit>): Readable;
    protected parsedCommitsToChangelog(commits: ReadonlyArray<ParsedCommit>, writerOpts: any, context: any): Promise<ReadonlyArray<string>>;
    generateForWorkspace(options: GenerateChangelogOptions): Promise<ChangelogResult>;
    private mergeChangelogs;
    private ensureChangelogHeader;
    private generateChildWorkspaceSummary;
    private appendChildSummary;
    private writeChangelog;
    private fileExists;
    private buildContext;
}
export {};
//# sourceMappingURL=ChangelogService.d.ts.map