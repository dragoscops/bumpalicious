/**
 * Tests for version fixtures
 */

import { describe, it, expect } from 'vitest';
import {
  mockVersions,
  mockPreReleaseVersions,
  mockVersionSequences,
  mockVersionWith,
  mockVersionBumps,
} from './versions.js';

describe('version fixtures', () => {
  describe('mockVersions', () => {
    it('should have valid semantic versions', () => {
      expect(mockVersions.initial).toMatch(/^\d+\.\d+\.\d+$/);
      expect(mockVersions.stable).toMatch(/^\d+\.\d+\.\d+$/);
      expect(mockVersions.minor).toMatch(/^\d+\.\d+\.\d+$/);
      expect(mockVersions.patch).toMatch(/^\d+\.\d+\.\d+$/);
      expect(mockVersions.major).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have different versions', () => {
      const versions = new Set([mockVersions.initial, mockVersions.stable, mockVersions.minor, mockVersions.patch]);
      expect(versions.size).toBe(4);
    });
  });

  describe('mockPreReleaseVersions', () => {
    it('should have valid pre-release versions', () => {
      expect(mockPreReleaseVersions.alpha).toMatch(/^\d+\.\d+\.\d+-alpha\.\d+$/);
      expect(mockPreReleaseVersions.beta).toMatch(/^\d+\.\d+\.\d+-beta\.\d+$/);
      expect(mockPreReleaseVersions.rc).toMatch(/^\d+\.\d+\.\d+-rc\.\d+$/);
    });

    it('should have incremental pre-release versions', () => {
      expect(mockPreReleaseVersions.alpha).toBe('1.0.0-alpha.0');
      expect(mockPreReleaseVersions.alphaNext).toBe('1.0.0-alpha.1');
      expect(mockPreReleaseVersions.beta).toBe('1.0.0-beta.0');
      expect(mockPreReleaseVersions.betaNext).toBe('1.0.0-beta.1');
    });
  });

  describe('mockVersionSequences', () => {
    it('semantic sequence should be in order', () => {
      const sequence = mockVersionSequences.semantic();
      expect(sequence[0]).toBe('1.0.0');
      expect(sequence[1]).toBe('1.0.1');
      expect(sequence[2]).toBe('1.1.0');
      expect(sequence[3]).toBe('2.0.0');
    });

    it('preRelease sequence should progress correctly', () => {
      const sequence = mockVersionSequences.preRelease();
      expect(sequence[0]).toBe('1.0.0');
      expect(sequence[1]).toBe('1.1.0-alpha.0');
      expect(sequence[2]).toBe('1.1.0-alpha.1');
      expect(sequence[3]).toBe('1.1.0-beta.0');
      expect(sequence[4]).toBe('1.1.0-rc.0');
      expect(sequence[5]).toBe('1.1.0');
    });

    it('major sequence should increment major version', () => {
      const sequence = mockVersionSequences.major();
      expect(sequence).toEqual(['1.0.0', '2.0.0', '3.0.0']);
    });

    it('patch sequence should increment patch version', () => {
      const sequence = mockVersionSequences.patch();
      expect(sequence).toEqual(['1.0.0', '1.0.1', '1.0.2', '1.0.3']);
    });
  });

  describe('mockVersionWith', () => {
    it('should create version with custom components', () => {
      const version = mockVersionWith(2, 5, 3);
      expect(version).toBe('2.5.3');
    });

    it('should create version with pre-release', () => {
      const version = mockVersionWith(1, 0, 0, 'alpha.5');
      expect(version).toBe('1.0.0-alpha.5');
    });
  });

  describe('mockVersionBumps', () => {
    it('should have correct patch bump', () => {
      expect(mockVersionBumps.patchBump.from).toBe('1.0.0');
      expect(mockVersionBumps.patchBump.to).toBe('1.0.1');
      expect(mockVersionBumps.patchBump.type).toBe('patch');
    });

    it('should have correct minor bump', () => {
      expect(mockVersionBumps.minorBump.from).toBe('1.0.0');
      expect(mockVersionBumps.minorBump.to).toBe('1.1.0');
      expect(mockVersionBumps.minorBump.type).toBe('minor');
    });

    it('should have correct major bump', () => {
      expect(mockVersionBumps.majorBump.from).toBe('1.0.0');
      expect(mockVersionBumps.majorBump.to).toBe('2.0.0');
      expect(mockVersionBumps.majorBump.type).toBe('major');
    });

    it('should have correct pre-release bumps', () => {
      expect(mockVersionBumps.prePatchBump.to).toBe('1.0.1-alpha.0');
      expect(mockVersionBumps.preMinorBump.to).toBe('1.1.0-beta.0');
      expect(mockVersionBumps.preMajorBump.to).toBe('2.0.0-rc.0');
    });

    it('should have correct pre-release increment', () => {
      expect(mockVersionBumps.preReleaseIncrement.from).toBe('1.0.0-alpha.0');
      expect(mockVersionBumps.preReleaseIncrement.to).toBe('1.0.0-alpha.1');
      expect(mockVersionBumps.preReleaseIncrement.type).toBe('prerelease');
    });
  });
});
