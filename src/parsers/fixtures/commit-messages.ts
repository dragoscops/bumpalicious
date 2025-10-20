/**
 * Mock commit message fixtures for conventional commit parsing tests
 *
 * Usage:
 * ```typescript
 * import { mockCommitMessages, mockConventionalCommits } from '@/parsers/fixtures/commit-messages.js';
 *
 * // Use in tests
 * const commit = mockConventionalCommits.feat;
 * const messages = mockCommitMessages.featureMessages;
 * ```
 */

/**
 * Mock conventional commit messages
 */
export const mockConventionalCommits = {
  // Feature commits
  feat: 'feat: add new feature',
  featWithScope: 'feat(api): add authentication endpoint',
  featWithBody: `feat: add user profile

Implement user profile page with avatar upload
and bio editing functionality.`,
  featBreaking: 'feat!: remove deprecated API',
  featBreakingWithBody: `feat!: redesign configuration format

BREAKING CHANGE: Configuration now uses YAML instead of JSON.
Update your config files accordingly.`,

  // Fix commits
  fix: 'fix: resolve memory leak',
  fixWithScope: 'fix(auth): correct token validation',
  fixWithBody: `fix: handle edge case in parser

Fixed issue where parser would fail on empty input.
Added validation and error handling.`,

  // Chore commits
  chore: 'chore: update dependencies',
  choreWithScope: 'chore(deps): bump typescript to 5.9.3',

  // Docs commits
  docs: 'docs: update README with examples',
  docsWithScope: 'docs(api): add authentication guide',

  // Style commits
  style: 'style: format code with prettier',

  // Refactor commits
  refactor: 'refactor: simplify error handling',
  refactorWithScope: 'refactor(core): extract utility functions',

  // Test commits
  test: 'test: add integration tests',
  testWithScope: 'test(parser): add edge case tests',

  // Performance commits
  perf: 'perf: optimize database queries',
  perfWithScope: 'perf(api): cache frequently accessed data',

  // CI commits
  ci: 'ci: add GitHub Actions workflow',
  ciWithScope: 'ci(build): optimize Docker image',

  // Build commits
  build: 'build: configure TypeScript build',
  buildWithScope: 'build(deps): update build dependencies',

  // Revert commits
  revert: 'revert: undo breaking changes',
};

/**
 * Mock pre-release commit messages
 */
export const mockPreReleaseCommits = {
  featAlpha: 'feat: add experimental feature pre-release:alpha',
  fixBeta: 'fix: resolve beta issue pre-release:beta',
  featRc: 'feat: finalize feature for release pre-release:rc',
  minorAlpha: 'feat: new API endpoint pre-release:alpha',
  majorBeta: 'feat!: breaking change pre-release:beta',
  multiplePreRelease: 'feat: feature 1 pre-release:alpha\nfeat: feature 2 pre-release:alpha',
};

/**
 * Mock breaking change commits
 */
export const mockBreakingCommits = {
  exclamation: 'feat!: remove old API',
  exclamationWithScope: 'fix(auth)!: change token format',
  footerBreaking: `feat: update authentication

BREAKING CHANGE: JWT tokens now require 'Bearer' prefix.`,
  bodyBreaking: `refactor: restructure modules

This is a breaking change that affects all imports.
BREAKING CHANGE: Import paths have changed.`,
  multipleBreaking: `feat!: major refactor

BREAKING CHANGE: API endpoints restructured.
BREAKING CHANGE: Configuration format changed.`,
};

/**
 * Mock non-conventional commits
 */
export const mockNonConventionalCommits = {
  simple: 'add new feature',
  withColon: 'added: new feature',
  invalidType: 'invalid: update something',
  emptyMessage: '',
  onlyWhitespace: '   ',
  noColon: 'feat add feature',
};

/**
 * Grouped commit message collections
 */
export const mockCommitMessages = {
  /**
   * Messages that should trigger minor version bump
   */
  featureMessages: [
    mockConventionalCommits.feat,
    mockConventionalCommits.featWithScope,
    mockConventionalCommits.featWithBody,
  ],

  /**
   * Messages that should trigger patch version bump
   */
  fixMessages: [mockConventionalCommits.fix, mockConventionalCommits.fixWithScope, mockConventionalCommits.fixWithBody],

  /**
   * Messages that should trigger major version bump
   */
  breakingMessages: [
    mockConventionalCommits.featBreaking,
    mockConventionalCommits.featBreakingWithBody,
    mockBreakingCommits.exclamation,
    mockBreakingCommits.footerBreaking,
  ],

  /**
   * Messages that should NOT trigger version bump
   */
  nonBumpingMessages: [
    mockConventionalCommits.chore,
    mockConventionalCommits.docs,
    mockConventionalCommits.style,
    mockConventionalCommits.test,
    mockConventionalCommits.ci,
  ],

  /**
   * Pre-release messages
   */
  preReleaseMessages: [mockPreReleaseCommits.featAlpha, mockPreReleaseCommits.fixBeta, mockPreReleaseCommits.featRc],

  /**
   * Invalid/non-conventional messages
   */
  invalidMessages: [
    mockNonConventionalCommits.simple,
    mockNonConventionalCommits.invalidType,
    mockNonConventionalCommits.noColon,
  ],
};

/**
 * Mock commit message sequences (simulating git history)
 */
export const mockCommitSequences = {
  /**
   * Sequence with only fixes (should bump patch)
   */
  onlyFixes: [mockConventionalCommits.fix, mockConventionalCommits.fixWithScope],

  /**
   * Sequence with features (should bump minor)
   */
  withFeatures: [mockConventionalCommits.fix, mockConventionalCommits.feat, mockConventionalCommits.chore],

  /**
   * Sequence with breaking changes (should bump major)
   */
  withBreaking: [mockConventionalCommits.fix, mockConventionalCommits.feat, mockConventionalCommits.featBreaking],

  /**
   * Sequence with pre-release markers
   */
  withPreRelease: [mockConventionalCommits.fix, mockPreReleaseCommits.featAlpha],

  /**
   * Mixed sequence with various commit types
   */
  mixed: [
    mockConventionalCommits.docs,
    mockConventionalCommits.fix,
    mockConventionalCommits.feat,
    mockConventionalCommits.chore,
    mockConventionalCommits.test,
  ],
};
