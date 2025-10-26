import type { Version } from './version.js';
export type WorkspaceType = 'node' | 'python' | 'deno' | 'go' | 'rust' | 'zig' | 'text';
export interface WorkspaceConfig {
    readonly path: string;
    readonly type: WorkspaceType;
}
export interface ProjectInfo {
    readonly name: string;
    readonly version: Version;
}
export interface Workspace extends WorkspaceConfig {
    readonly name: string;
    readonly version: Version;
    readonly hasChanges: boolean;
    readonly changedFiles: ReadonlyArray<string>;
}
export interface WorkspaceWithVersion extends Workspace {
    readonly newVersion: Version;
}
export interface WorkspaceNode {
    readonly workspace: WorkspaceWithVersion;
    readonly children: ReadonlyArray<WorkspaceNode>;
    readonly isRoot: boolean;
}
export interface WorkspaceTree {
    readonly root: WorkspaceNode;
    readonly masterVersion: Version;
    readonly allWorkspaces: ReadonlyArray<WorkspaceWithVersion>;
}
export interface WorkspaceDetectionResult {
    readonly found: boolean;
    readonly info?: ProjectInfo;
    readonly filePath?: string;
}
//# sourceMappingURL=workspace.d.ts.map