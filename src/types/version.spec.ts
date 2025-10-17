/**
 * Tests for version type utilities
 */

import { describe, it, expect } from 'vitest';
import { isVersion, toVersion, type Version, type BumpType, type PreReleaseIdentifier } from './version.js';

describe('isVersion', () => {
  it('should validate valid semantic versions', () => {
    expect(isVersion('1.0.0')).toBe(true);
    expect(isVersion('0.0.1')).toBe(true);
    expect(isVersion('10.20.30')).toBe(true);
  });

  it('should validate pre-release versions', () => {
    expect(isVersion('1.0.0-alpha')).toBe(true);
    expect(isVersion('1.0.0-alpha.1')).toBe(true);
    expect(isVersion('1.0.0-beta.2')).toBe(true);
    expect(isVersion('1.0.0-rc.1')).toBe(true);
  });

  it('should validate versions with build metadata', () => {
    expect(isVersion('1.0.0+build.123')).toBe(true);
    expect(isVersion('1.0.0-alpha+build.123')).toBe(true);
  });

  it('should reject invalid versions', () => {
    expect(isVersion('1.0')).toBe(false);
    expect(isVersion('v1.0.0')).toBe(false);
    expect(isVersion('1.0.0.')).toBe(false);
    expect(isVersion('abc')).toBe(false);
    expect(isVersion('')).toBe(false);
  });
});

describe('toVersion', () => {
  it('should create branded Version from valid string', () => {
    const version = toVersion('1.0.0');
    expect(version).toBe('1.0.0');

    // Type test - this should compile
    const v: Version = version;
    expect(v).toBeDefined();
  });

  it('should throw for invalid version strings', () => {
    expect(() => toVersion('invalid')).toThrow('Invalid version format');
    expect(() => toVersion('1.0')).toThrow('Invalid version format');
  });
});

describe('BumpType', () => {
  it('should have correct type values', () => {
    const major: BumpType = 'major';
    const minor: BumpType = 'minor';
    const patch: BumpType = 'patch';
    const preRelease: BumpType = 'pre-release';

    expect([major, minor, patch, preRelease]).toEqual(['major', 'minor', 'patch', 'pre-release']);
  });
});

describe('PreReleaseIdentifier', () => {
  it('should have correct identifier values', () => {
    const alpha: PreReleaseIdentifier = 'alpha';
    const beta: PreReleaseIdentifier = 'beta';
    const rc: PreReleaseIdentifier = 'rc';

    expect([alpha, beta, rc]).toEqual(['alpha', 'beta', 'rc']);
  });
});
