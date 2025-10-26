/** Tag service for version tag creation and management */

import type { GitService } from './GitService.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { Version } from '../types/version.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

export interface TagOptions {
  readonly shortTag?: boolean;
  readonly tagPrefix?: string;
}

/** Tag service for version tag creation and management */
export class TagService extends Loggable {
  private readonly gitService: GitService;

  constructor(gitService: GitService) {
    super();
    this.gitService = gitService;
    this.log.info('TagService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Create version tags for commit */
  async createVersionTags(
    version: Version,
    commitSha: string,
    options?: TagOptions,
  ): Promise<Result<string[], GitOperationError>> {
    this.log.debug({ version, commitSha, options }, 'Creating version tags');

    const createdTags: string[] = [];

    const masterTagResult = await this.createMasterTag(version, commitSha);
    if (!masterTagResult.ok) {
      return err(masterTagResult.error);
    }

    createdTags.push(masterTagResult.value);

    if (options?.shortTag) {
      const shortTagResult = await this.createShortTag(version, commitSha, masterTagResult.value);
      if (shortTagResult.ok && shortTagResult.value) {
        createdTags.push(shortTagResult.value);
      }
    }

    this.log.info({ tagCount: createdTags.length, tags: createdTags }, 'Tags created');
    return ok(createdTags);
  }

  /** Create version tags for branch HEAD */
  async createVersionTagsForBranch(
    version: Version,
    branch: string,
    options?: TagOptions,
  ): Promise<Result<string[], GitOperationError>> {
    this.log.debug({ version, branch }, 'Getting branch HEAD for tags');

    const commitSha = await this.getBranchHead(branch);
    if (!commitSha.ok) {
      return err(commitSha.error);
    }

    return this.createVersionTags(version, commitSha.value, options);
  }

  // ====================
  // Tag Creation
  // ====================

  /** Create master version tag */
  private async createMasterTag(version: Version, commitSha: string): Promise<Result<string, GitOperationError>> {
    const masterTag = `v${version}`;
    const result = await this.gitService.createTag({
      tagName: masterTag,
      message: `Release ${version}`,
      commitSha,
    });

    if (!result.ok) {
      return err(result.error);
    }

    this.log.debug({ tag: masterTag }, 'Master tag created');
    return ok(masterTag);
  }

  /** Create or update short version tag */
  private async createShortTag(
    version: Version,
    commitSha: string,
    masterTag: string,
  ): Promise<Result<string | null, GitOperationError>> {
    const shortTag = this.calculateShortTag(version, masterTag);

    if (shortTag === masterTag) {
      return ok(null);
    }

    await this.deleteExistingShortTag(shortTag);

    const result = await this.gitService.createTag({
      tagName: shortTag,
      message: `Release ${shortTag} (latest: ${version})`,
      commitSha,
    });

    if (!result.ok) {
      this.log.warn({ tag: shortTag, version }, 'Failed to create/update short tag');
      return ok(null);
    }

    this.log.info({ tag: shortTag, pointsTo: version }, 'Short tag created/updated');
    return ok(shortTag);
  }

  // ====================
  // Helpers
  // ====================

  /** Get branch HEAD commit SHA */
  private async getBranchHead(branch: string): Promise<Result<string, GitOperationError>> {
    const branchRef = `heads/${branch}`;
    const refResult = await this.gitService.getRef(branchRef);

    if (!refResult.ok) {
      this.log.error({ branch: branchRef }, 'Failed to get branch HEAD SHA');
      return err(refResult.error);
    }

    this.log.debug({ commitSha: refResult.value.sha, branch: branchRef }, 'Retrieved branch HEAD SHA');
    return ok(refResult.value.sha);
  }

  /** Calculate short tag name from version */
  private calculateShortTag(version: Version, masterTag: string): string {
    const parts = version.split('.');
    return parts.length >= 2 ? `v${parts[0]}` : masterTag;
  }

  /** Delete existing short tag if present */
  private async deleteExistingShortTag(shortTag: string): Promise<void> {
    const exists = await this.gitService.tagExists(shortTag);

    if (exists.ok && exists.value) {
      this.log.debug({ tag: shortTag }, 'Short tag exists, updating to latest version');
      const deleteResult = await this.gitService.deleteTag(shortTag);
      if (!deleteResult.ok) {
        this.log.warn({ tag: shortTag, error: deleteResult.error }, 'Failed to delete existing short tag');
      }
    } else {
      this.log.debug({ tag: shortTag }, 'Creating new short tag');
    }
  }
}
