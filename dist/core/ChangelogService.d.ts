import type { WorkspaceWithVersion, WorkspaceNode } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';
export type ChangelogPreset = 'conventionalcommits' | 'angular' | 'atom' | 'codemirror' | 'ember' | 'eslint' | 'express' | 'jquery' | 'jshint';
export interface GenerateChangelogOptions {
    readonly workspace: WorkspaceWithVersion;
    readonly changelogPath: string;
    readonly preset?: ChangelogPreset;
    readonly childWorkspaces?: ReadonlyArray<WorkspaceNode>;
    readonly repository?: {
        readonly owner: string;
        readonly repo: string;
    };
}
export interface ChangelogResult {
    readonly content: string;
    readonly path: string;
    readonly created: boolean;
}
export declare class ChangelogService extends Loggable {
    constructor();
    generateForWorkspace(options: GenerateChangelogOptions): Promise<ChangelogResult>;
    private generateChangelogContent;
    private mergeChangelogs;
    private ensureChangelogHeader;
    private generateChildWorkspaceSummary;
    private appendChildSummary;
    private writeChangelog;
    private fileExists;
}
//# sourceMappingURL=ChangelogService.d.ts.map