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

  describe('determineVersionIncreaseType(string)', () => {
    it('calls logging.error when commit message is empty or undefined', () => {
      determineVersionIncreaseType('');
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);

      determineVersionIncreaseType(undefined);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);

      determineVersionIncreaseType(null);
      setupLoggingCallsTest('error', [
        expect.stringContaining('ERROR:'),
        expect.stringContaining('No commit message provided'),
      ]);
    });

    it('returns "major" for breaking changes', () => {
      expect(determineVersionIncreaseType('BREAKING CHANGE: completely rewrote API')).toBe('major');
      expect(determineVersionIncreaseType('feat!: incompatible change')).toBe('major');
      expect(determineVersionIncreaseType('feat(!): another breaking change')).toBe('major');
      expect(determineVersionIncreaseType('something BREAKING-CHANGE something')).toBe('major');
      expect(determineVersionIncreaseType('BREAKING CHANGES: multiple changes')).toBe('major');
    });

    it('returns "minor" for new features', () => {
      expect(determineVersionIncreaseType('feat: added new feature')).toBe('minor');
      expect(determineVersionIncreaseType('feat(core): added new core feature')).toBe('minor');
    });

    it('returns "patch" for fixes', () => {
      expect(determineVersionIncreaseType('fix: fixed a bug')).toBe('patch');
      expect(determineVersionIncreaseType('fix(docs): fixed documentation')).toBe('patch');
    });

    it('returns null for other conventional commit types', () => {
      expect(determineVersionIncreaseType('docs: updated README')).toBeNull();
      expect(determineVersionIncreaseType('chore: updated dependencies')).toBeNull();
      expect(determineVersionIncreaseType('refactor: code improvements')).toBeNull();
      expect(determineVersionIncreaseType('test: added tests')).toBeNull();
      expect(determineVersionIncreaseType('style: formatting changes')).toBeNull();
      expect(determineVersionIncreaseType('ci: updated CI configuration')).toBeNull();
      expect(determineVersionIncreaseType('Random commit message')).toBeNull();
    });

    it('returns pre-release version types for pre-release commits', () => {
      expect(determineVersionIncreaseType('feat: added new feature with pre-release')).toBe('preminor');
      expect(determineVersionIncreaseType('fix: fixed a bug with pre-release')).toBe('prepatch');
      expect(determineVersionIncreaseType('BREAKING CHANGE: completely rewrote API with pre-release')).toBe('premajor');
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

  describe('increaseVersion(string, {ReleaseType, string})', () => {
    it('increases version according to type', () => {
      expect(increaseVersion('1.2.3', {type: 'major'})).toBe('2.0.0');
      expect(increaseVersion('1.2.3', {type: 'minor'})).toBe('1.3.0');
      expect(increaseVersion('1.2.3', {type: 'patch'})).toBe('1.2.4');
    });

    it('handles pre-release versions', () => {
      expect(increaseVersion('1.2.3', {type: 'premajor', identifier: 'alpha'})).toBe('2.0.0-alpha.0');
      expect(increaseVersion('1.2.3', {type: 'preminor', identifier: 'beta'})).toBe('1.3.0-beta.0');
      expect(increaseVersion('1.2.3', {type: 'prepatch', identifier: 'rc'})).toBe('1.2.4-rc.0');
      expect(increaseVersion('1.2.3-alpha.0', {type: 'prerelease', identifier: 'alpha'})).toBe('1.2.3-alpha.1');
    });

    it('handles release from pre-release versions', () => {
      expect(increaseVersion('1.2.3-alpha.0', {type: 'release'})).toBe('1.2.3');
      expect(increaseVersion('2.0.0-beta.5', {type: 'release'})).toBe('2.0.0');
    });

    it('returns original version for invalid inputs', () => {
      expect(increaseVersion('invalid', {type: 'major'})).toBe('invalid');
      expect(increaseVersion('1.2', {type: 'unknown'})).toBe('1.2');
    });
  });
});
