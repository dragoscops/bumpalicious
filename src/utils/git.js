/**
 * Git operations utility
 * @module utils/git
 */

import {execa} from 'execa';
import npmGit from '@npmcli/git';
import * as logging from './logging.js';

export const platforms = {
  GITHUB: 'github',
  GITEA: 'gitea',
};

/**
 * Validates if the provided platform is supported.
 *
 * @param {string} platform - The platform to validate.
 * @throws {Error} If the platform is not supported.
 */
export function validatePlatform(platform) {
  if (!Object.values(platforms).includes(platform)) {
    logger.error(`Unsupported git platform: ${platform}`);
  }
}

/**
 * @typedef {ActionOptions & {workspace?: string}} SetupGitUserOptions
 */

/**
 * Configure git user for CI environments.
 *
 * @param {SetupGitUserOptions} options - Action configuration options.
 *   The object should include properties from ActionOptions, with an optional workspace property
 *   that defaults to the GITHUB_WORKSPACE or GITEA_WORKSPACE environment variable, or process.cwd().
 * @returns {Promise<void>} Resolves when configuration is complete.
 */
export async function setupUser({
  platform = 'github',
  workspace: workspacePath = process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || process.cwd(),
}) {
  try {
    switch (platform) {
      case platforms.GITHUB:
        // Set git user name and email for GitHub Actions
        await execa('git', ['config', '--global', 'user.name', 'GitHub Actions']);
        await execa('git', ['config', '--global', 'user.email', 'actions@github.com']);
        break;
      case platforms.GITEA:
        // Set git user name and email for Gitea CI
        await execa('git', ['config', '--global', 'user.name', 'Gitea CI']);
        await execa('git', ['config', '--global', 'user.email', 'ci@gitea.com']);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

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
 * Get the last Git tag in the repository
 *
 * @returns {Promise<string|null>} - Last git tag or null if no tags
 */
export async function lastCreatedTag() {
  try {
    // Get the most recent tag
    const {stdout} = await execa('git', ['describe', '--tags', '--abbrev=0']);
    return stdout.trim();
  } catch (error) {
    // If no tags exist, git command will fail with non-zero exit code
    console.log('No tags found in the repository');
    return null;
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
    // Format for stringContaining matcher
    logging.error(`Failed to get latest commit message: ${error.message}`);
    return ''; // Return empty string on error to match test expectations
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

// /**
//  * Retrieves the domain of the git repository's origin remote.
//  *
//  * @returns {Promise<string|null>} The domain (e.g., "github.com") if found; otherwise, null.
//  */
// async function repotDomain() {
//   try {
//     // Retrieve the remote URL of the origin
//     const {stdout} = await execa('git', ['remote', 'get-url', 'origin']);
//     const remoteUrl = stdout.trim();

//     let domain = null;

//     // Check for SSH format: git@domain:owner/repo.git
//     const sshRegex = /^git@([^:]+):/;
//     const sshMatch = remoteUrl.match(sshRegex);
//     if (sshMatch) {
//       domain = sshMatch[1];
//     } else {
//       // Check for HTTPS format: https://domain/owner/repo.git or http://domain/owner/repo.git
//       const httpsRegex = /^https?:\/\/([^/]+)\//;
//       const httpsMatch = remoteUrl.match(httpsRegex);
//       if (httpsMatch) {
//         domain = httpsMatch[1];
//       }
//     }

//     return domain;
//   } catch (err) {
//     logging.error('Error detecting git repository domain:', err);
//     return null;
//   }
// }

// /**
//  * Check if repository has uncommitted changes
//  *
//  * @returns {Promise<boolean>} - True if the repository has uncommitted changes
//  */
// export const hasUncommittedChanges = async () => {
//   try {
//     const {stdout} = await execa('git', ['status', '--porcelain']);
//     return stdout.trim().length > 0;
//   } catch (error) {
//     logging.error('Failed to check for uncommitted changes', error);
//     return true; // Err on the side of caution
//   }
// };

// /**
//  * Commit version changes
//  *
//  * @param {Object} options - Commit options
//  * @param {string} options.message - Commit message
//  * @param {Array<string>} [options.files=[]] - Files to commit (defaults to all changes)
//  * @param {boolean} [options.noVerify=false] - Skip git hooks when committing
//  * @returns {Promise<boolean>} - True if commit was successful
//  */
// export const commitVersionChanges = async ({message, files = [], noVerify = false}) => {
//   try {
//     // Add files to staging
//     if (files.length > 0) {
//       await execa('git', ['add', ...files]);
//     } else {
//       await execa('git', ['add', '.']);
//     }

//     // Create commit with optional no-verify flag for CI environments
//     const commitArgs = ['commit', '-m', message];
//     if (noVerify) {
//       commitArgs.push('--no-verify');
//     }

//     await execa('git', commitArgs);
//     logging.success(`Created commit: ${message}`);
//     return true;
//   } catch (error) {
//     logging.error('Failed to commit version changes', error);
//     return false;
//   }
// };

// /**
//  * Create a version tag
//  *
//  * @param {Object} options - Tag options
//  * @param {string} options.tagName - Name of the tag (e.g. v1.0.0)
//  * @param {string} options.message - Tag message
//  * @param {boolean} [options.force=false] - Force create tag (overwrite existing)
//  * @returns {Promise<boolean>} - True if tag was successful
//  */
// export const createVersionTag = async ({tagName, message, force = false}) => {
//   try {
//     // Create annotated tag with optional force flag
//     const tagArgs = ['tag', '-a', tagName, '-m', message];

//     if (force) {
//       tagArgs.push('-f');
//     }

//     await execa('git', tagArgs);
//     logging.success(`Created tag: ${tagName}`);
//     return true;
//   } catch (error) {
//     logging.error(`Failed to create version tag ${tagName}`, error);
//     return false;
//   }
// };

// /**
//  * Push changes and tags to remote repository
//  *
//  * @param {Object} options - Push options
//  * @param {string} [options.branch=''] - Branch to push to (defaults to current)
//  * @param {boolean} [options.forcePush=false] - Whether to force push
//  * @param {string} [options.remote='origin'] - Remote name
//  * @param {boolean} [options.noVerify=false] - Skip git hooks when pushing
//  * @returns {Promise<boolean>} - True if push was successful
//  */
// export const pushChanges = async ({branch = '', forcePush = false, remote = 'origin', noVerify = false}) => {
//   try {
//     // Push commits
//     const pushArgs = ['push'];

//     if (forcePush) {
//       pushArgs.push('--force');
//     }

//     if (noVerify) {
//       pushArgs.push('--no-verify');
//     }

//     pushArgs.push(remote);

//     if (branch) {
//       pushArgs.push(branch);
//     }

//     await execa('git', pushArgs);

//     // Push tags
//     const pushTagsArgs = ['push', remote, '--tags'];
//     if (noVerify) {
//       pushTagsArgs.splice(1, 0, '--no-verify');
//     }

//     await execa('git', pushTagsArgs);

//     logging.success(`Pushed changes and tags to ${remote}`);
//     return true;
//   } catch (error) {
//     logging.error('Failed to push changes', error);
//     return false;
//   }
// };

// /**
//  * Get remote URL for the specified remote
//  *
//  * @param {string} [remoteName='origin'] - Name of the remote
//  * @returns {Promise<string|null>} - Remote URL or null if not found
//  */
// export const getRemoteUrl = async (remoteName = 'origin') => {
//   try {
//     const {stdout} = await execa('git', ['remote', 'get-url', remoteName]);
//     return stdout.trim();
//   } catch (error) {
//     logging.error(`Failed to get URL for remote ${remoteName}`, error);
//     return null;
//   }
// };

// /**
//  * Get current branch name
//  *
//  * @returns {Promise<string|null>} - Current branch name or null if detached HEAD
//  */
// export const getCurrentBranch = async () => {
//   try {
//     const {stdout} = await execa('git', ['symbolic-ref', '--short', 'HEAD']);
//     return stdout.trim();
//   } catch (error) {
//     // In detached HEAD state, symbolic-ref will fail
//     logging.warning('Failed to get current branch name, might be in detached HEAD state');
//     return null;
//   }
// };
