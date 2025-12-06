import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { ProjectInfo, Version, WorkspaceType } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import type { FileOperationError, WorkspaceDetectionError } from '../../utils/errors.js';
export declare class GoAdapter extends BaseWorkspaceAdapter {
    readonly type: WorkspaceType;
    readonly supportedFiles: readonly ["go.mod", "version.go", "VERSION.txt", "version.txt"];
    private readonly FILE_CONFIGS;
    detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;
    update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;
    private findAllConfigFiles;
}
//# sourceMappingURL=GoAdapter.d.ts.map