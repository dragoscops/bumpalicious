/**
 * Workspace management functionality for handling multiple project workspaces
 * @module core/workspaces
 */
import path from 'path';
import * as workspaceDetect from '../workspace/index.js';
import * as git from '../utils/git.js';
import * as github from '../utils/github.js';
import * as logging from '../utils/logging.js';
import * as version from './version.js';

/**
 * @typedef {import('../utils/github.js').ActionOptions} ActionOptions
 */

/**
 * @typedef {import('../utils/workspace.js').WorkspaceNode} WorkspaceNode
 */

/**
 * @typedef {import('../utils/workspace.js').Workspace} Workspace
 */

/**
 * @param {string} commitMessage - Git commit message
 * @param {string} lastTag - Last git tag
 * @param {ActionOptions} options - Options for the action
 * @returns {Promise<Workspace[]>}
 */
export async function updateVersionsForChangedWorkspaces(commitMessage, lastTag, options) {
  // Enrich workspaces with additional info
  const changedWorkspaces = await enrichChangedWorkspaces(options.workspaces, lastTag);
  // If no changed workspaces, exit early
  if (changedWorkspaces.length === 0) {
    return;
  }

  // Increase versions based on commit message
  const updatedWorkspaces = await increaseVersionForWorkspaces({
    workspaces: changedWorkspaces,
    commitMessage,
  });
  // If no version updates needed, exit early
  if (updatedWorkspaces.length === 0) {
    return [];
  }

  // Update version files in workspaces
  await updateVersionsForWorkspaces(updatedWorkspaces);

  return updatedWorkspaces;
}

/**
 * Enrich workspaces that have changed since the last tag
 *
 * @param {Workspace[]} workspaces - Array of workspaces to check
 * @param {string} lastTag - Last git tag
 * @returns {Promise<Workspace[]>}
 */
export async function enrichChangedWorkspaces(workspaces, lastTag) {
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
  const originalDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
  process.chdir(originalDir);

  workspacePath = path.resolve(workspacePath);
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
 * Increase versions for workspaces based on commit message
 *
 * @param {Object} options - Options for version increases
 * @param {Workspace[]} options.workspaces - Info about workspaces
 * @param {string} options.commitMessage - Git commit message
 * @returns {Promise<Workspace[]>} - Updated workspace info with new versions
 */
export async function increaseVersionForWorkspaces({workspaces, commitMessage}) {
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
}

/**
 * Update version files in workspaces
 *
 * @param {Workspace[]} workspaces - Info about workspaces with new versions
 * @returns {Promise<Workspace[]>} - Updated workspace info
 */
export async function updateVersionsForWorkspaces(workspaces) {
  // Use GitHub workspace path if running in GitHub Actions, otherwise use current directory
  const originalDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const updatedWorkspaces = [];

  for (const workspace of workspaces) {
    // Skip if no version specified
    if (!workspace.version) {
      logging.warning(`Skipping workspace ${workspace.name || workspace.path}: no version specified`);
      continue;
    }

    try {
      // Change to workspace directory
      process.chdir(originalDir);
      process.chdir(path.resolve(workspace.path));
      logging.info(`Updating ${workspace.name || workspace.path} version to ${workspace.version}`);

      if (workspaceDetect[workspace.type]) {
        await workspaceDetect[workspace.type].updateVersion({
          projectPath: workspace.path,
          newVersion: workspace.version,
        });
      } else {
        await workspaceDetect.text.updateVersion({projectPath: workspace.path, newVersion: workspace.version});
      }
      updatedWorkspaces.push(workspace);
      logging.notice(`Updated ${workspace.name} version to ${workspace.version}`);
    } catch (error) {
      logging.error(`Error updating workspace ${workspace.name || workspace.path}:`, error);
    } finally {
      // Restore original directory
      process.chdir(originalDir);
    }
  }

  return updatedWorkspaces;
}

/**
 * Create a commit with the version bump message
 *
 * @param {Workspace[]} workspaces
 * @param {ActionOptions} options
 */
export async function createVersionCommit(workspaces, options) {
  const commitMessage = `chore: version bump for workspaces: ${workspaces.map((node) => node.name).join(', ')}`;

  await git.pushChange(commitMessage, options.branch);
}

/**
 *
 * @param {string} version
 * @param {ActionOptions} options
 */
export async function createVersionTags(version, options) {
  const tagMessage = `chore: version bump for workspaces: ${options.workspaces.map((node) => node.name).join(', ')}`;

  git.tag.createAndPush(`v${version}`, tagMessage);
  // if (options.shortVersionTag && !version.includes('-')) {
  //   git.tag.createAndPush(`v${version.split('.').slice(0, -1)}`, tagMessage);
  // }
}

/**
 *
 * @param {WorkspaceNode[]} workspacesTree
 * @param {import()} options
 */
export async function createVersionPR(workspacesTree, options) {
  const prBranch = await git.branch.createVersion(workspacesTree[0].workspace.version);
  await git.branch.push(prBranch);

  const prTitle = `${options.prMessage}  ${workspaces.map((node) => node.name).join(', ')}`;
  // TODO: pr body should contain the changelog
  const prBody = prTitle;

  // Create PR with the specified title and body
  await github.pr.create({
    title: prTitle,
    body: prBody,
    base: options.branch,
    head: prBranch,
  });
}

///////////////////////

/**
 * Find the common base path shared by all paths
 * @TODO: is this function needed?
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
 * Enrich workspaces
 * @TODO: is this function needed?
 *
 * @param {Workspace[]} workspaces - Array of workspace specifications
 * @returns {Promise<Workspace[]>}
 */
export async function enrichWorkspaces(workspaces) {
  const enrichedWorkspaces = [];

  for (const workspace of workspaces) {
    const enrichedWorkspace = await enrichWorkspace(workspace.path, workspace.type);
    enrichedWorkspaces.push(enrichedWorkspace);
  }

  return enrichedWorkspaces;
}
