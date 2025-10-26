/**
 * End-to-End Single Workspace Tests
 *
 * Complete end-to-end workflow tests for single workspace scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdapter } from '../../src/core/adapters/AdapterFactory.js';
import { parseCommitMessages } from '../../src/parsers/ConventionalCommitParser.js';
import { VersionService } from '../../src/services/VersionService.js';
import { toVersion } from '../../src/types/version.js';
import { setupTestRepo, type TestRepo } from '../fixtures/repos/setup.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe('Single Workspace E2E', () => {
  let testRepo: TestRepo | null = null;
  let versionService: VersionService;

  beforeEach(() => {
    versionService = new VersionService();
  });

  afterEach(async () => {
    if (testRepo) {
      await testRepo.cleanup();
      testRepo = null;
    }
  });

  describe('Complete Workflow', () => {
    it('should detect, calculate, and update version for Node.js workspace', async () => {
      testRepo = await setupTestRepo('node');
      const adapter = getAdapter('node');

      // Step 1: Detect current version
      const detectResult = await adapter.detect(testRepo.repoPath);
      expect(detectResult.ok).toBe(true);

      const currentVersion = detectResult.ok ? detectResult.value.version : toVersion('1.0.0');

      // Step 2: Parse commits and calculate new version
      parseCommitMessages(['feat: add new feature']);
      const newVersion = versionService.calculateNewVersion(currentVersion, {
        type: 'minor',
        breaking: false,
        message: 'feat: add new feature',
      });

      expect(newVersion).toMatch(/^\d+\.\d+\.\d+$/);

      // Step 3: Update version
      const updateResult = await adapter.update(testRepo.repoPath, newVersion);
      expect(updateResult.ok).toBe(true);

      // Step 4: Verify update
      const verifyResult = await adapter.detect(testRepo.repoPath);
      expect(verifyResult.ok).toBe(true);
      if (verifyResult.ok) {
        expect(verifyResult.value.version).toBe(newVersion);
      }
    });
  });

  describe('Different Workspace Types', () => {
    it('should handle Python workspace end-to-end', async () => {
      testRepo = await setupTestRepo('python');
      const adapter = getAdapter('python');

      const detectResult = await adapter.detect(testRepo.repoPath);
      expect(detectResult.ok).toBe(true);

      if (detectResult.ok) {
        const newVersion = toVersion('2.0.0');
        const updateResult = await adapter.update(testRepo.repoPath, newVersion);
        expect(updateResult.ok).toBe(true);

        const verifyResult = await adapter.detect(testRepo.repoPath);
        expect(verifyResult.ok).toBe(true);
        if (verifyResult.ok) {
          expect(verifyResult.value.version).toBe('2.0.0');
        }
      }
    });

    it('should handle Go workspace end-to-end', async () => {
      testRepo = await setupTestRepo('go');
      const adapter = getAdapter('go');

      const detectResult = await adapter.detect(testRepo.repoPath);
      expect(detectResult.ok).toBe(true);
    });

    it('should handle Rust workspace end-to-end', async () => {
      testRepo = await setupTestRepo('rust');
      const adapter = getAdapter('rust');

      const detectResult = await adapter.detect(testRepo.repoPath);
      expect(detectResult.ok).toBe(true);
    });
  });

  describe('Version Calculation Scenarios', () => {
    it('should calculate minor bump for feat commits', () => {
      const version = versionService.calculateNewVersion(toVersion('1.0.0'), {
        type: 'minor',
        breaking: false,
        message: 'feat: new feature',
      });

      expect(version).toMatch(/^1\.1\.0/);
    });

    it('should calculate patch bump for fix commits', () => {
      const version = versionService.calculateNewVersion(toVersion('1.0.0'), {
        type: 'patch',
        breaking: false,
        message: 'fix: bug fix',
      });

      expect(version).toBe('1.0.1');
    });

    it('should calculate major bump for breaking changes', () => {
      const version = versionService.calculateNewVersion(toVersion('1.0.0'), {
        type: 'major',
        breaking: true,
        message: 'feat!: breaking change',
      });

      expect(version).toBe('2.0.0');
    });

    it('should handle pre-release versions', () => {
      const version = versionService.calculateNewVersion(toVersion('1.0.0'), {
        type: 'minor',
        breaking: false,
        preRelease: 'beta',
        message: 'feat: new feature',
      });

      expect(version).toMatch(/^1\.1\.0-beta\./);
    });
  });
});
