import type { WorkspaceWithVersion, WorkspaceTree } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';
export declare class WorkspaceTreeBuilder extends Loggable {
    constructor();
    build(workspaces: ReadonlyArray<WorkspaceWithVersion>): WorkspaceTree;
    private validateInput;
    private identifyRoot;
    private buildNodes;
    private establishRelationships;
    private findClosestParent;
    private isParentOf;
    private markRootNodes;
    private getRootNode;
    private validateSingleRoot;
    private validateChangePropagation;
    private hasDescendantWithChanges;
    private findChangedDescendants;
    private normalizePath;
    private toImmutableNode;
}
//# sourceMappingURL=WorkspaceTreeBuilder.d.ts.map