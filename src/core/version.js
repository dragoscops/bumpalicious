/**
 * Version management functionality
 * @module core/version
 */

import semver from 'semver';
import * as logging from '../utils/logging.js';

/**
 * @typedef {"major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease" | "release"} ReleaseType;
 */

/**
 * Determine version increase type from commit message
 *
 * @param {string} commitMessage - Git commit message
 * @returns {ReleaseType | null} - Type of version increase or null for none
 */
export const determineVersionIncreaseType = (commitMessage) => {
  if (!commitMessage) {
    return logging.error('No commit message provided');
  }

  // Check for BREAKING CHANGE or feat! for major version bump
  if (
    commitMessage.includes('BREAKING CHANGE') ||
    commitMessage.includes('feat!:') ||
    commitMessage.includes('feat(!)') ||
    commitMessage.includes('BREAKING-CHANGE') ||
    commitMessage.includes('BREAKING CHANGES')
  ) {
    if (commitMessage.includes('pre-release')) {
      return 'premajor';
    }
    return 'major';
  }

  if (commitMessage.startsWith('feat:') || /^feat\([^)]+\):/.test(commitMessage)) {
    if (commitMessage.includes('pre-release')) {
      return 'preminor';
    }
    return 'minor';
  }

  if (commitMessage.startsWith('fix:') || /^fix\([^)]+\):/.test(commitMessage)) {
    if (commitMessage.includes('pre-release')) {
      return 'prepatch';
    }
    return 'patch';
  }

  return null;
};

/**
 * Determine pre-release identifier from commit message
 *
 * @param {string} commitMessage - Git commit message
 * @returns {string|null} - Pre-release identifier or null if not found
 */
export const determineVersionPreReleaseIdentifier = (commitMessage) => {
  if (!commitMessage) {
    return logging.error('No commit message provided');
  }

  const preReleaseIdentifier = commitMessage.match(/pre-release\s*:\s*([a-zA-Z0-9-_]+)/);
  if (preReleaseIdentifier) {
    return preReleaseIdentifier[1];
  }

  return null;
};

/**
 * @typedef {Object} IncreaseVersionOptions
 * @property {ReleaseType} type - Type of version increase
 * @property {string} suffix - Suffix for pre-release version
 */

/**
 * Increase version according to semver rules
 *
 * @param {string} currentVersion - Current version
 * @param {IncreaseVersionOptions} options - Options for version increase
 * @returns {string} - New version
 */
export const increaseVersion = (currentVersion, options) => {
  const version = semver.parse(currentVersion);
  if (!version) {
    logging.error(`Invalid version: ${currentVersion}`);
    return currentVersion;
  }

  return semver.inc(currentVersion, options.type, options.suffix);
};
