/**
 * Conventional Commit Parser
 *
 * Parses conventional commit messages to determine version bump type.
 * Supports:
 * - Standard types: feat (minor), fix (patch)
 * - Breaking changes: feat! or BREAKING CHANGE: (major)
 * - Pre-release identifiers: pre-release:alpha
 * - Scopes: feat(api):
 *
 * @see https://www.conventionalcommits.org/
 *
 * Usage:
 * ```typescript
 * const analysis = parseConventionalCommit('feat: add new feature');
 * // { type: 'minor', breaking: false, scope: undefined, preRelease: undefined }
 * ```
 */

import type { CommitAnalysis, BumpType, PreReleaseIdentifier } from '../types/index.js';
import { logger } from '../utils/logger.js';

const childLogger = logger.child({ parser: 'ConventionalCommit' });

/**
 * Conventional commit types that trigger version bumps
 */
const BUMP_TYPES = {
  feat: 'minor',
  fix: 'patch',
} as const;

/**
 * Conventional commit types that do NOT trigger version bumps
 */
const NON_BUMP_TYPES = new Set(['chore', 'docs', 'style', 'refactor', 'test', 'perf', 'ci', 'build', 'revert']);

/**
 * Valid pre-release identifiers
 */
const VALID_PRE_RELEASE_IDENTIFIERS = new Set<string>(['alpha', 'beta', 'rc']);

/**
 * Regex for parsing conventional commit format
 * Matches: type(scope)?: description
 * Examples:
 * - feat: add feature
 * - feat(api): add endpoint
 * - feat!: breaking change
 * - fix(auth)!: breaking fix
 */
const CONVENTIONAL_COMMIT_REGEX = /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?\s*:\s*(?<description>.+)$/s;

/**
 * Regex for extracting pre-release identifier from commit message
 * Matches: pre-release:alpha, pre-release:beta, pre-release:rc
 */
const PRE_RELEASE_REGEX = /\bpre-release:(alpha|beta|rc)\b/i;

/**
 * Regex for detecting BREAKING CHANGE in commit body/footer
 * Matches: BREAKING CHANGE: description or BREAKING-CHANGE: description
 */
const BREAKING_CHANGE_FOOTER_REGEX = /^BREAKING[- ]CHANGE:\s+.+/im;

/**
 * Parse a conventional commit message and determine version bump type
 *
 * @param message - The commit message to parse
 * @returns CommitAnalysis object with bump type and metadata, or null if not a valid conventional commit
 *
 * @example
 * ```typescript
 * parseConventionalCommit('feat: add feature')
 * // { type: 'minor', breaking: false, message: 'feat: add feature' }
 *
 * parseConventionalCommit('fix: bug')
 * // { type: 'patch', breaking: false, message: 'fix: bug' }
 *
 * parseConventionalCommit('feat!: breaking')
 * // { type: 'major', breaking: true, message: 'feat!: breaking' }
 *
 * parseConventionalCommit('feat: feature pre-release:alpha')
 * // { type: 'minor', breaking: false, preRelease: 'alpha', message: '...' }
 *
 * parseConventionalCommit('chore: update deps')
 * // null (non-bumping commit)
 * ```
 */
export function parseConventionalCommit(message: string): CommitAnalysis | null {
  const trimmedMessage = message.trim();

  // Empty message
  if (!trimmedMessage) {
    return null;
  }

  // Parse conventional commit format
  const match = CONVENTIONAL_COMMIT_REGEX.exec(trimmedMessage);

  if (!match || !match.groups) {
    // Not a conventional commit
    return null;
  }

  const { type, scope, breaking } = match.groups;

  // Check for breaking change in footer/body
  const hasBreakingFooter = BREAKING_CHANGE_FOOTER_REGEX.test(trimmedMessage);
  const isBreaking = breaking === '!' || hasBreakingFooter;

  // Extract pre-release identifier
  const preReleaseMatch = PRE_RELEASE_REGEX.exec(trimmedMessage);
  const preReleaseIdentifier = preReleaseMatch ? (preReleaseMatch[1].toLowerCase() as PreReleaseIdentifier) : undefined;

  // Validate pre-release identifier
  if (preReleaseIdentifier && !VALID_PRE_RELEASE_IDENTIFIERS.has(preReleaseIdentifier)) {
    // Invalid pre-release identifier, treat as non-bumping
    return null;
  }

  // Determine bump type
  let bumpType: BumpType;

  if (isBreaking) {
    // Breaking changes are always major
    bumpType = 'major';
  } else if (type in BUMP_TYPES) {
    // feat → minor, fix → patch
    bumpType = BUMP_TYPES[type as keyof typeof BUMP_TYPES];
  } else if (NON_BUMP_TYPES.has(type)) {
    // Non-bumping types (chore, docs, etc.) → return null
    return null;
  } else {
    // Unknown type → return null
    return null;
  }

  return {
    type: bumpType,
    breaking: isBreaking,
    scope: scope || undefined,
    preRelease: preReleaseIdentifier,
    message: trimmedMessage,
  };
}

/**
 * Parse multiple commit messages and determine the highest version bump type
 *
 * Priority: major > minor > patch
 *
 * @param messages - Array of commit messages
 * @returns CommitAnalysis with highest bump type and aggregated metadata, or null if no valid bumps
 *
 * @example
 * ```typescript
 * parseCommitMessages(['fix: bug', 'feat: feature'])
 * // { type: 'minor', breaking: false, message: 'Combined analysis' }
 *
 * parseCommitMessages(['fix: bug', 'feat!: breaking'])
 * // { type: 'major', breaking: true, message: 'Combined analysis' }
 *
 * parseCommitMessages(['chore: update', 'docs: update'])
 * // null (no bumping commits)
 * ```
 */
export function parseCommitMessages(messages: string[]): CommitAnalysis | null {
  childLogger.debug({ messageCount: messages.length }, 'Parsing commit messages');
  if (messages.length === 0) {
    childLogger.debug('No messages to parse');
    return null;
  }

  let highestBump: BumpType | null = null;
  let hasBreaking = false;
  let preRelease: PreReleaseIdentifier | undefined;
  const scopes = new Set<string>();
  const validAnalyses: CommitAnalysis[] = [];

  for (const message of messages) {
    const analysis = parseConventionalCommit(message);

    // Skip non-bumping commits
    if (!analysis) {
      continue;
    }

    validAnalyses.push(analysis);

    // Track breaking changes
    if (analysis.breaking) {
      hasBreaking = true;
    }

    // Track scopes
    if (analysis.scope) {
      scopes.add(analysis.scope);
    }

    // Track pre-release (use last encountered)
    if (analysis.preRelease) {
      preRelease = analysis.preRelease;
    }

    // Determine highest bump type
    if (analysis.type === 'major') {
      highestBump = 'major';
    } else if (analysis.type === 'minor' && highestBump !== 'major') {
      highestBump = 'minor';
    } else if (analysis.type === 'patch' && !highestBump) {
      highestBump = 'patch';
    }
  }

  // No valid bumping commits found
  if (!highestBump || validAnalyses.length === 0) {
    return null;
  }

  return {
    type: highestBump,
    breaking: hasBreaking,
    scope: scopes.size > 0 ? Array.from(scopes).join(', ') : undefined,
    preRelease,
    message: `Combined analysis of ${validAnalyses.length} commit(s)`,
  };
}
