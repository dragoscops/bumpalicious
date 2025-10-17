/**
 * Version type definitions for semantic versioning
 */

/**
 * Branded type for semantic version strings
 * Ensures compile-time safety for version values
 */
export type Version = string & {readonly __brand: 'Version'};

/**
 * Type guard to validate and brand version strings
 */
export function isVersion(value: string): value is Version {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(value);
}

/**
 * Creates a branded Version from a string
 * @throws {Error} if the string is not a valid semantic version
 */
export function toVersion(value: string): Version {
  if (!isVersion(value)) {
    throw new Error(`Invalid version format: ${value}`);
  }
  return value;
}

/**
 * Bump type for version increments
 */
export type BumpType = 'major' | 'minor' | 'patch' | 'pre-release';

/**
 * Pre-release identifier types
 */
export type PreReleaseIdentifier = 'alpha' | 'beta' | 'rc';

/**
 * Analysis result from conventional commit parsing
 */
export interface CommitAnalysis {
  readonly type: BumpType;
  readonly breaking: boolean;
  readonly preRelease?: PreReleaseIdentifier;
  readonly scope?: string;
  readonly message: string;
}

/**
 * Version calculation result
 */
export interface VersionCalculation {
  readonly current: Version;
  readonly next: Version;
  readonly bump: BumpType;
  readonly commits: ReadonlyArray<CommitAnalysis>;
}
