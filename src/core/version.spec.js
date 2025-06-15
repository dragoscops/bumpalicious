/**
 * Unit tests for version management functionality
 * @module core/version.spec
 */

import {describe, expect, it, beforeEach, afterEach} from 'vitest';
import {
  determineVersionIncreaseType,
  determineVersionPreReleaseIdentifier,
  increaseVersion,
  log,
  warnNoCommitMessageProvided,
  warnNoVersionProvided,
  warnInvalidVersionProvided,
  warnNoCommitMessageProvided,
  warnNoVersionProvided,
} from './version.js';
import {mockPinoIn, setupPinoLoggingCallsTest, unMockPinoIn} from '../vitest/setup.logging.tests.js';

describe('core/version.js module', () => {
  let logMocks = [];
  beforeEach(async () => {
    logMocks = await mockPinoIn(['core/version']);
  });

  afterEach(async () => {
    unMockPinoIn(logMocks);
  });

  describe('determineVersionIncreaseType(currentVersion, string)', () => {
    it('calls log.warn when commit message is empty or undefined', () => {
      determineVersionIncreaseType('1.0.0', '');
      setupPinoLoggingCallsTest('warn', [warnNoCommitMessageProvided], log);

      determineVersionIncreaseType('1.0.0', undefined);
      setupPinoLoggingCallsTest('warn', [warnNoCommitMessageProvided], log, 2);

      determineVersionIncreaseType('1.0.0', null);
      setupPinoLoggingCallsTest('warn', [warnNoCommitMessageProvided], log, 3);
    });

    it('calls log.warn when version is empty or undefined', () => {
      determineVersionIncreaseType('', 'feat: new feature');
      setupPinoLoggingCallsTest('warn', [warnNoVersionProvided], log);

      determineVersionIncreaseType(undefined, 'feat: new feature');
      setupPinoLoggingCallsTest('warn', [warnNoVersionProvided], log, 2);

      determineVersionIncreaseType(null, 'feat: new feature');
      setupPinoLoggingCallsTest('warn', [warnNoVersionProvided], log, 3);
    });

    it('calls log.warn and returns null for invalid version format', () => {
      const result = determineVersionIncreaseType('invalid-version', 'feat: new feature');
      expect(result).toBeNull();
      setupPinoLoggingCallsTest('warn', [{currentVersion: 'invalid-version'}, warnInvalidVersionProvided], log);

      const result2 = determineVersionIncreaseType('1.2', 'feat: new feature');
      expect(result2).toBeNull();
      setupPinoLoggingCallsTest('warn', [{currentVersion: '1.2'}, warnInvalidVersionProvided], log, 2);
    });

    it('returns "major" for breaking changes', () => {
      expect(determineVersionIncreaseType('1.0.0', 'BREAKING CHANGE: completely rewrote API')).toBe('major');
      expect(determineVersionIncreaseType('1.0.0', 'feat!: incompatible change')).toBe('major');
      expect(determineVersionIncreaseType('1.0.0', 'feat(!): another breaking change')).toBe('major');
      expect(determineVersionIncreaseType('1.0.0', 'something BREAKING-CHANGE something')).toBe('major');
      expect(determineVersionIncreaseType('1.0.0', 'BREAKING CHANGES: multiple changes')).toBe('major');
    });

    it('returns "minor" for new features', () => {
      expect(determineVersionIncreaseType('1.0.0', 'feat: added new feature')).toBe('minor');
      expect(determineVersionIncreaseType('1.0.0', 'feat(core): added new core feature')).toBe('minor');
    });

    it('returns "patch" for fixes', () => {
      expect(determineVersionIncreaseType('1.0.0', 'fix: fixed a bug')).toBe('patch');
      expect(determineVersionIncreaseType('1.0.0', 'fix(docs): fixed documentation')).toBe('patch');
    });

    it('returns null for other conventional commit types', () => {
      expect(determineVersionIncreaseType('1.0.0', 'docs: updated README')).toBeNull();
      expect(determineVersionIncreaseType('1.0.0', 'chore: updated dependencies')).toBeNull();
      expect(determineVersionIncreaseType('1.0.0', 'refactor: code improvements')).toBeNull();
      expect(determineVersionIncreaseType('1.0.0', 'test: added tests')).toBeNull();
      expect(determineVersionIncreaseType('1.0.0', 'style: formatting changes')).toBeNull();
      expect(determineVersionIncreaseType('1.0.0', 'ci: updated CI configuration')).toBeNull();
      expect(determineVersionIncreaseType('1.0.0', 'Random commit message')).toBeNull();
    });

    it('returns pre-release version types for pre-release commits', () => {
      expect(determineVersionIncreaseType('1.0.0', 'feat: added new feature with pre-release')).toBe('preminor');
      expect(determineVersionIncreaseType('1.0.0', 'fix: fixed a bug with pre-release')).toBe('prepatch');
      expect(determineVersionIncreaseType('1.0.0', 'BREAKING CHANGE: completely rewrote API with pre-release')).toBe(
        'premajor',
      );
    });

    it('returns prerelease for pre-release commits on existing pre-release versions', () => {
      expect(determineVersionIncreaseType('1.0.0-beta.0', 'chore: update with pre-release')).toBe('prerelease');
    });
  });

  describe('determineVersionPreReleaseIdentifier(currentVersion, string)', () => {
    it('calls log.warn when commit message is empty or undefined', () => {
      determineVersionPreReleaseIdentifier('1.0.0', '');
      setupPinoLoggingCallsTest('warn', [warnNoCommitMessageProvided], log);

      determineVersionPreReleaseIdentifier('1.0.0', undefined);
      setupPinoLoggingCallsTest('warn', [warnNoCommitMessageProvided], log, 2);

      determineVersionPreReleaseIdentifier('1.0.0', null);
      setupPinoLoggingCallsTest('warn', [warnNoCommitMessageProvided], log, 3);
    });

    it('calls log.warn when version is empty or undefined', () => {
      determineVersionPreReleaseIdentifier('', 'feat: new feature');
      setupPinoLoggingCallsTest('warn', [warnNoVersionProvided], log);

      determineVersionPreReleaseIdentifier(undefined, 'feat: new feature');
      setupPinoLoggingCallsTest('warn', [warnNoVersionProvided], log, 2);

      determineVersionPreReleaseIdentifier(null, 'feat: new feature');
      setupPinoLoggingCallsTest('warn', [warnNoVersionProvided], log, 3);
    });

    it('extracts pre-release identifier from commit messages', () => {
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'feat: new feature pre-release: alpha')).toBe('alpha');
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'fix: bug fix pre-release:beta')).toBe('beta');
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'BREAKING CHANGE: API change pre-release: rc')).toBe('rc');
    });

    it('supports various identifier formats', () => {
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'pre-release: alpha1')).toBe('alpha1');
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'pre-release: beta-2')).toBe('beta-2');
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'pre-release: rc_3')).toBe('rc_3');
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'pre-release: next')).toBe('next');
    });

    it('calls log.warn and returns null for invalid version format', () => {
      const result = determineVersionPreReleaseIdentifier('invalid-version', 'feat: new feature');
      expect(result).toBeNull();
      setupPinoLoggingCallsTest('warn', [{currentVersion: 'invalid-version'}, warnInvalidVersionProvided], log);

      const result2 = determineVersionPreReleaseIdentifier('1.2', 'feat: new feature');
      expect(result2).toBeNull();
      setupPinoLoggingCallsTest('warn', [{currentVersion: '1.2'}, warnInvalidVersionProvided], log, 2);
    });

    it('returns null when no pre-release identifier is found', () => {
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'feat: new feature')).toBeNull();
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'pre-release without colon')).toBeNull();
      expect(determineVersionPreReleaseIdentifier('1.0.0', 'unrelated commit message')).toBeNull();
    });

    it('returns existing prerelease identifier from current version when available', () => {
      expect(determineVersionPreReleaseIdentifier('1.0.0-alpha.0', 'chore: update without prerelease tag')).toBe(
        'alpha',
      );
      expect(determineVersionPreReleaseIdentifier('2.3.0-beta.5', 'fix: minor fix')).toBe('beta');
    });
  });

  describe('increaseVersion(string, string)', () => {
    it('increases version according to commit message type', () => {
      expect(increaseVersion('1.2.3', 'feat!: breaking change')).toBe('2.0.0');
      expect(increaseVersion('1.2.3', 'feat: add new feature')).toBe('1.3.0');
      expect(increaseVersion('1.2.3', 'fix: fix a bug')).toBe('1.2.4');
    });

    it('handles pre-release versions', () => {
      expect(increaseVersion('1.2.3', 'feat!: breaking change pre-release: alpha')).toBe('2.0.0-alpha.0');
      expect(increaseVersion('1.2.3', 'feat: add new feature pre-release: beta')).toBe('1.3.0-beta.0');
      expect(increaseVersion('1.2.3', 'fix: fix a bug pre-release: rc')).toBe('1.2.4-rc.0');
      expect(increaseVersion('1.2.3-alpha.0', 'chore: update pre-release: alpha')).toBe('1.2.3-alpha.1');
    });

    it('returns null if no version changes are triggered', () => {
      expect(increaseVersion('1.2.3', 'docs: update readme')).toBeNull();
      expect(increaseVersion('1.2.3', 'chore: update dependencies')).toBeNull();
    });

    it('returns null for invalid version inputs', () => {
      expect(increaseVersion('invalid', 'feat: new feature')).toBeNull();
    });
  });
});
