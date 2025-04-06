/**
 * Workspace management functionality for handling multiple project workspaces
 * @module core/workspaces
 */

import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';
import * as workspace from '../workspace/index.js';
import * as logging from '../utils/logging.js';
import {getChangedFiles} from '../utils/git.js';

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
 * Detect version for a specific workspace
 *
 * @param {string} workspacePath - Path to workspace
 * @param {string} workspaceType - Type of workspace (node, python, etc.)
 * @returns {Promise<Workspace>}
 */
export const enrichWorkspace = async (workspacePath, workspaceType) => {
  // Change directory to workspace path
  const originalDir = process.cwd();
  process.chdir(workspacePath);

  try {
    let name = '';
    let version = '';

    if (workspace[workspaceType]) {
      ({name, version} = await workspace[workspaceType].detect());
    } else {
      // Default to text version if type is unknown
      ({name, version} = await detectTextVersion());
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
};

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
    const changedFiles = await getChangedFiles(workspace.path, lastTag);
    if (changedFiles.length > 0) {
      const enrichedWorkspace = await enrichWorkspace(workspace.path, workspace.type);
      enrichedWorkspaces.push(enrichedWorkspace);
    }
  }

  return enrichedWorkspaces;
};

// /**
//  * Check if a workspace has changed since the last tag
//  *
//  * @param {string} workspacePath - Path to workspace
//  * @param {string} lastTag - Last git tag
//  * @returns {Promise<boolean>} - Whether the workspace has changes
//  */
// const hasWorkspaceChanges = async (workspacePath, lastTag) => {
//   try {
//     // If no tag, consider everything changed
//     if (!lastTag) {
//       return true;
//     }

//     // Check for changes in the workspace directory since last tag
//     const { stdout } = await execa("git", [
//       "diff",
//       lastTag,
//       "--name-only",
//       "--",
//       workspacePath,
//     ]);

//     return stdout.trim().length > 0;
//   } catch (error) {
//     logging.error(
//       `Error checking for changes in workspace ${workspacePath}:`,
//       error,
//     );
//     // Default to true if we can't determine changes
//     return true;
//   }
// };

// /**
//  * Parse workspace specifications
//  * Format: "path:type,path:type"
//  *
//  * @param {string} workspacesSpec - Workspace specification string
//  * @returns {Array<{path: string, type: string}>} - Array of workspace configurations
//  */
// const parseWorkspacesSpec = (workspacesSpec) => {
//   if (!workspacesSpec) {
//     return [{ path: ".", type: "text" }];
//   }

//   return workspacesSpec.split(",").map((spec) => {
//     const [workspacePath, workspaceType] = spec.split(":");
//     return {
//       path: workspacePath.trim() || ".",
//       type: (workspaceType || "text").trim().toLowerCase(),
//     };
//   });
// };

// /**
//  * Increase versions for workspaces based on commit message
//  *
//  * @param {Object} options - Options for version increases
//  * @param {Array<Object>} options.workspacesInfo - Info about workspaces
//  * @param {string} options.commitMessage - Git commit message
//  * @returns {Promise<Array<Object>>} - Updated workspace info with new versions
//  */
// export const increaseWorkspacesVersions = async ({
//   workspacesInfo,
//   commitMessage,
// }) => {
//   const increaseType = determineVersionIncreaseType(commitMessage);

//   if (!increaseType) {
//     logging.info(
//       `No version increase needed based on commit: ${commitMessage}`,
//     );
//     return workspacesInfo;
//   }

//   logging.info(
//     `Determined version increase type: ${increaseType} from commit: ${commitMessage}`,
//   );

//   return workspacesInfo.map((workspace) => {
//     const updatedVersion = increaseVersion(workspace.version, increaseType);

//     if (updatedVersion !== workspace.version) {
//       logging.info(
//         `Increasing ${workspace.name} version ${workspace.version} -> ${updatedVersion} (${increaseType})`,
//       );
//       return { ...workspace, updatedVersion };
//     }

//     return workspace;
//   });
// };

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

//       logging.success(
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
