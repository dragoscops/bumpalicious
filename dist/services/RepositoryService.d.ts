import type { GitHubService } from './GitHubService.js';
import type { FileContent, GetFileContentParams, UpdateFileParams, FileUpdateResponse, GitCommit } from '../types/git.js';
import type { Result } from '../types/result.js';
import { GitOperationError } from '../utils/errors.js';
export declare class RepositoryService {
    private readonly github;
    constructor(github: GitHubService);
    getFileContent(params: GetFileContentParams): Promise<Result<FileContent, GitOperationError>>;
    updateFile(params: UpdateFileParams): Promise<Result<FileUpdateResponse, GitOperationError>>;
    getCommits(options?: {
        sha?: string;
        path?: string;
        perPage?: number;
        page?: number;
    }): Promise<Result<readonly GitCommit[], GitOperationError>>;
}
//# sourceMappingURL=RepositoryService.d.ts.map