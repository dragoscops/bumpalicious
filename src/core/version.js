/**
 * Version management functionality
 * @module core/version
 */

import semver from 'semver';
import * as logging from '../utils/logging.js';

/**
 * Increase version according to semver rules
 *
 * @param {string} currentVersion - Current version
 * @param {string} commitMessage - Git commit message
 * @returns {string} - New version
 */
export function increaseVersion(currentVersion, commitMessage) {
  const increaseType = determineVersionIncreaseType(currentVersion, commitMessage);

  if (!increaseType) {
    logging.warning(`No version increase needed based on commit message: ${commitMessage}`);
    return currentVersion;
  }

  logging.info(`Determined version increase type: ${increaseType} from commit: ${commitMessage}`);

  const preReleaseIdentifier = determineVersionPreReleaseIdentifier(commitMessage);
  if (preReleaseIdentifier) {
    logging.info(`Pre-release identifier found in commit message: ${preReleaseIdentifier}`);
  }

  const version = semver.parse(currentVersion);
  if (!version) {
    logging.error(`Invalid version: ${currentVersion}`);
    return currentVersion;
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
    return logging.error('No commit message provided');
  }
  if (!currentVersion) {
    return logging.error('No version provided');
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

  const version = semver.parse(currentVersion);
  if (commitMessage.includes('pre-release') && version.prerelease.length > 0) {
    return 'prerelease';
  }

  return null;
}

/**
 * Determine pre-release identifier from commit message
 *
 * @param {string} commitMessage - Git commit message
 * @returns {string|null} - Pre-release identifier or null if not found
 */
export function determineVersionPreReleaseIdentifier(commitMessage) {
  if (!commitMessage) {
    return logging.error('No commit message provided');
  }

  // More flexible regex that handles:
  // 1. "pre-release:alpha" format (no space)
  // 2. "pre-release: alpha" format (with space)
  // 3. Case insensitivity
  const preReleaseIdentifier = commitMessage.match(/pre-release\s*:\s*([a-zA-Z0-9\-_]+)/i);
  if (preReleaseIdentifier) {
    logging.info(`Extracted pre-release identifier: "${preReleaseIdentifier[1]}"`);
    return preReleaseIdentifier[1];
  }

  return null;
}
