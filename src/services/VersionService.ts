/**
 * Version Service
 *
 * Calculates new semantic versions based on conventional commits and bump types.
 * Handles pre-release identifiers (alpha, beta, rc) with proper incrementing logic.
 *
 * Features:
 * - Semantic version calculation from commit analysis
 * - Pre-release version handling with increment logic
 * - Support for major, minor, patch, and pre-release bumps
 * - Branded Version type returns for type safety
 *
 * Usage:
 * ```typescript
 * const service = new VersionService();
 *
 * // Calculate version from commits
 * const analysis: CommitAnalysis = { type: 'minor', breaking: false, message: 'feat: new feature' };
 * const newVersion = service.calculateNewVersion('1.0.0', analysis);
 * // Returns: '1.1.0'
 *
 * // Calculate with pre-release
 * const preReleaseAnalysis: CommitAnalysis = {
 *   type: 'minor',
 *   breaking: false,
 *   preRelease: 'alpha',
 *   message: 'feat: feature pre-release:alpha'
 * };
 * const alphaVersion = service.calculateNewVersion('1.0.0', preReleaseAnalysis);
 * // Returns: '1.1.0-alpha.0'
 * ```
 */

import semver from 'semver';
import type { GitService } from './GitService.js';
import { analyzeCommitMessages } from '../parsers/ConventionalCommitParser.js';
import type { Result } from '../types/result.js';
import { err, ok } from '../types/result.js';
import type { BumpType, CommitAnalysis, PreReleaseIdentifier, Version } from '../types/version.js';
import { isVersion, toVersion } from '../types/version.js';
import type { Workspace, WorkspaceWithVersion } from '../types/workspace.js';
import { VersionCalculationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/**
 * Result of workspace version calculation
 */
export interface WorkspaceVersionResult {
  readonly workspaces: ReadonlyArray<WorkspaceWithVersion>;
  readonly hasConventionalCommits: boolean;
}

/**
 * Version Service for semantic version calculations
 */
export class VersionService extends Loggable {
  private readonly gitService?: GitService;

  /**
   * Create a new Version Service instance
   * @param gitService - Optional GitService for workspace version calculations
   */
  constructor(gitService?: GitService) {
    super();
    this.gitService = gitService;
    this.log.info('VersionService initialized');
  }

  /**
   * Calculate new versions for multiple workspaces based on commits
   *
   * @param workspaces - Workspaces to calculate versions for
   * @param lastTag - Last git tag (null for first version)
   * @param branch - Branch to get commits from
   * @returns Result with workspaces with calculated new versions and conventional commit info
   */
  async calculateVersionsForWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
    branch: string,
  ): Promise<Result<WorkspaceVersionResult, Error>> {
    if (!this.gitService) {
      return err(new VersionCalculationError('GitService is required for workspace version calculation'));
    }

    this.log.debug(
      {
        workspaceCount: workspaces.length,
        lastTag,
        branch,
      },
      'Calculating versions for workspaces',
    );

    // Get commits since last tag (use HEAD^ if no tag)
    const base = lastTag || 'HEAD^';
    const commitsResult = await this.gitService.getCommitsSince(base, branch);
    if (!commitsResult.ok) {
      return err(commitsResult.error);
    }

    const commits = commitsResult.value;
    const commitMessages = commits.map((c) => c.message);

    this.log.debug(
      {
        base,
        commitCount: commits.length,
        firstMessage: commitMessages[0],
        lastMessage: commitMessages[commitMessages.length - 1],
      },
      'Commits retrieved for version calculation',
    );

    const workspacesWithVersions: WorkspaceWithVersion[] = [];
    let hasConventionalCommits = false;

    for (const workspace of workspaces) {
      // Filter commits for this workspace
      // Root workspace gets all commits, others get all (simplified for now)
      const workspaceCommits = workspace.path === '.' ? commitMessages : commitMessages.filter(() => true); // TODO: Filter by workspace path

      this.log.debug({ workspace: workspace.path, commits: workspaceCommits.length }, 'Analyzing workspace commits');

      // Parse commits to get bump type and detect conventional commits
      const parseResult = analyzeCommitMessages(workspaceCommits);

      if (parseResult.hasConventionalCommits) {
        hasConventionalCommits = true;
      }

      if (parseResult.analysis) {
        // Conventional bumping commits found - calculate new version
        const newVersion = this.calculateNewVersion(workspace.version, parseResult.analysis);
        this.log.info(
          {
            workspace: workspace.path,
            oldVersion: workspace.version,
            newVersion,
            bumpType: parseResult.analysis.type,
            breaking: parseResult.analysis.breaking,
            preRelease: parseResult.analysis.preRelease,
          },
          'Version bumped based on conventional commits',
        );

        workspacesWithVersions.push({
          ...workspace,
          newVersion,
        });
      } else {
        // No bumping commits - version remains unchanged
        const reason = parseResult.hasConventionalCommits
          ? 'Only non-bumping conventional commits found (chore, docs, etc.)'
          : 'No conventional commits found';

        this.log.info(
          {
            workspace: workspace.path,
            version: workspace.version,
            commitCount: workspaceCommits.length,
            conventionalCommitCount: parseResult.conventionalCommitCount,
          },
          reason,
        );

        workspacesWithVersions.push({
          ...workspace,
          newVersion: workspace.version,
        });
      }
    }

    return ok({
      workspaces: workspacesWithVersions,
      hasConventionalCommits,
    });
  }

  /**
   * Calculate new version based on current version and commit analysis
   *
   * Algorithm:
   * 1. If breaking change detected → major bump
   * 2. If pre-release identifier present:
   *    - If current version has same pre-release identifier → increment pre-release number
   *    - Otherwise → bump base version and add pre-release with .0
   * 3. Otherwise → bump based on commit type (major/minor/patch)
   *
   * @param currentVersion - Current semantic version
   * @param analysis - Commit analysis with bump type and metadata
   * @returns New semantic version
   * @throws {VersionCalculationError} if version calculation fails
   *
   * @example
   * ```typescript
   * calculateNewVersion('1.0.0', { type: 'minor', breaking: false, message: 'feat: feature' })
   * // Returns: '1.1.0'
   *
   * calculateNewVersion('1.0.0', { type: 'major', breaking: true, message: 'feat!: breaking' })
   * // Returns: '2.0.0'
   *
   * calculateNewVersion('1.0.0', { type: 'minor', breaking: false, preRelease: 'alpha', message: '...' })
   * // Returns: '1.1.0-alpha.0'
   *
   * calculateNewVersion('1.2.0-alpha.0', { type: 'minor', breaking: false, preRelease: 'alpha', message: '...' })
   * // Returns: '1.2.0-alpha.1' (NOT 1.3.0-alpha.0)
   * ```
   */
  calculateNewVersion(currentVersion: string, analysis: CommitAnalysis): Version {
    this.log.debug(
      {
        currentVersion,
        bumpType: analysis.type,
        breaking: analysis.breaking,
        preRelease: analysis.preRelease,
        message: analysis.message?.substring(0, 100),
      },
      'Calculating new version',
    );

    // Validate input version
    if (!isVersion(currentVersion)) {
      this.log.error({ currentVersion }, 'Invalid current version format');
      throw new VersionCalculationError(`Invalid version format: ${currentVersion}`);
    }

    const current = toVersion(currentVersion);
    const { type, breaking, preRelease } = analysis;

    try {
      // Breaking change always triggers major bump (unless already in pre-release)
      const effectiveBumpType = breaking ? 'major' : type;

      // Handle pre-release versions
      if (preRelease) {
        return this.calculatePreReleaseVersion(current, effectiveBumpType, preRelease);
      }

      // Standard version bump
      const newVersion = this.increaseVersion(current, effectiveBumpType);

      this.log.info(
        {
          current,
          new: newVersion,
          bumpType: effectiveBumpType,
        },
        'Version calculated successfully',
      );

      return newVersion;
    } catch (error) {
      this.log.error(
        {
          current,
          bumpType: type,
          breaking,
          preRelease,
          error,
        },
        'Failed to calculate new version',
      );
      throw new VersionCalculationError(`Failed to calculate version from ${current}`, error);
    }
  }

  /**
   * Increase version by bump type
   *
   * Uses semver library for reliable version incrementing.
   *
   * @param currentVersion - Current semantic version
   * @param bumpType - Type of version bump (major, minor, patch)
   * @returns New semantic version
   * @throws {VersionCalculationError} if bump fails
   *
   * @example
   * ```typescript
   * increaseVersion('1.0.0', 'major') // Returns: '2.0.0'
   * increaseVersion('1.0.0', 'minor') // Returns: '1.1.0'
   * increaseVersion('1.0.0', 'patch') // Returns: '1.0.1'
   * increaseVersion('1.2.3-alpha.0', 'patch') // Returns: '1.2.3' (removes pre-release)
   * ```
   */
  increaseVersion(currentVersion: Version, bumpType: BumpType): Version {
    this.log.debug(
      {
        currentVersion,
        bumpType,
      },
      'Increasing version',
    );

    // Map 'pre-release' to 'patch' for base version bumping
    const semverBumpType = bumpType === 'pre-release' ? 'patch' : bumpType;

    const newVersion = semver.inc(currentVersion, semverBumpType);

    if (!newVersion) {
      throw new VersionCalculationError(`Failed to increment version ${currentVersion} with bump type ${bumpType}`);
    }

    if (!isVersion(newVersion)) {
      throw new VersionCalculationError(`Calculated version ${newVersion} is not a valid semantic version`);
    }

    return toVersion(newVersion);
  }

  /**
   * Calculate pre-release version
   *
   * Logic:
   * 1. Parse current version to check if it has pre-release info
   * 2. If current has same pre-release identifier → increment pre-release number
   * 3. Otherwise → bump base version and add pre-release with .0
   *
   * @param currentVersion - Current semantic version
   * @param bumpType - Type of version bump for base version
   * @param preReleaseId - Pre-release identifier (alpha, beta, rc)
   * @returns New pre-release version
   *
   * @example
   * ```typescript
   * // New pre-release
   * calculatePreReleaseVersion('1.0.0', 'minor', 'alpha')
   * // Returns: '1.1.0-alpha.0'
   *
   * // Increment existing pre-release
   * calculatePreReleaseVersion('1.2.0-alpha.0', 'minor', 'alpha')
   * // Returns: '1.2.0-alpha.1' (same base version, incremented pre-release)
   *
   * // Different pre-release identifier
   * calculatePreReleaseVersion('1.2.0-alpha.0', 'minor', 'beta')
   * // Returns: '1.3.0-beta.0' (bumped base version, new identifier)
   * ```
   */
  private calculatePreReleaseVersion(
    currentVersion: Version,
    bumpType: BumpType,
    preReleaseId: PreReleaseIdentifier,
  ): Version {
    const parsed = semver.parse(currentVersion);

    if (!parsed) {
      throw new VersionCalculationError(`Failed to parse version: ${currentVersion}`);
    }

    // Check if current version has pre-release info
    const currentPreRelease = parsed.prerelease;
    const hasPreRelease = currentPreRelease.length > 0;
    const currentPreReleaseId = hasPreRelease ? currentPreRelease[0] : null;
    const currentPreReleaseNum = hasPreRelease && typeof currentPreRelease[1] === 'number' ? currentPreRelease[1] : -1;

    this.log.debug(
      {
        currentVersion,
        currentPreReleaseId,
        currentPreReleaseNum,
        requestedPreReleaseId: preReleaseId,
        hasPreRelease,
      },
      'Analyzing pre-release version',
    );

    // If current version has same pre-release identifier → increment pre-release number only
    if (hasPreRelease && currentPreReleaseId === preReleaseId) {
      const nextPreReleaseNum = currentPreReleaseNum + 1;
      const newVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}-${preReleaseId}.${nextPreReleaseNum}`;

      if (!isVersion(newVersion)) {
        throw new VersionCalculationError(`Generated invalid pre-release version: ${newVersion}`);
      }

      this.log.info(
        {
          current: currentVersion,
          new: newVersion,
          preReleaseId,
          preReleaseNum: nextPreReleaseNum,
        },
        'Incremented pre-release number',
      );

      return toVersion(newVersion);
    }

    // Different pre-release identifier or no current pre-release → bump base version
    const semverBumpType = bumpType === 'pre-release' ? 'patch' : bumpType;
    const bumpedVersion = semver.inc(currentVersion, semverBumpType);

    if (!bumpedVersion) {
      throw new VersionCalculationError(
        `Failed to bump version ${currentVersion} with type ${bumpType} for pre-release`,
      );
    }

    // Add pre-release identifier with .0
    const newVersion = `${bumpedVersion}-${preReleaseId}.0`;

    if (!isVersion(newVersion)) {
      throw new VersionCalculationError(`Generated invalid pre-release version: ${newVersion}`);
    }

    this.log.info(
      {
        current: currentVersion,
        new: newVersion,
        baseVersionBumped: bumpedVersion,
        preReleaseId,
      },
      'Created new pre-release version',
    );

    return toVersion(newVersion);
  }
}
