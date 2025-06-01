/**
 * Workspace management functionality for handling multiple project workspaces
 * @module core/workspaces
 */
import path from 'path';
import semver from 'semver';
import * as core from '@actions/core';

import * as workspaceDetect from './version/workspace/index.js';
import * as git from '../utils/git.js';
import * as github from '../utils/github.js';
import {logger} from '../utils/logging.js';
import * as version from './version.js';
import * as changelog from '../utils/changelog.js';
import { projectName } from '../constants.js';

export const log = logger.child({module: `${projectName}/core/workspaces`});

// Log message constants
const LOG_MESSAGES = {
  WORKSPACE_CHANGED: 'Workspace has changed since last tag',
  WORKSPACE_UNCHANGED: 'Workspace has not changed since last tag',
  UNKNOWN_WORKSPACE_TYPE: 'Unknown workspace type, defaulting to text',
  WORKSPACE_SKIP_NO_VERSION: 'Skipping workspace: no version specified',
  VERSION_INCREASE: 'Increasing workspace version',
  VERSION_UPDATE_START: 'Updating workspace version',
  VERSION_BUMPED: 'Workspace version bumped successfully',
  CHANGELOG_GENERATE_START: 'Generating changelog for workspace',
  CHANGELOG_GENERATE_ERROR: 'Failed to generate changelog for workspace',
  VERSION_UPDATE_SUCCESS: 'Updated workspace version',
  VERSION_UPDATE_ERROR: 'Error updating workspace',
  SHORT_TAG_CREATED: 'Created/updated short version tag',
  SHORT_TAG_SKIPPED: 'Skipping short version tag for pre-release version',
  CHANGELOG_READ_ERROR: 'Failed to read changelog for workspace',
  NO_CHANGED_WORKSPACES: 'No workspaces have changed, skipping changelog generation',
  GENERATING_CHANGELOGS: 'Generating changelogs for workspaces',
};

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
  log.info({workspaces: options.workspaces}, 'Enriching workspaces with additional info');
  const changedWorkspaces = await enrichChangedWorkspaces(options.workspaces, lastTag);

  // If no changed workspaces, exit early
  if (changedWorkspaces.length === 0) {
    return [];
  }

  // TODO: remove next line
  return [];

  log.info({count: changedWorkspaces.length}, `Updating versions for ${changedWorkspaces.length} workspaces`);

  // Increase versions based on commit message
  const updatedWorkspaces = await increaseVersionForWorkspaces({
    workspaces: changedWorkspaces,
    commitMessage,
  });

  // If no version updates needed, exit early
  if (updatedWorkspaces.length === 0) {
    return [];
  }

  log.info(
    {count: updatedWorkspaces.length, workspaces: updatedWorkspaces},
    `Updated versions for ${updatedWorkspaces.length} workspaces`,
  );

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

  for (let workspace of workspaces) {
    const changedFiles = await git.commits.getChangedFiles(workspace.path, lastTag);
    if (changedFiles.length > 0) {
      const enrichedWorkspace = await enrichWorkspace(workspace.path, workspace.type);
      log.info({workspace: enrichedWorkspace, lastTag, changedFiles}, LOG_MESSAGES.WORKSPACE_CHANGED);
      enrichedWorkspaces.push(enrichedWorkspace);
    } else {
      log.warn({workspace, lastTag}, LOG_MESSAGES.WORKSPACE_UNCHANGED);
    }
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
      log.warn({workspaceType, workspacePath}, LOG_MESSAGES.UNKNOWN_WORKSPACE_TYPE);
    }

    // Use directory name as fallback for project name
    if (!name) {
      name = path.basename(workspacePath);
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
  return workspaces
    .map((workspace) => {
      const updatedVersion = version.increaseVersion(workspace.version, commitMessage);

      if (updatedVersion !== null && updatedVersion !== workspace.version) {
        log.info(
          {
            workspaceName: workspace.name,
            oldVersion: workspace.version,
            newVersion: updatedVersion,
          },
          LOG_MESSAGES.VERSION_INCREASE,
        );
        return {...workspace, version: updatedVersion};
      }

      return null;
    })
    .filter((workspace) => workspace);
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
      log.warn({workspaceName: workspace.name, workspacePath: workspace.path}, LOG_MESSAGES.WORKSPACE_SKIP_NO_VERSION);
      continue;
    }

    try {
      // Change to workspace directory
      process.chdir(originalDir);
      process.chdir(path.resolve(workspace.path));
      log.info(
        {workspaceName: workspace.name, workspacePath: workspace.path, version: workspace.version},
        LOG_MESSAGES.VERSION_UPDATE_START,
      );

      if (workspaceDetect[workspace.type]) {
        await workspaceDetect[workspace.type].update(workspace.path, workspace.version);
      } else {
        await workspaceDetect.text.update(workspace.path, workspace.version);
      }
      log.info({workspacePath: workspace.path, version: workspace.version}, LOG_MESSAGES.VERSION_BUMPED);

      // Generate changelog after updating version
      if (generateChangelog) {
        log.info({workspaceName: workspace.name, workspacePath: workspace.path}, LOG_MESSAGES.CHANGELOG_GENERATE_START);
        try {
          await changelog.generateWorkspaceChangelog(workspace);
        } catch (changelogError) {
          log.error(
            {
              workspaceName: workspace.name,
              workspacePath: workspace.path,
              error: changelogError,
            },
            LOG_MESSAGES.CHANGELOG_GENERATE_ERROR,
          );
        }
      }

      updatedWorkspaces.push(workspace);
      log.info({workspaceName: workspace.name, version: workspace.version}, LOG_MESSAGES.VERSION_UPDATE_SUCCESS);
    } catch (error) {
      log.error(
        {
          workspaceName: workspace.name,
          workspacePath: workspace.path,
          error,
        },
        LOG_MESSAGES.VERSION_UPDATE_ERROR,
      );
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
 * Create version tags based on the provided version
 *
 * @param {string} version - Version to create tags for
 * @param {ActionOptions} options - Action options including shortTag settings
 */
export async function createVersionTags(version, options) {
  const tagMessage = `chore: version bump for workspaces: ${options.workspaces.map((node) => node.name).join(', ')}`;

  // Create the main version tag (e.g., v2.0.1)
  git.tag.createAndPush(`v${version}`, tagMessage);
  core.setOutput('tag', version);

  // Create a shorter tag (e.g., v2.0) if shortTag is set and the version doesn't have a pre-release suffix
  if (options.shortTag) {
    const parsedVersion = semver.parse(version);

    // Only create short tags for non-prerelease versions
    if (parsedVersion && parsedVersion.prerelease.length === 0) {
      const shortVersion = `${parsedVersion.major}.${parsedVersion.minor}`;
      git.tag.createAndPush(`v${shortVersion}`, tagMessage);
      log.info({shortVersion}, LOG_MESSAGES.SHORT_TAG_CREATED);
    } else {
      log.info({version}, LOG_MESSAGES.SHORT_TAG_SKIPPED);
    }
  }
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
      log.warn({workspaceName: workspace.name, error: error.message}, LOG_MESSAGES.CHANGELOG_READ_ERROR);
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
    log.info({lastTag}, LOG_MESSAGES.NO_CHANGED_WORKSPACES);
    return [];
  }

  log.info({count: changedWorkspaces.length}, LOG_MESSAGES.GENERATING_CHANGELOGS);
  return changelog.generateWorkspacesChangelogs(changedWorkspaces, options);
}
