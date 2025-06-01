/**
 * Git operations utility
 * @module utils/git
 */

import {execa} from 'execa';
import {logger} from './logging.js';
import { projectName } from '../constants.js';

export const log = logger.child({module: `${projectName}/utils/git`});

// Log message constants
export const infoGitConfigSet = 'Git config set successfully';
export const infoTagCreated = 'Tag created successfully';
export const infoTagAlreadyExists = 'Tag already exists, removing it first';
export const infoRemoteTagDeleted = 'Remote tag deleted successfully';
export const infoBranchCreated = 'Branch created successfully';
export const infoBranchDeleted = 'Branch deleted successfully';
export const infoBranchPushed = 'Branch pushed successfully';
export const infoBranchPulled = 'Branch pulled successfully';
export const infoTagDeleted = 'Tag deleted successfully';
export const infoTagPushed = 'Tag pushed successfully';
export const infoChangesCommitted = 'Changes committed with message';
export const infoBranchCheckedOut = 'Checked out to branch';

export const warnFailedToGetGitConfig = 'Failed to get git config';
export const warnFailedToSetGitConfig = 'Failed to set git config';
export const warnFailedToGetLatestCommitMessage = 'Failed to get latest commit message';
export const warnFailedToCreateTag = 'Failed to create tag';
export const warnFailedToCheckTagExists = 'Failed to check if tag exists';
export const warnFailedToGetLastCreatedTag = 'Failed to get last created tag; moving to commit hash detection';
export const warnFailedToCreateBranch = 'Failed to create branch';
export const warnFailedToDeleteBranch = 'Failed to delete branch';
export const warnFailedToPushBranch = 'Failed to push branch';
export const warnFailedToPushTag = 'Failed to push tag';
export const warnFailedToDeleteTag = 'Failed to delete tag';
export const warnFailedToCommitChanges = 'Failed to commit changes';
export const warnCouldNotRemoveRemoteTag = 'Could not remove remote tag, it might not exist';
export const warnNoTagsFound = 'No tags found; moving to commit hash detection';
export const warnFailedToCheckoutBranch = 'Failed to checkout to branch';
export const warnFailedToPullBranch = 'Failed to pull branch';

export const errorRetrievingChangedFiles = 'Error retrieving changed files in repository';

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
      log.warn({error: error.message}, warnFailedToGetGitConfig);
      return {};
    }
  },

  /**
   * Set git configuration options
   *
   * @param {Object.<string, string>} options - Key-value pairs of git configuration options to set
   * @param {boolean} [global=true] - Whether to set globally or locally
   * @returns {Promise<void>} - Resolves when the configuration is set
   */
  set: async (options, global = true) => {
    for (const [key, value] of Object.entries(options)) {
      try {
        await execa('git', ['config', global ? '--global' : '', key, value]);
        log.info({key, value}, infoGitConfigSet);
      } catch (error) {
        log.warn({key, error: error.message}, warnFailedToSetGitConfig);
      }
    }
  },
};

/**
 * Get the list of files that have changed in a repository since the last tag.
 *
 * @param {string} repoPath - Path to the repository
 * @param {string} lastTag - Last git tag
 * @returns {Promise<string[]>} - Array of file paths that changed, empty array on error
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
    log.error({repoPath, error}, errorRetrievingChangedFiles);
    return [];
  }
};

/**
 * Commit and push changes to remote repository
 *
 * @param {string} commitMessage - Commit message for the changes
 * @param {string} [branch='main'] - Branch to push to
 * @returns {Promise<void>}
 */
export async function pushChange(commitMessage, branch = 'main') {
  try {
    await execa('git', ['add', '.']);
    await execa('git', ['commit', '-am', commitMessage]);
    await execa('git', ['push', 'origin', branch]);
    log.info({commitMessage}, infoChangesCommitted);
  } catch (error) {
    log.error({error}, warnFailedToCommitChanges);
    return;
  }
}

export const gitLog = {
  /**
   * Get the last commit message
   * @returns {Promise<string|null>} - Last commit message or null on error
   */
  lastMessage: async () => {
    try {
      const {stdout} = await execa('git', ['log', '-1', '--pretty=%B']);
      return stdout.trim();
    } catch (error) {
      log.warn({error: error.message}, warnFailedToGetLatestCommitMessage);
      return null;
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
      log.info({tagName}, infoTagCreated);
    } catch (error) {
      log.warn({tagName, error}, warnFailedToCreateTag);
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
      log.info({tagName}, infoTagAlreadyExists);
      // First delete the tag locally
      await tag.remove(tagName);
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
      log.warn({tagName, error}, warnFailedToCheckTagExists);
      return false;
    }
  },

  /**
   * Get the last created tag in the repository.
   * If no tags are found, returns the hash of the first commit.
   *
   * @returns {Promise<string|null>} - Tag name, commit hash, or null on error
   */
  lastCreated: async () => {
    try {
      const {stdout: lastTag} = await execa('git', ['describe', '--tags', '--abbrev=0']);
      if (lastTag.trim()) {
        return lastTag.trim();
      }
    } catch (error) {
      log.warn({error: error.message}, warnFailedToGetLastCreatedTag);
    }
    try {
      // If no tag is found, get the first commit hash
      const {stdout: firstCommitHash} = await execa('git', ['rev-list', '--max-parents=0', 'HEAD']);
      return firstCommitHash.trim();
    } catch (error) {
      log.warn({error}, warnNoTagsFound);
      return null;
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
      log.info({tagName}, infoTagPushed);
    } catch (error) {
      log.warn({tagName, error}, warnFailedToPushTag);
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
      log.info({tagName}, infoTagDeleted);
    } catch (error) {
      log.warn({tagName, error}, warnFailedToDeleteTag);
    }

    // Remote tag deletion is optional and might not be necessary
    // // Also try to delete it from remote
    // try {
    //   await execa('git', ['push', 'origin', `:refs/tags/${tagName}`]);
    //   log.info({tagName}, infoRemoteTagDeleted);
    // } catch (error) {
    //   log.warn({tagName, error: error.message}, warnCouldNotRemoveRemoteTag);
    // }
  },
};

export const branch = {
  /**
   * Checkout to a specific branch
   *
   * @param {string} branchName - Branch name to check out
   * @returns {Promise<void>}
   */
  checkout: async (branchName) => {
    try {
      await execa('git', ['checkout', branchName]);
      log.info({branchName}, infoBranchCheckedOut);
    } catch (error) {
      log.warn({branchName, error}, warnFailedToCheckoutBranch);
    }
  },

  /**
   * Create a new branch
   * @param {string} branchName
   * @returns {Promise<string|null>} - Branch name on success, null on error
   */
  create: async (branchName) => {
    try {
      await execa('git', ['checkout', '-b', branchName]);
      log.info({branchName}, infoBranchCreated);
      return branchName;
    } catch (error) {
      log.warn({branchName, error}, warnFailedToCreateBranch);
      return null;
    }
  },

  /**
   * Create a version branch
   * @param {string} version
   * @returns {Promise<string|null>} - Branch name on success, null on error
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
      log.info({branchName}, infoBranchDeleted);
    } catch (error) {
      log.warn({branchName, error}, warnFailedToDeleteBranch);
    }
  },

  /**
   * Pull changes from remote branch
   *
   * @param {string} branchName - Branch name to pull from
   * @returns {Promise<void>}
   */
  pull: async (branchName) => {
    try {
      await execa('git', ['pull', 'origin', branchName]);
      log.info({branchName}, infoBranchPulled);
    } catch (error) {
      log.warn({branchName, error}, warnFailedToPullBranch);
    }
  },

  /**
   * Push branch to remote repository
   *
   * @param {string} branchName - Branch name to push
   * @returns {Promise<void>}
   */
  push: async (branchName) => {
    try {
      await execa('git', ['push', 'origin', branchName]);
      log.info({branchName}, infoBranchPushed);
    } catch (error) {
      log.warn({branchName, error}, warnFailedToPushBranch);
    }
  },
};
