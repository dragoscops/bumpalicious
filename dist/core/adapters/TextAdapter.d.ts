import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { ProjectInfo, WorkspaceType, Version } from '../../types/index.js';
import { type Result } from '../../types/result.js';
import { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
export declare const WORKSPACE_TYPE: WorkspaceType;
export declare const SUPPORTED_FILES: readonly ["VERSION", "VERSION.txt", "version", "version.txt"];
export declare function detectVersion(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;
export declare function updateVersion(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;
export declare function hasVersionFile(workspacePath: string): Promise<boolean>;
export declare class TextAdapter extends BaseWorkspaceAdapter {
    readonly type: WorkspaceType;
    readonly supportedFiles: ReadonlyArray<string>;
    detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;
    update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;
}
//# sourceMappingURL=TextAdapter.d.ts.map