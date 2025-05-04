/**
 * Unit tests for version management functionality
 * @module core/version.spec
 */

import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import {determineVersionIncreaseType, determineVersionPreReleaseIdentifier, increaseVersion} from './version.js';
import {mockCConsole, setupLoggingCallsTest, unMockCConsole} from '../vitest/setup.logging.tests.js';

describe('core/version.js module', () => {
  beforeEach(() => {
    mockCConsole();
  });

  afterEach(() => {
    unMockCConsole();
  });

  describe('determineVersionIncreaseType(currentVersion, string)', () => {
    it('calls logging.error when commit message is empty or undefined', () => {
      determineVersionIncreaseType('1.0.0', '');
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);

      determineVersionIncreaseType('1.0.0', undefined);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);

      determineVersionIncreaseType('1.0.0', null);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);
    });

    it('calls logging.error when version is empty or undefined', () => {
      determineVersionIncreaseType('', 'feat: new feature');
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No version provided'),
      ]);

      determineVersionIncreaseType(undefined, 'feat: new feature');
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No version provided'),
      ]);

      determineVersionIncreaseType(null, 'feat: new feature');
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No version provided'),
      ]);
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

  describe('determineVersionPreReleaseIdentifier(string)', () => {
    it('calls logging.error when commit message is empty or undefined', () => {
      determineVersionPreReleaseIdentifier('');
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);

      determineVersionPreReleaseIdentifier(undefined);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);

      determineVersionPreReleaseIdentifier(null);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);
    });

    it('extracts pre-release identifier from commit messages', () => {
      expect(determineVersionPreReleaseIdentifier('feat: new feature pre-release: alpha')).toBe('alpha');
      expect(determineVersionPreReleaseIdentifier('fix: bug fix pre-release:beta')).toBe('beta');
      expect(determineVersionPreReleaseIdentifier('BREAKING CHANGE: API change pre-release: rc')).toBe('rc');
    });

    it('supports various identifier formats', () => {
      expect(determineVersionPreReleaseIdentifier('pre-release: alpha1')).toBe('alpha1');
      expect(determineVersionPreReleaseIdentifier('pre-release: beta-2')).toBe('beta-2');
      expect(determineVersionPreReleaseIdentifier('pre-release: rc_3')).toBe('rc_3');
      expect(determineVersionPreReleaseIdentifier('pre-release: next')).toBe('next');
    });

    it('returns null when no pre-release identifier is found', () => {
      expect(determineVersionPreReleaseIdentifier('feat: new feature')).toBeNull();
      expect(determineVersionPreReleaseIdentifier('pre-release without colon')).toBeNull();
      expect(determineVersionPreReleaseIdentifier('unrelated commit message')).toBeNull();
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

    it('returns the same version if no version changes are triggered', () => {
      expect(increaseVersion('1.2.3', 'docs: update readme')).toEqual('1.2.3');
      expect(increaseVersion('1.2.3', 'chore: update dependencies')).toEqual('1.2.3');
    });

    it('returns original version for invalid version inputs', () => {
      expect(increaseVersion('invalid', 'feat: new feature')).toBe('invalid');
    });
  });
});
