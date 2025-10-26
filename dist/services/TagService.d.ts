import type { GitService } from './GitService.js';
import type { Result } from '../types/result.js';
import type { Version } from '../types/version.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
export interface TagOptions {
    readonly shortTag?: boolean;
    readonly tagPrefix?: string;
}
export declare class TagService extends Loggable {
    private readonly gitService;
    constructor(gitService: GitService);
    createVersionTags(version: Version, commitSha: string, options?: TagOptions): Promise<Result<string[], GitOperationError>>;
    createVersionTagsForBranch(version: Version, branch: string, options?: TagOptions): Promise<Result<string[], GitOperationError>>;
    private createShortTag;
}
//# sourceMappingURL=TagService.d.ts.map