import {logger} from './logging.js';
import {projectName} from '../constants.js';
import {exec} from './exec.js';
import path from 'path';
import {getOptions} from './github.js';

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
export const errorFailedToSetGitConfig = 'Failed to set git config';
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
   * Set git configuration options
   *
   * @param {Object.<string, string>} options - Key-value pairs of git configuration options to set
   * @param {boolean} [global=true] - Whether to set globally or locally
   * @returns {Promise<boolean>} - Returns true if all options were set successfully, false if any failed
   */
  set: async (options, global = true) => {
    let result = true;
    for (const [key, value] of Object.entries(options)) {
      try {
        const args = ['config'];
        if (global) {
          args.push('--global');
        }
        args.push(key, value);
        await exec('git', args);
        log.info({key, value}, infoGitConfigSet);
      } catch (error) {
        log.error({key, error: error}, errorFailedToSetGitConfig);
        result = false;
        break;
      }
    }
    return result;
  },
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
    await exec('git', ['add', '.']);
    await exec('git', ['commit', '-am', commitMessage]);
    await exec('git', ['push', 'origin', branch]);
    log.info({commitMessage}, infoChangesCommitted);
  } catch (error) {
    log.error({error}, warnFailedToCommitChanges);
    return;
  }
}

/**
 * Get the root path of the Git repository
 *
 * @param {string} cwd - Current working directory
 * @returns {Promise<string|null>} - Root path of the Git repository or null on error
 */
export async function rootPath(cwd) {
  try {
    const {stdout} = await exec('git', ['rev-parse', '--show-toplevel'], {cwd});
    return stdout.trim();
  } catch (error) {
    log.error({cwd, error}, warnFailedToGetGitConfig);
  }
  return null;
}

export const commits = {
  /**
   * Get the last commit message
   * @returns {Promise<string|null>} - Last commit message or null on error
   */
  lastMessage: async () => {
    try {
      const {stdout} = await exec('git', ['log', '-1', '--pretty=%B']);
      return stdout.trim();
    } catch (error) {
      log.warn({error: error.message}, warnFailedToGetLatestCommitMessage);
      return null;
    }
  },

  /**
   * Get the list of files that have changed in a repository since the last tag.
   *
   * @param {string} repoPath - Path to the repository
   * @param {string} lastTag - Last git tag
   * @returns {Promise<string[]>} - Array of file paths that changed, empty array on error
   */
  getChangedFiles: async (repoPath, lastTag) => {
    try {
      // If no tag is provided, return all tracked files as changed
      if (!lastTag) {
        const {stdout} = await exec('git', ['ls-files'], {cwd: repoPath});
        return stdout.trim().split('\n').filter(Boolean);
      }

      const rootRepoPath = await rootPath(repoPath);
      const relativeRepoPath = path.relative(rootRepoPath, repoPath).replace(/\.[\\\/]/, '') || '.';
      // Retrieve changed files in the repository since the last tag
      const {stdout} = await exec('git', ['diff', lastTag, '--name-only', '--', relativeRepoPath], {cwd: rootRepoPath});
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      log.error({repoPath, error}, errorRetrievingChangedFiles);
      return [];
    }
  },

  // TODO: move pushChange to createAndPush here
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
      await exec('git', ['tag', '-a', tagName, '-m', message]);
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
      const {stdout} = await exec('git', ['tag', '-l', tagName]);
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
      const {stdout: lastTag} = await exec('git', ['describe', '--tags', '--abbrev=0']);
      if (lastTag.trim()) {
        return lastTag.trim();
      }
    } catch (error) {
      log.warn({error: error.message}, warnFailedToGetLastCreatedTag);
    }
    try {
      // If no tag is found, get the first commit hash
      const {stdout: firstCommitHash} = await exec('git', ['rev-list', '--max-parents=0', 'HEAD']);
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
      await exec('git', ['push', 'origin', tagName]);
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
      await exec('git', ['tag', '-d', tagName]);
      log.info({tagName}, infoTagDeleted);
    } catch (error) {
      log.warn({tagName, error}, warnFailedToDeleteTag);
    }

    // Remote tag deletion is optional and might not be necessary
    // // Also try to delete it from remote
    // try {
    //   await exec('git', ['push', 'origin', `:refs/tags/${tagName}`]);
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
      await exec('git', ['checkout', branchName]);
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
      await exec('git', ['checkout', '-b', branchName]);
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
  createVersion: async (version) => branch.create(`${getOptions().version_bump_prefix}_v${version}`),

  /**
   * Delete an existing branch from the repository (both local and remote).
   *
   * @param {string} branchName
   * @returns {Promise<void>}
   */
  remove: async (branchName) => {
    try {
      await exec('git', ['branch', '-d', branchName]);
      log.info({branchName}, infoBranchDeleted);
    } catch (error) {
      log.warn({branchName, error}, warnFailedToDeleteBranch);
    }

    // Also try to delete the branch from remote
    try {
      await exec('git', ['push', 'origin', '--delete', branchName]);
      log.info({branchName}, `Remote ${infoBranchDeleted.toLowerCase()}`);
    } catch (error) {
      log.warn({branchName, error}, `Failed to delete remote branch`);
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
      await exec('git', ['pull', 'origin', branchName]);
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
      await exec('git', ['push', 'origin', branchName]);
      log.info({branchName}, infoBranchPushed);
    } catch (error) {
      log.warn({branchName, error}, warnFailedToPushBranch);
    }
  },
};
