import type { GitHubService } from './GitHubService.js';
import type { FileContent, GetFileContentParams, UpdateFileParams, FileUpdateResponse, GitCommit } from '../types/git.js';
import type { Result } from '../types/result.js';
import { GitOperationError } from '../utils/errors.js';
export declare class RepositoryService {
    private readonly github;
    private readonly log;
    constructor(github: GitHubService);
    getFileContent(params: GetFileContentParams): Promise<Result<FileContent, GitOperationError>>;
    updateFile(params: UpdateFileParams): Promise<Result<FileUpdateResponse, GitOperationError>>;
    getCommits(options?: {
        sha?: string;
        path?: string;
        perPage?: number;
        page?: number;
    }): Promise<Result<readonly GitCommit[], GitOperationError>>;
    private fetchFileContent;
    private commitFileUpdate;
    private fetchCommits;
    private isFileResponse;
    private decodeFileContent;
    private mapUpdateResponse;
    private mapCommits;
    private handleNotAFileError;
    private handleError;
}
//# sourceMappingURL=RepositoryService.d.ts.map