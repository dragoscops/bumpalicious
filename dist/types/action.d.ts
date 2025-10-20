import type { WorkspaceConfig } from './workspace.js';
import type { BumpType } from './version.js';
export type ActionBumpType = BumpType | 'none';
export interface ActionInputs {
    readonly token: string;
    readonly workspaces: string;
    readonly createPr: boolean;
    readonly autoMerge: boolean;
    readonly prBaseBranch: string;
    readonly prHeadBranch: string;
    readonly prTitle: string;
    readonly prBody: string;
    readonly commitMessage: string;
    readonly tagPrefix: string;
    readonly createShortTags: boolean;
    readonly changelogPreset: string;
    readonly debug: boolean;
}
export interface ParsedWorkspaces {
    readonly workspaces: ReadonlyArray<WorkspaceConfig>;
}
export interface ActionOutputs {
    readonly tag: string;
    readonly version: string;
    readonly pr: string;
    readonly all_tags: string;
    readonly changed_workspaces: string;
    readonly bump_type: ActionBumpType;
}
export interface ActionContext {
    readonly inputs: ActionInputs;
    readonly repository: {
        readonly owner: string;
        readonly repo: string;
    };
    readonly sha: string;
    readonly ref: string;
}
//# sourceMappingURL=action.d.ts.map