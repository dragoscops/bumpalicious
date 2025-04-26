/**
 * Git operations utility
 * @module utils/git
 */

import {execa} from 'execa';
import * as logging from './logging.js';

export const config = {
  /**
   * Get the current git configuration as a key-value object
   *
   * @param {string|null} [key] - Optional key prefix to filter by
   * @returns {Promise<Object>} - Current git configuration as a key-value object
   */
  get: async (key = null) => {
    try {
      const {stdout} = await execa('git', ['config', '--list']);

      // Initialize empty object for storing config
      const configObject = {};

      // Split by lines and process each line
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        // Skip empty lines
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Parse each line as key=value
        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex > 0) {
          const configKey = trimmedLine.substring(0, separatorIndex).trim();
          const value = trimmedLine.substring(separatorIndex + 1).trim();
          configObject[configKey] = value;
        }
      }

      // If a key prefix is provided, filter the results
      if (key) {
        const filteredConfig = {};
        for (const configKey in configObject) {
          if (configKey.startsWith(key)) {
            filteredConfig[configKey] = configObject[configKey];
          }
        }
        return filteredConfig;
      }

      return configObject;
    } catch (error) {
      logging.error(`Failed to get git config: ${error.message}`);
      return {};
    }
  },

  /**
   *
   * @param {Object} options - Options for setting git configuration
   * @param {boolean} global - Whether to set globally or locally
   * @returns {Promise<void>} - Resolves when the configuration is set
   */
  set: async (options, global = true) => {
    for (const [key, value] of Object.entries(options)) {
      try {
        await execa('git', ['config', global ? '--global' : '', key, value]);
        logging.info(`Git config ${key} set to ${value}`);
      } catch (error) {
        logging.error(`Failed to set git config ${key}: ${error.message}`);
      }
    }
  },
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
    await execa('git', ['add', '.']);
    await execa('git', ['commit', '-am', commitMessage]);
    await execa('git', ['push', 'origin', branch]);
    logging.info(`Changes committed with message: ${commitMessage}`);
  } catch (error) {
    logging.error(`Failed to commit changes:`, error);
  }
}

export const log = {
  lastMessage: async () => {
    try {
      const {stdout} = await execa('git', ['log', '-1', '--pretty=%B']);
      return stdout.trim();
    } catch (error) {
      logging.error(`Failed to get latest commit message: ${error.message}`);
    }
  },
};

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
    const exists = await tag.exists(tagName);
    if (exists) {
      await tag.remove(tagName);
      logging.info(`Tag ${tagName} already exists, removing it first`);
    }
    await tag.create(tagName, message);
    await tag.push(tagName);
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
   * Get the last created tag in the repository.
   *
   * @returns Promise<string|null>
   */
  lastCreated: async () => {
    try {
      const {stdout} = await execa('git', ['describe', '--tags', '--abbrev=0']);
      return stdout.trim();
    } catch (error) {
      logging.error('No tags found in the repository');
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
   * @returns {Promise<string>}
   */
  create: async (branchName) => {
    try {
      await execa('git', ['checkout', '-b', branchName]);
      logging.info(`Branch ${branchName} created successfully`);
      return branchName;
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

  push: async (branchName) => {
    try {
      await execa('git', ['push', 'origin', branchName]);
      logging.info(`Branch ${branchName} pushed successfully`);
    } catch (error) {
      logging.error(`Failed to push branch ${branchName}:`, error);
    }
  },
};

export const pr = {
  /**
   *
   * @param {*} param0
   */
  create: async ({base, head, title, body}) => {
    try {
      const {stdout} = await execa('gh', [
        'pr',
        'create',
        '--base',
        base,
        '--head',
        head,
        '--title',
        title,
        '--body',
        body,
      ]);
      logging.info(`Pull request created successfully: ${stdout}`);
    } catch (error) {
      logging.error(`Failed to create pull request:`, error);
    }
  },
};
