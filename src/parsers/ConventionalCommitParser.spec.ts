/**
 * Tests for Conventional Commit Parser
 */

import { describe, it, expect } from 'vitest';
import { parseConventionalCommit, parseCommitMessages } from './ConventionalCommitParser.js';
import {
  mockConventionalCommits,
  mockPreReleaseCommits,
  mockBreakingCommits,
  mockNonConventionalCommits,
  mockCommitSequences,
} from './fixtures/commit-messages.js';

describe('ConventionalCommitParser', () => {
  describe('parseConventionalCommit', () => {
    describe('feature commits', () => {
      it('should parse basic feature commit as minor bump', () => {
        const result = parseConventionalCommit(mockConventionalCommits.feat);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
        expect(result?.breaking).toBe(false);
        expect(result?.scope).toBeUndefined();
        expect(result?.preRelease).toBeUndefined();
      });

      it('should parse feature commit with scope', () => {
        const result = parseConventionalCommit(mockConventionalCommits.featWithScope);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
        expect(result?.scope).toBe('api');
        expect(result?.breaking).toBe(false);
      });

      it('should parse feature commit with body', () => {
        const result = parseConventionalCommit(mockConventionalCommits.featWithBody);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
        expect(result?.breaking).toBe(false);
      });
    });

    describe('fix commits', () => {
      it('should parse basic fix commit as patch bump', () => {
        const result = parseConventionalCommit(mockConventionalCommits.fix);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('patch');
        expect(result?.breaking).toBe(false);
      });

      it('should parse fix commit with scope', () => {
        const result = parseConventionalCommit(mockConventionalCommits.fixWithScope);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('patch');
        expect(result?.scope).toBe('auth');
      });

      it('should parse fix commit with body', () => {
        const result = parseConventionalCommit(mockConventionalCommits.fixWithBody);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('patch');
      });
    });

    describe('breaking changes', () => {
      it('should parse feat! as major bump', () => {
        const result = parseConventionalCommit(mockConventionalCommits.featBreaking);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
      });

      it('should parse breaking change with footer', () => {
        const result = parseConventionalCommit(mockConventionalCommits.featBreakingWithBody);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
      });

      it('should parse exclamation mark breaking changes', () => {
        const result = parseConventionalCommit(mockBreakingCommits.exclamation);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
      });

      it('should parse exclamation with scope', () => {
        const result = parseConventionalCommit(mockBreakingCommits.exclamationWithScope);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
        expect(result?.scope).toBe('auth');
      });

      it('should detect BREAKING CHANGE in footer', () => {
        const result = parseConventionalCommit(mockBreakingCommits.footerBreaking);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
      });

      it('should detect BREAKING CHANGE in body', () => {
        const result = parseConventionalCommit(mockBreakingCommits.bodyBreaking);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
      });
    });

    describe('pre-release commits', () => {
      it('should extract alpha pre-release identifier', () => {
        const result = parseConventionalCommit(mockPreReleaseCommits.featAlpha);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
        expect(result?.preRelease).toBe('alpha');
      });

      it('should extract beta pre-release identifier', () => {
        const result = parseConventionalCommit(mockPreReleaseCommits.fixBeta);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('patch');
        expect(result?.preRelease).toBe('beta');
      });

      it('should extract rc pre-release identifier', () => {
        const result = parseConventionalCommit(mockPreReleaseCommits.featRc);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
        expect(result?.preRelease).toBe('rc');
      });

      it('should handle pre-release with breaking change', () => {
        const result = parseConventionalCommit(mockPreReleaseCommits.majorBeta);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
        expect(result?.preRelease).toBe('beta');
      });
    });

    describe('non-bumping commits', () => {
      it('should return null for chore commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.chore);
        expect(result).toBeNull();
      });

      it('should return null for docs commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.docs);
        expect(result).toBeNull();
      });

      it('should return null for style commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.style);
        expect(result).toBeNull();
      });

      it('should return null for refactor commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.refactor);
        expect(result).toBeNull();
      });

      it('should return null for test commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.test);
        expect(result).toBeNull();
      });

      it('should return null for perf commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.perf);
        expect(result).toBeNull();
      });

      it('should return null for ci commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.ci);
        expect(result).toBeNull();
      });

      it('should return null for build commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.build);
        expect(result).toBeNull();
      });

      it('should return null for revert commits', () => {
        const result = parseConventionalCommit(mockConventionalCommits.revert);
        expect(result).toBeNull();
      });
    });

    describe('invalid commits', () => {
      it('should return null for non-conventional commits', () => {
        const result = parseConventionalCommit(mockNonConventionalCommits.simple);
        expect(result).toBeNull();
      });

      it('should return null for invalid type', () => {
        const result = parseConventionalCommit(mockNonConventionalCommits.invalidType);
        expect(result).toBeNull();
      });

      it('should return null for commit without colon', () => {
        const result = parseConventionalCommit(mockNonConventionalCommits.noColon);
        expect(result).toBeNull();
      });

      it('should return null for empty message', () => {
        const result = parseConventionalCommit(mockNonConventionalCommits.emptyMessage);
        expect(result).toBeNull();
      });

      it('should return null for whitespace-only message', () => {
        const result = parseConventionalCommit(mockNonConventionalCommits.onlyWhitespace);
        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should handle commits with multiple scopes', () => {
        const result = parseConventionalCommit('feat(api,auth): add feature');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
        expect(result?.scope).toBe('api,auth');
      });

      it('should trim whitespace from message', () => {
        const result = parseConventionalCommit('  feat: add feature  ');
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
      });

      it('should preserve original message', () => {
        const message = 'feat: add new feature';
        const result = parseConventionalCommit(message);
        expect(result).not.toBeNull();
        expect(result?.message).toBe(message);
      });
    });
  });

  describe('parseCommitMessages', () => {
    describe('single commit', () => {
      it('should handle single feature commit', () => {
        const result = parseCommitMessages([mockConventionalCommits.feat]);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
      });

      it('should handle single fix commit', () => {
        const result = parseCommitMessages([mockConventionalCommits.fix]);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('patch');
      });

      it('should handle single breaking commit', () => {
        const result = parseCommitMessages([mockConventionalCommits.featBreaking]);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
        expect(result?.breaking).toBe(true);
      });
    });

    describe('multiple commits - bump priority', () => {
      it('should prioritize major over minor', () => {
        const result = parseCommitMessages([mockConventionalCommits.feat, mockConventionalCommits.featBreaking]);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
      });

      it('should prioritize major over patch', () => {
        const result = parseCommitMessages([mockConventionalCommits.fix, mockConventionalCommits.featBreaking]);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
      });

      it('should prioritize minor over patch', () => {
        const result = parseCommitMessages([mockConventionalCommits.fix, mockConventionalCommits.feat]);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
      });

      it('should use highest bump from sequence', () => {
        const result = parseCommitMessages(mockCommitSequences.withBreaking);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('major');
      });
    });

    describe('only fixes', () => {
      it('should return patch for only fix commits', () => {
        const result = parseCommitMessages(mockCommitSequences.onlyFixes);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('patch');
        expect(result?.breaking).toBe(false);
      });
    });

    describe('with features', () => {
      it('should return minor when features present', () => {
        const result = parseCommitMessages(mockCommitSequences.withFeatures);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
      });
    });

    describe('non-bumping commits', () => {
      it('should return null for only non-bumping commits', () => {
        const result = parseCommitMessages([mockConventionalCommits.chore, mockConventionalCommits.docs]);
        expect(result).toBeNull();
      });

      it('should ignore non-bumping commits in mixed sequence', () => {
        const result = parseCommitMessages(mockCommitSequences.mixed);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
      });
    });

    describe('pre-release handling', () => {
      it('should extract pre-release from commits', () => {
        const result = parseCommitMessages(mockCommitSequences.withPreRelease);
        expect(result).not.toBeNull();
        expect(result?.preRelease).toBe('alpha');
      });

      it('should use last pre-release identifier when multiple present', () => {
        const result = parseCommitMessages([mockPreReleaseCommits.featAlpha, mockPreReleaseCommits.fixBeta]);
        expect(result).not.toBeNull();
        expect(result?.preRelease).toBe('beta');
      });
    });

    describe('scope aggregation', () => {
      it('should aggregate scopes from multiple commits', () => {
        const result = parseCommitMessages([
          mockConventionalCommits.featWithScope,
          mockConventionalCommits.fixWithScope,
        ]);
        expect(result).not.toBeNull();
        expect(result?.scope).toContain('api');
        expect(result?.scope).toContain('auth');
      });

      it('should not have scope when none present', () => {
        const result = parseCommitMessages([mockConventionalCommits.feat, mockConventionalCommits.fix]);
        expect(result).not.toBeNull();
        expect(result?.scope).toBeUndefined();
      });
    });

    describe('breaking change tracking', () => {
      it('should mark as breaking when any commit is breaking', () => {
        const result = parseCommitMessages([mockConventionalCommits.feat, mockConventionalCommits.featBreaking]);
        expect(result).not.toBeNull();
        expect(result?.breaking).toBe(true);
      });

      it('should not mark as breaking when no breaking commits', () => {
        const result = parseCommitMessages([mockConventionalCommits.feat, mockConventionalCommits.fix]);
        expect(result).not.toBeNull();
        expect(result?.breaking).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return null for empty array', () => {
        const result = parseCommitMessages([]);
        expect(result).toBeNull();
      });

      it('should handle large number of commits', () => {
        const commits = Array(100).fill(mockConventionalCommits.feat);
        const result = parseCommitMessages(commits);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('minor');
      });

      it('should include commit count in message', () => {
        const result = parseCommitMessages([mockConventionalCommits.feat, mockConventionalCommits.fix]);
        expect(result).not.toBeNull();
        expect(result?.message).toContain('2 commit');
      });
    });
  });
});
