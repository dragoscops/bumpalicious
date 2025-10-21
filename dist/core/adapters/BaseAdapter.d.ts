import type { ParserConfig } from '../../parsers/FileParser.js';
import type { UpdaterConfig } from '../../parsers/FileUpdater.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
export declare abstract class BaseWorkspaceAdapter {
    abstract readonly type: WorkspaceType;
    abstract readonly supportedFiles: ReadonlyArray<string>;
    abstract detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;
    abstract update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;
    protected parseFile(filePath: string, config: ParserConfig): Promise<Result<ProjectInfo, FileOperationError>>;
    protected updateFile(filePath: string, newVersion: Version, config: UpdaterConfig): Promise<Result<void, FileOperationError>>;
}
//# sourceMappingURL=BaseAdapter.d.ts.map