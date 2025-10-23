import type { WorkspaceWithVersion, WorkspaceTree } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';
export declare class WorkspaceTreeBuilder extends Loggable {
    constructor();
    build(workspaces: ReadonlyArray<WorkspaceWithVersion>): WorkspaceTree;
    private identifyRoot;
    private normalizePath;
    private buildNodes;
    private establishRelationships;
    private validateSingleRoot;
    private validateChangePropagation;
    private hasDescendantWithChanges;
    private findChangedDescendants;
    private toImmutableNode;
}
//# sourceMappingURL=WorkspaceTreeBuilder.d.ts.map