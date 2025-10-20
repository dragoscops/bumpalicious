import { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { WorkspaceType, ProjectInfo, Version } from '../../types/index.js';
import type { Result } from '../../types/result.js';
import type { WorkspaceDetectionError, FileOperationError } from '../../utils/errors.js';
export declare class DenoAdapter extends BaseWorkspaceAdapter {
    readonly type: WorkspaceType;
    readonly supportedFiles: readonly ["deno.jsonc", "deno.json", "jsr.json"];
    private readonly FILE_CONFIGS;
    private jsoncParser;
    private getJsoncParser;
    detect(workspacePath: string): Promise<Result<ProjectInfo, WorkspaceDetectionError>>;
    update(workspacePath: string, newVersion: Version): Promise<Result<void, FileOperationError>>;
    private parseDenoFile;
    private updateDenoFile;
    private findAllConfigFiles;
}
//# sourceMappingURL=DenoAdapter.d.ts.map