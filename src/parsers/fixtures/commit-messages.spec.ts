/**
 * Tests for commit message fixtures
 */

import { describe, it, expect } from 'vitest';
import {
  mockConventionalCommits,
  mockPreReleaseCommits,
  mockBreakingCommits,
  mockNonConventionalCommits,
  mockCommitMessages,
  mockCommitSequences,
} from './commit-messages.js';

describe('commit message fixtures', () => {
  describe('mockConventionalCommits', () => {
    it('should have feature commits', () => {
      expect(mockConventionalCommits.feat).toContain('feat:');
      expect(mockConventionalCommits.featWithScope).toMatch(/feat\(.+\):/);
    });

    it('should have fix commits', () => {
      expect(mockConventionalCommits.fix).toContain('fix:');
      expect(mockConventionalCommits.fixWithScope).toMatch(/fix\(.+\):/);
    });

    it('should have breaking change commits', () => {
      expect(mockConventionalCommits.featBreaking).toContain('feat!:');
      expect(mockConventionalCommits.featBreakingWithBody).toContain('BREAKING CHANGE:');
    });

    it('should have all conventional types', () => {
      const types = ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'test', 'perf', 'ci', 'build', 'revert'];

      for (const type of types) {
        const commit = mockConventionalCommits[type as keyof typeof mockConventionalCommits];
        expect(commit).toBeDefined();
        expect(commit).toContain(`${type}:`);
      }
    });
  });

  describe('mockPreReleaseCommits', () => {
    it('should contain pre-release markers', () => {
      expect(mockPreReleaseCommits.featAlpha).toContain('pre-release:alpha');
      expect(mockPreReleaseCommits.fixBeta).toContain('pre-release:beta');
      expect(mockPreReleaseCommits.featRc).toContain('pre-release:rc');
    });

    it('should have valid commit format before pre-release marker', () => {
      expect(mockPreReleaseCommits.featAlpha).toMatch(/^feat:/);
      expect(mockPreReleaseCommits.fixBeta).toMatch(/^fix:/);
    });
  });

  describe('mockBreakingCommits', () => {
    it('should have exclamation mark breaking changes', () => {
      expect(mockBreakingCommits.exclamation).toContain('!:');
      expect(mockBreakingCommits.exclamationWithScope).toMatch(/\(.+\)!:/);
    });

    it('should have footer breaking changes', () => {
      expect(mockBreakingCommits.footerBreaking).toContain('BREAKING CHANGE:');
      expect(mockBreakingCommits.bodyBreaking).toContain('BREAKING CHANGE:');
    });
  });

  describe('mockNonConventionalCommits', () => {
    it('should have invalid formats', () => {
      expect(mockNonConventionalCommits.simple).not.toMatch(/^\w+:/);
      expect(mockNonConventionalCommits.noColon).not.toContain(':');
    });

    it('should have empty/whitespace messages', () => {
      expect(mockNonConventionalCommits.emptyMessage).toBe('');
      expect(mockNonConventionalCommits.onlyWhitespace.trim()).toBe('');
    });
  });

  describe('mockCommitMessages groups', () => {
    it('featureMessages should all be feature commits', () => {
      for (const message of mockCommitMessages.featureMessages) {
        expect(message).toMatch(/^feat/);
      }
    });

    it('fixMessages should all be fix commits', () => {
      for (const message of mockCommitMessages.fixMessages) {
        expect(message).toMatch(/^fix/);
      }
    });

    it('breakingMessages should all indicate breaking changes', () => {
      for (const message of mockCommitMessages.breakingMessages) {
        const hasBreaking = message.includes('!:') || message.includes('BREAKING CHANGE:');
        expect(hasBreaking).toBe(true);
      }
    });

    it('nonBumpingMessages should not trigger version bumps', () => {
      const nonBumpingTypes = ['chore', 'docs', 'style', 'test', 'ci'];
      for (const message of mockCommitMessages.nonBumpingMessages) {
        const startsWithBumpType = message.startsWith('feat') || message.startsWith('fix');
        expect(startsWithBumpType).toBe(false);

        const matchesNonBumping = nonBumpingTypes.some((type) => message.startsWith(type));
        expect(matchesNonBumping).toBe(true);
      }
    });

    it('preReleaseMessages should have pre-release markers', () => {
      for (const message of mockCommitMessages.preReleaseMessages) {
        expect(message).toMatch(/pre-release:(alpha|beta|rc)/);
      }
    });

    it('invalidMessages should be non-conventional', () => {
      for (const message of mockCommitMessages.invalidMessages) {
        // Should not match conventional commit format: type(scope)?: message
        const isConventional = /^(feat|fix|chore|docs|style|refactor|test|perf|ci|build|revert)(\(.+\))?!?:/.test(
          message,
        );
        expect(isConventional).toBe(false);
      }
    });
  });

  describe('mockCommitSequences', () => {
    it('onlyFixes should only contain fix commits', () => {
      for (const commit of mockCommitSequences.onlyFixes) {
        expect(commit).toMatch(/^fix/);
      }
    });

    it('withFeatures should contain at least one feature', () => {
      const hasFeature = mockCommitSequences.withFeatures.some((c) => c.startsWith('feat'));
      expect(hasFeature).toBe(true);
    });

    it('withBreaking should contain breaking change', () => {
      const hasBreaking = mockCommitSequences.withBreaking.some(
        (c) => c.includes('!:') || c.includes('BREAKING CHANGE:'),
      );
      expect(hasBreaking).toBe(true);
    });

    it('withPreRelease should contain pre-release marker', () => {
      const hasPreRelease = mockCommitSequences.withPreRelease.some((c) => c.includes('pre-release:'));
      expect(hasPreRelease).toBe(true);
    });

    it('mixed should have various commit types', () => {
      const types = new Set(mockCommitSequences.mixed.map((c) => c.split(':')[0].split('(')[0]));
      expect(types.size).toBeGreaterThan(2);
    });
  });
});
