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
import * as changelog from '../utils/changelog.js';

/**
 * @typedef {import('../utils/github.js').ActionOptions} ActionOptions
 */

/**
 * @typedef {import('../utils/github.js').PRCreateResponse} PRCreateResponse
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

  // Update version files in workspaces and generate changelogs
  await updateVersionsForWorkspaces(updatedWorkspaces, {
    generateChangelog: options.generateChangelog !== false,
  });

  return updatedWorkspaces;
}

/**
 * Enrich workspaces
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
export async function updateVersionsForWorkspaces(workspaces, {generateChangelog = true} = {}) {
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

      // Generate changelog after updating version
      if (generateChangelog) {
        logging.info(`Generating changelog for ${workspace.name || workspace.path}`);
        try {
          await changelog.generateWorkspaceChangelog(workspace);
        } catch (changelogError) {
          logging.error(`Failed to generate changelog for ${workspace.name || workspace.path}:`, changelogError);
        }
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
 * @param {ActionOptions} options
 * @returns {Promise<void>}
 */
export async function createVersionPR(workspacesTree, options) {
  const rootWorkspace = workspacesTree[0].workspace;

  // Create a version branch
  const prBranch = await git.branch.createVersion(rootWorkspace.version);
  await git.branch.push(prBranch);

  const prTitle = `${options.prMessage} ${rootWorkspace.version}`;

  // Generate changelogs before creating the PR body
  const fs = await import('fs/promises');
  const path = await import('path');

  // Create PR body with changelog information
  let prBody = `# Version Update: ${rootWorkspace.version}\n\n`;

  // Include changes for each workspace
  for (const node of workspacesTree) {
    const workspace = node.workspace;
    prBody += `## ${workspace.name} (${workspace.version})\n\n`;

    // Try to read changelog content if it exists
    try {
      const changelogPath = path.join(workspace.path, 'CHANGELOG.md');
      const changelogExists = await fs
        .access(changelogPath)
        .then(() => true)
        .catch(() => false);

      if (changelogExists) {
        // Read just the latest entry (between the first and second heading)
        const changelogContent = await fs.readFile(changelogPath, 'utf8');
        const latestEntry = changelogContent.split(/^## /m)[1];

        if (latestEntry) {
          prBody += `## ${latestEntry}\n`;
        } else {
          prBody += `No changelog entries found for ${workspace.name}.\n\n`;
        }
      } else {
        prBody += `No changelog found for ${workspace.name}.\n\n`;
      }
    } catch (error) {
      logging.warning(`Failed to read changelog for ${workspace.name}: ${error.message}`);
      prBody += `Failed to include changelog for ${workspace.name}.\n\n`;
    }
  }

  await git.pushChange(prTitle, prBranch);

  // Create PR with the specified title and body
  return github.pr.create(
    {
      title: prTitle,
      body: prBody,
      base: options.branch,
      head: prBranch,
    },
    options,
  );
}

/**
 * Generate changelogs for workspaces that have changed
 *
 * @param {Workspace[]} workspaces - List of workspaces to consider
 * @param {string} lastTag - Last git tag from which to detect changes
 * @param {Object} options - Additional options
 * @param {boolean} [options.firstRelease=false] - Whether this is the first release
 * @param {string} [options.preset='conventionalcommits'] - The conventional-changelog preset to use
 * @param {boolean} [options.append=true] - Whether to append to an existing changelog
 * @returns {Promise<Array<{workspace: Workspace, success: boolean}>>} - Results of changelog generation
 */
export async function generateChangelogsForChangedWorkspaces(workspaces, lastTag, options = {}) {
  // First, get workspaces that have changed
  const changedWorkspaces = await enrichChangedWorkspaces(workspaces, lastTag);

  if (changedWorkspaces.length === 0) {
    logging.info('No workspaces have changed, skipping changelog generation');
    return [];
  }

  logging.info(`Generating changelogs for ${changedWorkspaces.length} workspaces`);
  return changelog.generateWorkspacesChangelogs(changedWorkspaces, options);
}
