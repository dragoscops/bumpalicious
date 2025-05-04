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
 * @link https://www.conventionalcommits.org/en/v1.0.0/#summary
 *
 * @param {string} commitMessage - Git commit message
 * @returns {ReleaseType | null} - Type of version increase or null for none
 */
export function determineVersionIncreaseType(commitMessage) {
  if (!commitMessage) {
    return logging.error('No commit message provided');
  }

  // If only "pre-release" is specified without any conventional commit indicator,
  // return "prerelease" directly to increment just the pre-release number
  if (
    commitMessage.includes('pre-release') &&
    !commitMessage.startsWith('feat:') &&
    !commitMessage.startsWith('fix:') &&
    !/^feat\([^)]+\):/.test(commitMessage) &&
    !/^fix\([^)]+\):/.test(commitMessage) &&
    !commitMessage.includes('BREAKING CHANGE') &&
    !commitMessage.includes('feat!:') &&
    !commitMessage.includes('feat(!)') &&
    !commitMessage.includes('BREAKING-CHANGE')
  ) {
    return 'prerelease';
  }

  // Check for BREAKING CHANGE or feat! for major version bump
  if (
    commitMessage.includes('BREAKING CHANGE') ||
    commitMessage.includes('feat!:') ||
    commitMessage.includes('feat(!)') ||
    commitMessage.includes('BREAKING-CHANGE')
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

/**
 * @typedef {Object} IncreaseVersionOptions
 * @property {ReleaseType} type - Type of version increase
 * @property {string} identifier - Suffix for pre-release version
 */

/**
 * Increase version according to semver rules
 *
 * @param {string} currentVersion - Current version
 * @param {IncreaseVersionOptions} options - Options for version increase
 * @returns {string} - New version
 */
export function increaseVersion(currentVersion, options) {
  const version = semver.parse(currentVersion);
  if (!version) {
    logging.error(`Invalid version: ${currentVersion}`);
    return currentVersion;
  }

  // // Special handling for pre-release versions
  // if (version.prerelease.length > 0 && options.identifier) {
  //   // If current version is already a pre-release with the same identifier,
  //   // and increment type is 'pre*', we should use 'prerelease' instead
  //   if (version.prerelease[0] === options.identifier && options.type.startsWith('pre')) {
  //     logging.info(`Detected existing pre-release version ${currentVersion} with identifier ${options.identifier}`);
  //     logging.info(`Changing version increment type from ${options.type} to prerelease`);

  //     // Just increment the pre-release number
  //     return semver.inc(currentVersion, 'prerelease', options.identifier);
  //   }
  // }

  return semver.inc(currentVersion, options.type, options.identifier);
}
