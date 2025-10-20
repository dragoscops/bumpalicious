/**
 * Tests for Text Workspace Adapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectVersion, updateVersion, hasVersionFile, SUPPORTED_FILES, WORKSPACE_TYPE } from './TextAdapter.js';
import { toVersion } from '../../types/version.js';
import { isOk, isErr } from '../../types/result.js';

describe('TextAdapter', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `text-adapter-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('constants', () => {
    it('should have correct workspace type', () => {
      expect(WORKSPACE_TYPE).toBe('text');
    });

    it('should define supported files', () => {
      expect(SUPPORTED_FILES).toEqual(['VERSION', 'VERSION.txt', 'version', 'version.txt']);
    });
  });

  describe('detectVersion', () => {
    describe('VERSION file', () => {
      it('should detect version from VERSION file', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.0.0\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
          expect(result.value.name).toBe('');
        }
      });

      it('should handle VERSION file without newline', async () => {
        await writeFile(join(testDir, 'VERSION'), '2.3.4');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.3.4');
        }
      });

      it('should trim whitespace from VERSION', async () => {
        await writeFile(join(testDir, 'VERSION'), '  1.2.3  \n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.2.3');
        }
      });
    });

    describe('VERSION.txt file', () => {
      it('should detect version from VERSION.txt', async () => {
        await writeFile(join(testDir, 'VERSION.txt'), '3.2.1\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('3.2.1');
        }
      });
    });

    describe('version file (lowercase)', () => {
      it('should detect version from lowercase version file', async () => {
        await writeFile(join(testDir, 'version'), '0.1.0\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('0.1.0');
        }
      });
    });

    describe('version.txt file', () => {
      it('should detect version from version.txt', async () => {
        await writeFile(join(testDir, 'version.txt'), '5.0.0\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('5.0.0');
        }
      });
    });

    describe('file priority', () => {
      it('should prefer VERSION over VERSION.txt', async () => {
        // Only use files that don't conflict on case-insensitive filesystems
        await writeFile(join(testDir, 'VERSION'), '1.0.0\n');
        await writeFile(join(testDir, 'VERSION.txt'), '2.0.0\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }
      });

      it('should use VERSION.txt if VERSION not present', async () => {
        await writeFile(join(testDir, 'VERSION.txt'), '2.0.0\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.0.0');
        }
      });
    });

    describe('pre-release versions', () => {
      it('should detect pre-release version with alpha', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.0.0-alpha.0\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0-alpha.0');
        }
      });

      it('should detect pre-release version with beta', async () => {
        await writeFile(join(testDir, 'VERSION'), '2.1.0-beta.3\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('2.1.0-beta.3');
        }
      });

      it('should detect pre-release version with rc', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.5.0-rc.1\n');

        const result = await detectVersion(testDir);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.5.0-rc.1');
        }
      });
    });

    describe('error cases', () => {
      it('should return error when no version file exists', async () => {
        const result = await detectVersion(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('WORKSPACE_DETECTION_FAILED');
          expect(result.error.message).toContain('No version file found');
          expect(result.error.message).toContain('VERSION');
        }
      });

      it('should return error for empty version file', async () => {
        await writeFile(join(testDir, 'VERSION'), '');

        const result = await detectVersion(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('WORKSPACE_DETECTION_FAILED');
          expect(result.error.message).toContain('empty');
        }
      });

      it('should return error for whitespace-only file', async () => {
        await writeFile(join(testDir, 'VERSION'), '   \n  \n');

        const result = await detectVersion(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('WORKSPACE_DETECTION_FAILED');
          expect(result.error.message).toContain('empty');
        }
      });

      it('should return error for invalid version format', async () => {
        await writeFile(join(testDir, 'VERSION'), 'not-a-version\n');

        const result = await detectVersion(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('WORKSPACE_DETECTION_FAILED');
          expect(result.error.message).toContain('Invalid version format');
        }
      });

      it('should return error for partial version', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.0\n');

        const result = await detectVersion(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Invalid version format');
        }
      });

      it('should return error for version with invalid characters', async () => {
        await writeFile(join(testDir, 'VERSION'), 'v1.0.0\n');

        const result = await detectVersion(testDir);

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('Invalid version format');
        }
      });
    });
  });

  describe('updateVersion', () => {
    describe('successful updates', () => {
      it('should update existing VERSION file', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.0.0\n');

        const result = await updateVersion(testDir, toVersion('2.0.0'));

        expect(isOk(result)).toBe(true);

        // Verify the update
        const detection = await detectVersion(testDir);
        expect(isOk(detection)).toBe(true);
        if (isOk(detection)) {
          expect(detection.value.version).toBe('2.0.0');
        }
      });

      it('should update VERSION.txt file', async () => {
        await writeFile(join(testDir, 'VERSION.txt'), '1.0.0\n');

        const result = await updateVersion(testDir, toVersion('1.5.0'));

        expect(isOk(result)).toBe(true);

        const detection = await detectVersion(testDir);
        expect(isOk(detection)).toBe(true);
        if (isOk(detection)) {
          expect(detection.value.version).toBe('1.5.0');
        }
      });

      it('should update lowercase version file', async () => {
        await writeFile(join(testDir, 'version'), '0.1.0\n');

        const result = await updateVersion(testDir, toVersion('0.2.0'));

        expect(isOk(result)).toBe(true);

        const detection = await detectVersion(testDir);
        expect(isOk(detection)).toBe(true);
        if (isOk(detection)) {
          expect(detection.value.version).toBe('0.2.0');
        }
      });

      it('should add newline to version', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.0.0');

        await updateVersion(testDir, toVersion('2.0.0'));

        const content = await import('node:fs/promises').then((fs) => fs.readFile(join(testDir, 'VERSION'), 'utf-8'));
        expect(content).toBe('2.0.0\n');
      });

      it('should update pre-release version', async () => {
        await writeFile(join(testDir, 'VERSION'), '1.0.0\n');

        const result = await updateVersion(testDir, toVersion('1.1.0-alpha.0'));

        expect(isOk(result)).toBe(true);

        const detection = await detectVersion(testDir);
        expect(isOk(detection)).toBe(true);
        if (isOk(detection)) {
          expect(detection.value.version).toBe('1.1.0-alpha.0');
        }
      });
    });

    describe('error cases', () => {
      it('should return error when no version file exists', async () => {
        const result = await updateVersion(testDir, toVersion('1.0.0'));

        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe('FILE_OPERATION_FAILED');
          expect(result.error.message).toContain('No version file found');
        }
      });

      it('should handle read-only directory gracefully', async () => {
        // Create a version file first
        await writeFile(join(testDir, 'VERSION'), '1.0.0\n');

        // Make directory read-only (skip on Windows where this is complex)
        if (process.platform !== 'win32') {
          await import('node:fs/promises').then((fs) => fs.chmod(testDir, 0o444));

          const result = await updateVersion(testDir, toVersion('2.0.0'));

          expect(isErr(result)).toBe(true);
          if (isErr(result)) {
            expect(result.error.code).toBe('FILE_OPERATION_FAILED');
          }

          // Restore permissions for cleanup
          await import('node:fs/promises').then((fs) => fs.chmod(testDir, 0o755));
        }
      });
    });
  });

  describe('hasVersionFile', () => {
    it('should return true when VERSION exists', async () => {
      await writeFile(join(testDir, 'VERSION'), '1.0.0\n');

      const result = await hasVersionFile(testDir);

      expect(result).toBe(true);
    });

    it('should return true when VERSION.txt exists', async () => {
      await writeFile(join(testDir, 'VERSION.txt'), '1.0.0\n');

      const result = await hasVersionFile(testDir);

      expect(result).toBe(true);
    });

    it('should return true when version exists', async () => {
      await writeFile(join(testDir, 'version'), '1.0.0\n');

      const result = await hasVersionFile(testDir);

      expect(result).toBe(true);
    });

    it('should return true when version.txt exists', async () => {
      await writeFile(join(testDir, 'version.txt'), '1.0.0\n');

      const result = await hasVersionFile(testDir);

      expect(result).toBe(true);
    });

    it('should return false when no version file exists', async () => {
      const result = await hasVersionFile(testDir);

      expect(result).toBe(false);
    });

    it('should return true when multiple version files exist', async () => {
      await writeFile(join(testDir, 'VERSION'), '1.0.0\n');
      await writeFile(join(testDir, 'version'), '2.0.0\n');

      const result = await hasVersionFile(testDir);

      expect(result).toBe(true);
    });
  });

  describe('integration with test fixtures', () => {
    it('should work with setupTestRepo text fixture', async () => {
      const { setupTestRepo } = await import('../../../test/fixtures/repos/setup.js');
      const { repoPath, cleanup } = await setupTestRepo('text');

      try {
        const result = await detectVersion(repoPath);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.version).toBe('1.0.0');
        }

        // Update version
        const updateResult = await updateVersion(repoPath, toVersion('2.0.0'));
        expect(isOk(updateResult)).toBe(true);

        // Verify update
        const detection = await detectVersion(repoPath);
        expect(isOk(detection)).toBe(true);
        if (isOk(detection)) {
          expect(detection.value.version).toBe('2.0.0');
        }
      } finally {
        await cleanup();
      }
    });
  });
});
