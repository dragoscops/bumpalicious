import type { GitService } from './GitService.js';
import type { Result } from '../types/result.js';
import type { BumpType, CommitAnalysis, Version } from '../types/version.js';
import type { Workspace, WorkspaceWithVersion } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';
export interface WorkspaceVersionResult {
    readonly workspaces: ReadonlyArray<WorkspaceWithVersion>;
    readonly hasConventionalCommits: boolean;
}
export declare class VersionService extends Loggable {
    private readonly gitService?;
    constructor(gitService?: GitService);
    calculateVersionsForWorkspaces(workspaces: ReadonlyArray<Workspace>, lastTag: string | null, branch: string): Promise<Result<WorkspaceVersionResult, Error>>;
    calculateNewVersion(currentVersion: string, analysis: CommitAnalysis): Version;
    increaseVersion(currentVersion: Version, bumpType: BumpType): Version;
    private calculatePreReleaseVersion;
}
//# sourceMappingURL=VersionService.d.ts.map