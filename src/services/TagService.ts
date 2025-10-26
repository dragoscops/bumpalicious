/**
 * Tag Service
 *
 * Handles creation and management of version tags.
 * Supports both full version tags and short version tags.
 */

import type { GitService } from './GitService.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { Version } from '../types/version.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/**
 * Tag creation options
 */
export interface TagOptions {
  /** Create short version tag (e.g., v1) that points to latest */
  readonly shortTag?: boolean;
  /** Optional tag prefix */
  readonly tagPrefix?: string;
}

/**
 * Tag Service
 *
 * Creates and manages version tags:
 * - Full version tags (v1.2.3)
 * - Short version tags (v1) that auto-update
 */
export class TagService extends Loggable {
  private readonly gitService: GitService;

  constructor(gitService: GitService) {
    super();
    this.gitService = gitService;
    this.log.info('TagService initialized');
  }

  /**
   * Create version tags for a release
   * Creates master version tag and optionally a short version tag
   */
  async createVersionTags(
    version: Version,
    commitSha: string,
    options?: TagOptions,
  ): Promise<Result<string[], GitOperationError>> {
    this.log.debug({ version, commitSha, options }, 'Creating version tags');

    const createdTags: string[] = [];

    // Create master version tag
    const masterTag = `v${version}`;
    const masterTagResult = await this.gitService.createTag({
      tagName: masterTag,
      message: `Release ${version}`,
      commitSha,
    });

    if (!masterTagResult.ok) {
      return err(masterTagResult.error);
    }

    createdTags.push(masterTag);
    this.log.debug({ tag: masterTag }, 'Master tag created');

    // Create short tag if requested
    if (options?.shortTag) {
      const shortTagResult = await this.createShortTag(version, commitSha, masterTag);
      if (shortTagResult.ok && shortTagResult.value) {
        createdTags.push(shortTagResult.value);
      }
    }

    this.log.info({ tagCount: createdTags.length, tags: createdTags }, 'Tags created');
    return ok(createdTags);
  }

  /**
   * Create version tags using branch HEAD if no commit SHA provided
   */
  async createVersionTagsForBranch(
    version: Version,
    branch: string,
    options?: TagOptions,
  ): Promise<Result<string[], GitOperationError>> {
    this.log.debug({ version, branch }, 'Getting branch HEAD for tags');

    const branchRef = `heads/${branch}`;
    const refResult = await this.gitService.getRef(branchRef);

    if (!refResult.ok) {
      this.log.error({ branch: branchRef }, 'Failed to get branch HEAD SHA');
      return err(refResult.error);
    }

    const commitSha = refResult.value.sha;
    this.log.debug({ commitSha, branch: branchRef }, 'Retrieved branch HEAD SHA');

    return await this.createVersionTags(version, commitSha, options);
  }

  /**
   * Create or update short version tag (e.g., v1) to point to latest version
   */
  private async createShortTag(
    version: Version,
    commitSha: string,
    masterTag: string,
  ): Promise<Result<string | null, GitOperationError>> {
    const parts = version.split('.');
    const shortTag = parts.length >= 2 ? `v${parts[0]}` : masterTag;

    if (shortTag === masterTag) {
      return ok(null);
    }

    // Check if short tag exists and delete it (to force update)
    const shortTagExists = await this.gitService.tagExists(shortTag);
    if (shortTagExists.ok && shortTagExists.value) {
      this.log.debug({ tag: shortTag }, 'Short tag exists, updating to latest version');
      const deleteResult = await this.gitService.deleteTag(shortTag);
      if (!deleteResult.ok) {
        this.log.warn({ tag: shortTag, error: deleteResult.error }, 'Failed to delete existing short tag');
      }
    } else {
      this.log.debug({ tag: shortTag }, 'Creating new short tag');
    }

    // Create the short tag pointing to the latest version
    const shortTagResult = await this.gitService.createTag({
      tagName: shortTag,
      message: `Release ${shortTag} (latest: ${version})`,
      commitSha,
    });

    if (!shortTagResult.ok) {
      this.log.warn({ tag: shortTag, version }, 'Failed to create/update short tag');
      return ok(null);
    }

    this.log.info({ tag: shortTag, pointsTo: version }, 'Short tag created/updated to point to latest version');
    return ok(shortTag);
  }
}
