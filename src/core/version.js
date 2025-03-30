/**
 * Version management functionality
 * @module core/version
 */

import semver from 'semver';

/**
 * Determine version increase type from commit message
 *
 * @param {string} commitMessage - Git commit message
 * @returns {'major' | 'minor' | 'patch' | null} - Type of version increase or null for none
 */
export const determineVersionIncreaseType = (commitMessage) => {
  // Default to no increase
  let increaseType = null;

  if (!commitMessage) {
    return increaseType;
  }

  // Check for BREAKING CHANGE or feat! for major version bump
  if (
    commitMessage.includes('BREAKING CHANGE') ||
    commitMessage.includes('feat!:') ||
    commitMessage.includes('feat(!)') ||
    commitMessage.includes('BREAKING-CHANGE') ||
    commitMessage.includes('BREAKING CHANGES')
  ) {
    increaseType = 'major';
  }
  // Check for feat: for minor version bump
  else if (commitMessage.startsWith('feat:') || /^feat\([^)]+\):/.test(commitMessage)) {
    increaseType = 'minor';
  }
  // Check for fix: for patch version bump
  else if (commitMessage.startsWith('fix:') || /^fix\([^)]+\):/.test(commitMessage)) {
    increaseType = 'patch';
  }

  return increaseType;
};

/**
 * Normalize version string to valid semver
 *
 * @param {string} version - Version string to normalize
 * @returns {string} - Normalized semver version
 */
export const normalizeVersion = (version) => {
  // Remove leading 'v' or 'V' if present
  let normalizedVersion = version.trim().replace(/^[vV]/, '');

  // Try to parse as semver
  const parsed = semver.parse(normalizedVersion);

  if (parsed) {
    // Already a valid semver version
    return parsed.version;
  }

  // Try to handle simple version formats
  if (/^\d+$/.test(normalizedVersion)) {
    // Just a single number like "1"
    return `${normalizedVersion}.0.0`;
  } else if (/^\d+\.\d+$/.test(normalizedVersion)) {
    // Two numbers like "1.0"
    return `${normalizedVersion}.0`;
  } else if (/^\d+\.\d+\.\d+$/.test(normalizedVersion)) {
    // Already in the right format, but might not be valid semver
    return normalizedVersion;
  }

  // For more complex cases (pre-release, etc.), try to use semver coercion
  const coerced = semver.coerce(normalizedVersion);
  return coerced ? coerced.version : '0.1.0'; // Fallback to 0.1.0 if we can't parse
};

/**
 * Increase version according to semver rules
 *
 * @param {string} currentVersion - Current version
 * @param {string} type - Type of increase ('major', 'minor', 'patch')
 * @returns {string} - New version
 */
export const increaseVersion = (currentVersion, type) => {
  if (!type) {
    return currentVersion;
  }

  let normalized = normalizeVersion(currentVersion);

  switch (type) {
    case 'major':
      return semver.inc(normalized, 'major');
    case 'minor':
      return semver.inc(normalized, 'minor');
    case 'patch':
      return semver.inc(normalized, 'patch');
    default:
      return normalized;
  }
};
