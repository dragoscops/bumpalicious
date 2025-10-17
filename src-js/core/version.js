/**
 * Version management functionality
 * @module core/version
 */

import semver from 'semver';
import { logger } from '../utils/logging.js';
import { projectName } from '../constants.js';

export const log = logger.child({ module: `${projectName}/core/version` });

// Log message constants
export const infoDeterminedVersionIncreaseType = 'Determined version increase type from commit';
export const infoPreReleaseIdentifierFound = 'Pre-release identifier found in commit message';
export const infoPreReleaseIdentifierExtracted = 'Pre-release identifier extracted';

export const warnNoVersionProvided = 'No version provided';
export const warnInvalidVersionProvided = 'Invalid version provided';
export const warnNoCommitMessageProvided = 'No commit message provided';
export const warnNoVersionIncreaseNeeded = 'No version increase needed based on commit message';

// ...existing code...

/**
 * Increase version according to semver rules
 *
 * @param {string} currentVersion - Current version
 * @param {string} commitMessage - Git commit message
 * @returns {string|null} - New version
 */
export function increaseVersion(currentVersion, commitMessage) {
  const increaseType = determineVersionIncreaseType(currentVersion, commitMessage);

  if (!increaseType) {
    log.warn({ commitMessage }, warnNoVersionIncreaseNeeded);
    return null;
  }

  log.info({ increaseType, commitMessage }, infoDeterminedVersionIncreaseType);

  const preReleaseIdentifier = determineVersionPreReleaseIdentifier(currentVersion, commitMessage);
  if (preReleaseIdentifier) {
    log.info({ preReleaseIdentifier, commitMessage }, infoPreReleaseIdentifierFound);
  }

  const version = semver.parse(currentVersion);
  if (!version) {
    log.warn({ currentVersion }, warnInvalidVersionProvided);
    return null;
  }

  return semver.inc(currentVersion, increaseType, preReleaseIdentifier);
}

/**
 * @typedef {"major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease" | "release"} ReleaseType;
 */

/**
 * Determine version increase type from commit message
 * @link https://www.conventionalcommits.org/en/v1.0.0/#summary
 *
 * @param {string} currentVersion - Current version
 * @param {string} commitMessage - Git commit message
 * @returns {ReleaseType | null} - Type of version increase or null for none
 */
export function determineVersionIncreaseType(currentVersion, commitMessage) {
  if (!commitMessage) {
    log.warn(warnNoCommitMessageProvided);
    return null;
  }
  if (!currentVersion) {
    log.warn(warnNoVersionProvided);
    return null;
  }

  const version = semver.parse(currentVersion);
  if (!version) {
    log.warn({ currentVersion }, warnInvalidVersionProvided);
    return null;
  }

  if (commitMessage.includes('pre-release') && version.prerelease.length > 0) {
    return 'prerelease';
  }

  // Check for BREAKING CHANGE or feat! for major version bump
  if (
    commitMessage.includes('BREAKING CHANGE') ||
    commitMessage.includes('BREAKING-CHANGE') ||
    commitMessage.includes('feat!:') ||
    commitMessage.includes('feat(!)')
  ) {
    // For pre-existing pre-release versions, we'll handle this in workspaces.js
    if (commitMessage.includes('pre-release')) {
      return 'premajor';
    }
    return 'major';
  }

  if (commitMessage.startsWith('feat:') || /^feat\([^)]+\):/.test(commitMessage)) {
    // For pre-existing pre-release versions, we'll handle this in workspaces.js
    if (commitMessage.includes('pre-release')) {
      return 'preminor';
    }
    return 'minor';
  }

  if (commitMessage.startsWith('fix:') || /^fix\([^)]+\):/.test(commitMessage)) {
    // For pre-existing pre-release versions, we'll handle this in workspaces.js
    if (commitMessage.includes('pre-release')) {
      return 'prepatch';
    }
    return 'patch';
  }

  return null;
}

/**
 * Determine pre-release identifier from commit message
 *
 * @param {string} commitMessage - Git commit message
 * @returns {string|null} - Pre-release identifier or null if not found
 */
export function determineVersionPreReleaseIdentifier(currentVersion, commitMessage) {
  if (!commitMessage) {
    log.warn(warnNoCommitMessageProvided);
    return null;
  }
  if (!currentVersion) {
    log.warn(warnNoVersionProvided);
    return null;
  }

  // More flexible regex that handles:
  // 1. "pre-release:alpha" format (no space)
  // 2. "pre-release: alpha" format (with space)
  // 3. Case insensitivity
  const preReleaseRegex = /pre-release\s*:\s*([a-zA-Z0-9_-]+)/i;
  const preReleaseMatch = preReleaseRegex.exec(commitMessage);
  if (preReleaseMatch?.[1]) {
    log.info({ preReleaseIdentifier: preReleaseMatch[1] }, infoPreReleaseIdentifierExtracted);
    return preReleaseMatch[1];
  }

  const version = semver.parse(currentVersion);
  if (!version) {
    log.warn({ currentVersion }, warnInvalidVersionProvided);
    return null;
  }

  return version?.prerelease?.[0] || null;
}
