import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
export declare class RustAdapter extends BaseWorkspaceAdapter {
    readonly type: WorkspaceType;
    readonly supportedFiles: readonly ["Cargo.toml"];
    detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;
    update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;
}
//# sourceMappingURL=RustAdapter.d.ts.map