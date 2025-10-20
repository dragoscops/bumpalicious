/**
 * Mock version fixtures for testing
 *
 * Usage:
 * ```typescript
 * import { mockVersions, mockPreReleaseVersions } from '@/core/fixtures/versions.js';
 *
 * // Use in tests
 * const version = mockVersions.initial;
 * const preRelease = mockPreReleaseVersions.alpha;
 * ```
 */

import { toVersion } from '../../types/version.js';
import type { Version } from '../../types/version.js';

/**
 * Mock version strings for testing
 */
export const mockVersions = {
  initial: toVersion('0.1.0'),
  stable: toVersion('1.0.0'),
  minor: toVersion('1.1.0'),
  patch: toVersion('1.0.1'),
  major: toVersion('2.0.0'),
  preMajor: toVersion('1.9.9'),
  large: toVersion('10.20.30'),
};

/**
 * Mock pre-release versions
 */
export const mockPreReleaseVersions = {
  alpha: toVersion('1.0.0-alpha.0'),
  alphaNext: toVersion('1.0.0-alpha.1'),
  beta: toVersion('1.0.0-beta.0'),
  betaNext: toVersion('1.0.0-beta.1'),
  rc: toVersion('1.0.0-rc.0'),
  rcNext: toVersion('1.0.0-rc.1'),
  minorAlpha: toVersion('1.1.0-alpha.0'),
  majorBeta: toVersion('2.0.0-beta.0'),
};

/**
 * Mock version progression sequences
 */
export const mockVersionSequences = {
  /**
   * Normal semantic version progression
   */
  semantic: (): ReadonlyArray<Version> => [
    toVersion('1.0.0'),
    toVersion('1.0.1'), // patch
    toVersion('1.1.0'), // minor
    toVersion('2.0.0'), // major
  ],

  /**
   * Pre-release version progression
   */
  preRelease: (): ReadonlyArray<Version> => [
    toVersion('1.0.0'),
    toVersion('1.1.0-alpha.0'),
    toVersion('1.1.0-alpha.1'),
    toVersion('1.1.0-beta.0'),
    toVersion('1.1.0-rc.0'),
    toVersion('1.1.0'),
  ],

  /**
   * Major version progression
   */
  major: (): ReadonlyArray<Version> => [toVersion('1.0.0'), toVersion('2.0.0'), toVersion('3.0.0')],

  /**
   * Patch version progression
   */
  patch: (): ReadonlyArray<Version> => [toVersion('1.0.0'), toVersion('1.0.1'), toVersion('1.0.2'), toVersion('1.0.3')],
};

/**
 * Create a version with custom semver components
 */
export function mockVersionWith(major: number, minor: number, patch: number, preRelease?: string): Version {
  const base = `${major}.${minor}.${patch}`;
  return toVersion(preRelease ? `${base}-${preRelease}` : base);
}

/**
 * Mock version bump scenarios
 */
export const mockVersionBumps = {
  patchBump: {
    from: toVersion('1.0.0'),
    to: toVersion('1.0.1'),
    type: 'patch' as const,
  },
  minorBump: {
    from: toVersion('1.0.0'),
    to: toVersion('1.1.0'),
    type: 'minor' as const,
  },
  majorBump: {
    from: toVersion('1.0.0'),
    to: toVersion('2.0.0'),
    type: 'major' as const,
  },
  prePatchBump: {
    from: toVersion('1.0.0'),
    to: toVersion('1.0.1-alpha.0'),
    type: 'prepatch' as const,
    preRelease: 'alpha',
  },
  preMinorBump: {
    from: toVersion('1.0.0'),
    to: toVersion('1.1.0-beta.0'),
    type: 'preminor' as const,
    preRelease: 'beta',
  },
  preMajorBump: {
    from: toVersion('1.0.0'),
    to: toVersion('2.0.0-rc.0'),
    type: 'premajor' as const,
    preRelease: 'rc',
  },
  preReleaseIncrement: {
    from: toVersion('1.0.0-alpha.0'),
    to: toVersion('1.0.0-alpha.1'),
    type: 'prerelease' as const,
    preRelease: 'alpha',
  },
};
