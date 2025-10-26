/**
 * Local Git Operations Service
 *
 * Handles local git operations using shell commands via @actions/exec.
 * Used for creating commits, branches, and pushing to remote.
 */

import * as exec from '@actions/exec';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { WorkspaceTree } from '../types/workspace.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/**
 * Local Git Operations Service
 *
 * Executes git commands locally for:
 * - Configuring git user
 * - Creating commits
 * - Creating and pushing branches
 */
export class LocalGitService extends Loggable {
  constructor() {
    super();
    this.log.info('LocalGitService initialized');
  }

  /**
   * Configure git user for commits if not already set
   * Uses github-actions[bot] as default
   */
  async configureGit(): Promise<void> {
    try {
      // Check and configure user.name
      let hasUserName = false;
      await exec.exec('git', ['config', 'user.name'], {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            hasUserName = data.toString().trim().length > 0;
          },
        },
      });

      if (!hasUserName) {
        await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
        this.log.debug('Configured git user.name');
      }

      // Check and configure user.email
      let hasUserEmail = false;
      await exec.exec('git', ['config', 'user.email'], {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            hasUserEmail = data.toString().trim().length > 0;
          },
        },
      });

      if (!hasUserEmail) {
        await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
        this.log.debug('Configured git user.email');
      }
    } catch (error) {
      this.log.warn({ error }, 'Failed to configure git user, will proceed anyway');
    }
  }

  /**
   * Create and push version commit to current branch
   */
  async createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>> {
    this.log.debug({ version: tree.masterVersion }, 'Creating version commit');

    try {
      await this.configureGit();

      // Stage all changes
      await exec.exec('git', ['add', '-A']);

      // Create commit
      const commitMessage = `chore: bump version to ${tree.masterVersion}`;
      await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);

      // Get commit SHA
      let commitSha = '';
      await exec.exec('git', ['rev-parse', 'HEAD'], {
        listeners: {
          stdout: (data: Buffer) => {
            commitSha += data.toString().trim();
          },
        },
      });

      // Get current branch name
      let branchName = '';
      await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        listeners: {
          stdout: (data: Buffer) => {
            branchName += data.toString().trim();
          },
        },
      });

      // Push commit
      await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);

      this.log.info({ sha: commitSha, message: commitMessage }, 'Version commit created and pushed');
      return ok(commitSha);
    } catch (error) {
      const gitError = new GitOperationError('createVersionCommit', 'Failed to create version commit', error);
      this.log.error({ error: gitError }, 'Failed to create version commit');
      return err(gitError);
    }
  }

  /**
   * Create and push version branch for PR
   */
  async createVersionBranch(tree: WorkspaceTree, branchPrefix: string): Promise<Result<string, GitOperationError>> {
    // Add random suffix to avoid collisions on retry
    const randomSuffix = Math.floor(Math.random() * 10000).toString(36);
    const branchName = `${branchPrefix}/v${tree.masterVersion}-${randomSuffix}`;
    this.log.debug({ branch: branchName, version: tree.masterVersion }, 'Creating version branch');

    try {
      await this.configureGit();

      // Create and checkout new branch
      await exec.exec('git', ['checkout', '-b', branchName]);

      // Stage all changes
      await exec.exec('git', ['add', '-A']);

      // Create commit on the new branch
      const commitMessage = `chore: bump version to ${tree.masterVersion}`;
      await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);

      // Push the branch
      await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);

      this.log.info({ branch: branchName, message: commitMessage }, 'Version branch created and pushed');
      return ok(branchName);
    } catch (error) {
      const gitError = new GitOperationError('createVersionBranch', 'Failed to create version branch', error);
      this.log.error({ error: gitError }, 'Failed to create version branch');
      return err(gitError);
    }
  }
}
