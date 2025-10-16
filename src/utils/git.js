import path from 'node:path';
import {projectName} from '../constants.js';
import {exec} from './exec.js';
import {logger} from './logging.js';

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

/**
 * Get the root path of the Git repository
 *
 * @param {string} cwd - Current working directory
 * @returns {Promise<string|null>} - Root path of the Git repository or null on error
 */
export async function rootPath(cwd) {
  const {stdout} = await exec('git', ['rev-parse', '--show-toplevel'], {cwd});
  return stdout.trim();
}

export const config = {
  /**
   * Set git configuration options
   *
   * @param {Object.<string, string>} options - Key-value pairs of git configuration options to set
   * @param {boolean} [global=true] - Whether to set globally or locally
   * @returns {Promise<void>} - Will be killed by `exec` if it failes
   */
  set: async (options, global = true) => {
    for (const [key, value] of Object.entries(options)) {
      const args = ['config'];
      if (global) {
        args.push('--global');
      }
      args.push(key, value);
      await exec('git', args);
      log.info({key, value}, infoGitConfigSet);
    }
  },
};

/**
 * Commits Collection
 */
export const commits = {
  /**
   * Get the last commit message
   * @returns {Promise<string|null>} - Last commit message or null on error
   */
  lastMessage: async () => {
    const {stdout} = await exec('git', ['log', '-1', '--pretty=%B']);
    return stdout.trim();
  },

  /**
   * Get the list of files that have changed in a repository since the last tag.
   *
   * @param {string} repoPath - Path to the repository
   * @param {string} lastTag - Last git tag
   * @returns {Promise<string[]>} - Array of file paths that changed, empty array on error
   */
  getChangedFiles: async (repoPath, lastTag) => {
    // If no tag is provided, return all tracked files as changed
    if (!lastTag) {
      const {stdout} = await exec('git', ['ls-files'], {cwd: repoPath});
      return stdout.trim().split('\n').filter(Boolean);
    }

    const rootRepoPath = await rootPath(repoPath);
    const relativeRepoPath = path.relative(rootRepoPath, repoPath).replace(/\.[\\/]/, '') || '.';

    // Otherwise, retrieve changed files in the repository since the last tag
    const {stdout} = await exec('git', ['diff', lastTag, '--name-only', '--', relativeRepoPath], {
      cwd: rootRepoPath,
    });
    return stdout.trim().split('\n').filter(Boolean);
  },

  /**
   * Commit and push changes to remote repository
   *
   * @param {string} commitMessage - Commit message for the changes
   * @param {string} [branch='main'] - Branch to push to
   * @returns {Promise<void>}
   */
  createAndPush: async (commitMessage, branch = 'main') => {
    for (const args of [
      ['add', '-A'],
      ['commit', '-am', commitMessage, '--no-verify'],
      ['pull', 'origin', branch, '--ff-only'],
      ['push', 'origin', branch, '--force-with-lease', '--no-verify'],
    ]) {
      await exec('git', args);
    }
    log.info({commitMessage}, infoChangesCommitted);
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
    await exec('git', ['tag', '-a', tagName, '-m', message]);
    log.info({tagName}, infoTagCreated);
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
   * Test if a tag exists locally in the repository.
   *
   * @param {string} tagName
   * @returns {Promise<boolean>}
   */
  exists: async (tagName) => {
    const {stdout} = await exec('git', ['tag', '-l', tagName]);
    return stdout.trim() === tagName;
  },

  /**
   * Test if a tag exists on the remote repository.
   *
   * @param {string} tagName
   * @param {string} [remote='origin'] - Remote name to check
   * @returns {Promise<boolean>}
   */
  existsRemote: async (tagName, remote = 'origin') => {
    try {
      const {stdout} = await exec('git', ['ls-remote', '--tags', remote, `refs/tags/${tagName}`], {
        noThrow: true,
      });
      return stdout.trim().includes(`refs/tags/${tagName}`);
    } catch (err) {
      log.warn({tagName, remote, err}, 'Failed to check if remote tag exists');
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
    // Try to detect last created tag
    try {
      const {stdout: lastTag} = await exec('git', ['describe', '--tags', '--abbrev=0', '--match', '*'], {
        noThrow: true,
      });
      if (lastTag.trim()) {
        return lastTag.trim();
      }
    } catch (err) {
      log.warn({err}, warnFailedToGetLastCreatedTag);
    }

    // If no tag is found, get the first commit hash
    const {stdout: firstCommitHash} = await exec('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      env: {...process.env, GIT_TERMINAL_PROMPT: '0'},
    });
    return firstCommitHash.trim();
  },

  /**
   * Push a Git tag to the remote repository.
   *
   * @param {string} tagName
   * @returns {Promise<void>}
   */
  push: async (tagName) => {
    for (const args of [['fetch'], ['push', 'origin', tagName, '--no-verify']]) {
      await exec('git', args);
    }
    log.info({tagName}, infoTagPushed);
  },

  /**
   * Delete an existing Tag from the repository (both local and remote).
   *
   * @param {string} tagName
   * @returns {Promise<void>}
   */
  remove: async (tagName) => {
    await exec('git', ['tag', '-d', tagName]);
    log.info({tagName}, infoTagDeleted);

    // Also try to delete the tag from remote
    try {
      await exec('git', ['fetch'], {noThrow: true});
      const remoteTagExists = await tag.existsRemote(tagName);

      if (remoteTagExists) {
        const {exitCode} = await exec('git', ['push', 'origin', '--delete', tagName], {noThrow: true});
        if (exitCode === 0) {
          log.info({tagName}, infoRemoteTagDeleted);
        } else {
          log.warn({tagName}, warnCouldNotRemoveRemoteTag);
        }
      } else {
        log.info({tagName}, 'Remote tag does not exist, skipping remote deletion');
      }
    } catch (err) {
      log.warn({tagName, err}, warnCouldNotRemoveRemoteTag);
    }
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
    await exec('git', ['checkout', branchName]);
    log.info({branchName}, infoBranchCheckedOut);
  },

  /**
   * Create a new branch
   * @param {string} branchName
   * @returns {Promise<string|null>} - Branch name on success, null on error
   */
  create: async (branchName) => {
    await exec('git', ['checkout', '-b', branchName]);
    log.info({branchName}, infoBranchCreated);
    return branchName;
  },

  /**
   * Create a version branch
   * @param {string} version
   * @returns {Promise<string|null>} - Branch name on success, null on error
   */
  createAndPushVersion: async (version, prefix = 'version_bump') => {
    const branchName = await branch.create(`${prefix ? prefix + '_' : ''}v${version}`);
    await branch.push(branchName);
    return branchName;
  },

  /**
   * Delete an existing branch from the repository (both local and remote).
   *
   * @param {string} branchName
   * @returns {Promise<void>}
   */
  remove: async (branchName) => {
    await exec('git', ['branch', '-d', branchName]);
    log.info({branchName}, infoBranchDeleted);

    // Also try to delete the branch from remote
    for (const args of [['fetch'], ['push', 'origin', '--delete', branchName]]) {
      await exec('git', args);
    }
    log.info({branchName}, `Remote ${infoBranchDeleted.toLowerCase()}`);
  },

  /**
   * Pull changes from remote branch
   *
   * @param {string} branchName - Branch name to pull from
   * @returns {Promise<void>}
   */
  pull: async (branchName) => {
    await exec('git', ['pull', 'origin', branchName]);
    log.info({branchName}, infoBranchPulled);
  },

  /**
   * Push branch to remote repository
   *
   * @param {string} branchName - Branch name to push
   * @returns {Promise<void>}
   */
  push: async (branchName) => {
    await exec('git', ['push', 'origin', branchName, '--no-verify']);
    log.info({branchName}, infoBranchPushed);
  },
};
