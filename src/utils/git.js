/**
 * Git operations utility
 * @module utils/git
 */

import {execa} from 'execa';
import * as logging from './logging.js';

/**
 * @typedef {ActionOptions & {workspace?: string}} SetupGitUserOptions
 */

/**
 * Configure git user for CI environments.
 *
 * @param {SetupGitUserOptions} options - Action configuration options.
 * @returns {Promise<void>} Resolves when configuration is complete.
 */
export async function setupUser({
  platform = 'github',
  workspace: workspacePath = process.env.GITHUB_WORKSPACE ?? process.cwd(),
}) {
  try {
    // Set git user name and email for GitHub Actions
    await execa('git', ['config', '--global', 'user.name', 'GitHub Actions']);
    await execa('git', ['config', '--global', 'user.email', 'actions@github.com']);

    // Add workspace to safe directories if provided
    if (workspacePath) {
      await execa('git', ['config', '--global', '--add', 'safe.directory', workspacePath]);
    }

    logging.info(`Git user configured successfully`);
  } catch (error) {
    // Just log the message without the error object for test compatibility
    logging.error(`Failed to configure git user`, error);
  }
}

/**
 * Get the last Git tag in the reposito
 *
 * @returns {Promise<string|null>} - Last git tag or null if no tags
 */
export async function lastCreatedTag() {
  try {
    const {stdout} = await execa('git', ['describe', '--tags', '--abbrev=0']);
    return stdout.trim();
  } catch (error) {
    logging.error('No tags found in the repository');
  }
}

/**
 * Get the latest commit message
 *
 * @returns {Promise<string>} - Latest commit message or empty string on error
 */
export const lastCommitMessage = async () => {
  try {
    const {stdout} = await execa('git', ['log', '-1', '--pretty=%B']);
    return stdout.trim();
  } catch (error) {
    logging.error(`Failed to get latest commit message: ${error.message}`);
  }
};

/**
 * Get the list of files that have changed in a repository since the last tag.
 *
 * @param {string} repoPath - Path to the repository
 * @param {string} lastTag - Last git tag
 * @returns {Promise<string[]>} - Array of file paths that changed
 */
export const getChangedFiles = async (repoPath, lastTag) => {
  try {
    // If no tag is provided, return all tracked files as changed
    if (!lastTag) {
      const {stdout} = await execa('git', ['ls-files'], {cwd: repoPath});
      return stdout.trim().split('\n').filter(Boolean);
    }

    // Retrieve changed files in the repository since the last tag
    const {stdout} = await execa('git', ['diff', lastTag, '--name-only', '--', repoPath], {cwd: repoPath});
    return stdout.trim().split('\n').filter(Boolean);
  } catch (error) {
    logging.error(`Error retrieving changed files in repository ${repoPath}:`, error);
  }
};

export async function pushChange(commitMessage, branch = 'main') {
  try {
    console.log('git', ['add', '.']);
    console.log('git', ['commit', '-am', commitMessage]);
    console.log('git', ['push', 'origin', branch]);

    // await execa('git', ['add', '.']);
    // await execa('git', ['commit', '-am', commitMessage]);
    // await execa('git', ['push', 'origin', branch]);
    logging.info(`Changes committed with message: ${commitMessage}`);
  } catch (error) {
    logging.error(`Failed to commit changes:`, error);
  }
}

/**
 * @typedef {Object} TagActions
 */
export const tag = {
  /**
   * Create a new Git tag with the specified name and message.
   *
   * @param {string} tagName - Name of the new tag
   * @param {string} message - Tag message
   * @returns {Promise<void>} - Resolves when the tag is created
   */
  create: async (tagName, message) => {
    try {
      await execa('git', ['tag', '-a', tagName, '-m', message]);
      logging.info(`Tag ${tagName} created successfully`);
    } catch (error) {
      logging.error(`Failed to create tag ${tagName}:`, error);
    }
  },

  /**
   * Create a new Git tag with the specified name and message and push it.
   *
   * @param {string} tagName - Name of the new tag
   * @param {string} message - Tag message
   * @returns {Promise<void>} - Resolves when the tag is created
   */
  createAndPush: async (tagName, message) => {
    try {
      const exists = await tag.exists(tagName);
      if (exists) {
        await tag.remove(tagName);
        logging.info(`Tag ${tagName} already exists, removing it first`);
      }
      await tag.create(tagName, message);
      await tag.push(tagName);
    } catch (error) {
      logging.error(`Failed to create and push tag ${tagName}:`, error);
    }
  },

  /**
   * Test if a tag exists in the repository.
   *
   * @param {string} tagName
   * @returns {Promise<boolean>}
   */
  exists: async (tagName) => {
    try {
      const {stdout} = await execa('git', ['tag', '-l', tagName]);
      return stdout.trim() === tagName;
    } catch (error) {
      logging.error(`Failed to check if tag ${tagName} exists:`, error);
      return false;
    }
  },

  /**
   * Push a Git tag to the remote repository.
   *
   * @param {string} tagName
   * @returns {Promise<void>}
   */
  push: async (tagName) => {
    try {
      await execa('git', ['push', 'origin', tagName]);
      logging.info(`Tag ${tagName} pushed successfully`);
    } catch (error) {
      logging.error(`Failed to push tag ${tagName}:`, error);
    }
  },

  /**
   * Delete an existing Tag from the repository.
   *
   * @param {string} tagName
   * @returns {Promise<void>}
   */
  remove: async (tagName) => {
    try {
      await execa('git', ['tag', '-d', tagName]);
      logging.info(`Tag ${tagName} deleted successfully`);
    } catch (error) {
      logging.error(`Failed to delete tag ${tagName}:`, error);
    }
  },
};

export const branch = {
  /**
   * @param {string} branchName
   * @returns {Promise<void>}
   */
  create: async (branchName) => {
    try {
      await execa('git', ['checkout', '-b', branchName]);
      logging.info(`Branch ${branchName} created successfully`);
    } catch (error) {
      logging.error(`Failed to create branch ${branchName}:`, error);
    }
  },

  /**
   * @param {string} version
   * @returns {Promise<void>}
   */
  createVersion: async (version) => branch.create(`version_bump_v${version}`),

  /**
   * Delete an existing branch from the repository.
   *
   * @param {string} branchName
   * @returns {Promise<void>}
   */
  remove: async (branchName) => {
    try {
      await execa('git', ['branch', '-d', branchName]);
      logging.info(`Branch ${branchName} deleted successfully`);
    } catch (error) {
      logging.error(`Failed to delete branch ${branchName}:`, error);
    }
  },
};
