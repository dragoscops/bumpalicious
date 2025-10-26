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
        this.log.debug({
            count: workspaces.length,
            workspaces: workspaces.map((w) => ({ name: w.name, path: w.path, hasChanges: w.hasChanges })),
        }, 'Building workspace tree');
        if (!workspaces || workspaces.length === 0) {
            throw new errors_js_1.WorkspaceValidationError('No workspaces provided');
        }
        const root = this.identifyRoot(workspaces);
        this.log.debug({
            rootPath: root.path,
            rootName: root.name,
            rootVersion: root.version,
            rootHasChanges: root.hasChanges,
        }, 'Root workspace identified');
        this.log.debug('Creating workspace nodes');
        const nodes = this.buildNodes(workspaces);
        this.log.debug({
            nodeCount: nodes.length,
        }, 'Establishing parent-child relationships');
        this.establishRelationships(nodes);
        const rootNode = nodes.find((node) => node.workspace === root);
        if (!rootNode) {
            throw new errors_js_1.WorkspaceValidationError('Root workspace not found in nodes');
        }
        this.log.debug('Validating single root constraint');
        this.validateSingleRoot(nodes);
        this.log.debug('Validating change propagation rule');
        this.validateChangePropagation(rootNode);
        const tree = {
            root: this.toImmutableNode(rootNode),
            masterVersion: root.newVersion,
            allWorkspaces: [...workspaces],
        };
        this.log.info({
            rootName: root.name,
            rootVersion: root.newVersion,
            totalWorkspaces: workspaces.length,
            childrenCount: rootNode.children.length,
        }, 'Workspace tree built successfully');
        return tree;
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
            let closestParent = null;
            let closestParentPath = '';
            for (let j = 0; j < nodes.length; j++) {
                if (i === j)
                    continue;
                const potentialParent = nodes[j];
                const parentPath = this.normalizePath(potentialParent.workspace.path);
                const isChild = parentPath === '' ? true : childPath.startsWith(`${parentPath}/`);
                if (isChild) {
                    if (!closestParent || parentPath.length > closestParentPath.length) {
                        closestParent = potentialParent;
                        closestParentPath = parentPath;
                    }
                }
            }
            if (closestParent) {
                childNode.parent = closestParent;
                closestParent.children.push(childNode);
            }
        }
        for (const node of nodes) {
            if (!node.parent) {
                node.isRoot = true;
            }
        }
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
            if (child.workspace.hasChanges) {
                return true;
            }
            if (this.hasDescendantWithChanges(child)) {
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