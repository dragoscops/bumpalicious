import type { GitService } from './GitService.js';
import type { Result } from '../types/result.js';
import type { Workspace, WorkspaceConfig } from '../types/workspace.js';
import { GitOperationError, WorkspaceDetectionError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
export declare class WorkspaceService extends Loggable {
    private readonly gitService;
    constructor(gitService: GitService);
    enrichWorkspaces(configs: ReadonlyArray<WorkspaceConfig>): Promise<Result<ReadonlyArray<Workspace>, WorkspaceDetectionError>>;
    detectChangedWorkspaces(workspaces: ReadonlyArray<Workspace>, lastTag: string | null, branch?: string): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>>;
    private enrichSingleWorkspace;
    private markAllAsChanged;
    private matchFilesToWorkspaces;
    private getRelativePath;
    private filterFilesForWorkspace;
    private resolveAbsolutePath;
}
//# sourceMappingURL=WorkspaceService.d.ts.map