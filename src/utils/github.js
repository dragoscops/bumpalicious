import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { logger, pinoErrorPrettier } from './logging.js';
import * as workspace from './workspace.js';
import { projectName } from '../constants.js';

export const log = logger.child({ module: `${projectName}/utils/github` });

/**
 * @typedef {import('./workspace.js').Workspace} Workspace
 */

/**
 * Action configuration options
 *
 * @typedef {Object} ActionOptions
 * @property {string} branch - Target branch for pull requests
 * @property {string} prVersionPrefix - Branch to use for version bumps
 * @property {boolean} pr - Whether to create a pull request with version changes
 * @property {string} prMessage - Message to use for the pull request
 * @property {string} prAutoMerge - Whether to automatically merge the pull request
 * @property {string} shortTag - Whether to use short tags (e.g. v1.0.0) instead of full commit hashes
 * @property {string} token - GitHub token for actions like creating pull requests
 * @property {Workspace[]} workspaces - Comma-separated workspace definitions with format "path:type"
 * @property {ChangelogPreset} changelogPreset - The conventional-changelog preset to use (default: conventionalcommits)
 */

/**
 * Get action options from input parameters
 * @returns {ActionOptions} - Action options parsed from inputs
 */
export function getOptions() {
  return {
    branch: core.getInput('branch') || 'main',
    changelogPreset: core.getInput('changelog_preset') || 'conventionalcommits',
    pr: core.getInput('pr') === 'true',
    prAutoMerge: core.getInput('pr_auto_merge') === 'true',
    prMessage: core.getInput('pr_message'),
    prVersionPrefix: core.getInput('pr_version_prefix') || 'version_bump',
    shortTag: core.getInput('short_tag') === 'true',
    token: process.env.GITHUB_TOKEN ?? core.getInput('github_token', { required: true }),
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
  const { token } = options;

  if (!token) {
    log.error('No GitHub token provided. Set the GITHUB_TOKEN environment variable or github_token input.');
    return null;
  }

  try {
    return getOctokit(token);
  } catch (error) {
    log.error({ options, ...pinoErrorPrettier(error) }, 'Failed to create GitHub API client');
    return null;
  }
};

/**
 * @typedef {Object} Repository
 * @property {string} owner - Repository owner
 * @property {string} repo - Repository name
 * @property {string} joined - Repository (contains ownerName/repoName)
 */

/**
 * Parse GitHub repository from environment
 *
 * @returns {Repository|null} - Repository object with owner and name properties or null
 */
export const getRepository = () => {
  const joined = process.env.GITHUB_REPOSITORY;

  if (!joined) {
    log.error('GITHUB_REPOSITORY environment variable not found');
    return null;
  }

  const [owner, repo] = joined.split('/');

  if (!owner || !repo) {
    log.error(`Invalid repository format: ${joined}`);
    return null;
  }

  return { owner, repo, joined };
};

/**
 * @typedef {import('@octokit/plugin-rest-endpoint-methods').RestEndpointMethodTypes['pulls']['create']['parameters']} PRCreateRequest
 */

/**
 * @typedef {import('@octokit/plugin-rest-endpoint-methods').RestEndpointMethodTypes['pulls']['create']['response']['data']} PRCreateResponse
 */

/**
 * @typedef {import('@octokit/plugin-rest-endpoint-methods').RestEndpointMethodTypes['pulls']['merge']['response']} PRMergeRequest
 */

/**
 * Pull request management utilities
 */
export const pr = {
  /**
   * Create a new pull request
   *
   * @param {PRCreateRequest} createOptions - Pull request options
   * @param {ActionOptions} options - Action options
   * @returns {Promise<PRCreateResponse|null>} - Pull request data or null on failure
   */
  create: async ({ base, head, title, body }, options) => {
    const octokit = getClient(options);
    const repo = getRepository();

    if (!octokit) {
      log.error('Failed to create pull request: Octokit client not found');
      core.error('Failed to create pull request: Octokit client not found');
      return null;
    }
    if (!repo) {
      log.error('Failed to create pull request: repository not found');
      core.error('Failed to create pull request: repository not found');
      return null;
    }

    try {
      const { data: pullRequest } = await octokit.rest.pulls.create({
        ...repo,
        base,
        head,
        title,
        body,
        options,
      });

      log.info({ pullRequest }, `Pull request created successfully`);
      core.notice(`Pull request created successfully: ${pullRequest.html_url}`);
      return pullRequest;
    } catch (error) {
      log.error({ ...pinoErrorPrettier(error) }, 'Failed to create pull request');
      core.error(`Failed to create pull request: ${error.message}`);
      return null;
    }
  },

  /**
   * Check if a pull request exists
   *
   * @param {Object} options - Options for checking pull request
   * @param {string} options.base - Base branch
   * @param {string} options.head - Head branch
   * @param {ActionOptions} actionOptions - Action options containing GitHub token
   * @returns {Promise<Object|null>} - PR data if exists, null otherwise
   */
  exists: async ({ base, head }, actionOptions) => {
    const octokit = getClient(actionOptions);
    const repo = getRepository();

    if (!octokit || !repo) {
      return null;
    }

    try {
      const { data: pullRequests } = await octokit.rest.pulls.list({
        ...repo,
        base,
        head: `${repo.owner}:${head}`,
        state: 'open',
      });

      return pullRequests.length > 0 ? pullRequests[0] : null;
    } catch (error) {
      log.error({ ...pinoErrorPrettier(error), repo, base, head }, 'Failed to check for existing pull request');
      return null;
    }
  },

  /**
   * Merge a pull request
   *
   * @param {PRMergeRequest} mergeOptions - Merge options
   * @param {ActionOptions} options - Action options
   * @returns {Promise<boolean>} - Whether the PR was merged successfully
   */
  merge: async ({ pullNumber, mergeMethod = 'merge' } = {}, options) => {
    const octokit = getClient(options);
    const repo = getRepository();

    if (!octokit || !repo) {
      return false;
    }

    try {
      await octokit.rest.pulls.merge({
        ...repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
      });

      log.info({ pullNumber, mergeMethod, options }, `Pull request merged successfully`);
      return true;
    } catch (error) {
      log.error({ ...pinoErrorPrettier(error), pullNumber, mergeMethod, options }, `Failed to merge pull request`);
      return false;
    }
  },

  /**
   * Waits until a pull request is merged
   *
   * @param {PRMergeRequest} mergeOptions - Merge options
   * @param {ActionOptions} options - Action options
   * @returns {Promise<boolean>} - Whether the PR was merged successfully
   */
  hasMerged: async ({ pullNumber, mergeMethod = 'merge' } = {}, options) => {
    const octokit = getClient(options);
    const repo = getRepository();

    if (!octokit || !repo) {
      return false;
    }

    return new Promise((resolve) => {
      const checkMerged = async () => {
        const { data: pullRequest } = await octokit.rest.pulls.get({
          ...repo,
          pull_number: pullNumber,
        });

        if (pullRequest.merged) {
          log.info({ pullRequest, mergeMethod, options }, `Pull request has been merged`);
          resolve(true);
        } else {
          log.info({ pullRequest, mergeMethod, options }, `Pull request is not merged yet`);
          setTimeout(checkMerged, 5000);
        }
      };

      checkMerged();
    });
  },
};
