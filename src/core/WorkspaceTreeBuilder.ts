/** Workspace tree builder for hierarchical structure creation and validation */

import type { WorkspaceWithVersion, WorkspaceNode, WorkspaceTree } from '../types/workspace.js';
import { WorkspaceValidationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

interface MutableWorkspaceNode {
  readonly workspace: WorkspaceWithVersion;
  children: MutableWorkspaceNode[];
  parent: MutableWorkspaceNode | null;
  readonly isRoot: boolean;
}

/** Workspace tree builder for hierarchical structure creation and validation */
export class WorkspaceTreeBuilder extends Loggable {
  constructor() {
    super();
    this.log.info('WorkspaceTreeBuilder initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Build workspace tree from flat workspace list */
  build(workspaces: ReadonlyArray<WorkspaceWithVersion>): WorkspaceTree {
    this.log.debug({ count: workspaces.length }, 'Building workspace tree');

    this.validateInput(workspaces);

    const root = this.identifyRoot(workspaces);
    this.log.debug({ rootPath: root.path, rootName: root.name }, 'Root workspace identified');

    const nodes = this.buildNodes(workspaces);
    this.establishRelationships(nodes);

    const rootNode = this.getRootNode(nodes, root);

    this.validateSingleRoot(nodes);
    this.validateChangePropagation(rootNode);

    const tree: WorkspaceTree = {
      root: this.toImmutableNode(rootNode),
      masterVersion: root.newVersion,
      allWorkspaces: [...workspaces],
    };

    this.log.info(
      { rootName: root.name, rootVersion: root.newVersion, totalWorkspaces: workspaces.length },
      'Workspace tree built',
    );

    return tree;
  }

  // ====================
  // Tree Construction
  // ====================

  /** Validate input workspaces */
  private validateInput(workspaces: ReadonlyArray<WorkspaceWithVersion>): void {
    if (!workspaces || workspaces.length === 0) {
      throw new WorkspaceValidationError('No workspaces provided');
    }
  }

  /** Identify root workspace by shortest path */
  private identifyRoot(workspaces: ReadonlyArray<WorkspaceWithVersion>): WorkspaceWithVersion {
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

  /** Create initial workspace nodes */
  private buildNodes(workspaces: ReadonlyArray<WorkspaceWithVersion>): MutableWorkspaceNode[] {
    return workspaces.map((workspace) => ({
      workspace,
      children: [],
      parent: null,
      isRoot: false,
    }));
  }

  /** Establish parent-child relationships between nodes */
  private establishRelationships(nodes: MutableWorkspaceNode[]): void {
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

  /** Find closest parent for a child node */
  private findClosestParent(
    nodes: MutableWorkspaceNode[],
    childPath: string,
    childIndex: number,
  ): MutableWorkspaceNode | null {
    let closestParent: MutableWorkspaceNode | null = null;
    let closestParentPath = '';

    for (let j = 0; j < nodes.length; j++) {
      if (childIndex === j) continue;

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

  /** Check if parent path contains child path */
  private isParentOf(parentPath: string, childPath: string): boolean {
    return parentPath === '' || childPath.startsWith(`${parentPath}/`);
  }

  /** Mark nodes without parents as root nodes */
  private markRootNodes(nodes: MutableWorkspaceNode[]): void {
    for (const node of nodes) {
      if (!node.parent) {
        (node as { isRoot: boolean }).isRoot = true;
      }
    }
  }

  /** Get root node from nodes list */
  private getRootNode(nodes: MutableWorkspaceNode[], root: WorkspaceWithVersion): MutableWorkspaceNode {
    const rootNode = nodes.find((node) => node.workspace === root);
    if (!rootNode) {
      throw new WorkspaceValidationError('Root workspace not found in nodes');
    }
    return rootNode;
  }

  // ====================
  // Validation
  // ====================

  /** Validate that only one root workspace exists */
  private validateSingleRoot(nodes: MutableWorkspaceNode[]): void {
    const roots = nodes.filter((node) => node.parent === null);

    if (roots.length === 0) {
      throw new WorkspaceValidationError('No root workspace found');
    }

    if (roots.length > 1) {
      const rootPaths = roots.map((node) => node.workspace.path).join(', ');
      throw new WorkspaceValidationError(
        `Multiple root workspaces found: ${rootPaths}. Only one root workspace is allowed.`,
      );
    }
  }

  /** Validate change propagation rule */
  private validateChangePropagation(root: MutableWorkspaceNode): void {
    const hasChildWithChanges = this.hasDescendantWithChanges(root);

    if (hasChildWithChanges && !root.workspace.hasChanges) {
      const changedChildren = this.findChangedDescendants(root);
      const changedPaths = changedChildren.map((node) => node.workspace.path).join(', ');

      throw new WorkspaceValidationError(
        `Child workspaces have changes (${changedPaths}) but root workspace '${root.workspace.path}' has no changes. ` +
          `Root workspace must have changes when children change.`,
      );
    }
  }

  /** Check if node has any descendant with changes */
  private hasDescendantWithChanges(node: MutableWorkspaceNode): boolean {
    for (const child of node.children) {
      if (child.workspace.hasChanges || this.hasDescendantWithChanges(child)) {
        return true;
      }
    }
    return false;
  }

  /** Find all descendants with changes */
  private findChangedDescendants(node: MutableWorkspaceNode): MutableWorkspaceNode[] {
    const changed: MutableWorkspaceNode[] = [];

    for (const child of node.children) {
      if (child.workspace.hasChanges) {
        changed.push(child);
      }
      changed.push(...this.findChangedDescendants(child));
    }

    return changed;
  }

  // ====================
  // Helpers
  // ====================

  /** Normalize path for comparison */
  private normalizePath(path: string): string {
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

  /** Convert mutable node to immutable WorkspaceNode */
  private toImmutableNode(node: MutableWorkspaceNode): WorkspaceNode {
    return {
      workspace: node.workspace,
      children: node.children.map((child) => this.toImmutableNode(child)),
      isRoot: node.isRoot,
    };
  }
}
