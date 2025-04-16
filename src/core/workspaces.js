/**
 * Workspace management functionality for handling multiple project workspaces
 * @module core/workspaces
 */
import path from 'path';
import * as workspaceDetect from '../workspace/index.js';
import * as git from '../utils/git.js';
import * as logging from '../utils/logging.js';
import * as version from './version.js';

/**
 * @typedef {Object} Workspace
 * @property {string} path - Path to the workspace
 * @property {string} name - Name of the workspace
 * @property {string} type - Type of the workspace (node, python, etc.)
 * @property {string} version - Version of the workspace
 */

/**
 * @typedef {Object} WorkspaceNode
 * @property {Workspace} workspace - The workspace object
 * @property {WorkspaceNode[]} children - Child workspace nodes
 * @property {WorkspaceNode|null} parent - Parent workspace node (null for root)
 */

/**
 * Converts a workspace string to a Workspace object
 *
 * @param {string} workspace
 * @returns {Workspace}
 */
export function fromString(workspace) {
  const splited = workspace.split(':');
  return {
    ...(splited.length > 0 ? {path: splited[0]} : {}),
    ...(splited.length > 1 ? {type: splited[1]} : {}),
    ...(splited.length > 2 ? {name: splited[2]} : {}),
    ...(splited.length > 3 ? {version: splited[3]} : {}),
  };
}

/**
 * Builds a workspace tree structure based on filesystem paths
 * 
 * @param {Workspace[]} workspaces - Array of workspaces
 * @returns {WorkspaceNode[]} - Array of root workspace nodes with children
 */
export function buildWorkspaceTree(workspaces) {
  if (!workspaces || workspaces.length === 0) {
    return [];
  }

  // If there's only one workspace, it's the only root
  if (workspaces.length === 1) {
    return [{
      workspace: workspaces[0],
      children: [],
      parent: null,
    }];
  }

  // Create workspace nodes without parent/child relationships
  const nodes = workspaces.map(workspace => ({
    workspace,
    children: [],
    parent: null,
  }));

  // Normalize all paths to be absolute and with consistent separators
  const normalizedPaths = nodes.map(node => ({
    node,
    normalizedPath: path.resolve(node.workspace.path).replace(/\\/g, '/'),
  }));

  // Find potential parent-child relationships
  for (let i = 0; i < normalizedPaths.length; i++) {
    const { node: nodeA, normalizedPath: pathA } = normalizedPaths[i];
    
    for (let j = 0; j < normalizedPaths.length; j++) {
      if (i === j) continue;
      
      const { node: nodeB, normalizedPath: pathB } = normalizedPaths[j];
      
      // If pathA is contained within pathB, then B is a potential parent of A
      if (pathA.startsWith(`${pathB}/`)) {
        // Check if this is the closest parent (shortest path difference)
        if (!nodeA.parent || 
            pathB.length > nodeA.parent.workspace.path.length) {
          // Remove from previous parent's children if any
          if (nodeA.parent) {
            nodeA.parent.children = nodeA.parent.children.filter(
              child => child !== nodeA
            );
          }
          
          // Set new parent-child relationship
          nodeA.parent = nodeB;
          nodeB.children.push(nodeA);
        }
      }
    }
  }

  // Find the root nodes (nodes without a parent)
  const rootNodes = nodes.filter(node => node.parent === null);
  
  // Return array of root nodes - already sorted by the algorithm
  return rootNodes;
}

/**
 * Find the common base path shared by all paths
 *
 * @param {string[]} paths - Array of normalized paths
 * @returns {string} - Common base path
 */
function findCommonPath(paths) {
  if (!paths || paths.length === 0) return '';
  if (paths.length === 1) return paths[0];
  
  const sortedPaths = [...paths].sort();
  const firstPath = sortedPaths[0];
  const lastPath = sortedPaths[sortedPaths.length - 1];
  
  let commonPrefix = '';
  const minLength = Math.min(firstPath.length, lastPath.length);
  
  for (let i = 0; i < minLength; i++) {
    if (firstPath[i] === lastPath[i]) {
      commonPrefix += firstPath[i];
    } else {
      break;
    }
  }
  
  // Get the path up to the last directory separator
  const lastSeparatorIndex = commonPrefix.lastIndexOf('/');
  if (lastSeparatorIndex !== -1) {
    return commonPrefix.substring(0, lastSeparatorIndex);
  }
  
  return commonPrefix;
}

/**
 * Detect version for a specific workspace
 *
 * @param {string} workspacePath - Path to workspace
 * @param {string} workspaceType - Type of workspace (node, python, etc.)
 * @returns {Promise<Workspace>}
 */
export async function enrichWorkspace(workspacePath, workspaceType) {
  // Change directory to workspace path
  const originalDir = process.cwd();
  process.chdir(workspacePath);

  try {
    let name = '';
    let version = '';

    if (workspaceDetect[workspaceType]) {
      ({name, version} = await workspaceDetect[workspaceType].detect(workspacePath));
    } else {
      // Default to text version if type is unknown
      ({name, version} = await workspaceDetect.text.detect(workspacePath));
      logging.warning(`Unknown workspace type: ${workspaceType}, defaulting to text`);
    }

    // Use directory name as fallback for project name
    if (!name) {
      name = path.basename(workspacePath);
    }

    // Use '0.1.0' as fallback for version
    if (!version) {
      version = '0.1.0';
      logging.warning(`Could not detect version for workspace ${name}, using default 0.1.0`);
    }

    return {
      path: workspacePath,
      type: workspaceType.toLowerCase(),
      name,
      version,
    };
  } finally {
    // Restore original directory
    process.chdir(originalDir);
  }
}

/**
 * Enrich workspaces
 *
 * @param {Workspace[]} workspaces - Array of workspace specifications
 * @returns {Promise<Workspace[]>}
 */
export const enrichWorkspaces = async (workspaces) => {
  const enrichedWorkspaces = [];

  for (const workspace of workspaces) {
    const enrichedWorkspace = await enrichWorkspace(workspace.path, workspace.type);
    enrichedWorkspaces.push(enrichedWorkspace);
  }

  return enrichedWorkspaces;
};

/**
 * Enrich workspaces that have changed since the last tag
 *
 * @param {Workspace[]} workspaces - Array of workspaces to check
 * @param {string} lastTag - Last git tag
 * @returns {Promise<Workspace[]>}
 */
export const enrichChangedWorkspaces = async (workspaces, lastTag) => {
  const enrichedWorkspaces = [];

  for (const workspace of workspaces) {
    const changedFiles = await git.getChangedFiles(workspace.path, lastTag);
    if (changedFiles.length > 0) {
      const enrichedWorkspace = await enrichWorkspace(workspace.path, workspace.type);
      logging.info(`Workspace '${workspace.path}' has changed since last tag: ${lastTag}`);
      enrichedWorkspaces.push(enrichedWorkspace);
    }
  }

  if (enrichedWorkspaces.length === 0) {
    logging.warning('No changed workspaces found', JSON.stringify(workspaces));
  }

  return enrichedWorkspaces;
};

/**
 * Increase versions for workspaces based on commit message
 *
 * @param {Object} options - Options for version increases
 * @param {Workspace[]} options.workspaces - Info about workspaces
 * @param {string} options.commitMessage - Git commit message
 * @returns {Promise<Workspace[]>} - Updated workspace info with new versions
 */
export const increaseWorkspacesVersions = async ({workspaces, commitMessage}) => {
  const increaseType = version.determineVersionIncreaseType(commitMessage);

  if (!increaseType) {
    logging.warning(`No version increase needed based on commit message: ${commitMessage}`);
    return [];
  }

  logging.info(`Determined version increase type: ${increaseType} from commit: ${commitMessage}`);

  const preReleaseIdentifier = version.determineVersionPreReleaseIdentifier(commitMessage);
  if (preReleaseIdentifier) {
    logging.info(`Pre-release identifier found in commit message: ${preReleaseIdentifier}`);
  }

  return workspaces.map((workspace) => {
    const updatedVersion = version.increaseVersion(workspace.version, {
      type: increaseType,
      identifier: preReleaseIdentifier,
    });

    if (updatedVersion !== workspace.version) {
      logging.info(`Increasing ${workspace.name} version ${workspace.version} -> ${updatedVersion} (${increaseType})`);
      return {...workspace, version: updatedVersion};
    }

    return workspace;
  });
};

// /**
//  * Update version files in workspaces
//  *
//  * @param {Array<Object>} workspacesInfo - Info about workspaces with updated versions
//  * @returns {Promise<Array<Object>>} - Updated workspace info
//  */
// export const updateWorkspacesVersions = async (workspacesInfo) => {
//   const originalDir = process.cwd();

//   for (const workspace of workspacesInfo) {
//     // Skip if no update needed
//     if (
//       !workspace.updatedVersion ||
//       workspace.updatedVersion === workspace.version
//     ) {
//       continue;
//     }

//     try {
//       // Change to workspace directory
//       process.chdir(workspace.path);

//       // Update version based on type
//       switch (workspace.type) {
//         case "node":
//           await updateNodeVersion(workspace.updatedVersion);
//           break;
//         case "deno":
//           await updateDenoVersion(workspace.updatedVersion);
//           break;
//         case "go":
//           await updateGoVersion(workspace.updatedVersion);
//           break;
//         case "python":
//           await updatePythonVersion(workspace.updatedVersion);
//           break;
//         case "rust":
//           await updateRustVersion(workspace.updatedVersion);
//           break;
//         case "text":
//           await updateTextVersion(workspace.updatedVersion);
//           break;
//         default:
//           logging.warning(
//             `Unknown workspace type for update: ${workspace.type}`,
//           );
//           continue;
//       }

//       logging.notice(
//         `Updated ${workspace.name} version to ${workspace.updatedVersion}`,
//       );
//     } catch (error) {
//       logging.error(`Error updating workspace ${workspace.name}:`, error);
//     } finally {
//       // Restore original directory
//       process.chdir(originalDir);
//     }
//   }

//   return workspacesInfo;
// };
