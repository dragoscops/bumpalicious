"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceTreeBuilder = void 0;
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class WorkspaceTreeBuilder extends Loggable_js_1.Loggable {
    constructor() {
        super();
        this.log.info('WorkspaceTreeBuilder initialized');
    }
    build(workspaces) {
        this.log.debug({ count: workspaces.length }, 'Building workspace tree');
        this.validateInput(workspaces);
        const root = this.identifyRoot(workspaces);
        this.log.debug({ rootPath: root.path, rootName: root.name }, 'Root workspace identified');
        const nodes = this.buildNodes(workspaces);
        this.establishRelationships(nodes);
        const rootNode = this.getRootNode(nodes, root);
        this.validateSingleRoot(nodes);
        this.validateChangePropagation(rootNode);
        const tree = {
            root: this.toImmutableNode(rootNode),
            masterVersion: root.newVersion,
            allWorkspaces: [...workspaces],
        };
        this.log.info({ rootName: root.name, rootVersion: root.newVersion, totalWorkspaces: workspaces.length }, 'Workspace tree built');
        return tree;
    }
    validateInput(workspaces) {
        if (!workspaces || workspaces.length === 0) {
            throw new errors_js_1.WorkspaceValidationError('No workspaces provided');
        }
    }
    identifyRoot(workspaces) {
        let root = workspaces[0];
        let shortestPath = this.normalizePath(root.path);
        for (let i = 1; i < workspaces.length; i++) {
            const workspace = workspaces[i];
            const normalizedPath = this.normalizePath(workspace.path);
            if (normalizedPath.length < shortestPath.length) {
                root = workspace;
                shortestPath = normalizedPath;
            }
        }
        return root;
    }
    buildNodes(workspaces) {
        return workspaces.map((workspace) => ({
            workspace,
            children: [],
            parent: null,
            isRoot: false,
        }));
    }
    establishRelationships(nodes) {
        for (let i = 0; i < nodes.length; i++) {
            const childNode = nodes[i];
            const childPath = this.normalizePath(childNode.workspace.path);
            if (childPath === '') {
                continue;
            }
            const closestParent = this.findClosestParent(nodes, childPath, i);
            if (closestParent) {
                childNode.parent = closestParent;
                closestParent.children.push(childNode);
            }
        }
        this.markRootNodes(nodes);
    }
    findClosestParent(nodes, childPath, childIndex) {
        let closestParent = null;
        let closestParentPath = '';
        for (let j = 0; j < nodes.length; j++) {
            if (childIndex === j)
                continue;
            const potentialParent = nodes[j];
            const parentPath = this.normalizePath(potentialParent.workspace.path);
            if (this.isParentOf(parentPath, childPath)) {
                if (!closestParent || parentPath.length > closestParentPath.length) {
                    closestParent = potentialParent;
                    closestParentPath = parentPath;
                }
            }
        }
        return closestParent;
    }
    isParentOf(parentPath, childPath) {
        return parentPath === '' || childPath.startsWith(`${parentPath}/`);
    }
    markRootNodes(nodes) {
        for (const node of nodes) {
            if (!node.parent) {
                node.isRoot = true;
            }
        }
    }
    getRootNode(nodes, root) {
        const rootNode = nodes.find((node) => node.workspace === root);
        if (!rootNode) {
            throw new errors_js_1.WorkspaceValidationError('Root workspace not found in nodes');
        }
        return rootNode;
    }
    validateSingleRoot(nodes) {
        const roots = nodes.filter((node) => node.parent === null);
        if (roots.length === 0) {
            throw new errors_js_1.WorkspaceValidationError('No root workspace found');
        }
        if (roots.length > 1) {
            const rootPaths = roots.map((node) => node.workspace.path).join(', ');
            throw new errors_js_1.WorkspaceValidationError(`Multiple root workspaces found: ${rootPaths}. Only one root workspace is allowed.`);
        }
    }
    validateChangePropagation(root) {
        const hasChildWithChanges = this.hasDescendantWithChanges(root);
        if (hasChildWithChanges && !root.workspace.hasChanges) {
            const changedChildren = this.findChangedDescendants(root);
            const changedPaths = changedChildren.map((node) => node.workspace.path).join(', ');
            throw new errors_js_1.WorkspaceValidationError(`Child workspaces have changes (${changedPaths}) but root workspace '${root.workspace.path}' has no changes. ` +
                `Root workspace must have changes when children change.`);
        }
    }
    hasDescendantWithChanges(node) {
        for (const child of node.children) {
            if (child.workspace.hasChanges || this.hasDescendantWithChanges(child)) {
                return true;
            }
        }
        return false;
    }
    findChangedDescendants(node) {
        const changed = [];
        for (const child of node.children) {
            if (child.workspace.hasChanges) {
                changed.push(child);
            }
            changed.push(...this.findChangedDescendants(child));
        }
        return changed;
    }
    normalizePath(path) {
        let normalized = path.trim();
        if (normalized === '.' || normalized === './') {
            return '';
        }
        if (normalized.startsWith('./')) {
            normalized = normalized.slice(2);
        }
        if (normalized.endsWith('/') && normalized.length > 1) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }
    toImmutableNode(node) {
        return {
            workspace: node.workspace,
            children: node.children.map((child) => this.toImmutableNode(child)),
            isRoot: node.isRoot,
        };
    }
}
exports.WorkspaceTreeBuilder = WorkspaceTreeBuilder;
//# sourceMappingURL=WorkspaceTreeBuilder.js.map