import fs from 'fs-extra';
import {describe, it, expect, beforeEach as beforeAll, vi, afterAll} from 'vitest';
import * as go from './go.js';
import {projectPath, mockConfigFiles, projectName, oldVersion} from '../vitest/setup.detect-update.tests.js';
import {GO_VERSION_FILES} from '../core/constants.js';

describe('detect/go.js module', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockConfigFiles();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('detectVersion()', () => {
    it('extracts version from go.mod', async () => {
      fs.existingFile = 'go.mod';
      await expect(go.detectVersion(projectPath)).resolves.toEqual(oldVersion);
    });

    // Test go source files
    for (const file of GO_VERSION_FILES.slice(1, -1)) {
      // Skip go.mod and version
      it(`extracts version from ${file}`, async () => {
        fs.existingFile = file;

        await expect(go.detectVersion(projectPath)).resolves.toEqual(oldVersion);
      });
    }

    it('extracts version from plain version file', async () => {
      fs.existingFile = 'version';

      await expect(go.detectVersion(projectPath)).resolves.toEqual(oldVersion);
    });

    it('returns default version when no files found', async () => {
      fs.existingFile = 'unknown';

      await expect(go.detectVersion(projectPath)).resolves.toEqual('0.0.1');
    });
  });

  describe('detectName()', () => {
    it('detects name from go.mod', async () => {
      fs.existingFile = 'go.mod';

      await expect(go.detectName(projectPath)).resolves.toEqual(projectName);
    });

    it('returns directory name when config file is missing', async () => {
      fs.existingFile = 'unknown';

      await expect(go.detectName(projectPath)).resolves.toEqual(projectPath.split('/').pop());
    });
  });
});
