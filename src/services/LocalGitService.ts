/** Local git operations via shell commands */

import * as exec from '@actions/exec';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { WorkspaceTree } from '../types/workspace.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/** Local git service for commits, branches, and configuration */
export class LocalGitService extends Loggable {
  constructor() {
    super();
    this.log.info('LocalGitService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Configure git user if not set */
  async configureGit(): Promise<void> {
    try {
      await this.ensureUserName();
      await this.ensureUserEmail();
    } catch (error) {
      this.log.warn({ error }, 'Failed to configure git user');
    }
  }

  /** Create and push version commit */
  async createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>> {
    this.log.debug({ version: tree.masterVersion }, 'Creating version commit');

    try {
      await this.configureGit();
      const commitMessage = this.buildCommitMessage(tree.masterVersion);

      await this.stageChanges();
      await this.createCommit(commitMessage);

      const commitSha = await this.getCommitSha();
      const branchName = await this.getCurrentBranch();

      await this.pushBranch(branchName);

      this.log.info({ sha: commitSha, message: commitMessage }, 'Version commit created and pushed');
      return ok(commitSha);
    } catch (error) {
      return this.handleError('createVersionCommit', 'Failed to create version commit', error);
    }
  }

  /** Create and push version branch for PR */
  async createVersionBranch(tree: WorkspaceTree, branchPrefix: string): Promise<Result<string, GitOperationError>> {
    const branchName = this.generateBranchName(branchPrefix, tree.masterVersion);
    this.log.debug({ branch: branchName, version: tree.masterVersion }, 'Creating version branch');

    try {
      await this.configureGit();
      const commitMessage = this.buildCommitMessage(tree.masterVersion);

      await this.createAndCheckoutBranch(branchName);
      await this.stageChanges();
      await this.createCommit(commitMessage);
      await this.pushBranch(branchName);

      this.log.info({ branch: branchName, message: commitMessage }, 'Version branch created and pushed');
      return ok(branchName);
    } catch (error) {
      return this.handleError('createVersionBranch', 'Failed to create version branch', error);
    }
  }

  // ====================
  // Git Configuration
  // ====================

  /** Ensure git user.name is configured */
  private async ensureUserName(): Promise<void> {
    const hasUserName = await this.checkGitConfig('user.name');
    if (!hasUserName) {
      await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
      this.log.debug('Configured git user.name');
    }
  }

  /** Ensure git user.email is configured */
  private async ensureUserEmail(): Promise<void> {
    const hasUserEmail = await this.checkGitConfig('user.email');
    if (!hasUserEmail) {
      await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
      this.log.debug('Configured git user.email');
    }
  }

  /** Check if git config key is set */
  private async checkGitConfig(key: string): Promise<boolean> {
    let hasValue = false;
    await exec.exec('git', ['config', key], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          hasValue = data.toString().trim().length > 0;
        },
      },
    });
    return hasValue;
  }

  // ====================
  // Git Operations
  // ====================

  /** Stage all changes */
  private async stageChanges(): Promise<void> {
    await exec.exec('git', ['add', '-A']);
  }

  /** Create commit with message */
  private async createCommit(message: string): Promise<void> {
    await exec.exec('git', ['commit', '-m', message, '--no-verify']);
  }

  /** Create and checkout new branch */
  private async createAndCheckoutBranch(branchName: string): Promise<void> {
    await exec.exec('git', ['checkout', '-b', branchName]);
  }

  /** Push branch to remote */
  private async pushBranch(branchName: string): Promise<void> {
    await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);
  }

  /** Get current commit SHA */
  private async getCommitSha(): Promise<string> {
    return this.captureGitOutput('rev-parse', 'HEAD');
  }

  /** Get current branch name */
  private async getCurrentBranch(): Promise<string> {
    return this.captureGitOutput('rev-parse', '--abbrev-ref', 'HEAD');
  }

  /** Capture git command output */
  private async captureGitOutput(...args: string[]): Promise<string> {
    let output = '';
    await exec.exec('git', args, {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString().trim();
        },
      },
    });
    return output;
  }

  // ====================
  // Helpers
  // ====================

  /** Build commit message for version */
  private buildCommitMessage(version: string): string {
    return `chore: bump version to ${version}`;
  }

  /** Generate branch name with random suffix */
  private generateBranchName(prefix: string, version: string): string {
    const randomSuffix = Math.floor(Math.random() * 10000).toString(36);
    return `${prefix}/v${version}-${randomSuffix}`;
  }

  /** Handle and wrap errors */
  private handleError(operation: string, message: string, error: unknown): Result<never, GitOperationError> {
    const gitError = new GitOperationError(operation, message, error);
    this.log.error({ error: gitError }, `${operation} failed`);
    return err(gitError);
  }
}
