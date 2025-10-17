/**
 * Workspace management functionality for handling multiple project workspaces
 * @module core/workspaces
 */
import * as core from '@actions/core';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';

import {projectName} from '../constants.js';
import * as changelog from '../utils/changelog.js';
import * as git from '../utils/git.js';
import * as github from '../utils/github.js';
import {logger, pinoErrorPrettier} from '../utils/logging.js';
import * as version from './version.js';
import * as workspaceDetect from './version/workspace/index.js';

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

  log.info({count: changedWorkspaces.length}, `Updating versions for changed workspaces`);

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
      log.info(
        {workspace: enrichedWorkspace, lastTag, changedFiles: changedFiles.length},
        LOG_MESSAGES.WORKSPACE_CHANGED,
      );
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
  workspacePath = path.resolve(workspacePath).replace(/\\/g, '/'); // Normalize path for consistency

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
        core.notice(
          `Version for workspace '${workspace.name}' has been increased from ${workspace.version} to ${updatedVersion}`,
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
  const updatedWorkspaces = [];

  for (const workspace of workspaces) {
    // Skip if no version specified
    if (!workspace.version) {
      log.warn({workspaceName: workspace.name, workspacePath: workspace.path}, LOG_MESSAGES.WORKSPACE_SKIP_NO_VERSION);
      continue;
    }

    try {
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
        } catch (changeLogError) {
          log.error(
            {
              workspaceName: workspace.name,
              workspacePath: workspace.path,
              ...pinoErrorPrettier(changeLogError),
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
          ...pinoErrorPrettier(error),
        },
        LOG_MESSAGES.VERSION_UPDATE_ERROR,
      );
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

  await git.commits.createAndPush(commitMessage, options.branch);
}

/**
 * Create version tags based on the provided version
 *
 * @param {string} version - Version to create tags for
 * @param {ActionOptions} options - Action options including shortTag settings
 */
export async function createVersionTags(version, options) {
  const tagMessage = `chore: version bump for workspaces: ${options.workspaces.map((node) => node.name).join(', ')}`;

  // Create a shorter tag (e.g., v2.0) if shortTag is set and the version doesn't have a pre-release suffix
  if (options.shortTag) {
    const parsedVersion = semver.parse(version);

    // Only create short tags for non-prerelease versions
    if (parsedVersion && parsedVersion.prerelease.length === 0) {
      const shortVersion = `${parsedVersion.major}.${parsedVersion.minor}`;
      await git.tag.createAndPush(`v${shortVersion}`, tagMessage);
      log.info({shortVersion}, LOG_MESSAGES.SHORT_TAG_CREATED);
      core.notice(`Created/updated short version tag: v${shortVersion}`);
    } else {
      log.info({version}, LOG_MESSAGES.SHORT_TAG_SKIPPED);
    }
  }

  // Create the main version tag (e.g., v2.0.1)
  await git.tag.createAndPush(`v${version}`, tagMessage);
  core.setOutput('tag', version);
  core.notice(`Created/updated version tag: v${version}`);
}

/**
 *
 * @param {WorkspaceNode[]} workspacesTree
 * @param {ActionOptions} options
 * @returns {Promise<void>}
 */
export async function createVersionPR(workspacesTree, options) {
  const rootNode = workspacesTree[0];
  const rootWorkspace = rootNode.workspace;

  // Create a version branch
  const prBranch = await git.branch.createAndPushVersion(rootWorkspace.version, options.prVersionPrefix);

  const prTitle = `${options.prMessage} ${rootWorkspace.version}`;

  // Create PR body with changelog information
  let prBody = [`# Version Update: ${rootWorkspace.name} ${rootWorkspace.version}`, ''];

  if (rootNode.children?.length ?? 0 > 0) {
    prBody = [...prBody, ...listWorkspacesVersions(rootNode)];
  } else {
    await generateChangelogForWorkspace(rootWorkspace);
  }

  /**
   * List versions of all workspaces in the workspacesTree
   *
   * @param {WorkspaceNode} node - Workspace node containing children workspaces
   * @return {string[]} - List of workspaces and their versions in markdown for
   */
  function listWorkspacesVersions(node) {
    return (node?.children ?? []).flatMap((child) => [
      `* ${child.workspace.name}: ${child.workspace.version}`,
      ...listWorkspacesVersions(child),
    ]);
  }

  /**
   * Generate changelog for a specific workspace
   *
   * @params {Workspace} workspace - Workspace to generate changelog for
   * @return {Promise<void>}
   *
   */
  async function generateChangelogForWorkspace(workspace) {
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
          prBody.push(`## ${latestEntry}`);
        } else {
          prBody.push(`No changelog entries found for ${workspace.name}.`);
          prBody.push('');
        }
      } else {
        prBody.push(`No changelog found for ${workspace.name}.`);
        prBody.push('');
      }
    } catch (error) {
      log.warn({workspaceName: workspace.name, ...pinoErrorPrettier(error)}, LOG_MESSAGES.CHANGELOG_READ_ERROR);
      prBody.push(`Failed to include changelog for ${workspace.name}.`);
      prBody.push('');
    }
  }

  await git.commits.createAndPush(prTitle, prBranch);

  log.info({workspacesTree, prBranch, prTitle, prBody}, `Creating PR for version bump`);

  return github.pr.create(
    {
      title: prTitle,
      body: prBody.join('\n'),
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
