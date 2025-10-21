/**
 * Workspace Tree Builder
 *
 * Service for building and validating hierarchical workspace tree structures.
 * Organizes flat workspace lists into parent-child relationships based on paths.
 *
 * Usage:
 * ```typescript
 * const builder = new WorkspaceTreeBuilder();
 * const tree = builder.build(workspaces);
 * ```
 */

import { Loggable } from '../Loggable.js';
import type { WorkspaceWithVersion, WorkspaceNode, WorkspaceTree } from '../types/workspace.js';
import { WorkspaceValidationError } from '../utils/errors.js';

/**
 * Internal workspace node with mutable children array for tree building
 */
interface MutableWorkspaceNode {
  readonly workspace: WorkspaceWithVersion;
  children: MutableWorkspaceNode[];
  parent: MutableWorkspaceNode | null;
  readonly isRoot: boolean;
}

/**
 * Workspace Tree Builder
 *
 * Builds hierarchical tree structures from flat workspace lists:
 * - Identifies root workspace (shortest path)
 * - Validates single root exists
 * - Builds recursive parent-child relationships
 * - Validates change propagation (children → root)
 */
export class WorkspaceTreeBuilder extends Loggable {
  /**
   * Create a new Workspace Tree Builder instance
   */
  constructor() {
    super();
    this.log.info('WorkspaceTreeBuilder initialized');
  }

  /**
   * Build workspace tree from flat workspace list
   *
   * @param workspaces - Flat list of workspaces with versions
   * @returns Workspace tree with validated structure
   * @throws {WorkspaceValidationError} If validation fails
   *
   * @example
   * ```typescript
   * const builder = new WorkspaceTreeBuilder();
   * const tree = builder.build([
   *   { path: '.', name: 'root', version: '1.0.0', ... },
   *   { path: 'packages/api', name: 'api', version: '1.0.0', ... }
   * ]);
   * ```
   */
  build(workspaces: ReadonlyArray<WorkspaceWithVersion>): WorkspaceTree {
    this.log.debug(
      {
        count: workspaces.length,
        workspaces: workspaces.map((w) => ({ name: w.name, path: w.path, hasChanges: w.hasChanges })),
      },
      'Building workspace tree',
    );

    // Validate input
    if (!workspaces || workspaces.length === 0) {
      throw new WorkspaceValidationError('No workspaces provided');
    }

    // Identify root workspace (shortest path)
    const root = this.identifyRoot(workspaces);
    this.log.debug(
      {
        rootPath: root.path,
        rootName: root.name,
        rootVersion: root.version,
        rootHasChanges: root.hasChanges,
      },
      'Root workspace identified',
    );

    // Build tree structure
    this.log.debug('Creating workspace nodes');
    const nodes = this.buildNodes(workspaces);

    this.log.debug(
      {
        nodeCount: nodes.length,
      },
      'Establishing parent-child relationships',
    );
    this.establishRelationships(nodes);

    // Find root node
    const rootNode = nodes.find((node) => node.workspace === root);
    if (!rootNode) {
      throw new WorkspaceValidationError('Root workspace not found in nodes');
    }

    this.log.debug('Validating single root constraint');
    // Validate single root
    this.validateSingleRoot(nodes);

    this.log.debug('Validating change propagation rule');
    // Validate change propagation
    this.validateChangePropagation(rootNode);

    // Convert to immutable tree
    const tree: WorkspaceTree = {
      root: this.toImmutableNode(rootNode),
      masterVersion: root.newVersion,
      allWorkspaces: [...workspaces],
    };

    this.log.info(
      {
        rootName: root.name,
        rootVersion: root.newVersion,
        totalWorkspaces: workspaces.length,
        childrenCount: rootNode.children.length,
      },
      'Workspace tree built successfully',
    );

    return tree;
  }

  /**
   * Identify root workspace (shortest normalized path)
   *
   * Root is defined as the workspace with the shortest path.
   * Paths are normalized to handle '.' and './' consistently.
   *
   * @param workspaces - List of workspaces
   * @returns Root workspace
   */
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

  /**
   * Normalize path for comparison
   *
   * - Converts '.' and './' to empty string (root)
   * - Removes trailing slashes
   * - Handles relative paths consistently
   *
   * @param path - Path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    let normalized = path.trim();

    // Root directory cases
    if (normalized === '.' || normalized === './') {
      return '';
    }

    // Remove leading './'
    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    // Remove trailing slash
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Create initial workspace nodes
   *
   * @param workspaces - List of workspaces
   * @returns Array of mutable nodes
   */
  private buildNodes(workspaces: ReadonlyArray<WorkspaceWithVersion>): MutableWorkspaceNode[] {
    return workspaces.map((workspace) => ({
      workspace,
      children: [],
      parent: null,
      isRoot: false,
    }));
  }

  /**
   * Establish parent-child relationships between nodes
   *
   * Algorithm:
   * 1. For each node, find potential parents
   * 2. Parent must have path that is a prefix of child's path
   * 3. Choose the closest parent (longest matching prefix)
   *
   * @param nodes - Array of workspace nodes
   */
  private establishRelationships(nodes: MutableWorkspaceNode[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const childNode = nodes[i];
      const childPath = this.normalizePath(childNode.workspace.path);

      // Skip if already processed or root
      if (childPath === '') {
        continue;
      }

      let closestParent: MutableWorkspaceNode | null = null;
      let closestParentPath = '';

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;

        const potentialParent = nodes[j];
        const parentPath = this.normalizePath(potentialParent.workspace.path);

        // Check if this node is a child of potentialParent
        // Child path must start with parent path followed by '/'
        const isChild = parentPath === '' ? true : childPath.startsWith(`${parentPath}/`);

        if (isChild) {
          // Select the closest parent (longest matching prefix)
          if (!closestParent || parentPath.length > closestParentPath.length) {
            closestParent = potentialParent;
            closestParentPath = parentPath;
          }
        }
      }

      // Establish relationship if parent found
      if (closestParent) {
        childNode.parent = closestParent;
        closestParent.children.push(childNode);
      }
    }

    // Mark root nodes
    for (const node of nodes) {
      if (!node.parent) {
        (node as { isRoot: boolean }).isRoot = true;
      }
    }
  }

  /**
   * Validate that only one root workspace exists
   *
   * @param nodes - Array of workspace nodes
   * @throws {WorkspaceValidationError} If multiple roots found
   */
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

  /**
   * Validate change propagation rule
   *
   * Rule: If any child workspace has changes, the root workspace must also have changes.
   * This ensures that version bumps propagate up the tree.
   *
   * @param root - Root workspace node
   * @throws {WorkspaceValidationError} If rule violated
   */
  private validateChangePropagation(root: MutableWorkspaceNode): void {
    // Check if any child has changes
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

  /**
   * Check if node has any descendant with changes
   *
   * @param node - Node to check
   * @returns True if any descendant has changes
   */
  private hasDescendantWithChanges(node: MutableWorkspaceNode): boolean {
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

  /**
   * Find all descendants with changes
   *
   * @param node - Node to search
   * @returns Array of nodes with changes
   */
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

  /**
   * Convert mutable node to immutable WorkspaceNode
   *
   * @param node - Mutable node
   * @returns Immutable workspace node
   */
  private toImmutableNode(node: MutableWorkspaceNode): WorkspaceNode {
    return {
      workspace: node.workspace,
      children: node.children.map((child) => this.toImmutableNode(child)),
      isRoot: node.isRoot,
    };
  }
}
