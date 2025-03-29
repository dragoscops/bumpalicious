/**
 * Workspace management functionality for handling multiple project workspaces
 * @module core/workspaces
 */

import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { detectDenoVersion } from '../detect/deno.js';
import { detectGoVersion } from '../detect/go.js';
import { detectNodeVersion } from '../detect/node.js';
import { detectPythonVersion } from '../detect/python.js';
import { detectRustVersion } from '../detect/rust.js';
import { detectTextVersion } from '../detect/text.js';
import { determineVersionIncreaseType, increaseVersion } from './version.js';
import { updateDenoVersion } from '../update/deno.js';
import { updateGoVersion } from '../update/go.js';
import { updateNodeVersion } from '../update/node.js';
import { updatePythonVersion } from '../update/python.js';
import { updateRustVersion } from '../update/rust.js';
import { updateTextVersion } from '../update/text.js';
import * as logging from '../utils/logging.js';

/**
 * Detect version for a specific workspace
 * 
 * @param {string} workspacePath - Path to workspace
 * @param {string} workspaceType - Type of workspace (node, python, etc.)
 * @returns {Promise<{path: string, type: string, name: string, version: string}>}
 */
const detectWorkspaceVersion = async (workspacePath, workspaceType) => {
  // Change directory to workspace path
  const originalDir = process.cwd();
  process.chdir(workspacePath);
  
  try {
    let name = '';
    let version = '';
    
    // Detect version based on type
    switch (workspaceType.toLowerCase()) {
      case 'node':
        ({ name, version } = await detectNodeVersion());
        break;
      case 'deno':
        ({ name, version } = await detectDenoVersion());
        break;
      case 'go':
        ({ name, version } = await detectGoVersion());
        break;
      case 'python':
        ({ name, version } = await detectPythonVersion());
        break;
      case 'rust':
        ({ name, version } = await detectRustVersion());
        break;
      case 'text':
        ({ name, version } = await detectTextVersion());
        break;
      default:
        // Default to text version if type is unknown
        ({ name, version } = await detectTextVersion());
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
      version
    };
  } finally {
    // Restore original directory
    process.chdir(originalDir);
  }
};

/**
 * Check if a workspace has changed since the last tag
 * 
 * @param {string} workspacePath - Path to workspace
 * @param {string} lastTag - Last git tag
 * @returns {Promise<boolean>} - Whether the workspace has changes
 */
const hasWorkspaceChanges = async (workspacePath, lastTag) => {
  try {
    // If no tag, consider everything changed
    if (!lastTag) {
      return true;
    }
    
    // Check for changes in the workspace directory since last tag
    const { stdout } = await execa('git', [
      'diff',
      lastTag,
      '--name-only',
      '--',
      workspacePath
    ]);
    
    return stdout.trim().length > 0;
  } catch (error) {
    logging.error(`Error checking for changes in workspace ${workspacePath}:`, error);
    // Default to true if we can't determine changes
    return true;
  }
};

/**
 * Parse workspace specifications
 * Format: "path:type,path:type"
 * 
 * @param {string} workspacesSpec - Workspace specification string
 * @returns {Array<{path: string, type: string}>} - Array of workspace configurations
 */
const parseWorkspacesSpec = (workspacesSpec) => {
  if (!workspacesSpec) {
    return [{ path: '.', type: 'text' }];
  }
  
  return workspacesSpec.split(',').map(spec => {
    const [workspacePath, workspaceType] = spec.split(':');
    return {
      path: workspacePath.trim() || '.',
      type: (workspaceType || 'text').trim().toLowerCase()
    };
  });
};

/**
 * Gather information about changed workspaces
 * 
 * @param {Object} options - Options for workspace discovery
 * @param {string} options.workspacesSpec - Workspace specifications
 * @param {string} options.lastTag - Last git tag
 * @returns {Promise<Array<{path: string, type: string, name: string, version: string}>>} - Info about changed workspaces
 */
export const gatherChangedWorkspacesInfo = async ({ workspacesSpec, lastTag }) => {
  const workspaces = parseWorkspacesSpec(workspacesSpec);
  const changedWorkspaces = [];
  
  for (const workspace of workspaces) {
    // Skip if workspace doesn't exist
    if (!await fs.pathExists(workspace.path)) {
      logging.warning(`Workspace path does not exist: ${workspace.path}`);
      continue;
    }
    
    // Check if workspace has changed since last tag
    if (await hasWorkspaceChanges(workspace.path, lastTag)) {
      try {
        // Get workspace info (name and version)
        const workspaceInfo = await detectWorkspaceVersion(workspace.path, workspace.type);
        changedWorkspaces.push(workspaceInfo);
        
        logging.success(`Detected changes in ${logging.formatWorkspace(workspaceInfo)}`);
      } catch (error) {
        logging.error(`Error gathering info for workspace ${workspace.path}:`, error);
      }
    } else {
      logging.info(`No changes detected in workspace: ${workspace.path}`);
    }
  }
  
  return changedWorkspaces;
};

/**
 * Increase versions for workspaces based on commit message
 * 
 * @param {Object} options - Options for version increases
 * @param {Array<Object>} options.workspacesInfo - Info about workspaces
 * @param {string} options.commitMessage - Git commit message
 * @returns {Promise<Array<Object>>} - Updated workspace info with new versions
 */
export const increaseWorkspacesVersions = async ({ workspacesInfo, commitMessage }) => {
  const increaseType = determineVersionIncreaseType(commitMessage);
  
  if (!increaseType) {
    logging.info(`No version increase needed based on commit: ${commitMessage}`);
    return workspacesInfo;
  }
  
  logging.info(`Determined version increase type: ${increaseType} from commit: ${commitMessage}`);
  
  return workspacesInfo.map(workspace => {
    const updatedVersion = increaseVersion(workspace.version, increaseType);
    
    if (updatedVersion !== workspace.version) {
      logging.info(`Increasing ${workspace.name} version ${workspace.version} -> ${updatedVersion} (${increaseType})`);
      return { ...workspace, updatedVersion };
    }
    
    return workspace;
  });
};

/**
 * Update version files in workspaces
 * 
 * @param {Array<Object>} workspacesInfo - Info about workspaces with updated versions
 * @returns {Promise<Array<Object>>} - Updated workspace info
 */
export const updateWorkspacesVersions = async (workspacesInfo) => {
  const originalDir = process.cwd();
  
  for (const workspace of workspacesInfo) {
    // Skip if no update needed
    if (!workspace.updatedVersion || workspace.updatedVersion === workspace.version) {
      continue;
    }
    
    try {
      // Change to workspace directory
      process.chdir(workspace.path);
      
      // Update version based on type
      switch (workspace.type) {
        case 'node':
          await updateNodeVersion(workspace.updatedVersion);
          break;
        case 'deno':
          await updateDenoVersion(workspace.updatedVersion);
          break;
        case 'go':
          await updateGoVersion(workspace.updatedVersion);
          break;
        case 'python':
          await updatePythonVersion(workspace.updatedVersion);
          break;
        case 'rust':
          await updateRustVersion(workspace.updatedVersion);
          break;
        case 'text':
          await updateTextVersion(workspace.updatedVersion);
          break;
        default:
          logging.warning(`Unknown workspace type for update: ${workspace.type}`);
          continue;
      }
      
      logging.success(`Updated ${workspace.name} version to ${workspace.updatedVersion}`);
    } catch (error) {
      logging.error(`Error updating workspace ${workspace.name}:`, error);
    } finally {
      // Restore original directory
      process.chdir(originalDir);
    }
  }
  
  return workspacesInfo;
};