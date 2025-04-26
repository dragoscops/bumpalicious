/**
 * GitHub API utilities
 * @module utils/github
 */

import * as core from '@actions/core';
import {getOctokit} from '@actions/github';
import * as logging from './logging.js';
import * as workspace from './workspace.js';

/**
 * @typedef {import('./workspace.js').Workspace} Workspace
 */

/**
 * Action configuration options
 *
 * @typedef {Object} ActionOptions
 * @property {string} branch - Target branch for pull requests
 * @property {boolean} pr - Whether to create a pull request with version changes
 * @property {string} prMessage - Message to use for the pull request
 * @property {string} prAutoMerge - Whether to automatically merge the pull request
 * @property {string} token - GitHub/Gitea token for actions like creating pull requests
 * @property {Workspace[]} workspaces - Comma-separated workspace definitions with format "path:type"
 */

export function getOptions() {
  return {
    token: process.env.GITHUB_TOKEN ?? core.getInput('github_token', {required: true}),
    branch: core.getInput('branch') || 'main',
    pr: core.getInput('pr') === 'true',
    prMessage: core.getInput('pr_message'),
    prAutoMerge: core.getInput('pr_auto_merge') === 'true',
    workspaces: core.getInput('workspaces')
      ? core.getInput('workspaces').split(',').map(workspace.stringToWorkspace)
      : [],
  };
}

/**
 * Get authenticated Octokit client
 *
 * @param {Object} options - Options for Octokit client
 * @returns {Object|null} - Octokit client or null if no token
 */
export const getClient = (options) => {
  const {token} = options;

  if (!token) {
    logging.error('No GitHub token provided. Set the GITHUB_TOKEN environment variable or github_token input.');
    return null;
  }

  try {
    return getOctokit(token);
  } catch (error) {
    logging.error('Failed to create GitHub API client', error);
    return null;
  }
};

/**
 * @typedef {Object} Repository
 * @property {string} owner - Repository owner
 * @property {string} repo - Repository name
 */

/**
 * Parse GitHub repository from environment
 *
 * @returns {Repository|null} - Repository object with owner and name properties or null
 */
export const getRepository = () => {
  const repoEnv = process.env.GITHUB_REPOSITORY;

  if (!repoEnv) {
    logging.error('GITHUB_REPOSITORY environment variable not found');
    return null;
  }

  const [owner, repo] = repoEnv.split('/');

  if (!owner || !repo) {
    logging.error(`Invalid repository format: ${repoEnv}`);
    return null;
  }

  return {owner, repo};
};

/**
 * Pull request management utilities
 */
export const pr = {
  /**
   * Create a new pull request
   *
   * @param {Object} options - Pull request options
   * @param {string} options.base - Base branch (destination)
   * @param {string} options.head - Head branch (source)
   * @param {string} options.title - PR title
   * @param {string} options.body - PR body content
   * @param {ActionOptions} options - Action options
   * @returns {Promise<Object|null>} - Pull request data or null on failure
   */
  create: async ({base, head, title, body}, options) => {
    const octokit = getClient(options);
    const repo = getRepository();

    if (!octokit) {
      logging.error('Failed to create pull request: Octokit client not found');
    }
    if (!repo) {
      logging.error('Failed to create pull request: repository not found');
    }

    try {
      const {data: pullRequest} = await octokit.pulls.create({
        ...repo,
        base,
        head,
        title,
        body,
      });

      logging.info(`Pull request created successfully: ${pullRequest.html_url}`);
      return pullRequest;
    } catch (error) {
      logging.error('Failed to create pull request:', error);
    }
  },

  /**
   * Check if a pull request exists
   *
   * @param {Object} options - Options for checking pull request
   * @param {string} options.base - Base branch
   * @param {string} options.head - Head branch
   * @returns {Promise<Object|null>} - PR data if exists, null otherwise
   */
  exists: async ({base, head}) => {
    const octokit = getClient();
    const repo = getRepository();

    if (!octokit || !repo) {
      return null;
    }

    try {
      const {data: pullRequests} = await octokit.rest.pulls.list({
        ...repo,
        base,
        head: `${repo.owner}:${head}`,
        state: 'open',
      });

      return pullRequests.length > 0 ? pullRequests[0] : null;
    } catch (error) {
      logging.error('Failed to check for existing pull request:', error);
      return null;
    }
  },

  /**
   * Merge a pull request
   *
   * @param {number} pullNumber - The pull request number
   * @param {Object} options - Merge options
   * @param {string} [options.commitTitle] - Title for the merge commit
   * @param {string} [options.commitMessage] - Message for the merge commit
   * @param {string} [options.mergeMethod='merge'] - Merge method (merge, squash, rebase)
   * @returns {Promise<boolean>} - Whether the PR was merged successfully
   */
  merge: async (pullNumber, {commitTitle, commitMessage, mergeMethod = 'merge'} = {}) => {
    const octokit = getClient();
    const repo = getRepository();

    if (!octokit || !repo) {
      return false;
    }

    try {
      await octokit.rest.pulls.merge({
        ...repo,
        pull_number: pullNumber,
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: mergeMethod,
      });

      logging.info(`Pull request #${pullNumber} merged successfully`);
      return true;
    } catch (error) {
      logging.error(`Failed to merge pull request #${pullNumber}:`, error);
      return false;
    }
  },
};

/**
 * Create a GitHub release for a version
 *
 * @param {Object} options - Release options
 * @param {string} options.version - Version number (e.g. 1.0.0)
 * @param {string} options.tagName - Tag name (e.g. v1.0.0)
 * @param {string} options.title - Release title
 * @param {string} options.body - Release body/notes
 * @param {boolean} [options.draft=false] - Whether this is a draft release
 * @param {boolean} [options.prerelease=false] - Whether this is a prerelease
 * @returns {Promise<Object|null>} - Release data or null on failure
 */
export const createRelease = async ({version, tagName, title, body, draft = false, prerelease = false}) => {
  const octokit = getClient();
  const repo = getRepository();

  if (!octokit || !repo) {
    return null;
  }

  try {
    const {data: release} = await octokit.rest.repos.createRelease({
      ...repo,
      tag_name: tagName,
      name: title || `Release ${version}`,
      body: body || '',
      draft,
      prerelease,
    });

    logging.notice(`Created GitHub release: ${release.html_url}`);
    return release;
  } catch (error) {
    logging.error(`Failed to create GitHub release for ${version}`, error);
    return null;
  }
};

/**
 * Get the latest release from GitHub
 *
 * @returns {Promise<Object|null>} - Latest release data or null
 */
export const getLatestRelease = async () => {
  const octokit = getClient();
  const repo = getRepository();

  if (!octokit || !repo) {
    return null;
  }

  try {
    const {data: release} = await octokit.rest.repos.getLatestRelease({
      ...repo,
    });

    return release;
  } catch (error) {
    // Not an error if no releases exist yet
    logging.warning('No releases found in the repository');
    return null;
  }
};

/**
 * Generate release notes based on commits since last release
 *
 * @param {string} previousTag - Previous release tag
 * @param {string} newTag - New release tag
 * @returns {Promise<string>} - Generated release notes
 */
export const generateReleaseNotes = async (previousTag, newTag) => {
  const octokit = getClient();
  const repo = getRepository();

  if (!octokit || !repo) {
    return '';
  }

  try {
    const {data: notes} = await octokit.rest.repos.generateReleaseNotes({
      ...repo,
      tag_name: newTag,
      previous_tag_name: previousTag,
    });

    return notes.body;
  } catch (error) {
    logging.error('Failed to generate release notes', error);
    return '';
  }
};
