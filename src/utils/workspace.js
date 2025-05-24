import path from 'path';

import * as logging from './logging.js';

/**
 * @typedef {Object} Workspace
 * @property {string} path - Path to the workspace
 * @property {string} name - Name of the workspace
 * @property {string} type - Type of the workspace (node, python, etc.)
 * @property {string} version - Version of the workspace
 */

/**
 * Converts a workspace string to a Workspace object
 *
 * @param {string} workspace
 * @returns {Workspace}
 */
export function stringToWorkspace(workspace) {
  const splited = workspace.split(':');
  return {
    ...(splited.length > 1 ? {path: path.resolve(splited[0])} : {}),
    ...(splited.length > 1 ? {type: splited[1]} : {}),
    ...(splited.length > 2 ? {name: splited[2]} : {}),
    ...(splited.length > 3 ? {version: splited[3]} : {}),
  };
}

/**
 * @typedef {Object} WorkspaceNode
 * @property {Workspace} workspace - The workspace object
 * @property {WorkspaceNode[]} children - Child workspace nodes
 * @property {WorkspaceNode|null} parent - Parent workspace node (null for root)
 */

/**
 * Builds a workspace tree structure based on filesystem paths
 *
 * @param {Workspace[]} workspaces - Array of workspaces
 * @returns {WorkspaceNode[]} - Array of root workspace nodes with children
 */
export function buildUpdatedWorkspacesTrees(workspaces) {
  if (!workspaces || workspaces.length === 0) {
    return [];
  }

  // If there's only one workspace, it's the only root
  if (workspaces.length === 1) {
    return [
      {
        workspace: workspaces[0],
        children: [],
        parent: null,
      },
    ];
  }

  // Create workspace nodes without parent/child relationships
  const nodes = workspaces.map((workspace) => ({
    workspace,
    children: [],
    parent: null,
  }));

  // Find potential parent-child relationships
  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    const pathA = nodeA.workspace.path; // Path is already normalized

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;

      const nodeB = nodes[j];
      const pathB = nodeB.workspace.path; // Path is already normalized

      // If pathA is contained within pathB, then B is a potential parent of A
      if (pathA.startsWith(`${pathB}/`)) {
        // Check if this is the closest parent (shortest path difference)
        if (!nodeA.parent || pathB.length > nodeA.parent.workspace.path.length) {
          // Remove from previous parent's children if any
          if (nodeA.parent) {
            nodeA.parent.children = nodeA.parent.children.filter((child) => child !== nodeA);
          }

          // Set new parent-child relationship
          nodeA.parent = nodeB;
          nodeB.children.push(nodeA);
        }
      }
    }
  }

  // Find the root nodes (nodes without a parent)
  const rootNodes = nodes.filter((node) => node.parent === null);

  // Return array of root nodes - already sorted by the algorithm
  return rootNodes;
}
