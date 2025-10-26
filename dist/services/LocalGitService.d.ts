import type { Result } from '../types/result.js';
import type { WorkspaceTree } from '../types/workspace.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
export declare class LocalGitService extends Loggable {
    constructor();
    configureGit(): Promise<void>;
    createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>>;
    createVersionBranch(tree: WorkspaceTree, branchPrefix: string): Promise<Result<string, GitOperationError>>;
    private ensureUserName;
    private ensureUserEmail;
    private checkGitConfig;
    private stageChanges;
    private createCommit;
    private createAndCheckoutBranch;
    private pushBranch;
    private getCommitSha;
    private getCurrentBranch;
    private captureGitOutput;
    private buildCommitMessage;
    private generateBranchName;
    private handleError;
}
//# sourceMappingURL=LocalGitService.d.ts.map