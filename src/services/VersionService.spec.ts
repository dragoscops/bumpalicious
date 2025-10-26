/**
 * Unit tests for VersionService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionService } from './VersionService.js';
import { toVersion } from '../types/version.js';
import type { CommitAnalysis, Version } from '../types/version.js';
import { VersionCalculationError } from '../utils/errors.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('VersionService', () => {
  let service: VersionService;

  beforeEach(() => {
    service = new VersionService();
  });

  describe('calculateNewVersion', () => {
    describe('standard version bumps', () => {
      it('should bump minor version for feat commit', () => {
        const analysis: CommitAnalysis = {
          type: 'minor',
          breaking: false,
          message: 'feat: add new feature',
        };

        const result = service.calculateNewVersion('1.0.0', analysis);

        expect(result).toBe('1.1.0');
      });

      it('should bump patch version for fix commit', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          message: 'fix: bug fix',
        };

        const result = service.calculateNewVersion('1.0.0', analysis);

        expect(result).toBe('1.0.1');
      });

      it('should bump major version for breaking change', () => {
        const analysis: CommitAnalysis = {
          type: 'minor',
          breaking: true,
          message: 'feat!: breaking change',
        };

        const result = service.calculateNewVersion('1.0.0', analysis);

        expect(result).toBe('2.0.0');
      });

      it('should handle major bump type explicitly', () => {
        const analysis: CommitAnalysis = {
          type: 'major',
          breaking: true,
          message: 'BREAKING CHANGE: major update',
        };

        const result = service.calculateNewVersion('1.5.3', analysis);

        expect(result).toBe('2.0.0');
      });

      it('should bump from large version numbers', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          message: 'fix: small fix',
        };

        const result = service.calculateNewVersion('10.20.30', analysis);

        expect(result).toBe('10.20.31');
      });
    });

    describe('pre-release versions', () => {
      it('should create alpha pre-release for new feature', () => {
        const analysis: CommitAnalysis = {
          type: 'minor',
          breaking: false,
          preRelease: 'alpha',
          message: 'feat: feature pre-release:alpha',
        };

        const result = service.calculateNewVersion('1.0.0', analysis);

        expect(result).toBe('1.1.0-alpha.0');
      });

      it('should create beta pre-release for patch', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          preRelease: 'beta',
          message: 'fix: fix pre-release:beta',
        };

        const result = service.calculateNewVersion('1.0.0', analysis);

        expect(result).toBe('1.0.1-beta.0');
      });

      it('should create rc pre-release for major', () => {
        const analysis: CommitAnalysis = {
          type: 'major',
          breaking: true,
          preRelease: 'rc',
          message: 'feat!: breaking pre-release:rc',
        };

        const result = service.calculateNewVersion('1.5.0', analysis);

        expect(result).toBe('2.0.0-rc.0');
      });

      it('should increment existing alpha pre-release number', () => {
        const analysis: CommitAnalysis = {
          type: 'minor',
          breaking: false,
          preRelease: 'alpha',
          message: 'feat: another feature pre-release:alpha',
        };

        const result = service.calculateNewVersion('1.2.0-alpha.0', analysis);

        // Should NOT bump to 1.3.0-alpha.0, should increment pre-release number
        expect(result).toBe('1.2.0-alpha.1');
      });

      it('should increment beta pre-release number multiple times', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          preRelease: 'beta',
          message: 'fix: fix pre-release:beta',
        };

        let version: Version = toVersion('1.0.0-beta.0');

        // First increment
        version = service.calculateNewVersion(version, analysis);
        expect(version).toBe('1.0.0-beta.1');

        // Second increment
        version = service.calculateNewVersion(version, analysis);
        expect(version).toBe('1.0.0-beta.2');

        // Third increment
        version = service.calculateNewVersion(version, analysis);
        expect(version).toBe('1.0.0-beta.3');
      });

      it('should keep base version when switching pre-release identifier', () => {
        const analysisAlpha: CommitAnalysis = {
          type: 'minor',
          breaking: false,
          preRelease: 'alpha',
          message: 'feat: feature pre-release:alpha',
        };

        const analysisBeta: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          preRelease: 'beta',
          message: 'fix: fix pre-release:beta',
        };

        // Start with alpha
        const alphaVersion = service.calculateNewVersion('1.0.0', analysisAlpha);
        expect(alphaVersion).toBe('1.1.0-alpha.0');

        // Switch to beta - keeps same base version, new identifier
        const betaVersion = service.calculateNewVersion(alphaVersion, analysisBeta);
        expect(betaVersion).toBe('1.1.0-beta.0');
      });

      it('should handle transition from pre-release to stable', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          message: 'fix: release stable',
        };

        const result = service.calculateNewVersion('1.2.0-rc.5', analysis);

        // Should remove pre-release and bump to stable
        expect(result).toBe('1.2.0');
      });
    });

    describe('edge cases', () => {
      it('should handle version with build metadata', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          message: 'fix: bug fix',
        };

        const result = service.calculateNewVersion('1.0.0+build.123', analysis);

        expect(result).toBe('1.0.1');
      });

      it('should throw error for invalid current version', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          message: 'fix: bug fix',
        };

        expect(() => service.calculateNewVersion('invalid', analysis)).toThrow(VersionCalculationError);
      });

      it('should throw error for empty version string', () => {
        const analysis: CommitAnalysis = {
          type: 'patch',
          breaking: false,
          message: 'fix: bug fix',
        };

        expect(() => service.calculateNewVersion('', analysis)).toThrow(VersionCalculationError);
      });
    });
  });

  describe('increaseVersion', () => {
    it('should increment major version', () => {
      const result = service.increaseVersion(toVersion('1.2.3'), 'major');
      expect(result).toBe('2.0.0');
    });

    it('should increment minor version', () => {
      const result = service.increaseVersion(toVersion('1.2.3'), 'minor');
      expect(result).toBe('1.3.0');
    });

    it('should increment patch version', () => {
      const result = service.increaseVersion(toVersion('1.2.3'), 'patch');
      expect(result).toBe('1.2.4');
    });

    it('should treat pre-release bump type as patch', () => {
      const result = service.increaseVersion(toVersion('1.0.0'), 'pre-release');
      expect(result).toBe('1.0.1');
    });

    it('should remove pre-release info when bumping', () => {
      const result = service.increaseVersion(toVersion('1.2.3-alpha.0'), 'patch');
      expect(result).toBe('1.2.3');
    });

    it('should handle major bump from pre-release', () => {
      const result = service.increaseVersion(toVersion('1.2.3-beta.5'), 'major');
      expect(result).toBe('2.0.0');
    });

    it('should handle minor bump from pre-release', () => {
      const result = service.increaseVersion(toVersion('1.2.3-rc.1'), 'minor');
      expect(result).toBe('1.3.0');
    });
  });

  describe('pre-release logic integration', () => {
    it('should follow correct sequence for alpha releases', () => {
      const version: Version = toVersion('1.0.0');

      // First alpha
      const alpha0 = service.calculateNewVersion(version, {
        type: 'minor',
        breaking: false,
        preRelease: 'alpha',
        message: 'feat: feature pre-release:alpha',
      });
      expect(alpha0).toBe('1.1.0-alpha.0');

      // Second alpha - should increment pre-release number
      const alpha1 = service.calculateNewVersion(alpha0, {
        type: 'minor',
        breaking: false,
        preRelease: 'alpha',
        message: 'feat: another feature pre-release:alpha',
      });
      expect(alpha1).toBe('1.1.0-alpha.1');

      // Switch to beta - keeps same base version
      const beta0 = service.calculateNewVersion(alpha1, {
        type: 'patch',
        breaking: false,
        preRelease: 'beta',
        message: 'fix: beta testing pre-release:beta',
      });
      expect(beta0).toBe('1.1.0-beta.0');

      // Beta increment
      const beta1 = service.calculateNewVersion(beta0, {
        type: 'patch',
        breaking: false,
        preRelease: 'beta',
        message: 'fix: beta fix pre-release:beta',
      });
      expect(beta1).toBe('1.1.0-beta.1');

      // Release candidate - keeps same base version
      const rc0 = service.calculateNewVersion(beta1, {
        type: 'patch',
        breaking: false,
        preRelease: 'rc',
        message: 'chore: prepare rc pre-release:rc',
      });
      expect(rc0).toBe('1.1.0-rc.0');

      // Final stable release
      const stable = service.calculateNewVersion(rc0, {
        type: 'patch',
        breaking: false,
        message: 'chore: release stable',
      });
      expect(stable).toBe('1.1.0');
    });

    it('should handle breaking changes in pre-release', () => {
      const version = toVersion('1.5.0-alpha.2');

      const result = service.calculateNewVersion(version, {
        type: 'major',
        breaking: true,
        preRelease: 'alpha',
        message: 'feat!: breaking in alpha pre-release:alpha',
      });

      // Should increment alpha pre-release, not bump to 2.0.0-alpha.0
      expect(result).toBe('1.5.0-alpha.3');
    });

    it('should handle breaking change switching from alpha to beta', () => {
      const version = toVersion('1.5.0-alpha.2');

      const result = service.calculateNewVersion(version, {
        type: 'major',
        breaking: true,
        preRelease: 'beta',
        message: 'feat!: breaking in beta pre-release:beta',
      });

      // Should bump to major version with beta
      expect(result).toBe('2.0.0-beta.0');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical release workflow', () => {
      let version: Version = toVersion('1.0.0');

      // Feature 1
      version = service.calculateNewVersion(version, {
        type: 'minor',
        breaking: false,
        message: 'feat: add feature 1',
      });
      expect(version).toBe('1.1.0');

      // Bug fix
      version = service.calculateNewVersion(version, {
        type: 'patch',
        breaking: false,
        message: 'fix: fix bug in feature 1',
      });
      expect(version).toBe('1.1.1');

      // Feature 2
      version = service.calculateNewVersion(version, {
        type: 'minor',
        breaking: false,
        message: 'feat: add feature 2',
      });
      expect(version).toBe('1.2.0');

      // Breaking change
      version = service.calculateNewVersion(version, {
        type: 'major',
        breaking: true,
        message: 'feat!: breaking API change',
      });
      expect(version).toBe('2.0.0');
    });

    it('should handle pre-release cycle for major version', () => {
      let version: Version = toVersion('1.9.0');

      // Start v2 alpha
      version = service.calculateNewVersion(version, {
        type: 'major',
        breaking: true,
        preRelease: 'alpha',
        message: 'feat!: v2 alpha pre-release:alpha',
      });
      expect(version).toBe('2.0.0-alpha.0');

      // Alpha iterations
      version = service.calculateNewVersion(version, {
        type: 'minor',
        breaking: false,
        preRelease: 'alpha',
        message: 'feat: alpha feature pre-release:alpha',
      });
      expect(version).toBe('2.0.0-alpha.1');

      // Move to beta - keeps same base version
      version = service.calculateNewVersion(version, {
        type: 'patch',
        breaking: false,
        preRelease: 'beta',
        message: 'fix: beta testing pre-release:beta',
      });
      expect(version).toBe('2.0.0-beta.0');

      // Move to RC - keeps same base version
      version = service.calculateNewVersion(version, {
        type: 'patch',
        breaking: false,
        preRelease: 'rc',
        message: 'chore: rc pre-release:rc',
      });
      expect(version).toBe('2.0.0-rc.0');

      // Final release
      version = service.calculateNewVersion(version, {
        type: 'patch',
        breaking: false,
        message: 'chore: release v2.0.0',
      });
      expect(version).toBe('2.0.0');
    });
  });
});
